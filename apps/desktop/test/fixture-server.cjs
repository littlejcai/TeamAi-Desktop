const fs = require("node:fs/promises");
const syncFs = require("node:fs");
const path = require("node:path");
const https = require("node:https");
const { spawn, execFileSync } = require("node:child_process");
const selfsigned = require("selfsigned");
async function startServer(f) {
  let server;
  const pems = selfsigned.generate(
    [{ name: "commonName", value: "localhost" }],
    {
      days: 1,
      keySize: 2048,
      extensions: [
        { name: "basicConstraints", cA: true },
        {
          name: "keyUsage",
          keyCertSign: true,
          digitalSignature: true,
          keyEncipherment: true,
        },
        {
          name: "subjectAltName",
          altNames: [
            { type: 2, value: "localhost" },
            { type: 7, ip: "127.0.0.1" },
          ],
        },
      ],
    },
  );
  const ca = path.join(f.root, "fixture-ca.pem");
  await fs.writeFile(ca, pems.cert);

  const gitRoot = path.join(f.root, "remote");
  await fs.mkdir(path.join(gitRoot, "group"), { recursive: true });
  const bare = path.join(gitRoot, "group", "team.git");
  execFileSync("git", ["clone", "--bare", f.repo, bare]);
  const gitExec = execFileSync("git", ["--exec-path"], {
    encoding: "utf8",
  }).trim();
  let backend = path.join(gitExec, "git-http-backend");
  if (!syncFs.existsSync(backend)) backend += ".exe";
  server = https.createServer(
    { key: pems.private, cert: pems.cert },
    (req, res) => {
      const url = new URL(req.url, "https://localhost");
      const child = spawn(backend, [], {
        env: {
          ...process.env,
          GIT_PROJECT_ROOT: gitRoot,
          GIT_HTTP_EXPORT_ALL: "1",
          PATH_INFO: decodeURIComponent(url.pathname),
          QUERY_STRING: url.search.slice(1),
          REQUEST_METHOD: req.method,
          CONTENT_TYPE: req.headers["content-type"] ?? "",
          REMOTE_USER: "fixture",
          REMOTE_ADDR: "127.0.0.1",
          SERVER_PROTOCOL: "HTTP/1.1",
        },
      });
      let pending = Buffer.alloc(0),
        headers = false;
      child.stdout.on("data", (buffer) => {
        if (headers) {
          res.write(buffer);
          return;
        }
        pending = Buffer.concat([pending, buffer]);
        let sep = pending.indexOf("\r\n\r\n"),
          width = 4;
        if (sep < 0) {
          sep = pending.indexOf("\n\n");
          width = 2;
        }
        if (sep >= 0) {
          for (const line of pending
            .subarray(0, sep)
            .toString()
            .split(/\r?\n/)) {
            const colon = line.indexOf(":");
            if (colon > 0) {
              const name = line.slice(0, colon),
                value = line.slice(colon + 1).trim();
              if (name.toLowerCase() === "status")
                res.statusCode = Number.parseInt(value);
              else res.setHeader(name, value);
            }
          }
          headers = true;
          res.write(pending.subarray(sep + width));
        }
      });
      child.once("error", (e) => {
        res.statusCode = 500;
        res.end(e.message);
      });
      child.once("exit", () => res.end());
      req.pipe(child.stdin);
    },
  );
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const repo = `https://127.0.0.1:${server.address().port}/group/team.git`;

  return {
    server,
    repo,
    bare,
    ca,
    env: {
      GIT_SSL_CAINFO: ca,
      NODE_EXTRA_CA_CERTS: ca,
      NO_PROXY: [process.env.NO_PROXY, "127.0.0.1", "localhost"]
        .filter(Boolean)
        .join(","),
      no_proxy: [process.env.no_proxy, "127.0.0.1", "localhost"]
        .filter(Boolean)
        .join(","),
    },
  };
}
module.exports = { startServer };

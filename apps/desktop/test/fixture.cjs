const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const { execFileSync } = require("node:child_process");
async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "teamai-desktop-e2e-"));
  const home = path.join(root, "home"),
    project = path.join(root, "project"),
    repo = path.join(root, "repo");
  await fs.mkdir(path.join(project, ".teamai"), { recursive: true });
  await fs.mkdir(home);
  await fs.mkdir(path.join(repo, "skills", "shared", "example"), {
    recursive: true,
  });
  await fs.mkdir(path.join(repo, "manifest"));
  await fs.writeFile(
    path.join(repo, "skills/shared/example/SKILL.md"),
    "---\nname: example\ndescription: Example resource\n---\n# Example skill\n\nA real fixture from the team repo.\n",
  );
  await fs.writeFile(
    path.join(repo, "manifest/roles.yaml"),
    "version: 1\nroles:\n  - id: developer\n    description: Developer\n    resources:\n      skills: [shared]\n      knowledge: [shared]\n",
  );
  await fs.writeFile(
    path.join(repo, "teamai.yaml"),
    "team: Fixture\nrepo: https://example.test/team/resources.git\nprovider: git\ntoolPaths:\n  claude:\n    skills: .claude/skills\n    rules: .claude/rules\nsharing:\n  env:\n    injectShellProfile: false\n",
  );
  execFileSync("git", ["init", repo]);
  execFileSync("git", ["-C", repo, "add", "."]);
  execFileSync("git", [
    "-C",
    repo,
    "-c",
    "user.name=Fixture",
    "-c",
    "user.email=fixture@example.test",
    "commit",
    "-m",
    "Fixture",
  ]);
  const config = `username: fixture\nscope: project\nprojectRoot: ${JSON.stringify(project)}\nprimaryRole: developer\nrepo:\n  localPath: ${JSON.stringify(repo)}\n  remote: https://example.test/team/resources.git\n`;
  await fs.writeFile(path.join(project, ".teamai/config.yaml"), config);
  return {
    root,
    home,
    project,
    repo,
    config,
    cleanup: () => fs.rm(root, { recursive: true, force: true }),
  };
}
module.exports = { fixture };

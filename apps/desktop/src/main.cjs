const {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  shell,
  Tray,
  Menu,
  nativeImage,
} = require("electron");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const { DesktopService } = require("./service.cjs");
let window,
  service,
  tray,
  quitting = false;
const arg = (name) => {
  const p = process.argv.indexOf(name);
  return p < 0 ? null : process.argv[p + 1];
};
app.setName("TeamAI Desktop");
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on("second-instance", () => {
    window?.show();
    window?.focus();
  });
  app.whenReady().then(async () => {
    const settingsFile = path.join(app.getPath("userData"), "context.json");
    let previous = {};
    try {
      previous = JSON.parse(await fs.readFile(settingsFile, "utf8"));
    } catch {}
    if (!["user", "project"].includes(previous.scope)) previous.scope = "user";
    if (typeof previous.projectRoot !== "string") previous.projectRoot = null;
    let root = arg("--test-project") ?? previous.projectRoot ?? os.homedir();
    try {
      if (!(await fs.stat(root)).isDirectory()) root = os.homedir();
    } catch {
      root = os.homedir();
    }
    window = new BrowserWindow({
      width: 1280,
      height: 850,
      minWidth: 900,
      minHeight: 650,
      icon: path.join(__dirname, "../assets/icon.png"),
      backgroundColor: "#f5f6f8",
      show: false,
      webPreferences: {
        preload: path.join(__dirname, "preload.cjs"),
        contextIsolation: true,
        sandbox: true,
        nodeIntegration: false,
      },
    });
    service = new DesktopService({
      root,
      scope: arg("--test-project") ? "project" : (previous.scope ?? "user"),
      testHome: arg("--test-home"),
      settingsFile,
      preferences: previous.preferences,
      emit: (line) => {
        if (!window.isDestroyed()) window.webContents.send("teamai:log", line);
      },
    });
    const platform = {
      chooseDirectory: async () => {
        const r = await dialog.showOpenDialog(window, {
          properties: ["openDirectory"],
        });
        return r.canceled ? null : r.filePaths[0];
      },
      openUrl: (url) => shell.openExternal(url),
      saveLogs: async (text) => {
        const r = await dialog.showSaveDialog(window, {
          defaultPath: "teamai-diagnostics.txt",
        });
        if (!r.canceled) {
          await fs.writeFile(r.filePath, text);
          return r.filePath;
        }
      },
    };
    ipcMain.handle("teamai:request", (event, payload) => {
      if (
        event.sender !== window.webContents ||
        event.senderFrame !== window.webContents.mainFrame
      )
        throw Error("Invalid IPC sender");
      return service.request(payload, platform);
    });
    window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    window.webContents.on("will-navigate", (event) => event.preventDefault());
    window.webContents.on("will-attach-webview", (event) =>
      event.preventDefault(),
    );
    window.webContents.session.setPermissionRequestHandler(
      (_wc, _permission, callback) => callback(false),
    );
    window.once("ready-to-show", () => window.show());
    window.on("close", (event) => {
      if (tray && !quitting) {
        event.preventDefault();
        window.hide();
      }
    });
    await window.loadFile(path.join(__dirname, "../dist/index.html"));
    if (!process.argv.includes("--no-tray")) {
      try {
        const icon = nativeImage
          .createFromPath(path.join(__dirname, "../assets/icon.png"))
          .resize({ width: 20, height: 20 });
        tray = new Tray(icon);
        tray.setToolTip("TeamAI Desktop");
        tray.setContextMenu(
          Menu.buildFromTemplate([
            { label: "打开 TeamAI", click: () => window.show() },
            {
              label: "刷新状态",
              click: () => {
                window.show();
                window.webContents.send("teamai:refresh");
              },
            },
            {
              label: "退出",
              click: () => {
                quitting = true;
                app.quit();
              },
            },
          ]),
        );
        tray.on("click", () => window.show());
      } catch {
        tray = null;
      }
    }
  });
  app.on("before-quit", () => {
    quitting = true;
  });
  app.on("window-all-closed", () => {
    if (!tray) app.quit();
  });
}

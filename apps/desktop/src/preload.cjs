const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("teamai", {
  request: (payload) => ipcRenderer.invoke("teamai:request", payload),
  onRefresh: (callback) => {
    const listener = () => callback();
    ipcRenderer.on("teamai:refresh", listener);
    return () => ipcRenderer.removeListener("teamai:refresh", listener);
  },
  onLog: (callback) => {
    const listener = (_event, line) => callback(line);
    ipcRenderer.on("teamai:log", listener);
    return () => ipcRenderer.removeListener("teamai:log", listener);
  },
});

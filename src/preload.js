const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("petAPI", {
  getBounds: () => ipcRenderer.invoke("window:get-bounds"),
  getCursor: () => ipcRenderer.invoke("window:get-cursor"),
  setPosition: (point) => ipcRenderer.send("window:set-position", point),
  showMenu: () => ipcRenderer.send("window:show-menu"),
  setIgnoreMouse: (ignore) => ipcRenderer.send("window:set-ignore-mouse", ignore),
  onSetState: (callback) => {
    ipcRenderer.on("set-state", (_event, state) => callback(state));
  },
  onSetRandomPaused: (callback) => {
    ipcRenderer.on("set-random-paused", (_event, paused) => callback(paused));
  },
});

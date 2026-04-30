"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("api", {
  request: (payload) => electron.ipcRenderer.invoke("pos:request", payload),
  license: {
    isActivated: () => electron.ipcRenderer.invoke("license:isActivated"),
    activate: (shopId, key) => electron.ipcRenderer.invoke("license:activate", { shopId, key }),
    check: () => electron.ipcRenderer.invoke("license:check"),
    clear: () => electron.ipcRenderer.invoke("license:clear")
  },
  auth: {
    status: () => electron.ipcRenderer.invoke("auth:status"),
    createFirstUser: (payload) => electron.ipcRenderer.invoke("auth:createFirstUser", payload),
    login: (payload) => electron.ipcRenderer.invoke("auth:login", payload),
    changePassword: (payload) => electron.ipcRenderer.invoke("auth:changePassword", payload)
  },
  createBackup: () => electron.ipcRenderer.invoke("backup:create"),
  listBackups: () => electron.ipcRenderer.invoke("backup:list"),
  restoreBackup: (fileName) => electron.ipcRenderer.invoke("backup:restore", fileName),
  exportLogs: (destinationPath) => electron.ipcRenderer.invoke("logs:export", destinationPath),
  exportDiagnostics: (destinationPath) => electron.ipcRenderer.invoke("diagnostics:export", destinationPath),
  openPath: (targetPath) => electron.ipcRenderer.invoke("system:openPath", targetPath),
  diagnostics: () => electron.ipcRenderer.invoke("app:diagnostics"),
  minimize: () => electron.ipcRenderer.invoke("window:minimize"),
  maximize: () => electron.ipcRenderer.invoke("window:maximize"),
  close: () => electron.ipcRenderer.invoke("window:close"),
  setChromeTheme: (isDark) => electron.ipcRenderer.invoke("window:set-theme", isDark),
  reloadApp: () => electron.ipcRenderer.invoke("app:reload"),
  onAutoUpdate: (callback) => {
    const handler = (_event, payload) => callback(payload);
    electron.ipcRenderer.on("auto-update", handler);
    return () => electron.ipcRenderer.removeListener("auto-update", handler);
  },
  onUpdaterStatus: (callback) => {
    const handler = (_event, payload) => callback(payload);
    electron.ipcRenderer.on("auto-update", handler);
    return () => electron.ipcRenderer.removeListener("auto-update", handler);
  }
});
electron.contextBridge.exposeInMainWorld("electronAPI", {
  minimize: () => electron.ipcRenderer.invoke("window:minimize"),
  maximize: () => electron.ipcRenderer.invoke("window:maximize"),
  close: () => electron.ipcRenderer.invoke("window:close"),
  setChromeTheme: (isDark) => electron.ipcRenderer.invoke("window:set-theme", isDark),
  reloadApp: () => electron.ipcRenderer.invoke("app:reload"),
  onAutoUpdate: (callback) => {
    const handler = (_event, payload) => callback(payload);
    electron.ipcRenderer.on("auto-update", handler);
    return () => electron.ipcRenderer.removeListener("auto-update", handler);
  }
});

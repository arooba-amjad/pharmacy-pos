import { contextBridge, ipcRenderer } from 'electron';

type PosRequest = {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  body?: unknown;
};

contextBridge.exposeInMainWorld('api', {
  request: (payload: PosRequest) => ipcRenderer.invoke('pos:request', payload),
  createBackup: () => ipcRenderer.invoke('backup:create'),
  listBackups: () => ipcRenderer.invoke('backup:list'),
  restoreBackup: (fileName: string) => ipcRenderer.invoke('backup:restore', fileName),
  exportLogs: (destinationPath: string) => ipcRenderer.invoke('logs:export', destinationPath),
  exportDiagnostics: (destinationPath: string) => ipcRenderer.invoke('diagnostics:export', destinationPath),
  openPath: (targetPath: string) => ipcRenderer.invoke('system:openPath', targetPath),
  diagnostics: () => ipcRenderer.invoke('app:diagnostics'),
  minimize: () => ipcRenderer.invoke('window:minimize'),
  maximize: () => ipcRenderer.invoke('window:maximize'),
  close: () => ipcRenderer.invoke('window:close'),
  setChromeTheme: (isDark: boolean) => ipcRenderer.invoke('window:set-theme', isDark),
  reloadApp: () => ipcRenderer.invoke('app:reload'),
  onAutoUpdate: (callback: (payload: { phase: string; message?: string }) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, payload: { phase: string; message?: string }) => callback(payload);
    ipcRenderer.on('auto-update', handler);
    return () => ipcRenderer.removeListener('auto-update', handler);
  },
  onUpdaterStatus: (callback: (payload: { phase: string; message?: string }) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, payload: { phase: string; message?: string }) => callback(payload);
    ipcRenderer.on('auto-update', handler);
    return () => ipcRenderer.removeListener('auto-update', handler);
  },
});

contextBridge.exposeInMainWorld('electronAPI', {
  minimize: () => ipcRenderer.invoke('window:minimize'),
  maximize: () => ipcRenderer.invoke('window:maximize'),
  close: () => ipcRenderer.invoke('window:close'),
  setChromeTheme: (isDark: boolean) => ipcRenderer.invoke('window:set-theme', isDark),
  reloadApp: () => ipcRenderer.invoke('app:reload'),
  onAutoUpdate: (callback: (payload: { phase: string; message?: string }) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, payload: { phase: string; message?: string }) => callback(payload);
    ipcRenderer.on('auto-update', handler);
    return () => ipcRenderer.removeListener('auto-update', handler);
  },
});

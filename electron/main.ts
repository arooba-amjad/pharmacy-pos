import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import electronUpdater from 'electron-updater';
import { backupOnStartup, createBackup, getLatestBackupFileName, listBackups, restoreBackup, runDailyBackup } from './backup';
import { checkDatabaseIntegrity, closeDatabase, getDatabase, getDatabaseVersion, getDbPath } from './db';
import { exportDiagnosticsZip } from './diagnostics';
import { createObservedDb } from './ipc/queryMonitor';
import { registerLicenseHandlers } from './ipc/licenseHandlers';
import { registerAuthHandlers } from './ipc/authHandlers';
import { exportLogs, logger } from './logger';
import { registerDomainHandlers } from './ipc/handlers';
const require = createRequire(import.meta.url);
const { db, generateId, nowIso } = require('../backend/db.js') as {
  db: any;
  generateId: (prefix: string) => string;
  nowIso: () => string;
};
const {
  createPendingPurchase,
  createReturn,
  createSale,
  deleteBatch,
  getPurchaseById,
  receivePurchase,
  reverseSale,
  updateBatch,
} = require('../backend/services.js') as {
  createPendingPurchase: (payload: Record<string, unknown>) => unknown;
  createReturn: (payload: Record<string, unknown>) => unknown;
  createSale: (payload: Record<string, unknown>) => unknown;
  deleteBatch: (batchId: string) => unknown;
  getPurchaseById: (purchaseId: string) => unknown;
  receivePurchase: (purchaseId: string) => unknown;
  reverseSale: (saleId: string) => unknown;
  updateBatch: (batchId: string, payload: Record<string, unknown>) => unknown;
};

const { autoUpdater } = electronUpdater;
const mainFilename = fileURLToPath(import.meta.url);
const mainDirname = path.dirname(mainFilename);

process.env.DIST = path.join(mainDirname, '../dist');
process.env.VITE_PUBLIC = app.isPackaged ? process.env.DIST : path.join(process.env.DIST, '../public');
process.env.PHARMACY_USER_DATA_DIR = app.getPath('userData');

let win: BrowserWindow | null = null;

function isInsideRoot(targetPath: string, rootPath: string): boolean {
  let resolvedTarget = path.resolve(targetPath);
  let resolvedRoot = path.resolve(rootPath);
  if (process.platform === 'win32') {
    resolvedTarget = resolvedTarget.toLowerCase();
    resolvedRoot = resolvedRoot.toLowerCase();
  }
  if (resolvedTarget === resolvedRoot) return true;
  return resolvedTarget.startsWith(`${resolvedRoot}${path.sep}`);
}

function assertAllowedOpenPath(rawPath: string): string {
  const target = path.resolve(String(rawPath ?? '').trim());
  if (!target) throw new Error('Path is required.');
  const userData = app.getPath('userData');
  const desktop = app.getPath('desktop');
  const downloads = app.getPath('downloads');
  const documents = app.getPath('documents');
  if (
    !isInsideRoot(target, userData) &&
    !isInsideRoot(target, desktop) &&
    !isInsideRoot(target, downloads) &&
    !isInsideRoot(target, documents)
  ) {
    throw new Error('Path is outside allowed directories.');
  }
  return target;
}

function sendAutoUpdate(payload: { phase: string; message?: string }) {
  for (const w of BrowserWindow.getAllWindows()) {
    if (!w.isDestroyed()) w.webContents.send('auto-update', payload);
  }
}

function createWindow() {
  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC ?? '', 'electron-vite.svg'),
    width: 1280,
    height: 800,
    frame: false,
    backgroundColor: '#f4f7fb',
    webPreferences: {
      preload: path.join(mainDirname, 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) void win.loadURL(devServerUrl);
  else if (!app.isPackaged) void win.loadURL('http://127.0.0.1:5173/');
  else void win.loadFile(path.join(process.env.DIST ?? '', 'index.html'));
}

function setupAutoUpdater() {
  sendAutoUpdate({ phase: 'checking', message: 'Checking for updates...' });
  autoUpdater.autoDownload = true;
  autoUpdater.on('checking-for-update', () =>
    sendAutoUpdate({ phase: 'checking', message: 'Checking for updates...' })
  );
  autoUpdater.on('update-not-available', () =>
    sendAutoUpdate({ phase: 'not-available', message: 'You are on the latest version.' })
  );
  autoUpdater.on('download-progress', (p) =>
    sendAutoUpdate({
      phase: 'downloading',
      message: `Downloading update... ${Math.round(p.percent)}%`,
    })
  );
  autoUpdater.on('update-available', () =>
    sendAutoUpdate({ phase: 'available', message: 'Update found. Downloading...' })
  );
  autoUpdater.on('update-downloaded', async () => {
    sendAutoUpdate({ phase: 'downloaded', message: 'Update downloaded.' });
    const result = await dialog.showMessageBox({
      type: 'info',
      title: 'Update ready',
      message: 'An update was downloaded. Restart now?',
      buttons: ['Restart now', 'Later'],
      defaultId: 0,
      cancelId: 1,
    });
    if (result.response === 0) autoUpdater.quitAndInstall(false, true);
  });
  autoUpdater.on('error', (err) => {
    logger.error('Auto updater error', { message: err.message });
    sendAutoUpdate({ phase: 'error', message: err.message });
  });
  if (app.isPackaged) void autoUpdater.checkForUpdates().catch((err) => logger.warn('Update check failed', err));
}

function registerIpcHandlers() {
  registerLicenseHandlers();
  registerAuthHandlers(db);
  ipcMain.handle('window:minimize', () => win?.minimize());
  ipcMain.handle('window:maximize', () => (win?.isMaximized() ? win.unmaximize() : win?.maximize()));
  ipcMain.handle('window:close', () => win?.close());
  ipcMain.handle('window:set-theme', (_event, isDark: boolean) => win?.setBackgroundColor(isDark ? '#0f172a' : '#f4f7fb'));
  ipcMain.handle('app:reload', () => BrowserWindow.getAllWindows().forEach((w) => !w.isDestroyed() && w.reload()));

  registerDomainHandlers({
    db: createObservedDb(db),
    nowIso,
    generateId,
    createPendingPurchase,
    createReturn,
    createSale,
    deleteBatch,
    getPurchaseById,
    receivePurchase,
    reverseSale,
    updateBatch,
  });

  ipcMain.handle('backup:create', () => createBackup('manual-'));
  ipcMain.handle('backup:list', () => listBackups());
  ipcMain.handle('backup:restore', (_event, fileName: string) => {
    restoreBackup(String(fileName ?? ''));
    BrowserWindow.getAllWindows().forEach((w) => !w.isDestroyed() && w.reload());
    return true;
  });

  ipcMain.handle('logs:export', (_event, destinationPath: string) => exportLogs(String(destinationPath ?? '').trim()));
  ipcMain.handle('diagnostics:export', (_event, destinationPath: string) =>
    exportDiagnosticsZip(String(destinationPath ?? '').trim())
  );
  ipcMain.handle('system:openPath', async (_event, targetPath: string) => {
    const safe = assertAllowedOpenPath(targetPath);
    const result = await shell.openPath(safe);
    if (result) throw new Error(result);
  });
  ipcMain.handle('app:diagnostics', () => ({ dbPath: getDbPath(), dbVersion: getDatabaseVersion(), backups: listBackups() }));
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
app.on('before-quit', () => {
  try {
    createBackup('shutdown-');
  } catch (error) {
    logger.warn('Shutdown backup failed', error);
  }
});
app.on('will-quit', () => closeDatabase());

app.whenReady().then(() => {
  try {
    getDatabase();
    const integrity = checkDatabaseIntegrity();
    if (!integrity.ok) {
      logger.error('Database integrity check failed', integrity);
      const latest = getLatestBackupFileName();
      const choice = dialog.showMessageBoxSync({
        type: 'error',
        title: 'Database Recovery',
        message:
          'Database integrity checks failed. You can attempt restoring the latest backup, or exit the application.',
        detail: `integrity_check=${integrity.integrity}; foreign_key_violations=${integrity.foreignKeyViolations.length}`,
        buttons: latest ? ['Restore latest backup', 'Exit'] : ['Exit'],
        defaultId: 0,
        cancelId: latest ? 1 : 0,
      });
      if (!latest || choice !== 0) {
        app.quit();
        return;
      }
      restoreBackup(latest);
      const recheck = checkDatabaseIntegrity();
      if (!recheck.ok) {
        logger.error('Database integrity still failing after restore', recheck);
        dialog.showErrorBox(
          'Database Recovery Failed',
          'Restore did not repair database integrity. Please contact support and export diagnostics.'
        );
        app.quit();
        return;
      }
    }
    backupOnStartup();
    runDailyBackup();
    logger.info('Application started', { dbPath: getDbPath() });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error('Startup failed', { message: msg });
    const latest = getLatestBackupFileName();
    const response = dialog.showMessageBoxSync({
      type: 'error',
      title: 'Pharmacy POS Startup Failed',
      message: `Startup failed: ${msg}`,
      detail: latest
        ? 'You can attempt Safe Mode recovery by restoring latest backup, or exit.'
        : 'No backup detected. Please export diagnostics and contact support.',
      buttons: latest ? ['Restore latest backup', 'Exit'] : ['Exit'],
      defaultId: 0,
      cancelId: latest ? 1 : 0,
    });
    if (latest && response === 0) {
      try {
        restoreBackup(latest);
      } catch (restoreErr) {
        logger.error('Safe mode restore failed', { error: String(restoreErr) });
      }
    }
    app.quit();
    return;
  }
  registerIpcHandlers();
  createWindow();
  setupAutoUpdater();
});

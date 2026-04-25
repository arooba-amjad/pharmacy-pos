import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { app } from 'electron';
import AdmZip from 'adm-zip';
import { getDbPath, getDatabaseVersion } from './db';
import { getAllFeatureFlags } from './features';

function listLogFiles(logsDir: string): string[] {
  if (!fs.existsSync(logsDir)) return [];
  return fs.readdirSync(logsDir).filter((f) => f.endsWith('.log')).map((f) => path.join(logsDir, f));
}

export function exportDiagnosticsZip(destinationZipPath: string): string {
  const out = path.resolve(destinationZipPath);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const zip = new AdmZip();

  const dbPath = getDbPath();
  if (fs.existsSync(dbPath)) {
    zip.addLocalFile(dbPath, 'database', 'pharmacy.db');
  }

  const logsDir = path.join(app.getPath('userData'), 'logs');
  for (const file of listLogFiles(logsDir)) {
    zip.addLocalFile(file, 'logs');
  }

  const systemInfo = {
    osPlatform: os.platform(),
    osRelease: os.release(),
    nodeVersion: process.version,
    appVersion: app.getVersion(),
    dbVersion: getDatabaseVersion(),
    userDataPath: app.getPath('userData'),
    featureFlags: getAllFeatureFlags(),
    generatedAt: new Date().toISOString(),
  };
  zip.addFile('system-info.json', Buffer.from(JSON.stringify(systemInfo, null, 2), 'utf8'));
  zip.writeZip(out);
  return out;
}

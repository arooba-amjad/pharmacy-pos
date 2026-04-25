import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';

type LogLevel = 'info' | 'warn' | 'error';

function getLogsDir(): string {
  const dir = path.join(app.getPath('userData'), 'logs');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function getLogFilePath(): string {
  const day = new Date().toISOString().slice(0, 10);
  return path.join(getLogsDir(), `app-${day}.log`);
}

function formatLine(level: LogLevel, message: string, meta?: unknown): string {
  const payload = meta === undefined ? '' : ` ${JSON.stringify(meta)}`;
  return `[${new Date().toISOString()}] [${level.toUpperCase()}] ${message}${payload}\n`;
}

function write(level: LogLevel, message: string, meta?: unknown): void {
  const line = formatLine(level, message, meta);
  fs.appendFileSync(getLogFilePath(), line, 'utf8');
  if (level === 'error') {
    console.error(line.trim());
  } else if (level === 'warn') {
    console.warn(line.trim());
  } else {
    console.log(line.trim());
  }
}

export const logger = {
  info: (message: string, meta?: unknown) => write('info', message, meta),
  warn: (message: string, meta?: unknown) => write('warn', message, meta),
  error: (message: string, meta?: unknown) => write('error', message, meta),
};

export function exportLogs(destinationPath: string): string {
  const logsDir = getLogsDir();
  const target = path.resolve(destinationPath);
  const files = fs.readdirSync(logsDir).filter((f) => f.endsWith('.log'));
  if (files.length === 0) {
    throw new Error('No logs available to export.');
  }
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const chunks = files
    .sort()
    .map((f) => `\n===== ${f} =====\n` + fs.readFileSync(path.join(logsDir, f), 'utf8'));
  fs.writeFileSync(target, chunks.join(''), 'utf8');
  return target;
}

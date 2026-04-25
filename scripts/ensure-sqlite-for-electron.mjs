/**
 * Ensures better-sqlite3 is compiled for Electron's Node ABI (not system Node).
 * Run automatically via npm `predev`. Use `--force` to always rebuild.
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const require = createRequire(path.join(root, 'package.json'));

const force = process.argv.includes('--force');

const electronVer = require('electron/package.json').version;
const bsVer = require('better-sqlite3/package.json').version;
const stamp = `${electronVer}+${bsVer}`;
const stampFile = path.join(root, 'node_modules', '.better-sqlite3-electron-stamp');

let prev = '';
try {
  prev = fs.readFileSync(stampFile, 'utf8').trim();
} catch {
  // no stamp yet
}

if (!force && prev === stamp) {
  console.log('[native] better-sqlite3 already linked for Electron', stamp);
  process.exit(0);
}

if (force) {
  try {
    fs.rmSync(stampFile, { force: true });
  } catch {
    // ignore
  }
}

const nativeNode = path.join(root, 'node_modules', 'better-sqlite3', 'build', 'Release', 'better_sqlite3.node');

/** Windows often returns EPERM unlink when Electron still has the DLL loaded — rename frees the slot. */
function rotateLockedNativeBinary() {
  try {
    if (!fs.existsSync(nativeNode)) return;
    const bak = `${nativeNode}.bak_${Date.now()}`;
    fs.renameSync(nativeNode, bak);
    console.log('[native] Rotated prior binary →', path.basename(bak));
  } catch (e) {
    console.warn('[native] Could not rotate native binary:', e?.message ?? e);
  }
}

console.log('[native] Rebuilding better-sqlite3 for Electron…', { target: stamp });

let rebuildOk = false;
for (let attempt = 0; attempt < 2; attempt++) {
  try {
    execSync('npx electron-builder install-app-deps', { cwd: root, stdio: 'inherit' });
    rebuildOk = true;
    break;
  } catch {
    if (attempt === 0) {
      console.warn('[native] Rebuild failed — retrying once after rotating native binary…');
      rotateLockedNativeBinary();
    }
  }
}
if (!rebuildOk) {
  process.exit(1);
}

try {
  fs.mkdirSync(path.dirname(stampFile), { recursive: true });
  fs.writeFileSync(stampFile, stamp, 'utf8');
} catch {
  // stamp is optional
}

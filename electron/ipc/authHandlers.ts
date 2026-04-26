import crypto from 'node:crypto';
import { ipcMain } from 'electron';
import { z } from 'zod';

type DbLike = {
  prepare: (sql: string) => {
    get: (...args: unknown[]) => any;
    run: (...args: unknown[]) => { changes: number };
  };
};

type UserRow = {
  id: string;
  username: string;
  email: string;
  password_hash: string;
  password_salt: string;
};

const setupSchema = z.object({
  username: z.string().trim().min(1),
  email: z.string().trim().email(),
  password: z.string().min(6),
});

const loginSchema = z.object({
  identity: z.string().trim().min(1),
  password: z.string().min(1),
});

const changePasswordSchema = z.object({
  userId: z.string().trim().min(1),
  currentPassword: z.string().min(1),
  nextPassword: z.string().min(6),
});

function hashPassword(password: string, salt: string): string {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

export function registerAuthHandlers(db: DbLike): void {
  ipcMain.handle('auth:status', () => {
    const row = db.prepare('SELECT id, username, email FROM app_users ORDER BY created_at ASC LIMIT 1').get() as
      | { id: string; username: string; email: string }
      | undefined;
    if (!row) return { hasUser: false, user: null };
    return { hasUser: true, user: { id: row.id, username: row.username, email: row.email } };
  });

  ipcMain.handle('auth:createFirstUser', (_event, payload) => {
    const parsed = setupSchema.parse(payload ?? {});
    const exists = db.prepare('SELECT id FROM app_users LIMIT 1').get();
    if (exists) {
      return { ok: false, message: 'Account is already configured.' };
    }
    const id = `usr_${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`;
    const salt = crypto.randomBytes(16).toString('hex');
    const passwordHash = hashPassword(parsed.password, salt);
    const nowIso = new Date().toISOString();
    try {
      db.prepare(
        `INSERT INTO app_users (id, username, email, password_hash, password_salt, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(id, parsed.username, parsed.email.toLowerCase(), passwordHash, salt, nowIso, nowIso);
      return { ok: true, user: { id, username: parsed.username, email: parsed.email.toLowerCase() } };
    } catch {
      return { ok: false, message: 'Could not create account. Username/email may already exist.' };
    }
  });

  ipcMain.handle('auth:login', (_event, payload) => {
    const parsed = loginSchema.parse(payload ?? {});
    const identity = parsed.identity.toLowerCase();
    const row = db
      .prepare('SELECT * FROM app_users WHERE lower(username) = ? OR lower(email) = ? LIMIT 1')
      .get(identity, identity) as UserRow | undefined;
    if (!row) return { ok: false, message: 'Invalid username/email or password.' };
    const incoming = hashPassword(parsed.password, row.password_salt);
    if (incoming !== row.password_hash) {
      return { ok: false, message: 'Invalid username/email or password.' };
    }
    return { ok: true, user: { id: row.id, username: row.username, email: row.email } };
  });

  ipcMain.handle('auth:changePassword', (_event, payload) => {
    const parsed = changePasswordSchema.parse(payload ?? {});
    const row = db.prepare('SELECT * FROM app_users WHERE id = ? LIMIT 1').get(parsed.userId) as UserRow | undefined;
    if (!row) return { ok: false, message: 'No account found.' };
    const currentHash = hashPassword(parsed.currentPassword, row.password_salt);
    if (currentHash !== row.password_hash) return { ok: false, message: 'Current password is incorrect.' };
    if (parsed.nextPassword === parsed.currentPassword) {
      return { ok: false, message: 'New password must be different from current password.' };
    }
    const nextSalt = crypto.randomBytes(16).toString('hex');
    const nextHash = hashPassword(parsed.nextPassword, nextSalt);
    db.prepare('UPDATE app_users SET password_hash = ?, password_salt = ?, updated_at = ? WHERE id = ?').run(
      nextHash,
      nextSalt,
      new Date().toISOString(),
      row.id
    );
    return { ok: true };
  });
}


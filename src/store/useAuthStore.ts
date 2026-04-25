import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const IS_DEV = import.meta.env.DEV;

interface SavedUser {
  username: string;
  email: string;
  password: string;
}

interface AuthState {
  licenseActivated: boolean;
  activatedLicenseKey: string | null;
  user: SavedUser | null;
  isAuthenticated: boolean;
  activateLicense: (key: string) => { ok: true } | { ok: false; message: string };
  createFirstUser: (payload: SavedUser) => { ok: true } | { ok: false; message: string };
  login: (identity: string, password: string) => { ok: true } | { ok: false; message: string };
  changePassword: (
    currentPassword: string,
    nextPassword: string
  ) => { ok: true } | { ok: false; message: string };
  resetPasswordWithLicense: (
    licenseKey: string,
    nextPassword: string
  ) => { ok: true } | { ok: false; message: string };
  logout: () => void;
}

const ACCEPTED_KEYS = new Set([
  'PHAR-MAOS-2026-0001',
  'PHAR-MAOS-2026-0002',
  'DEMO-0000-0000-0001',
  'XXXX-XXXX-XXXX-XXXX',
]);

function normalizeKey(key: string) {
  return key.trim().toUpperCase();
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      licenseActivated: false,
      activatedLicenseKey: null,
      user: null,
      isAuthenticated: false,

      activateLicense: (rawKey) => {
        const key = normalizeKey(rawKey);
        if (IS_DEV) {
          set({ licenseActivated: true, activatedLicenseKey: key || 'DEV-BYPASS-LICENSE' });
          return { ok: true };
        }
        if (!key) return { ok: false, message: 'Please enter your license key.' };
        if (!ACCEPTED_KEYS.has(key)) {
          return { ok: false, message: 'License key is invalid. Please check and try again.' };
        }
        set({ licenseActivated: true, activatedLicenseKey: key });
        return { ok: true };
      },

      createFirstUser: ({ username, email, password }) => {
        if (IS_DEV) {
          const fallbackUsername = username.trim() || 'dev-admin';
          const fallbackEmail = email.trim().toLowerCase() || 'dev@pharmacy.local';
          const fallbackPassword = password || 'devpass123';
          set({
            user: { username: fallbackUsername, email: fallbackEmail, password: fallbackPassword },
            isAuthenticated: false,
          });
          return { ok: true };
        }
        const u = username.trim();
        const e = email.trim().toLowerCase();
        if (!u) return { ok: false, message: 'Username is required.' };
        if (!e || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
          return { ok: false, message: 'Enter a valid email address.' };
        }
        if (password.length < 6) return { ok: false, message: 'Password must be at least 6 characters.' };
        if (get().user) return { ok: false, message: 'Account is already configured.' };
        set({ user: { username: u, email: e, password }, isAuthenticated: false });
        return { ok: true };
      },

      login: (identity, password) => {
        if (IS_DEV) {
          set({ isAuthenticated: true });
          return { ok: true };
        }
        const user = get().user;
        if (!user) return { ok: false, message: 'No account found. Complete first-time setup.' };
        const id = identity.trim().toLowerCase();
        const matchesIdentity = id === user.username.toLowerCase() || id === user.email.toLowerCase();
        if (!matchesIdentity || password !== user.password) {
          return { ok: false, message: 'Invalid username/email or password.' };
        }
        set({ isAuthenticated: true });
        return { ok: true };
      },

      changePassword: (currentPassword, nextPassword) => {
        const user = get().user;
        if (!user) return { ok: false, message: 'No account found.' };

        if (!IS_DEV && currentPassword !== user.password) {
          return { ok: false, message: 'Current password is incorrect.' };
        }

        if (nextPassword.length < 6) {
          return { ok: false, message: 'New password must be at least 6 characters.' };
        }

        if (!IS_DEV && nextPassword === currentPassword) {
          return { ok: false, message: 'New password must be different from current password.' };
        }

        set({
          user: {
            ...user,
            password: nextPassword,
          },
        });

        return { ok: true };
      },

      resetPasswordWithLicense: (rawLicenseKey, nextPassword) => {
        const user = get().user;
        if (!user) return { ok: false, message: 'No account found.' };

        const key = normalizeKey(rawLicenseKey);
        if (!key) return { ok: false, message: 'License key is required.' };

        if (!IS_DEV) {
          if (!ACCEPTED_KEYS.has(key)) {
            return { ok: false, message: 'License key is invalid.' };
          }
          const active = get().activatedLicenseKey;
          if (active && normalizeKey(active) !== key) {
            return { ok: false, message: 'License key does not match this installation.' };
          }
        }

        if (nextPassword.length < 6) {
          return { ok: false, message: 'New password must be at least 6 characters.' };
        }

        set({
          user: {
            ...user,
            password: nextPassword,
          },
        });

        return { ok: true };
      },

      logout: () => set({ isAuthenticated: false }),
    }),
    {
      name: 'pharmacy-auth-v1',
      partialize: (state) => ({
        licenseActivated: state.licenseActivated,
        activatedLicenseKey: state.activatedLicenseKey,
        user: state.user,
        // Keep login session across renderer reloads; logout remains explicit.
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

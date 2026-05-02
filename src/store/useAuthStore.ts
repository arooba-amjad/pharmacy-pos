import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SavedUser {
  id: string;
  username: string;
  email: string;
}

interface AuthState {
  licenseActivated: boolean;
  activatedLicenseKey: string | null;
  user: SavedUser | null;
  isAuthenticated: boolean;
  refreshUserFromDb: () => Promise<void>;
  createFirstUser: (payload: { username: string; email: string; password: string }) => Promise<{ ok: true } | { ok: false; message: string }>;
  login: (identity: string, password: string) => Promise<{ ok: true } | { ok: false; message: string }>;
  changePassword: (currentPassword: string, nextPassword: string) => Promise<{ ok: true } | { ok: false; message: string }>;
  resetCredentials: (username: string, password: string) => Promise<{ ok: true } | { ok: false; message: string }>;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist<AuthState>(
    (set, get) => ({
      licenseActivated: false,
      activatedLicenseKey: null,
      user: null,
      isAuthenticated: false,

      refreshUserFromDb: async () => {
        const status = await window.api?.auth?.status?.();
        if (!status) return;
        set({
          user: status.user ? { id: status.user.id, username: status.user.username, email: status.user.email } : null,
        });
      },

      createFirstUser: async ({ username, email, password }) => {
        const result = await window.api?.auth?.createFirstUser?.({
          username: username.trim(),
          email: email.trim().toLowerCase(),
          password,
        });
        if (!result?.ok || !result.user) {
          return { ok: false, message: result?.message ?? 'Could not create account.' };
        }
        set({
          user: { id: result.user.id, username: result.user.username, email: result.user.email },
          isAuthenticated: false,
        });
        return { ok: true };
      },

      login: async (identity, password) => {
        const result = await window.api?.auth?.login?.({
          identity: identity.trim(),
          password,
        });
        if (!result?.ok || !result.user) {
          return { ok: false, message: result?.message ?? 'Invalid username/email or password.' };
        }
        set({
          user: { id: result.user.id, username: result.user.username, email: result.user.email },
          isAuthenticated: true,
        });
        return { ok: true };
      },

      changePassword: async (currentPassword, nextPassword) => {
        const state = get();
        if (!state.user?.id) return { ok: false, message: 'No account found.' };
        const result = await window.api?.auth?.changePassword?.({
          userId: state.user.id,
          currentPassword,
          nextPassword,
        });
        if (!result?.ok) return { ok: false, message: result?.message ?? 'Could not change password.' };
        return { ok: true };
      },

      resetCredentials: async (username, password) => {
        const result = await window.api?.auth?.resetCredentials?.({
          username: username.trim(),
          password,
        });
        if (!result?.ok || !result.user) {
          return { ok: false, message: result?.message ?? 'Could not reset credentials.' };
        }
        set({
          user: { id: result.user.id, username: result.user.username, email: result.user.email },
          isAuthenticated: false,
        });
        return { ok: true };
      },

      logout: () => set({ isAuthenticated: false }),
    }),
    {
      name: 'pharmacy-auth-v1',
    }
  )
);

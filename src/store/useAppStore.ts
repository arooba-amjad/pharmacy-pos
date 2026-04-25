import { create } from 'zustand';
import type { AppScreen } from '../types';
import { readStoredThemeIsDark, writeStoredTheme } from '@/lib/themeStorage';

interface AppState {
  currentScreen: AppScreen;
  isSidebarCollapsed: boolean;
  isDarkMode: boolean;
  setCurrentScreen: (screen: AppScreen) => void;
  toggleSidebar: () => void;
  toggleDarkMode: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  currentScreen: 'POS',
  isSidebarCollapsed: false,
  isDarkMode: readStoredThemeIsDark(),
  setCurrentScreen: (screen) => set({ currentScreen: screen }),
  toggleSidebar: () => set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),
  toggleDarkMode: () =>
    set((state) => {
      const next = !state.isDarkMode;
      writeStoredTheme(next);
      return { isDarkMode: next };
    }),
}));

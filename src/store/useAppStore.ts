import { create } from 'zustand';
import type { AppScreen } from '../types';
import { writeStoredTheme } from '@/lib/themeStorage';

interface AppState {
  currentScreen: AppScreen;
  isSidebarCollapsed: boolean;
  isSidebarForcedCollapsed: boolean;
  isDarkMode: boolean;
  setCurrentScreen: (screen: AppScreen) => void;
  toggleSidebar: () => void;
  setSidebarForcedCollapsed: (forced: boolean) => void;
  toggleDarkMode: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  currentScreen: 'POS',
  isSidebarCollapsed: false,
  isSidebarForcedCollapsed: false,
  isDarkMode: false,
  setCurrentScreen: (screen) => set({ currentScreen: screen }),
  toggleSidebar: () =>
    set((state) => {
      // When a narrow viewport forces collapse, the toggle still works — it just
      // disables the forced flag on expand so the user choice wins.
      if (state.isSidebarForcedCollapsed && state.isSidebarCollapsed) {
        return { isSidebarCollapsed: false, isSidebarForcedCollapsed: false };
      }
      return { isSidebarCollapsed: !state.isSidebarCollapsed };
    }),
  setSidebarForcedCollapsed: (forced) =>
    set((state) => {
      if (forced) {
        return { isSidebarForcedCollapsed: true, isSidebarCollapsed: true };
      }
      // When the viewport grows back, only auto-expand if we were the ones
      // who collapsed it (i.e. forced flag was set).
      if (state.isSidebarForcedCollapsed) {
        return { isSidebarForcedCollapsed: false, isSidebarCollapsed: false };
      }
      return { isSidebarForcedCollapsed: false };
    }),
  toggleDarkMode: () =>
    set(() => {
      writeStoredTheme(false);
      return { isDarkMode: false };
    }),
}));

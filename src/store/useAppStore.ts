import { create } from 'zustand';
import type { AppScreen } from '../types';
import { writeStoredTheme } from '@/lib/themeStorage';

interface AppState {
  currentScreen: AppScreen;
  isSidebarCollapsed: boolean;
  isSidebarForcedCollapsed: boolean;
  isMobileSidebarOpen: boolean;
  isDarkMode: boolean;
  setCurrentScreen: (screen: AppScreen) => void;
  toggleSidebar: () => void;
  setSidebarForcedCollapsed: (forced: boolean) => void;
  openMobileSidebar: () => void;
  closeMobileSidebar: () => void;
  toggleDarkMode: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  currentScreen: 'POS',
  isSidebarCollapsed: false,
  isSidebarForcedCollapsed: false,
  isMobileSidebarOpen: false,
  isDarkMode: false,
  // Selecting a screen also closes any open mobile drawer so the user lands
  // on the new page directly without an extra dismiss tap.
  setCurrentScreen: (screen) => set({ currentScreen: screen, isMobileSidebarOpen: false }),
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
  openMobileSidebar: () => set({ isMobileSidebarOpen: true }),
  closeMobileSidebar: () => set({ isMobileSidebarOpen: false }),
  toggleDarkMode: () =>
    set(() => {
      writeStoredTheme(false);
      return { isDarkMode: false };
    }),
}));

import { create } from 'zustand';
import type { AppScreen } from '../types';
import { writeStoredTheme } from '@/lib/themeStorage';

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
  isDarkMode: false,
  setCurrentScreen: (screen) => set({ currentScreen: screen }),
  toggleSidebar: () => set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),
  toggleDarkMode: () =>
    set(() => {
      writeStoredTheme(false);
      return { isDarkMode: false };
    }),
}));

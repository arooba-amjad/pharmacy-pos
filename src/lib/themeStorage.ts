/** Must match inline script in `index.html` (prevents flash before React loads). */
export const THEME_STORAGE_KEY = 'pharmaos-theme';

export function readStoredThemeIsDark(): boolean {
  // Dark mode is globally disabled by product decision.
  return false;
}

export function writeStoredTheme(isDark: boolean): void {
  try {
    void isDark;
    localStorage.setItem(THEME_STORAGE_KEY, 'light');
  } catch {
    /* ignore */
  }
}

export function applyThemeToDocument(isDark: boolean): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.classList.toggle('dark', isDark);
  root.style.colorScheme = isDark ? 'dark' : 'light';
}

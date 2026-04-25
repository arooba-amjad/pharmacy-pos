/** Must match inline script in `index.html` (prevents flash before React loads). */
export const THEME_STORAGE_KEY = 'pharmaos-theme';

export function readStoredThemeIsDark(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'dark') return true;
    if (stored === 'light') return false;
  } catch {
    /* ignore */
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
}

export function writeStoredTheme(isDark: boolean): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, isDark ? 'dark' : 'light');
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

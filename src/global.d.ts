export {};

declare global {
  type LicenseStatus = 'active' | 'inactive' | 'expired';
  type LicenseCheckResponse = {
    isValid: boolean;
    status: LicenseStatus;
    expiresAt: string;
    clientName: string;
    daysRemaining: number;
    message: string;
    offlineMode?: boolean;
  };

  interface Window {
    api?: {
      request: (payload: { method: 'GET' | 'POST' | 'PUT' | 'DELETE'; path: string; body?: unknown }) => Promise<{
        ok?: boolean;
        success?: boolean;
        data?: unknown;
        error?: string;
        message?: string;
      }>;
      license: {
        isActivated: () => Promise<boolean>;
        activate: (shopId: string, key: string) => Promise<LicenseCheckResponse>;
        check: () => Promise<LicenseCheckResponse>;
        clear: () => Promise<void>;
      };
      auth: {
        status: () => Promise<{ hasUser: boolean; user: { id: string; username: string; email: string } | null }>;
        createFirstUser: (payload: {
          username: string;
          email: string;
          password: string;
        }) => Promise<{ ok: boolean; message?: string; user?: { id: string; username: string; email: string } }>;
        login: (payload: { identity: string; password: string }) => Promise<{
          ok: boolean;
          message?: string;
          user?: { id: string; username: string; email: string };
        }>;
        changePassword: (payload: {
          userId: string;
          currentPassword: string;
          nextPassword: string;
        }) => Promise<{ ok: boolean; message?: string }>;
      };
      createBackup: () => Promise<string>;
      listBackups: () => Promise<string[]>;
      restoreBackup: (fileName: string) => Promise<boolean>;
      exportLogs: (destinationPath: string) => Promise<string>;
      exportDiagnostics?: (destinationPath: string) => Promise<string>;
      openPath?: (targetPath: string) => Promise<void>;
      diagnostics: () => Promise<unknown>;
      minimize: () => Promise<void>;
      maximize: () => Promise<void>;
      close: () => Promise<void>;
      reloadApp: () => Promise<void>;
      onAutoUpdate: (callback: (payload: { phase: string; message?: string }) => void) => () => void;
      onUpdaterStatus?: (callback: (payload: { phase: string; message?: string }) => void) => () => void;
      setChromeTheme: (isDark: boolean) => Promise<void>;
    };
    electronAPI?: {
      minimize: () => Promise<void>;
      maximize: () => Promise<void>;
      close: () => Promise<void>;
      /** Unsubscribe returned from `onAutoUpdate`. */
      reloadApp?: () => Promise<void>;
      onAutoUpdate?: (callback: (payload: { phase: string; message?: string }) => void) => () => void;
      /** Frameless window paint color — matches app shell in light/dark. */
      setChromeTheme?: (isDark: boolean) => Promise<void>;
    };
  }
}

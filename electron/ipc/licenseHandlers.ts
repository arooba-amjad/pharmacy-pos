import { ipcMain } from 'electron';
import { z } from 'zod';
import { LicenseService } from '../license/licenseService';

const activateSchema = z.object({
  shopId: z.string().trim().min(1),
  key: z.string().trim().min(1),
});

export function registerLicenseHandlers(): void {
  const service = new LicenseService();

  ipcMain.handle('license:isActivated', () => service.isActivated());
  ipcMain.handle('license:activate', async (_event, payload) => {
    const parsed = activateSchema.parse(payload ?? {});
    return service.activateLicense(parsed.shopId, parsed.key);
  });
  ipcMain.handle('license:check', async () => service.checkLicense());
  ipcMain.handle('license:clear', async () => {
    service.clearLicense();
    return true;
  });
}


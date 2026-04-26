import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

type LicenseRow = {
  shop_id: string;
  activation_key: string;
  status: 'active' | 'inactive' | 'expired';
  expires_at: string;
  last_checked_at: string | null;
  client_name: string | null;
};

type SupabaseErrorLike = {
  message?: string;
  code?: string;
};

type StoredLicense = {
  shopId: string;
  activationKey: string;
  expiresAt: string;
  clientName: string;
  lastSuccessfulCheck: string;
};

export type LicenseCheckResult = {
  isValid: boolean;
  status: 'active' | 'inactive' | 'expired';
  expiresAt: string;
  clientName: string;
  daysRemaining: number;
  message: string;
  offlineMode?: boolean;
};

const LICENSE_SERVER_URL = 'https://hzjvddohqvokcmbkfwfp.supabase.co';
const LICENSE_SERVER_ANON_KEY =
  process.env.PHARMACY_LICENSE_SUPABASE_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6anZkZG9ocXZva2NtYmtmd2ZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5NDMwNTksImV4cCI6MjA4OTUxOTA1OX0.hm3KpyrzJb8nFTmf0ff1KpHMt56WdRCJyfoAprTsAYY';
const OFFLINE_GRACE_MS = 24 * 60 * 60 * 1000;

function ensureSupabaseConfig(): void {
  if (!LICENSE_SERVER_URL || !LICENSE_SERVER_ANON_KEY || LICENSE_SERVER_ANON_KEY.length < 32) {
    throw new Error('License server is not configured. Set PHARMACY_LICENSE_SUPABASE_ANON_KEY in main process.');
  }
}

function toUtcMidnight(dateLike: string): Date {
  const date = new Date(dateLike);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function calculateDaysRemaining(expiresAt: string): number {
  const today = toUtcMidnight(new Date().toISOString());
  const expiryDay = toUtcMidnight(expiresAt);
  return Math.ceil((expiryDay.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
}

export class LicenseService {
  private readonly supabase: SupabaseClient;

  private readonly licenseFilePath: string;

  constructor() {
    this.supabase = createClient(LICENSE_SERVER_URL, LICENSE_SERVER_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const userDataDir = app.getPath('userData');
    this.licenseFilePath = path.join(userDataDir, 'license.json');
  }

  isActivated(): boolean {
    const stored = this.readStoredLicense();
    return Boolean(stored?.shopId && stored?.activationKey);
  }

  async activateLicense(shopIdRaw: string, activationKeyRaw: string): Promise<LicenseCheckResult> {
    const shopId = String(shopIdRaw ?? '').trim();
    const activationKey = String(activationKeyRaw ?? '').trim();
    if (!shopId || !activationKey) {
      return this.invalidResult('inactive', '', '', 'Shop ID and activation key are required.');
    }
    try {
      ensureSupabaseConfig();
    } catch (error) {
      return this.invalidResult('inactive', '', '', error instanceof Error ? error.message : 'License server not configured.');
    }

    let row: LicenseRow | null = null;
    try {
      row = await this.fetchLicense(shopId, activationKey);
    } catch (error) {
      return this.invalidResult(
        'inactive',
        '',
        '',
        error instanceof Error ? error.message : 'License validation request failed.'
      );
    }
    if (!row) {
      return this.invalidResult('inactive', '', '', 'Activation failed. Invalid Shop ID or activation key.');
    }

    const daysRemaining = calculateDaysRemaining(row.expires_at);
    if (row.status !== 'active' || daysRemaining < 0) {
      return this.invalidResult(
        daysRemaining < 0 ? 'expired' : row.status,
        row.expires_at,
        row.client_name ?? '',
        daysRemaining < 0 ? 'License has expired.' : 'License is not active.'
      );
    }

    const nowIso = new Date().toISOString();
    await this.updateRemoteLastChecked(shopId, activationKey, nowIso);
    this.writeStoredLicense({
      shopId,
      activationKey,
      expiresAt: row.expires_at,
      clientName: row.client_name ?? '',
      lastSuccessfulCheck: nowIso,
    });

    return {
      isValid: true,
      status: 'active',
      expiresAt: row.expires_at,
      clientName: row.client_name ?? '',
      daysRemaining,
      message: 'License activated successfully.',
    };
  }

  async checkLicense(): Promise<LicenseCheckResult> {
    const stored = this.readStoredLicense();
    if (!stored) {
      return this.invalidResult('inactive', '', '', 'License not activated.');
    }

    const localDaysRemaining = calculateDaysRemaining(stored.expiresAt);
    if (localDaysRemaining < 0) {
      return this.invalidResult('expired', stored.expiresAt, stored.clientName, 'License has expired.');
    }
    try {
      ensureSupabaseConfig();
    } catch (error) {
      return this.invalidResult(
        'inactive',
        stored.expiresAt,
        stored.clientName,
        error instanceof Error ? error.message : 'License server not configured.'
      );
    }

    try {
      const row = await this.fetchLicense(stored.shopId, stored.activationKey);
      if (!row) {
        return this.invalidResult('inactive', stored.expiresAt, stored.clientName, 'License not found.');
      }

      const daysRemaining = calculateDaysRemaining(row.expires_at);
      const status: LicenseCheckResult['status'] = daysRemaining < 0 ? 'expired' : row.status;
      if (status !== 'active') {
        return this.invalidResult(
          status,
          row.expires_at,
          row.client_name ?? stored.clientName,
          status === 'expired' ? 'License has expired.' : 'License is inactive.'
        );
      }

      const nowIso = new Date().toISOString();
      await this.updateRemoteLastChecked(stored.shopId, stored.activationKey, nowIso);
      this.writeStoredLicense({
        shopId: stored.shopId,
        activationKey: stored.activationKey,
        expiresAt: row.expires_at,
        clientName: row.client_name ?? stored.clientName,
        lastSuccessfulCheck: nowIso,
      });

      return {
        isValid: true,
        status: 'active',
        expiresAt: row.expires_at,
        clientName: row.client_name ?? stored.clientName,
        daysRemaining,
        message: 'License is valid.',
      };
    } catch {
      const lastSuccess = new Date(stored.lastSuccessfulCheck).getTime();
      const age = Date.now() - (Number.isFinite(lastSuccess) ? lastSuccess : 0);
      if (age <= OFFLINE_GRACE_MS) {
        return {
          isValid: true,
          status: 'active',
          expiresAt: stored.expiresAt,
          clientName: stored.clientName,
          daysRemaining: localDaysRemaining,
          message: 'Offline mode: using last successful license check.',
          offlineMode: true,
        };
      }
      return this.invalidResult(
        'inactive',
        stored.expiresAt,
        stored.clientName,
        'Unable to validate license. Connect to internet to continue.'
      );
    }
  }

  clearLicense(): void {
    if (fs.existsSync(this.licenseFilePath)) {
      fs.unlinkSync(this.licenseFilePath);
    }
  }

  private invalidResult(
    status: LicenseCheckResult['status'],
    expiresAt: string,
    clientName: string,
    message: string
  ): LicenseCheckResult {
    return {
      isValid: false,
      status,
      expiresAt,
      clientName,
      daysRemaining: expiresAt ? calculateDaysRemaining(expiresAt) : 0,
      message,
    };
  }

  private async fetchLicense(shopId: string, activationKey: string): Promise<LicenseRow | null> {
    const { data, error } = await this.supabase
      .from('licenses')
      .select('*')
      .eq('shop_id', shopId)
      .eq('activation_key', activationKey)
      .single();
    if (error) {
      const e = error as SupabaseErrorLike;
      // Supabase returns PGRST116 when .single() finds no row.
      if (e.code === 'PGRST116') return null;
      throw new Error(e.message || 'License server query failed.');
    }
    return (data as LicenseRow) ?? null;
  }

  private async updateRemoteLastChecked(shopId: string, activationKey: string, nowIso: string): Promise<void> {
    const { error } = await this.supabase
      .from('licenses')
      .update({ last_checked_at: nowIso })
      .eq('shop_id', shopId)
      .eq('activation_key', activationKey);
    if (error) throw error;
  }

  private readStoredLicense(): StoredLicense | null {
    if (!fs.existsSync(this.licenseFilePath)) return null;
    try {
      const raw = fs.readFileSync(this.licenseFilePath, 'utf8');
      const parsed = JSON.parse(raw) as Partial<StoredLicense>;
      if (!parsed.shopId || !parsed.activationKey || !parsed.expiresAt || !parsed.lastSuccessfulCheck) return null;
      return {
        shopId: parsed.shopId,
        activationKey: parsed.activationKey,
        expiresAt: parsed.expiresAt,
        clientName: parsed.clientName ?? '',
        lastSuccessfulCheck: parsed.lastSuccessfulCheck,
      };
    } catch {
      return null;
    }
  }

  private writeStoredLicense(payload: StoredLicense): void {
    fs.writeFileSync(this.licenseFilePath, JSON.stringify(payload, null, 2), 'utf8');
  }
}


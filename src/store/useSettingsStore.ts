import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ReceiptFormat = 'thermal' | 'a4';

export interface AppSettingsSnapshot {
  pharmacyName: string;
  pharmacyAddress: string;
  pharmacyPhone: string;
  taxPercent: number;
  /** Optional default % hint for staff (POS can use later). */
  defaultDiscountPercent: number;
  /** When true, staff default discount % is active for new sessions (preview + guidance). */
  defaultDiscountEnabled: boolean;
  /** Short note, e.g. “Staff 5%, senior citizen”. */
  discountRulesNote: string;
  serviceChargeDefaultDelivery: number;
  /** When false, checkout does not pre-fill suggested delivery charges. */
  serviceChargesEnabled: boolean;
  invoicePrefix: string;
  receiptShowLogo: boolean;
  /** When false, customer block is omitted from printed/saved receipts. */
  receiptShowCustomerInfo: boolean;
  receiptFormat: ReceiptFormat;
  autoPrintAfterCheckout: boolean;
  defaultFocusSearch: boolean;
  keyboardShortcutsEnabled: boolean;
  /** Allow unit price below batch cost when true. */
  allowSellBelowCost: boolean;
  /** Emphasize barcode scanning in search (placeholder + UX hint). */
  barcodeModeEnabled: boolean;
  lowStockThreshold: number;
  /** Batches expiring within this many days are flagged as “expiring soon”. */
  expiryAlertDays: number;
  /** Allow cart quantities to exceed on-hand (stock can go negative). */
  allowNegativeStock: boolean;
  primaryColorHex: string;
  fontScale: number;
  lastBackupTime: string | null;
  storageUsedMb: number;
  appVersion: string;
}

const defaults: AppSettingsSnapshot = {
  pharmacyName: 'PharmaCare Pharmacy',
  pharmacyAddress: 'Shop 12, City Medical Plaza · Lahore',
  pharmacyPhone: 'Tel: +92 300 5550199',
  taxPercent: 5,
  defaultDiscountPercent: 0,
  defaultDiscountEnabled: false,
  discountRulesNote: '',
  serviceChargeDefaultDelivery: 0,
  serviceChargesEnabled: true,
  invoicePrefix: 'INV',
  receiptShowLogo: true,
  receiptShowCustomerInfo: true,
  receiptFormat: 'a4',
  autoPrintAfterCheckout: false,
  defaultFocusSearch: true,
  keyboardShortcutsEnabled: true,
  allowSellBelowCost: false,
  barcodeModeEnabled: false,
  lowStockThreshold: 20,
  expiryAlertDays: 75,
  allowNegativeStock: false,
  primaryColorHex: '#0d9488',
  fontScale: 1,
  lastBackupTime: null,
  storageUsedMb: 42,
  appVersion: '1.2.0',
};

export type SettingsState = AppSettingsSnapshot & {
  patch: (partial: Partial<AppSettingsSnapshot>) => void;
  runMockBackup: () => void;
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...defaults,
      patch: (partial) => set((s) => ({ ...s, ...partial })),
      runMockBackup: () => set({ lastBackupTime: new Date().toISOString() }),
    }),
    {
      name: 'pharma-pos-settings-v1',
      merge: (persisted, current) => ({ ...current, ...(persisted as object) }),
      partialize: (s) => ({
        pharmacyName: s.pharmacyName,
        pharmacyAddress: s.pharmacyAddress,
        pharmacyPhone: s.pharmacyPhone,
        taxPercent: s.taxPercent,
        defaultDiscountPercent: s.defaultDiscountPercent,
        defaultDiscountEnabled: s.defaultDiscountEnabled,
        discountRulesNote: s.discountRulesNote,
        serviceChargeDefaultDelivery: s.serviceChargeDefaultDelivery,
        serviceChargesEnabled: s.serviceChargesEnabled,
        invoicePrefix: s.invoicePrefix,
        receiptShowLogo: s.receiptShowLogo,
        receiptShowCustomerInfo: s.receiptShowCustomerInfo,
        receiptFormat: s.receiptFormat,
        autoPrintAfterCheckout: s.autoPrintAfterCheckout,
        defaultFocusSearch: s.defaultFocusSearch,
        keyboardShortcutsEnabled: s.keyboardShortcutsEnabled,
        allowSellBelowCost: s.allowSellBelowCost,
        barcodeModeEnabled: s.barcodeModeEnabled,
        lowStockThreshold: s.lowStockThreshold,
        expiryAlertDays: s.expiryAlertDays,
        allowNegativeStock: s.allowNegativeStock,
        primaryColorHex: s.primaryColorHex,
        fontScale: s.fontScale,
        lastBackupTime: s.lastBackupTime,
        storageUsedMb: s.storageUsedMb,
        appVersion: s.appVersion,
      }),
    }
  )
);

export function getReceiptBrandingFromSettings(): {
  name: string;
  address: string;
  phone: string;
} {
  const s = useSettingsStore.getState();
  return {
    name: s.pharmacyName,
    address: s.pharmacyAddress,
    phone: s.pharmacyPhone,
  };
}

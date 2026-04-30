import type { CartLine, Medicine } from '@/types';
import { getMedicineSalts } from '@/lib/medicineSalts';
import { isExpired, isExpiringSoon } from '@/lib/posDates';
import { lineTotalTablets } from '@/lib/posCartQuantity';
import { useSettingsStore } from '@/store/useSettingsStore';
import { medicineTypeShortLabel } from '@/lib/medicineDisplay';

export type StockStatus = 'ok' | 'low' | 'out';

/** Low-stock line in tablets: per-medicine when set, otherwise Settings default (≥1). */
export function getMedicineLowStockThresholdTablets(m: Medicine): number {
  if (m.lowStockThreshold != null && Number.isFinite(m.lowStockThreshold)) {
    return Math.max(0, Math.floor(m.lowStockThreshold));
  }
  const st = useSettingsStore.getState();
  return Math.max(1, Math.floor(st.lowStockThreshold ?? 20));
}

export function getMedicineAvailability(m: Medicine): {
  sellableQty: number;
  displayPrice: number | null;
  status: StockStatus;
  expiringSoon: boolean;
} {
  let sellableQty = 0;
  const masterSale =
    m.salePricePerTablet != null
      ? Math.max(0.01, Number(m.salePricePerTablet))
      : m.defaultSalePrice != null
        ? Math.max(0.01, Number(m.defaultSalePrice))
        : null;
  let displayPrice: number | null =
    masterSale != null && Number.isFinite(masterSale) ? masterSale : null;
  let expiringSoon = false;
  const lowThresh = getMedicineLowStockThresholdTablets(m);
  const expDays = Math.max(1, useSettingsStore.getState().expiryAlertDays ?? 75);

  for (const b of m.batches) {
    if (isExpired(b.expiryDate)) continue;
    sellableQty += b.totalTablets;
    if (b.totalTablets > 0) {
      displayPrice =
        displayPrice === null ? b.salePricePerTablet : Math.min(displayPrice, b.salePricePerTablet);
      if (isExpiringSoon(b.expiryDate, expDays)) expiringSoon = true;
    }
  }
  const status: StockStatus =
    sellableQty <= 0 ? 'out' : sellableQty <= lowThresh ? 'low' : 'ok';

  return { sellableQty, displayPrice, status, expiringSoon };
}

/** Sum of cart demand in tablets for one medicine (for shelf preview). */
export function cartReservedTabletsForMedicine(cart: CartLine[], medicineId: string): number {
  return cart
    .filter((l) => l.medicineId === medicineId)
    .reduce((acc, l) => acc + lineTotalTablets(l), 0);
}

export function getMedicineAvailabilityWithCart(
  m: Medicine,
  cart: CartLine[]
): ReturnType<typeof getMedicineAvailability> & { previewQty: number; reservedTablets: number } {
  const base = getMedicineAvailability(m);
  const reservedTablets = cartReservedTabletsForMedicine(cart, m.id);
  const previewQty = Math.max(0, base.sellableQty - reservedTablets);
  return { ...base, previewQty, reservedTablets };
}

export function medicineMatchesQuery(m: Medicine, q: string): boolean {
  if (!q.trim()) return true;
  const s = q.toLowerCase().trim();
  if (m.id.toLowerCase().includes(s)) return true;
  if (m.name.toLowerCase().includes(s)) return true;
  if (m.generic.toLowerCase().includes(s)) return true;
  if (m.category.toLowerCase().includes(s)) return true;
  if ((m.type ?? '').toLowerCase().includes(s)) return true;
  if (medicineTypeShortLabel(m.type).toLowerCase().includes(s)) return true;
  if ((m.manufacturer ?? '').toLowerCase().includes(s)) return true;
  if ((m.brand ?? '').toLowerCase().includes(s)) return true;
  for (const salt of getMedicineSalts(m)) {
    if (salt.toLowerCase().includes(s)) return true;
  }
  return m.batches.some((b) => b.batchNo.toLowerCase().includes(s));
}

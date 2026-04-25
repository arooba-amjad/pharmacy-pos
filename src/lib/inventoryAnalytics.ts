import type { Medicine, MedicineBatch } from '@/types';
import { daysUntilExpiry, isExpired, isExpiringSoon, parseLocalDay } from '@/lib/posDates';
import { getMedicineAvailability, medicineMatchesQuery } from '@/lib/posSearchHelpers';
import { useSettingsStore } from '@/store/useSettingsStore';

export type InventoryStatusFilter = 'all' | 'low' | 'expiring' | 'out';

export interface InventoryStats {
  totalMedicines: number;
  lowStockCount: number;
  expiringSoonCount: number;
  outOfStockCount: number;
  totalValueAtCost: number;
}

export function computeInventoryStats(medicines: Medicine[]): InventoryStats {
  let lowStockCount = 0;
  let expiringSoonCount = 0;
  let outOfStockCount = 0;
  let totalValueAtCost = 0;

  for (const m of medicines) {
    const { sellableQty, status, expiringSoon } = getMedicineAvailability(m);
    if (status === 'out') outOfStockCount += 1;
    else if (status === 'low') lowStockCount += 1;
    if (expiringSoon && sellableQty > 0) expiringSoonCount += 1;

    for (const b of m.batches) {
      if (isExpired(b.expiryDate)) continue;
      totalValueAtCost += b.totalTablets * b.costPricePerTablet;
    }
  }

  return {
    totalMedicines: medicines.length,
    lowStockCount,
    expiringSoonCount,
    outOfStockCount,
    totalValueAtCost: Math.round(totalValueAtCost * 100) / 100,
  };
}

export function nearestSellableBatch(m: Medicine): MedicineBatch | null {
  const sellable = m.batches
    .filter((b) => !isExpired(b.expiryDate) && b.totalTablets > 0)
    .sort((a, b) => parseLocalDay(a.expiryDate).getTime() - parseLocalDay(b.expiryDate).getTime());
  return sellable[0] ?? null;
}

export type ExpiryTone = 'safe' | 'warn' | 'critical' | 'expired' | 'none';

export function expiryToneForDate(expiryDate: string | null): ExpiryTone {
  if (!expiryDate) return 'none';
  if (isExpired(expiryDate)) return 'expired';
  const days = daysUntilExpiry(expiryDate);
  if (days <= 30) return 'critical';
  const expDays = Math.max(1, useSettingsStore.getState().expiryAlertDays ?? 75);
  if (isExpiringSoon(expiryDate, expDays)) return 'warn';
  return 'safe';
}

export function filterMedicines(
  medicines: Medicine[],
  query: string,
  status: InventoryStatusFilter,
  category: string | 'all',
  expiringOnly: boolean
): Medicine[] {
  return medicines.filter((m) => {
    if (category !== 'all' && m.category !== category) return false;
    if (!medicineMatchesQuery(m, query)) return false;

    const avail = getMedicineAvailability(m);
    if (expiringOnly && (!avail.expiringSoon || avail.sellableQty <= 0)) return false;

    if (status === 'all') return true;
    if (status === 'out') return avail.status === 'out';
    if (status === 'low') return avail.status === 'low';
    if (status === 'expiring') return avail.expiringSoon && avail.sellableQty > 0;
    return true;
  });
}

export function stockBarPercent(sellableQty: number, cap = 150): number {
  if (cap <= 0) return 0;
  return Math.min(100, Math.round((sellableQty / cap) * 100));
}

import type { Medicine } from '@/types';
import { isExpired } from '@/lib/posDates';
import { costPerPackFromTablet, getMedicineTabletsPerPack, packSaleFromTablet } from '@/lib/stockUnits';

/** Master default sale price per tablet, with sensible fallback from lots. */
export function getMasterSalePrice(m: Medicine): number | null {
  if (m.salePricePerTablet != null && Number.isFinite(m.salePricePerTablet)) {
    return m.salePricePerTablet;
  }
  if (m.defaultSalePrice != null && Number.isFinite(m.defaultSalePrice)) {
    return m.defaultSalePrice;
  }
  const sellable = m.batches.filter((b) => !isExpired(b.expiryDate) && b.totalTablets > 0);
  if (sellable.length === 0) {
    const b = m.batches[0];
    return b ? b.salePricePerTablet : null;
  }
  return Math.min(...sellable.map((b) => b.salePricePerTablet));
}

/** Master default purchase / cost per tablet, with fallback from lots. */
export function getMasterPurchasePrice(m: Medicine): number | null {
  if (m.defaultPurchasePrice != null && Number.isFinite(m.defaultPurchasePrice)) {
    return m.defaultPurchasePrice;
  }
  const sellable = m.batches.filter((b) => !isExpired(b.expiryDate) && b.totalTablets > 0);
  if (sellable.length === 0) {
    const b = m.batches[0];
    return b ? b.costPricePerTablet : null;
  }
  return Math.min(...sellable.map((b) => b.costPricePerTablet));
}

/** Default catalog sale price per full pack (from per-tablet master or stored pack price). */
export function getMasterSalePricePerPack(m: Medicine): number | null {
  const tpp = getMedicineTabletsPerPack(m);
  if (m.salePricePerPack != null && Number.isFinite(m.salePricePerPack)) {
    return Math.max(0.01, Math.round(m.salePricePerPack * 100) / 100);
  }
  const tab = getMasterSalePrice(m);
  if (tab == null) return null;
  return tpp >= 2 ? packSaleFromTablet(tab, tpp) : tab;
}

/** Default catalog purchase (cost) per full pack. */
export function getMasterPurchasePricePerPack(m: Medicine): number | null {
  const tpp = getMedicineTabletsPerPack(m);
  const tab = getMasterPurchasePrice(m);
  if (tab == null) return null;
  return tpp >= 2 ? costPerPackFromTablet(tab, tpp) : tab;
}

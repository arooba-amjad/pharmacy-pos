import type { Medicine, MedicineBatch } from '@/types';

/** Parse first positive integer from a pack label, e.g. "10 caplets" → 10. */
export function parseTabletsPerPackLabel(packSize?: string | null): number | null {
  if (!packSize?.trim()) return null;
  const m = packSize.match(/(\d+)/);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return n > 0 ? n : null;
}

/** Canonical tablets per full pack for a medicine (minimum 1). */
export function getMedicineTabletsPerPack(m: Pick<Medicine, 'tabletsPerPack' | 'packSize'>): number {
  if (m.tabletsPerPack != null && Number.isFinite(m.tabletsPerPack) && m.tabletsPerPack >= 1) {
    return Math.floor(m.tabletsPerPack);
  }
  const parsed = parseTabletsPerPackLabel(m.packSize);
  return parsed != null && parsed > 0 ? parsed : 1;
}

export function splitPacksAndLoose(totalTablets: number, packSize: number): { packs: number; loose: number } {
  const ps = Math.max(1, Math.floor(packSize));
  const t = Math.max(0, Math.floor(totalTablets));
  if (ps < 2) return { packs: 0, loose: t };
  return { packs: Math.floor(t / ps), loose: t % ps };
}

function pluralUnit(base: string, n: number): string {
  const u = base.trim() || 'tablet';
  if (n === 1) return u;
  const lower = u.toLowerCase();
  if (lower.endsWith('s') || lower.endsWith('x')) return u;
  return `${u}s`;
}

/** Display: "2 Packs + 5 Tablets" (or only one part when the other is zero). */
export function formatPacksPlusTablets(
  totalTablets: number,
  packSize: number,
  singularUnit = 'tablet'
): string {
  const { packs, loose } = splitPacksAndLoose(totalTablets, packSize);
  if (packSize < 2) {
    const t = Math.max(0, Math.floor(totalTablets));
    return `${t} ${pluralUnit(singularUnit, t)}`;
  }
  const parts: string[] = [];
  if (packs > 0) parts.push(`${packs} ${packs === 1 ? 'Pack' : 'Packs'}`);
  if (loose > 0) parts.push(`${loose} ${pluralUnit(singularUnit, loose)}`);
  if (parts.length === 0) return `0 ${pluralUnit(singularUnit, 0)}`;
  return parts.join(' + ');
}

export function packSaleFromTablet(salePricePerTablet: number, tabletsPerPack: number): number {
  const tpp = Math.max(1, Math.floor(tabletsPerPack));
  return Math.round(salePricePerTablet * tpp * 100) / 100;
}

export function tabletSaleFromPack(salePricePerPack: number, tabletsPerPack: number): number {
  const tpp = Math.max(1, Math.floor(tabletsPerPack));
  return Math.round((salePricePerPack / tpp) * 10000) / 10000;
}

/** Landed cost per smallest unit from purchase price per full pack. */
export function tabletPurchaseFromPack(purchasePricePerPack: number, tabletsPerPack: number): number {
  const tpp = Math.max(1, Math.floor(tabletsPerPack));
  return Math.round((purchasePricePerPack / tpp) * 10000) / 10000;
}

export function normalizeMedicineCatalogPrices(m: Medicine): {
  salePricePerTablet: number;
  salePricePerPack: number;
} {
  const tpp = getMedicineTabletsPerPack(m);
  const fromDefault = m.defaultSalePrice != null && Number.isFinite(m.defaultSalePrice);
  const tabletRaw =
    m.salePricePerTablet != null && Number.isFinite(m.salePricePerTablet)
      ? m.salePricePerTablet
      : fromDefault
        ? m.defaultSalePrice!
        : 0.01;
  const salePricePerTablet = Math.max(0.01, Math.round(tabletRaw * 10000) / 10000);
  let salePricePerPack = m.salePricePerPack;
  if (salePricePerPack == null || !Number.isFinite(salePricePerPack)) {
    salePricePerPack = tpp >= 2 ? packSaleFromTablet(salePricePerTablet, tpp) : salePricePerTablet;
  }
  salePricePerPack = Math.max(0.01, Math.round(salePricePerPack * 100) / 100);
  return { salePricePerTablet, salePricePerPack };
}

/** Build consistent batch sale prices from inputs (defaults from medicine). */
export function normalizeBatchSalePrices(
  med: Medicine,
  salePricePerTablet: number,
  salePricePerPack?: number
): Pick<MedicineBatch, 'salePricePerTablet' | 'salePricePerPack'> {
  const tpp = getMedicineTabletsPerPack(med);
  const spt = Math.max(0.01, Math.round(salePricePerTablet * 10000) / 10000);
  const spp =
    salePricePerPack != null && Number.isFinite(salePricePerPack)
      ? Math.max(0.01, Math.round(salePricePerPack * 100) / 100)
      : tpp >= 2
        ? packSaleFromTablet(spt, tpp)
        : spt;
  return { salePricePerTablet: spt, salePricePerPack: spp };
}

export function costPerPackFromTablet(costPricePerTablet: number, tabletsPerPack: number): number {
  const tpp = Math.max(1, Math.floor(tabletsPerPack));
  return Math.round(costPricePerTablet * tpp * 100) / 100;
}

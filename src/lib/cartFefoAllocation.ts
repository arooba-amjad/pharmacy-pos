import type { CartBatchSlice, CartLine, Medicine, MedicineBatch } from '@/types';
import { lineTotalTablets } from '@/lib/posCartQuantity';
import { isExpired, parseLocalDay } from '@/lib/posDates';
import { useSettingsStore } from '@/store/useSettingsStore';

function cloneVirtual(medicines: Medicine[]): Map<string, Map<string, number>> {
  const root = new Map<string, Map<string, number>>();
  for (const m of medicines) {
    const bm = new Map<string, number>();
    for (const b of m.batches) bm.set(b.id, b.totalTablets);
    root.set(m.id, bm);
  }
  return root;
}

function sortBatchesFefo(batches: MedicineBatch[]): MedicineBatch[] {
  return [...batches].sort(
    (a, b) => parseLocalDay(a.expiryDate).getTime() - parseLocalDay(b.expiryDate).getTime()
  );
}

function batchesSellableNonExpired(
  med: Medicine,
  virtual: Map<string, Map<string, number>>,
  allowNeg: boolean
): MedicineBatch[] {
  const bm = virtual.get(med.id);
  if (!bm) return [];
  return med.batches.filter((b) => {
    if (isExpired(b.expiryDate)) return false;
    const have = bm.get(b.id) ?? 0;
    return have > 0 || allowNeg;
  });
}

function orderForAllocation(
  med: Medicine,
  virtual: Map<string, Map<string, number>>,
  preferredBatchId: string | null | undefined,
  allowNeg: boolean
): MedicineBatch[] {
  const sellable = sortBatchesFefo(batchesSellableNonExpired(med, virtual, allowNeg));
  if (!preferredBatchId) return sellable;
  const idx = sellable.findIndex((b) => b.id === preferredBatchId);
  if (idx <= 0) return sellable;
  const p = sellable[idx]!;
  return [p, ...sellable.slice(0, idx), ...sellable.slice(idx + 1)];
}

function takeFromVirtual(
  virtual: Map<string, Map<string, number>>,
  medicineId: string,
  batchId: string,
  need: number,
  allowNeg: boolean
): number {
  const bm = virtual.get(medicineId);
  if (!bm) return 0;
  const have = bm.get(batchId) ?? 0;
  if (allowNeg) {
    bm.set(batchId, have - need);
    return need;
  }
  const take = Math.min(need, Math.max(0, have));
  bm.set(batchId, have - take);
  return take;
}

function sliceMoney(med: Medicine, slices: CartBatchSlice[]) {
  let revenue = 0;
  let cost = 0;
  for (const sl of slices) {
    const b = med.batches.find((x) => x.id === sl.batchId);
    if (b) {
      revenue += sl.tablets * b.salePricePerTablet;
      cost += sl.tablets * b.costPricePerTablet;
    }
  }
  return { revenue, cost };
}

/**
 * Replays cart lines in order and assigns tablets per batch (FEFO), honoring optional `preferredBatchId`
 * as first lot to draw from when still sellable. Does not mutate `medicines`.
 */
export function recomputeCartAllocations(medicines: Medicine[], cart: CartLine[]): CartLine[] {
  const virtual = cloneVirtual(medicines);
  const allowNeg = useSettingsStore.getState().allowNegativeStock;
  const out: CartLine[] = [];

  for (const line of cart) {
    const med = medicines.find((m) => m.id === line.medicineId);
    if (!med) {
      out.push({
        ...line,
        batchSlices: [],
        allocationError: 'Product not found.',
      });
      continue;
    }

    const T = lineTotalTablets(line);
    const ordered = orderForAllocation(med, virtual, line.preferredBatchId ?? null, allowNeg);
    const slices: CartBatchSlice[] = [];
    let remaining = T;

    for (const b of ordered) {
      if (remaining <= 0) break;
      const taken = takeFromVirtual(virtual, med.id, b.id, remaining, allowNeg);
      if (taken > 0) {
        slices.push({
          batchId: b.id,
          batchNo: b.batchNo,
          expiryDate: b.expiryDate,
          tablets: taken,
        });
        remaining -= taken;
      }
    }

    const insufficient = remaining > 0 && !allowNeg;
    const primary = slices[0];
    const { revenue, cost } = sliceMoney(med, slices);
    const qty = line.quantity;
    const derivedUnit =
      qty > 0 ? Math.round((revenue / qty) * 100) / 100 : line.unitPrice;
    const derivedCostPerQty =
      qty > 0 ? Math.round((cost / qty) * 100) / 100 : line.costPrice;

    const pricingMode = line.pricingMode ?? 'fefo';
    const unitPrice = pricingMode === 'custom' ? line.unitPrice : derivedUnit;
    const costPrice = derivedCostPerQty;

    out.push({
      ...line,
      batchSlices: slices,
      batchId: primary?.batchId ?? line.batchId,
      batchNo: primary?.batchNo ?? line.batchNo,
      expiryDate: primary?.expiryDate ?? line.expiryDate,
      unitPrice,
      costPrice,
      allocationError: insufficient ? 'Insufficient stock.' : undefined,
    });
  }

  return out;
}

export function cartLineSubtotal(medicines: Medicine[], line: CartLine): number {
  if (line.pricingMode === 'custom') {
    return Math.round(line.quantity * line.unitPrice * 100) / 100;
  }
  const med = medicines.find((m) => m.id === line.medicineId);
  if (!med || !line.batchSlices?.length) {
    return Math.round(line.quantity * line.unitPrice * 100) / 100;
  }
  let rev = 0;
  for (const sl of line.batchSlices) {
    const b = med.batches.find((x) => x.id === sl.batchId);
    if (b) rev += sl.tablets * b.salePricePerTablet;
  }
  return Math.round(rev * 100) / 100;
}

/** Weighted cost per display unit (per tablet or per pack) from slice COGS. */
export function cartLineWeightedCostPerQty(medicines: Medicine[], line: CartLine): number {
  const med = medicines.find((m) => m.id === line.medicineId);
  if (!med || !line.batchSlices?.length) {
    return line.costPrice;
  }
  let cost = 0;
  for (const sl of line.batchSlices) {
    const b = med.batches.find((x) => x.id === sl.batchId);
    if (b) cost += sl.tablets * b.costPricePerTablet;
  }
  if (line.quantity < 1) return line.costPrice;
  return Math.round((cost / line.quantity) * 100) / 100;
}

export function formatCartBatchBreakdown(line: CartLine): string {
  if (!line.batchSlices?.length) return '—';
  return line.batchSlices.map((s) => `${s.batchNo}: ${s.tablets}`).join(' | ');
}

/**
 * After processing cart lines `[0, beforeIndex)`, returns the batch id that strict FEFO would serve next
 * for `medicineId` (ignores `preferredBatchId` on those prior lines — matches their real allocation).
 */
export function getStrictFefoHeadBatchId(
  medicines: Medicine[],
  cart: CartLine[],
  beforeIndex: number,
  medicineId: string
): string | null {
  const virtual = cloneVirtual(medicines);
  const allowNeg = useSettingsStore.getState().allowNegativeStock;
  for (let i = 0; i < beforeIndex; i++) {
    const line = cart[i]!;
    const med = medicines.find((m) => m.id === line.medicineId);
    if (!med) continue;
    const T = lineTotalTablets(line);
    const ordered = orderForAllocation(med, virtual, line.preferredBatchId ?? null, allowNeg);
    let rem = T;
    for (const b of ordered) {
      if (rem <= 0) break;
      const take = takeFromVirtual(virtual, med.id, b.id, rem, allowNeg);
      rem -= take;
    }
  }
  const med = medicines.find((m) => m.id === medicineId);
  if (!med) return null;
  const next = sortBatchesFefo(batchesSellableNonExpired(med, virtual, allowNeg))[0];
  return next?.id ?? null;
}

export function preferredIsLaterExpiryThanBatch(
  med: Medicine,
  preferredBatchId: string,
  referenceBatchId: string
): boolean {
  const a = med.batches.find((b) => b.id === preferredBatchId);
  const b = med.batches.find((x) => x.id === referenceBatchId);
  if (!a || !b) return false;
  return parseLocalDay(a.expiryDate).getTime() > parseLocalDay(b.expiryDate).getTime();
}

/** Margin % using weighted COGS from slices vs display unit price. */
export function cartLineMarginPercent(medicines: Medicine[], line: CartLine): number {
  const costU = cartLineWeightedCostPerQty(medicines, line);
  if (costU <= 0) return 0;
  return Math.round(((line.unitPrice - costU) / costU) * 1000) / 10;
}

export function cartLineHasCustomPrice(line: CartLine): boolean {
  return line.pricingMode === 'custom';
}

import {
  eachDayOfInterval,
  eachWeekOfInterval,
  endOfDay,
  format,
  parseISO,
  startOfDay,
  startOfWeek,
  subDays,
} from 'date-fns';
import { isExpired, isExpiringSoon, startOfToday } from '@/lib/posDates';
import { lineTotalTablets } from '@/lib/posCartQuantity';
import type { CartBatchSlice, CartLine, Medicine, Sale } from '@/types';

export function inRange(ts: string, rangeStart: Date, rangeEnd: Date): boolean {
  const t = parseISO(ts);
  return t >= rangeStart && t <= rangeEnd;
}

/** Revenue and COGS for one slice (uses frozen batch $/tablet when present). */
export function sliceRevenueAndCogs(it: CartLine, sl: CartBatchSlice): { rev: number; cogs: number } {
  if (sl.salePricePerTablet != null && sl.costPricePerTablet != null) {
    return {
      rev: Math.round(sl.tablets * sl.salePricePerTablet * 100) / 100,
      cogs: Math.round(sl.tablets * sl.costPricePerTablet * 100) / 100,
    };
  }
  const T = lineTotalTablets(it);
  const share = T > 0 ? sl.tablets / T : 0;
  return {
    rev: Math.round(saleLineTabletRevenue(it) * share * 100) / 100,
    cogs: Math.round(saleLineTabletCogs(it) * share * 100) / 100,
  };
}

/** Tablet-level revenue for the line (sum of slice economics). */
export function saleLineTabletRevenue(it: CartLine): number {
  const slices = it.batchSlices ?? [];
  if (!slices.length) return Math.round(it.quantity * it.unitPrice * 100) / 100;
  let r = 0;
  const T = lineTotalTablets(it);
  const fallback = T > 0 ? (it.quantity * it.unitPrice) / T : it.unitPrice;
  for (const sl of slices) {
    r += sl.tablets * (sl.salePricePerTablet ?? fallback);
  }
  return Math.round(r * 100) / 100;
}

/** Tablet-level COGS using batch cost snapshots when saved on the sale. */
export function saleLineTabletCogs(it: CartLine): number {
  const slices = it.batchSlices ?? [];
  if (!slices.length) return Math.round(it.quantity * it.costPrice * 100) / 100;
  let c = 0;
  const T = lineTotalTablets(it);
  const fallback = T > 0 ? (it.quantity * it.costPrice) / T : it.costPrice;
  for (const sl of slices) {
    c += sl.tablets * (sl.costPricePerTablet ?? fallback);
  }
  return Math.round(c * 100) / 100;
}

export function saleLineGrossProfitTablets(it: CartLine): number {
  return Math.round((saleLineTabletRevenue(it) - saleLineTabletCogs(it)) * 100) / 100;
}

/** @deprecated Use saleLineTabletRevenue — alias */
export function saleLineRevenue(it: CartLine): number {
  return saleLineTabletRevenue(it);
}

/** @deprecated Use saleLineTabletCogs — alias */
export function saleLineCogs(it: CartLine): number {
  return saleLineTabletCogs(it);
}

/** Sum of line gross profit before invoice-level discount allocation. */
export function saleGrossMargin(s: Sale): number {
  return Math.round(s.items.reduce((a, it) => a + saleLineGrossProfitTablets(it), 0) * 100) / 100;
}

/**
 * Apply the same share of invoice discount to margin dollars as subtotal bears.
 * Uses batch-level COGS when slice snapshots exist.
 */
export function saleEstimatedProfit(s: Sale): number {
  const gm = saleGrossMargin(s);
  if (s.subtotal <= 0) return Math.round(gm * 100) / 100;
  const r = Math.min(1, Math.max(0, s.discountApplied / s.subtotal));
  return Math.round(gm * (1 - r) * 100) / 100;
}

export function saleTotalCogs(s: Sale): number {
  return Math.round(s.items.reduce((a, it) => a + saleLineTabletCogs(it), 0) * 100) / 100;
}

export function saleTotalLineRevenue(s: Sale): number {
  return Math.round(s.items.reduce((a, it) => a + saleLineTabletRevenue(it), 0) * 100) / 100;
}

export type ReportPaymentFilter = 'all' | 'cash' | 'card' | 'credit';

export interface ReportFilters {
  start: Date;
  end: Date;
  payment: ReportPaymentFilter;
  category: string | 'all';
  medicineId: string | 'all';
}

export function filterSales(sales: Sale[], medicines: Medicine[], f: ReportFilters): Sale[] {
  return sales.filter((s) => {
    if (!inRange(s.timestamp, f.start, f.end)) return false;
    if (f.payment !== 'all' && s.paymentMethod !== f.payment) return false;
    if (f.category !== 'all') {
      const hit = s.items.some((it) => medicines.find((m) => m.id === it.medicineId)?.category === f.category);
      if (!hit) return false;
    }
    if (f.medicineId !== 'all') {
      if (!s.items.some((it) => it.medicineId === f.medicineId)) return false;
    }
    return true;
  });
}

export interface MedicineAgg {
  medicineId: string;
  name: string;
  /** Sell units (packs or loose lines), not tablet count. */
  qty: number;
  tabletsSold: number;
  revenue: number;
  profit: number;
}

export function aggregateMedicinesFromSales(sales: Sale[]): MedicineAgg[] {
  const map = new Map<string, MedicineAgg>();
  for (const s of sales) {
    for (const it of s.items) {
      const prev = map.get(it.medicineId) ?? {
        medicineId: it.medicineId,
        name: it.name,
        qty: 0,
        tabletsSold: 0,
        revenue: 0,
        profit: 0,
      };
      prev.qty += it.quantity;
      prev.tabletsSold += lineTotalTablets(it);
      prev.revenue += saleLineTabletRevenue(it);
      prev.profit += saleLineGrossProfitTablets(it);
      map.set(it.medicineId, prev);
    }
  }
  return [...map.values()].map((r) => ({
    ...r,
    revenue: Math.round(r.revenue * 100) / 100,
    profit: Math.round(r.profit * 100) / 100,
  }));
}

export function dailySeries(
  sales: Sale[],
  windowStart: Date,
  windowEndDay: Date,
  pick: (s: Sale) => number
): { name: string; v: number }[] {
  const start = startOfDay(windowStart);
  const end = startOfDay(windowEndDay);
  const days = eachDayOfInterval({ start, end });
  const byDay = new Map<string, number>();
  for (const s of sales) {
    if (!inRange(s.timestamp, start, endOfDay(end))) continue;
    const key = format(parseISO(s.timestamp), 'yyyy-MM-dd');
    byDay.set(key, (byDay.get(key) ?? 0) + pick(s));
  }
  return days.map((d) => {
    const key = format(d, 'yyyy-MM-dd');
    return { name: format(d, 'MMM d'), v: Math.round((byDay.get(key) ?? 0) * 100) / 100 };
  });
}

export function weeklySeries(
  sales: Sale[],
  windowStart: Date,
  windowEndDay: Date,
  pick: (s: Sale) => number
): { name: string; v: number }[] {
  const start = startOfWeek(startOfDay(windowStart), { weekStartsOn: 1 });
  const end = startOfWeek(startOfDay(windowEndDay), { weekStartsOn: 1 });
  const weeks = eachWeekOfInterval({ start, end }, { weekStartsOn: 1 });
  const byWeek = new Map<string, number>();
  for (const s of sales) {
    if (!inRange(s.timestamp, startOfDay(windowStart), endOfDay(windowEndDay))) continue;
    const ws = startOfWeek(parseISO(s.timestamp), { weekStartsOn: 1 });
    const key = format(ws, 'yyyy-MM-dd');
    byWeek.set(key, (byWeek.get(key) ?? 0) + pick(s));
  }
  return weeks.map((d) => {
    const key = format(d, 'yyyy-MM-dd');
    return { name: `Week of ${format(d, 'MMM d')}`, v: Math.round((byWeek.get(key) ?? 0) * 100) / 100 };
  });
}

export function clampChartRange(rangeStart: Date, rangeEnd: Date, maxDays = 90): { chartStart: Date; chartEnd: Date } {
  const rs = startOfDay(rangeStart);
  const re = startOfDay(rangeEnd);
  const span = Math.ceil((re.getTime() - rs.getTime()) / 86400000) + 1;
  if (span <= maxDays) return { chartStart: rs, chartEnd: re };
  return { chartStart: startOfDay(subDays(re, maxDays - 1)), chartEnd: re };
}

export function todayWindow(): { start: Date; end: Date } {
  const start = startOfToday();
  const end = endOfDay(new Date());
  return { start, end };
}

export function medicineStockTotal(m: Medicine): number {
  return m.batches.reduce((a, b) => a + b.totalTablets, 0);
}

export interface ExpiringRow {
  medicineName: string;
  batchNo: string;
  expiryDate: string;
  stock: number;
}

export function listExpiringBatches(medicines: Medicine[], days = 75, limit = 8): ExpiringRow[] {
  const rows: ExpiringRow[] = [];
  for (const m of medicines) {
    for (const b of m.batches) {
      if (b.totalTablets <= 0 || isExpired(b.expiryDate)) continue;
      if (!isExpiringSoon(b.expiryDate, days)) continue;
      rows.push({ medicineName: m.name, batchNo: b.batchNo, expiryDate: b.expiryDate, stock: b.totalTablets });
    }
  }
  rows.sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));
  return rows.slice(0, limit);
}

/** Stock on hand but no sales lines in the last N calendar days. */
export function deadStockMedicines(medicines: Medicine[], allSales: Sale[], lookbackDays: number): Medicine[] {
  const since = startOfDay(subDays(new Date(), lookbackDays));
  const end = endOfDay(new Date());
  const soldRecently = new Set<string>();
  for (const s of allSales) {
    if (!inRange(s.timestamp, since, end)) continue;
    for (const it of s.items) soldRecently.add(it.medicineId);
  }
  return medicines.filter((m) => medicineStockTotal(m) > 0 && !soldRecently.has(m.id));
}

import { endOfDay, parse, parseISO, startOfDay, subDays } from 'date-fns';
import { sliceRevenueAndCogs } from '@/lib/reportsAnalytics';
import type { Medicine, Purchase, Sale } from '@/types';
import { isExpired, isExpiringSoon } from '@/lib/posDates';
import { formatCurrency } from '@/lib/utils';

export interface BatchProfitRow {
  medicineId: string;
  medicineName: string;
  batchId: string;
  batchNo: string;
  expiryDate: string;
  qtyPurchased: number;
  qtySold: number;
  remaining: number;
  totalRevenue: number;
  totalCogs: number;
  grossProfit: number;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function sumPurchasesForBatch(
  purchases: Purchase[],
  medicineId: string,
  batchNo: string,
  start: Date,
  end: Date
): number {
  const bn = batchNo.trim().toLowerCase();
  const startDay = startOfDay(start);
  const endDay = endOfDay(end);
  let qty = 0;
  for (const p of purchases) {
    if (p.status !== 'completed') continue;
    const purchaseDay = startOfDay(parse(p.purchaseDate, 'yyyy-MM-dd', new Date()));
    if (purchaseDay < startDay || purchaseDay > endDay) continue;
    for (const ln of p.lines) {
      if (ln.medicineId !== medicineId) continue;
      if (ln.batchNo.trim().toLowerCase() !== bn) continue;
      qty += ln.quantity;
    }
  }
  return qty;
}

function aggregateSalesForBatch(sales: Sale[], medicineId: string, batchId: string) {
  let qtySold = 0;
  let revenue = 0;
  let cogs = 0;
  for (const s of sales) {
    for (const it of s.items) {
      if (it.medicineId !== medicineId) continue;
      for (const sl of it.batchSlices ?? []) {
        if (sl.batchId !== batchId) continue;
        const { rev, cogs: cg } = sliceRevenueAndCogs(it, sl);
        qtySold += sl.tablets;
        revenue += rev;
        cogs += cg;
      }
    }
  }
  return { qtySold, revenue: round2(revenue), cogs: round2(cogs) };
}

/** Per-batch performance in the filtered window (sold) + optional purchased in same window + current remaining. */
export function buildBatchProfitTable(
  salesFiltered: Sale[],
  medicines: Medicine[],
  purchases: Purchase[],
  rangeStart: Date,
  rangeEnd: Date
): BatchProfitRow[] {
  const rows: BatchProfitRow[] = [];
  for (const m of medicines) {
    for (const b of m.batches) {
      const { qtySold, revenue, cogs } = aggregateSalesForBatch(salesFiltered, m.id, b.id);
      const qtyPurchased = sumPurchasesForBatch(purchases, m.id, b.batchNo, rangeStart, rangeEnd);
      if (qtySold === 0 && qtyPurchased === 0 && b.totalTablets <= 0) continue;
      const grossProfit = round2(revenue - cogs);
      rows.push({
        medicineId: m.id,
        medicineName: m.name,
        batchId: b.id,
        batchNo: b.batchNo,
        expiryDate: b.expiryDate,
        qtyPurchased,
        qtySold,
        remaining: b.totalTablets,
        totalRevenue: revenue,
        totalCogs: cogs,
        grossProfit,
      });
    }
  }
  return rows.sort((a, b) => b.grossProfit - a.grossProfit);
}

export interface ExpiryLossRow {
  medicineId: string;
  medicineName: string;
  batchId: string;
  batchNo: string;
  expiryDate: string;
  expiredQty: number;
  lossAmount: number;
}

/** Expired lots still on hand: loss = tablets × batch cost (purchase / landed cost). */
export function expiryLossOnHand(medicines: Medicine[]): ExpiryLossRow[] {
  const rows: ExpiryLossRow[] = [];
  for (const m of medicines) {
    for (const b of m.batches) {
      if (!isExpired(b.expiryDate) || b.totalTablets <= 0) continue;
      const lossAmount = round2(b.totalTablets * b.costPricePerTablet);
      rows.push({
        medicineId: m.id,
        medicineName: m.name,
        batchId: b.id,
        batchNo: b.batchNo,
        expiryDate: b.expiryDate,
        expiredQty: b.totalTablets,
        lossAmount,
      });
    }
  }
  return rows.sort((a, b) => b.lossAmount - a.lossAmount);
}

export function aggregateExpiryLossByMedicine(rows: ExpiryLossRow[]): { medicineId: string; name: string; loss: number }[] {
  const map = new Map<string, { medicineId: string; name: string; loss: number }>();
  for (const r of rows) {
    const prev = map.get(r.medicineId) ?? { medicineId: r.medicineId, name: r.medicineName, loss: 0 };
    prev.loss += r.lossAmount;
    map.set(r.medicineId, prev);
  }
  return [...map.values()]
    .map((x) => ({ ...x, loss: round2(x.loss) }))
    .sort((a, b) => b.loss - a.loss);
}

export interface ReportInsight {
  label: string;
  detail: string;
  tone: 'ok' | 'warn' | 'bad';
}

export function buildReportInsights(params: {
  medAgg: { name: string; profit: number; revenue: number; tabletsSold: number }[];
  expiryByMed: { name: string; loss: number }[];
}): ReportInsight[] {
  const out: ReportInsight[] = [];
  const top = [...params.medAgg].sort((a, b) => b.profit - a.profit)[0];
  if (top && top.profit > 0) {
    out.push({
      label: 'Top earning product',
      detail: `${top.name} · ${formatCurrency(top.profit)} gross profit`,
      tone: 'ok',
    });
  }
  const movers = params.medAgg.filter((m) => m.tabletsSold > 0 && m.revenue > 0);
  const worst = [...movers].sort((a, b) => a.profit - b.profit)[0];
  if (worst && worst.profit < 0) {
    out.push({
      label: 'Low profit medicine',
      detail: `${worst.name} is underwater on batch COGS in this period`,
      tone: 'bad',
    });
  } else if (worst && worst.profit >= 0) {
    const pct = (worst.profit / worst.revenue) * 100;
    if (pct < 12) {
      out.push({
        label: 'Thin margin watch',
        detail: `${worst.name} has the weakest margin among movers (~${Math.round(pct * 10) / 10}%)`,
        tone: 'warn',
      });
    }
  }
  const exp = params.expiryByMed[0];
  if (exp && exp.loss > 0) {
    out.push({
      label: 'Expiry capital at risk',
      detail: `${exp.name} · ${formatCurrency(exp.loss)} tied up in expired stock`,
      tone: 'bad',
    });
  }
  return out;
}

export function batchesNearExpiryUnsold(
  medicines: Medicine[],
  sales: Sale[],
  expiringWithinDays: number,
  salesLookbackDays: number
): { medicineId: string; medicineName: string; batchNo: string; expiryDate: string; stock: string }[] {
  const since = startOfDay(subDays(new Date(), salesLookbackDays));
  const end = endOfDay(new Date());
  const soldBatches = new Set<string>();
  for (const s of sales) {
    const t = parseISO(s.timestamp);
    if (t < since || t > end) continue;
    for (const it of s.items) {
      for (const sl of it.batchSlices ?? []) {
        soldBatches.add(`${it.medicineId}::${sl.batchId}`);
      }
    }
  }
  const rows: { medicineId: string; medicineName: string; batchNo: string; expiryDate: string; stock: string }[] =
    [];
  for (const m of medicines) {
    for (const b of m.batches) {
      if (b.totalTablets <= 0 || isExpired(b.expiryDate)) continue;
      if (!isExpiringSoon(b.expiryDate, expiringWithinDays)) continue;
      const key = `${m.id}::${b.id}`;
      if (soldBatches.has(key)) continue;
      rows.push({
        medicineId: m.id,
        medicineName: m.name,
        batchNo: b.batchNo,
        expiryDate: b.expiryDate,
        stock: String(b.totalTablets),
      });
    }
  }
  rows.sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));
  return rows.slice(0, 25);
}

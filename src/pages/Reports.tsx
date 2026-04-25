import React, { useMemo, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  endOfMonth,
  endOfDay,
  format,
  parse,
  startOfDay,
  startOfMonth,
  subDays,
} from 'date-fns';
import {
  Users,
  Package,
  Pill,
  Wallet,
  BarChart3,
  Layers,
  Skull,
  AlertTriangle,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { usePOSBillingStore } from '@/store/usePOSBillingStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useAppStore } from '@/store/useAppStore';
import { getMedicineAvailability } from '@/lib/posSearchHelpers';
import { isExpired, isExpiringSoon } from '@/lib/posDates';
import {
  aggregateMedicinesFromSales,
  clampChartRange,
  dailySeries,
  deadStockMedicines,
  filterSales,
  inRange,
  medicineStockTotal,
  saleEstimatedProfit,
  saleGrossMargin,
  saleTotalCogs,
  saleTotalLineRevenue,
  weeklySeries,
  type ReportFilters,
} from '@/lib/reportsAnalytics';
import {
  aggregateExpiryLossByMedicine,
  buildBatchProfitTable,
  buildReportInsights,
  batchesNearExpiryUnsold,
  expiryLossOnHand,
} from '@/lib/profitReports';
import { formatCurrency, formatCurrencyChartTick, cn } from '@/lib/utils';
import { displayManufacturer } from '@/lib/medicineDisplay';
import { SubstitutionIntelligenceSection } from '@/components/reports/SubstitutionIntelligenceSection';

type TabId = 'sales' | 'profit' | 'products' | 'batches' | 'expiry' | 'dead' | 'inventory' | 'customers' | 'substitution';

const TABS: { id: TabId; label: string }[] = [
  { id: 'sales', label: 'Sales' },
  { id: 'profit', label: 'Profit' },
  { id: 'products', label: 'Product P&L' },
  { id: 'batches', label: 'Batches' },
  { id: 'expiry', label: 'Expiry loss' },
  { id: 'dead', label: 'Dead stock' },
  { id: 'inventory', label: 'Inventory' },
  { id: 'customers', label: 'Customers' },
  { id: 'substitution', label: 'Substitutions' },
];

function useReportRange() {
  const [preset, setPreset] = useState<'7d' | '30d' | '90d' | 'month'>('30d');
  const [fromStr, setFromStr] = useState(() => format(subDays(new Date(), 29), 'yyyy-MM-dd'));
  const [toStr, setToStr] = useState(() => format(new Date(), 'yyyy-MM-dd'));

  const applyPreset = (p: typeof preset) => {
    setPreset(p);
    const end = new Date();
    if (p === '7d') {
      setFromStr(format(subDays(end, 6), 'yyyy-MM-dd'));
      setToStr(format(end, 'yyyy-MM-dd'));
    } else if (p === '30d') {
      setFromStr(format(subDays(end, 29), 'yyyy-MM-dd'));
      setToStr(format(end, 'yyyy-MM-dd'));
    } else if (p === '90d') {
      setFromStr(format(subDays(end, 89), 'yyyy-MM-dd'));
      setToStr(format(end, 'yyyy-MM-dd'));
    } else {
      const sm = startOfMonth(end);
      setFromStr(format(sm, 'yyyy-MM-dd'));
      setToStr(format(endOfMonth(end), 'yyyy-MM-dd'));
    }
  };

  const range = useMemo(() => {
    const start = startOfDay(parse(fromStr, 'yyyy-MM-dd', new Date()));
    const end = endOfDay(parse(toStr, 'yyyy-MM-dd', new Date()));
    return start <= end ? { start, end } : { start: end, end: start };
  }, [fromStr, toStr]);

  return { preset, setPreset: applyPreset, fromStr, setFromStr, toStr, setToStr, range };
}

export const Reports: React.FC = () => {
  const isDarkMode = useAppStore((s) => s.isDarkMode);
  const sales = usePOSBillingStore((s) => s.sales);
  const medicines = usePOSBillingStore((s) => s.medicines);
  const medicineById = useMemo(() => new Map(medicines.map((m) => [m.id, m])), [medicines]);
  const medicineCategories = usePOSBillingStore((s) => s.medicineCategories);
  const customers = usePOSBillingStore((s) => s.customers);
  const purchases = usePOSBillingStore((s) => s.purchases);
  const returnRecords = usePOSBillingStore((s) => s.returns);
  const expiryAlertDays = useSettingsStore((s) => s.expiryAlertDays);

  const [tab, setTab] = useState<TabId>('sales');
  const { preset, setPreset, fromStr, setFromStr, toStr, setToStr, range } = useReportRange();
  const [payment, setPayment] = useState<ReportFilters['payment']>('all');
  const [category, setCategory] = useState<string | 'all'>('all');
  const [medicineId, setMedicineId] = useState<string | 'all'>('all');
  const [deadLookback, setDeadLookback] = useState(90);
  const [profitChartMode, setProfitChartMode] = useState<'day' | 'week'>('day');

  const filters: ReportFilters = useMemo(
    () => ({
      start: range.start,
      end: range.end,
      payment,
      category,
      medicineId,
    }),
    [range.start, range.end, payment, category, medicineId]
  );

  const filteredSales = useMemo(() => filterSales(sales, medicines, filters), [sales, medicines, filters]);

  const totalRevenue = useMemo(
    () => Math.round(filteredSales.reduce((a, s) => a + s.total, 0) * 100) / 100,
    [filteredSales]
  );
  const lineRevenue = useMemo(
    () => Math.round(filteredSales.reduce((a, s) => a + saleTotalLineRevenue(s), 0) * 100) / 100,
    [filteredSales]
  );
  const totalCogs = useMemo(
    () => Math.round(filteredSales.reduce((a, s) => a + saleTotalCogs(s), 0) * 100) / 100,
    [filteredSales]
  );
  const grossProfitBatch = useMemo(
    () => Math.round(filteredSales.reduce((a, s) => a + saleGrossMargin(s), 0) * 100) / 100,
    [filteredSales]
  );
  const totalProfitAfterDisc = useMemo(
    () => Math.round(filteredSales.reduce((a, s) => a + saleEstimatedProfit(s), 0) * 100) / 100,
    [filteredSales]
  );
  const marginPctGross = lineRevenue > 0 ? Math.round((grossProfitBatch / lineRevenue) * 1000) / 10 : 0;
  const marginPctNet = lineRevenue > 0 ? Math.round((totalProfitAfterDisc / lineRevenue) * 1000) / 10 : 0;

  const medAgg = useMemo(() => aggregateMedicinesFromSales(filteredSales), [filteredSales]);

  const { chartStart, chartEnd } = useMemo(
    () => clampChartRange(range.start, range.end, 90),
    [range.start, range.end]
  );

  const salesTrend = useMemo(
    () => dailySeries(filteredSales, chartStart, chartEnd, (s) => s.total),
    [filteredSales, chartStart, chartEnd]
  );

  const topByRevenue = useMemo(() => [...medAgg].sort((a, b) => b.revenue - a.revenue).slice(0, 12), [medAgg]);
  const topByProfit = useMemo(() => [...medAgg].sort((a, b) => b.profit - a.profit).slice(0, 12), [medAgg]);
  const leastByProfit = useMemo(
    () => [...medAgg].filter((m) => m.tabletsSold > 0).sort((a, b) => a.profit - b.profit).slice(0, 8),
    [medAgg]
  );
  const topByProfitPerTablet = useMemo(() => {
    const scored = medAgg
      .filter((m) => m.tabletsSold > 0)
      .map((m) => ({
        ...m,
        ppt: Math.round((m.profit / m.tabletsSold) * 10000) / 10000,
      }))
      .sort((a, b) => b.ppt - a.ppt);
    return scored.slice(0, 12);
  }, [medAgg]);

  const batchRows = useMemo(
    () => buildBatchProfitTable(filteredSales, medicines, purchases, range.start, range.end),
    [filteredSales, medicines, purchases, range.start, range.end]
  );

  const expiryRows = useMemo(() => expiryLossOnHand(medicines), [medicines]);
  const expiryLossTotal = useMemo(
    () => Math.round(expiryRows.reduce((a, r) => a + r.lossAmount, 0) * 100) / 100,
    [expiryRows]
  );
  const expiryByMedicine = useMemo(() => aggregateExpiryLossByMedicine(expiryRows), [expiryRows]);

  const insights = useMemo(
    () =>
      buildReportInsights({
        medAgg,
        expiryByMed: expiryByMedicine,
      }),
    [medAgg, expiryByMedicine]
  );

  const deadMeds = useMemo(() => deadStockMedicines(medicines, sales, deadLookback), [medicines, sales, deadLookback]);
  const nearExpiryUnsold = useMemo(
    () => batchesNearExpiryUnsold(medicines, sales, Math.max(7, expiryAlertDays), Math.min(deadLookback, 90)),
    [medicines, sales, expiryAlertDays, deadLookback]
  );

  const profitTrendDaily = useMemo(
    () => dailySeries(filteredSales, chartStart, chartEnd, (s) => saleGrossMargin(s)),
    [filteredSales, chartStart, chartEnd]
  );
  const profitTrendWeekly = useMemo(
    () => weeklySeries(filteredSales, chartStart, chartEnd, (s) => saleGrossMargin(s)),
    [filteredSales, chartStart, chartEnd]
  );
  const profitTrend = profitChartMode === 'week' ? profitTrendWeekly : profitTrendDaily;
  const returnsInRange = useMemo(
    () => returnRecords.filter((r) => inRange(r.timestamp, range.start, range.end)),
    [returnRecords, range.end, range.start]
  );
  const returnsValueInRange = useMemo(
    () => Math.round(returnsInRange.reduce((a, r) => a + r.total, 0) * 100) / 100,
    [returnsInRange]
  );

  const inventoryRows = useMemo(() => {
    const low: { medicine: (typeof medicines)[number]; qty: string }[] = [];
    const out: { medicine: (typeof medicines)[number] }[] = [];
    const exp: { medicine: (typeof medicines)[number]; batch: string; exp: string; stock: number }[] = [];
    const expDays = Math.max(1, expiryAlertDays ?? 75);
    for (const m of medicines) {
      const av = getMedicineAvailability(m);
      if (av.status === 'out') out.push({ medicine: m });
      else if (av.status === 'low') low.push({ medicine: m, qty: String(av.sellableQty) });
      for (const b of m.batches) {
        if (b.totalTablets <= 0) continue;
        if (isExpired(b.expiryDate)) continue;
        if (isExpiringSoon(b.expiryDate, expDays))
          exp.push({ medicine: m, batch: b.batchNo, exp: b.expiryDate, stock: b.totalTablets });
      }
    }
    exp.sort((a, b) => a.exp.localeCompare(b.exp));
    return { low, out, expiring: exp.slice(0, 20) };
  }, [medicines, expiryAlertDays]);

  const dead = useMemo(() => deadStockMedicines(medicines, sales, 90).slice(0, 15), [medicines, sales]);

  const customerStats = useMemo(() => {
    const spend = new Map<string, { name: string; orders: number; total: number }>();
    for (const s of filteredSales) {
      if (!s.customer?.id) continue;
      const prev = spend.get(s.customer.id) ?? { name: s.customer.name, orders: 0, total: 0 };
      prev.orders += 1;
      prev.total += s.total;
      spend.set(s.customer.id, prev);
    }
    const top = [...spend.values()].sort((a, b) => b.total - a.total).slice(0, 12);
    const withCredit = customers
      .filter((c) => c.balance > 0)
      .sort((a, b) => b.balance - a.balance)
      .slice(0, 12);
    const frequent = [...spend.values()].sort((a, b) => b.orders - a.orders).slice(0, 8);
    return { top, withCredit, frequent };
  }, [filteredSales, customers]);

  const gridStroke = isDarkMode ? 'rgba(248,250,252,0.08)' : '#e2e8f0';
  const tip = isDarkMode
    ? { backgroundColor: '#1e293b', border: 'none', borderRadius: 12 }
    : { backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: 12 };
  const tipItem = isDarkMode
    ? { color: '#f8fafc', fontWeight: 700 as const }
    : { color: '#0f172a', fontWeight: 700 as const };

  return (
    <div className="custom-scrollbar flex h-full min-h-0 flex-col gap-5 overflow-y-auto p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-black tracking-tight">
            <BarChart3 className="h-8 w-8 text-primary" strokeWidth={2} />
            Reports
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Decision-focused analytics: profit, movers, inventory risk, and customers. Use filters to narrow the window.
          </p>
        </div>

        <div className="flex w-full max-w-4xl flex-col gap-3 rounded-2xl border border-border/70 bg-card/80 p-4 shadow-sm dark:border-border/50 dark:bg-card/40">
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                { k: '7d' as const, l: '7d' },
                { k: '30d' as const, l: '30d' },
                { k: '90d' as const, l: '90d' },
                { k: 'month' as const, l: 'Month' },
              ] as const
            ).map((x) => (
              <button
                key={x.k}
                type="button"
                onClick={() => setPreset(x.k)}
                className={cn(
                  'rounded-lg px-2.5 py-1 text-xs font-semibold',
                  preset === x.k ? 'bg-primary text-primary-foreground' : 'bg-muted/60 text-muted-foreground hover:bg-muted'
                )}
              >
                {x.l}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-[10px] font-bold uppercase text-muted-foreground">
              From
              <input
                type="date"
                value={fromStr}
                onChange={(e) => setFromStr(e.target.value)}
                className="mt-1 block rounded-lg border border-border bg-background px-2 py-1.5 text-sm dark:bg-zinc-900"
              />
            </label>
            <label className="text-[10px] font-bold uppercase text-muted-foreground">
              To
              <input
                type="date"
                value={toStr}
                onChange={(e) => setToStr(e.target.value)}
                className="mt-1 block rounded-lg border border-border bg-background px-2 py-1.5 text-sm dark:bg-zinc-900"
              />
            </label>
            <label className="text-[10px] font-bold uppercase text-muted-foreground">
              Payment
              <select
                value={payment}
                onChange={(e) => setPayment(e.target.value as ReportFilters['payment'])}
                className="mt-1 block rounded-lg border border-border bg-background px-2 py-1.5 text-sm dark:bg-zinc-900"
              >
                <option value="all">All</option>
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="credit">Credit</option>
              </select>
            </label>
            <label className="text-[10px] font-bold uppercase text-muted-foreground">
              Category
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as typeof category)}
                className="mt-1 block max-w-[160px] rounded-lg border border-border bg-background px-2 py-1.5 text-sm dark:bg-zinc-900"
              >
                <option value="all">All</option>
                {medicineCategories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-[10px] font-bold uppercase text-muted-foreground">
              Product
              <select
                value={medicineId}
                onChange={(e) => setMedicineId(e.target.value as typeof medicineId)}
                className="mt-1 block max-w-[220px] rounded-lg border border-border bg-background px-2 py-1.5 text-sm dark:bg-zinc-900"
              >
                <option value="all">All products</option>
                {[...medicines]
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} — Mfr. {displayManufacturer(m)}
                    </option>
                  ))}
              </select>
            </label>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-1 rounded-xl border border-border/60 bg-muted/25 p-1 dark:bg-muted/15">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              'rounded-lg px-4 py-2 text-sm font-semibold transition-colors',
              tab === t.id ? 'bg-card text-foreground shadow-sm dark:bg-zinc-800' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'sales' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm dark:bg-card/40">
              <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Total revenue</p>
              <p className="mt-2 text-3xl font-black tabular-nums">{formatCurrency(totalRevenue)}</p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm dark:bg-card/40">
              <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Number of sales</p>
              <p className="mt-2 text-3xl font-black tabular-nums">{filteredSales.length}</p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm dark:bg-card/40">
              <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Average order value</p>
              <p className="mt-2 text-3xl font-black tabular-nums">
                {filteredSales.length ? formatCurrency(totalRevenue / filteredSales.length) : '—'}
              </p>
            </div>
          </div>
          <div className="min-h-[300px] rounded-2xl border border-border/70 bg-card p-5 shadow-sm dark:bg-card/40">
            <h3 className="mb-4 text-base font-bold">Sales over time</h3>
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={salesTrend} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="repSalesFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0d9488" stopOpacity={isDarkMode ? 0.35 : 0.22} />
                      <stop offset="95%" stopColor="#0d9488" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridStroke} />
                  <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => formatCurrencyChartTick(Number(v))} />
                  <Tooltip contentStyle={tip} itemStyle={tipItem} formatter={(v) => [formatCurrency(Number(v ?? 0)), 'Revenue']} />
                  <Area type="monotone" dataKey="v" stroke="#0d9488" strokeWidth={2} fill="url(#repSalesFill)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {tab === 'profit' && (
        <div className="space-y-5">
          {insights.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {insights.map((ins, i) => (
                <div
                  key={i}
                  className={cn(
                    'inline-flex max-w-md items-start gap-2 rounded-xl border px-3 py-2 text-xs font-semibold',
                    ins.tone === 'ok' && 'border-emerald-500/30 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100',
                    ins.tone === 'warn' && 'border-amber-500/35 bg-amber-500/10 text-amber-950 dark:text-amber-100',
                    ins.tone === 'bad' && 'border-red-500/35 bg-red-500/10 text-red-900 dark:text-red-100'
                  )}
                >
                  <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-80" />
                  <span>
                    <span className="font-black">{ins.label}:</span> {ins.detail}
                  </span>
                </div>
              ))}
            </div>
          ) : null}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm dark:bg-card/40">
              <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Total revenue</p>
              <p className="mt-2 text-3xl font-black tabular-nums">{formatCurrency(lineRevenue)}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">Sum of line sell value (batch-priced).</p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm dark:bg-card/40">
              <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Total cost (COGS)</p>
              <p className="mt-2 text-3xl font-black tabular-nums">{formatCurrency(totalCogs)}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">Actual batch cost per tablet sold.</p>
            </div>
            <div className="rounded-2xl border-2 border-primary/25 bg-gradient-to-br from-primary/10 to-transparent p-5 shadow-sm dark:border-primary/30 dark:from-primary/15">
              <p className="text-[11px] font-bold uppercase tracking-wide text-primary">Gross profit</p>
              <p className="mt-2 text-3xl font-black tabular-nums">{formatCurrency(grossProfitBatch)}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">Revenue − batch COGS (pre-invoice discount).</p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm dark:bg-card/40">
              <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Margin &amp; net est.</p>
              <p className="mt-2 text-3xl font-black tabular-nums">{marginPctGross}%</p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Net after disc. heuristic {formatCurrency(totalProfitAfterDisc)} · {marginPctNet}% of revenue
              </p>
            </div>
          </div>
          <div className="min-h-[300px] rounded-2xl border border-border/70 bg-card p-5 shadow-sm dark:bg-card/40">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-base font-bold">Gross profit over time</h3>
              <div className="flex gap-1 rounded-lg border border-border/60 bg-muted/30 p-0.5 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setProfitChartMode('day')}
                  className={cn(
                    'rounded-md px-2.5 py-1',
                    profitChartMode === 'day' ? 'bg-card shadow-sm' : 'text-muted-foreground'
                  )}
                >
                  Daily
                </button>
                <button
                  type="button"
                  onClick={() => setProfitChartMode('week')}
                  className={cn(
                    'rounded-md px-2.5 py-1',
                    profitChartMode === 'week' ? 'bg-card shadow-sm' : 'text-muted-foreground'
                  )}
                >
                  Weekly
                </button>
              </div>
            </div>
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={profitTrend} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridStroke} />
                  <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => formatCurrencyChartTick(Number(v))} />
                  <Tooltip
                    contentStyle={tip}
                    itemStyle={tipItem}
                    formatter={(v) => [formatCurrency(Number(v ?? 0)), 'Gross profit']}
                  />
                  <Line type="monotone" dataKey="v" stroke="#0d9488" strokeWidth={2.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {tab === 'products' && (
        <div className="grid gap-5 lg:grid-cols-2">
          <TableCard
            title="Top revenue"
            icon={Pill}
            rows={topByRevenue.map((m) => ({
              a: m.name,
              mfr: displayManufacturer(medicineById.get(m.medicineId)),
              b: formatCurrency(m.revenue),
              c: `${m.tabletsSold} tab`,
            }))}
          />
          <TableCard
            title="Most gross profit"
            icon={Wallet}
            rows={topByProfit.map((m) => ({
              a: m.name,
              mfr: displayManufacturer(medicineById.get(m.medicineId)),
              b: formatCurrency(m.profit),
              c: formatCurrency(m.revenue),
            }))}
          />
          <TableCard
            title="Highest profit / tablet"
            icon={TrendingUp}
            rows={topByProfitPerTablet.map((m) => ({
              a: m.name,
              mfr: displayManufacturer(medicineById.get(m.medicineId)),
              b: formatCurrency(m.ppt),
              c: `${m.tabletsSold} tab · ${formatCurrency(m.profit)}`,
            }))}
            empty="No tablet sales in filter."
          />
          <TableCard
            title="Lowest gross profit (movers)"
            icon={Pill}
            rows={leastByProfit.map((m) => ({
              a: m.name,
              mfr: displayManufacturer(medicineById.get(m.medicineId)),
              b: formatCurrency(m.profit),
              c: `${m.tabletsSold} tab`,
            }))}
            empty="No movers in filter."
          />
        </div>
      )}

      {tab === 'batches' && (
        <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm dark:bg-card/40">
          <h3 className="mb-1 flex items-center gap-2 text-base font-bold">
            <Layers className="h-4 w-4 text-primary" />
            Batch profit &amp; flow
          </h3>
          <p className="mb-4 text-xs text-muted-foreground">
            Sold + gross profit from slice data in range. Purchased = GRN lines in same date range (matched by lot
            number).
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b text-[10px] font-bold uppercase text-muted-foreground">
                  <th className="pb-2">Medicine</th>
                  <th className="pb-2">Batch</th>
                  <th className="pb-2">Expiry</th>
                  <th className="pb-2 text-right">Purchased</th>
                  <th className="pb-2 text-right">Sold (tab)</th>
                  <th className="pb-2 text-right">On hand</th>
                  <th className="pb-2 text-right">Revenue</th>
                  <th className="pb-2 text-right">COGS</th>
                  <th className="pb-2 text-right">Gross profit</th>
                </tr>
              </thead>
              <tbody>
                {batchRows.slice(0, 40).map((r) => (
                  <tr key={`${r.medicineId}-${r.batchId}`} className="border-b border-border/50 last:border-0">
                    <td className="py-2">
                      <span className="font-medium">{r.medicineName}</span>
                      <span className="mt-0.5 block text-[10px] font-medium text-muted-foreground">
                        Mfr. {displayManufacturer(medicineById.get(r.medicineId))}
                      </span>
                    </td>
                    <td className="py-2 text-muted-foreground">{r.batchNo}</td>
                    <td className="py-2 tabular-nums">{r.expiryDate}</td>
                    <td className="py-2 text-right tabular-nums">{r.qtyPurchased}</td>
                    <td className="py-2 text-right tabular-nums">{r.qtySold}</td>
                    <td className="py-2 text-right tabular-nums">{r.remaining}</td>
                    <td className="py-2 text-right tabular-nums font-semibold">{formatCurrency(r.totalRevenue)}</td>
                    <td className="py-2 text-right tabular-nums">{formatCurrency(r.totalCogs)}</td>
                    <td className="py-2 text-right tabular-nums font-bold text-primary">{formatCurrency(r.grossProfit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {batchRows.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">No batch activity in this filter.</p>
            ) : null}
          </div>
        </div>
      )}

      {tab === 'expiry' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border-2 border-red-500/25 bg-red-500/5 p-6 dark:border-red-500/30">
              <p className="text-[11px] font-bold uppercase tracking-wide text-red-700 dark:text-red-300">
                Total expiry loss (on hand)
              </p>
              <p className="mt-2 text-4xl font-black tabular-nums text-red-800 dark:text-red-200">
                {formatCurrency(expiryLossTotal)}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Expired lots still in inventory × batch cost / tablet.
              </p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-card p-6 shadow-sm dark:bg-card/40">
              <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Top loss medicines</p>
              <ul className="mt-3 space-y-2">
                {expiryByMedicine.slice(0, 6).map((x) => (
                  <li key={x.medicineId} className="flex justify-between gap-2 text-sm font-semibold">
                    <div className="min-w-0 pr-2">
                      <span className="block truncate">{x.name}</span>
                      <span className="block text-[10px] font-medium text-muted-foreground">
                        Mfr. {displayManufacturer(medicineById.get(x.medicineId))}
                      </span>
                    </div>
                    <span className="shrink-0 self-start tabular-nums text-red-700 dark:text-red-300">
                      {formatCurrency(x.loss)}
                    </span>
                  </li>
                ))}
                {expiryByMedicine.length === 0 ? (
                  <li className="text-sm text-muted-foreground">No expired stock on hand.</li>
                ) : null}
              </ul>
            </div>
          </div>
          <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm dark:bg-card/40">
            <h3 className="mb-3 flex items-center gap-2 text-base font-bold">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Expired batches (detail)
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead>
                  <tr className="border-b text-[10px] font-bold uppercase text-muted-foreground">
                    <th className="pb-2">Medicine</th>
                    <th className="pb-2">Batch</th>
                    <th className="pb-2">Expiry</th>
                    <th className="pb-2 text-right">Expired qty (tab)</th>
                    <th className="pb-2 text-right">Loss</th>
                  </tr>
                </thead>
                <tbody>
                  {expiryRows.map((r) => (
                    <tr key={`${r.medicineId}-${r.batchId}`} className="border-b border-border/50 last:border-0">
                      <td className="py-2">
                        <span className="font-medium">{r.medicineName}</span>
                        <span className="mt-0.5 block text-[10px] font-medium text-muted-foreground">
                          Mfr. {displayManufacturer(medicineById.get(r.medicineId))}
                        </span>
                      </td>
                      <td className="py-2 text-muted-foreground">{r.batchNo}</td>
                      <td className="py-2">{r.expiryDate}</td>
                      <td className="py-2 text-right tabular-nums">{r.expiredQty}</td>
                      <td className="py-2 text-right font-bold tabular-nums text-red-700 dark:text-red-300">
                        {formatCurrency(r.lossAmount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {expiryRows.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">No expired inventory — great job.</p>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {tab === 'dead' && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-border/70 bg-card/80 p-4 dark:bg-card/40">
            <label className="text-[10px] font-bold uppercase text-muted-foreground">
              No sales in last (days)
              <input
                type="number"
                min={7}
                max={730}
                value={deadLookback}
                onChange={(e) => setDeadLookback(Math.max(7, Math.min(730, parseInt(e.target.value, 10) || 90)))}
                className="mt-1 block w-24 rounded-lg border border-border bg-background px-2 py-1.5 text-sm dark:bg-zinc-900"
              />
            </label>
            <p className="max-w-xl text-xs text-muted-foreground">
              Medicines with shelf stock but no invoice lines in the lookback. Near-expiry table uses lots close to
              expiry with no sales on that batch in the same window.
            </p>
          </div>
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm dark:bg-card/40">
              <h3 className="mb-3 flex items-center gap-2 text-base font-bold">
                <Skull className="h-4 w-4 text-muted-foreground" />
                Dead stock medicines
              </h3>
              <ul className="max-h-80 space-y-1 overflow-y-auto text-sm">
                {deadMeds.length === 0 ? (
                  <li className="text-muted-foreground">None in this lookback.</li>
                ) : (
                  deadMeds.map((m) => (
                    <li
                      key={m.id}
                      className="flex justify-between gap-2 rounded-lg border border-border/40 bg-muted/20 px-2 py-1.5 dark:bg-muted/10"
                    >
                      <div className="min-w-0">
                        <span className="font-medium">{m.name}</span>
                        <span className="mt-0.5 block text-[10px] font-medium text-muted-foreground">
                          Mfr. {displayManufacturer(m)}
                        </span>
                      </div>
                      <span className="shrink-0 self-start tabular-nums text-muted-foreground">
                        {medicineStockTotal(m)} on hand
                      </span>
                    </li>
                  ))
                )}
              </ul>
            </div>
            <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm dark:bg-card/40">
              <h3 className="mb-3 text-base font-bold">Near expiry · no batch sales (lookback)</h3>
              <div className="max-h-80 overflow-y-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b text-[10px] font-bold uppercase text-muted-foreground">
                      <th className="pb-2">Medicine</th>
                      <th className="pb-2">Batch</th>
                      <th className="pb-2">Expiry</th>
                      <th className="pb-2 text-right">Stock</th>
                    </tr>
                  </thead>
                  <tbody>
                    {nearExpiryUnsold.map((r, i) => (
                      <tr key={`${r.medicineName}-${i}`} className="border-b border-border/40 last:border-0">
                        <td className="py-1.5">
                          <span className="font-medium">{r.medicineName}</span>
                          <span className="mt-0.5 block text-[10px] font-medium text-muted-foreground">
                            Mfr. {displayManufacturer(medicineById.get(r.medicineId))}
                          </span>
                        </td>
                        <td className="py-1.5 text-muted-foreground">{r.batchNo}</td>
                        <td className="py-1.5">{r.expiryDate}</td>
                        <td className="py-1.5 text-right tabular-nums">{r.stock}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {nearExpiryUnsold.length === 0 ? (
                  <p className="py-6 text-center text-xs text-muted-foreground">None flagged.</p>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'inventory' && (
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm dark:bg-card/40">
            <h3 className="mb-3 flex items-center gap-2 text-base font-bold">
              <Package className="h-4 w-4 text-primary" />
              Low & out of stock
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-[10px] font-bold uppercase text-muted-foreground">Out of stock</p>
                <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto text-sm">
                  {inventoryRows.out.length === 0 ? (
                    <li className="text-muted-foreground">None</li>
                  ) : (
                    inventoryRows.out.map((r) => (
                      <li
                        key={r.medicine.id}
                        className="rounded-lg bg-red-500/10 px-2 py-1.5 font-medium text-red-800 dark:text-red-200"
                      >
                        <span className="block truncate">{r.medicine.name}</span>
                        <span className="mt-0.5 block text-[10px] font-medium text-red-900/80 dark:text-red-200/80">
                          Mfr. {displayManufacturer(r.medicine)}
                        </span>
                      </li>
                    ))
                  )}
                </ul>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase text-muted-foreground">Low stock</p>
                <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto text-sm">
                  {inventoryRows.low.length === 0 ? (
                    <li className="text-muted-foreground">None</li>
                  ) : (
                    inventoryRows.low.map((r) => (
                      <li key={r.medicine.id} className="flex justify-between gap-2 rounded-lg bg-muted/50 px-2 py-1.5">
                        <div className="min-w-0">
                          <span className="block truncate font-medium">{r.medicine.name}</span>
                          <span className="mt-0.5 block text-[10px] font-medium text-muted-foreground">
                            Mfr. {displayManufacturer(r.medicine)}
                          </span>
                        </div>
                        <span className="shrink-0 self-start tabular-nums text-muted-foreground">{r.qty}</span>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm dark:bg-card/40">
            <h3 className="mb-3 text-base font-bold">Expiring soon (batches)</h3>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[320px] text-left text-sm">
                <thead>
                  <tr className="border-b text-[10px] font-bold uppercase text-muted-foreground">
                    <th className="pb-2">Medicine</th>
                    <th className="pb-2">Batch</th>
                    <th className="pb-2">Expiry</th>
                    <th className="pb-2 text-right">Stock</th>
                  </tr>
                </thead>
                <tbody>
                  {inventoryRows.expiring.map((r, i) => (
                    <tr key={`${r.medicine.id}-${r.batch}-${i}`} className="border-b border-border/50 last:border-0">
                      <td className="py-2">
                        <span className="font-medium">{r.medicine.name}</span>
                        <span className="mt-0.5 block text-[10px] font-medium text-muted-foreground">
                          Mfr. {displayManufacturer(r.medicine)}
                        </span>
                      </td>
                      <td className="py-2 text-muted-foreground">{r.batch}</td>
                      <td className="py-2">{r.exp}</td>
                      <td className="py-2 text-right tabular-nums">{r.stock}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <h3 className="mb-2 mt-6 text-sm font-bold">Dead stock (no sales in 90 days, stock &gt; 0)</h3>
            <ul className="max-h-40 space-y-1 overflow-y-auto text-sm text-muted-foreground">
              {dead.length === 0 ? (
                <li>None detected.</li>
              ) : (
                dead.map((m) => (
                  <li key={m.id} className="flex justify-between gap-2 rounded-lg bg-muted/40 px-2 py-1.5 dark:bg-muted/20">
                    <div className="min-w-0">
                      <span className="font-medium text-foreground">{m.name}</span>
                      <span className="mt-0.5 block text-[10px] font-medium text-muted-foreground">
                        Mfr. {displayManufacturer(m)}
                      </span>
                    </div>
                    <span className="shrink-0 self-start tabular-nums">{medicineStockTotal(m)} on hand</span>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      )}

      {tab === 'customers' && (
        <div className="grid gap-5 lg:grid-cols-3">
          <TableCard
            title="Top customers (spend)"
            icon={Users}
            rows={customerStats.top.map((c) => ({ a: c.name, b: formatCurrency(c.total), c: `${c.orders} orders` }))}
            empty="No named customers on filtered sales."
          />
          <TableCard
            title="Credit balances"
            icon={Wallet}
            rows={customerStats.withCredit.map((c) => ({ a: c.name, b: formatCurrency(c.balance), c: c.phone }))}
            empty="No positive balances."
          />
          <TableCard
            title="Frequent buyers (orders)"
            icon={Users}
            rows={customerStats.frequent.map((c) => ({ a: c.name, b: String(c.orders), c: formatCurrency(c.total) }))}
            empty="No repeat customers in filter."
          />
        </div>
      )}

      {tab === 'substitution' && <SubstitutionIntelligenceSection range={range} isDarkMode={isDarkMode} />}

      <p className="text-center text-[11px] text-muted-foreground">
        Purchase GRNs in range:{' '}
        <span className="font-semibold text-foreground">
          {purchases.filter((p) => p.status === 'completed' && inRange(p.timestamp, range.start, range.end)).length}
        </span>{' '}
        completed · Returns in range: <span className="font-semibold text-foreground">{returnsInRange.length}</span> (
        <span className="font-semibold text-foreground">{formatCurrency(returnsValueInRange)}</span>) · Gross profit uses
        batch-level COGS frozen on each sale; net figures apply the invoice discount
        heuristic.
      </p>
    </div>
  );
};

function TableCard({
  title,
  icon: Icon,
  rows,
  empty,
}: {
  title: string;
  icon: LucideIcon;
  rows: { a: string; b: string; c: string; mfr?: string }[];
  empty?: string;
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm dark:bg-card/40">
      <h3 className="mb-3 flex items-center gap-2 text-base font-bold">
        <Icon className="h-4 w-4 text-primary" />
        {title}
      </h3>
      {rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{empty ?? 'No data.'}</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((r, i) => (
            <li
              key={i}
              className="flex items-start justify-between gap-2 rounded-xl border border-border/50 bg-muted/20 px-3 py-2 text-sm dark:bg-muted/10"
            >
              <div className="min-w-0 flex-1">
                <span className="block truncate font-medium">{r.a}</span>
                {r.mfr != null ? (
                  <span className="mt-0.5 block text-[10px] font-medium text-muted-foreground">Mfr. {r.mfr}</span>
                ) : null}
              </div>
              <span className="shrink-0 font-bold tabular-nums">{r.b}</span>
              <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">{r.c}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

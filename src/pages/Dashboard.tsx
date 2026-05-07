import React, { useId, useMemo } from 'react';
import { endOfDay, format, formatDistanceToNow, parseISO, startOfDay, subDays } from 'date-fns';
import {
  AlertTriangle,
  ArrowRight,
  CreditCard,
  LineChart as LineChartIcon,
  Package,
  Pill,
  Receipt,
  ClipboardList,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
  Undo2,
  Truck,
  Wallet,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { usePOSBillingStore } from '@/store/usePOSBillingStore';
import { displayManufacturer } from '@/lib/medicineDisplay';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useAppStore } from '@/store/useAppStore';
import { getMedicineAvailability } from '@/lib/posSearchHelpers';
import { isExpiringSoon, startOfToday } from '@/lib/posDates';
import {
  aggregateMedicinesFromSales,
  dailySeries,
  filterSales,
  inRange,
  saleEstimatedProfit,
} from '@/lib/reportsAnalytics';
import { formatCurrency, formatCurrencyChartTick, cn } from '@/lib/utils';

function deltaBadge(pct: number | null) {
  if (pct == null || !Number.isFinite(pct)) return null;
  const up = pct >= 0;
  const abs = Math.abs(Math.round(pct * 10) / 10);
  if (abs === 0) return <span className="text-[10px] font-semibold text-muted-foreground">Same as yesterday</span>;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-bold',
        up ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' : 'bg-red-500/15 text-red-700 dark:text-red-400'
      )}
    >
      {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {up ? '+' : '−'}
      {abs}%
      <span className="sr-only"> versus yesterday</span>
    </span>
  );
}

function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  tone,
  deltaPct,
  featured,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: typeof Wallet;
  tone?: 'default' | 'warn' | 'danger';
  deltaPct?: number | null;
  featured?: boolean;
}) {
  return (
    <div
      className={cn(
        'group flex flex-col justify-between rounded-2xl border bg-card p-5 shadow-sm ring-1 ring-black/[0.02] transition-shadow hover:shadow-md dark:bg-card/45 dark:shadow-none dark:ring-white/[0.05] dark:hover:shadow-none',
        tone === 'danger'
          ? 'border-red-200/90 dark:border-red-900/50'
          : tone === 'warn'
            ? 'border-amber-200/90 dark:border-amber-900/40'
            : featured
              ? 'border-primary/25 bg-gradient-to-br from-primary/[0.08] to-transparent ring-primary/15 dark:border-primary/30 dark:from-primary/15'
              : 'border-border/70 dark:border-border/50'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div
          className={cn(
            'rounded-xl p-2.5 ring-1 transition-transform group-hover:scale-[1.02]',
            tone === 'danger'
              ? 'bg-red-500/10 ring-red-500/15'
              : tone === 'warn'
                ? 'bg-amber-500/10 ring-amber-500/15'
                : 'bg-primary/12 ring-primary/10'
          )}
        >
          <Icon
            className={cn(
              'h-5 w-5',
              tone === 'danger' ? 'text-red-600 dark:text-red-400' : tone === 'warn' ? 'text-amber-600 dark:text-amber-400' : 'text-primary'
            )}
            strokeWidth={2.25}
          />
        </div>
        {deltaPct !== undefined ? deltaBadge(deltaPct ?? null) : null}
      </div>
      <div className="mt-4">
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="mt-1.5 text-2xl font-black tabular-nums tracking-tight text-foreground">{value}</p>
        {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
      </div>
    </div>
  );
}

const quickNav: { label: string; screen: 'POS' | 'Inventory' | 'Purchases' | 'Reports' | 'Suppliers'; icon: typeof ShoppingCart }[] = [
  { label: 'POS', screen: 'POS', icon: ShoppingCart },
  { label: 'Inventory', screen: 'Inventory', icon: Package },
  { label: 'Purchases', screen: 'Purchases', icon: ClipboardList },
  { label: 'Reports', screen: 'Reports', icon: LineChartIcon },
  { label: 'Suppliers', screen: 'Suppliers', icon: Truck },
];

export const Dashboard: React.FC = () => {
  const chartFillId = useId().replace(/:/g, '');
  const isDarkMode = useAppStore((s) => s.isDarkMode);
  const sales = usePOSBillingStore((s) => s.sales);
  const purchases = usePOSBillingStore((s) => s.purchases);
  const returnRecords = usePOSBillingStore((s) => s.returns);
  const medicines = usePOSBillingStore((s) => s.medicines);
  const suppliers = usePOSBillingStore((s) => s.suppliers);
  const setCurrentScreen = useAppStore((s) => s.setCurrentScreen);
  const todayStart = startOfToday();
  const todayEnd = endOfDay(new Date());
  const yStart = startOfDay(subDays(new Date(), 1));
  const yEnd = endOfDay(subDays(new Date(), 1));

  const salesToday = useMemo(
    () => sales.filter((s) => inRange(s.timestamp, todayStart, todayEnd)),
    [sales, todayStart, todayEnd]
  );

  const salesYesterday = useMemo(() => sales.filter((s) => inRange(s.timestamp, yStart, yEnd)), [sales, yStart, yEnd]);

  const revenueToday = useMemo(
    () => Math.round(salesToday.reduce((a, s) => a + s.total, 0) * 100) / 100,
    [salesToday]
  );
  const revenueYesterday = useMemo(
    () => Math.round(salesYesterday.reduce((a, s) => a + s.total, 0) * 100) / 100,
    [salesYesterday]
  );
  const revDeltaPct = revenueYesterday > 0 ? ((revenueToday - revenueYesterday) / revenueYesterday) * 100 : null;

  const profitToday = useMemo(
    () => Math.round(salesToday.reduce((a, s) => a + saleEstimatedProfit(s), 0) * 100) / 100,
    [salesToday]
  );
  const profitYesterday = useMemo(
    () => Math.round(salesYesterday.reduce((a, s) => a + saleEstimatedProfit(s), 0) * 100) / 100,
    [salesYesterday]
  );
  const profitDeltaPct = profitYesterday > 0 ? ((profitToday - profitYesterday) / profitYesterday) * 100 : profitToday > 0 ? 100 : null;

  const ordersDeltaPct =
    salesYesterday.length > 0
      ? ((salesToday.length - salesYesterday.length) / salesYesterday.length) * 100
      : salesToday.length > 0
        ? 100
        : null;
  const returnsToday = useMemo(
    () => returnRecords.filter((r) => inRange(r.timestamp, todayStart, todayEnd)),
    [returnRecords, todayStart, todayEnd]
  );
  const returnValueToday = useMemo(
    () => Math.round(returnsToday.reduce((a, r) => a + r.total, 0) * 100) / 100,
    [returnsToday]
  );

  const marginToday = revenueToday > 0 ? Math.round((profitToday / revenueToday) * 1000) / 10 : 0;

  const pendingPayables = useMemo(
    () => Math.round(suppliers.reduce((a, s) => a + Math.max(0, s.outstandingBalance), 0) * 100) / 100,
    [suppliers]
  );

  const expiryAlertDays = useSettingsStore((s) => s.expiryAlertDays);

  const { lowCount, outCount, expiringPreview } = useMemo(() => {
    let low = 0;
    let out = 0;
    const exp: { medicine: (typeof medicines)[number]; subtitle: string }[] = [];
    const expDays = Math.max(1, expiryAlertDays ?? 75);
    for (const m of medicines) {
      const { status, sellableQty } = getMedicineAvailability(m);
      if (status === 'out') out += 1;
      else if (status === 'low') low += 1;
      if (sellableQty > 0) {
        const soon = m.batches.find((b) => b.totalTablets > 0 && isExpiringSoon(b.expiryDate, expDays));
        if (soon) exp.push({ medicine: m, subtitle: `Expires ${soon.expiryDate}` });
      }
    }
    return { lowCount: low, outCount: out, expiringPreview: exp.slice(0, 6) };
  }, [medicines, expiryAlertDays]);

  const lowStockMeds = useMemo(
    () => medicines.filter((m) => getMedicineAvailability(m).status === 'low').slice(0, 5),
    [medicines]
  );
  const outStockMeds = useMemo(
    () => medicines.filter((m) => getMedicineAvailability(m).status === 'out').slice(0, 5),
    [medicines]
  );

  const chartSales = useMemo(() => {
    const windowStart = subDays(startOfToday(), 13);
    return filterSales(sales, medicines, {
      start: windowStart,
      end: todayEnd,
      payment: 'all',
      category: 'all',
      medicineId: 'all',
    });
  }, [sales, medicines, todayEnd]);

  const trendData = useMemo(() => {
    const windowStart = subDays(startOfToday(), 13);
    return dailySeries(chartSales, windowStart, new Date(), (s) => s.total);
  }, [chartSales]);

  const topMeds = useMemo(() => {
    const agg = aggregateMedicinesFromSales(chartSales);
    return [...agg].sort((a, b) => b.tabletsSold - a.tabletsSold).slice(0, 5);
  }, [chartSales]);

  const recentSales = useMemo(
    () => [...sales].sort((a, b) => parseISO(b.timestamp).getTime() - parseISO(a.timestamp).getTime()).slice(0, 7),
    [sales]
  );

  const recentPurchases = useMemo(
    () =>
      [...purchases]
        .filter((p) => p.status === 'completed')
        .sort((a, b) => parseISO(b.timestamp).getTime() - parseISO(a.timestamp).getTime())
        .slice(0, 7),
    [purchases]
  );

  const gridStroke = isDarkMode ? 'rgba(248,250,252,0.08)' : '#e2e8f0';
  const tooltipStyle = isDarkMode
    ? { backgroundColor: '#1e293b', border: 'none', borderRadius: 12 }
    : { backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: 12 };
  const tooltipItem = isDarkMode
    ? { color: '#f8fafc', fontWeight: 700 as const }
    : { color: '#0f172a', fontWeight: 700 as const };

  const hasAttention = outCount > 0 || lowCount > 0 || expiringPreview.length > 0;

  return (
    <div className="custom-scrollbar flex h-full min-h-0 w-full min-w-0 flex-col overflow-y-auto">
      <div className="mx-auto flex w-full max-w-[min(100%,1920px)] flex-col gap-6 px-3 py-4 sm:gap-7 sm:px-5 sm:py-6 md:px-6 md:py-7 lg:px-8 lg:py-8 xl:gap-8">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between lg:gap-6">
          <div className="space-y-1.5 sm:space-y-2">
            <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-widest text-primary">{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
            <h1 className="fluid-h1 font-black tracking-tight">Dashboard</h1>
            <p className="max-w-xl text-xs sm:text-sm leading-relaxed text-muted-foreground">
              Snapshot for today and the last two weeks. Use{' '}
              <button type="button" onClick={() => setCurrentScreen('Reports')} className="font-semibold text-foreground underline-offset-2 hover:underline">
                Reports
              </button>{' '}
              when you need filters and deeper cuts.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:items-end">
            <div className="flex flex-wrap gap-2">
              {quickNav.map((q) => (
                <button
                  key={q.screen}
                  type="button"
                  onClick={() => setCurrentScreen(q.screen)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-border/70 bg-card px-3 py-2 text-xs font-semibold text-foreground shadow-sm transition hover:border-primary/30 hover:bg-primary/5 dark:border-border/50 dark:bg-card/50"
                >
                  <q.icon className="h-3.5 w-3.5 text-primary" strokeWidth={2.25} />
                  {q.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setCurrentScreen('Reports')}
              className="inline-flex items-center justify-center gap-2 self-stretch rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 sm:self-end"
            >
              Open full reports
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </header>

        <div
          className={cn(
            'flex flex-wrap items-center gap-3 rounded-2xl border px-4 py-3.5 text-sm',
            hasAttention
              ? 'border-amber-200/90 bg-amber-50/90 text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-50'
              : 'border-emerald-200/90 bg-emerald-50/80 text-emerald-950 dark:border-emerald-900/40 dark:bg-emerald-950/25 dark:text-emerald-50'
          )}
        >
          {hasAttention ? (
            <>
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="font-semibold">Action suggested:</span>{' '}
                {outCount > 0 ? <span className="font-medium">{outCount} out of stock</span> : null}
                {outCount > 0 && lowCount > 0 ? ' · ' : null}
                {lowCount > 0 ? (
                  <span className="font-medium">{lowCount} low stock (per-product thresholds)</span>
                ) : null}
                {expiringPreview.length > 0 ? (
                  <>
                    {(outCount > 0 || lowCount > 0) && ' · '}
                    <span className="font-medium">{expiringPreview.length}+ near expiry</span>
                  </>
                ) : null}
              </span>
              <button
                type="button"
                onClick={() => setCurrentScreen('Inventory')}
                className="shrink-0 rounded-lg bg-amber-950/10 px-3 py-1.5 text-xs font-bold text-amber-950 hover:bg-amber-950/15 dark:bg-white/10 dark:text-amber-50 dark:hover:bg-white/15"
              >
                Review inventory
              </button>
            </>
          ) : (
            <>
              <TrendingUp className="h-5 w-5 shrink-0" />
              <span>
                <span className="font-semibold">All clear</span> — no urgent shelf alerts at current stock levels.
              </span>
            </>
          )}
        </div>

        <section className="space-y-3">
          <div className="flex items-end justify-between gap-2">
            <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Key metrics · today</h2>
            <span className="text-xs text-muted-foreground">vs yesterday where shown</span>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-6">
            <KpiCard
              featured
              label="Today sales"
              value={formatCurrency(revenueToday)}
              hint={`${salesToday.length} orders`}
              icon={Wallet}
              deltaPct={revDeltaPct}
            />
            <KpiCard
              label="Today profit (est.)"
              value={formatCurrency(profitToday)}
              hint={revenueToday ? `${marginToday}% of sales` : 'No sales yet'}
              icon={TrendingUp}
              deltaPct={profitDeltaPct}
            />
            <KpiCard label="Today's orders" value={String(salesToday.length)} hint="Checkouts today" icon={Receipt} deltaPct={ordersDeltaPct} />
            <KpiCard
              label="Returns today"
              value={formatCurrency(returnValueToday)}
              hint={`${returnsToday.length} return docs`}
              icon={Undo2}
              tone={returnsToday.length > 0 ? 'warn' : 'default'}
            />
            <KpiCard
              label="Low / out SKUs"
              value={`${lowCount + outCount}`}
              hint={`${lowCount} low · ${outCount} out`}
              icon={Package}
              tone={outCount > 0 ? 'danger' : lowCount > 0 ? 'warn' : 'default'}
            />
            <KpiCard
              label="Supplier payables"
              value={formatCurrency(pendingPayables)}
              hint="Outstanding to vendors"
              icon={CreditCard}
              tone={pendingPayables > 0 ? 'warn' : 'default'}
            />
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Trends · last 14 days</h2>
          <div className="grid shrink-0 grid-cols-1 gap-4 xl:grid-cols-2 xl:gap-5">
            <div className="flex flex-col overflow-hidden rounded-2xl border border-border/70 bg-card p-5 shadow-sm ring-1 ring-black/[0.02] dark:border-border/50 dark:bg-card/45 dark:ring-white/[0.04]">
              <div className="mb-3 flex shrink-0 items-center justify-between gap-2">
                <h3 className="flex items-center gap-2 text-base font-bold">
                  <LineChartIcon className="h-4 w-4 text-primary" />
                  Sales trend
                </h3>
                <span className="rounded-full bg-muted/80 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground dark:bg-muted/30">
                  Revenue
                </span>
              </div>
              <div className="h-[280px] w-full shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
                    <defs>
                      <linearGradient id={chartFillId} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0d9488" stopOpacity={isDarkMode ? 0.35 : 0.22} />
                        <stop offset="95%" stopColor="#0d9488" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridStroke} />
                    <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                    <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => formatCurrencyChartTick(Number(v))} width={44} />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      itemStyle={tooltipItem}
                      formatter={(v) => [formatCurrency(Number(v ?? 0)), 'Revenue']}
                    />
                    <Area type="monotone" dataKey="v" stroke="#0d9488" strokeWidth={2.25} fillOpacity={1} fill={`url(#${chartFillId})`} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="flex flex-col overflow-hidden rounded-2xl border border-border/70 bg-card p-5 shadow-sm ring-1 ring-black/[0.02] dark:border-border/50 dark:bg-card/45 dark:ring-white/[0.04]">
              <div className="mb-3 flex shrink-0 items-center justify-between gap-2">
                <h3 className="flex items-center gap-2 text-base font-bold">
                  <Pill className="h-4 w-4 text-primary" />
                  Top movers
                </h3>
                <span className="rounded-full bg-muted/80 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground dark:bg-muted/30">
                  Tablets sold
                </span>
              </div>
              <div className="h-[280px] w-full shrink-0">
                {topMeds.length === 0 ? (
                  <p className="flex h-full items-center justify-center text-sm text-muted-foreground">No sales in this window.</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topMeds} layout="vertical" margin={{ top: 8, right: 16, left: 4, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={gridStroke} />
                      <XAxis type="number" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis type="category" dataKey="name" width={118} stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={tooltipStyle} itemStyle={tooltipItem} formatter={(v) => [String(v ?? 0), 'Tablets']} />
                      <Bar dataKey="tabletsSold" fill="#14b8a6" radius={[0, 8, 8, 0]} barSize={18} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Shelf & ledger</h2>
          <div className="grid shrink-0 grid-cols-1 gap-4 pb-2 xl:grid-cols-2 xl:gap-5">
            <div className="flex flex-col rounded-2xl border border-border/70 bg-card p-5 shadow-sm ring-1 ring-black/[0.02] dark:border-border/50 dark:bg-card/45 dark:ring-white/[0.04]">
              <div className="mb-4 flex items-center justify-between gap-2">
                <h3 className="flex items-center gap-2 text-base font-bold">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  Alerts
                </h3>
                <button
                  type="button"
                  onClick={() => setCurrentScreen('Medicines')}
                  className="text-xs font-semibold text-primary hover:underline"
                >
                  Catalog
                </button>
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Out of stock</p>
                  <ul className="mt-2 max-h-40 space-y-1.5 overflow-y-auto pr-1 text-sm">
                    {outStockMeds.length === 0 ? (
                      <li className="rounded-lg border border-dashed border-border/60 px-3 py-6 text-center text-xs text-muted-foreground">None</li>
                    ) : (
                      outStockMeds.map((m) => (
                        <li
                          key={m.id}
                          className="flex items-center justify-between gap-2 rounded-lg border border-red-200/60 bg-red-500/[0.06] px-3 py-2 dark:border-red-900/40"
                        >
                          <div className="min-w-0">
                            <p className="truncate font-medium">{m.name}</p>
                            <p className="text-[10px] font-medium text-muted-foreground">Mfr. {displayManufacturer(m)}</p>
                          </div>
                          <span className="shrink-0 text-[10px] font-bold uppercase text-red-600 dark:text-red-400">Out</span>
                        </li>
                      ))
                    )}
                  </ul>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Low stock</p>
                  <ul className="mt-2 max-h-40 space-y-1.5 overflow-y-auto pr-1 text-sm">
                    {lowStockMeds.length === 0 ? (
                      <li className="rounded-lg border border-dashed border-border/60 px-3 py-6 text-center text-xs text-muted-foreground">None</li>
                    ) : (
                      lowStockMeds.map((m) => {
                        const q = getMedicineAvailability(m).sellableQty;
                        return (
                          <li
                            key={m.id}
                            className="flex justify-between gap-2 rounded-lg border border-border/50 bg-muted/35 px-3 py-2 dark:bg-muted/15"
                          >
                            <div className="min-w-0">
                              <p className="truncate font-medium">{m.name}</p>
                              <p className="text-[10px] font-medium text-muted-foreground">Mfr. {displayManufacturer(m)}</p>
                            </div>
                            <span className="shrink-0 self-start tabular-nums text-muted-foreground">{q} left</span>
                          </li>
                        );
                      })
                    )}
                  </ul>
                </div>
              </div>
              <div className="mt-5 border-t border-border/60 pt-4 dark:border-border/40">
                <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Expiring soon</p>
                <ul className="mt-2 space-y-1.5 text-sm">
                  {expiringPreview.map((e, i) => (
                    <li
                      key={`${e.medicine.id}-${i}`}
                      className="flex items-center justify-between gap-2 rounded-lg bg-muted/30 px-3 py-2 dark:bg-muted/15"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium">{e.medicine.name}</p>
                        <p className="text-[10px] font-medium text-muted-foreground">Mfr. {displayManufacturer(e.medicine)}</p>
                      </div>
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{e.subtitle.replace('Expires ', '')}</span>
                    </li>
                  ))}
                  {expiringPreview.length === 0 ? (
                    <li className="text-xs text-muted-foreground">Nothing in the near-expiry window.</li>
                  ) : null}
                </ul>
              </div>
            </div>

            <div className="flex flex-col rounded-2xl border border-border/70 bg-card p-5 shadow-sm ring-1 ring-black/[0.02] dark:border-border/50 dark:bg-card/45 dark:ring-white/[0.04]">
              <div className="mb-4 flex items-center justify-between gap-2">
                <h3 className="text-base font-bold">Recent activity</h3>
                <button type="button" onClick={() => setCurrentScreen('Sales')} className="text-xs font-semibold text-primary hover:underline">
                  Sales log
                </button>
              </div>
              <div className="grid flex-1 gap-6 sm:grid-cols-2">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Sales</p>
                  <ul className="mt-2 space-y-1">
                    {recentSales.map((s) => (
                      <li
                        key={s.id}
                        className="flex flex-col gap-0.5 rounded-xl border border-transparent px-3 py-2 transition-colors hover:border-border/80 hover:bg-muted/30 dark:hover:bg-muted/15"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate font-mono text-xs font-semibold">{s.invoiceNo}</span>
                          <span className="shrink-0 text-sm font-bold tabular-nums">{formatCurrency(s.total)}</span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                          <span className="capitalize">{s.paymentMethod}</span>
                          <span>{formatDistanceToNow(parseISO(s.timestamp), { addSuffix: true })}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Purchases (GRN)</p>
                  <ul className="mt-2 space-y-1">
                    {recentPurchases.length === 0 ? (
                      <li className="rounded-xl border border-dashed border-border/60 px-3 py-8 text-center text-xs text-muted-foreground">
                        No completed GRNs yet.
                        <button
                          type="button"
                          onClick={() => setCurrentScreen('Purchases')}
                          className="mt-2 block w-full font-semibold text-primary hover:underline"
                        >
                          Record a purchase
                        </button>
                      </li>
                    ) : (
                      recentPurchases.map((p) => (
                        <li
                          key={p.id}
                          className="flex flex-col gap-0.5 rounded-xl border border-transparent px-3 py-2 transition-colors hover:border-border/80 hover:bg-muted/30 dark:hover:bg-muted/15"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate font-mono text-xs font-semibold">{p.grnNo}</span>
                            <span className="shrink-0 text-sm font-bold tabular-nums">{formatCurrency(p.total)}</span>
                          </div>
                          <span className="text-[11px] text-muted-foreground">{formatDistanceToNow(parseISO(p.timestamp), { addSuffix: true })}</span>
                        </li>
                      ))
                    )}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

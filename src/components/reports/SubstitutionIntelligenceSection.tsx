import React, { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { FlaskConical, Sparkles, TrendingUp, Trash2 } from 'lucide-react';
import { usePOSBillingStore } from '@/store/usePOSBillingStore';
import { useSubstitutionAnalyticsStore } from '@/store/useSubstitutionAnalyticsStore';
import {
  aggregateAlternativeUsage,
  aggregateOriginalFrequency,
  filterSubstitutionEvents,
  highDemandLowStockHints,
  opportunityCount,
  pickCount,
  picksPerDay,
  recoveryRevenueTotal,
} from '@/lib/substitutionReportMetrics';
import { formatCurrency, cn } from '@/lib/utils';
import { displayManufacturer } from '@/lib/medicineDisplay';

const PIE_COLORS = ['#0d9488', '#6366f1', '#f59e0b', '#ec4899', '#8b5cf6', '#14b8a6', '#64748b'];

interface SubstitutionIntelligenceSectionProps {
  range: { start: Date; end: Date };
  isDarkMode: boolean;
}

export const SubstitutionIntelligenceSection: React.FC<SubstitutionIntelligenceSectionProps> = ({
  range,
  isDarkMode,
}) => {
  const events = useSubstitutionAnalyticsStore((s) => s.events);
  const clearEvents = useSubstitutionAnalyticsStore((s) => s.clearEvents);
  const medicines = usePOSBillingStore((s) => s.medicines);

  const filtered = useMemo(() => filterSubstitutionEvents(events, range), [events, range]);
  const originals = useMemo(() => aggregateOriginalFrequency(filtered).slice(0, 10), [filtered]);
  const alternatives = useMemo(() => aggregateAlternativeUsage(filtered).slice(0, 8), [filtered]);
  const trend = useMemo(() => picksPerDay(filtered), [filtered]);
  const recovered = useMemo(() => recoveryRevenueTotal(filtered), [filtered]);
  const opps = useMemo(() => opportunityCount(filtered), [filtered]);
  const picks = useMemo(() => pickCount(filtered), [filtered]);
  const hints = useMemo(() => highDemandLowStockHints(filtered, medicines, 8), [filtered, medicines]);

  const pieData = useMemo(() => {
    const rows = alternatives.slice(0, 6);
    const sumOther = alternatives.slice(6).reduce((a, r) => a + r.count, 0);
    const out = rows.map((r) => ({ name: r.name.length > 22 ? `${r.name.slice(0, 20)}…` : r.name, value: r.count }));
    if (sumOther > 0) out.push({ name: 'Other', value: sumOther });
    return out.length ? out : [{ name: 'No picks', value: 1 }];
  }, [alternatives]);

  const barData = useMemo(
    () =>
      originals.slice(0, 8).map((o) => ({
        name: o.label.length > 16 ? `${o.label.slice(0, 14)}…` : o.label,
        opportunities: o.opportunities,
        picks: o.picks,
      })),
    [originals]
  );

  const gridStroke = isDarkMode ? 'rgba(248,250,252,0.08)' : '#e2e8f0';
  const tip = isDarkMode
    ? { backgroundColor: '#1e293b', border: 'none', borderRadius: 12 }
    : { backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: 12 };
  const tipItem = isDarkMode
    ? { color: '#f8fafc', fontWeight: 700 as const }
    : { color: '#0f172a', fontWeight: 700 as const };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border/70 bg-card/90 p-5 shadow-sm dark:bg-card/40">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-black tracking-tight">
              <FlaskConical className="h-6 w-6 text-primary" />
              Substitution intelligence
            </h2>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
              Tracks salt-based alternative flows from POS (search miss & out-of-stock paths). Use this with shelf data
              to prioritise restocks and quantify recovery when staff substitute.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              if (window.confirm('Clear all substitution analytics events on this device?')) clearEvents();
            }}
            className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-xs font-bold text-muted-foreground hover:bg-muted/60"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Reset log
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm dark:bg-card/40">
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Alternative panels</p>
          <p className="mt-2 text-3xl font-black tabular-nums">{opps}</p>
          <p className="mt-1 text-xs text-muted-foreground">Times staff opened ranked substitutes</p>
        </div>
        <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm dark:bg-card/40">
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Substitute picks</p>
          <p className="mt-2 text-3xl font-black tabular-nums">{picks}</p>
          <p className="mt-1 text-xs text-muted-foreground">Lines added from alternative modal</p>
        </div>
        <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm dark:bg-card/40">
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Recovery (unit price)</p>
          <p className="mt-2 text-3xl font-black tabular-nums">{formatCurrency(recovered)}</p>
          <p className="mt-1 text-xs text-muted-foreground">Sum of per-unit prices at pick time (demo proxy)</p>
        </div>
        <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm dark:bg-card/40">
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Pick rate</p>
          <p className="mt-2 text-3xl font-black tabular-nums">
            {opps ? `${Math.round((picks / opps) * 100)}%` : '—'}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Picks ÷ panels opened</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm dark:bg-card/40">
          <h3 className="text-sm font-black tracking-tight">Substitution frequency</h3>
          <p className="mt-1 text-xs text-muted-foreground">Original targets (catalog ID or search label)</p>
          <div className="mt-4 h-[280px] w-full">
            {barData.length === 0 ? (
              <p className="py-16 text-center text-sm text-muted-foreground">No events in this range.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} horizontal={false} />
                  <XAxis type="number" stroke="#64748b" fontSize={11} tickLine={false} />
                  <YAxis type="category" dataKey="name" width={100} stroke="#64748b" fontSize={10} tickLine={false} />
                  <Tooltip contentStyle={tip} itemStyle={tipItem} />
                  <Legend />
                  <Bar dataKey="opportunities" name="Panels" fill="#94a3b8" radius={[0, 6, 6, 0]} />
                  <Bar dataKey="picks" name="Picks" fill="#0d9488" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm dark:bg-card/40">
          <h3 className="text-sm font-black tracking-tight">Alternative distribution</h3>
          <p className="mt-1 text-xs text-muted-foreground">Most-chosen substitutes in period</p>
          <div className="mt-4 h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={96}>
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tip} itemStyle={tipItem} />
                <Legend layout="horizontal" verticalAlign="bottom" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm dark:bg-card/40">
        <h3 className="flex items-center gap-2 text-sm font-black tracking-tight">
          <TrendingUp className="h-4 w-4 text-primary" />
          Substitution picks over time
        </h3>
        <div className="mt-4 h-[240px] w-full">
          {trend.length === 0 ? (
            <p className="py-20 text-center text-sm text-muted-foreground">No picks in this range.</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend} margin={{ left: 0, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                <XAxis dataKey="day" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} allowDecimals={false} width={36} />
                <Tooltip contentStyle={tip} itemStyle={tipItem} />
                <Line type="monotone" dataKey="count" name="Picks" stroke="#0d9488" strokeWidth={2.5} dot />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm dark:bg-card/40">
        <h3 className="flex items-center gap-2 text-sm font-black tracking-tight">
          <Sparkles className="h-4 w-4 text-amber-500" />
          Business insight · high demand vs shelf
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Catalog medicines that triggered substitution activity and are currently low or out (restock candidates).
        </p>
        {hints.length === 0 ? (
          <p className="mt-6 text-sm text-muted-foreground">
            No overlapping signals yet — open salt alternatives on the POS to populate this log.
          </p>
        ) : (
          <ul className="mt-4 space-y-2">
            {hints.map((h) => (
              <li
                key={h.medicine.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/60 bg-muted/15 px-3 py-2 text-sm dark:bg-muted/10"
              >
                <div className="min-w-0">
                  <span className="font-bold">{h.medicine.name}</span>
                  <p className="text-[10px] font-medium text-muted-foreground">Mfr. {displayManufacturer(h.medicine)}</p>
                </div>
                <span className="text-xs text-muted-foreground">
                  {h.events} events ·{' '}
                  <span
                    className={cn(
                      'font-bold',
                      h.status === 'out' ? 'text-red-600 dark:text-red-400' : 'text-amber-700 dark:text-amber-300'
                    )}
                  >
                    {h.status === 'out' ? 'Out' : `Low (${h.sellableQty} u)`}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

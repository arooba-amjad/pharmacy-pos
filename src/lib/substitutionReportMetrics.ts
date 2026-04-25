import { endOfDay, parseISO, startOfDay } from 'date-fns';
import type { Medicine } from '@/types';
import type { SubstitutionAnalyticsEvent } from '@/store/useSubstitutionAnalyticsStore';
import { getMedicineAvailability } from '@/lib/posSearchHelpers';

export function filterSubstitutionEvents(
  events: SubstitutionAnalyticsEvent[],
  range: { start: Date; end: Date }
): SubstitutionAnalyticsEvent[] {
  const a = startOfDay(range.start).getTime();
  const b = endOfDay(range.end).getTime();
  return events.filter((e) => {
    const t = parseISO(e.at).getTime();
    return t >= a && t <= b;
  });
}

export function aggregateOriginalFrequency(events: SubstitutionAnalyticsEvent[]) {
  const map = new Map<string, { key: string; label: string; opportunities: number; picks: number }>();
  for (const e of events) {
    const key = e.originalMedicineId ?? `q:${e.originalDisplay.toLowerCase()}`;
    const row = map.get(key) ?? { key, label: e.originalDisplay, opportunities: 0, picks: 0 };
    if (e.kind === 'opportunity') row.opportunities += 1;
    if (e.kind === 'pick') row.picks += 1;
    map.set(key, row);
  }
  return [...map.values()].sort((x, y) => y.picks + y.opportunities - (x.picks + x.opportunities));
}

export function aggregateAlternativeUsage(events: SubstitutionAnalyticsEvent[]) {
  const map = new Map<string, { id: string; name: string; count: number; revenue: number }>();
  for (const e of events) {
    if (e.kind !== 'pick' || !e.alternativeMedicineId || !e.alternativeName) continue;
    const row = map.get(e.alternativeMedicineId) ?? { id: e.alternativeMedicineId, name: e.alternativeName, count: 0, revenue: 0 };
    row.count += 1;
    row.revenue += e.unitPrice ?? 0;
    map.set(e.alternativeMedicineId, row);
  }
  return [...map.values()].sort((a, b) => b.count - a.count);
}

export function picksPerDay(events: SubstitutionAnalyticsEvent[]) {
  const picks = events.filter((e) => e.kind === 'pick');
  const byDay = new Map<string, number>();
  for (const p of picks) {
    const d = parseISO(p.at).toISOString().slice(0, 10);
    byDay.set(d, (byDay.get(d) ?? 0) + 1);
  }
  return [...byDay.entries()]
    .map(([day, count]) => ({ day, count }))
    .sort((a, b) => a.day.localeCompare(b.day));
}

export function recoveryRevenueTotal(events: SubstitutionAnalyticsEvent[]) {
  return Math.round(events.filter((e) => e.kind === 'pick').reduce((a, e) => a + (e.unitPrice ?? 0), 0) * 100) / 100;
}

export function opportunityCount(events: SubstitutionAnalyticsEvent[]) {
  return events.filter((e) => e.kind === 'opportunity').length;
}

export function pickCount(events: SubstitutionAnalyticsEvent[]) {
  return events.filter((e) => e.kind === 'pick').length;
}

/**
 * Medicines that are frequently targeted for substitution and currently low/out on shelf.
 */
export function highDemandLowStockHints(
  events: SubstitutionAnalyticsEvent[],
  medicines: Medicine[],
  topN = 8
) {
  const freq = new Map<string, number>();
  for (const e of events) {
    if (e.kind !== 'opportunity' && e.kind !== 'pick') continue;
    if (e.originalMedicineId) {
      freq.set(e.originalMedicineId, (freq.get(e.originalMedicineId) ?? 0) + 1);
    }
  }
  const scored = [...freq.entries()]
    .map(([id, n]) => {
      const m = medicines.find((x) => x.id === id);
      if (!m) return null;
      const av = getMedicineAvailability(m);
      return { medicine: m, events: n, status: av.status, sellableQty: av.sellableQty };
    })
    .filter((x): x is NonNullable<typeof x> => x != null)
    .filter((x) => x.status === 'low' || x.status === 'out')
    .sort((a, b) => b.events - a.events);
  return scored.slice(0, topN);
}

import type { Customer } from '@/types';

export function customerHasOutstandingCredit(c: Customer | null | undefined): boolean {
  return Boolean(c && c.balance > 0.001);
}

/** Latest ISO date from credit (charge) ledger entries — excludes balance payments. */
export function lastCreditSaleDateIso(c: Customer): string | null {
  const h = (c.creditHistory ?? []).filter((x) => x.kind !== 'payment');
  if (h.length === 0) return null;
  return h.reduce((max, x) => (x.date > max ? x.date : max), h[0].date);
}

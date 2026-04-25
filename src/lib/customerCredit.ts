import type { Customer, CustomerCreditHistoryEntry } from '@/types';

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function applyCreditSaleToCustomer(
  c: Customer,
  entry: CustomerCreditHistoryEntry,
  balanceDelta: number
): Customer {
  const prev = c.creditHistory ?? [];
  const creditEntry: CustomerCreditHistoryEntry = { ...entry, kind: entry.kind ?? 'credit' };
  return {
    ...c,
    balance: round2(c.balance + balanceDelta),
    creditHistory: [...prev, creditEntry],
  };
}

/** Aggregates for customer profile (credit charges vs payments on account). */
export function customerCreditLedgerStats(c: Customer): {
  totalCreditGiven: number;
  paidAmount: number;
  remainingBalance: number;
} {
  const history = c.creditHistory ?? [];
  let totalCreditGiven = 0;
  let paidAmount = 0;
  for (const h of history) {
    if (h.kind === 'payment') paidAmount += h.amount;
    else totalCreditGiven += h.amount;
  }
  totalCreditGiven = round2(totalCreditGiven);
  paidAmount = round2(paidAmount);
  const remainingBalance = round2(c.balance);
  return { totalCreditGiven, paidAmount, remainingBalance };
}

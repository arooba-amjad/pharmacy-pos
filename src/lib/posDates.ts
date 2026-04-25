/** Parse YYYY-MM-DD as local calendar day (no UTC drift). */
export function parseLocalDay(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function startOfToday(): Date {
  const t = new Date();
  return new Date(t.getFullYear(), t.getMonth(), t.getDate());
}

export function isExpired(expiryDate: string): boolean {
  return parseLocalDay(expiryDate) < startOfToday();
}

/** Within next `days` calendar days from today (exclusive of past). */
export function isExpiringSoon(expiryDate: string, days = 75): boolean {
  if (isExpired(expiryDate)) return false;
  const exp = parseLocalDay(expiryDate);
  const limit = startOfToday();
  limit.setDate(limit.getDate() + days);
  return exp <= limit;
}

/** Whole calendar days from today to expiry (negative if already expired). */
export function daysUntilExpiry(expiryDate: string): number {
  const exp = parseLocalDay(expiryDate);
  const today = startOfToday();
  return Math.round((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

import type { Medicine, MedicineForm } from '@/types';

/** Normalize salt token for comparison (trim, collapse spaces, lower). */
export function normalizeSaltToken(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^a-z0-9\s-]/g, '');
}

/** Split generic line like "Amoxicillin + Clavulanic Acid" into salt tokens. */
export function parseGenericToSalts(generic: string): string[] {
  const raw = generic
    .split(/[+&,/]|(?:\band\b)/gi)
    .map((t) => t.trim())
    .filter(Boolean);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of raw) {
    const n = normalizeSaltToken(t);
    if (!n || seen.has(n)) continue;
    seen.add(n);
    out.push(t.trim());
  }
  return out;
}

export function inferFormFromUnit(unit: string): MedicineForm {
  const u = unit.toLowerCase();
  if (u.includes('syrup') || u.includes('susp') || u.includes('elixir')) return 'syrup';
  if (u.includes('capsule') || u.includes('cap')) return 'capsule';
  if (u.includes('tablet') || u.includes('tab') || u.includes('caplet')) return 'tablet';
  return 'other';
}

/** Effective salts for matching (explicit `salts` or parsed `generic`). */
export function getMedicineSalts(m: Medicine): string[] {
  if (m.salts && m.salts.length > 0) return m.salts.map((s) => s.trim()).filter(Boolean);
  return parseGenericToSalts(m.generic);
}

export function getMedicineBrand(m: Medicine): string {
  if (m.brand?.trim()) return m.brand.trim();
  if (m.manufacturer?.trim()) return m.manufacturer.trim();
  const first = m.name.trim().split(/\s+/)[0] ?? m.name;
  return first;
}

export function getMedicineStrength(m: Medicine): string | undefined {
  if (m.strength?.trim()) return m.strength.trim();
  const match = m.name.match(/(\d+(?:\.\d+)?\s*(?:mg|mcg|g|iu|ml))\b/i);
  return match ? match[1]!.replace(/\s+/g, '') : undefined;
}

export function getMedicineForm(m: Medicine): MedicineForm {
  return m.form ?? inferFormFromUnit(m.unit);
}

export function saltSetsEqual(a: string[], b: string[]): boolean {
  const A = new Set(a.map(normalizeSaltToken));
  const B = new Set(b.map(normalizeSaltToken));
  if (A.size !== B.size) return false;
  for (const x of A) if (!B.has(x)) return false;
  return true;
}

export function intersectionSalts(a: string[], b: string[]): string[] {
  const B = new Set(b.map(normalizeSaltToken));
  return a.filter((x) => B.has(normalizeSaltToken(x)));
}

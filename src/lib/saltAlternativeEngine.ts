import type { Medicine, MedicineForm } from '@/types';
import {
  getMedicineForm,
  getMedicineSalts,
  getMedicineStrength,
  intersectionSalts,
  normalizeSaltToken,
  parseGenericToSalts,
  saltSetsEqual,
} from '@/lib/medicineSalts';
import { PREFERRED_SALT_QUERY_ANCHORS } from '@/lib/saltSubstituteMap';
import { getMedicineAvailability } from '@/lib/posSearchHelpers';

export type SaltMatchQuality = 'exact' | 'alternative' | 'partial';

export interface SaltAnchor {
  id?: string;
  salts: string[];
  category: string;
  strength?: string;
  form?: MedicineForm;
  /** Human label for the modal title */
  label: string;
}

export interface SaltAlternativeRow {
  medicine: Medicine;
  /** Legacy composite used for sorting — mirrors intelligence score. */
  score: number;
  /** Weighted pharmacist-intelligence score (salts, strength, form, price, stock). */
  intelligenceScore: number;
  quality: SaltMatchQuality;
  matchedSalts: string[];
  uiBadge: 'green' | 'blue' | 'yellow';
  caption: string;
  /** POS-facing rank label (e.g. Best alternative). */
  rankLabel: string;
}

function strengthMatches(a?: string, b?: string): boolean {
  if (!a || !b) return false;
  const na = a.toLowerCase().replace(/\s+/g, '');
  const nb = b.toLowerCase().replace(/\s+/g, '');
  return na === nb;
}

function formMatches(a?: MedicineForm, b?: MedicineForm): boolean {
  if (!a || !b) return false;
  if (a === 'other' || b === 'other') return false;
  return a === b;
}

function anchorReferenceUnitPrice(anchor: SaltAnchor, medicines: Medicine[]): number | null {
  if (!anchor.id) return null;
  const m = medicines.find((x) => x.id === anchor.id);
  if (!m) return null;
  return getMedicineAvailability(m).displayPrice;
}

function priceSimilarityScore(anchorPrice: number | null, candPrice: number | null): number {
  if (anchorPrice == null || candPrice == null || anchorPrice <= 0 || candPrice <= 0) return 5;
  const diff = Math.abs(anchorPrice - candPrice) / Math.max(anchorPrice, candPrice);
  return Math.round(10 * (1 - Math.min(1, diff)));
}

function stockAvailabilityScore(m: Medicine): number {
  const st = getMedicineAvailability(m).status;
  if (st === 'out') return 0;
  if (st === 'low') return 6;
  return 10;
}

/**
 * Spec-aligned ranking: salts (50), strength (20), form (10), price similarity (10), stock (10).
 */
function computeIntelligenceScore(anchor: SaltAnchor, m: Medicine, anchorUnitPrice: number | null): number {
  const candSalts = getMedicineSalts(m);
  const inter = intersectionSalts(anchor.salts, candSalts);
  const denom = Math.max(anchor.salts.length, candSalts.length, 1);
  const saltMatch = (inter.length / denom) * 50;
  const strengthMatch = strengthMatches(anchor.strength, getMedicineStrength(m)) ? 20 : 0;
  const formMatch = formMatches(anchor.form, getMedicineForm(m)) ? 10 : 0;
  const candPrice = getMedicineAvailability(m).displayPrice;
  const priceSimilarity = priceSimilarityScore(anchorUnitPrice, candPrice);
  const stockAvailability = stockAvailabilityScore(m);
  return Math.round(saltMatch + strengthMatch + formMatch + priceSimilarity + stockAvailability);
}

function classify(anchor: SaltAnchor, m: Medicine): { quality: SaltMatchQuality; ui: 'green' | 'blue' | 'yellow'; cap: string } {
  const candSalts = getMedicineSalts(m);
  const inter = intersectionSalts(anchor.salts, candSalts);
  const fullSet = saltSetsEqual(anchor.salts, candSalts);
  const sOk = strengthMatches(anchor.strength, getMedicineStrength(m));
  const fOk = formMatches(anchor.form, getMedicineForm(m));

  if (fullSet && sOk && fOk) {
    return { quality: 'exact', ui: 'green', cap: 'Exact match (same salts, strength, form)' };
  }
  if (fullSet) {
    return {
      quality: 'alternative',
      ui: 'blue',
      cap: 'Generic substitute available (same active ingredients)',
    };
  }
  if (inter.length > 0) {
    return {
      quality: 'partial',
      ui: 'yellow',
      cap: 'Partial salt overlap — verify before substituting',
    };
  }
  return { quality: 'partial', ui: 'yellow', cap: 'Partial match' };
}

function assignRankLabels(rows: SaltAlternativeRow[]): SaltAlternativeRow[] {
  let ord = 0;
  return rows.map((r) => {
    const st = getMedicineAvailability(r.medicine).status;
    if (st === 'out') {
      return { ...r, rankLabel: 'Unavailable' };
    }
    ord += 1;
    let rankLabel: string;
    if (ord === 1) rankLabel = 'Best alternative';
    else if (ord <= 3 && r.quality !== 'partial') rankLabel = 'Recommended substitute';
    else if (r.quality === 'exact' || r.quality === 'alternative') rankLabel = 'Generic option';
    else rankLabel = 'Alternative option';
    return { ...r, rankLabel };
  });
}

/** Try to resolve anchor from typed query when there is no POS search hit. */
export function resolveSaltAnchorFromQuery(query: string, medicines: Medicine[]): SaltAnchor | null {
  const raw = query.trim().toLowerCase();
  if (!raw) return null;

  const compact = raw.replace(/[\s-]+/g, '');
  const firstTok = (raw.split(/\s+/)[0] ?? raw).replace(/[^a-z0-9-]/gi, '');
  const pref =
    (PREFERRED_SALT_QUERY_ANCHORS as Record<string, { salts: string[]; category: string; displayHint?: string }>)[
      raw
    ] ??
    (PREFERRED_SALT_QUERY_ANCHORS as Record<string, { salts: string[]; category: string; displayHint?: string }>)[
      compact
    ] ??
    (PREFERRED_SALT_QUERY_ANCHORS as Record<string, { salts: string[]; category: string; displayHint?: string }>)[
      firstTok
    ];
  if (pref) {
    return {
      salts: pref.salts,
      category: pref.category,
      label: pref.displayHint ?? query.trim(),
    };
  }

  const ql = raw;
  const exactName = medicines.find((m) => m.name.trim().toLowerCase() === ql);
  if (exactName) {
    return buildAnchorFromMedicine(exactName, exactName.name);
  }

  const nameHits = medicines.filter(
    (m) => m.name.toLowerCase().includes(ql) || ql.includes(m.name.toLowerCase())
  );
  if (nameHits.length > 0) {
    const pick = [...nameHits].sort((a, b) => b.name.length - a.name.length)[0]!;
    return buildAnchorFromMedicine(pick, pick.name);
  }

  if (raw.includes('+') || raw.includes(',') || /\band\b/i.test(query)) {
    const salts = parseGenericToSalts(query);
    if (salts.length === 0) return null;
    const cat = inferCategoryFromSaltOverlap(salts, medicines);
    if (!cat) return null;
    return { salts, category: cat, label: salts.join(' + ') };
  }

  return null;
}

function buildAnchorFromMedicine(m: Medicine, label: string): SaltAnchor {
  return {
    id: m.id,
    salts: getMedicineSalts(m),
    category: m.category,
    strength: getMedicineStrength(m),
    form: getMedicineForm(m),
    label,
  };
}

export function anchorFromMedicine(m: Medicine): SaltAnchor {
  return buildAnchorFromMedicine(m, m.name);
}

function inferCategoryFromSaltOverlap(salts: string[], medicines: Medicine[]): string | null {
  const norm = salts.map(normalizeSaltToken);
  for (const med of medicines) {
    const ms = getMedicineSalts(med).map(normalizeSaltToken);
    if (norm.every((s) => ms.includes(s))) {
      return med.category;
    }
  }
  const cats = new Map<string, number>();
  for (const med of medicines) {
    const ms = getMedicineSalts(med).map(normalizeSaltToken);
    const hit = norm.some((s) => ms.includes(s));
    if (hit) cats.set(med.category, (cats.get(med.category) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestN = 0;
  for (const [c, n] of cats) {
    if (n > bestN) {
      best = c;
      bestN = n;
    }
  }
  return best;
}

/**
 * Same therapeutic class (`category`) + at least one shared salt.
 * Does not use name similarity. Sorted by intelligence score; in-stock first.
 */
export function findSaltAlternatives(anchor: SaltAnchor, medicines: Medicine[]): SaltAlternativeRow[] {
  const anchorUnitPrice = anchorReferenceUnitPrice(anchor, medicines);
  const rows: SaltAlternativeRow[] = [];

  for (const m of medicines) {
    if (anchor.id && m.id === anchor.id) continue;
    if (m.category !== anchor.category) continue;
    const candSalts = getMedicineSalts(m);
    if (intersectionSalts(anchor.salts, candSalts).length === 0) continue;

    const intelligenceScore = computeIntelligenceScore(anchor, m, anchorUnitPrice);
    const { quality, ui, cap } = classify(anchor, m);
    rows.push({
      medicine: m,
      score: intelligenceScore,
      intelligenceScore,
      quality,
      matchedSalts: intersectionSalts(anchor.salts, candSalts),
      uiBadge: ui,
      caption: cap,
      rankLabel: '',
    });
  }

  rows.sort((a, b) => {
    const oa = getMedicineAvailability(a.medicine).status === 'out' ? 1 : 0;
    const ob = getMedicineAvailability(b.medicine).status === 'out' ? 1 : 0;
    if (oa !== ob) return oa - ob;
    if (b.intelligenceScore !== a.intelligenceScore) return b.intelligenceScore - a.intelligenceScore;
    const tier = (q: SaltMatchQuality) => (q === 'exact' ? 3 : q === 'alternative' ? 2 : 1);
    if (tier(b.quality) !== tier(a.quality)) return tier(b.quality) - tier(a.quality);
    return a.medicine.name.localeCompare(b.medicine.name);
  });

  return assignRankLabels(rows);
}

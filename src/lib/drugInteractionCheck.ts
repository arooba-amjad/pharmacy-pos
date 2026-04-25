import type { CartLine, Medicine } from '@/types';
import { SALT_PAIR_INTERACTION_RULES, type DrugInteractionSeverity } from '@/data/drugInteractionRules';
import { getMedicineSalts, normalizeSaltToken } from '@/lib/medicineSalts';

export interface DrugInteractionHit {
  severity: DrugInteractionSeverity;
  message: string;
  /** Existing cart product name */
  cartItemName: string;
  /** Product being added */
  incomingName: string;
}

function saltSet(m: Medicine): Set<string> {
  return new Set(getMedicineSalts(m).map((s) => normalizeSaltToken(s)));
}

function hasNormSalt(set: Set<string>, group: string[]): boolean {
  const gn = group.map((g) => normalizeSaltToken(g));
  for (const s of set) {
    for (const g of gn) {
      if (!g) continue;
      if (s === g || s.includes(g) || g.includes(s)) return true;
    }
  }
  return false;
}

function plainAmoxicillinVsClavulanate(a: Medicine, b: Medicine): boolean {
  const sa = getMedicineSalts(a).map(normalizeSaltToken);
  const sb = getMedicineSalts(b).map(normalizeSaltToken);
  const hasClav = (xs: string[]) => xs.some((x) => x.includes('clavulan'));
  const hasAmox = (xs: string[]) => xs.some((x) => x.includes('amoxicillin'));
  const plainAmox = (xs: string[]) => hasAmox(xs) && !hasClav(xs);
  return (plainAmox(sa) && hasClav(sb)) || (plainAmox(sb) && hasClav(sa));
}

function duplicateParacetamol(a: Medicine, b: Medicine): boolean {
  if (a.id === b.id) return false;
  const pa = hasNormSalt(saltSet(a), ['paracetamol', 'acetaminophen']);
  const pb = hasNormSalt(saltSet(b), ['paracetamol', 'acetaminophen']);
  return pa && pb;
}

function pairFromSaltRules(a: Medicine, b: Medicine): DrugInteractionHit | null {
  const A = saltSet(a);
  const B = saltSet(b);

  for (const rule of SALT_PAIR_INTERACTION_RULES) {
    if (rule.saltsA === rule.saltsB) continue;
    const hitAB = hasNormSalt(A, rule.saltsA) && hasNormSalt(B, rule.saltsB);
    const hitBA = hasNormSalt(A, rule.saltsB) && hasNormSalt(B, rule.saltsA);
    if (hitAB || hitBA) {
      return {
        severity: rule.severity,
        message: rule.message,
        cartItemName: a.name,
        incomingName: b.name,
      };
    }
  }

  if (plainAmoxicillinVsClavulanate(a, b)) {
    return {
      severity: 'moderate',
      message:
        'Plain amoxicillin overlaps with a co-amoxiclav (clavulanate-containing) product — review for duplicate beta-lactam therapy.',
      cartItemName: a.name,
      incomingName: b.name,
    };
  }

  if (duplicateParacetamol(a, b)) {
    return {
      severity: 'severe',
      message:
        'Multiple paracetamol-containing products increase the risk of exceeding safe daily limits and liver injury — verify total daily paracetamol dose.',
      cartItemName: a.name,
      incomingName: b.name,
    };
  }

  return null;
}

/**
 * Checks `incoming` against each distinct medicine already on the cart (by line).
 * Does not flag a medicine against itself when merging quantity on the same SKU.
 */
export function checkIncomingMedicineAgainstCart(
  incoming: Medicine,
  cart: CartLine[],
  medicines: Medicine[]
): DrugInteractionHit[] {
  const hits: DrugInteractionHit[] = [];
  const seenPair = new Set<string>();

  for (const line of cart) {
    const other = medicines.find((m) => m.id === line.medicineId);
    if (!other || other.id === incoming.id) continue;

    const key = [incoming.id, other.id].sort().join('::');
    if (seenPair.has(key)) continue;
    seenPair.add(key);

    const hit = pairFromSaltRules(other, incoming);
    if (!hit) continue;

    hits.push(hit);
  }

  return hits;
}

export function worstInteractionSeverity(hits: DrugInteractionHit[]): DrugInteractionSeverity | null {
  if (hits.length === 0) return null;
  return hits.some((h) => h.severity === 'severe') ? 'severe' : 'moderate';
}

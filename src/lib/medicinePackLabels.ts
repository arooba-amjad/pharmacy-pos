import type { Medicine, MedicineUnitType } from '@/types';

/** Infer catalog type slug when `medicine.type` is unset (legacy rows). */
export function inferMedicineCategoryKey(m: Pick<Medicine, 'type' | 'unit' | 'category'>): string {
  if (m.type) return String(m.type);
  const token = `${m.unit ?? ''} ${m.category ?? ''}`.toLowerCase();
  if (token.includes('syrup')) return 'syrup';
  if (token.includes('inject') || token.includes('vial') || token.includes('ampoule')) return 'injection';
  if (token.includes('cream') || token.includes('ointment') || token.includes('tube')) return 'cream';
  if (token.includes('drop')) return 'drops';
  if (token.includes('general')) return 'general';
  return 'tablet';
}

export function isGeneralMedicineSlug(type: string | undefined | null): boolean {
  return type?.trim().toLowerCase() === 'general';
}

export function isGeneralMedicineProfile(m: Pick<Medicine, 'type' | 'unit' | 'category'>): boolean {
  return isGeneralMedicineSlug(m.type) || inferMedicineCategoryKey(m) === 'general';
}

function medicineCategoryKeyToUnitType(key: string): MedicineUnitType {
  const k = key.toLowerCase();
  if (k === 'syrup' || k === 'drops') return 'ml';
  if (k === 'injection') return 'vial';
  if (k === 'cream') return 'tube';
  return 'tablet';
}

/** Resolved stock behavior for labeling (honors `medicine.unitType`, then infers from type name). */
export function effectiveMedicineUnitType(m: Pick<Medicine, 'unitType' | 'type' | 'unit' | 'category'>): MedicineUnitType {
  if (m.unitType) return m.unitType;
  return medicineCategoryKeyToUnitType(inferMedicineCategoryKey(m));
}

export type QuantityPerPackLabelSet = {
  label: string;
  helper: string;
  quantityError: string;
  /** Lowercase phrase after the numeric pack size, e.g. "tablets per pack". */
  perPackPhrase: string;
  /** Plural noun for smallest stocked units in prose (inventory, etc.). */
  looseStockPlural: string;
  /** Singular noun for derived master price line (e.g. sale per tablet, per bottle). */
  sellUnitSingular: string;
};

export function quantityPerPackFieldLabels(opts: {
  isGeneral: boolean;
  unitType: MedicineUnitType;
}): QuantityPerPackLabelSet {
  if (opts.isGeneral) {
    return {
      label: 'Units per pack *',
      helper: 'How many selling units are in one pack for this product.',
      quantityError: 'Units per pack must be a whole number ≥ 1',
      perPackPhrase: 'units per pack',
      looseStockPlural: 'units',
      sellUnitSingular: 'unit',
    };
  }
  switch (opts.unitType) {
    case 'tablet':
      return {
        label: 'Tablets per pack *',
        helper: 'How many tablets or capsules are in one retail pack.',
        quantityError: 'Tablets per pack must be a whole number ≥ 1',
        perPackPhrase: 'tablets per pack',
        looseStockPlural: 'tablets',
        sellUnitSingular: 'tablet',
      };
    case 'ml':
      return {
        label: 'Bottles per pack *',
        helper: 'How many bottles count as one pack for ordering and pricing.',
        quantityError: 'Bottles per pack must be a whole number ≥ 1',
        perPackPhrase: 'bottles per pack',
        looseStockPlural: 'bottles',
        sellUnitSingular: 'bottle',
      };
    case 'vial':
      return {
        label: 'Units per pack *',
        helper: 'How many vials, ampoules, or injections are in one pack.',
        quantityError: 'Units per pack must be a whole number ≥ 1',
        perPackPhrase: 'vials per pack',
        looseStockPlural: 'vials',
        sellUnitSingular: 'vial',
      };
    case 'tube':
      return {
        label: 'Tubes per pack *',
        helper: 'How many tubes are in one retail pack.',
        quantityError: 'Tubes per pack must be a whole number ≥ 1',
        perPackPhrase: 'tubes per pack',
        looseStockPlural: 'tubes',
        sellUnitSingular: 'tube',
      };
    default:
      return {
        label: 'Quantity per pack *',
        helper: 'Number of units in one pack for this medicine type.',
        quantityError: 'Quantity per pack must be a whole number ≥ 1',
        perPackPhrase: 'units per pack',
        looseStockPlural: 'units',
        sellUnitSingular: 'unit',
      };
  }
}

/**
 * POS loose-quantity mode label — prefers catalog display unit (e.g. Vial, Tablet, Bottle).
 */
export function posLooseSellShortLabel(m: Pick<Medicine, 'unit'>): string {
  const u = m.unit?.trim();
  if (!u) return 'Unit';
  return u.charAt(0).toUpperCase() + u.slice(1).toLowerCase();
}

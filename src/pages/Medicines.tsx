import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Eye, Layers, Pencil, Plus, Search, Trash2, Truck, X } from 'lucide-react';
import { usePOSBillingStore } from '@/store/usePOSBillingStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import type { Medicine } from '@/types';
import { cn, formatCurrency } from '@/lib/utils';
import { displayManufacturer } from '@/lib/medicineDisplay';
import { getMedicineLowStockThresholdTablets, medicineMatchesQuery } from '@/lib/posSearchHelpers';
import {
  getMasterPurchasePrice,
  getMasterPurchasePricePerPack,
  getMasterSalePrice,
  getMasterSalePricePerPack,
} from '@/lib/medicineMasterHelpers';
import {
  effectiveMedicineUnitType,
  isGeneralMedicineProfile,
  isGeneralMedicineSlug,
  quantityPerPackFieldLabels,
} from '@/lib/medicinePackLabels';
import { getMedicineTabletsPerPack, tabletPurchaseFromPack, tabletSaleFromPack } from '@/lib/stockUnits';
import { SupplierCombobox } from '@/components/medicines/SupplierCombobox';
import { ManufacturerCombobox } from '@/components/medicines/ManufacturerCombobox';

type Sheet = null | { mode: 'add' } | { mode: 'edit'; id: string };
type MedicineType = string;
type MedicineUnitType = 'tablet' | 'ml' | 'vial' | 'tube';
type MedicineTypeOption = {
  value: string;
  label: string;
  shortLabel: string;
  unitType: MedicineUnitType;
  unit: string;
  tabletsPerPack: string;
  packLabel: string;
  volume: string;
};

const MEDICINE_TYPE_OPTIONS: Array<MedicineTypeOption> = [
  {
    value: 'tablet',
    label: 'Tablet',
    shortLabel: 'Tab',
    unitType: 'tablet',
    unit: 'Tablet',
    tabletsPerPack: '10',
    packLabel: '',
    volume: '',
  },
  {
    value: 'capsule',
    label: 'Capsule',
    shortLabel: 'Cap',
    unitType: 'tablet',
    unit: 'Capsule',
    tabletsPerPack: '10',
    packLabel: '',
    volume: '',
  },
  {
    value: 'syrup',
    label: 'Syrup',
    shortLabel: 'Syrup',
    unitType: 'ml',
    unit: 'ml',
    tabletsPerPack: '1',
    packLabel: '120ml bottle',
    volume: '120',
  },
  {
    value: 'injection',
    label: 'Injection',
    shortLabel: 'Inj',
    unitType: 'vial',
    unit: 'Vial',
    tabletsPerPack: '1',
    packLabel: '1 vial',
    volume: '',
  },
  {
    value: 'cream',
    label: 'Cream',
    shortLabel: 'Cream',
    unitType: 'tube',
    unit: 'Tube',
    tabletsPerPack: '1',
    packLabel: '20g tube',
    volume: '',
  },
  {
    value: 'drops',
    label: 'Drops',
    shortLabel: 'Drops',
    unitType: 'ml',
    unit: 'ml',
    tabletsPerPack: '1',
    packLabel: '10ml bottle',
    volume: '10',
  },
  {
    value: 'general',
    label: 'General',
    shortLabel: 'General',
    unitType: 'tablet',
    unit: 'Unit',
    tabletsPerPack: '1',
    packLabel: '',
    volume: '',
  },
];

const TYPE_DEFAULTS = Object.fromEntries(MEDICINE_TYPE_OPTIONS.map((t) => [t.value, t])) as Record<
  string,
  MedicineTypeOption
>;

function normalizeMedicineType(raw: string | undefined | null): MedicineType {
  if (!raw) return 'tablet';
  return raw;
}

function inferMedicineType(m: Pick<Medicine, 'type' | 'unit' | 'category'>): MedicineType {
  if (m.type) return m.type;
  const token = `${m.unit ?? ''} ${m.category ?? ''}`.toLowerCase();
  if (token.includes('syrup')) return 'syrup';
  if (token.includes('inject') || token.includes('vial') || token.includes('ampoule')) return 'injection';
  if (token.includes('cream') || token.includes('ointment') || token.includes('tube')) return 'cream';
  if (token.includes('drop')) return 'drops';
  if (token.includes('general')) return 'general';
  return 'tablet';
}

function typeLabelForDisplay(type: string, options: MedicineTypeOption[]): string {
  const hit = options.find((opt) => opt.value === type);
  if (hit) return hit.label;
  return type;
}

interface FormState {
  name: string;
  generic: string;
  manufacturer: string;
  unit: string;
  type: MedicineType;
  unitType: MedicineUnitType;
  /** Integer tablets per full commercial pack */
  tabletsPerPack: string;
  purchasePerPack: string;
  salePerPack: string;
  /** Optional display label; if empty, a default label is saved from pack size + unit */
  packLabel: string;
  /** Low-stock line (tablets), ≥ 0 */
  lowStockThreshold: string;
  volume: string;
  supplierSearch: string;
  supplierId: string;
  manufacturerId: string;
  newSupplierPhone: string;
  newManufacturerPhone: string;
}

const emptyForm = (defaultLowStockTablets: number): FormState => ({
  name: '',
  generic: '',
  manufacturer: '',
  unit: 'Tablet',
  type: 'tablet',
  unitType: 'tablet',
  tabletsPerPack: '10',
  purchasePerPack: '',
  salePerPack: '',
  packLabel: '',
  lowStockThreshold: String(Math.max(0, Math.floor(defaultLowStockTablets))),
  volume: '',
  supplierSearch: '',
  supplierId: '',
  manufacturerId: '',
  newSupplierPhone: '',
  newManufacturerPhone: '',
});

function FloatField({
  id,
  label,
  value,
  onChange,
  type = 'text',
  error,
  inputMode,
  min,
  step,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  error?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
  min?: string;
  step?: string;
}) {
  const [focused, setFocused] = useState(false);
  const floated = focused || value.length > 0;

  return (
    <div className="relative">
      <label
        htmlFor={id}
        className={cn(
          'pointer-events-none absolute left-3 z-10 origin-left transition-all',
          floated ? 'top-1.5 text-[10px] font-medium text-slate-500' : 'top-3 text-sm text-slate-400'
        )}
      >
        {label}
      </label>
      <input
        id={id}
        type={type}
        inputMode={inputMode}
        min={min}
        step={step}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className={cn(
          'no-drag w-full rounded-xl border border-slate-200 bg-white px-3 pb-2.5 pt-5 text-sm text-slate-900 outline-none transition-shadow focus:border-slate-300 focus:ring-2 focus:ring-slate-200/80 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white',
          error && 'border-red-400 focus:border-red-400 focus:ring-red-100'
        )}
      />
      {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
    </div>
  );
}

function TypeNav({
  options,
  selected,
  setSelected,
  getLabel,
  className,
}: {
  options: string[];
  selected: string | 'all';
  setSelected: (c: string | 'all') => void;
  getLabel: (value: string) => string;
  className?: string;
}) {
  return (
    <nav className={cn('flex flex-col gap-0.5', className)}>
      <button
        type="button"
        onClick={() => setSelected('all')}
        className={cn(
          'rounded-xl px-3 py-2 text-left text-sm font-semibold transition-all',
          selected === 'all'
            ? 'bg-primary/12 text-primary shadow-sm ring-2 ring-primary/25 dark:bg-primary/15 dark:text-primary'
            : 'text-slate-600 hover:bg-white/80 dark:text-zinc-400 dark:hover:bg-zinc-800/80'
        )}
      >
        All
      </button>
      {options.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => setSelected(c)}
          className={cn(
            'rounded-xl px-3 py-2 text-left text-sm font-semibold transition-all',
            selected === c
              ? 'bg-primary/12 text-primary shadow-sm ring-2 ring-primary/25 dark:bg-primary/15 dark:text-primary'
              : 'text-slate-600 hover:bg-white/80 dark:text-zinc-400 dark:hover:bg-zinc-800/80'
          )}
        >
          {getLabel(c)}
        </button>
      ))}
    </nav>
  );
}

function FloatSelect({
  id,
  label,
  value,
  onChange,
  options,
  error,
  disabled,
  placeholder = 'Select…',
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  error?: string;
  disabled?: boolean;
  placeholder?: string;
}) {
  const [focused, setFocused] = useState(false);
  const floated = focused || value.length > 0;

  return (
    <div className="relative">
      <label
        htmlFor={id}
        className={cn(
          'pointer-events-none absolute left-3 z-10 origin-left transition-all',
          floated ? 'top-1.5 text-[10px] font-medium text-slate-500' : 'top-3 text-sm text-slate-400'
        )}
      >
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        disabled={disabled}
        className={cn(
          'no-drag w-full cursor-pointer appearance-none rounded-xl border border-slate-200 bg-white px-3 pb-2.5 pt-5 text-sm text-slate-900 outline-none transition-shadow focus:border-slate-300 focus:ring-2 focus:ring-slate-200/80 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white',
          error && 'border-red-400',
          disabled && 'cursor-not-allowed bg-slate-100 text-slate-400 dark:bg-zinc-800 dark:text-zinc-500'
        )}
      >
        <option value="">{placeholder}</option>
        {options.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
      {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
    </div>
  );
}

export const Medicines: React.FC = () => {
  const medicines = usePOSBillingStore((s) => s.medicines);
  const suppliers = usePOSBillingStore((s) => s.suppliers);
  const manufacturers = usePOSBillingStore((s) => s.manufacturers);
  const addMedicineMasterRecord = usePOSBillingStore((s) => s.addMedicineMasterRecord);
  const applyMedicineMasterPatch = usePOSBillingStore((s) => s.applyMedicineMasterPatch);
  const removeMedicine = usePOSBillingStore((s) => s.removeMedicine);
  const addSupplier = usePOSBillingStore((s) => s.addSupplier);
  const addManufacturer = usePOSBillingStore((s) => s.addManufacturer);

  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string | 'all'>('all');
  const [viewId, setViewId] = useState<string | null>(null);
  const [sheet, setSheet] = useState<Sheet>(null);
  /** Bumped whenever the add/edit sheet opens so AnimatePresence + exit overlays stack correctly. */
  const [sheetPresenceKey, setSheetPresenceKey] = useState(0);
  const [medicineTypes, setMedicineTypes] = useState<MedicineTypeOption[]>(MEDICINE_TYPE_OPTIONS);
  const [typeModalOpen, setTypeModalOpen] = useState(false);
  const [newTypeName, setNewTypeName] = useState('');
  const [newTypeUnitBehavior, setNewTypeUnitBehavior] = useState('');
  const [newTypeError, setNewTypeError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(() => emptyForm(useSettingsStore.getState().lowStockThreshold));
  const [errors, setErrors] = useState<Partial<Record<keyof FormState | 'supplier', string>>>({});
  const selectedType = useMemo(
    () => medicineTypes.find((t) => t.value === form.type) ?? TYPE_DEFAULTS[form.type] ?? TYPE_DEFAULTS.tablet,
    [medicineTypes, form.type]
  );
  const isGeneralForm = isGeneralMedicineSlug(form.type);
  const isTabletForm = selectedType.unitType === 'tablet';
  const isVolumeForm = selectedType.unitType === 'ml';

  const quantityPerPackLabels = useMemo(
    () => quantityPerPackFieldLabels({ isGeneral: isGeneralForm, unitType: form.unitType }),
    [isGeneralForm, form.unitType]
  );

  /** Pack prices → per sellable unit (same math as tablets; units-per-pack comes from quantity-per-pack field). */
  const derivedCatalogPerUnitPrices = useMemo(() => {
    if (isGeneralForm) return null;
    const tpp = Math.max(1, Math.floor(Number(form.tabletsPerPack) || 0));
    const salePp = Number(form.salePerPack);
    const purchasePp = Number(form.purchasePerPack);
    if (!Number.isFinite(tpp) || tpp < 1) return null;
    const saleOk = Number.isFinite(salePp) && salePp > 0;
    const purOk = Number.isFinite(purchasePp) && purchasePp >= 0;
    return {
      salePerUnit: saleOk ? tabletSaleFromPack(salePp, tpp) : null,
      purchasePerUnit: purOk ? (purchasePp <= 0 ? 0 : tabletPurchaseFromPack(purchasePp, tpp)) : null,
    };
  }, [form.tabletsPerPack, form.salePerPack, form.purchasePerPack, isGeneralForm]);

  const browseTypes = useMemo(() => {
    const set = new Set<string>();
    for (const t of medicineTypes) {
      set.add(t.value);
    }
    for (const m of medicines) {
      const key = normalizeMedicineType(m.type || inferMedicineType(m));
      if (key) set.add(key);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }, [medicines, medicineTypes]);

  const filtered = useMemo(() => {
    return medicines.filter((m) => {
      const mType = normalizeMedicineType(m.type || inferMedicineType(m));
      if (typeFilter !== 'all' && mType !== typeFilter) return false;
      return medicineMatchesQuery(m, query);
    });
  }, [medicines, query, typeFilter]);

  const viewMed = viewId ? medicines.find((m) => m.id === viewId) ?? null : null;

  const isNewSupplierDraft = useMemo(() => {
    const q = form.supplierSearch.trim();
    if (!q || form.supplierId.trim()) return false;
    return !suppliers.some((s) => s.name.trim().toLowerCase() === q.toLowerCase());
  }, [form.supplierId, form.supplierSearch, suppliers]);

  const isNewManufacturerDraft = useMemo(() => {
    const q = form.manufacturer.trim();
    if (!q || form.manufacturerId.trim()) return false;
    return !manufacturers.some((m) => m.name.trim().toLowerCase() === q.toLowerCase());
  }, [form.manufacturer, form.manufacturerId, manufacturers]);

  const resolveSupplierForSave = (): { supplierId: string | null; supplierName: string; isNew: boolean } => {
    if (form.supplierId.trim()) {
      const ok = usePOSBillingStore.getState().suppliers.some((s) => s.id === form.supplierId);
      if (ok) return { supplierId: form.supplierId, supplierName: '', isNew: false };
    }
    const q = form.supplierSearch.trim();
    if (!q) return { supplierId: null, supplierName: '', isNew: false };
    const hit = usePOSBillingStore
      .getState()
      .suppliers.find((s) => s.name.trim().toLowerCase() === q.toLowerCase());
    if (hit) return { supplierId: hit.id, supplierName: hit.name, isNew: false };
    return { supplierId: null, supplierName: q, isNew: true };
  };

  const openAdd = () => {
    setSheetPresenceKey((k) => k + 1);
    const defaults = medicineTypes[0] ?? TYPE_DEFAULTS.tablet;
    const seed = emptyForm(useSettingsStore.getState().lowStockThreshold);
    setForm({
      ...seed,
      type: defaults.value,
      unitType: defaults.unitType,
      unit: defaults.unit,
      tabletsPerPack: defaults.tabletsPerPack,
      packLabel: defaults.packLabel,
      volume: defaults.volume,
    });
    setErrors({});
    setSheet({ mode: 'add' });
  };

  const openEdit = (m: Medicine) => {
    setSheetPresenceKey((k) => k + 1);
    const medType = normalizeMedicineType(inferMedicineType(m));
    const defaults = TYPE_DEFAULTS[medType] ?? TYPE_DEFAULTS.tablet;
    if (!medicineTypes.some((t) => t.value === medType)) {
      setMedicineTypes((prev) => [
        ...prev,
        {
          value: medType,
          label: medType.charAt(0).toUpperCase() + medType.slice(1),
          shortLabel: medType.charAt(0).toUpperCase() + medType.slice(1, 3),
          unitType: defaults.unitType,
          unit: defaults.unit,
          tabletsPerPack: defaults.tabletsPerPack,
          packLabel: defaults.packLabel,
          volume: defaults.volume,
        },
      ]);
    }
    const tpp = getMedicineTabletsPerPack(m);
    const spp = getMasterSalePricePerPack(m);
    const ppp = getMasterPurchasePricePerPack(m);
    const supplierById = m.supplierId ? suppliers.find((s) => s.id === m.supplierId) : null;
    const supplierNameFallback = (m as Medicine & { supplierName?: string }).supplierName ?? '';
    const manufacturerById = m.manufacturerId ? manufacturers.find((x) => x.id === m.manufacturerId) : null;
    const manufacturerName = (manufacturerById?.name ?? m.manufacturer ?? '').trim();
    const defLow = useSettingsStore.getState().lowStockThreshold;
    setForm({
      name: m.name,
      generic: m.generic,
      manufacturer: manufacturerName,
      unit: m.unit || defaults.unit,
      type: normalizeMedicineType((m as Medicine & { type?: string }).type ?? medType),
      unitType: m.unitType ?? defaults.unitType,
      tabletsPerPack: String(tpp),
      purchasePerPack: ppp != null ? String(ppp) : '',
      salePerPack: spp != null ? String(spp) : '',
      packLabel: m.packSize ?? '',
      lowStockThreshold:
        m.lowStockThreshold != null ? String(m.lowStockThreshold) : String(Math.max(0, Math.floor(defLow))),
      volume: m.volume != null ? String(m.volume) : defaults.volume,
      supplierId: m.supplierId ?? '',
      supplierSearch: supplierById?.name ?? supplierNameFallback,
      manufacturerId:
        manufacturerById?.id ??
        manufacturers.find((x) => x.name.trim().toLowerCase() === manufacturerName.toLowerCase())?.id ??
        '',
      newSupplierPhone: '',
      newManufacturerPhone: '',
    });
    setErrors({});
    setSheet({ mode: 'edit', id: m.id });
  };

  const validate = (): boolean => {
    const e: Partial<Record<keyof FormState | 'supplier', string>> = {};
    if (!form.name.trim()) e.name = 'Required';
    if (!form.generic.trim()) e.generic = 'Required';
    if (!form.type) e.type = 'Select a medicine type';
    if (!isGeneralForm && !form.unitType) e.unit = 'Unit must be defined';
    const needsVolume = !isGeneralForm && selectedType.unitType === 'ml';
    const tpp = Math.floor(Number(form.tabletsPerPack));
    const qpErr = quantityPerPackFieldLabels({ isGeneral: isGeneralForm, unitType: form.unitType }).quantityError;
    if (!Number.isFinite(tpp) || tpp < 1) e.tabletsPerPack = qpErr;
    const volume = Number(form.volume);
    if (needsVolume && (!Number.isFinite(volume) || volume <= 0)) e.volume = 'Enter valid volume in ml';
    const salePp = Number(form.salePerPack);
    const purchasePp = Number(form.purchasePerPack);
    if (!Number.isFinite(salePp) || salePp <= 0) e.salePerPack = 'Enter a valid sale price';
    if (!Number.isFinite(purchasePp) || purchasePp < 0) e.purchasePerPack = 'Enter a valid purchase price';
    const lst = Math.floor(Number(form.lowStockThreshold));
    if (!Number.isFinite(lst) || lst < 0) e.lowStockThreshold = 'Must be a whole number ≥ 0';
    const sup = resolveSupplierForSave();
    if (!sup.supplierId && !sup.isNew) {
      e.supplier = 'Supplier is required — pick from the list or type a name.';
    }
    if (sup.isNew && !form.newSupplierPhone.trim()) {
      e.newSupplierPhone = 'Phone is required for a new supplier.';
    }
    if (isNewManufacturerDraft && !form.newManufacturerPhone.trim()) {
      e.newManufacturerPhone = 'Phone is required for a new manufacturer.';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const saveForm = async () => {
    if (!validate()) return;
    const normalizedType = normalizeMedicineType(form.type);
    const typeDefaults = medicineTypes.find((t) => t.value === normalizedType) ?? TYPE_DEFAULTS[normalizedType] ?? TYPE_DEFAULTS.tablet;
    const isGeneral = isGeneralMedicineSlug(normalizedType);
    const isTablet = !isGeneral && typeDefaults.unitType === 'tablet';
    const tpp = Math.max(1, Math.floor(Number(form.tabletsPerPack)));
    const salePp = Number(form.salePerPack);
    const purchasePp = Number(form.purchasePerPack);
    const volume = Number(form.volume);
    const normalizedVolume =
      !isGeneral && Number.isFinite(volume) && volume > 0 ? Math.round(volume * 100) / 100 : undefined;
    const packLabel =
      form.packLabel.trim() ||
      (isGeneral
        ? ''
        : isTablet
        ? ''
        : normalizedVolume != null && (normalizedType === 'syrup' || normalizedType === 'drops')
          ? `${normalizedVolume}ml bottle`
          : normalizedType === 'injection'
            ? '1 vial'
            : '1 tube');
    const supplierResolved = resolveSupplierForSave();
    let supplierId: string | undefined = supplierResolved.supplierId ?? undefined;
    if (!supplierId && supplierResolved.isNew) {
      const createdId = await addSupplier({
        name: supplierResolved.supplierName,
        phone: form.newSupplierPhone.trim(),
      });
      supplierId = createdId ?? undefined;
    }
    if (!supplierId) return;
    let resolvedManufacturer = form.manufacturer.trim();
    if (form.manufacturerId.trim()) {
      const selected = manufacturers.find((m) => m.id === form.manufacturerId.trim());
      if (selected) resolvedManufacturer = selected.name;
    } else if (resolvedManufacturer) {
      const exact = manufacturers.find((m) => m.name.trim().toLowerCase() === resolvedManufacturer.toLowerCase());
      if (exact) {
        resolvedManufacturer = exact.name;
      } else if (isNewManufacturerDraft) {
        const mfrId = await addManufacturer({
          name: resolvedManufacturer,
          phone: form.newManufacturerPhone.trim(),
        });
        if (!mfrId) return;
      }
    }

    const lowStockThreshold = Math.max(0, Math.floor(Number(form.lowStockThreshold) || 0));

    if (sheet?.mode === 'add') {
      addMedicineMasterRecord({
        name: form.name.trim(),
        generic: form.generic.trim(),
        category: typeDefaults.label,
        type: normalizedType,
        unitType: isGeneral ? 'tablet' : form.unitType,
        manufacturer: resolvedManufacturer,
        unit: isGeneral ? 'Unit' : form.unit.trim() || typeDefaults.unit,
        tabletsPerPack: tpp,
        purchasePricePerPack: purchasePp,
        salePricePerPack: salePp,
        packSize: packLabel || undefined,
        volume: normalizedVolume,
        lowStockThreshold,
        supplierId,
      });
      setSheet(null);
      return;
    }

    if (sheet?.mode === 'edit') {
      applyMedicineMasterPatch(sheet.id, {
        name: form.name.trim(),
        generic: form.generic.trim(),
        category: typeDefaults.label,
        type: normalizedType,
        unitType: isGeneral ? 'tablet' : form.unitType,
        manufacturer: resolvedManufacturer,
        unit: isGeneral ? 'Unit' : form.unit.trim() || typeDefaults.unit,
        tabletsPerPack: tpp,
        purchasePricePerPack: purchasePp,
        salePricePerPack: salePp,
        packSize: packLabel,
        volume: normalizedVolume,
        supplierId,
        lowStockThreshold,
      });
      setSheet(null);
    }
  };

  const addMedicineTypeQuick = () => {
    const name = newTypeName.trim();
    const unitBehavior = newTypeUnitBehavior.trim();
    if (!name || !unitBehavior) {
      setNewTypeError('Type name and unit behavior are required.');
      return;
    }
    const value = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || `type-${Date.now()}`;
    const exists = medicineTypes.some((t) => t.value === value || t.label.toLowerCase() === name.toLowerCase());
    if (exists) {
      setNewTypeError(null);
      setTypeModalOpen(false);
      return;
    }
    const lower = unitBehavior.toLowerCase();
    const unitType: MedicineUnitType = lower.includes('ml')
      ? 'ml'
      : lower.includes('vial')
      ? 'vial'
      : lower.includes('tube')
      ? 'tube'
      : 'tablet';
    const next: MedicineTypeOption = {
      value,
      label: name,
      shortLabel: name.length <= 6 ? name : `${name.slice(0, 1).toUpperCase()}${name.slice(1, 3).toLowerCase()}`,
      unitType,
      unit: unitBehavior,
      tabletsPerPack: '1',
      packLabel: '',
      volume: unitType === 'ml' ? '10' : '',
    };
    setMedicineTypes((prev) => [...prev, next]);
    setForm((f) => ({ ...f, type: next.value, unitType: next.unitType, unit: next.unit }));
    setNewTypeName('');
    setNewTypeUnitBehavior('');
    setNewTypeError(null);
    setTypeModalOpen(false);
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#F8FAFC] dark:bg-zinc-950">
      <header className="shrink-0 border-b border-slate-200/80 bg-white/90 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/90">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-5 sm:px-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white sm:text-3xl">Medicines</h1>
              <p className="mt-1 max-w-xl text-sm leading-relaxed text-slate-600 dark:text-zinc-400">
                Master catalog and default pricing for POS. Shelf quantities, batches, and expiry are managed in{' '}
                <span className="font-semibold text-slate-800 dark:text-zinc-200">Inventory</span>.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="mr-auto flex items-center gap-2 rounded-2xl border border-slate-200/90 bg-slate-50/90 px-3 py-2 text-xs font-bold tabular-nums text-slate-700 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/80 dark:text-zinc-200 lg:mr-0">
                <span className="text-primary">{filtered.length}</span>
                <span className="font-medium text-slate-400 dark:text-zinc-500">/</span>
                <span>{medicines.length}</span>
                <span className="pl-1 font-medium text-slate-500 dark:text-zinc-400">shown</span>
              </div>
              <button
                type="button"
                onClick={() => setTypeModalOpen(true)}
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                <Plus className="h-4 w-4" />
                Add medicine type
              </button>
              <button
                type="button"
                onClick={openAdd}
                className="inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/25 transition hover:brightness-[1.03]"
              >
                <Plus className="h-4 w-4" />
                Add medicine
              </button>
            </div>
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, generic, type, batch code…"
              className="w-full rounded-[18px] border border-slate-200 bg-slate-50 py-3.5 pl-12 pr-4 text-sm font-medium text-slate-900 shadow-inner outline-none transition focus:border-primary/35 focus:bg-white focus:ring-4 focus:ring-primary/12 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"
            />
          </div>
        </div>
      </header>

      <div className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col lg:flex-row">
        {/* Desktop sidebar */}
        <aside className="hidden w-56 shrink-0 border-r border-slate-200/70 bg-white/70 p-4 dark:border-zinc-800/80 dark:bg-zinc-950/50 lg:block">
          <p className="mb-3 px-1 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-zinc-500">Browse</p>
          <TypeNav
            options={browseTypes}
            selected={typeFilter}
            setSelected={setTypeFilter}
            getLabel={(value) => typeLabelForDisplay(value, medicineTypes)}
          />
        </aside>

        {/* Mobile medicine-type pills */}
        <div className="flex gap-2 overflow-x-auto border-b border-slate-200/80 bg-white/90 px-4 py-3 lg:hidden dark:border-zinc-800 dark:bg-zinc-950/90">
          <button
            type="button"
            onClick={() => setTypeFilter('all')}
            className={cn(
              'shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold transition',
              typeFilter === 'all'
                ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
                : 'bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-300'
            )}
          >
            All
          </button>
          {browseTypes.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setTypeFilter(c)}
              className={cn(
                'shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold transition',
                typeFilter === c
                  ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
                  : 'bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-300'
              )}
            >
              {typeLabelForDisplay(c, medicineTypes)}
            </button>
          ))}
        </div>

        {/* List */}
        <main className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          {filtered.length === 0 ? (
            <div className="rounded-[22px] border border-dashed border-slate-200 bg-white/90 py-16 text-center dark:border-zinc-800 dark:bg-zinc-900/40">
              <Search className="mx-auto mb-3 h-10 w-10 text-slate-300 dark:text-zinc-600" strokeWidth={1.25} />
              <p className="text-base font-semibold text-slate-800 dark:text-zinc-200">No medicines match</p>
              <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500 dark:text-zinc-400">
                Try another search or switch medicine type. Add a new product with{' '}
                <span className="font-semibold text-slate-700 dark:text-zinc-300">Add medicine</span>.
              </p>
            </div>
          ) : (
            <ul className="space-y-3">
              {filtered.map((m) => {
                const salePp = getMasterSalePricePerPack(m);
                const buyPp = getMasterPurchasePricePerPack(m);
                const tpp = getMedicineTabletsPerPack(m);
                const supName = m.supplierId ? suppliers.find((s) => s.id === m.supplierId)?.name : null;
                const lowLine = getMedicineLowStockThresholdTablets(m);
                const catalogPackLbl = quantityPerPackFieldLabels({
                  isGeneral: isGeneralMedicineProfile(m),
                  unitType: effectiveMedicineUnitType(m),
                });
                return (
                  <li
                    key={m.id}
                    className="group rounded-[20px] border border-slate-200/80 bg-white p-4 shadow-sm ring-1 ring-black/[0.02] transition-[box-shadow,transform] hover:-translate-y-0.5 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900/75 dark:ring-white/[0.04] sm:p-5"
                  >
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-white">{m.name}</h2>
                          <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-bold text-primary">
                            {typeLabelForDisplay(normalizeMedicineType(m.type || inferMedicineType(m)), medicineTypes)}
                          </span>
                        </div>
                        <p className="text-sm leading-relaxed text-slate-600 dark:text-zinc-400">{m.generic}</p>
                        <p className="text-[11px] font-medium text-slate-500/90 dark:text-zinc-500">
                          <span className="text-slate-400 dark:text-zinc-600">Mfr.</span> {displayManufacturer(m)}
                        </p>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium text-slate-500 dark:text-zinc-500">
                          {m.packSize ? <span className="text-slate-400 dark:text-zinc-600">{m.packSize}</span> : null}
                          <span className="inline-flex items-center gap-1 text-slate-600 dark:text-zinc-400">
                            <Layers className="h-3.5 w-3.5 opacity-70" />
                            {m.batches.length} lot{m.batches.length === 1 ? '' : 's'} on file
                          </span>
                          {supName ? (
                            <span className="inline-flex items-center gap-1 text-slate-600 dark:text-zinc-400">
                              <Truck className="h-3.5 w-3.5 opacity-70" />
                              {supName}
                            </span>
                          ) : null}
                          <span className="text-slate-500 dark:text-zinc-500">
                            Low if ≤ <span className="font-bold tabular-nums text-slate-700 dark:text-zinc-300">{lowLine}</span>{' '}
                            {catalogPackLbl.looseStockPlural}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between xl:shrink-0 xl:gap-8">
                        <div className="flex gap-8 text-sm">
                          <div className="rounded-xl bg-slate-50 px-4 py-2 dark:bg-zinc-800/80">
                            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 dark:text-zinc-500">
                              Sale / pack{tpp >= 2 ? ` · ${tpp}u` : ''}
                            </p>
                            <p className="mt-0.5 text-lg font-black tabular-nums text-slate-900 dark:text-white">
                              {salePp != null ? formatCurrency(salePp) : '—'}
                            </p>
                          </div>
                          <div className="rounded-xl bg-slate-50 px-4 py-2 dark:bg-zinc-800/80">
                            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 dark:text-zinc-500">
                              Purchase / pack{tpp >= 2 ? ` · ${tpp}u` : ''}
                            </p>
                            <p className="mt-0.5 text-lg font-black tabular-nums text-slate-700 dark:text-zinc-200">
                              {buyPp != null ? formatCurrency(buyPp) : '—'}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            title="View details"
                            onClick={() => setViewId(m.id)}
                            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-800 shadow-sm transition hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-800 sm:flex-none sm:px-4"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            View
                          </button>
                          <button
                            type="button"
                            title="Edit medicine"
                            onClick={() => openEdit(m)}
                            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground shadow-md shadow-primary/20 transition hover:brightness-[1.03] sm:flex-none sm:px-4"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Edit
                          </button>
                          <button
                            type="button"
                            title="Delete medicine"
                            onClick={() => {
                              if (
                                window.confirm(
                                  `Remove “${m.name}” from the master catalog? Linked cart lines will be cleared.`
                                )
                              ) {
                                removeMedicine(m.id);
                              }
                            }}
                            className="inline-flex items-center justify-center rounded-xl border border-slate-200 p-2 text-red-600 transition hover:bg-red-50 dark:border-zinc-700 dark:text-red-400 dark:hover:bg-red-950/30"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </main>
      </div>

      {/* View details — centered modal */}
      <AnimatePresence>
        {viewMed && (() => {
          const viewSup = viewMed.supplierId ? suppliers.find((s) => s.id === viewMed.supplierId) : null;
          const viewLow = getMedicineLowStockThresholdTablets(viewMed);
          const viewPackLbl = quantityPerPackFieldLabels({
            isGeneral: isGeneralMedicineProfile(viewMed),
            unitType: effectiveMedicineUnitType(viewMed),
          });
          return (
          <motion.div
            key={viewMed.id}
            className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center sm:p-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, pointerEvents: 'none' }}
          >
            <motion.button
              type="button"
              aria-label="Close"
              className="absolute inset-0 bg-slate-900/50 backdrop-blur-[4px]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, pointerEvents: 'none' }}
              onClick={() => setViewId(null)}
            />
            <motion.div
              key={viewMed.id}
              role="dialog"
              aria-modal="true"
              aria-labelledby="medicine-view-title"
              initial={{ opacity: 0, y: 20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 400, damping: 34 }}
              className="relative z-10 w-full max-w-md overflow-hidden rounded-[24px] bg-white shadow-2xl ring-1 ring-slate-200/90 dark:bg-zinc-950 dark:ring-zinc-800"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="border-b border-slate-100 bg-gradient-to-br from-slate-50 to-white px-5 py-4 dark:border-zinc-800 dark:from-zinc-900/80 dark:to-zinc-950">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-widest text-primary">Catalog entry</p>
                    <h2 id="medicine-view-title" className="mt-1 text-xl font-black tracking-tight text-slate-900 dark:text-white">
                      {viewMed.name}
                    </h2>
                    <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-zinc-400">{viewMed.generic}</p>
                    <p className="mt-1 text-[11px] font-medium text-slate-500 dark:text-zinc-500">
                      <span className="text-slate-400 dark:text-zinc-600">Mfr.</span> {displayManufacturer(viewMed)}
                    </p>
                    <span className="mt-2 inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-bold text-primary">
                      {typeLabelForDisplay(normalizeMedicineType(viewMed.type || inferMedicineType(viewMed)), medicineTypes)}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setViewId(null)}
                    className="shrink-0 rounded-xl p-2 text-slate-500 transition hover:bg-white dark:hover:bg-zinc-900"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>
              <div className="max-h-[min(60vh,420px)] space-y-3 overflow-y-auto px-5 py-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-3 dark:border-zinc-800 dark:bg-zinc-900/50">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-zinc-500">Sale / pack</p>
                    <p className="mt-1 text-lg font-black tabular-nums text-slate-900 dark:text-white">
                      {getMasterSalePricePerPack(viewMed) != null ? formatCurrency(getMasterSalePricePerPack(viewMed)!) : '—'}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-3 dark:border-zinc-800 dark:bg-zinc-900/50">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-zinc-500">Purchase / pack</p>
                    <p className="mt-1 text-lg font-black tabular-nums text-slate-800 dark:text-zinc-100">
                      {getMasterPurchasePricePerPack(viewMed) != null
                        ? formatCurrency(getMasterPurchasePricePerPack(viewMed)!)
                        : '—'}
                    </p>
                  </div>
                </div>
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-3 text-xs text-slate-600 dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-400">
                  <p className="font-bold text-slate-700 dark:text-zinc-300">System use (read-only)</p>
                  <p className="mt-1">
                    Sale / {viewPackLbl.sellUnitSingular}:{' '}
                    {getMasterSalePrice(viewMed) != null ? formatCurrency(getMasterSalePrice(viewMed)!) : '—'} · Cost /{' '}
                    {viewPackLbl.sellUnitSingular}:{' '}
                    {getMasterPurchasePrice(viewMed) != null ? formatCurrency(getMasterPurchasePrice(viewMed)!) : '—'}
                  </p>
                </div>
                <dl className="space-y-2 rounded-2xl border border-slate-100 p-3 text-sm dark:border-zinc-800">
                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-500 dark:text-zinc-500">Pack size</dt>
                    <dd className="text-right font-semibold text-slate-900 dark:text-white">
                      {getMedicineTabletsPerPack(viewMed)} {viewPackLbl.perPackPhrase}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-500 dark:text-zinc-500">Pack label</dt>
                    <dd className="text-right font-semibold text-slate-900 dark:text-white">
                      {viewMed.packSize?.trim() || '—'}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-500 dark:text-zinc-500">Lots on file</dt>
                    <dd className="text-right font-semibold text-slate-900 dark:text-white">{viewMed.batches.length}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-500 dark:text-zinc-500">Supplier</dt>
                    <dd className="text-right font-semibold text-slate-900 dark:text-white">{viewSup?.name ?? '—'}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-500 dark:text-zinc-500">
                      Low stock line ({viewPackLbl.looseStockPlural})
                    </dt>
                    <dd className="text-right font-semibold text-slate-900 dark:text-white">
                      ≤ {viewLow}
                      {viewMed.lowStockThreshold != null ? (
                        <span className="block text-[10px] font-medium text-slate-400 dark:text-zinc-500">Per product</span>
                      ) : (
                        <span className="block text-[10px] font-medium text-slate-400 dark:text-zinc-500">From settings default</span>
                      )}
                    </dd>
                  </div>
                </dl>
                <p className="rounded-xl bg-amber-50/80 px-3 py-2.5 text-xs leading-relaxed text-amber-950/90 dark:bg-amber-950/30 dark:text-amber-100/90">
                  <strong>Inventory</strong> is where you adjust shelf stock, batches, expiry, and waste — this screen is
                  only the product master.
                </p>
              </div>
              <div className="flex gap-2 border-t border-slate-100 bg-slate-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
                <button
                  type="button"
                  onClick={() => setViewId(null)}
                  className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-bold text-slate-800 transition hover:bg-white dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => {
                    openEdit(viewMed);
                    setViewId(null);
                  }}
                  className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground shadow-md shadow-primary/20 transition hover:brightness-[1.03]"
                >
                  Edit entry
                </button>
              </div>
            </motion.div>
          </motion.div>
          );
        })()}
      </AnimatePresence>

      {/* Add / Edit — centered modal */}
      <AnimatePresence>
        {sheet && (
          <motion.div
            key={sheetPresenceKey}
            className="fixed inset-0 z-[70] flex items-end justify-center p-4 sm:items-center sm:p-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, pointerEvents: 'none' }}
          >
            <motion.button
              type="button"
              aria-label="Close"
              className="absolute inset-0 bg-slate-900/50 backdrop-blur-[4px]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, pointerEvents: 'none' }}
              onClick={() => setSheet(null)}
            />
            <motion.div
              key={sheet.mode + (sheet.mode === 'edit' ? sheet.id : '')}
              role="dialog"
              aria-modal="true"
              initial={{ opacity: 0, y: 22, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 400, damping: 34 }}
              className="relative z-10 flex max-h-[min(92vh,720px)] w-full max-w-md flex-col overflow-hidden rounded-[24px] bg-white shadow-2xl ring-1 ring-slate-200/90 dark:bg-zinc-950 dark:ring-zinc-800"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-zinc-800">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-primary">Catalog</p>
                  <h2 className="text-lg font-black text-slate-900 dark:text-white">
                    {sheet.mode === 'add' ? 'Add medicine' : 'Edit medicine'}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setSheet(null)}
                  className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-900"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="relative z-10 min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
              <FloatField
                id="mf-name"
                label="Medicine name *"
                value={form.name}
                onChange={(v) => setForm((f) => ({ ...f, name: v }))}
                error={errors.name}
              />
              <FloatField
                id="mf-generic"
                label="Generic name *"
                value={form.generic}
                onChange={(v) => setForm((f) => ({ ...f, generic: v }))}
                error={errors.generic}
              />
              <SupplierCombobox
                suppliers={suppliers}
                supplierSearch={form.supplierSearch}
                supplierId={form.supplierId}
                error={errors.supplier}
                onChange={({ supplierSearch, supplierId }) =>
                  setForm((f) => ({ ...f, supplierSearch, supplierId, ...(supplierId ? { newSupplierPhone: '' } : {}) }))
                }
              />
              {isNewSupplierDraft ? (
                <FloatField
                  id="mf-supplier-phone"
                  label="New supplier phone *"
                  value={form.newSupplierPhone}
                  onChange={(v) => setForm((f) => ({ ...f, newSupplierPhone: v }))}
                  error={errors.newSupplierPhone}
                />
              ) : null}
              <FloatField
                id="mf-low"
                label={`Low stock alert level (${quantityPerPackLabels.looseStockPlural}) *`}
                value={form.lowStockThreshold}
                onChange={(v) => setForm((f) => ({ ...f, lowStockThreshold: v }))}
                type="number"
                inputMode="numeric"
                min="0"
                step="1"
                error={errors.lowStockThreshold}
              />
              <ManufacturerCombobox
                manufacturers={manufacturers}
                manufacturerSearch={form.manufacturer}
                manufacturerId={form.manufacturerId}
                onChange={({ manufacturerSearch, manufacturerId }) =>
                  setForm((f) => ({
                    ...f,
                    manufacturer: manufacturerSearch,
                    manufacturerId,
                    ...(manufacturerId ? { newManufacturerPhone: '' } : {}),
                    ...(manufacturerSearch.trim() ? {} : { newManufacturerPhone: '' }),
                  }))
                }
              />
              {isNewManufacturerDraft ? (
                <FloatField
                  id="mf-mfr-phone"
                  label="New manufacturer phone *"
                  value={form.newManufacturerPhone}
                  onChange={(v) => setForm((f) => ({ ...f, newManufacturerPhone: v }))}
                  error={errors.newManufacturerPhone}
                />
              ) : null}
              <div className="space-y-3">
                <FloatSelect
                  id="mf-type"
                  label="Medicine type *"
                  value={form.type}
                  onChange={(v) => {
                    const next = medicineTypes.find((t) => t.value === v) ?? TYPE_DEFAULTS[v] ?? TYPE_DEFAULTS.tablet;
                    setForm((f) => ({
                      ...f,
                      type: next.value,
                      unitType: next.unitType,
                      unit: next.unit,
                      volume: next.volume,
                      packLabel: next.packLabel,
                    }));
                    setErrors((prev) => ({ ...prev, type: undefined }));
                  }}
                  options={medicineTypes.map((o) => o.value)}
                  error={errors.type}
                  placeholder="Select medicine type…"
                />
              </div>
              {!isGeneralForm ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <FloatSelect
                    id="mf-unit-type"
                    label="Unit type *"
                    value={form.unitType}
                    onChange={(v) => setForm((f) => ({ ...f, unitType: v as MedicineUnitType }))}
                    options={['tablet', 'ml', 'vial', 'tube']}
                    error={errors.unit}
                  />
                </div>
              ) : null}
              {!isGeneralForm ? (
                <FloatField
                  id="mf-unit"
                  label="Display unit"
                  value={form.unit}
                  onChange={(v) => setForm((f) => ({ ...f, unit: v }))}
                />
              ) : null}
              <div className="space-y-1">
                <FloatField
                  id="mf-tpp"
                  label={quantityPerPackLabels.label}
                  value={form.tabletsPerPack}
                  onChange={(v) => setForm((f) => ({ ...f, tabletsPerPack: v }))}
                  type="number"
                  inputMode="numeric"
                  min="1"
                  step="1"
                  error={errors.tabletsPerPack}
                />
                <p className="text-xs text-slate-500 dark:text-zinc-500">{quantityPerPackLabels.helper}</p>
              </div>
              {!isGeneralForm && isVolumeForm ? (
                <FloatField
                  id="mf-volume"
                  label={form.type === 'syrup' ? 'Bottle size (ml) *' : 'Volume (ml) *'}
                  value={form.volume}
                  onChange={(v) => setForm((f) => ({ ...f, volume: v }))}
                  type="number"
                  inputMode="decimal"
                  min="0.1"
                  step="0.1"
                  error={errors.volume}
                />
              ) : null}
              <FloatField
                id="mf-purchase-pack"
                label={isGeneralForm ? 'Purchase price *' : 'Purchase price per pack *'}
                value={form.purchasePerPack}
                onChange={(v) => setForm((f) => ({ ...f, purchasePerPack: v }))}
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                error={errors.purchasePerPack}
              />
              <FloatField
                id="mf-sale-pack"
                label={isGeneralForm ? 'Sale price *' : 'Sale price per pack *'}
                value={form.salePerPack}
                onChange={(v) => setForm((f) => ({ ...f, salePerPack: v }))}
                type="number"
                inputMode="decimal"
                min="0.01"
                step="0.01"
                error={errors.salePerPack}
              />
              {!isGeneralForm &&
              (derivedCatalogPerUnitPrices?.salePerUnit != null ||
              derivedCatalogPerUnitPrices?.purchasePerUnit != null ? (
                <div className="rounded-2xl border border-dashed border-primary/30 bg-primary/[0.04] p-3 text-xs text-slate-700 dark:text-zinc-300">
                  <p className="font-bold text-primary">Calculated for stock &amp; POS</p>
                  <p className="mt-1.5 tabular-nums">
                    Purchase / {quantityPerPackLabels.sellUnitSingular}:{' '}
                    {derivedCatalogPerUnitPrices?.purchasePerUnit != null
                      ? formatCurrency(derivedCatalogPerUnitPrices.purchasePerUnit)
                      : '—'}
                    <span className="mx-2 text-slate-400">·</span>
                    Sale / {quantityPerPackLabels.sellUnitSingular}:{' '}
                    {derivedCatalogPerUnitPrices?.salePerUnit != null
                      ? formatCurrency(derivedCatalogPerUnitPrices.salePerUnit)
                      : '—'}
                  </p>
                  <p className="mt-1 text-slate-500 dark:text-zinc-500">
                    Enter prices per pack only — per-{quantityPerPackLabels.sellUnitSingular} amounts follow pack size automatically.
                  </p>
                </div>
              ) : null)}
              <p className="text-xs leading-relaxed text-slate-500 dark:text-zinc-500">
                {isGeneralForm
                  ? 'General type keeps pricing simple: only purchase and sale prices are required.'
                  : null}
                {!isGeneralForm ? (
                  <>
                    Purchase and sale are priced per commercial pack; per-{quantityPerPackLabels.sellUnitSingular} values are
                    derived from pack size like tablets.{' '}
                {isTabletForm
                  ? 'Tablet stock counts as packs × pack size plus loose tablets.'
                  : 'Stock is tracked in individual sellable units (bottle/tube/vial/etc.).'}{' '}
                Lots and receiving live in <span className="font-semibold text-slate-700 dark:text-zinc-300">Inventory</span>.
                  </>
                ) : null}
              </p>
              </div>
              <div className="relative z-20 flex shrink-0 gap-2 border-t border-slate-100 bg-slate-50/50 p-4 pointer-events-auto dark:border-zinc-800 dark:bg-zinc-900/40">
                <button
                  type="button"
                  onClick={() => setSheet(null)}
                  className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-white dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveForm}
                  className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground shadow-md shadow-primary/20 transition hover:brightness-[1.03]"
                >
                  Save
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {typeModalOpen ? (
          <motion.div
            className="fixed inset-0 z-[75] flex items-end justify-center p-4 sm:items-center sm:p-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, pointerEvents: 'none' }}
          >
            <motion.button
              type="button"
              aria-label="Close"
              className="absolute inset-0 bg-slate-900/50 backdrop-blur-[4px]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, pointerEvents: 'none' }}
              onClick={() => setTypeModalOpen(false)}
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              className="relative z-10 w-full max-w-md rounded-[24px] bg-white p-5 shadow-2xl ring-1 ring-slate-200/90 dark:bg-zinc-950 dark:ring-zinc-800"
            >
              <h3 className="text-lg font-black text-slate-900 dark:text-white">Add medicine type</h3>
              <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
                New type is auto-selected and category list reloads for this type.
              </p>
              <div className="mt-4 space-y-3">
                <FloatField id="new-type-name" label="Type name *" value={newTypeName} onChange={setNewTypeName} />
                <FloatField
                  id="new-type-unit"
                  label="Default unit behavior *"
                  value={newTypeUnitBehavior}
                  onChange={setNewTypeUnitBehavior}
                />
                {newTypeError ? <p className="text-xs font-semibold text-red-600">{newTypeError}</p> : null}
              </div>
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setNewTypeError(null);
                    setTypeModalOpen(false);
                  }}
                  className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-bold text-slate-700 dark:border-zinc-700 dark:text-zinc-200"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={addMedicineTypeQuick}
                  className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground"
                >
                  Save type
                </button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
};

import type { CartLine, Medicine } from '@/types';

const MEDICINE_TYPE_SHORTS: Record<string, string> = {
  tablet: 'Tab',
  capsule: 'Cap',
  syrup: 'Syrup',
  injection: 'Inj',
  cream: 'Cream',
  drops: 'Drops',
  general: 'General',
};

/** Compact manufacturer line under product name (POS / lists). */
export function displayManufacturer(source: { manufacturer?: string } | null | undefined): string {
  const t = source?.manufacturer?.trim();
  return t && t.length > 0 ? t : '—';
}

/** Uses line snapshot when present; otherwise resolves from catalog (legacy sales / cart lines). */
export function displayManufacturerForCartLine(
  line: Pick<CartLine, 'manufacturer' | 'medicineId'>,
  medicines?: Medicine[] | null
): string {
  if (line.manufacturer?.trim()) return displayManufacturer(line);
  const m = medicines?.find((x) => x.id === line.medicineId);
  return displayManufacturer(m ?? line);
}

export function medicineTypeShortLabel(type: string | undefined | null): string {
  const key = (type ?? '').trim().toLowerCase();
  return MEDICINE_TYPE_SHORTS[key] ?? (key ? key.charAt(0).toUpperCase() + key.slice(1) : '');
}

export function displayMedicineNameWithType(medicine: Pick<Medicine, 'name' | 'type'>): string {
  const short = medicineTypeShortLabel(medicine.type);
  if (!short) return medicine.name;
  const suffix = ` ${short}`;
  return medicine.name.endsWith(suffix) ? medicine.name : `${medicine.name}${suffix}`;
}

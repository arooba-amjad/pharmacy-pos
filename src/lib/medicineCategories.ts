import type { Medicine } from '@/types';

/** Suggested pharmacy form categories + merge with existing product data. */
const PRESETS = ['Tablets', 'Syrups', 'Injections', 'Capsules', 'Creams', 'General'];

export function buildMedicineCategoryList(medicines: Medicine[]): string[] {
  const set = new Set<string>(PRESETS);
  for (const m of medicines) {
    if (m.category?.trim()) set.add(m.category.trim());
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}

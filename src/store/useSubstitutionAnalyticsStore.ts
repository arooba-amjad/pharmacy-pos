import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Medicine } from '@/types';
import type { SaltAnchor } from '@/lib/saltAlternativeEngine';
import { getMedicineAvailability } from '@/lib/posSearchHelpers';

export type SubstitutionPickSource = 'search_not_found' | 'out_of_stock';

export type SubstitutionAnalyticsKind = 'opportunity' | 'pick';

export interface SubstitutionAnalyticsEvent {
  id: string;
  at: string;
  kind: SubstitutionAnalyticsKind;
  source: SubstitutionPickSource;
  originalMedicineId: string | null;
  originalDisplay: string;
  alternativeMedicineId: string | null;
  alternativeName: string | null;
  /** Unit sale price snapshot when picked (one tablet/caplet). */
  unitPrice: number | null;
  alternativesShown: number;
  anchorSaltsKey: string;
}

const MAX_EVENTS = 2500;

function nextId() {
  return `sub-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function saltsKey(anchor: SaltAnchor | null): string {
  if (!anchor?.salts?.length) return '';
  return anchor.salts.map((s) => s.trim().toLowerCase()).join('|');
}

interface SubstitutionAnalyticsState {
  events: SubstitutionAnalyticsEvent[];
  logOpportunity: (payload: {
    source: SubstitutionPickSource;
    anchor: SaltAnchor | null;
    searchQuery?: string;
    alternativesShown: number;
  }) => void;
  logPick: (payload: {
    source: SubstitutionPickSource;
    anchor: SaltAnchor | null;
    searchQuery?: string;
    alternativeMedicineId: string;
    medicines: Medicine[];
  }) => void;
  clearEvents: () => void;
}

export const useSubstitutionAnalyticsStore = create<SubstitutionAnalyticsState>()(
  persist(
    (set) => ({
      events: [],

      logOpportunity: ({ source, anchor, searchQuery, alternativesShown }) => {
        const originalMedicineId = anchor?.id ?? null;
        const originalDisplay =
          anchor?.label?.trim() ||
          searchQuery?.trim() ||
          (anchor?.salts?.length ? anchor.salts.join(' + ') : 'Unknown target');
        const ev: SubstitutionAnalyticsEvent = {
          id: nextId(),
          at: new Date().toISOString(),
          kind: 'opportunity',
          source,
          originalMedicineId,
          originalDisplay,
          alternativeMedicineId: null,
          alternativeName: null,
          unitPrice: null,
          alternativesShown,
          anchorSaltsKey: saltsKey(anchor),
        };
        set((s) => ({ events: [...s.events, ev].slice(-MAX_EVENTS) }));
      },

      logPick: ({ source, anchor, searchQuery, alternativeMedicineId, medicines }) => {
        const alt = medicines.find((m) => m.id === alternativeMedicineId);
        if (!alt) return;
        const originalMedicineId = anchor?.id ?? null;
        const originalDisplay =
          anchor?.label?.trim() ||
          searchQuery?.trim() ||
          (anchor?.salts?.length ? anchor.salts.join(' + ') : 'Unknown target');
        const price = getMedicineAvailability(alt).displayPrice;
        const ev: SubstitutionAnalyticsEvent = {
          id: nextId(),
          at: new Date().toISOString(),
          kind: 'pick',
          source,
          originalMedicineId,
          originalDisplay,
          alternativeMedicineId: alt.id,
          alternativeName: alt.name,
          unitPrice: price,
          alternativesShown: 0,
          anchorSaltsKey: saltsKey(anchor),
        };
        set((s) => ({ events: [...s.events, ev].slice(-MAX_EVENTS) }));
      },

      clearEvents: () => set({ events: [] }),
    }),
    {
      name: 'pharma-pos-substitution-analytics-v1',
      partialize: (s) => ({ events: s.events }),
      merge: (persisted, current) => ({ ...current, ...(persisted as object) }),
    }
  )
);

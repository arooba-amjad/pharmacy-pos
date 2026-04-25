/**
 * Demo interaction matrix keyed by normalized salt tokens (see `normalizeSaltToken` in medicineSalts).
 * Bidirectional: order of medicines in the cart does not matter.
 */
export type DrugInteractionSeverity = 'severe' | 'moderate';

export interface SaltPairInteractionRule {
  /** Any salt in group A on one medicine… */
  saltsA: string[];
  /** …with any salt in group B on the other triggers the interaction. */
  saltsB: string[];
  severity: DrugInteractionSeverity;
  /** Short pharmacist-facing copy. */
  message: string;
}

export const SALT_PAIR_INTERACTION_RULES: SaltPairInteractionRule[] = [
  {
    saltsA: ['atorvastatin'],
    saltsB: ['esomeprazole'],
    severity: 'moderate',
    message:
      'Atorvastatin + esomeprazole (PPI) can alter statin exposure in some patients — confirm dose timing and renal/hepatic status.',
  },
];

/**
 * Manual anchors when the search string does not match a catalog row
 * (typos, international names, etc.). Same therapeutic intent as mapped salts.
 */
export const PREFERRED_SALT_QUERY_ANCHORS: Record<
  string,
  { salts: string[]; category: string; displayHint?: string }
> = {
  'co-amoxiclav': {
    salts: ['Amoxicillin', 'Clavulanic Acid'],
    category: 'Antibiotic',
    displayHint: 'Co-amoxiclav',
  },
  'coamoxiclav': {
    salts: ['Amoxicillin', 'Clavulanic Acid'],
    category: 'Antibiotic',
  },
  'amox-clav': {
    salts: ['Amoxicillin', 'Clavulanic Acid'],
    category: 'Antibiotic',
  },
  augmentin: {
    salts: ['Amoxicillin', 'Clavulanic Acid'],
    category: 'Antibiotic',
    displayHint: 'Augmentin-class',
  },
};

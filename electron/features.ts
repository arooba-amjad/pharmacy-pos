const DEFAULT_FLAGS: Record<string, boolean> = {
  'cloud-sync': false,
  'diagnostics-export': true,
  'query-performance-logs': true,
};

function envKeyFor(name: string): string {
  return `PHARMACY_FEATURE_${name.replace(/-/g, '_').toUpperCase()}`;
}

export function isFeatureEnabled(name: string): boolean {
  const env = process.env[envKeyFor(name)];
  if (env === '1' || env === 'true') return true;
  if (env === '0' || env === 'false') return false;
  return Boolean(DEFAULT_FLAGS[name]);
}

export function getAllFeatureFlags(): Record<string, boolean> {
  const keys = Object.keys(DEFAULT_FLAGS);
  return Object.fromEntries(keys.map((k) => [k, isFeatureEnabled(k)]));
}

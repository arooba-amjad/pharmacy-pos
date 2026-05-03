import type { CartLine, CartQuantityMode } from '@/types';

const LS_KEY = 'pharmacy-pos-qty-mode-v1';

let modeMapCache: Record<string, CartQuantityMode> | null = null;

function readModeMap(): Record<string, CartQuantityMode> {
  if (modeMapCache) return modeMapCache;
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) {
      modeMapCache = {};
      return modeMapCache;
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') {
      modeMapCache = {};
      return modeMapCache;
    }
    const next: Record<string, CartQuantityMode> = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (v === 'tablet' || v === 'packet') next[k] = v;
    }
    modeMapCache = next;
    return modeMapCache;
  } catch {
    modeMapCache = {};
    return modeMapCache;
  }
}

export function getRememberedQuantityMode(medicineId: string): CartQuantityMode | undefined {
  return readModeMap()[medicineId];
}

export function rememberQuantityMode(medicineId: string, mode: CartQuantityMode): void {
  modeMapCache = { ...readModeMap(), [medicineId]: mode };
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(modeMapCache));
  } catch {
    /* ignore quota / private mode */
  }
}

export function tabletsPerSellUnit(line: Pick<CartLine, 'quantityMode' | 'tabletsPerPack'>): number {
  return line.quantityMode === 'packet' ? line.tabletsPerPack : 1;
}

export function lineTotalTablets(line: Pick<CartLine, 'quantity' | 'quantityMode' | 'tabletsPerPack'>): number {
  return line.quantity * tabletsPerSellUnit(line);
}

export function fullPacksAvailable(stockTablets: number, tabletsPerPack: number): number {
  if (tabletsPerPack < 2) return 0;
  return Math.floor(stockTablets / tabletsPerPack);
}

export function tabletModeAvailable(stockTablets: number): boolean {
  return stockTablets >= 1;
}

export function packetModeAvailable(stockTablets: number, tabletsPerPack: number): boolean {
  return fullPacksAvailable(stockTablets, tabletsPerPack) >= 1;
}

/** Pool = shelf stock for this batch + tablets already committed on the given cart line. */
export function poolTabletsForLine(batchStock: number, line: Pick<CartLine, 'quantity' | 'quantityMode' | 'tabletsPerPack'>): number {
  return batchStock + lineTotalTablets(line);
}

export function canEnablePacketToggle(line: Pick<CartLine, 'tabletsPerPack'>): boolean {
  return line.tabletsPerPack >= 2;
}

/** Prefer loose units whenever stock allows — matches POS quantity popup default. */
export function chooseInitialQuantityMode(
  _medicineId: string,
  batchStock: number,
  tabletsPerPack: number
): CartQuantityMode {
  const canPacket = packetModeAvailable(batchStock, tabletsPerPack);
  const canTablet = tabletModeAvailable(batchStock);
  if (canTablet) return 'tablet';
  if (canPacket) return 'packet';
  return 'tablet';
}

function pluralBaseUnit(unit: string, qty: number): string {
  const u = unit.trim() || 'tablet';
  if (qty === 1) return u;
  const lower = u.toLowerCase();
  if (lower.endsWith('s') || lower.endsWith('x')) return u;
  return `${u}s`;
}

/** e.g. "2 Packs" / "15 Tablets" */
export function formatSellQuantityLabel(line: Pick<CartLine, 'quantity' | 'quantityMode' | 'unit'>): string {
  const n = line.quantity;
  if (line.quantityMode === 'packet') {
    return `${n} ${n === 1 ? 'Pack' : 'Packs'}`;
  }
  const u = pluralBaseUnit(line.unit ?? 'tablet', n);
  return `${n} ${u.charAt(0).toUpperCase()}${u.slice(1)}`;
}

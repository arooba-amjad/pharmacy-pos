import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import type { CartQuantityMode } from '@/types';

function clampOpenMode(
  defaultMode: CartQuantityMode,
  canTablet: boolean,
  canPacket: boolean
): CartQuantityMode {
  if (defaultMode === 'packet' && canPacket) return 'packet';
  if (defaultMode === 'tablet' && canTablet) return 'tablet';
  if (canTablet) return 'tablet';
  return 'packet';
}

export interface PosAddQuantityModalProps {
  open: boolean;
  medicineName: string;
  /** Unit word for loose sales (e.g. "tablet", "vial"). */
  tabletUnitLabel: string;
  /** POS toggle label for loose mode (e.g. Tablet, Vial). Defaults to Tablet. */
  looseModeLabel?: string;
  /** POS toggle label for pack mode. Defaults to Pack. */
  packModeLabel?: string;
  canTablet: boolean;
  canPacket: boolean;
  defaultMode: CartQuantityMode;
  /** Wholesale/bulk: optional custom sale price before add (per unit or per pack matching mode). */
  wholesalePricingEnabled?: boolean;
  suggestedSalePerTablet?: number;
  suggestedSalePerPack?: number;
  onClose: () => void;
  /** Optional third arg = custom sale price for line (same basis as mode: per unit or per pack). */
  onConfirm: (quantity: number, mode: CartQuantityMode, salePriceOverride?: number) => void;
}

export function PosAddQuantityModal({
  open,
  medicineName,
  tabletUnitLabel,
  looseModeLabel = 'Tablet',
  packModeLabel = 'Pack',
  canTablet,
  canPacket,
  defaultMode,
  wholesalePricingEnabled = false,
  suggestedSalePerTablet = 0,
  suggestedSalePerPack = 0,
  onClose,
  onConfirm,
}: PosAddQuantityModalProps) {
  const [raw, setRaw] = useState('1');
  const [salePriceRaw, setSalePriceRaw] = useState('');
  const [mode, setMode] = useState<CartQuantityMode>('tablet');
  const inputRef = useRef<HTMLInputElement>(null);

  const quantityLabel = useMemo(() => {
    if (mode === 'packet') return `Number of ${packModeLabel.toLowerCase()}s`;
    const u = tabletUnitLabel.trim() || 'tablets';
    return `Number of ${u}`;
  }, [mode, tabletUnitLabel, packModeLabel]);

  useEffect(() => {
    if (!open) return;
    setRaw('1');
    setSalePriceRaw('');
    setMode(clampOpenMode(defaultMode, canTablet, canPacket));
    const t = window.requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
    return () => window.cancelAnimationFrame(t);
  }, [open, canTablet, canPacket, defaultMode]);

  const shelfHint = useMemo(() => {
    if (!wholesalePricingEnabled) return '';
    const shelf = mode === 'packet' ? suggestedSalePerPack : suggestedSalePerTablet;
    return formatCurrency(Number.isFinite(shelf) && shelf > 0 ? shelf : 0);
  }, [wholesalePricingEnabled, mode, suggestedSalePerPack, suggestedSalePerTablet]);

  const submit = useCallback(() => {
    const n = parseInt(raw.replace(/,/g, ''), 10);
    const q = Number.isFinite(n) && n >= 1 ? Math.min(999_999, n) : 1;
    const effectiveMode: CartQuantityMode =
      canPacket && mode === 'packet' ? 'packet' : canTablet ? 'tablet' : 'packet';
    let saleOverride: number | undefined;
    if (wholesalePricingEnabled && salePriceRaw.trim()) {
      const p = parseFloat(salePriceRaw.replace(/,/g, ''));
      if (Number.isFinite(p) && p >= 0.01) saleOverride = Math.round(p * 100) / 100;
    }
    onConfirm(q, effectiveMode, saleOverride);
  }, [raw, salePriceRaw, onConfirm, mode, canPacket, canTablet, wholesalePricingEnabled]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if ((k === 't' || k === 'p') && !e.repeat) {
        if (k === 't' && canTablet) {
          e.preventDefault();
          e.stopImmediatePropagation();
          setMode('tablet');
          return;
        }
        if (k === 'p' && canPacket) {
          e.preventDefault();
          e.stopImmediatePropagation();
          setMode('packet');
          return;
        }
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopImmediatePropagation();
        onClose();
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopImmediatePropagation();
        submit();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, onClose, submit, canTablet, canPacket]);

  if (!open || typeof document === 'undefined') return null;

  const showSellAs = canTablet && canPacket;

  return createPortal(
    <div
      data-pos-add-qty-modal="true"
      className="fixed inset-0 z-[125] flex items-center justify-center bg-black/40 p-4 backdrop-blur-[2px]"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="pos-qty-title"
        className="relative w-full max-w-sm rounded-2xl border border-border/80 bg-card p-5 shadow-2xl"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 rounded-lg p-1.5 text-muted-foreground hover:bg-muted"
          aria-label="Cancel"
        >
          <X className="h-4 w-4" />
        </button>
        <h2 id="pos-qty-title" className="pr-10 text-base font-black tracking-tight text-foreground">
          Quantity
        </h2>
        <p className="mt-1 text-xs leading-snug text-muted-foreground line-clamp-2">{medicineName}</p>

        {showSellAs ? (
          <div className="mt-4">
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Sell as</p>
            <div className="mt-1.5 flex gap-2">
              <button
                type="button"
                disabled={!canTablet}
                onClick={() => canTablet && setMode('tablet')}
                className={cn(
                  'flex-1 rounded-full border px-3 py-2 text-xs font-black transition-colors',
                  mode === 'tablet'
                    ? 'border-primary bg-primary text-primary-foreground shadow-sm shadow-primary/20'
                    : 'border-border bg-muted/40 text-foreground hover:bg-muted/70',
                  !canTablet && 'pointer-events-none opacity-40'
                )}
              >
                {looseModeLabel}
                <span className="ml-1 font-mono text-[10px] font-semibold opacity-80">T</span>
              </button>
              <button
                type="button"
                disabled={!canPacket}
                onClick={() => canPacket && setMode('packet')}
                className={cn(
                  'flex-1 rounded-full border px-3 py-2 text-xs font-black transition-colors',
                  mode === 'packet'
                    ? 'border-primary bg-primary text-primary-foreground shadow-sm shadow-primary/20'
                    : 'border-border bg-muted/40 text-foreground hover:bg-muted/70',
                  !canPacket && 'pointer-events-none opacity-40'
                )}
              >
                {packModeLabel}
                <span className="ml-1 font-mono text-[10px] font-semibold opacity-80">P</span>
              </button>
            </div>
          </div>
        ) : null}

        <label className="mt-4 block text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
          {quantityLabel}
          <input
            ref={inputRef}
            type="number"
            min={1}
            step={1}
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            className={cn(
              'mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-lg font-black tabular-nums',
              'outline-none ring-primary/25 focus:ring-2'
            )}
          />
        </label>

        {wholesalePricingEnabled ? (
          <label className="mt-3 block text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            Sale price ({mode === 'packet' ? 'per pack' : 'per unit'}) — optional
            <input
              type="number"
              min={0.01}
              step={0.01}
              value={salePriceRaw}
              onChange={(e) => setSalePriceRaw(e.target.value)}
              placeholder={shelfHint || 'Shelf price'}
              className={cn(
                'mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm font-semibold tabular-nums',
                'outline-none ring-primary/25 focus:ring-2'
              )}
            />
            <span className="mt-1 block font-normal normal-case text-muted-foreground">
              Leave blank to use shelf price ({shelfHint}).
            </span>
          </label>
        ) : null}

        <p className="mt-2 text-[10px] text-muted-foreground">
          {showSellAs ? (
            <>
              <kbd className="rounded bg-muted px-1 font-mono">T</kbd> {looseModeLabel.toLowerCase()} ·{' '}
              <kbd className="rounded bg-muted px-1 font-mono">P</kbd> {packModeLabel.toLowerCase()} ·{' '}
            </>
          ) : null}
          <kbd className="rounded bg-muted px-1 font-mono">Enter</kbd> add ·{' '}
          <kbd className="rounded bg-muted px-1 font-mono">Esc</kbd> cancel
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted/60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            className="rounded-xl bg-primary px-4 py-2 text-sm font-black text-primary-foreground shadow-md shadow-primary/25"
          >
            Add
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

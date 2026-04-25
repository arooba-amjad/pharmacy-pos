import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
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
  /** Unit word for loose sales (e.g. "tablet", "capsule"). */
  tabletUnitLabel: string;
  canTablet: boolean;
  canPacket: boolean;
  defaultMode: CartQuantityMode;
  onClose: () => void;
  /** Called with quantity ≥ 1 and the sell-as mode chosen in the modal. */
  onConfirm: (quantity: number, mode: CartQuantityMode) => void;
}

export function PosAddQuantityModal({
  open,
  medicineName,
  tabletUnitLabel,
  canTablet,
  canPacket,
  defaultMode,
  onClose,
  onConfirm,
}: PosAddQuantityModalProps) {
  const [raw, setRaw] = useState('1');
  const [mode, setMode] = useState<CartQuantityMode>('tablet');
  const inputRef = useRef<HTMLInputElement>(null);

  const quantityLabel = useMemo(() => {
    if (mode === 'packet') return 'Number of packs';
    const u = tabletUnitLabel.trim() || 'tablets';
    return `Number of ${u}`;
  }, [mode, tabletUnitLabel]);

  useEffect(() => {
    if (!open) return;
    setRaw('1');
    setMode(clampOpenMode(defaultMode, canTablet, canPacket));
    const t = window.requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
    return () => window.cancelAnimationFrame(t);
  }, [open, canTablet, canPacket, defaultMode]);

  const submit = useCallback(() => {
    const n = parseInt(raw.replace(/,/g, ''), 10);
    const q = Number.isFinite(n) && n >= 1 ? Math.min(999_999, n) : 1;
    const effectiveMode: CartQuantityMode =
      canPacket && mode === 'packet' ? 'packet' : canTablet ? 'tablet' : 'packet';
    onConfirm(q, effectiveMode);
  }, [raw, onConfirm, mode, canPacket, canTablet]);

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
                Tablet
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
                Packet
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
        <p className="mt-2 text-[10px] text-muted-foreground">
          {showSellAs ? (
            <>
              <kbd className="rounded bg-muted px-1 font-mono">T</kbd> tablet ·{' '}
              <kbd className="rounded bg-muted px-1 font-mono">P</kbd> packet ·{' '}
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

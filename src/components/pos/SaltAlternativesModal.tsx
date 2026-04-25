import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import type { SaltAlternativeRow, SaltAnchor } from '@/lib/saltAlternativeEngine';
import { getMedicineSalts, getMedicineStrength } from '@/lib/medicineSalts';
import { formatPacksPlusTablets, getMedicineTabletsPerPack } from '@/lib/stockUnits';
import { getMedicineAvailabilityWithCart } from '@/lib/posSearchHelpers';
import type { CartLine } from '@/types';
import { cn, formatCurrency } from '@/lib/utils';
import { displayManufacturer } from '@/lib/medicineDisplay';

type Phase = 'prompt' | 'list';

export interface SaltAlternativesModalProps {
  open: boolean;
  phase: Phase;
  title: string;
  /** When phase is list */
  anchor: SaltAnchor | null;
  rows: SaltAlternativeRow[];
  /** Shown in prompt when anchor could not be resolved */
  resolveError: string | null;
  cart: CartLine[];
  onClose: () => void;
  /** Prompt → compute alternatives */
  onShowAlternatives: () => void;
  onPickMedicine: (medicineId: string) => void;
}

export function SaltAlternativesModal({
  open,
  phase,
  title,
  anchor,
  rows,
  resolveError,
  cart,
  onClose,
  onShowAlternatives,
  onPickMedicine,
}: SaltAlternativesModalProps) {
  const [sel, setSel] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) setSel(0);
  }, [open, rows]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (phase !== 'list' || rows.length === 0) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSel((i) => Math.min(rows.length - 1, i + 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSel((i) => Math.max(0, i - 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const r = rows[sel];
        if (r) onPickMedicine(r.medicine.id);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, phase, rows, sel, onClose, onPickMedicine]);

  useEffect(() => {
    if (open) panelRef.current?.focus();
  }, [open, phase]);

  if (!open) return null;

  const node = (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className="max-h-[min(90vh,640px)] w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl outline-none dark:border-border dark:bg-card"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-border/60">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-primary">Salt match</p>
            <h2 className="text-lg font-black tracking-tight text-foreground">{title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[calc(90vh-140px)] overflow-y-auto px-5 py-4">
          {phase === 'prompt' ? (
            <div className="space-y-4">
              <p className="text-sm leading-relaxed text-muted-foreground">
                No catalog row matched your search. You can search for salt-based alternatives that share the same
                active ingredients and therapeutic class — the system never auto-replaces a line; you always confirm.
              </p>
              {resolveError ? <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">{resolveError}</p> : null}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={onShowAlternatives}
                  className="rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-sm hover:opacity-95"
                >
                  Show alternatives
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold hover:bg-muted/60"
                >
                  Close
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Keyboard: <kbd className="rounded bg-muted px-1 font-mono">Esc</kbd> close
              </p>
            </div>
          ) : anchor ? (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                <span className="font-bold text-foreground">Reference:</span> {anchor.label} · class{' '}
                <span className="font-semibold text-foreground">{anchor.category}</span>
                {anchor.strength ? (
                  <>
                    {' '}
                    · strength <span className="font-mono">{anchor.strength}</span>
                  </>
                ) : null}
              </p>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Same category only · ranked by salts, strength, form, price fit & stock
              </p>
              {rows.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">No alternatives in catalog.</p>
              ) : (
                <ul className="space-y-2">
                  {rows.map((r, i) => {
                    const m = r.medicine;
                    const av = getMedicineAvailabilityWithCart(m, cart);
                    const price = av.displayPrice != null ? formatCurrency(av.displayPrice) : '—';
                    const stock = formatPacksPlusTablets(av.previewQty, getMedicineTabletsPerPack(m), m.unit);
                    const badge =
                      r.uiBadge === 'green'
                        ? 'bg-emerald-500/15 text-emerald-800 ring-1 ring-emerald-500/25 dark:text-emerald-200'
                        : r.uiBadge === 'blue'
                          ? 'bg-sky-500/15 text-sky-900 ring-1 ring-sky-500/25 dark:text-sky-100'
                          : 'bg-amber-500/15 text-amber-950 ring-1 ring-amber-500/30 dark:text-amber-100';
                    const label =
                      r.uiBadge === 'green'
                        ? 'Exact match'
                        : r.uiBadge === 'blue'
                          ? 'Alternative medicine (same salts)'
                          : 'Partial salt match';
                    return (
                      <li key={m.id}>
                        <button
                          type="button"
                          onClick={() => onPickMedicine(m.id)}
                          className={cn(
                            'w-full rounded-xl border px-3 py-3 text-left transition',
                            i === sel
                              ? 'border-primary bg-primary/8 ring-2 ring-primary/20'
                              : 'border-border/70 bg-muted/10 hover:bg-muted/25 dark:border-border/50'
                          )}
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={cn('rounded-lg px-2 py-0.5 text-[10px] font-black uppercase', badge)}>
                              {label}
                            </span>
                            {r.rankLabel ? (
                              <span className="rounded-lg bg-indigo-500/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-indigo-950 ring-1 ring-indigo-500/25 dark:text-indigo-100">
                                {r.rankLabel}
                              </span>
                            ) : null}
                            <span className="text-[10px] font-medium text-muted-foreground">{r.caption}</span>
                          </div>
                          <p className="mt-1 font-bold text-foreground">{m.name}</p>
                          <p className="text-[11px] font-medium text-muted-foreground">
                            <span className="text-muted-foreground/70">Mfr.</span> {displayManufacturer(m)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Brand: {m.brand ?? m.manufacturer ?? '—'} · Salts: {getMedicineSalts(m).join(', ')}
                            {(m.strength ?? getMedicineStrength(m)) ? (
                              <> · Strength: {m.strength ?? getMedicineStrength(m)}</>
                            ) : null}
                          </p>
                          <p className="mt-1 text-xs font-semibold tabular-nums">
                            {price} / u · after cart: {stock}
                          </p>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
              <p className="text-[11px] text-muted-foreground">
                <kbd className="rounded bg-muted px-1 font-mono">↑</kbd>{' '}
                <kbd className="rounded bg-muted px-1 font-mono">↓</kbd> navigate ·{' '}
                <kbd className="rounded bg-muted px-1 font-mono">Enter</kbd> add selected ·{' '}
                <kbd className="rounded bg-muted px-1 font-mono">Esc</kbd> close
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Nothing to show.</p>
          )}
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(node, document.body) : null;
}

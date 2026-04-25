import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, ShieldAlert, X } from 'lucide-react';
import type { DrugInteractionHit } from '@/lib/drugInteractionCheck';
import { worstInteractionSeverity } from '@/lib/drugInteractionCheck';
import { cn } from '@/lib/utils';

export interface DrugInteractionModalProps {
  open: boolean;
  hits: DrugInteractionHit[];
  onCancel: () => void;
  onContinue: () => void;
}

export function DrugInteractionModal({ open, hits, onCancel, onContinue }: DrugInteractionModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, onCancel]);

  useEffect(() => {
    if (open) panelRef.current?.focus();
  }, [open]);

  if (!open || hits.length === 0) return null;

  const worst = worstInteractionSeverity(hits);
  const isSevere = worst === 'severe';

  const node = (
    <div
      className="fixed inset-0 z-[220] flex items-center justify-center bg-black/50 p-4 backdrop-blur-[2px]"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="drug-interaction-title"
        className={cn(
          'w-full max-w-md overflow-hidden rounded-2xl border bg-white shadow-2xl outline-none dark:bg-card',
          isSevere ? 'border-red-300 ring-2 ring-red-500/25 dark:border-red-900/50' : 'border-amber-200 ring-2 ring-amber-500/20 dark:border-amber-900/40'
        )}
      >
        <div
          className={cn(
            'flex items-start gap-3 border-b px-5 py-4',
            isSevere ? 'border-red-100 bg-red-500/8 dark:border-red-900/30' : 'border-amber-100 bg-amber-500/8 dark:border-amber-900/25'
          )}
        >
          {isSevere ? (
            <ShieldAlert className="h-8 w-8 shrink-0 text-red-600 dark:text-red-400" aria-hidden />
          ) : (
            <AlertTriangle className="h-8 w-8 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Drug safety</p>
            <h2 id="drug-interaction-title" className="text-lg font-black tracking-tight text-foreground">
              {isSevere ? 'Severe interaction warning' : 'Moderate interaction warning'}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {isSevere
                ? 'Review before continuing. You can cancel the add or proceed with explicit confirmation.'
                : 'Combination may be clinically significant — confirm with the patient chart or prescriber if unsure.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[min(50vh,320px)] space-y-3 overflow-y-auto px-5 py-4">
          {hits.map((h, i) => (
            <div
              key={i}
              className={cn(
                'rounded-xl border px-3 py-3 text-sm',
                h.severity === 'severe'
                  ? 'border-red-200 bg-red-500/5 dark:border-red-900/40'
                  : 'border-amber-200 bg-amber-500/5 dark:border-amber-900/35'
              )}
            >
              <p className="font-bold text-foreground">
                {h.incomingName} ↔ {h.cartItemName}
              </p>
              <p className="mt-1.5 leading-relaxed text-muted-foreground">{h.message}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 border-t border-border/60 bg-muted/20 px-5 py-4 dark:bg-muted/10">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 min-w-[120px] rounded-xl border border-border py-2.5 text-sm font-bold hover:bg-muted/60"
          >
            Cancel add
          </button>
          <button
            type="button"
            onClick={onContinue}
            className={cn(
              'flex-1 min-w-[120px] rounded-xl py-2.5 text-sm font-bold text-white shadow-sm',
              isSevere ? 'bg-red-600 hover:bg-red-700' : 'bg-amber-600 hover:bg-amber-700'
            )}
          >
            Continue anyway
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(node, document.body) : null;
}

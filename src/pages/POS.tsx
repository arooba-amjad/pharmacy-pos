import React, { useEffect, useState } from 'react';
import { Keyboard, X } from 'lucide-react';
import { ProductSearch } from './pos/ProductSearch';
import { Cart } from './pos/Cart';
import { Checkout } from './pos/Checkout';
import { ToastStack } from '@/components/pos/ToastStack';
import { CheckoutFlowModal } from '@/components/pos/CheckoutFlowModal';
import { CustomerCreditAlertHost } from '@/components/pos/CustomerCreditAlertHost';
import { usePOSBillingStore } from '@/store/usePOSBillingStore';
import { useToastStore } from '@/store/useToastStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { cn } from '@/lib/utils';

const panel =
  'min-h-0 h-full overflow-hidden rounded-[22px] border border-border/80 bg-card shadow-[0_12px_40px_-24px_rgba(15,23,42,0.12)] ring-1 ring-black/[0.03] dark:border-border/55 dark:bg-card/40 dark:shadow-[0_12px_40px_-28px_rgba(0,0,0,0.45)] dark:ring-white/[0.06]';

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex min-w-[1.75rem] items-center justify-center rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-slate-800 shadow-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100">
      {children}
    </kbd>
  );
}

function ShortcutRow({ keys, label }: { keys: React.ReactNode; label: string }) {
  return (
    <div className="flex flex-col gap-1 border-b border-slate-100 py-2.5 last:border-0 dark:border-zinc-800 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <p className="text-sm text-slate-600 dark:text-zinc-400">{label}</p>
      <div className="flex flex-wrap items-center gap-1">{keys}</div>
    </div>
  );
}

export const POS: React.FC = () => {
  const voidCart = usePOSBillingStore((s) => s.voidCart);
  const openCheckoutFlow = usePOSBillingStore((s) => s.openCheckoutFlow);
  const hydratePOSData = usePOSBillingStore((s) => s.hydratePOSData);
  const isSyncing = usePOSBillingStore((s) => s.isSyncing);
  const syncError = usePOSBillingStore((s) => s.syncError);
  const shortcutsEnabled = useSettingsStore((s) => s.keyboardShortcutsEnabled);
  const [guideOpen, setGuideOpen] = useState(false);

  useEffect(() => {
    void hydratePOSData();
  }, [hydratePOSData]);

  useEffect(() => {
    if (!shortcutsEnabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (usePOSBillingStore.getState().checkoutFlowStep) return;
      if (
        document.querySelector('[data-credit-balance-alert-modal="true"]') ||
        document.querySelector('[data-credit-details-modal="true"]') ||
        document.querySelector('[data-pay-dues-modal="true"]') ||
        document.querySelector('[data-pos-add-qty-modal="true"]')
      )
        return;

      if (e.key === 'F2') {
        e.preventDefault();
        document.getElementById('pos-search-input')?.focus();
        return;
      }
      if (e.key === 'F3') {
        e.preventDefault();
        const r = openCheckoutFlow();
        if (!r.ok) useToastStore.getState().show(r.message ?? 'Unable to start checkout.', 'error');
        return;
      }
      if (e.key === 'F4' && e.shiftKey) {
        e.preventDefault();
        voidCart();
        useToastStore.getState().show('Cart cleared — shelf stock restored.', 'info');
        return;
      }

      const t = e.target as HTMLElement | null;
      if (t?.id === 'pos-search-input') return;

      const tag = t?.tagName;
      if (tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (tag === 'INPUT') {
        const id = (t as HTMLInputElement).id;
        if (
          id.startsWith('cart-qty-') ||
          id.startsWith('line-price-') ||
          id === 'pos-discount-input' ||
          id === 'pos-customer-attach-input' ||
          id === 'checkout-service-charge-input' ||
          id === 'checkout-co-name' ||
          id === 'checkout-co-phone'
        )
          return;
      }

      const st = usePOSBillingStore.getState();
      const cart = st.cart;
      const sel = st.selectedLineId;

      if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && cart.length > 0) {
        e.preventDefault();
        const cur = sel ? cart.findIndex((l) => l.lineId === sel) : -1;
        const next =
          e.key === 'ArrowDown'
            ? cur < 0
              ? 0
              : Math.min(cart.length - 1, cur + 1)
            : cur <= 0
              ? 0
              : cur - 1;
        const line = cart[next];
        if (line) {
          st.setSelectedLine(line.lineId);
          window.requestAnimationFrame(() => document.getElementById(`cart-qty-${line.lineId}`)?.focus());
        }
        return;
      }

      if (e.key === 'Enter' && sel) {
        e.preventDefault();
        document.getElementById(`cart-qty-${sel}`)?.focus();
        return;
      }

      const lk = e.key.length === 1 ? e.key.toLowerCase() : '';
      if ((lk === 't' || lk === 'p') && sel && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        const line = cart.find((l) => l.lineId === sel);
        if (!line) return;
        if (lk === 't') {
          if (line.quantityMode === 'tablet') return;
          const r = st.setLineQuantityMode(sel, 'tablet');
          if (!r.ok) useToastStore.getState().show(r.message ?? 'Cannot switch to tablets.', 'error');
        } else {
          if (line.quantityMode === 'packet') return;
          const r = st.setLineQuantityMode(sel, 'packet');
          if (!r.ok) useToastStore.getState().show(r.message ?? 'Cannot switch to packets.', 'error');
        }
        return;
      }

      if (e.key === 'Delete' && sel) {
        e.preventDefault();
        st.removeLine(sel);
        return;
      }

      if (
        (e.key === '+' || e.key === '=' || e.key === '*' || e.code === 'NumpadAdd' || e.code === 'NumpadMultiply') &&
        sel
      ) {
        e.preventDefault();
        const r = st.bumpLineQuantity(sel, 1);
        if (!r.ok) useToastStore.getState().show(r.message ?? 'Unable to increase quantity', 'error');
        return;
      }
      if ((e.key === '-' || e.code === 'NumpadSubtract') && sel) {
        e.preventDefault();
        const r = st.bumpLineQuantity(sel, -1);
        if (!r.ok) useToastStore.getState().show(r.message ?? 'Unable to decrease quantity', 'error');
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [voidCart, openCheckoutFlow, shortcutsEnabled]);

  useEffect(() => {
    if (!guideOpen) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setGuideOpen(false);
    };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [guideOpen]);

  return (
    <div className="relative h-full min-h-0 bg-background">
      <ToastStack />
      <CheckoutFlowModal />
      <CustomerCreditAlertHost />
      {isSyncing ? (
        <div className="pointer-events-none absolute left-1/2 top-4 z-30 -translate-x-1/2 rounded-xl border border-primary/30 bg-background/95 px-3 py-1.5 text-xs font-semibold text-primary shadow">
          Syncing stock from local API...
        </div>
      ) : null}
      {syncError ? (
        <div className="pointer-events-none absolute left-1/2 top-14 z-30 -translate-x-1/2 rounded-xl border border-red-500/30 bg-background/95 px-3 py-1.5 text-xs font-semibold text-red-600 shadow">
          {syncError}
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setGuideOpen(true)}
        className="absolute right-5 top-5 z-20 inline-flex items-center gap-2 rounded-xl border border-slate-200/80 bg-white/95 px-3 py-2 text-xs font-semibold text-slate-700 shadow-md shadow-slate-900/[0.06] ring-1 ring-black/[0.03] backdrop-blur-md transition hover:bg-white dark:border-zinc-700 dark:bg-zinc-900/95 dark:text-zinc-200 dark:shadow-none dark:ring-white/[0.06] dark:hover:bg-zinc-800"
        aria-haspopup="dialog"
        aria-expanded={guideOpen}
      >
        <Keyboard className="h-4 w-4 text-primary" strokeWidth={2} />
        Shortcuts
      </button>

      {guideOpen ? (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 sm:p-6" role="dialog" aria-modal="true" aria-labelledby="pos-shortcuts-title">
          <button type="button" className="absolute inset-0 bg-slate-900/40 backdrop-blur-[4px]" onClick={() => setGuideOpen(false)} aria-label="Close shortcuts" />
          <div className="relative z-10 flex max-h-[min(90vh,640px)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-2xl shadow-slate-900/15 ring-1 ring-black/[0.04] dark:border-zinc-800 dark:bg-zinc-950 dark:shadow-black/40 dark:ring-white/[0.06]">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-zinc-800">
              <div>
                <h2 id="pos-shortcuts-title" className="text-lg font-bold text-slate-900 dark:text-white">
                  Keyboard shortcuts
                </h2>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-zinc-500">POS screen · faster checkout</p>
              </div>
              <button
                type="button"
                onClick={() => setGuideOpen(false)}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-800"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {!shortcutsEnabled ? (
              <p className={cn('border-b border-amber-200 bg-amber-50 px-5 py-2.5 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-100')}>
                Global shortcuts are turned off in Settings. You can still use keys inside the search field (arrows, Enter).
              </p>
            ) : null}
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-2">
              <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-slate-400 dark:text-zinc-500">Global</p>
              <ShortcutRow keys={<Kbd>F2</Kbd>} label="Focus medicine search" />
              <ShortcutRow keys={<Kbd>F3</Kbd>} label="Checkout — customer → charges → receipt" />
              <ShortcutRow
                keys={
                  <span className="flex flex-wrap items-center gap-1">
                    <Kbd>Shift</Kbd>
                    <Kbd>F4</Kbd>
                  </span>
                }
                label="Void cart (clears lines — shelf unchanged)"
              />

              <p className="mb-1 mt-4 text-[11px] font-bold uppercase tracking-wide text-slate-400 dark:text-zinc-500">Search (when search is focused)</p>
              <ShortcutRow keys={<Kbd>↑</Kbd>} label="Previous result" />
              <ShortcutRow keys={<Kbd>↓</Kbd>} label="Next result" />
              <ShortcutRow keys={<Kbd>Enter</Kbd>} label="Add highlighted medicine to cart" />

              <p className="mb-1 mt-4 text-[11px] font-bold uppercase tracking-wide text-slate-400 dark:text-zinc-500">Cart (when not typing in checkout fields)</p>
              <ShortcutRow
                keys={
                  <span className="flex flex-wrap items-center gap-1">
                    <Kbd>↑</Kbd>
                    <Kbd>↓</Kbd>
                  </span>
                }
                label="Move selection between lines"
              />
              <ShortcutRow keys={<Kbd>Tab</Kbd>} label="Jump between line quantity fields" />
              <ShortcutRow
                keys={
                  <span className="flex flex-wrap items-center gap-1">
                    <Kbd>T</Kbd>
                    <Kbd>P</Kbd>
                  </span>
                }
                label="Selected line: loose tablets (T) or full packs (P) when pack size is set"
              />
              <ShortcutRow keys={<Kbd>Enter</Kbd>} label="Focus quantity for selected line" />
              <ShortcutRow
                keys={
                  <span className="flex flex-wrap items-center gap-1">
                    <Kbd>*</Kbd>
                    <Kbd>+</Kbd>
                  </span>
                }
                label="Increase quantity"
              />
              <ShortcutRow keys={<Kbd>−</Kbd>} label="Decrease quantity" />
              <ShortcutRow keys={<Kbd>Del</Kbd>} label="Remove selected line" />

              <p className="mb-1 mt-4 text-[11px] font-bold uppercase tracking-wide text-slate-400 dark:text-zinc-500">
                Customer credit reminder (when open)
              </p>
              <ShortcutRow keys={<Kbd>Enter</Kbd>} label="Continue billing" />
              <ShortcutRow keys={<Kbd>D</Kbd>} label="View balance and recent invoices" />
              <ShortcutRow keys={<Kbd>Esc</Kbd>} label="Dismiss reminder (non-blocking)" />

              <p className="mb-1 mt-4 text-[11px] font-bold uppercase tracking-wide text-slate-400 dark:text-zinc-500">Add medicine</p>
              <ShortcutRow keys={<Kbd>Enter</Kbd>} label="Open quantity popup (then Enter to add, Esc to cancel)" />

              <p className="mb-1 mt-4 text-[11px] font-bold uppercase tracking-wide text-slate-400 dark:text-zinc-500">Checkout: customer</p>
              <ShortcutRow keys={<Kbd>Enter</Kbd>} label="On phone field — continue (match, new, or walk-in if empty)" />
              <ShortcutRow
                keys={
                  <span className="flex flex-wrap items-center gap-1">
                    <Kbd>↑</Kbd>
                    <Kbd>↓</Kbd>
                  </span>
                }
                label="Highlight matches (when list is shown)"
              />
              <ShortcutRow keys={<Kbd>Esc</Kbd>} label="Walk-in (no customer)" />
              <ShortcutRow
                keys={
                  <span className="flex flex-wrap items-center gap-1">
                    <Kbd>Shift</Kbd>
                    <Kbd>Esc</Kbd>
                  </span>
                }
                label="Cancel entire checkout"
              />

              <p className="mb-1 mt-4 text-[11px] font-bold uppercase tracking-wide text-slate-400 dark:text-zinc-500">Checkout: charges</p>
              <ShortcutRow keys={<Kbd>S</Kbd>} label="Skip service charge" />
              <ShortcutRow keys={<Kbd>B</Kbd>} label="Back to customer" />
              <ShortcutRow keys={<Kbd>Enter</Kbd>} label="Apply amount (or empty) and open receipt" />
              <ShortcutRow keys={<Kbd>Esc</Kbd>} label="Back to customer" />

              <p className="mb-1 mt-4 text-[11px] font-bold uppercase tracking-wide text-slate-400 dark:text-zinc-500">Checkout: receipt</p>
              <ShortcutRow keys={<Kbd>P</Kbd>} label="Print" />
              <ShortcutRow keys={<Kbd>S</Kbd>} label="Save PDF" />
              <ShortcutRow keys={<Kbd>Enter</Kbd>} label="Complete sale" />
              <ShortcutRow keys={<Kbd>Esc</Kbd>} label="Back to charges" />
            </div>
            <div className="border-t border-slate-100 px-5 py-3 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setGuideOpen(false)}
                className="w-full rounded-xl bg-slate-900 py-2.5 text-sm font-semibold text-white dark:bg-white dark:text-slate-900"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div
        className="h-full min-h-0 p-5 grid gap-5 [grid-template-columns:minmax(260px,3fr)_minmax(300px,4fr)_minmax(260px,3fr)]"
      >
        <section className={panel} aria-label="Product search">
          <ProductSearch />
        </section>

        <section className={panel} aria-label="Shopping cart">
          <Cart />
        </section>

        <section className={panel} aria-label="Checkout">
          <Checkout />
        </section>
      </div>
    </div>
  );
};

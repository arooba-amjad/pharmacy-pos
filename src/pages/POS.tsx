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
  const isSyncing = usePOSBillingStore((s) => s.isSyncing);
  const syncError = usePOSBillingStore((s) => s.syncError);
  const posPricingChannel = usePOSBillingStore((s) => s.posPricingChannel);
  const setPosPricingChannel = usePOSBillingStore((s) => s.setPosPricingChannel);
  const shortcutsEnabled = useSettingsStore((s) => s.keyboardShortcutsEnabled);
  const [guideOpen, setGuideOpen] = useState(false);

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
          if (!r.ok) useToastStore.getState().show(r.message ?? 'Cannot switch to loose units.', 'error');
        } else {
          if (line.quantityMode === 'packet') return;
          const r = st.setLineQuantityMode(sel, 'packet');
          if (!r.ok) useToastStore.getState().show(r.message ?? 'Cannot switch to packs.', 'error');
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
    <div className="relative flex h-full min-h-0 flex-col bg-background">
      <ToastStack />
      <CheckoutFlowModal />
      <CustomerCreditAlertHost />

      {/* Sync/error notice — flow element so it never overlaps the cart header. */}
      {(isSyncing || syncError) ? (
        <div className="flex shrink-0 flex-col gap-1 px-3 pt-2 sm:px-4 xl:px-5">
          {isSyncing ? (
            <div className="self-start rounded-xl border border-primary/30 bg-background/95 px-3 py-1.5 text-[11px] font-semibold text-primary shadow-sm">
              Syncing stock from local API...
            </div>
          ) : null}
          {syncError ? (
            <div className="self-start max-w-full truncate rounded-xl border border-red-500/30 bg-background/95 px-3 py-1.5 text-[11px] font-semibold text-red-600 shadow-sm">
              {syncError}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 px-3 pb-2 pt-3 sm:gap-3 sm:px-4 sm:pt-4 xl:px-5">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 sm:gap-3">
          <span className="hidden text-[10px] font-bold uppercase tracking-wide text-muted-foreground sm:inline">
            Sale type
          </span>
          <div className="inline-flex rounded-xl border border-border/80 bg-muted/40 p-1 dark:border-border/60">
            <button
              type="button"
              onClick={() => setPosPricingChannel('retail')}
              className={cn(
                'rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition sm:px-3 sm:py-2 sm:text-xs',
                posPricingChannel === 'retail'
                  ? 'bg-card text-foreground shadow-sm ring-1 ring-border/60'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Retail
            </button>
            <button
              type="button"
              onClick={() => setPosPricingChannel('wholesale')}
              className={cn(
                'rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition sm:px-3 sm:py-2 sm:text-xs',
                posPricingChannel === 'wholesale'
                  ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/25'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <span className="sm:hidden">Wholesale</span>
              <span className="hidden sm:inline">Wholesale / bulk</span>
            </button>
          </div>
          <p className="hidden max-w-full basis-full text-[10px] leading-snug text-muted-foreground md:block md:basis-auto md:max-w-xs xl:max-w-sm">
            {posPricingChannel === 'retail'
              ? 'Shelf prices only — price column is read-only.'
              : 'Optional price when adding a medicine; cart prices editable.'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setGuideOpen(true)}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-200/80 bg-white/95 px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 shadow-md shadow-slate-900/[0.06] ring-1 ring-black/[0.03] backdrop-blur-md transition hover:bg-white sm:gap-2 sm:px-3 sm:py-2 sm:text-xs dark:border-zinc-700 dark:bg-zinc-900/95 dark:text-zinc-200 dark:shadow-none dark:ring-white/[0.06] dark:hover:bg-zinc-800"
          aria-haspopup="dialog"
          aria-expanded={guideOpen}
          title="Keyboard shortcuts"
        >
          <Keyboard className="h-3.5 w-3.5 text-primary sm:h-4 sm:w-4" strokeWidth={2} />
          <span className="hidden sm:inline">Shortcuts</span>
        </button>
      </div>

      {guideOpen ? (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-3 sm:p-4 md:p-6" role="dialog" aria-modal="true" aria-labelledby="pos-shortcuts-title">
          <button type="button" className="absolute inset-0 bg-slate-900/40 backdrop-blur-[4px]" onClick={() => setGuideOpen(false)} aria-label="Close shortcuts" />
          <div className="relative z-10 flex max-h-[min(90dvh,640px)] w-full max-w-[min(calc(100vw-1.5rem),32rem)] flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-2xl shadow-slate-900/15 ring-1 ring-black/[0.04] dark:border-zinc-800 dark:bg-zinc-950 dark:shadow-black/40 dark:ring-white/[0.06]">
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
                label="Selected line: loose units (T) or commercial packs (P) when pack size ≥ 2"
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
        className={cn(
          'grid min-h-0 flex-1 gap-3 p-2.5 pt-2 sm:gap-4 sm:p-4 xl:gap-5 xl:p-5 xl:pt-2',
          /* Mobile / tiny laptop: stack — equal vertical thirds */
          'grid-cols-1 max-md:[grid-template-rows:minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]',
          /* Tablet / standard laptop: search left full-height, cart + checkout stacked right */
          'md:grid-cols-2 md:[grid-template-rows:minmax(0,1fr)_minmax(0,1fr)]',
          /* Wide desktop: three fluid columns that scale on large / ultrawide monitors */
          'xl:grid-cols-[minmax(0,1fr)_minmax(0,1.28fr)_minmax(0,1fr)] xl:grid-rows-1',
          '2xl:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)_minmax(0,1fr)]'
        )}
      >
        <section className={cn(panel, 'min-h-0 md:row-span-2 xl:row-span-1')} aria-label="Product search">
          <ProductSearch />
        </section>

        <section
          className={cn(panel, 'min-h-0 md:col-start-2 md:row-start-1 xl:col-auto xl:row-auto')}
          aria-label="Shopping cart"
        >
          <Cart />
        </section>

        <section
          className={cn(panel, 'min-h-0 md:col-start-2 md:row-start-2 xl:col-auto xl:row-auto')}
          aria-label="Checkout"
        >
          <Checkout />
        </section>
      </div>
    </div>
  );
};

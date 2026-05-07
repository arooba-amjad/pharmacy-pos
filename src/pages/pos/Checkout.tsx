import React, { useEffect, useMemo, useState } from 'react';
import { CreditCard, Banknote, HandCoins, Percent, ReceiptText, Sparkles, Wallet, X } from 'lucide-react';
import { usePOSBillingStore } from '@/store/usePOSBillingStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useToastStore } from '@/store/useToastStore';
import { cn, formatCurrency } from '@/lib/utils';
import { CustomerCreditBalanceStrip } from '@/components/pos/CustomerCreditBalanceStrip';
import { PayDuesModal } from '@/components/pos/PayDuesModal';
import { customerHasOutstandingCredit } from '@/lib/customerCreditAlerts';
import { motion } from 'framer-motion';

function paymentTileClass(active: boolean) {
  return cn(
    'flex flex-col items-center gap-1 rounded-xl border-2 py-2.5 px-1 transition active:scale-[0.98]',
    active
      ? 'border-primary bg-primary text-primary-foreground shadow-md shadow-primary/30'
      : 'border-border/80 bg-card text-foreground shadow-sm hover:border-primary/45 hover:bg-muted/50 dark:border-border dark:bg-card/95 dark:hover:bg-muted/30'
  );
}

export const Checkout: React.FC = () => {
  const cart = usePOSBillingStore((s) => s.cart);
  const customers = usePOSBillingStore((s) => s.customers);
  const customer = usePOSBillingStore((s) => s.customer);
  const setCustomer = usePOSBillingStore((s) => s.setCustomer);
  const discount = usePOSBillingStore((s) => s.discount);
  const discountType = usePOSBillingStore((s) => s.discountType);
  const setDiscount = usePOSBillingStore((s) => s.setDiscount);
  const paymentMethod = usePOSBillingStore((s) => s.paymentMethod);
  const setPaymentMethod = usePOSBillingStore((s) => s.setPaymentMethod);
  const getTotals = usePOSBillingStore((s) => s.getTotals);
  const openCheckoutFlow = usePOSBillingStore((s) => s.openCheckoutFlow);
  const checkoutFlowOpen = usePOSBillingStore((s) => s.checkoutFlowStep !== null);

  const showToast = useToastStore((s) => s.show);
  const taxPercent = useSettingsStore((s) => s.taxPercent);
  const recordCustomerBalancePayment = usePOSBillingStore((s) => s.recordCustomerBalancePayment);

  const { subtotal, discountAmt, serviceTotal, tax, total } = getTotals();
  const [payDuesOpen, setPayDuesOpen] = useState(false);
  const [attachQuery, setAttachQuery] = useState('');
  const hasPriorBalance = Boolean(customer && customerHasOutstandingCredit(customer));

  const attachMatches = useMemo(() => {
    const q = attachQuery.trim().toLowerCase();
    const norm = (p: string) => p.replace(/\s/g, '').toLowerCase();
    const list = !q
      ? [...customers].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
      : customers.filter(
          (c) =>
            c.name.toLowerCase().includes(q) ||
            c.phone.toLowerCase().includes(q) ||
            norm(c.phone).includes(norm(attachQuery))
        );
    return list.slice(0, 10);
  }, [customers, attachQuery]);

  useEffect(() => {
    if (!customer && paymentMethod === 'credit') setPaymentMethod('cash');
  }, [customer, paymentMethod, setPaymentMethod]);

  useEffect(() => {
    if (customer) setAttachQuery('');
  }, [customer]);

  const handleCheckout = () => {
    const r = openCheckoutFlow();
    if (!r.ok) showToast(r.message ?? 'Unable to start checkout.', 'error');
  };

  return (
    <div
      data-no-pos-nav
      className="flex flex-col h-full min-h-0 gap-3 p-3 sm:p-4 overflow-y-auto custom-scrollbar bg-transparent"
    >
      <div className="rounded-[20px] border border-slate-200/90 bg-white/90 p-4 shadow-sm dark:border-border/50 dark:bg-card/30 shrink-0">
        <p className="text-sm font-semibold text-foreground">Ready to close the sale?</p>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Press{' '}
          <kbd className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-xs font-bold text-slate-800 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100">
            F3
          </kbd>{' '}
          or use <span className="font-semibold text-foreground">Checkout</span> below — customer, optional charges, and
          receipt all happen in the dialog.
        </p>
        {!customer ? (
          <div className="mt-3 space-y-2 rounded-xl border border-dashed border-primary/35 bg-primary/[0.05] p-3 dark:border-primary/30 dark:bg-primary/10">
            <div>
              <p className="text-xs font-bold text-foreground">Attach customer</p>
              <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                Needed for <span className="font-semibold text-foreground/90">credit</span> and{' '}
                <span className="font-semibold text-foreground/90">Pay dues</span> on this lane. Optional for cash/card.
              </p>
            </div>
            <input
              id="pos-customer-attach-input"
              type="text"
              value={attachQuery}
              onChange={(e) => setAttachQuery(e.target.value)}
              placeholder="Search name or phone…"
              autoComplete="off"
              spellCheck={false}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none ring-primary/25 focus:ring-2 dark:bg-card/80"
            />
            {attachMatches.length > 0 ? (
              <ul className="custom-scrollbar max-h-40 overflow-y-auto rounded-lg border border-border/70 bg-card text-sm shadow-sm">
                {attachMatches.map((c) => (
                  <li key={c.id} className="border-b border-border/50 last:border-0">
                    <button
                      type="button"
                      className="flex w-full flex-col gap-0.5 px-3 py-2 text-left transition hover:bg-muted/60 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
                      onClick={() => {
                        setCustomer(c);
                        setAttachQuery('');
                      }}
                    >
                      <span className="min-w-0 truncate font-semibold text-foreground">{c.name}</span>
                      <div className="flex shrink-0 flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span className="text-xs text-muted-foreground">{c.phone}</span>
                        {c.balance > 0.001 ? (
                          <span className="text-[10px] font-bold tabular-nums text-amber-800 dark:text-amber-200">
                            {formatCurrency(c.balance)}
                          </span>
                        ) : null}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            ) : attachQuery.trim().length > 0 ? (
              <p className="text-[11px] text-muted-foreground">No match. Add customers under Revenue → Customers.</p>
            ) : null}
          </div>
        ) : (
          <div className="mt-3 space-y-2">
            <div className="flex items-start justify-between gap-2 rounded-xl border border-primary/20 bg-primary/[0.06] px-3 py-2.5">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wide text-primary/90">Customer on file</p>
                <p className="truncate text-sm font-bold leading-tight">{customer.name}</p>
                <p className="truncate text-xs text-muted-foreground">{customer.phone}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setCustomer(null);
                  setAttachQuery('');
                }}
                className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition"
                aria-label="Clear customer before checkout"
                title="Clear attached customer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {customerHasOutstandingCredit(customer) ? (
              <CustomerCreditBalanceStrip customer={customer} compact />
            ) : null}
          </div>
        )}
      </div>

      <div className="rounded-[20px] border border-slate-200/90 bg-white/90 p-3 shadow-sm dark:border-border/50 dark:bg-card/30 shrink-0">
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2 px-0.5">Payment</p>
        {customer ? (
          <div className="mb-3 space-y-1 rounded-xl border border-border/60 bg-muted/25 px-3 py-2 text-[11px] dark:bg-muted/15">
            <div className="flex items-center justify-between gap-2 font-semibold">
              <span className="text-muted-foreground">Current bill</span>
              <span className="tabular-nums text-foreground">{formatCurrency(total)}</span>
            </div>
            {customer.balance > 0.001 ? (
              <div className="flex items-center justify-between gap-2 font-semibold text-amber-900 dark:text-amber-100">
                <span>Previous balance</span>
                <span className="tabular-nums">{formatCurrency(customer.balance)}</span>
              </div>
            ) : (
              <p className="text-[10px] font-medium text-muted-foreground">No prior balance on file.</p>
            )}
          </div>
        ) : null}
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              { id: 'cash' as const, label: 'Cash', Icon: Banknote },
              { id: 'card' as const, label: 'Card', Icon: CreditCard },
            ] as const
          ).map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setPaymentMethod(id)}
              className={paymentTileClass(paymentMethod === id)}
            >
              <Icon className="w-5 h-5" strokeWidth={2} />
              <span className="font-bold text-[10px] uppercase tracking-wide">{label}</span>
            </button>
          ))}
          {customer ? (
            <>
              <button
                type="button"
                onClick={() => setPaymentMethod('credit')}
                className={cn(paymentTileClass(paymentMethod === 'credit'), !hasPriorBalance && 'col-span-2')}
              >
                <Wallet className="w-5 h-5" strokeWidth={2} />
                <span className="font-bold text-[10px] uppercase tracking-wide">Credit</span>
              </button>
              {hasPriorBalance ? (
                <button
                  type="button"
                  onClick={() => setPayDuesOpen(true)}
                  className="flex flex-col items-center justify-center gap-1 rounded-xl border border-amber-300/80 bg-amber-500/10 py-2.5 px-1 transition hover:bg-amber-500/15 active:scale-[0.98] dark:border-amber-800/50 dark:bg-amber-950/35 dark:hover:bg-amber-950/50"
                  title="Record a payment toward this customer’s prior balance"
                >
                  <HandCoins className="w-5 h-5 text-amber-800 dark:text-amber-200" strokeWidth={2} />
                  <span className="font-bold text-[10px] uppercase tracking-wide text-amber-950 dark:text-amber-50">
                    Pay dues
                  </span>
                </button>
              ) : null}
            </>
          ) : null}
        </div>
      </div>

      {customer && payDuesOpen ? (
        <PayDuesModal
          open={payDuesOpen}
          previousBalance={customer.balance}
          currentBill={0}
          onClose={() => setPayDuesOpen(false)}
          onConfirm={async (amt) => (await recordCustomerBalancePayment(customer.id, amt)).ok}
        />
      ) : null}

      <div className="flex-1 min-h-[220px] rounded-[20px] border border-slate-200/90 bg-gradient-to-b from-white to-slate-50/90 p-5 shadow-sm dark:border-border/50 dark:from-card/50 dark:to-card/25 flex flex-col relative overflow-hidden">
        <div className="absolute top-2 right-2 opacity-[0.07] text-foreground pointer-events-none">
          <ReceiptText className="w-24 h-24" strokeWidth={1} />
        </div>

        <div className="space-y-3 relative z-10">
          <div className="flex justify-between items-center text-muted-foreground">
            <span className="text-sm font-medium">Subtotal</span>
            <span className="font-mono font-semibold tabular-nums">{formatCurrency(subtotal)}</span>
          </div>

          <div className="rounded-xl border border-slate-200/80 bg-white/70 p-3 dark:border-border/50 dark:bg-card/30">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Percent className="w-3.5 h-3.5 text-primary" />
                <span className="text-sm font-medium">Discount</span>
              </div>
              <div className="flex rounded-lg border border-border/80 p-0.5 bg-muted/30">
                <button
                  type="button"
                  onClick={() => setDiscount(discount, 'percentage')}
                  className={cn(
                    'px-2 py-1 text-[10px] font-bold rounded-md transition',
                    discountType === 'percentage' ? 'bg-background shadow-sm' : 'text-muted-foreground'
                  )}
                >
                  %
                </button>
                <button
                  type="button"
                  onClick={() => setDiscount(discount, 'fixed')}
                  className={cn(
                    'px-2 py-1 text-[10px] font-bold rounded-md transition',
                    discountType === 'fixed' ? 'bg-background shadow-sm' : 'text-muted-foreground'
                  )}
                >
                  Flat
                </button>
              </div>
            </div>
            <input
              id="pos-discount-input"
              type="number"
              min={0}
              step={discountType === 'percentage' ? 0.5 : 1}
              max={discountType === 'percentage' ? 100 : undefined}
              value={discount}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                setDiscount(Number.isFinite(v) ? Math.max(0, v) : 0, discountType);
              }}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/20 dark:bg-card/50"
            />
            <p className="text-[10px] text-muted-foreground mt-1.5">
              {discountType === 'percentage' ? 'Percent off subtotal (max 100%).' : 'Fixed amount off subtotal.'}
            </p>
            <div className="mt-2 flex justify-between items-center text-xs font-semibold text-orange-600 dark:text-orange-400">
              <span className="text-muted-foreground font-medium">Applied</span>
              <span className="font-mono tabular-nums">−{formatCurrency(discountAmt)}</span>
            </div>
          </div>

          {serviceTotal > 0 && (
            <div className="flex justify-between items-center text-primary font-semibold">
              <span className="text-sm">Service charges</span>
              <span className="font-mono tabular-nums">{formatCurrency(serviceTotal)}</span>
            </div>
          )}

          <div className="flex justify-between items-center text-muted-foreground">
            <span className="text-sm font-medium">Tax ({taxPercent}%)</span>
            <span className="font-mono font-semibold tabular-nums">{formatCurrency(tax)}</span>
          </div>

          <div className="h-px bg-border/60 my-1" />

          <div className="flex justify-between items-end gap-3 pt-1">
            <div className="min-w-0">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-1">
                Grand total
              </span>
              <span className="text-4xl font-black tracking-tighter text-primary tabular-nums leading-none">
                {formatCurrency(total)}
              </span>
            </div>
            <Sparkles className="text-primary/25 w-8 h-8 mb-1 shrink-0" strokeWidth={1.5} />
          </div>
        </div>

        <motion.button
          id="checkout-btn"
          type="button"
          disabled={cart.length === 0 || checkoutFlowOpen}
          onClick={handleCheckout}
          whileTap={cart.length && !checkoutFlowOpen ? { scale: 0.985 } : {}}
          className={cn(
            'mt-5 w-full rounded-[20px] py-4 text-base font-black uppercase tracking-wide transition relative overflow-hidden',
            'shadow-[0_12px_40px_-12px_rgba(13,148,136,0.55)]',
            cart.length > 0 && !checkoutFlowOpen
              ? 'bg-primary text-primary-foreground hover:brightness-[1.03]'
              : 'bg-muted text-muted-foreground cursor-not-allowed shadow-none'
          )}
        >
          <span className="relative z-10">Checkout (F3)</span>
          {cart.length > 0 && (
            <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/10 to-transparent opacity-40" />
          )}
        </motion.button>
      </div>
    </div>
  );
};

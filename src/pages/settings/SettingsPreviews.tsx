import { ImageIcon, User } from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import type { ReceiptFormat } from '@/store/useSettingsStore';

export function IdentityReceiptStrip({
  name,
  address,
  phone,
}: {
  name: string;
  address: string;
  phone: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200/90 bg-white p-4 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-950/80">
      <p className="text-sm font-bold text-slate-900 dark:text-white">{name || 'Your pharmacy name'}</p>
      <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">{address || 'Address appears here'}</p>
      <p className="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">{phone || 'Phone'}</p>
      <p className="mt-3 border-t border-dashed border-slate-200 pt-3 text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:border-zinc-800 dark:text-zinc-500">
        How it appears on receipt
      </p>
    </div>
  );
}

export function BillPreviewCard({
  taxPercent,
  defaultDiscountEnabled,
  defaultDiscountPercent,
  serviceChargesEnabled,
  serviceChargeDefaultDelivery,
}: {
  taxPercent: number;
  defaultDiscountEnabled: boolean;
  defaultDiscountPercent: number;
  serviceChargesEnabled: boolean;
  serviceChargeDefaultDelivery: number;
}) {
  const subtotal = 1250;
  const discountAmt = defaultDiscountEnabled
    ? Math.min(subtotal, Math.round(subtotal * (Math.min(100, defaultDiscountPercent) / 100) * 100) / 100)
    : 0;
  const afterDisc = Math.max(0, subtotal - discountAmt);
  const delivery =
    serviceChargesEnabled && serviceChargeDefaultDelivery > 0
      ? Math.round(serviceChargeDefaultDelivery * 100) / 100
      : 0;
  const taxable = afterDisc + delivery;
  const tax = Math.round(taxable * (Math.max(0, taxPercent) / 100) * 100) / 100;
  const total = Math.round((taxable + tax) * 100) / 100;

  return (
    <div className="rounded-2xl border border-slate-200/90 bg-gradient-to-b from-white to-slate-50/80 p-4 shadow-sm dark:border-zinc-800 dark:from-zinc-950 dark:to-zinc-900/80">
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 dark:text-zinc-500">Sample bill</p>
      <div className="mt-3 space-y-2 text-sm text-slate-700 dark:text-zinc-200">
        <div className="flex justify-between">
          <span>Items</span>
          <span className="tabular-nums font-medium">{formatCurrency(subtotal)}</span>
        </div>
        <div className="flex justify-between text-slate-500 dark:text-zinc-400">
          <span>Discount</span>
          <span className="tabular-nums">−{formatCurrency(discountAmt)}</span>
        </div>
        {delivery > 0 ? (
          <div className="flex justify-between text-slate-500 dark:text-zinc-400">
            <span>Delivery (default)</span>
            <span className="tabular-nums">{formatCurrency(delivery)}</span>
          </div>
        ) : (
          <p className="text-xs text-slate-400 dark:text-zinc-500">No default delivery charge</p>
        )}
        <div className="flex justify-between border-t border-slate-200 pt-2 dark:border-zinc-800">
          <span>Tax ({taxPercent}%)</span>
          <span className="tabular-nums font-medium">{formatCurrency(tax)}</span>
        </div>
        <div className="flex justify-between text-base font-bold text-slate-900 dark:text-white">
          <span>Total</span>
          <span className="tabular-nums text-primary">{formatCurrency(total)}</span>
        </div>
      </div>
    </div>
  );
}

export function ReceiptPreviewCard({
  name,
  address,
  phone,
  format,
  showLogo,
  showCustomer,
}: {
  name: string;
  address: string;
  phone: string;
  format: ReceiptFormat;
  showLogo: boolean;
  showCustomer: boolean;
}) {
  const narrow = format === 'thermal';

  return (
    <div
      className={cn(
        'mx-auto rounded-2xl border border-slate-200/90 bg-white font-mono text-[11px] leading-relaxed text-slate-800 shadow-md dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100',
        narrow ? 'max-w-[220px] px-3 py-4' : 'max-w-md px-6 py-5'
      )}
    >
      {showLogo ? (
        <div className="mb-3 flex justify-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-400 dark:bg-zinc-800 dark:text-zinc-500">
            <ImageIcon className="h-6 w-6" strokeWidth={1.5} />
          </div>
        </div>
      ) : null}
      <p className={cn('text-center font-bold text-slate-900 dark:text-white', narrow ? 'text-xs' : 'text-sm')}>
        {name || 'Pharmacy'}
      </p>
      <p className="mt-1 text-center text-slate-500 dark:text-zinc-400">{address}</p>
      <p className="text-center text-slate-500 dark:text-zinc-400">{phone}</p>
      <div className="my-3 border-t border-dashed border-slate-300 dark:border-zinc-700" />
      <div className="flex justify-between text-slate-500 dark:text-zinc-400">
        <span>#INV-0001</span>
        <span>{new Date().toLocaleDateString()}</span>
      </div>
      {showCustomer ? (
        <div className="mt-2 flex items-start gap-1.5 text-slate-600 dark:text-zinc-300">
          <User className="mt-0.5 h-3 w-3 shrink-0 opacity-70" />
          <span>Walk-in customer</span>
        </div>
      ) : (
        <p className="mt-2 text-[10px] italic text-slate-400 dark:text-zinc-600">Customer hidden on receipt</p>
      )}
      <div className="my-3 border-t border-dashed border-slate-300 dark:border-zinc-700" />
      <div className="flex justify-between">
        <span>Amoxicillin</span>
        <span className="tabular-nums">{formatCurrency(180)}</span>
      </div>
      <div className="mt-2 flex justify-between text-xs font-semibold text-slate-900 dark:text-white">
        <span>TOTAL</span>
        <span className="tabular-nums text-primary">{formatCurrency(189)}</span>
      </div>
      <p className="mt-3 text-center text-[9px] text-slate-400 dark:text-zinc-600">
        {narrow ? 'Thermal 80mm preview' : 'A4 invoice style'}
      </p>
    </div>
  );
}

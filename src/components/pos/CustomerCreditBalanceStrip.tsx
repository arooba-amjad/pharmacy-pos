import React from 'react';
import { AlertCircle } from 'lucide-react';
import type { Customer } from '@/types';
import { formatCurrency, cn } from '@/lib/utils';
import { customerHasOutstandingCredit } from '@/lib/customerCreditAlerts';

export const POS_OPEN_CUSTOMER_CREDIT_DETAILS = 'pharmacy-pos-open-customer-credit-details';

export function openCustomerCreditDetailsFromStrip(): void {
  window.dispatchEvent(new CustomEvent(POS_OPEN_CUSTOMER_CREDIT_DETAILS));
}

interface CustomerCreditBalanceStripProps {
  customer: Customer;
  /** Tighter padding for cart header */
  compact?: boolean;
  className?: string;
}

export const CustomerCreditBalanceStrip: React.FC<CustomerCreditBalanceStripProps> = ({
  customer,
  compact,
  className,
}) => {
  if (!customerHasOutstandingCredit(customer)) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-red-200/80 bg-red-500/[0.08] px-3 py-2 text-left text-red-950 shadow-sm dark:border-red-900/45 dark:bg-red-950/25 dark:text-red-50',
        compact ? 'py-1.5 text-[12px]' : 'text-sm',
        className
      )}
    >
      <div className="flex min-w-0 flex-1 items-start gap-2">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-400" aria-hidden />
        <p className="min-w-0 font-semibold leading-snug">
          Customer has outstanding balance:{' '}
          <span className="whitespace-nowrap tabular-nums font-black">{formatCurrency(customer.balance)}</span>
        </p>
      </div>
      <button
        type="button"
        onClick={openCustomerCreditDetailsFromStrip}
        className="shrink-0 rounded-lg border border-red-300/60 bg-white/90 px-2.5 py-1 text-[11px] font-bold text-red-900 transition hover:bg-white dark:border-red-800/60 dark:bg-red-950/40 dark:text-red-100 dark:hover:bg-red-900/50"
      >
        View details
        <span className="ml-1 font-mono text-[10px] font-semibold opacity-80">D</span>
      </button>
    </div>
  );
};

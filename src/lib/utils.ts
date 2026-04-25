import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const APP_LOCALE = 'en-PK';
const APP_CURRENCY = 'PKR';

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat(APP_LOCALE, {
    style: 'currency',
    currency: APP_CURRENCY,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

/** Compact PKR label for chart axes (e.g. Rs12K). */
export function formatCurrencyChartTick(value: number) {
  return new Intl.NumberFormat(APP_LOCALE, {
    style: 'currency',
    currency: APP_CURRENCY,
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

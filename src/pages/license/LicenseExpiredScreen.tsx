import React from 'react';
import { AlertTriangle, RefreshCcw } from 'lucide-react';

type Props = {
  status: 'expired' | 'inactive';
  expiresAt?: string;
  daysRemaining?: number;
  message?: string;
  onRetry: () => void;
  isRetrying?: boolean;
};

export const LicenseExpiredScreen: React.FC<Props> = ({
  status,
  expiresAt,
  daysRemaining,
  message,
  onRetry,
  isRetrying = false,
}) => {
  const title = status === 'expired' ? 'License Expired' : 'Access Suspended';
  const expiredDays = typeof daysRemaining === 'number' && daysRemaining < 0 ? Math.abs(daysRemaining) : 0;

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4 dark:bg-zinc-950">
      <div className="w-full max-w-lg rounded-2xl border border-red-200 bg-white p-6 shadow-sm dark:border-red-900/40 dark:bg-zinc-900">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <h1 className="mt-4 text-2xl font-black text-slate-900 dark:text-white">{title}</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-zinc-400">
          {message || 'This installation needs a valid license to continue.'}
        </p>

        <div className="mt-4 space-y-1 text-sm text-slate-700 dark:text-zinc-300">
          <p>
            <span className="font-semibold">Expiry Date:</span> {expiresAt ? new Date(expiresAt).toLocaleDateString() : 'N/A'}
          </p>
          <p>
            <span className="font-semibold">Days Passed:</span> {expiredDays}
          </p>
        </div>

        <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
          Contact Pharmacy POS Support: <span className="font-bold">+92-313-6625199</span>
        </div>

        <button
          type="button"
          onClick={onRetry}
          disabled={isRetrying}
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 disabled:opacity-70"
        >
          <RefreshCcw className={`h-4 w-4 ${isRetrying ? 'animate-spin' : ''}`} />
          Retry
        </button>
      </div>
    </div>
  );
};


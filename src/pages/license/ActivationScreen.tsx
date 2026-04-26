import React, { useState } from 'react';
import { KeyRound, Loader2, Store } from 'lucide-react';

type Props = {
  onActivated: () => void;
};

export const ActivationScreen: React.FC<Props> = ({ onActivated }) => {
  const [shopId, setShopId] = useState('');
  const [activationKey, setActivationKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!window.api?.license) {
      setError('Desktop license API is unavailable.');
      return;
    }
    setIsLoading(true);
    try {
      const result = await window.api.license.activate(shopId.trim(), activationKey.trim());
      if (!result.isValid) {
        setError(result.message || 'Activation failed.');
        return;
      }
      onActivated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Activation failed.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4 dark:bg-zinc-950">
      <form
        onSubmit={submit}
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
      >
        <h1 className="text-2xl font-black text-slate-900 dark:text-white">Pharmacy POS</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-zinc-400">Activate License</p>

        <label className="mt-6 block text-xs font-bold uppercase tracking-wide text-slate-500">
          Shop ID
          <div className="relative mt-1.5">
            <Store className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={shopId}
              onChange={(e) => setShopId(e.target.value)}
              className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-3 text-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"
              placeholder="SHOP-003"
            />
          </div>
        </label>

        <label className="mt-4 block text-xs font-bold uppercase tracking-wide text-slate-500">
          Activation Key
          <div className="relative mt-1.5">
            <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={activationKey}
              onChange={(e) => setActivationKey(e.target.value)}
              className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-3 text-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"
              placeholder="Enter activation key"
            />
          </div>
        </label>

        {error ? (
          <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-200">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={isLoading}
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-70"
        >
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {isLoading ? 'Activating...' : 'Activate'}
        </button>
      </form>
    </div>
  );
};


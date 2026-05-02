import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, WifiOff } from 'lucide-react';
import { ActivationScreen } from '@/pages/license/ActivationScreen';
import { LicenseExpiredScreen } from '@/pages/license/LicenseExpiredScreen';
import { useAuthStore } from '@/store/useAuthStore';

type Props = {
  children: React.ReactNode;
};

type GateState =
  | { phase: 'loading' }
  | { phase: 'activation' }
  | { phase: 'blocked'; status: 'expired' | 'inactive'; result: LicenseCheckResponse }
  | { phase: 'ready'; offlineMessage?: string };

export const LicenseCheckWrapper: React.FC<Props> = ({ children }) => {
  const [gate, setGate] = useState<GateState>({ phase: 'loading' });
  const [retrying, setRetrying] = useState(false);
  const [showOfflineBanner, setShowOfflineBanner] = useState(false);

  const runCheck = useCallback(async () => {
    if (!window.api?.license) {
      setGate({
        phase: 'blocked',
        status: 'inactive',
        result: {
          isValid: false,
          status: 'inactive',
          expiresAt: '',
          clientName: '',
          daysRemaining: 0,
          message: 'License bridge is unavailable.',
        },
      });
      return;
    }

    const isActivated = await window.api.license.isActivated();
    if (!isActivated) {
      setGate({ phase: 'activation' });
      return;
    }

    const result = await window.api.license.check();
    if (!result.isValid) {
      setGate({ phase: 'blocked', status: result.status === 'expired' ? 'expired' : 'inactive', result });
      return;
    }

    // Keep compatibility with existing AuthGate flow, but license truth now comes from main process.
    useAuthStore.setState({ licenseActivated: true });
    setGate({
      phase: 'ready',
      offlineMessage: result.offlineMode ? 'Offline mode: license validated from recent successful check.' : undefined,
    });
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => {
      void runCheck();
    }, 0);
    return () => window.clearTimeout(id);
  }, [runCheck]);

  useEffect(() => {
    if (gate.phase !== 'ready' || !gate.offlineMessage) {
      setShowOfflineBanner(false);
      return;
    }
    setShowOfflineBanner(true);
    const timer = window.setTimeout(() => {
      setShowOfflineBanner(false);
    }, 5000);
    return () => window.clearTimeout(timer);
  }, [gate]);

  const loadingView = useMemo(
    () => (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 dark:bg-zinc-950">
        <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
          <Loader2 className="h-4 w-4 animate-spin" />
          Validating license...
        </div>
      </div>
    ),
    []
  );

  if (gate.phase === 'loading') return loadingView;
  if (gate.phase === 'activation') return <ActivationScreen onActivated={() => void runCheck()} />;
  if (gate.phase === 'blocked') {
    return (
      <LicenseExpiredScreen
        status={gate.status}
        expiresAt={gate.result.expiresAt}
        daysRemaining={gate.result.daysRemaining}
        message={gate.result.message}
        onRetry={async () => {
          setRetrying(true);
          try {
            await runCheck();
          } finally {
            setRetrying(false);
          }
        }}
        isRetrying={retrying}
      />
    );
  }

  return (
    <>
      {gate.offlineMessage && showOfflineBanner ? (
        <div className="fixed left-4 right-4 top-14 z-[70] inline-flex items-center justify-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100">
          <WifiOff className="h-3.5 w-3.5" />
          {gate.offlineMessage}
        </div>
      ) : null}
      {children}
    </>
  );
};


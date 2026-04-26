import React, { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAppStore } from '@/store/useAppStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { applyThemeToDocument } from '@/lib/themeStorage';
import { TitleBar } from '@/components/TitleBar';
import { Sidebar } from '@/components/Sidebar';
import { POS } from '@/pages/POS';
import { Inventory } from '@/pages/Inventory';
import { Medicines } from '@/pages/Medicines';
import { Dashboard } from '@/pages/Dashboard';
import { Reports } from '@/pages/Reports';
import { SalesHistory } from '@/pages/SalesHistory';
import { Returns } from '@/pages/Returns';
import { Customers } from '@/pages/Customers';
import { Purchases } from '@/pages/Purchases';
import { Suppliers } from '@/pages/Suppliers';
import { Settings } from '@/pages/Settings';
import { AuthGate } from '@/components/AuthGate';
import { useAuthStore } from '@/store/useAuthStore';
import { usePOSBillingStore } from '@/store/usePOSBillingStore';
import { cn } from '@/lib/utils';

function applyPrimaryTheme(hex: string) {
  const root = document.documentElement;
  root.style.setProperty('--primary', hex);
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  if (full.length !== 6) return;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  root.style.setProperty('--primary-foreground', yiq > 165 ? '#0f172a' : '#f8fafc');
}

const PlaceholderScreen: React.FC<{ name: string }> = ({ name }) => (
  <div className="mx-5 my-5 flex flex-1 flex-col items-center justify-center rounded-3xl border border-border/70 bg-card/95 p-10 shadow-[0_20px_50px_-24px_rgba(15,23,42,0.12)] ring-1 ring-black/[0.02] backdrop-blur-sm dark:border-border/50 dark:bg-card/40 dark:shadow-none dark:ring-white/[0.04]">
    <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 via-primary/10 to-teal-400/15 shadow-inner ring-1 ring-primary/15">
      <span className="text-4xl" aria-hidden>
        💊
      </span>
    </div>
    <h1 className="mb-2 text-3xl font-black tracking-tight text-foreground">{name}</h1>
    <p className="max-w-md text-center leading-relaxed text-muted-foreground">
      This module is under active development. The core POS experience is available for demonstration.
    </p>
  </div>
);

export const PosAppNavigator: React.FC = () => {
  const { currentScreen, isDarkMode } = useAppStore();
  const { user, isAuthenticated } = useAuthStore();
  const hydrateReferenceData = usePOSBillingStore((s) => s.hydrateReferenceData);
  const hydratePOSData = usePOSBillingStore((s) => s.hydratePOSData);
  const hydrateBusinessData = usePOSBillingStore((s) => s.hydrateBusinessData);
  const isAccessGranted = !!user && isAuthenticated;
  const [updateMessage, setUpdateMessage] = React.useState<string | null>(null);

  useEffect(() => {
    applyThemeToDocument(isDarkMode);
    void window.electronAPI?.setChromeTheme?.(isDarkMode);
  }, [isDarkMode]);

  useEffect(() => {
    const root = document.documentElement;
    const sync = () => {
      const s = useSettingsStore.getState();
      applyPrimaryTheme(s.primaryColorHex);
      root.style.fontSize = `${100 * s.fontScale}%`;
    };
    sync();
    return useSettingsStore.subscribe(sync);
  }, []);

  useEffect(() => {
    if (!isAccessGranted) return;
    void hydrateReferenceData();
    void (async () => {
      await hydratePOSData();
      await hydrateBusinessData();
    })();
  }, [isAccessGranted, hydrateReferenceData, hydratePOSData, hydrateBusinessData]);

  useEffect(() => {
    const off = window.api?.onUpdaterStatus?.((payload) => {
      if (!payload?.message) return;
      setUpdateMessage(payload.message);
      if (payload.phase === 'not-available') {
        window.setTimeout(() => setUpdateMessage(null), 3000);
      }
    });
    return () => off?.();
  }, []);

  if (!isAccessGranted) {
    return <AuthGate />;
  }

  return (
    <div
      className={cn(
        'flex flex-col h-screen w-screen overflow-hidden text-foreground antialiased',
        isDarkMode
          ? 'bg-background bg-[radial-gradient(ellipse_120%_80%_at_50%_-20%,rgba(13,148,136,0.12),transparent_55%)]'
          : 'bg-gradient-to-br from-slate-50 via-[#f1f5f9] to-teal-50/40 bg-[radial-gradient(ellipse_100%_60%_at_100%_0%,rgba(45,212,191,0.08),transparent_50%)]'
      )}
    >
      <TitleBar />
      {updateMessage ? (
        <div className="mx-5 mt-2 rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 text-xs font-medium text-foreground">
          {updateMessage}
        </div>
      ) : null}
      <div className="relative z-10 flex min-h-0 flex-1 overflow-hidden">
        <Sidebar />
        <main className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-white/[0.45] backdrop-blur-md dark:bg-transparent dark:backdrop-blur-none">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentScreen}
              initial={false}
              animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0, scale: 1.02, filter: 'blur(10px)' }}
              transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
              className="flex-1 overflow-hidden h-full"
            >
              {currentScreen === 'POS' ? (
                <POS />
              ) : currentScreen === 'Inventory' ? (
                <Inventory />
              ) : currentScreen === 'Medicines' ? (
                <Medicines />
              ) : currentScreen === 'Sales' ? (
                <SalesHistory />
              ) : currentScreen === 'Returns' ? (
                <Returns />
              ) : currentScreen === 'Customers' ? (
                <Customers />
              ) : currentScreen === 'Dashboard' ? (
                <Dashboard />
              ) : currentScreen === 'Reports' ? (
                <Reports />
              ) : currentScreen === 'Purchases' ? (
                <Purchases />
              ) : currentScreen === 'Suppliers' ? (
                <Suppliers />
              ) : currentScreen === 'Settings' ? (
                <Settings />
              ) : (
                <PlaceholderScreen name={currentScreen} />
              )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
      <div className="pointer-events-none fixed bottom-4 right-4 z-0 max-w-[calc(100vw-2rem)] opacity-80 dark:opacity-50">
        <div className="flex flex-wrap items-center justify-end gap-1 rounded-2xl border border-border/80 bg-card/90 px-2 py-1.5 shadow-md shadow-slate-900/[0.06] ring-1 ring-black/[0.02] backdrop-blur-md dark:border-border/60 dark:bg-card/85 dark:shadow-none dark:ring-white/[0.04]">
          <span className="inline-flex items-center gap-1 rounded-lg px-1.5 py-1 text-[10px] font-bold tracking-wide text-muted-foreground">
            <kbd className="rounded bg-muted/90 px-1 py-0.5 font-mono text-[9px] text-foreground">F2</kbd>
            Search
          </span>
          <span className="text-border/80 dark:text-border">|</span>
          <span className="inline-flex items-center gap-1 rounded-lg px-1.5 py-1 text-[10px] font-bold tracking-wide text-muted-foreground">
            <kbd className="rounded bg-muted/90 px-1 py-0.5 font-mono text-[9px] text-foreground">F3</kbd>
            Checkout
          </span>
          <span className="text-border/80 dark:text-border">|</span>
          <span className="inline-flex items-center gap-1 rounded-lg px-1.5 py-1 text-[10px] font-bold tracking-wide text-muted-foreground">
            <kbd className="rounded bg-muted/90 px-1 py-0.5 font-mono text-[9px] text-foreground">F4</kbd>
            Void
          </span>
          <span className="text-border/80 dark:text-border">|</span>
          <span className="inline-flex items-center gap-1 rounded-lg px-1.5 py-1 text-[10px] font-bold tracking-wide text-muted-foreground">
            <kbd className="rounded bg-muted/90 px-1 py-0.5 font-mono text-[9px] text-foreground">↵</kbd>
            Add
          </span>
        </div>
      </div>
    </div>
  );
};


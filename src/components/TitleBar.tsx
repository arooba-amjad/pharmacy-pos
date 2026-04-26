import React, { useEffect, useState } from 'react';
import { Minus, Square, X, Pill, LogOut } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';

export const TitleBar: React.FC = () => {
  const logout = useAuthStore((s) => s.logout);
  const [now, setNow] = useState(() => new Date());
  const handleMinimize = () => (window as any).electronAPI?.minimize();
  const handleMaximize = () => (window as any).electronAPI?.maximize();
  const handleClose = () => (window as any).electronAPI?.close();

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="titlebar z-50 flex shrink-0 items-center justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <div className="rounded-xl bg-gradient-to-br from-primary/30 via-primary/15 to-teal-400/20 p-2 shadow-sm ring-1 ring-primary/20">
          <Pill className="h-4 w-4 text-primary" strokeWidth={2.25} />
        </div>
        <div className="flex min-w-0 flex-col leading-none">
          <span className="truncate text-xs font-bold tracking-tight text-foreground">PharmaOS</span>
          <span className="mt-0.5 truncate text-[10px] font-medium tracking-wide text-muted-foreground">Pharmacy point of sale</span>
        </div>
        <div className="hidden rounded-lg border border-border/60 bg-card/60 px-2.5 py-1 text-[10px] font-semibold text-muted-foreground sm:block">
          {now.toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}{' '}
          · {now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </div>
      </div>

      <div className="no-drag flex h-full items-center gap-0.5">
        <button
          type="button"
          onClick={() => logout()}
          className="mr-1 inline-flex h-8 items-center gap-1.5 rounded-lg border border-border/65 bg-card/70 px-2.5 text-[11px] font-semibold text-muted-foreground transition-colors hover:bg-muted/90 hover:text-foreground"
          title="Logout"
          aria-label="Logout"
        >
          <LogOut className="h-3.5 w-3.5" strokeWidth={2} />
          <span className="hidden sm:inline">Logout</span>
        </button>
        <button
          type="button"
          onClick={handleMinimize}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted/90 hover:text-foreground"
          aria-label="Minimize"
        >
          <Minus className="w-4 h-4" strokeWidth={2} />
        </button>
        <button
          type="button"
          onClick={handleMaximize}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted/90 hover:text-foreground"
          aria-label="Maximize"
        >
          <Square className="w-3 h-3" strokeWidth={2} />
        </button>
        <button
          type="button"
          onClick={handleClose}
          className="ml-0.5 flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-red-500 hover:text-white"
          aria-label="Close"
        >
          <X className="w-4 h-4" strokeWidth={2} />
        </button>
      </div>
    </div>
  );
};

import React from 'react';
import {
  LayoutDashboard,
  Pill,
  ShoppingCart,
  Users,
  FileBox,
  Truck,
  Settings,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  ClipboardList,
  BarChart3,
  Undo2,
} from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import type { AppScreen } from '@/types';
import { cn } from '@/lib/utils';

type NavGroup = 'counter' | 'stock' | 'revenue' | 'system';

const GROUP_ORDER: NavGroup[] = ['counter', 'stock', 'revenue', 'system'];

const GROUP_LABEL: Record<NavGroup, string> = {
  counter: 'Counter',
  stock: 'Stock & buying',
  revenue: 'Revenue',
  system: 'System',
};

const menuItems: {
  icon: React.ComponentType<{ className?: string; size?: number | string; strokeWidth?: number | string }>;
  label: string;
  screen: AppScreen;
  group: NavGroup;
}[] = [
  { icon: ShoppingCart, label: 'POS', screen: 'POS', group: 'counter' },
  { icon: Undo2, label: 'Returns', screen: 'Returns', group: 'counter' },
  { icon: LayoutDashboard, label: 'Dashboard', screen: 'Dashboard', group: 'counter' },
  { icon: FileBox, label: 'Inventory', screen: 'Inventory', group: 'stock' },
  { icon: Pill, label: 'Medicines', screen: 'Medicines', group: 'stock' },
  { icon: ClipboardList, label: 'Purchases', screen: 'Purchases', group: 'stock' },
  { icon: Truck, label: 'Suppliers', screen: 'Suppliers', group: 'stock' },
  { icon: TrendingUp, label: 'Sales', screen: 'Sales', group: 'revenue' },
  { icon: Users, label: 'Customers', screen: 'Customers', group: 'revenue' },
  { icon: BarChart3, label: 'Reports', screen: 'Reports', group: 'revenue' },
  { icon: Settings, label: 'Settings', screen: 'Settings', group: 'system' },
];

export const Sidebar: React.FC = () => {
  const { currentScreen, setCurrentScreen, isSidebarCollapsed, toggleSidebar } = useAppStore();

  return (
    <div
      className={cn(
        'no-drag flex h-full shrink-0 flex-col border-r border-border/40 bg-gradient-to-b from-card via-card to-muted/[0.12] shadow-[8px_0_48px_-28px_rgba(15,23,42,0.2)] backdrop-blur-xl transition-[width] duration-300 ease-[cubic-bezier(0.33,1,0.68,1)] dark:border-border/25 dark:from-card/55 dark:via-card/45 dark:to-card/25 dark:shadow-[8px_0_48px_-28px_rgba(0,0,0,0.55)]',
        isSidebarCollapsed ? 'w-[76px]' : 'w-[272px]'
      )}
    >
      {/* Brand */}
      <div
        className={cn(
          'shrink-0 border-b border-border/35 bg-card/40 px-3 pb-3.5 pt-4 dark:border-border/25 dark:bg-card/15',
          isSidebarCollapsed && 'flex justify-center px-2 pb-2.5 pt-3.5'
        )}
      >
        {!isSidebarCollapsed ? (
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/35 via-primary/18 to-teal-400/22 shadow-md shadow-primary/10 ring-1 ring-primary/25 dark:shadow-none">
              <Pill className="h-[19px] w-[19px] text-primary" strokeWidth={2.35} />
            </div>
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-[15px] font-bold tracking-tight text-foreground">PharmaOS</p>
              <p className="truncate text-[11px] font-medium tracking-wide text-muted-foreground/90">Pharmacy POS</p>
            </div>
          </div>
        ) : (
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/35 via-primary/18 to-teal-400/22 shadow-md shadow-primary/10 ring-1 ring-primary/25 dark:shadow-none">
            <Pill className="h-[19px] w-[19px] text-primary" strokeWidth={2.35} />
          </div>
        )}
      </div>

      {/* Nav */}
      <nav
        className="custom-scrollbar flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-2 py-3.5"
        aria-label="Main navigation"
      >
        {GROUP_ORDER.map((group) => {
          const items = menuItems.filter((i) => i.group === group);
          return (
            <div key={group} className={cn('space-y-0.5', group === 'system' && 'mt-2 border-t border-border/35 pt-2.5 dark:border-border/25')}>
              {!isSidebarCollapsed && (
                <div className="flex items-center gap-2 px-3 pb-1.5 pt-2 first:pt-0">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary/70 ring-2 ring-primary/15" aria-hidden />
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground/80">{GROUP_LABEL[group]}</p>
                </div>
              )}
              {isSidebarCollapsed && group !== 'counter' ? (
                <div className="mx-auto my-2 h-px w-9 rounded-full bg-gradient-to-r from-transparent via-border/70 to-transparent dark:via-border/50" aria-hidden />
              ) : null}
              {items.map((item) => {
                const isActive = currentScreen === item.screen;
                const Icon = item.icon;
                return (
                  <button
                    key={item.screen}
                    type="button"
                    title={isSidebarCollapsed ? item.label : undefined}
                    aria-current={isActive ? 'page' : undefined}
                    onClick={() => setCurrentScreen(item.screen)}
                    className={cn(
                      'group flex w-full items-center gap-3 rounded-xl border text-left outline-none transition-[background,box-shadow,transform,border-color,color] duration-200 focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.99]',
                      isSidebarCollapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2.5',
                      isActive
                        ? 'border-primary/35 bg-primary text-primary-foreground shadow-md shadow-primary/30 ring-1 ring-primary/25 [box-shadow:inset_0_1px_0_0_rgba(255,255,255,0.14)] dark:border-primary/40 dark:shadow-primary/25 dark:[box-shadow:inset_0_1px_0_0_rgba(255,255,255,0.08)]'
                        : cn(
                            'border-transparent text-muted-foreground hover:border-border/50 hover:bg-muted/70 hover:text-foreground dark:hover:border-border/30 dark:hover:bg-muted/20',
                            isSidebarCollapsed && 'hover:ring-1 hover:ring-border/40'
                          ),
                      isSidebarCollapsed && isActive && 'ring-2 ring-primary/35 ring-offset-2 ring-offset-card dark:ring-offset-card/80'
                    )}
                  >
                    <Icon
                      className={cn(
                        'h-[18px] w-[18px] min-w-[18px] shrink-0 transition-transform duration-200',
                        isActive ? 'scale-[1.03] stroke-[2.5px]' : 'stroke-2 group-hover:scale-[1.06]'
                      )}
                    />
                    {!isSidebarCollapsed && (
                      <span className="min-w-0 flex-1 truncate text-[13px] font-semibold leading-snug tracking-tight">{item.label}</span>
                    )}
                  </button>
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="shrink-0 border-t border-border/40 bg-gradient-to-t from-muted/[0.2] to-transparent px-2 py-3 backdrop-blur-sm dark:border-border/25 dark:from-muted/10">
        <button
          type="button"
          onClick={toggleSidebar}
          className={cn(
            'no-drag flex w-full cursor-pointer items-center gap-2 rounded-xl border border-border/45 bg-card/80 py-2.5 text-xs font-semibold text-muted-foreground shadow-sm transition-all hover:border-primary/20 hover:bg-muted/60 hover:text-foreground dark:border-border/35 dark:bg-card/30 dark:hover:border-primary/25 dark:hover:bg-muted/25',
            isSidebarCollapsed ? 'justify-center px-2' : 'px-3'
          )}
          aria-expanded={!isSidebarCollapsed}
          aria-label={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isSidebarCollapsed ? (
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted/50 dark:bg-muted/25">
              <ChevronRight className="h-4 w-4 shrink-0 opacity-90" strokeWidth={2.25} />
            </span>
          ) : (
            <>
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted/50 dark:bg-muted/25">
                <ChevronLeft className="h-4 w-4 opacity-90" strokeWidth={2.25} />
              </span>
              <span className="truncate">Collapse</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};

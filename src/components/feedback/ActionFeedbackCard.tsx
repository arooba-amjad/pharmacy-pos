import React from 'react';
import { AlertCircle, CheckCircle2, Copy, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ActionFeedbackType = 'success' | 'error' | 'info';
export type ActionFeedbackAction = {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary';
};

export type ActionFeedbackCardProps = {
  title: string;
  description?: string;
  type: ActionFeedbackType;
  actions?: ActionFeedbackAction[];
  meta?: string;
};

const TYPE_STYLE: Record<
  ActionFeedbackType,
  { card: string; iconWrap: string; icon: React.ElementType; iconColor: string }
> = {
  success: {
    card: 'border-emerald-200 bg-emerald-50/80 dark:border-emerald-900/40 dark:bg-emerald-950/20',
    iconWrap: 'bg-emerald-100 dark:bg-emerald-900/40',
    icon: CheckCircle2,
    iconColor: 'text-emerald-700 dark:text-emerald-300',
  },
  error: {
    card: 'border-rose-200 bg-rose-50/80 dark:border-rose-900/40 dark:bg-rose-950/20',
    iconWrap: 'bg-rose-100 dark:bg-rose-900/40',
    icon: AlertCircle,
    iconColor: 'text-rose-700 dark:text-rose-300',
  },
  info: {
    card: 'border-sky-200 bg-sky-50/80 dark:border-sky-900/40 dark:bg-sky-950/20',
    iconWrap: 'bg-sky-100 dark:bg-sky-900/40',
    icon: Info,
    iconColor: 'text-sky-700 dark:text-sky-300',
  },
};

export const ActionFeedbackCard: React.FC<ActionFeedbackCardProps> = ({
  title,
  description,
  type,
  actions = [],
  meta,
}) => {
  const style = TYPE_STYLE[type];
  const Icon = style.icon;

  const onCopyMeta = async () => {
    if (!meta) return;
    try {
      await navigator.clipboard.writeText(meta);
    } catch {
      // Silent fallback: clipboard may be unavailable in some hardened environments.
    }
  };

  return (
    <div className={cn('rounded-2xl border p-3.5 shadow-sm', style.card)} role="status" aria-live="polite">
      <div className="flex items-start gap-3">
        <div className={cn('mt-0.5 rounded-lg p-1.5', style.iconWrap)}>
          <Icon className={cn('h-4 w-4', style.iconColor)} />
        </div>
        <div className="min-w-0 flex-1">
          <h5 className="text-sm font-semibold text-slate-900 dark:text-white">{title}</h5>
          {description ? <p className="mt-1 text-xs text-slate-600 dark:text-zinc-300">{description}</p> : null}
          {meta ? (
            <div className="mt-2 rounded-xl border border-slate-200/80 bg-white/70 px-2.5 py-2 dark:border-zinc-800 dark:bg-zinc-950/50">
              <p className="break-all font-mono text-[11px] text-slate-700 dark:text-zinc-300">{meta}</p>
              <button
                type="button"
                onClick={() => void onCopyMeta()}
                className="mt-2 inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200"
                aria-label="Copy metadata path"
              >
                <Copy className="h-3.5 w-3.5" />
                Copy
              </button>
            </div>
          ) : null}
          {actions.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {actions.map((a, i) => (
                <button
                  key={`${a.label}-${i}`}
                  type="button"
                  onClick={a.onClick}
                  className={cn(
                    'rounded-lg px-2.5 py-1 text-[11px] font-semibold',
                    a.variant === 'primary'
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                      : 'border border-slate-200 bg-white text-slate-700 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200'
                  )}
                >
                  {a.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

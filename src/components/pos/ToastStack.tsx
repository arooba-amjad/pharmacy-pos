import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, AlertCircle, Info } from 'lucide-react';
import { useToastStore } from '@/store/useToastStore';
import { cn } from '@/lib/utils';

export const ToastStack: React.FC = () => {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  return (
    <div className="fixed top-12 right-5 z-[200] flex flex-col gap-2 pointer-events-none">
      <AnimatePresence mode="popLayout">
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, x: 40, scale: 0.96 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 24, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 420, damping: 28 }}
            className={cn(
              'pointer-events-auto flex items-start gap-3 min-w-[280px] max-w-[380px] rounded-2xl border px-4 py-3 shadow-lg backdrop-blur-md',
              t.kind === 'success' &&
                'bg-emerald-50/95 border-emerald-200 text-emerald-950 dark:bg-emerald-950/90 dark:border-emerald-700 dark:text-emerald-50',
              t.kind === 'error' &&
                'bg-red-50/95 border-red-200 text-red-950 dark:bg-red-950/90 dark:border-red-800 dark:text-red-50',
              t.kind === 'info' &&
                'bg-card/95 border-border text-foreground shadow-md'
            )}
          >
            {t.kind === 'success' && <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600 dark:text-emerald-300 mt-0.5" />}
            {t.kind === 'error' && <AlertCircle className="w-5 h-5 shrink-0 text-red-600 dark:text-red-300 mt-0.5" />}
            {t.kind === 'info' && <Info className="w-5 h-5 shrink-0 text-primary mt-0.5" />}
            <p className="text-sm font-medium leading-snug flex-1">{t.message}</p>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              className="text-xs font-bold opacity-50 hover:opacity-100 no-drag shrink-0"
            >
              ✕
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

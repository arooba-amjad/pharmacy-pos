import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import type { Manufacturer } from '@/types';

export interface ManufacturerComboboxProps {
  manufacturers: Manufacturer[];
  manufacturerSearch: string;
  manufacturerId: string;
  onChange: (next: { manufacturerSearch: string; manufacturerId: string }) => void;
  error?: string;
  id?: string;
}

export function ManufacturerCombobox({
  manufacturers,
  manufacturerSearch,
  manufacturerId,
  onChange,
  error,
  id = 'mf-manufacturer',
}: ManufacturerComboboxProps) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = manufacturerSearch.trim().toLowerCase();
    if (!q) return manufacturers.slice(0, 12);
    return manufacturers.filter((m) => m.name.toLowerCase().includes(q)).slice(0, 12);
  }, [manufacturers, manufacturerSearch]);

  useEffect(() => {
    setActive((i) => (filtered.length === 0 ? 0 : Math.min(i, filtered.length - 1)));
  }, [filtered.length, manufacturerSearch]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const commitSelection = useCallback(
    (pick?: Manufacturer) => {
      const q = manufacturerSearch.trim();
      if (pick) {
        onChange({ manufacturerSearch: pick.name, manufacturerId: pick.id });
        setOpen(false);
        return;
      }
      if (!q) return;
      const exact = manufacturers.find((m) => m.name.trim().toLowerCase() === q.toLowerCase());
      if (exact) {
        onChange({ manufacturerSearch: exact.name, manufacturerId: exact.id });
        setOpen(false);
        return;
      }
      onChange({ manufacturerSearch: q.trim(), manufacturerId: '' });
      setOpen(false);
    },
    [manufacturerSearch, manufacturers, onChange]
  );

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setOpen(false);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((i) => (filtered.length === 0 ? 0 : Math.min(i + 1, filtered.length - 1)));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setOpen(true);
      setActive((i) => (filtered.length === 0 ? 0 : Math.max(i - 1, 0)));
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (open && filtered.length > 0) {
        const row = filtered[active];
        if (row) commitSelection(row);
        else commitSelection();
      } else {
        commitSelection();
      }
    }
  };

  const [focused, setFocused] = useState(false);
  const floated = focused || manufacturerSearch.length > 0 || !!manufacturerId;

  return (
    <div ref={wrapRef} className="relative">
      <label
        htmlFor={id}
        className={cn(
          'pointer-events-none absolute left-3 z-10 origin-left transition-all',
          floated ? 'top-1.5 text-[10px] font-medium text-slate-500' : 'top-3 text-sm text-slate-400'
        )}
      >
        Manufacturer
      </label>
      <input
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        autoComplete="off"
        value={manufacturerSearch}
        onChange={(e) => {
          onChange({ manufacturerSearch: e.target.value, manufacturerId: '' });
          setOpen(true);
        }}
        onFocus={() => {
          setFocused(true);
          setOpen(true);
        }}
        onBlur={() => setFocused(false)}
        onKeyDown={onKeyDown}
        placeholder=""
        className={cn(
          'no-drag w-full rounded-xl border border-slate-200 bg-white px-3 pb-2.5 pt-5 text-sm text-slate-900 outline-none transition-shadow focus:border-slate-300 focus:ring-2 focus:ring-slate-200/80 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white',
          error && 'border-red-400 focus:border-red-400 focus:ring-red-100'
        )}
      />
      {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}

      {open && filtered.length > 0 ? (
        <ul
          role="listbox"
          className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-xl border border-slate-200 bg-white py-1 text-sm shadow-lg dark:border-zinc-700 dark:bg-zinc-950"
        >
          {filtered.map((m, idx) => (
            <li key={m.id}>
              <button
                type="button"
                role="option"
                aria-selected={idx === active}
                className={cn(
                  'flex w-full items-center px-3 py-2 text-left font-medium transition-colors',
                  idx === active
                    ? 'bg-primary/10 text-primary'
                    : 'text-slate-800 hover:bg-slate-50 dark:text-zinc-200 dark:hover:bg-zinc-900'
                )}
                onMouseEnter={() => setActive(idx)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => commitSelection(m)}
              >
                {m.name}
                <span className="ml-auto truncate pl-2 text-[10px] font-normal text-slate-400 dark:text-zinc-500">
                  {m.phone}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

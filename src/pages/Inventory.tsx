import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { format } from 'date-fns';
import {
  AlertTriangle,
  Ban,
  CalendarClock,
  ChevronRight,
  Layers,
  Package,
  Pencil,
  Pill,
  Search,
  SlidersHorizontal,
  Trash2,
  TrendingDown,
  Wallet,
  X,
} from 'lucide-react';
import { usePOSBillingStore } from '@/store/usePOSBillingStore';
import { useToastStore } from '@/store/useToastStore';
import type { Medicine, MedicineBatch } from '@/types';
import { cn, formatCurrency } from '@/lib/utils';
import { displayManufacturer } from '@/lib/medicineDisplay';
import { daysUntilExpiry, isExpired, parseLocalDay } from '@/lib/posDates';
import { getMedicineAvailability } from '@/lib/posSearchHelpers';
import {
  computeInventoryStats,
  expiryToneForDate,
  filterMedicines,
  nearestSellableBatch,
  stockBarPercent,
  type InventoryStatusFilter,
} from '@/lib/inventoryAnalytics';
import {
  effectiveMedicineUnitType,
  isGeneralMedicineProfile,
  quantityPerPackFieldLabels,
} from '@/lib/medicinePackLabels';
import {
  costPerPackFromTablet,
  formatPacksPlusTablets,
  getMedicineTabletsPerPack,
  tabletPurchaseFromPack,
  tabletSaleFromPack,
} from '@/lib/stockUnits';
import { getMasterPurchasePricePerPack, getMasterSalePricePerPack } from '@/lib/medicineMasterHelpers';

const PAGE_BG = 'bg-[#F8FAFC] dark:bg-zinc-950';

function defaultFutureDate(days: number) {
  return new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
}

function toneStyles(tone: ReturnType<typeof expiryToneForDate>) {
  switch (tone) {
    case 'critical':
      return {
        chip: 'bg-red-500/12 text-red-700 dark:text-red-300 ring-1 ring-red-500/25',
        text: 'text-red-600 dark:text-red-400',
      };
    case 'warn':
      return {
        chip: 'bg-amber-500/12 text-amber-800 dark:text-amber-200 ring-1 ring-amber-500/25',
        text: 'text-amber-700 dark:text-amber-300',
      };
    case 'safe':
      return {
        chip: 'bg-emerald-500/12 text-emerald-800 dark:text-emerald-200 ring-1 ring-emerald-500/20',
        text: 'text-emerald-700 dark:text-emerald-300',
      };
    case 'expired':
      return {
        chip: 'bg-slate-500/15 text-slate-600 dark:text-slate-300 ring-1 ring-slate-500/20',
        text: 'text-slate-500 dark:text-slate-400',
      };
    default:
      return {
        chip: 'bg-slate-500/10 text-slate-600 dark:text-slate-400',
        text: 'text-muted-foreground',
      };
  }
}

function expirySummary(expiryDate: string | null): string {
  if (!expiryDate) return 'No active lots';
  if (isExpired(expiryDate)) return 'Nearest lot expired';
  const d = daysUntilExpiry(expiryDate);
  if (d === 0) return 'Expires today';
  if (d === 1) return '1 day left';
  return `${d} days left`;
}

/** Match batch by number (trimmed, case-insensitive). Prefer earliest-expiring lot when duplicates exist. */
function findBatchByBatchNoNormalized(med: Medicine, raw: string): MedicineBatch | null {
  const q = raw.trim().toLowerCase();
  if (!q) return null;
  const sorted = [...med.batches].sort(
    (a, b) => parseLocalDay(a.expiryDate).getTime() - parseLocalDay(b.expiryDate).getTime()
  );
  return sorted.find((b) => b.batchNo.trim().toLowerCase() === q) ?? null;
}

export const Inventory: React.FC = () => {
  const medicines = usePOSBillingStore((s) => s.medicines);
  const addBatchToMedicine = usePOSBillingStore((s) => s.addBatchToMedicine);
  const removeBatchFromMedicine = usePOSBillingStore((s) => s.removeBatchFromMedicine);
  const adjustBatchStock = usePOSBillingStore((s) => s.adjustBatchStock);
  const updateBatchFields = usePOSBillingStore((s) => s.updateBatchFields);
  const updateMedicineMeta = usePOSBillingStore((s) => s.updateMedicineMeta);
  const applyMedicineMasterPatch = usePOSBillingStore((s) => s.applyMedicineMasterPatch);
  const showToast = useToastStore((s) => s.show);

  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<InventoryStatusFilter>('all');
  const [category, setCategory] = useState<string | 'all'>('all');
  const [expiringOnly, setExpiringOnly] = useState(false);
  const [activeMedicineId, setActiveMedicineId] = useState<string | null>(null);
  const [adjustInlineError, setAdjustInlineError] = useState<string | null>(null);
  /** Read-only batches overview */
  const [viewMedicineId, setViewMedicineId] = useState<string | null>(null);
  /** Add stock / new batch popup */
  const [adjustMedicineId, setAdjustMedicineId] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editMedicineId, setEditMedicineId] = useState<string | null>(null);

  const stats = useMemo(() => computeInventoryStats(medicines), [medicines]);
  const categories = useMemo(() => {
    const u = new Set(medicines.map((m) => m.category));
    return Array.from(u).sort((a, b) => a.localeCompare(b));
  }, [medicines]);

  const filtered = useMemo(
    () => filterMedicines(medicines, query, status, category, expiringOnly),
    [medicines, query, status, category, expiringOnly]
  );

  useEffect(() => {
    if (filtered.length === 0) {
      setActiveMedicineId(null);
      return;
    }
    setActiveMedicineId((prev) => (prev && filtered.some((m) => m.id === prev) ? prev : filtered[0]!.id));
  }, [filtered]);

  const viewMedicine = useMemo(
    () => (viewMedicineId ? medicines.find((m) => m.id === viewMedicineId) ?? null : null),
    [medicines, viewMedicineId]
  );
  const adjustMedicine = useMemo(
    () => (adjustMedicineId ? medicines.find((m) => m.id === adjustMedicineId) ?? null : null),
    [medicines, adjustMedicineId]
  );
  const editMedicine = useMemo(
    () => (editMedicineId ? medicines.find((m) => m.id === editMedicineId) ?? null : null),
    [medicines, editMedicineId]
  );

  const [newBatch, setNewBatch] = useState({
    batchNo: '',
    expiryDate: defaultFutureDate(180),
    quantityPackets: 0,
    quantityTablets: 0,
    purchasePricePerPack: 0,
    salePricePerPack: 0,
  });

  const [editForm, setEditForm] = useState({ name: '', generic: '', category: '', unit: '' });
  const searchRef = useRef<HTMLInputElement>(null);
  const adjustQtyRef = useRef<HTMLInputElement>(null);
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const closeView = useCallback(() => setViewMedicineId(null), []);

  const closeAdjust = useCallback(() => {
    setAdjustMedicineId(null);
    setAdjustInlineError(null);
  }, []);

  const initAdjustFormForMedicine = useCallback((med: Medicine) => {
    const ref = nearestSellableBatch(med) ?? med.batches[0];
    const tpp = getMedicineTabletsPerPack(med);
    const spp = getMasterSalePricePerPack(med);
    const ppp = getMasterPurchasePricePerPack(med);
    const salePp =
      spp ??
      (ref && tpp >= 2 ? costPerPackFromTablet(ref.salePricePerTablet, tpp) : ref?.salePricePerPack ?? 0);
    const purchasePp =
      ppp ?? (ref && tpp >= 2 ? costPerPackFromTablet(ref.costPricePerTablet, tpp) : ref?.costPricePerTablet ?? 0);
    setNewBatch({
      batchNo: ref?.batchNo ?? '',
      expiryDate: defaultFutureDate(180),
      quantityPackets: 0,
      quantityTablets: 0,
      purchasePricePerPack: Math.round(purchasePp * 100) / 100,
      salePricePerPack: Math.max(0.01, Math.round(salePp * 100) / 100),
    });
  }, []);

  const openViewMedicine = useCallback((id: string) => {
    setViewMedicineId(id);
  }, []);

  const openAdjustMedicine = useCallback(
    (id: string) => {
      const med = usePOSBillingStore.getState().medicines.find((m) => m.id === id);
      if (med) initAdjustFormForMedicine(med);
      setActiveMedicineId(id);
      setAdjustInlineError(null);
      setAdjustMedicineId(id);
    },
    [initAdjustFormForMedicine]
  );

  const applyAutofillFromMatchedBatch = useCallback((med: Medicine, batchNoRaw: string) => {
    const hit = findBatchByBatchNoNormalized(med, batchNoRaw);
    if (!hit) return false;
    const tpp = getMedicineTabletsPerPack(med);
    const purchasePp =
      tpp >= 2 ? costPerPackFromTablet(hit.costPricePerTablet, tpp) : hit.costPricePerTablet;
    const salePp = tpp >= 2 ? hit.salePricePerPack : hit.salePricePerTablet;
    setNewBatch((prev) => ({
      ...prev,
      batchNo: prev.batchNo,
      expiryDate: hit.expiryDate,
      purchasePricePerPack: Math.round(purchasePp * 100) / 100,
      salePricePerPack: Math.max(0.01, Math.round(salePp * 100) / 100),
    }));
    return true;
  }, []);

  const applySummaryCard = (key: 'all' | 'low' | 'expiring' | 'out' | 'value') => {
    if (key === 'value') {
      setStatus('all');
      setExpiringOnly(false);
      return;
    }
    setStatus(key);
    if (key !== 'expiring') setExpiringOnly(false);
  };

  const statusPills: { id: InventoryStatusFilter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'low', label: 'Low stock' },
    { id: 'expiring', label: 'Expiring soon' },
    { id: 'out', label: 'Out of stock' },
  ];

  const submitAdjustStock = (e: React.FormEvent) => {
    e.preventDefault();
    const med = adjustMedicine;
    if (!med) return;
    const unitLabels = quantityPerPackFieldLabels({
      isGeneral: isGeneralMedicineProfile(med),
      unitType: effectiveMedicineUnitType(med),
    });
    const tpp = getMedicineTabletsPerPack(med);
    const packs = Math.max(0, Math.floor(Number(newBatch.quantityPackets) || 0));
    const extraTablets = Math.max(0, Math.floor(Number(newBatch.quantityTablets) || 0));
    const tablets = packs * Math.max(1, tpp) + extraTablets;
    setAdjustInlineError(null);
    const bn = newBatch.batchNo.trim();
    if (!bn) {
      showToast('Enter a batch number.', 'error');
      return;
    }
    const salePp = Math.max(0.01, Math.round(newBatch.salePricePerPack * 100) / 100);
    const purchasePp = Math.max(0, Math.round(newBatch.purchasePricePerPack * 100) / 100);
    const salePt = tabletSaleFromPack(salePp, tpp);
    const costPt = purchasePp <= 0 ? 0 : tabletPurchaseFromPack(purchasePp, tpp);
    applyMedicineMasterPatch(med.id, {
      salePricePerPack: salePp,
      purchasePricePerPack: purchasePp,
    });

    const existing = findBatchByBatchNoNormalized(med, bn);
    if (existing) {
      updateBatchFields(med.id, existing.id, {
        batchNo: bn,
        expiryDate: newBatch.expiryDate,
      });
      if (packs > 0) {
        adjustBatchStock(med.id, existing.id, tablets);
        showToast(
          `Batch “${existing.batchNo}” updated and ${packs} pack${packs === 1 ? '' : 's'} + ${extraTablets} ${med.unit}${extraTablets === 1 ? '' : 's'} (${tablets} ${unitLabels.looseStockPlural} total) added. Sale/purchase prices were applied to all batches and POS.`,
          'success'
        );
      } else if (extraTablets > 0) {
        adjustBatchStock(med.id, existing.id, tablets);
        showToast(
          `Batch “${existing.batchNo}” updated and ${extraTablets} ${med.unit}${extraTablets === 1 ? '' : 's'} added. Sale/purchase prices were applied to all batches and POS.`,
          'success'
        );
      } else {
        showToast(
          `Batch “${existing.batchNo}” updated. Sale/purchase prices were applied to all batches and POS.`,
          'success'
        );
      }
    } else {
      if (tablets <= 0) {
        setAdjustInlineError(
          `Enter quantity in packs and/or loose ${unitLabels.looseStockPlural} (minimum 1 unit) for a new batch.`
        );
        showToast(
          `Enter how many packs and/or loose ${unitLabels.looseStockPlural} you are receiving for a new batch.`,
          'error'
        );
        return;
      }
      addBatchToMedicine(med.id, {
        batchNo: bn,
        expiryDate: newBatch.expiryDate,
        totalTablets: tablets,
        salePricePerTablet: salePt,
        salePricePerPack: tpp >= 2 ? salePp : salePt,
        costPricePerTablet: costPt,
      });
      showToast(
        `New batch “${bn}” saved with ${packs} pack${packs === 1 ? '' : 's'} + ${extraTablets} ${med.unit}${extraTablets === 1 ? '' : 's'}.`,
        'success'
      );
    }
    const nextMed = usePOSBillingStore.getState().medicines.find((m) => m.id === med.id);
    if (nextMed) initAdjustFormForMedicine(nextMed);
    closeAdjust();
  };

  const saveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editMedicine) return;
    updateMedicineMeta(editMedicine.id, editForm);
    setEditOpen(false);
    setEditMedicineId(null);
  };

  const sortedBatches = (m: Medicine) =>
    [...m.batches].sort((a, b) => parseLocalDay(a.expiryDate).getTime() - parseLocalDay(b.expiryDate).getTime());

  const adjustBatchMatch = useMemo(() => {
    if (!adjustMedicine || !newBatch.batchNo.trim()) return null;
    return findBatchByBatchNoNormalized(adjustMedicine, newBatch.batchNo);
  }, [adjustMedicine, newBatch.batchNo]);

  const adjustPreview = useMemo(() => {
    if (!adjustMedicine) return null;
    const tpp = Math.max(1, getMedicineTabletsPerPack(adjustMedicine));
    const addPacks = Math.max(0, Math.floor(Number(newBatch.quantityPackets) || 0));
    const directTablets = Math.max(0, Math.floor(Number(newBatch.quantityTablets) || 0));
    const addTablets = addPacks * tpp + directTablets;
    const target = adjustBatchMatch ?? nearestSellableBatch(adjustMedicine) ?? adjustMedicine.batches[0] ?? null;
    if (!target) return null;
    return {
      batchNo: target.batchNo,
      currentTablets: target.totalTablets,
      projectedTablets: target.totalTablets + addTablets,
      addPacks,
      directTablets,
      addTablets,
      tpp,
    };
  }, [adjustMedicine, newBatch.quantityPackets, newBatch.quantityTablets, adjustBatchMatch]);

  const adjustStockPackLabels = useMemo(() => {
    if (!adjustMedicine) return null;
    const tpp = getMedicineTabletsPerPack(adjustMedicine);
    return {
      tpp,
      ...quantityPerPackFieldLabels({
        isGeneral: isGeneralMedicineProfile(adjustMedicine),
        unitType: effectiveMedicineUnitType(adjustMedicine),
      }),
    };
  }, [adjustMedicine]);

  useEffect(() => {
    if (!adjustMedicine || !newBatch.batchNo.trim()) return;
    const hit = findBatchByBatchNoNormalized(adjustMedicine, newBatch.batchNo);
    if (hit) applyAutofillFromMatchedBatch(adjustMedicine, newBatch.batchNo);
  }, [adjustMedicine, newBatch.batchNo, applyAutofillFromMatchedBatch]);

  useEffect(() => {
    if (!activeMedicineId) return;
    const node = rowRefs.current[activeMedicineId];
    if (node) node.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [activeMedicineId]);

  useEffect(() => {
    if (!adjustMedicineId) return;
    const t = window.setTimeout(() => adjustQtyRef.current?.focus(), 30);
    return () => window.clearTimeout(t);
  }, [adjustMedicineId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
        return;
      }
      if (viewMedicineId || adjustMedicineId || editOpen) return;
      const target = e.target as HTMLElement | null;
      const isTypingTarget =
        !!target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);
      if (isTypingTarget) return;
      if (!filtered.length) return;

      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const idx = activeMedicineId ? filtered.findIndex((m) => m.id === activeMedicineId) : -1;
        const nextIdx =
          e.key === 'ArrowDown'
            ? Math.min(filtered.length - 1, Math.max(0, idx + 1))
            : Math.max(0, idx <= 0 ? 0 : idx - 1);
        setActiveMedicineId(filtered[nextIdx]!.id);
        return;
      }
      if (e.key === 'Enter' && activeMedicineId) {
        e.preventDefault();
        openAdjustMedicine(activeMedicineId);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeMedicineId, adjustMedicineId, editOpen, filtered, openAdjustMedicine, viewMedicineId]);

  return (
    <div className={cn('h-full min-h-0 w-full min-w-0 flex flex-col gap-4 sm:gap-5 lg:gap-6 p-3 sm:p-4 md:p-5 lg:p-6 overflow-y-auto', PAGE_BG)}>
      <header className="shrink-0 max-w-[min(100%,1920px)] mx-auto w-full">
        <div>
          <h1 className="fluid-h1 font-black tracking-tight text-slate-900 dark:text-zinc-50">
            Inventory
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400 max-w-xl mt-1 leading-relaxed">
            Smart stock overview — restock and expiry signals at a glance. Live totals sync with POS.
          </p>
        </div>
      </header>

      {/* Summary cards */}
      <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-3 lg:gap-4 shrink-0 max-w-[min(100%,1920px)] mx-auto w-full">
        <motion.button
          type="button"
          layout
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.99 }}
          onClick={() => applySummaryCard('all')}
          className={cn(
            'text-left rounded-[20px] bg-white dark:bg-zinc-900/80 p-4 sm:p-5 shadow-sm ring-1 ring-slate-200/80 dark:ring-zinc-800 transition-shadow hover:shadow-md',
            status === 'all' && !expiringOnly && 'ring-2 ring-primary/40 shadow-md'
          )}
        >
          <div className="flex items-start justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
              Total medicines
            </span>
            <Package className="w-4 h-4 text-slate-400" aria-hidden />
          </div>
          <div className="mt-3 text-3xl font-black tabular-nums text-slate-900 dark:text-white">
            {stats.totalMedicines}
          </div>
        </motion.button>

        <motion.button
          type="button"
          layout
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.99 }}
          onClick={() => applySummaryCard('low')}
          className={cn(
            'text-left rounded-[20px] bg-white dark:bg-zinc-900/80 p-4 sm:p-5 shadow-sm ring-1 ring-slate-200/80 dark:ring-zinc-800 transition-shadow hover:shadow-md',
            status === 'low' && 'ring-2 ring-amber-400/50 shadow-md'
          )}
        >
          <div className="flex items-start justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
              Low stock
            </span>
            <TrendingDown className="w-4 h-4 text-amber-500" aria-hidden />
          </div>
          <div className="mt-3 text-3xl font-black tabular-nums text-amber-700 dark:text-amber-300">
            {stats.lowStockCount}
          </div>
        </motion.button>

        <motion.button
          type="button"
          layout
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.99 }}
          onClick={() => applySummaryCard('expiring')}
          className={cn(
            'text-left rounded-[20px] bg-white dark:bg-zinc-900/80 p-4 sm:p-5 shadow-sm ring-1 ring-slate-200/80 dark:ring-zinc-800 transition-shadow hover:shadow-md',
            status === 'expiring' && 'ring-2 ring-amber-400/50 shadow-md'
          )}
        >
          <div className="flex items-start justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
              Expiring soon
            </span>
            <CalendarClock className="w-4 h-4 text-amber-500" aria-hidden />
          </div>
          <div className="mt-3 text-3xl font-black tabular-nums text-amber-800 dark:text-amber-200">
            {stats.expiringSoonCount}
          </div>
        </motion.button>

        <motion.button
          type="button"
          layout
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.99 }}
          onClick={() => applySummaryCard('out')}
          className={cn(
            'text-left rounded-[20px] bg-white dark:bg-zinc-900/80 p-4 sm:p-5 shadow-sm ring-1 ring-slate-200/80 dark:ring-zinc-800 transition-shadow hover:shadow-md',
            status === 'out' && 'ring-2 ring-red-400/45 shadow-md'
          )}
        >
          <div className="flex items-start justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
              Out of stock
            </span>
            <Ban className="w-4 h-4 text-red-500" aria-hidden />
          </div>
          <div className="mt-3 text-3xl font-black tabular-nums text-red-600 dark:text-red-300">
            {stats.outOfStockCount}
          </div>
        </motion.button>

        <motion.button
          type="button"
          layout
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.99 }}
          onClick={() => applySummaryCard('value')}
          className="col-span-2 sm:col-span-3 lg:col-span-1 text-left rounded-[20px] bg-white dark:bg-zinc-900/80 p-4 sm:p-5 shadow-sm ring-1 ring-slate-200/80 dark:ring-zinc-800 transition-shadow hover:shadow-md"
        >
          <div className="flex items-start justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
              Inventory value (cost)
            </span>
            <Wallet className="w-4 h-4 text-slate-400" aria-hidden />
          </div>
          <div className="mt-3 text-2xl sm:text-3xl font-black tabular-nums text-slate-900 dark:text-white">
            {formatCurrency(stats.totalValueAtCost)}
          </div>
        </motion.button>
      </section>

      {/* Search + filters */}
      <section className="max-w-[min(100%,1920px)] mx-auto w-full rounded-[22px] bg-white dark:bg-zinc-900/70 p-3 sm:p-4 lg:p-5 shadow-sm ring-1 ring-slate-200/80 dark:ring-zinc-800 space-y-3 sm:space-y-4 shrink-0">
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input
            ref={searchRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search medicine, generic, batch…"
            className="w-full rounded-[18px] border border-slate-200 bg-slate-50 py-3.5 pl-12 pr-4 text-base font-medium text-slate-900 placeholder:text-slate-400 shadow-inner focus:border-primary/40 focus:bg-white focus:outline-none focus:ring-4 focus:ring-primary/15 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
          />
        </div>

        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-zinc-400">
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Status
            </span>
            <div className="inline-flex flex-wrap gap-1.5 rounded-full bg-slate-100 p-1 dark:bg-zinc-800/80">
              {statusPills.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setStatus(p.id);
                    if (p.id !== 'expiring') setExpiringOnly(false);
                  }}
                  className={cn(
                    'rounded-full px-3.5 py-1.5 text-xs font-bold transition-all',
                    status === p.id
                      ? 'bg-white text-slate-900 shadow-sm dark:bg-zinc-900 dark:text-white'
                      : 'text-slate-600 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-200'
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <label className="inline-flex cursor-pointer items-center gap-3 select-none">
            <span className="text-sm font-semibold text-slate-700 dark:text-zinc-300">Show only expiring</span>
            <button
              type="button"
              role="switch"
              aria-checked={expiringOnly}
              onClick={() => setExpiringOnly((v) => !v)}
              className={cn(
                'relative h-8 w-14 rounded-full transition-colors',
                expiringOnly ? 'bg-primary' : 'bg-slate-200 dark:bg-zinc-700'
              )}
            >
              <span
                className={cn(
                  'absolute top-1 left-1 h-6 w-6 rounded-full bg-white shadow transition-transform',
                  expiringOnly && 'translate-x-6'
                )}
              />
            </button>
          </label>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <span className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-zinc-400 shrink-0">
            Category
          </span>
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-thin">
            <button
              type="button"
              onClick={() => setCategory('all')}
              className={cn(
                'shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-bold transition-all',
                category === 'all'
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300'
              )}
            >
              All
            </button>
            {categories.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                className={cn(
                  'shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-bold transition-all',
                  category === c
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300'
                )}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Main list */}
      <div className="flex-1 min-h-0 flex flex-col gap-3 overflow-y-auto pr-1 pb-2 max-w-[min(100%,1920px)] mx-auto w-full">
        <AnimatePresence mode="popLayout" initial={false}>
          {filtered.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="rounded-[22px] border border-dashed border-slate-200 bg-white/80 py-16 text-center text-sm font-medium text-slate-500 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-400"
            >
              <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-amber-500 opacity-80" />
              No medicines match your filters.
            </motion.div>
          ) : (
            filtered.map((m) => {
              const avail = getMedicineAvailability(m);
              const nb = nearestSellableBatch(m);
              const nextExp = nb?.expiryDate ?? null;
              const tone = expiryToneForDate(nextExp);
              const styles = toneStyles(tone);
              const barPct = stockBarPercent(avail.sellableQty);
              const tppCard = getMedicineTabletsPerPack(m);
              const purchase =
                nb && tppCard >= 2
                  ? costPerPackFromTablet(nb.costPricePerTablet, tppCard)
                  : (nb?.costPricePerTablet ?? null);
              const sale =
                nb && tppCard >= 2 ? nb.salePricePerPack : (nb?.salePricePerTablet ?? avail.displayPrice);

              return (
                <motion.article
                  layout
                  key={m.id}
                  ref={(el) => {
                    rowRefs.current[m.id] = el as HTMLDivElement | null;
                  }}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                  className={cn(
                    'group rounded-[20px] bg-white dark:bg-zinc-900/75 p-4 sm:p-5 shadow-sm ring-1 ring-slate-200/70 dark:ring-zinc-800 transition-[box-shadow,transform] hover:-translate-y-0.5 hover:shadow-md',
                    activeMedicineId === m.id && 'ring-2 ring-primary/45 bg-primary/[0.05] dark:bg-primary/10'
                  )}
                  onClick={() => setActiveMedicineId(m.id)}
                >
                  <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:gap-6">
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-white">
                          {m.name}
                        </h2>
                        <span
                          className={cn(
                            'rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide',
                            avail.status === 'out' && 'bg-red-500/12 text-red-700 dark:text-red-300',
                            avail.status === 'low' && 'bg-amber-500/12 text-amber-800 dark:text-amber-200',
                            avail.status === 'ok' && 'bg-emerald-500/12 text-emerald-800 dark:text-emerald-200'
                          )}
                        >
                          {avail.status === 'out'
                            ? 'Critical'
                            : avail.status === 'low'
                              ? 'Low stock'
                              : 'Healthy'}
                        </span>
                      </div>
                      <p className="text-sm text-slate-500 dark:text-zinc-400 line-clamp-2">{m.generic}</p>
                      <p className="text-[11px] font-medium text-slate-500/90 dark:text-zinc-500">
                        <span className="text-slate-400 dark:text-zinc-600">Mfr.</span> {displayManufacturer(m)}
                      </p>
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600 dark:bg-zinc-800 dark:text-zinc-300">
                        <Pill className="h-3.5 w-3.5 opacity-70" />
                        {m.category}
                      </span>
                    </div>

                    <div className="flex-1 min-w-[200px] max-w-xl space-y-2">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-zinc-400">
                          On hand
                        </span>
                        <span className="text-sm font-black tabular-nums text-slate-900 dark:text-white">
                          {formatPacksPlusTablets(avail.sellableQty, getMedicineTabletsPerPack(m), m.unit)}
                        </span>
                      </div>
                      <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-zinc-800">
                        <motion.div
                          className={cn(
                            'h-full rounded-full',
                            avail.status === 'out' && 'bg-red-500',
                            avail.status === 'low' && 'bg-amber-500',
                            avail.status === 'ok' && 'bg-emerald-500'
                          )}
                          initial={{ width: 0 }}
                          animate={{ width: `${barPct}%` }}
                          transition={{ type: 'spring', stiffness: 260, damping: 28, delay: 0.05 }}
                        />
                      </div>
                      <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-zinc-400">
                        <Layers className="h-3.5 w-3.5" />
                        {m.batches.length} batch{m.batches.length === 1 ? '' : 'es'}
                      </div>
                    </div>

                    <div className="shrink-0 space-y-3 xl:w-56">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-zinc-500">
                          Nearest expiry
                        </p>
                        <p className="text-sm font-bold text-slate-800 dark:text-zinc-100">
                          {nextExp ? format(parseLocalDay(nextExp), 'MMM d, yyyy') : '—'}
                        </p>
                        <span className={cn('mt-1 inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold', styles.chip)}>
                          {expirySummary(nextExp)}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded-xl bg-slate-50 px-3 py-2 dark:bg-zinc-800/80">
                          <p className="font-bold text-slate-500 dark:text-zinc-400">
                            Purchase / {tppCard >= 2 ? 'pack' : 'unit'}
                          </p>
                          <p className="mt-0.5 font-black tabular-nums text-slate-900 dark:text-white">
                            {purchase != null ? formatCurrency(purchase) : '—'}
                          </p>
                        </div>
                        <div className="rounded-xl bg-slate-50 px-3 py-2 dark:bg-zinc-800/80">
                          <p className="font-bold text-slate-500 dark:text-zinc-400">
                            Sale / {tppCard >= 2 ? 'pack' : 'unit'}
                          </p>
                          <p className="mt-0.5 font-black tabular-nums text-slate-900 dark:text-white">
                            {sale != null ? formatCurrency(sale) : '—'}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div
                      className="flex flex-wrap gap-2 xl:flex-col xl:items-stretch xl:min-w-[200px]"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={() => openViewMedicine(m.id)}
                        className="inline-flex flex-1 items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-800 shadow-sm hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
                      >
                        View
                        <ChevronRight className="h-3.5 w-3.5 opacity-60" />
                      </button>
                      <button
                        type="button"
                        onClick={() => openAdjustMedicine(m.id)}
                        className="inline-flex flex-1 items-center justify-center rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground shadow-md shadow-primary/20 hover:brightness-[1.03]"
                      >
                        Adjust stock
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditMedicineId(m.id);
                          setEditForm({
                            name: m.name,
                            generic: m.generic,
                            category: m.category,
                            unit: m.unit,
                          });
                          setEditOpen(true);
                        }}
                        className="inline-flex flex-1 items-center justify-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Edit
                      </button>
                    </div>
                  </div>
                </motion.article>
              );
            })
          )}
        </AnimatePresence>
      </div>

      {/* View — all batches (read-only, FEFO table) */}
      <AnimatePresence>
        {viewMedicine && (
          <motion.div
            className="fixed inset-0 z-[55] flex items-end justify-center p-4 sm:items-center sm:p-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.button
              type="button"
              aria-label="Close"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/50 backdrop-blur-[4px]"
              onClick={closeView}
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="inventory-view-title"
              initial={{ opacity: 0, y: 20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 420, damping: 34 }}
              className="relative z-10 flex max-h-[min(92vh,820px)] w-full max-w-4xl flex-col overflow-hidden rounded-[24px] bg-white shadow-2xl ring-1 ring-slate-200/90 dark:bg-zinc-950 dark:ring-zinc-800"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-zinc-800">
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-widest text-primary">All batches</p>
                  <h3
                    id="inventory-view-title"
                    className="mt-0.5 truncate text-lg font-black tracking-tight text-slate-900 dark:text-white"
                  >
                    {viewMedicine.name}
                  </h3>
                  <p className="line-clamp-2 text-xs text-slate-500 dark:text-zinc-400">{viewMedicine.generic}</p>
                  <p className="mt-1 text-[11px] font-medium text-slate-500 dark:text-zinc-500">
                    <span className="text-slate-400 dark:text-zinc-600">Mfr.</span> {displayManufacturer(viewMedicine)}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <p className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold text-slate-600 dark:bg-zinc-800 dark:text-zinc-300">
                      <Layers className="h-3 w-3 opacity-70" />
                      {viewMedicine.batches.length} lot{viewMedicine.batches.length === 1 ? '' : 's'} · {viewMedicine.unit}
                    </p>
                    <p className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800 dark:text-emerald-200">
                      Sellable{' '}
                      {formatPacksPlusTablets(
                        getMedicineAvailability(viewMedicine).sellableQty,
                        getMedicineTabletsPerPack(viewMedicine),
                        viewMedicine.unit
                      )}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={closeView}
                  className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-900"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
                <p className="mb-3 text-xs text-slate-600 dark:text-zinc-400">
                  Sorted by soonest expiry first (FEFO). Every lot on file for this product is listed below.
                </p>
                {viewMedicine.batches.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 py-12 text-center text-sm text-slate-500 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-400">
                    No batches on file for this medicine.
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-zinc-800">
                    <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                      <thead className="sticky top-0 z-[1] border-b border-slate-200 bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-500 dark:border-zinc-700 dark:bg-zinc-900/80 dark:text-zinc-400">
                        <tr>
                          <th className="px-3 py-2.5">Batch</th>
                          <th className="px-3 py-2.5">Expiry</th>
                          <th className="px-3 py-2.5">Status</th>
                          <th className="px-3 py-2.5 text-right">On hand</th>
                          <th className="px-3 py-2.5 text-right">
                            {getMedicineTabletsPerPack(viewMedicine) >= 2 ? 'Purchase / pack' : 'Purchase / unit'}
                          </th>
                          <th className="px-3 py-2.5 text-right">
                            {getMedicineTabletsPerPack(viewMedicine) >= 2 ? 'Sale / pack' : 'Sale / unit'}
                          </th>
                          <th className="px-3 py-2.5 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                        {sortedBatches(viewMedicine).map((b) => {
                          const tpp = getMedicineTabletsPerPack(viewMedicine);
                          const tone = expiryToneForDate(b.expiryDate);
                          const st = toneStyles(tone);
                          const purchaseDisplay =
                            tpp >= 2 ? costPerPackFromTablet(b.costPricePerTablet, tpp) : b.costPricePerTablet;
                          const saleDisplay = tpp >= 2 ? b.salePricePerPack : b.salePricePerTablet;
                          return (
                            <tr key={b.id} className="bg-white dark:bg-zinc-950/40">
                              <td className="px-3 py-2.5 font-mono text-xs font-bold text-slate-800 dark:text-zinc-100">
                                {b.batchNo}
                              </td>
                              <td className="px-3 py-2.5 tabular-nums text-slate-700 dark:text-zinc-200">
                                {format(parseLocalDay(b.expiryDate), 'MMM d, yyyy')}
                              </td>
                              <td className="px-3 py-2.5">
                                <span
                                  className={cn('inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold', st.chip)}
                                >
                                  {isExpired(b.expiryDate) ? 'Expired' : expirySummary(b.expiryDate)}
                                </span>
                              </td>
                              <td className="px-3 py-2.5 text-right font-bold tabular-nums text-slate-900 dark:text-white">
                                {formatPacksPlusTablets(b.totalTablets, tpp, viewMedicine.unit)}
                              </td>
                              <td className="px-3 py-2.5 text-right tabular-nums text-slate-700 dark:text-zinc-200">
                                {formatCurrency(purchaseDisplay)}
                              </td>
                              <td className="px-3 py-2.5 text-right tabular-nums text-slate-700 dark:text-zinc-200">
                                {formatCurrency(saleDisplay)}
                              </td>
                              <td className="px-3 py-2.5 text-right">
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (
                                      !window.confirm(
                                        `Delete batch “${b.batchNo}”? This will remove the full lot from inventory.`
                                      )
                                    )
                                      return;
                                    removeBatchFromMedicine(viewMedicine.id, b.id);
                                    showToast(`Batch “${b.batchNo}” deleted.`, 'success');
                                  }}
                                  className="inline-flex items-center justify-center rounded-lg border border-slate-200 p-1.5 text-red-600 transition hover:bg-red-50 dark:border-zinc-700 dark:text-red-400 dark:hover:bg-red-950/30"
                                  title="Delete batch"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="flex shrink-0 flex-wrap gap-2 border-t border-slate-100 bg-slate-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
                <button
                  type="button"
                  onClick={closeView}
                  className="min-w-[120px] flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-bold dark:border-zinc-700"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => {
                    openAdjustMedicine(viewMedicine.id);
                    closeView();
                  }}
                  className="min-w-[120px] flex-1 rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground"
                >
                  Adjust stock
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Adjust stock — receive packs; merge into existing batch when batch no matches */}
      <AnimatePresence>
        {adjustMedicine && (
          <motion.div
            className="fixed inset-0 z-[56] flex items-end justify-center p-4 sm:items-center sm:p-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.button
              type="button"
              aria-label="Close adjust stock"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/50 backdrop-blur-[4px]"
              onClick={closeAdjust}
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="inventory-adjust-title"
              initial={{ opacity: 0, y: 20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 420, damping: 34 }}
              className="relative z-10 flex max-h-[min(92vh,760px)] w-full max-w-lg flex-col overflow-hidden rounded-[24px] bg-white shadow-2xl ring-1 ring-slate-200/90 dark:bg-zinc-950 dark:ring-zinc-800"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.preventDefault();
                  closeAdjust();
                }
              }}
            >
              <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-zinc-800">
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-widest text-primary">Adjust stock</p>
                  <h3
                    id="inventory-adjust-title"
                    className="mt-0.5 truncate text-lg font-black tracking-tight text-slate-900 dark:text-white"
                  >
                    Receive stock
                  </h3>
                  <p className="mt-0.5 text-sm font-semibold text-slate-700 dark:text-zinc-300">{adjustMedicine.name}</p>
                  <p className="line-clamp-1 text-xs text-slate-500 dark:text-zinc-400">{adjustMedicine.generic}</p>
                </div>
                <button
                  type="button"
                  onClick={closeAdjust}
                  className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-900"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
                {adjustBatchMatch && (
                  <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50/90 px-3 py-2.5 text-xs text-emerald-950 dark:border-emerald-800/60 dark:bg-emerald-950/30 dark:text-emerald-100">
                    <strong className="font-black">Existing batch.</strong> This batch number is already on file. You can
                    change expiry and prices below — saving updates the <strong className="font-black">entire</strong> lot.
                    Add commercial packs if you are receiving stock; leave packs at 0 to only update expiry and prices.
                    No duplicate lot is created.
                  </div>
                )}
                <form id="inventory-adjust-form" onSubmit={submitAdjustStock} className="grid grid-cols-2 gap-3">
                  <label className="col-span-2 text-xs font-bold text-slate-500 dark:text-zinc-400">
                    Batch no.
                    <input
                      required
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-mono dark:border-zinc-700 dark:bg-zinc-900"
                      value={newBatch.batchNo}
                      onChange={(e) => setNewBatch((s) => ({ ...s, batchNo: e.target.value }))}
                      placeholder="Scan or type batch number"
                    />
                  </label>
                  <label className="text-xs font-bold text-slate-500 dark:text-zinc-400">
                    Expiry
                    <input
                      type="date"
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                      value={newBatch.expiryDate}
                      onChange={(e) => setNewBatch((s) => ({ ...s, expiryDate: e.target.value }))}
                    />
                  </label>
                  <label className="text-xs font-bold text-slate-500 dark:text-zinc-400">
                    Quantity (commercial packs)
                    <input
                      ref={adjustQtyRef}
                      type="number"
                      min={0}
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                      value={newBatch.quantityPackets || ''}
                      onChange={(e) => {
                        setAdjustInlineError(null);
                        setNewBatch((s) => ({ ...s, quantityPackets: Number(e.target.value) }));
                      }}
                    />
                  </label>
                  <label className="text-xs font-bold text-slate-500 dark:text-zinc-400">
                    Quantity (loose {adjustStockPackLabels!.looseStockPlural})
                    <input
                      type="number"
                      min={0}
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                      value={newBatch.quantityTablets || ''}
                      onChange={(e) => {
                        setAdjustInlineError(null);
                        setNewBatch((s) => ({ ...s, quantityTablets: Number(e.target.value) }));
                      }}
                    />
                  </label>
                  <p className="col-span-2 text-[11px] leading-snug text-slate-500 dark:text-zinc-400">
                    Pack size:{' '}
                    <span className="font-bold text-slate-700 dark:text-zinc-200">
                      {adjustStockPackLabels!.tpp} {adjustStockPackLabels!.perPackPhrase}
                    </span>
                    . Stock is stored in {adjustStockPackLabels!.looseStockPlural} (commercial packs × pack size + loose{' '}
                    {adjustStockPackLabels!.looseStockPlural}).
                    {adjustBatchMatch ? (
                      <>
                        {' '}
                        For an existing batch, leave both quantities at <span className="font-bold">0</span> if you only
                        need to correct expiry or pricing.
                      </>
                    ) : null}
                  </p>
                  <label className="text-xs font-bold text-slate-500 dark:text-zinc-400">
                    {getMedicineTabletsPerPack(adjustMedicine) >= 2 ? 'Purchase price / pack' : 'Purchase price / unit'}
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                      value={newBatch.purchasePricePerPack || ''}
                      onChange={(e) =>
                        setNewBatch((s) => ({ ...s, purchasePricePerPack: Number(e.target.value) }))
                      }
                    />
                  </label>
                  <label className="text-xs font-bold text-slate-500 dark:text-zinc-400">
                    {getMedicineTabletsPerPack(adjustMedicine) >= 2 ? 'Sale price / pack' : 'Sale price / unit'}
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                      value={newBatch.salePricePerPack || ''}
                      onChange={(e) => setNewBatch((s) => ({ ...s, salePricePerPack: Number(e.target.value) }))}
                    />
                  </label>
                  {adjustInlineError ? (
                    <p className="col-span-2 text-xs font-semibold text-red-600 dark:text-red-400">{adjustInlineError}</p>
                  ) : null}
                  {adjustPreview ? (
                    <div className="col-span-2 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2 text-xs text-slate-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
                      <p className="font-bold">
                        Preview · Batch <span className="font-mono">{adjustPreview.batchNo}</span>
                      </p>
                      <p className="mt-0.5">
                        Current {formatPacksPlusTablets(adjustPreview.currentTablets, adjustPreview.tpp, adjustMedicine.unit)}
                        {adjustPreview.addTablets > 0
                          ? ` + ${adjustPreview.addPacks} pack${adjustPreview.addPacks === 1 ? '' : 's'} + ${adjustPreview.directTablets} ${adjustMedicine.unit}${adjustPreview.directTablets === 1 ? '' : 's'} = ${formatPacksPlusTablets(
                              adjustPreview.projectedTablets,
                              adjustPreview.tpp,
                              adjustMedicine.unit
                            )} after save`
                          : ' (no stock add yet)'}
                      </p>
                    </div>
                  ) : null}
                </form>
              </div>

              <div className="flex shrink-0 gap-2 border-t border-slate-100 bg-slate-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
                <button
                  type="button"
                  onClick={closeAdjust}
                  className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-bold dark:border-zinc-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  form="inventory-adjust-form"
                  className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground"
                >
                  Save
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit modal */}
      <AnimatePresence>
        {editOpen && editMedicine && (
          <motion.div
            className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <button
              type="button"
              className="absolute inset-0 bg-slate-900/50"
              onClick={() => {
                setEditOpen(false);
                setEditMedicineId(null);
              }}
            />
            <motion.form
              onSubmit={saveEdit}
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 12, opacity: 0 }}
              className="relative z-10 w-full max-w-md rounded-[22px] bg-white p-6 shadow-2xl ring-1 ring-slate-200 dark:bg-zinc-950 dark:ring-zinc-800 space-y-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-black">Edit medicine</h3>
                <button
                  type="button"
                  onClick={() => {
                    setEditOpen(false);
                    setEditMedicineId(null);
                  }}
                  className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-zinc-900"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <label className="text-xs font-bold text-slate-500 block">
                Name
                <input
                  className="mt-1 w-full rounded-xl border px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                  value={editForm.name}
                  onChange={(e) => setEditForm((s) => ({ ...s, name: e.target.value }))}
                />
              </label>
              <label className="text-xs font-bold text-slate-500 block">
                Generic
                <input
                  className="mt-1 w-full rounded-xl border px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                  value={editForm.generic}
                  onChange={(e) => setEditForm((s) => ({ ...s, generic: e.target.value }))}
                />
              </label>
              <label className="text-xs font-bold text-slate-500 block">
                Category
                <input
                  className="mt-1 w-full rounded-xl border px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                  value={editForm.category}
                  onChange={(e) => setEditForm((s) => ({ ...s, category: e.target.value }))}
                />
              </label>
              <label className="text-xs font-bold text-slate-500 block">
                Unit
                <input
                  className="mt-1 w-full rounded-xl border px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                  value={editForm.unit}
                  onChange={(e) => setEditForm((s) => ({ ...s, unit: e.target.value }))}
                />
              </label>
              <button type="submit" className="w-full rounded-xl bg-slate-900 py-3 text-sm font-bold text-white dark:bg-white dark:text-slate-900">
                Save changes
              </button>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

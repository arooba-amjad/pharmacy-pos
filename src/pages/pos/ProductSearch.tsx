import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Search, Barcode, AlertTriangle, FlaskConical } from 'lucide-react';
import { pickDefaultBatch, usePOSBillingStore } from '@/store/usePOSBillingStore';
import { useToastStore } from '@/store/useToastStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useSubstitutionAnalyticsStore, type SubstitutionPickSource } from '@/store/useSubstitutionAnalyticsStore';
import {
  getMedicineAvailabilityWithCart,
  medicineMatchesQuery,
} from '@/lib/posSearchHelpers';
import {
  effectiveMedicineUnitType,
  isGeneralMedicineProfile,
  posLooseSellShortLabel,
  quantityPerPackFieldLabels,
} from '@/lib/medicinePackLabels';
import { formatPacksPlusTablets, getMedicineTabletsPerPack } from '@/lib/stockUnits';
import { packetModeAvailable, tabletModeAvailable } from '@/lib/posCartQuantity';
import { cn, formatCurrency } from '@/lib/utils';
import { displayManufacturer, displayMedicineNameWithType } from '@/lib/medicineDisplay';
import { motion, AnimatePresence } from 'framer-motion';
import { SaltAlternativesModal } from '@/components/pos/SaltAlternativesModal';
import { DrugInteractionModal } from '@/components/pos/DrugInteractionModal';
import { PosAddQuantityModal } from '@/components/pos/PosAddQuantityModal';
import { checkIncomingMedicineAgainstCart, type DrugInteractionHit } from '@/lib/drugInteractionCheck';
import {
  anchorFromMedicine,
  findSaltAlternatives,
  resolveSaltAnchorFromQuery,
  type SaltAlternativeRow,
  type SaltAnchor,
} from '@/lib/saltAlternativeEngine';
import type { CartQuantityMode, Medicine } from '@/types';

type SaltPhase = 'prompt' | 'list';

type SubstitutionMeta = {
  source: SubstitutionPickSource;
  anchor: SaltAnchor | null;
  searchQuery?: string;
};

type PendingCartAdd = {
  medicineId: string;
  hits: DrugInteractionHit[];
  substitutionMeta?: SubstitutionMeta;
};

type PendingQtyPick = {
  medicineId: string;
  medicineName: string;
  tabletUnitLabel: string;
  looseModeLabel: string;
  canTablet: boolean;
  canPacket: boolean;
  defaultMode: CartQuantityMode;
  suggestedSalePerTablet: number;
  suggestedSalePerPack: number;
  substitutionMeta?: SubstitutionMeta;
};

export const ProductSearch: React.FC = () => {
  const medicines = usePOSBillingStore((s) => s.medicines);
  const cart = usePOSBillingStore((s) => s.cart);
  const addMedicineToCart = usePOSBillingStore((s) => s.addMedicineToCart);
  const posPricingChannel = usePOSBillingStore((s) => s.posPricingChannel);
  const showToast = useToastStore((s) => s.show);
  const defaultFocusSearch = useSettingsStore((s) => s.defaultFocusSearch);
  const barcodeModeEnabled = useSettingsStore((s) => s.barcodeModeEnabled);
  const allowNegativeStock = useSettingsStore((s) => s.allowNegativeStock);

  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const [saltOpen, setSaltOpen] = useState(false);
  const [saltPhase, setSaltPhase] = useState<SaltPhase>('prompt');
  const [saltTitle, setSaltTitle] = useState('Medicine not found');
  const [saltAnchor, setSaltAnchor] = useState<SaltAnchor | null>(null);
  const [saltRows, setSaltRows] = useState<SaltAlternativeRow[]>([]);
  const [saltResolveError, setSaltResolveError] = useState<string | null>(null);
  const [saltPickSource, setSaltPickSource] = useState<SubstitutionPickSource | null>(null);

  const [interactionOpen, setInteractionOpen] = useState(false);
  const [pendingCartAdd, setPendingCartAdd] = useState<PendingCartAdd | null>(null);
  const [pendingQty, setPendingQty] = useState<PendingQtyPick | null>(null);
  const pendingQtyRef = useRef<PendingQtyPick | null>(null);
  pendingQtyRef.current = pendingQty;

  const results = useMemo(() => {
    return medicines.filter((m) => medicineMatchesQuery(m, query));
  }, [medicines, query]);

  useEffect(() => {
    setSelectedIndex((i) => (results.length === 0 ? 0 : Math.min(i, results.length - 1)));
  }, [results.length, query]);

  const closeSaltModal = useCallback(() => {
    setSaltOpen(false);
    setSaltPhase('prompt');
    setSaltAnchor(null);
    setSaltRows([]);
    setSaltResolveError(null);
    setSaltTitle('Medicine not found');
    setSaltPickSource(null);
  }, []);

  const openSaltPrompt = useCallback(() => {
    setSaltTitle('Medicine not found');
    setSaltPhase('prompt');
    setSaltAnchor(null);
    setSaltRows([]);
    setSaltResolveError(null);
    setSaltPickSource(null);
    setSaltOpen(true);
  }, []);

  const runSaltAlternatives = useCallback(() => {
    const anchor = resolveSaltAnchorFromQuery(query, medicines);
    if (!anchor) {
      setSaltResolveError(
        'Could not map this search to active ingredients. Try a product name, a generic with + between salts (e.g. Amoxicillin + Clavulanic Acid), or a synonym such as co-amoxiclav.'
      );
      return;
    }
    setSaltResolveError(null);
    setSaltAnchor(anchor);
    const rows = findSaltAlternatives(anchor, medicines);
    setSaltRows(rows);
    setSaltPhase('list');
    setSaltTitle('Salt-based alternatives');
    setSaltPickSource('search_not_found');
    useSubstitutionAnalyticsStore.getState().logOpportunity({
      source: 'search_not_found',
      anchor,
      searchQuery: query,
      alternativesShown: rows.length,
    });
  }, [query, medicines]);

  const openOosAlternatives = useCallback(
    (m: Medicine) => {
      const anchor = anchorFromMedicine(m);
      setSaltTitle(`Alternatives · ${m.name}`);
      setSaltAnchor(anchor);
      const rows = findSaltAlternatives(anchor, medicines);
      setSaltRows(rows);
      setSaltResolveError(null);
      setSaltPhase('list');
      setSaltOpen(true);
      setSaltPickSource('out_of_stock');
      useSubstitutionAnalyticsStore.getState().logOpportunity({
        source: 'out_of_stock',
        anchor,
        alternativesShown: rows.length,
      });
    },
    [medicines]
  );

  const performAdd = useCallback(
    (
      medicineId: string,
      quantity: number,
      quantityMode: CartQuantityMode,
      substitutionMeta?: SubstitutionMeta,
      salePriceOverride?: number
    ) => {
      if (substitutionMeta) {
        useSubstitutionAnalyticsStore.getState().logPick({
          source: substitutionMeta.source,
          anchor: substitutionMeta.anchor,
          searchQuery: substitutionMeta.searchQuery,
          alternativeMedicineId: medicineId,
          medicines,
        });
      }
      const res = addMedicineToCart(medicineId, { quantity, quantityMode, salePriceOverride });
      if (!res.ok) showToast(res.message ?? 'Unable to add item', 'error');
      else {
        setQuery('');
        closeSaltModal();
        setPendingQty(null);
        inputRef.current?.focus();
        if (
          usePOSBillingStore.getState().posPricingChannel === 'wholesale' &&
          res.lineId
        ) {
          window.requestAnimationFrame(() =>
            document.getElementById(`line-price-${res.lineId}`)?.focus()
          );
        }
      }
    },
    [addMedicineToCart, showToast, closeSaltModal, medicines]
  );

  const openQuantityModal = useCallback(
    (medicineId: string, substitutionMeta?: SubstitutionMeta) => {
      const med = medicines.find((m) => m.id === medicineId);
      if (!med) {
        showToast('Product not found.', 'error');
        return;
      }
      const { previewQty } = getMedicineAvailabilityWithCart(med, cart);
      const tpp = getMedicineTabletsPerPack(med);
      const canTablet = tabletModeAvailable(previewQty);
      const canPacket = packetModeAvailable(previewQty, tpp);
      if (!canTablet && !canPacket) {
        showToast('No sellable quantity for this product.', 'error');
        return;
      }
      const batch = pickDefaultBatch(med);
      if (!batch) {
        showToast('No sellable batch for this product.', 'error');
        return;
      }
      const defaultMode: CartQuantityMode = canTablet ? 'tablet' : 'packet';
      const packLbl = quantityPerPackFieldLabels({
        isGeneral: isGeneralMedicineProfile(med),
        unitType: effectiveMedicineUnitType(med),
      });
      const tabletUnitLabel = (med.unit ?? '').trim() || packLbl.looseStockPlural;
      const suggestedSalePerTablet = Math.max(0.01, Math.round(batch.salePricePerTablet * 10000) / 10000);
      const suggestedSalePerPack = Math.max(
        0.01,
        Math.round((tpp >= 2 ? batch.salePricePerPack : batch.salePricePerTablet) * 100) / 100
      );
      setPendingQty({
        medicineId,
        medicineName: displayMedicineNameWithType(med),
        tabletUnitLabel,
        looseModeLabel: posLooseSellShortLabel(med),
        canTablet,
        canPacket,
        defaultMode,
        suggestedSalePerTablet,
        suggestedSalePerPack,
        substitutionMeta,
      });
    },
    [medicines, cart, showToast]
  );

  const tryAdd = useCallback(
    (medicineId: string, substitutionMeta?: SubstitutionMeta) => {
      const med = medicines.find((m) => m.id === medicineId);
      if (!med) {
        showToast('Product not found.', 'error');
        return;
      }
      const hits = checkIncomingMedicineAgainstCart(med, cart, medicines);
      if (hits.length > 0) {
        setPendingCartAdd({ medicineId, hits, substitutionMeta });
        setInteractionOpen(true);
        return;
      }
      openQuantityModal(medicineId, substitutionMeta);
    },
    [medicines, cart, openQuantityModal, showToast]
  );

  const handleInteractionCancel = useCallback(() => {
    setInteractionOpen(false);
    setPendingCartAdd(null);
  }, []);

  const handleInteractionContinue = useCallback(() => {
    if (!pendingCartAdd) return;
    const { medicineId, substitutionMeta } = pendingCartAdd;
    setInteractionOpen(false);
    setPendingCartAdd(null);
    openQuantityModal(medicineId, substitutionMeta);
  }, [pendingCartAdd, openQuantityModal]);

  const handlePickFromSaltModal = useCallback(
    (medicineId: string) => {
      if (saltPhase === 'list' && saltAnchor && saltPickSource) {
        tryAdd(medicineId, { source: saltPickSource, anchor: saltAnchor, searchQuery: query });
      } else {
        tryAdd(medicineId);
      }
    },
    [saltPhase, saltAnchor, saltPickSource, query, tryAdd]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (results.length === 0) return;
      setSelectedIndex((prev) => (prev + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (results.length === 0) return;
      setSelectedIndex((prev) => (prev - 1 + results.length) % results.length);
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      e.preventDefault();
      tryAdd(results[selectedIndex].id);
    }
  };

  useEffect(() => {
    if (defaultFocusSearch) inputRef.current?.focus();
  }, [defaultFocusSearch]);

  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (!e.altKey || e.key.toLowerCase() !== 'a') return;
      if (document.activeElement !== inputRef.current) return;
      if (results.length > 0 || !query.trim()) return;
      e.preventDefault();
      openSaltPrompt();
    };
    window.addEventListener('keydown', fn, true);
    return () => window.removeEventListener('keydown', fn, true);
  }, [results.length, query, openSaltPrompt]);

  const noMatches = results.length === 0 && query.trim().length > 0;

  return (
    <div className="flex flex-col h-full min-h-0 p-3 sm:p-4 bg-transparent">
      <DrugInteractionModal
        open={interactionOpen}
        hits={pendingCartAdd?.hits ?? []}
        onCancel={handleInteractionCancel}
        onContinue={handleInteractionContinue}
      />

      <PosAddQuantityModal
        open={!!pendingQty}
        medicineName={pendingQty?.medicineName ?? ''}
        tabletUnitLabel={pendingQty?.tabletUnitLabel ?? 'tablets'}
        looseModeLabel={pendingQty?.looseModeLabel ?? 'Tablet'}
        packModeLabel="Pack"
        wholesalePricingEnabled={posPricingChannel === 'wholesale'}
        suggestedSalePerTablet={pendingQty?.suggestedSalePerTablet ?? 0}
        suggestedSalePerPack={pendingQty?.suggestedSalePerPack ?? 0}
        canTablet={pendingQty?.canTablet ?? true}
        canPacket={pendingQty?.canPacket ?? false}
        defaultMode={pendingQty?.defaultMode ?? 'tablet'}
        onClose={() => setPendingQty(null)}
        onConfirm={(q, mode, saleOverride) => {
          const p = pendingQtyRef.current;
          if (!p) return;
          performAdd(p.medicineId, q, mode, p.substitutionMeta, saleOverride);
        }}
      />

      <SaltAlternativesModal
        open={saltOpen}
        phase={saltPhase}
        title={saltTitle}
        anchor={saltAnchor}
        rows={saltRows}
        resolveError={saltResolveError}
        cart={cart}
        onClose={closeSaltModal}
        onShowAlternatives={runSaltAlternatives}
        onPickMedicine={handlePickFromSaltModal}
      />

      <div className="relative mb-3 sm:mb-4 group no-drag shrink-0">
        <Search className="absolute left-3.5 sm:left-4 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4 sm:w-5 sm:h-5 group-focus-within:text-primary transition-colors pointer-events-none z-10" />
        <input
          id="pos-search-input"
          ref={inputRef}
          type="text"
          placeholder={
            barcodeModeEnabled
              ? 'Scan a barcode first — or type to search…'
              : 'Scan barcode or search medicine…'
          }
          className={cn(
            'w-full rounded-[18px] sm:rounded-[20px] border border-slate-200/90 bg-white py-3 sm:py-4 pl-10 sm:pl-12 pr-10 sm:pr-12 text-sm sm:text-base text-foreground shadow-sm',
            'placeholder:text-muted-foreground/80',
            'transition-[box-shadow,border-color,transform] duration-200',
            'focus:border-primary/50 focus:outline-none focus:ring-0',
            'focus:shadow-[0_0_0_4px_rgba(13,148,136,0.12),0_8px_28px_-6px_rgba(15,23,42,0.12)]',
            'dark:border-border/70 dark:bg-card/70 dark:focus:border-primary/45'
          )}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          autoComplete="off"
          spellCheck={false}
        />
        <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center pointer-events-none text-muted-foreground/45">
          <Barcode className="w-5 h-5" strokeWidth={2} />
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-2 custom-scrollbar">
        <AnimatePresence mode="popLayout">
          {results.map((medicine, index) => {
            const { sellableQty, displayPrice, status, expiringSoon, previewQty, reservedTablets } =
              getMedicineAvailabilityWithCart(medicine, cart);
            const isSelected = index === selectedIndex;
            const priceLabel = displayPrice != null ? `${formatCurrency(displayPrice)} / u` : '—';
            const stockLabel = formatPacksPlusTablets(
              sellableQty,
              getMedicineTabletsPerPack(medicine),
              medicine.unit
            );
            const previewStockLabel = formatPacksPlusTablets(
              previewQty,
              getMedicineTabletsPerPack(medicine),
              medicine.unit
            );
            const blockedByCart =
              !allowNegativeStock && sellableQty > 0 && previewQty < 1 && reservedTablets > 0;
            const cannotAdd = status === 'out' || blockedByCart;

            return (
              <motion.div
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
                key={medicine.id}
                className={cn(
                  'w-full rounded-[20px] border p-4 transition-shadow duration-200',
                  isSelected
                    ? 'border-primary/45 bg-white shadow-[0_8px_28px_-8px_rgba(13,148,136,0.25)] ring-2 ring-primary/15'
                    : 'border-slate-200/80 bg-white/95 shadow-sm hover:shadow-md hover:border-slate-300/90 dark:border-border/60 dark:bg-card/50'
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <button
                    type="button"
                    disabled={cannotAdd}
                    onClick={() => {
                      if (cannotAdd) return;
                      tryAdd(medicine.id);
                    }}
                    className={cn(
                      'min-w-0 flex-1 text-left',
                      'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 rounded-xl',
                      cannotAdd && 'cursor-not-allowed opacity-60'
                    )}
                  >
                    <div className="flex justify-between items-start gap-3 mb-1">
                      <h3 className="font-bold text-[17px] leading-snug tracking-tight text-foreground">
                        {displayMedicineNameWithType(medicine)}
                      </h3>
                      <span className="text-primary font-extrabold text-lg tabular-nums shrink-0">{priceLabel}</span>
                    </div>
                    <p className="mb-1 line-clamp-2 text-sm leading-relaxed text-foreground/75 dark:text-zinc-300">
                      {medicine.generic}
                    </p>
                    <p className="mb-2 text-[11px] font-medium text-foreground/65 dark:text-zinc-400">
                      <span className="text-muted-foreground">Mfr.</span> {displayManufacturer(medicine)}
                    </p>
                  </button>
                  {status === 'out' || blockedByCart ? (
                    <button
                      type="button"
                      onClick={() => openOosAlternatives(medicine)}
                      className="shrink-0 inline-flex items-center gap-1.5 rounded-xl border border-sky-200 bg-sky-500/10 px-3 py-2 text-[11px] font-bold text-sky-900 hover:bg-sky-500/15 dark:border-sky-900/40 dark:text-sky-100"
                    >
                      <FlaskConical className="h-3.5 w-3.5" />
                      Salt alternatives
                    </button>
                  ) : null}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {blockedByCart && (
                    <span className="inline-flex items-center rounded-lg bg-slate-500/12 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-700 dark:text-slate-300">
                      In cart · {previewStockLabel} left (preview)
                    </span>
                  )}
                  {status === 'out' && (
                    <span className="inline-flex items-center rounded-lg bg-red-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-600 dark:text-red-400">
                      Out of stock
                    </span>
                  )}
                  {status === 'low' && !blockedByCart && (
                    <span className="inline-flex items-center rounded-lg bg-amber-500/12 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-400">
                      Low stock · {stockLabel}
                    </span>
                  )}
                  {status === 'ok' && !blockedByCart && (
                    <span className="inline-flex items-center rounded-lg bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
                      In stock · {stockLabel}
                      {reservedTablets > 0 ? (
                        <span className="ml-1 font-semibold normal-case opacity-90">
                          → {previewStockLabel} after cart
                        </span>
                      ) : null}
                    </span>
                  )}
                  {expiringSoon && status !== 'out' && (
                    <span className="inline-flex items-center gap-1 rounded-lg bg-orange-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-orange-600 dark:text-orange-400">
                      <AlertTriangle className="w-3 h-3" />
                      Expiry soon
                    </span>
                  )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {query.trim().length === 0 && (
          <div className="rounded-[20px] border border-dashed border-border/80 bg-white/60 py-10 text-center text-sm text-muted-foreground">
            Type a name, brand, salt, or batch code. No matches yet shows salt-based alternatives (same therapeutic
            class). Cart additions are checked for salt-level drug interactions.
          </div>
        )}

        {noMatches && (
          <div className="rounded-[20px] border border-dashed border-amber-200/90 bg-amber-500/5 px-5 py-8 text-center dark:border-amber-900/40 dark:bg-amber-500/10">
            <p className="text-sm font-semibold text-foreground">Medicine not found</p>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              Search uses salts and names — not fuzzy guessing. Open alternatives to see same-class products that
              share active ingredients.
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={openSaltPrompt}
                className="rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-sm hover:opacity-95"
              >
                Show alternatives
              </button>
            </div>
            <p className="mt-3 text-[11px] text-muted-foreground">
              Shortcut: <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]">Alt</kbd> +{' '}
              <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]">A</kbd>
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

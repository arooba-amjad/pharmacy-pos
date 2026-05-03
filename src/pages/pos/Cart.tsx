import React, { useMemo } from 'react';
import { Minus, Plus, Trash2, ShoppingBag, TrendingUp, AlertTriangle } from 'lucide-react';
import type { Medicine } from '@/types';
import { usePOSBillingStore } from '@/store/usePOSBillingStore';
import { CustomerCreditBalanceStrip } from '@/components/pos/CustomerCreditBalanceStrip';
import { customerHasOutstandingCredit } from '@/lib/customerCreditAlerts';
import { useToastStore } from '@/store/useToastStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { formatCurrency, cn } from '@/lib/utils';
import { displayManufacturerForCartLine, displayMedicineNameWithType } from '@/lib/medicineDisplay';
import {
  canEnablePacketToggle,
  formatSellQuantityLabel,
  fullPacksAvailable,
  lineTotalTablets,
  packetModeAvailable,
} from '@/lib/posCartQuantity';
import {
  cartLineMarginPercent,
  cartLineSubtotal,
  formatCartBatchBreakdown,
  getStrictFefoHeadBatchId,
  preferredIsLaterExpiryThanBatch,
} from '@/lib/cartFefoAllocation';
import {
  cartReservedTabletsForMedicine,
  getMedicineAvailability,
  getMedicineAvailabilityWithCart,
} from '@/lib/posSearchHelpers';
import {
  effectiveMedicineUnitType,
  isGeneralMedicineProfile,
  posLooseSellShortLabel,
  quantityPerPackFieldLabels,
} from '@/lib/medicinePackLabels';
import { motion, AnimatePresence } from 'framer-motion';
import { isExpired, isExpiringSoon } from '@/lib/posDates';

function expiryTone(expiryDate: string, expDays: number): 'red' | 'yellow' | 'green' {
  if (isExpired(expiryDate)) return 'red';
  if (isExpiringSoon(expiryDate, expDays)) return 'yellow';
  return 'green';
}

export const Cart: React.FC = () => {
  const cart = usePOSBillingStore((s) => s.cart);
  const customer = usePOSBillingStore((s) => s.customer);
  const medicines = usePOSBillingStore((s) => s.medicines);
  const selectedLineId = usePOSBillingStore((s) => s.selectedLineId);
  const setSelectedLine = usePOSBillingStore((s) => s.setSelectedLine);
  const removeLine = usePOSBillingStore((s) => s.removeLine);
  const bumpLineQuantity = usePOSBillingStore((s) => s.bumpLineQuantity);
  const setLineQuantity = usePOSBillingStore((s) => s.setLineQuantity);
  const setLineBatch = usePOSBillingStore((s) => s.setLineBatch);
  const setLineUnitPrice = usePOSBillingStore((s) => s.setLineUnitPrice);
  const posPricingChannel = usePOSBillingStore((s) => s.posPricingChannel);
  const setLineQuantityMode = usePOSBillingStore((s) => s.setLineQuantityMode);
  const showToast = useToastStore((s) => s.show);
  const expDays = useSettingsStore((s) => Math.max(1, s.expiryAlertDays ?? 75));

  const batchOptions = useMemo(() => {
    const map = new Map<string, Medicine['batches']>();
    for (const m of medicines) map.set(m.id, m.batches);
    return map;
  }, [medicines]);

  const medicineById = useMemo(() => {
    const map = new Map<string, Medicine>();
    for (const m of medicines) map.set(m.id, m);
    return map;
  }, [medicines]);

  return (
    <div
      data-cart-root
      className="flex flex-col h-full min-h-0 bg-transparent overflow-hidden"
    >
      <div className="px-5 py-4 border-b border-slate-200/90 dark:border-border/40 flex justify-between items-center shrink-0 bg-white/70 dark:bg-transparent backdrop-blur-sm">
        <div className="flex items-center gap-3 min-w-0">
          <div className="bg-primary/12 p-2 rounded-[14px] ring-1 ring-primary/10 shadow-sm">
            <ShoppingBag className="text-primary w-5 h-5" strokeWidth={2.25} />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-bold tracking-tight leading-tight">Active cart</h2>
            <p className="text-[11px] text-muted-foreground font-medium">
              Tab qty → next line · ↑↓ lines · <span className="font-mono">T</span> loose ·{' '}
              <span className="font-mono">P</span> pack · * / − qty · Enter · Del
            </p>
          </div>
        </div>
        <div className="text-xs font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-full tabular-nums shrink-0">
          {cart.length} {cart.length === 1 ? 'line' : 'lines'}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2.5 custom-scrollbar">
        {customer && customerHasOutstandingCredit(customer) ? (
          <CustomerCreditBalanceStrip customer={customer} compact className="mb-1" />
        ) : null}
        <AnimatePresence initial={false} mode="popLayout">
          {cart.map((line, lineIndex) => {
            const batches = batchOptions.get(line.medicineId) ?? [];
            const selected = line.lineId === selectedLineId;
            const lineTotal = cartLineSubtotal(medicines, line);
            const mgn = cartLineMarginPercent(medicines, line);
            const med = medicineById.get(line.medicineId);
            const showPackToggle = canEnablePacketToggle(line);
            const sellableQty = med ? getMedicineAvailability(med).sellableQty : 0;
            const reserved = cartReservedTabletsForMedicine(cart, line.medicineId);
            const othersReserved = reserved - lineTotalTablets(line);
            const virtualForLine = Math.max(0, sellableQty - othersReserved);
            const canPacket = packetModeAvailable(virtualForLine, line.tabletsPerPack);
            const { previewQty } = med ? getMedicineAvailabilityWithCart(med, cart) : { previewQty: 0 };
            const fefoHead = med ? getStrictFefoHeadBatchId(medicines, cart, lineIndex, med.id) : null;
            const pref = line.preferredBatchId ?? null;
            const showLatePrefWarning =
              Boolean(pref && fefoHead && med && preferredIsLaterExpiryThanBatch(med, pref, fefoHead));
            const breakdown = formatCartBatchBreakdown(line);
            const packLbl = med
              ? quantityPerPackFieldLabels({
                  isGeneral: isGeneralMedicineProfile(med),
                  unitType: effectiveMedicineUnitType(med),
                })
              : null;
            const looseShort = med ? posLooseSellShortLabel(med) : 'Tablet';
            const loosePlural = packLbl?.looseStockPlural ?? 'tablets';

            return (
              <motion.div
                layout
                initial={{ opacity: 0, x: 28 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20, height: 0, marginBottom: 0 }}
                transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
                key={line.lineId}
                role="group"
                aria-label={med ? displayMedicineNameWithType(med) : line.name}
                tabIndex={-1}
                onClick={() => setSelectedLine(line.lineId)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelectedLine(line.lineId);
                    document.getElementById(`cart-qty-${line.lineId}`)?.focus();
                  }
                }}
                className={cn(
                  'rounded-[20px] border p-4 transition-all duration-200 outline-none cursor-pointer no-drag',
                  'focus-visible:ring-2 focus-visible:ring-primary/25',
                  line.allocationError ? 'border-red-400/70 ring-1 ring-red-200' : null,
                  selected
                    ? 'border-primary/50 bg-white shadow-[0_10px_36px_-12px_rgba(13,148,136,0.35)] ring-2 ring-primary/10'
                    : 'border-slate-200/85 bg-white/90 shadow-sm hover:shadow-md hover:border-slate-300/90 dark:border-border/50 dark:bg-card/35'
                )}
              >
                <div className="flex justify-between gap-3 items-start mb-3">
                  <div className="min-w-0">
                    <h3 className="font-bold text-base leading-snug tracking-tight">
                      {med ? displayMedicineNameWithType(med) : line.name}
                    </h3>
                    <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{line.generic}</p>
                    <p className="text-[10px] font-medium text-muted-foreground/90 mt-0.5">
                      <span className="text-muted-foreground/65">Mfr.</span>{' '}
                      {displayManufacturerForCartLine(line, medicines)}
                    </p>
                    <p className="text-[11px] font-semibold text-primary/90 mt-1.5 tabular-nums">
                      {formatSellQuantityLabel(line)}
                      <span className="text-muted-foreground font-medium">
                        {' '}
                        · {line.quantityMode === 'packet' ? 'Pack' : looseShort}
                      </span>
                    </p>
                    {line.allocationError ? (
                      <p className="text-[11px] font-bold text-red-600 mt-1">{line.allocationError}</p>
                    ) : null}
                  </div>
                  <div className="text-right shrink-0">
                    <span className="block font-extrabold text-lg tabular-nums">{formatCurrency(lineTotal)}</span>
                    <span className="text-[10px] text-muted-foreground font-medium tabular-nums">
                      × {formatCurrency(line.unitPrice)} / {line.quantityMode === 'packet' ? 'pack' : 'unit'}
                    </span>
                  </div>
                </div>

                {med ? (
                  <p className="text-[10px] font-semibold text-muted-foreground tabular-nums mb-2">
                    Shelf {loosePlural}:{' '}
                    <span className="text-foreground">{sellableQty}</span>
                    {' → '}
                    <span className={previewQty <= 0 && sellableQty > 0 ? 'text-amber-700' : 'text-foreground'}>
                      {previewQty}
                    </span>{' '}
                    after cart <span className="font-normal opacity-80">(preview)</span>
                  </p>
                ) : null}

                {showPackToggle ? (
                  <div
                    className="mb-3 flex flex-wrap items-center gap-2"
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                  >
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Sell as
                    </span>
                    <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50/90 p-0.5 dark:border-border/60 dark:bg-muted/30">
                      <button
                        type="button"
                        tabIndex={-1}
                        disabled={line.quantityMode === 'tablet'}
                        title={
                          line.quantityMode === 'tablet'
                            ? `Loose ${loosePlural}`
                            : `Switch to loose ${loosePlural} (T)`
                        }
                        onClick={() => {
                          if (line.quantityMode === 'tablet') return;
                          const r = setLineQuantityMode(line.lineId, 'tablet');
                          if (!r.ok) showToast(r.message ?? 'Cannot switch unit', 'error');
                        }}
                        className={cn(
                          'rounded-[10px] px-3 py-1.5 text-[11px] font-bold transition',
                          line.quantityMode === 'tablet'
                            ? 'bg-primary text-primary-foreground shadow-sm'
                            : 'text-slate-600 hover:bg-white disabled:opacity-50 dark:text-zinc-300 dark:hover:bg-card'
                        )}
                      >
                        {looseShort}
                      </button>
                      <button
                        type="button"
                        tabIndex={-1}
                        disabled={line.quantityMode === 'packet' || !canPacket}
                        title={
                          !canPacket
                            ? `Need ${line.tabletsPerPack} sellable ${loosePlural} across lots (after cart).`
                            : line.quantityMode === 'packet'
                              ? 'Commercial packs'
                              : 'Switch to commercial packs (P)'
                        }
                        onClick={() => {
                          if (line.quantityMode === 'packet' || !canPacket) return;
                          const r = setLineQuantityMode(line.lineId, 'packet');
                          if (!r.ok) showToast(r.message ?? 'Cannot switch unit', 'error');
                        }}
                        className={cn(
                          'rounded-[10px] px-3 py-1.5 text-[11px] font-bold transition',
                          line.quantityMode === 'packet'
                            ? 'bg-primary text-primary-foreground shadow-sm'
                            : 'text-slate-600 hover:bg-white disabled:opacity-45 dark:text-zinc-300 dark:hover:bg-card'
                        )}
                      >
                        Pack
                      </button>
                    </div>
                  </div>
                ) : null}

                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground sr-only">
                    Lot preference
                  </label>
                  <select
                    tabIndex={-1}
                    value={pref ?? ''}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => {
                      e.stopPropagation();
                      const v = e.target.value;
                      const res = setLineBatch(line.lineId, v === '' ? null : v);
                      if (!res.ok) showToast(res.message ?? 'Could not change batch', 'error');
                    }}
                    className={cn(
                      'text-xs font-semibold rounded-xl border border-slate-200 bg-slate-50/80 px-2.5 py-1.5 max-w-[min(100%,220px)]',
                      'focus:outline-none focus:ring-2 focus:ring-primary/20 dark:bg-muted/40 dark:border-border/60'
                    )}
                  >
                    <option value="">Auto (FEFO)</option>
                    {batches.map((b) => (
                      <option key={b.id} value={b.id} disabled={isExpired(b.expiryDate)}>
                        {b.batchNo} · exp {b.expiryDate} · {b.totalTablets} u
                        {showPackToggle && line.tabletsPerPack >= 2
                          ? ` · ${fullPacksAvailable(b.totalTablets, line.tabletsPerPack)} pk`
                          : ''}
                      </option>
                    ))}
                  </select>
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 text-[10px] font-bold tabular-nums rounded-lg px-2 py-1',
                      mgn >= 0
                        ? 'bg-emerald-500/8 text-emerald-700 dark:text-emerald-400'
                        : 'bg-red-500/10 text-red-600'
                    )}
                  >
                    <TrendingUp className="w-3 h-3 opacity-70" />
                    {mgn >= 0 ? '+' : ''}
                    {mgn}% margin
                  </span>
                </div>

                {showLatePrefWarning ? (
                  <div className="mb-2 flex items-start gap-1.5 rounded-lg border border-amber-200/80 bg-amber-500/8 px-2 py-1.5 text-[10px] font-semibold text-amber-900 dark:border-amber-900/40 dark:bg-amber-500/10 dark:text-amber-200">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span>Preferred lot expires after the FEFO head — stock will still split automatically.</span>
                  </div>
                ) : null}

                <div className="mb-3 flex flex-wrap gap-1.5">
                  {(line.batchSlices ?? []).map((sl) => {
                    const tone = expiryTone(sl.expiryDate, expDays);
                    return (
                      <span
                        key={`${line.lineId}-${sl.batchId}-${sl.tablets}`}
                        className={cn(
                          'inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[10px] font-bold tabular-nums border',
                          tone === 'red' && 'border-red-300 bg-red-500/10 text-red-800 dark:text-red-300',
                          tone === 'yellow' &&
                            'border-amber-300 bg-amber-500/12 text-amber-900 dark:text-amber-200',
                          tone === 'green' && 'border-emerald-200 bg-emerald-500/8 text-emerald-900 dark:text-emerald-200'
                        )}
                      >
                        {sl.batchNo}: {sl.tablets}
                      </span>
                    );
                  })}
                </div>

                <p className="text-[10px] text-muted-foreground font-medium mb-3 break-words">
                  <span className="font-bold text-foreground/80">Lots: </span>
                  {breakdown}
                </p>

                <div className="flex flex-wrap items-end gap-3">
                  <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50/80 p-0.5 dark:border-border/60 dark:bg-muted/30">
                    <button
                      type="button"
                      tabIndex={-1}
                      className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-white dark:hover:bg-card transition active:scale-95"
                      onClick={(e) => {
                        e.stopPropagation();
                        const r = bumpLineQuantity(line.lineId, -1);
                        if (!r.ok) showToast(r.message ?? 'Unable to decrease quantity', 'error');
                      }}
                      aria-label="Decrease quantity"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <input
                      id={`cart-qty-${line.lineId}`}
                      type="number"
                      min={1}
                      value={line.quantity}
                      tabIndex={0}
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => {
                        const idx = cart.findIndex((l) => l.lineId === line.lineId);
                        const lk = e.key.length === 1 ? e.key.toLowerCase() : '';
                        if ((lk === 't' || lk === 'p') && !e.ctrlKey && !e.metaKey && !e.altKey) {
                          e.preventDefault();
                          if (lk === 't') {
                            if (line.quantityMode !== 'tablet') {
                              const r = setLineQuantityMode(line.lineId, 'tablet');
                              if (!r.ok) showToast(r.message ?? 'Cannot switch unit', 'error');
                            }
                          } else if (line.quantityMode !== 'packet') {
                            const r = setLineQuantityMode(line.lineId, 'packet');
                            if (!r.ok) showToast(r.message ?? 'Cannot switch unit', 'error');
                          }
                          return;
                        }
                        if (e.key === 'Tab') {
                          if (!e.shiftKey && idx < cart.length - 1) {
                            e.preventDefault();
                            document.getElementById(`cart-qty-${cart[idx + 1]!.lineId}`)?.focus();
                          } else if (e.shiftKey && idx > 0) {
                            e.preventDefault();
                            document.getElementById(`cart-qty-${cart[idx - 1]!.lineId}`)?.focus();
                          }
                        }
                      }}
                      onChange={(e) => {
                        const v = parseInt(e.target.value, 10);
                        if (!Number.isFinite(v)) return;
                        const r = setLineQuantity(line.lineId, v);
                        if (!r.ok) showToast(r.message ?? 'Invalid quantity', 'error');
                      }}
                      className="w-11 text-center bg-transparent font-bold text-base focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 rounded-md [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none tabular-nums"
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-white dark:hover:bg-card transition active:scale-95"
                      onClick={(e) => {
                        e.stopPropagation();
                        const r = bumpLineQuantity(line.lineId, 1);
                        if (!r.ok) showToast(r.message ?? 'Insufficient stock', 'error');
                      }}
                      aria-label="Increase quantity"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Price</span>
                    <input
                      id={`line-price-${line.lineId}`}
                      type="number"
                      min={0.01}
                      step={0.01}
                      value={line.unitPrice}
                      readOnly={posPricingChannel === 'retail'}
                      tabIndex={0}
                      title={
                        posPricingChannel === 'retail'
                          ? 'Retail mode uses shelf prices. Switch to Wholesale / bulk to edit.'
                          : undefined
                      }
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => {
                        const idx = cart.findIndex((l) => l.lineId === line.lineId);
                        if (e.key === 'Tab' && !e.shiftKey && idx < cart.length - 1) {
                          e.preventDefault();
                          document.getElementById(`cart-qty-${cart[idx + 1]!.lineId}`)?.focus();
                        }
                      }}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value);
                        if (!Number.isFinite(v)) return;
                        setLineUnitPrice(line.lineId, v);
                      }}
                      className={cn(
                        'w-28 rounded-xl border border-slate-200 bg-white px-2 py-1.5 text-sm font-bold tabular-nums focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 dark:bg-card/50 dark:border-border/60',
                        posPricingChannel === 'retail' &&
                          'cursor-default bg-slate-50 text-slate-700 dark:bg-muted/50 dark:text-zinc-300'
                      )}
                    />
                  </div>

                  <button
                    type="button"
                    tabIndex={-1}
                    className="ml-auto inline-flex h-10 w-10 items-center justify-center rounded-xl text-muted-foreground hover:bg-red-500/10 hover:text-red-600 transition active:scale-95"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeLine(line.lineId);
                    }}
                    aria-label="Remove line"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {cart.length === 0 && (
          <div className="h-full min-h-[220px] flex flex-col items-center justify-center text-center py-12 px-4 rounded-[20px] border border-dashed border-slate-200 bg-white/70">
            <ShoppingBag className="w-14 h-14 mb-3 text-muted-foreground/45" strokeWidth={1.25} />
            <p className="text-lg font-semibold tracking-tight text-muted-foreground">Cart is empty</p>
            <p className="text-sm text-muted-foreground/85 mt-1 max-w-[260px] leading-relaxed">
              Press <kbd className="px-1 py-0.5 rounded bg-muted text-xs font-mono">F2</kbd> to focus search. Use arrows +
              Enter to add items fast.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

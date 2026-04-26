import { create } from 'zustand';
import { buildMedicineCategoryList } from '@/lib/medicineCategories';
import { isExpired, parseLocalDay } from '@/lib/posDates';
import { useSettingsStore } from '@/store/useSettingsStore';
import {
  chooseInitialQuantityMode,
  lineTotalTablets,
  packetModeAvailable,
  rememberQuantityMode,
  tabletModeAvailable,
} from '@/lib/posCartQuantity';
import {
  costPerPackFromTablet,
  getMedicineTabletsPerPack,
  normalizeBatchSalePrices,
  normalizeMedicineCatalogPrices,
  tabletPurchaseFromPack,
  tabletSaleFromPack,
} from '@/lib/stockUnits';
import { cartLineSubtotal, recomputeCartAllocations } from '@/lib/cartFefoAllocation';
import { enrichCartLinesForSaleLedger } from '@/lib/saleSliceSnapshots';
import { applyCreditSaleToCustomer } from '@/lib/customerCredit';
import type { CustomerCreditHistoryEntry } from '@/types';
import { inferFormFromUnit, parseGenericToSalts, getMedicineStrength } from '@/lib/medicineSalts';
import { posApi } from '@/lib/api/posApi';
import { apiErrMessage, toastMutationError, toastMutationInfo, toastMutationSuccess } from '@/lib/mutationToast';
import type {
  CartLine,
  CartQuantityMode,
  CustomerReturnSettlement,
  Customer,
  Medicine,
  MedicineBatch,
  Purchase,
  ReturnKind,
  ReturnLine,
  ReturnRecord,
  Sale,
  ServiceChargeSnapshot,
  Manufacturer,
  Supplier,
} from '@/types';

function mergeCategoryIntoList(list: string[], cat: string): string[] {
  const t = cat.trim();
  if (!t) return list;
  if (list.some((c) => c.toLowerCase() === t.toLowerCase())) return list;
  return [...list, t].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}

export interface AddMedicineMasterPayload {
  name: string;
  generic: string;
  category: string;
  type: string;
  unitType: 'tablet' | 'ml' | 'vial' | 'tube';
  manufacturer?: string;
  unit?: string;
  /** Tablets per full commercial pack — required, integer ≥ 1. */
  tabletsPerPack: number;
  /** Purchase price for one full pack (converted to cost per tablet internally). */
  purchasePricePerPack: number;
  /** Sale price for one full pack (converted to sale per tablet internally). */
  salePricePerPack: number;
  /** Optional label; defaults to "{n} {unit}" when omitted. */
  packSize?: string;
  /** Volume in ml for syrup/drops. */
  volume?: number;
  /** Low-stock alert line in tablets (≥ 0). */
  lowStockThreshold: number;
  /** Linked supplier id (existing or just-created). */
  supplierId: string;
}

/** Fields editable from the Medicines master screen (packet-first pricing). */
export type MedicineMasterCatalogPatch = Partial<
  Pick<
    Medicine,
    'name' | 'generic' | 'category' | 'type' | 'unitType' | 'manufacturer' | 'unit' | 'packSize' | 'supplierId' | 'lowStockThreshold' | 'volume'
  >
> & {
  tabletsPerPack?: number;
  purchasePricePerPack?: number;
  salePricePerPack?: number;
};

const EMPTY_SERVICE: ServiceChargeSnapshot = {
  deliveryFee: 0,
  serviceFee: 0,
  customLabel: 'Custom charge',
  customAmount: 0,
};

function serviceSum(s: ServiceChargeSnapshot) {
  return Math.round((s.deliveryFee + s.serviceFee + s.customAmount) * 100) / 100;
}

let lineSeq = 0;
function nextLineId() {
  lineSeq += 1;
  return `line-${Date.now()}-${lineSeq}`;
}

function findMedicine(meds: Medicine[], id: string) {
  return meds.find((m) => m.id === id);
}

function findBatch(med: Medicine, batchId: string) {
  return med.batches.find((b) => b.id === batchId);
}

/** Earliest valid expiry first (FEFO). */
function pickDefaultBatch(med: Medicine): MedicineBatch | null {
  const allowNeg = useSettingsStore.getState().allowNegativeStock;
  const sellable = med.batches
    .filter((b) => !isExpired(b.expiryDate) && (b.totalTablets > 0 || allowNeg))
    .sort((a, b) => parseLocalDay(a.expiryDate).getTime() - parseLocalDay(b.expiryDate).getTime());
  return sellable[0] ?? null;
}

export interface AddMedicineResult {
  ok: boolean;
  message?: string;
}

export interface QuickMedicinePayload {
  name: string;
  generic: string;
  category: string;
  manufacturer?: string;
  unit: string;
  batchNo: string;
  expiryDate: string;
  /** Tablets per full pack (≥ 1). */
  tabletsPerPack: number;
  /** Stock received as count of full packs (converted to tablets). */
  quantityPackets: number;
  purchasePricePerPack: number;
  salePricePerPack: number;
}

export interface NewBatchPayload {
  batchNo: string;
  expiryDate: string;
  totalTablets: number;
  salePricePerTablet: number;
  salePricePerPack?: number;
  costPricePerTablet: number;
}

export interface AddCustomerPayload {
  name: string;
  phone: string;
  address?: string;
  creditLimit?: number;
  balance?: number;
}

export interface ProcessReturnPayload {
  kind: ReturnKind;
  settlement?: CustomerReturnSettlement;
  supplierId?: string;
  supplierName?: string;
  customerId?: string;
  customerName?: string;
  note?: string;
  lines: ReturnLine[];
}

export interface POSBillingState {
  medicines: Medicine[];
  /** Master catalog category pick-list (merged with presets + in-use categories). */
  medicineCategories: string[];
  customers: Customer[];
  suppliers: Supplier[];
  manufacturers: Manufacturer[];
  purchases: Purchase[];
  sales: Sale[];
  returns: ReturnRecord[];
  cart: CartLine[];
  selectedLineId: string | null;
  customer: Customer | null;
  discount: number;
  discountType: 'percentage' | 'fixed';
  paymentMethod: 'cash' | 'card' | 'credit';
  lastAddPulse: number;

  appliedServiceCharges: ServiceChargeSnapshot;
  checkoutFlowStep: null | 'customer' | 'charges' | 'receipt';
  receiptInvoiceNo: string | null;
  isSyncing: boolean;
  syncError: string | null;
  hydratePOSData: () => Promise<void>;
  hydrateReferenceData: () => Promise<void>;
  hydrateBusinessData: () => Promise<void>;

  adjustBatchStock: (medicineId: string, batchId: string, delta: number) => void;
  setBatchStockLevel: (medicineId: string, batchId: string, stock: number) => void;
  addBatchToMedicine: (medicineId: string, payload: NewBatchPayload) => void;
  removeBatchFromMedicine: (medicineId: string, batchId: string) => void;
  updateMedicineMeta: (
    medicineId: string,
    patch: Partial<Pick<Medicine, 'name' | 'generic' | 'category' | 'unit' | 'manufacturer'>>
  ) => void;
  updateBatchFields: (
    medicineId: string,
    batchId: string,
    patch: Partial<
      Pick<MedicineBatch, 'batchNo' | 'expiryDate' | 'salePricePerTablet' | 'salePricePerPack' | 'costPricePerTablet'>
    >
  ) => void;
  addMedicineQuick: (payload: QuickMedicinePayload) => void;
  addMedicineMasterRecord: (payload: AddMedicineMasterPayload) => void;
  applyMedicineMasterPatch: (medicineId: string, patch: MedicineMasterCatalogPatch) => void;
  addMedicineCategory: (name: string) => void;
  removeMedicineCategory: (name: string) => void;
  removeMedicine: (medicineId: string) => void;
  addMedicineToCart: (
    medicineId: string,
    opts?: { quantity?: number; quantityMode?: CartQuantityMode }
  ) => AddMedicineResult;
  removeLine: (lineId: string) => void;
  setSelectedLine: (lineId: string | null) => void;
  setLineBatch: (lineId: string, batchId: string | null) => AddMedicineResult;
  setLineQuantity: (lineId: string, quantity: number) => AddMedicineResult;
  bumpLineQuantity: (lineId: string, delta: number) => AddMedicineResult;
  setLineQuantityMode: (lineId: string, mode: CartQuantityMode) => AddMedicineResult;
  setLineUnitPrice: (lineId: string, price: number) => void;

  setCustomer: (c: Customer | null) => void;
  setDiscount: (value: number, type: 'percentage' | 'fixed') => void;
  setPaymentMethod: (m: 'cash' | 'card' | 'credit') => void;

  setAppliedServiceCharges: (s: ServiceChargeSnapshot) => void;

  openCheckoutFlow: () => AddMedicineResult;
  closeCheckoutFlow: () => void;
  /** After customer step — optional fees. */
  goToChargesStep: () => void;
  /** From charges dialog back to customer picker. */
  goBackToCustomerStep: () => void;
  goToReceiptStep: () => void;
  /** From receipt preview back to charges (invoice no cleared until receipt again). */
  goBackToChargesFromReceipt: () => void;

  getTotals: () => {
    subtotal: number;
    discountAmt: number;
    serviceTotal: number;
    tax: number;
    total: number;
  };
  /** Record sale, clear session, close flow, restore defaults. */
  finalizeCheckoutFromReceipt: (
    action: 'print' | 'save' | 'complete',
    options?: { creditAmount?: number; counterPayment?: number }
  ) => Promise<AddMedicineResult>;
  /** Pay down customer balance without a sale (Customers screen or future POS entry). */
  recordCustomerBalancePayment: (
    customerId: string,
    amount: number
  ) => Promise<{ ok: boolean; message?: string }>;
  deleteSale: (saleId: string) => Promise<void>;
  addCustomer: (payload: AddCustomerPayload) => Promise<string | null>;
  updateCustomer: (customerId: string, patch: Partial<Omit<Customer, 'id'>>) => Promise<void>;
  removeCustomer: (customerId: string) => Promise<boolean>;

  addSupplier: (payload: {
    name: string;
    phone: string;
    company?: string;
    address?: string;
    outstandingBalance?: number;
  }) => Promise<string | null>;
  updateSupplier: (supplierId: string, patch: Partial<Omit<Supplier, 'id'>>) => Promise<void>;
  removeSupplier: (supplierId: string) => Promise<boolean>;
  addManufacturer: (payload: { name: string; phone: string; company?: string; address?: string }) => Promise<string | null>;
  updateManufacturer: (manufacturerId: string, patch: Partial<Omit<Manufacturer, 'id'>>) => Promise<void>;
  removeManufacturer: (manufacturerId: string) => Promise<boolean>;

  createPurchase: (row: Omit<Purchase, 'id' | 'timestamp' | 'status'>) => Promise<string>;
  updatePurchase: (purchaseId: string, row: Omit<Purchase, 'id' | 'timestamp' | 'status'>) => Promise<void>;
  deletePurchase: (purchaseId: string) => Promise<boolean>;
  completePurchase: (purchaseId: string) => Promise<{ ok: boolean; message?: string }>;
  processReturn: (payload: ProcessReturnPayload) => Promise<{ ok: boolean; message?: string; returnId?: string }>;

  voidCart: () => void;

  /** Restore catalog, customers, sales, suppliers to demo seed and clear the active sale. */
  resetToDemoSeed: () => void;
}

function mapMedicinesAdjust(
  medicines: Medicine[],
  medicineId: string,
  batchId: string,
  delta: number
): Medicine[] {
  const allowNeg = useSettingsStore.getState().allowNegativeStock;
  return medicines.map((m) => {
    if (m.id !== medicineId) return m;
    return {
      ...m,
      batches: m.batches.map((b) => {
        if (b.id !== batchId) return b;
        const next = Math.round((b.totalTablets + delta) * 1000) / 1000;
        return { ...b, totalTablets: allowNeg ? next : Math.max(0, next) };
      }),
    };
  });
}

export const usePOSBillingStore = create<POSBillingState>((set, get) => ({
  medicines: [],
  medicineCategories: [],
  customers: [],
  suppliers: [],
  manufacturers: [],
  purchases: [],
  sales: [],
  returns: [],
  cart: [],
  selectedLineId: null,
  customer: null,
  discount: 0,
  discountType: 'fixed',
  paymentMethod: 'cash',
  lastAddPulse: 0,

  appliedServiceCharges: { ...EMPTY_SERVICE },
  checkoutFlowStep: null,
  receiptInvoiceNo: null,
  isSyncing: false,
  syncError: null,

  hydratePOSData: async () => {
    set({ isSyncing: true, syncError: null });
    try {
      const medicines = await posApi.medicines.list();
      set((s) => ({
        medicines,
        medicineCategories: buildMedicineCategoryList(medicines),
        cart: recomputeCartAllocations(medicines, s.cart),
        isSyncing: false,
      }));
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to sync POS data.';
      set({
        isSyncing: false,
        syncError: msg,
      });
      toastMutationError('Could not load inventory', error);
    }
  },

  hydrateReferenceData: async () => {
    try {
      const [customers, suppliers, manufacturers] = await Promise.all([
        posApi.customers.list(),
        posApi.suppliers.list(),
        posApi.manufacturers.list(),
      ]);
      set((s) => ({
        customers,
        suppliers,
        manufacturers,
        customer: s.customer ? customers.find((c) => c.id === s.customer?.id) ?? null : null,
      }));
    } catch (error) {
      toastMutationInfo(
        `Could not refresh directory data (${apiErrMessage(error)}). Showing cached customers and suppliers.`
      );
    }
  },

  hydrateBusinessData: async () => {
    try {
      const medicines = get().medicines.length ? get().medicines : await posApi.medicines.list();
      const [sales, purchases, returns] = await Promise.all([
        posApi.sales.listDetailed(medicines),
        posApi.purchases.listDetailed(medicines),
        posApi.returns.listDetailed(),
      ]);
      set({ sales, purchases, returns });
    } catch (error) {
      toastMutationInfo(
        `Could not refresh sales and purchases (${apiErrMessage(error)}). Showing cached business data.`
      );
    }
  },

  setAppliedServiceCharges: (snapshot) => set({ appliedServiceCharges: { ...snapshot } }),

  openCheckoutFlow: () => {
    if (get().checkoutFlowStep) return { ok: true };
    if (get().cart.length === 0) return { ok: false, message: 'Cart is empty.' };
    const medicines = get().medicines;
    const cart = recomputeCartAllocations(medicines, get().cart);
    const bad = cart.find((l) => l.allocationError);
    if (bad?.allocationError) {
      set({ cart });
      return { ok: false, message: bad.allocationError };
    }
    set({
      cart,
      checkoutFlowStep: 'customer',
      receiptInvoiceNo: null,
      appliedServiceCharges: { ...EMPTY_SERVICE },
    });
    return { ok: true };
  },

  closeCheckoutFlow: () => set({ checkoutFlowStep: null, receiptInvoiceNo: null }),

  goToChargesStep: () => set({ checkoutFlowStep: 'charges' }),

  goBackToCustomerStep: () => set({ checkoutFlowStep: 'customer' }),

  goBackToChargesFromReceipt: () => set({ checkoutFlowStep: 'charges', receiptInvoiceNo: null }),

  goToReceiptStep: () => {
    const prefix = useSettingsStore.getState().invoicePrefix.replace(/-+$/, '') || 'INV';
    set({
      checkoutFlowStep: 'receipt',
      receiptInvoiceNo: `${prefix}-${Date.now()}`,
    });
  },

  adjustBatchStock: (medicineId, batchId, delta) => {
    const prev = { medicines: structuredClone(get().medicines), cart: structuredClone(get().cart) };
    set((s) => {
      const medicines = mapMedicinesAdjust(s.medicines, medicineId, batchId, delta);
      return { medicines, cart: recomputeCartAllocations(medicines, s.cart) };
    });
    const med = get().medicines.find((m) => m.id === medicineId);
    const batch = med?.batches.find((b) => b.id === batchId);
    if (!med || !batch) return;
    void (async () => {
      try {
        await posApi.batches.update(batchId, {
          quantityTablets: Math.max(0, Math.floor(batch.totalTablets)),
        });
        await Promise.all([get().hydratePOSData(), get().hydrateBusinessData()]);
        toastMutationSuccess('Stock updated');
      } catch (error) {
        set({ medicines: prev.medicines, cart: prev.cart });
        toastMutationError('Stock change was not saved', error);
        try {
          await get().hydratePOSData();
        } catch {
          /* ignore */
        }
      }
    })();
  },

  setBatchStockLevel: (medicineId, batchId, stock) => {
    const prev = { medicines: structuredClone(get().medicines), cart: structuredClone(get().cart) };
    const qty = Math.max(0, Math.round(Number(stock) * 1000) / 1000);
    set((s) => {
      const medicines = s.medicines.map((m) => {
        if (m.id !== medicineId) return m;
        return {
          ...m,
          batches: m.batches.map((b) => (b.id === batchId ? { ...b, totalTablets: qty } : b)),
        };
      });
      return { medicines, cart: recomputeCartAllocations(medicines, s.cart) };
    });
    void (async () => {
      try {
        await posApi.batches.update(batchId, { quantityTablets: qty });
        await Promise.all([get().hydratePOSData(), get().hydrateBusinessData()]);
        toastMutationSuccess('Stock level saved');
      } catch (error) {
        set({ medicines: prev.medicines, cart: prev.cart });
        toastMutationError('Stock level was not saved', error);
        try {
          await get().hydratePOSData();
        } catch {
          /* ignore */
        }
      }
    })();
  },

  addBatchToMedicine: (medicineId, payload) => {
    const med = findMedicine(get().medicines, medicineId);
    if (!med) return;
    const prev = { medicines: structuredClone(get().medicines), cart: structuredClone(get().cart) };
    const id = `b-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const prices = normalizeBatchSalePrices(med, payload.salePricePerTablet, payload.salePricePerPack);
    const batch: MedicineBatch = {
      id,
      batchNo: payload.batchNo.trim() || `LOT-${Date.now()}`,
      expiryDate: payload.expiryDate,
      totalTablets: Math.max(0, Math.round(Number(payload.totalTablets) * 1000) / 1000),
      salePricePerTablet: prices.salePricePerTablet,
      salePricePerPack: prices.salePricePerPack,
      costPricePerTablet: Math.max(0, Math.round(payload.costPricePerTablet * 100) / 100),
    };
    set((s) => {
      const medicines = s.medicines.map((m) =>
        m.id !== medicineId ? m : { ...m, batches: [...m.batches, batch] }
      );
      return { medicines, cart: recomputeCartAllocations(medicines, s.cart) };
    });
    void (async () => {
      try {
        await posApi.medicines.addBatch(medicineId, {
          batchNo: batch.batchNo,
          expiryDate: batch.expiryDate,
          quantityTablets: batch.totalTablets,
          costPricePerTablet: batch.costPricePerTablet,
          salePricePerTablet: batch.salePricePerTablet,
          salePricePerPack: batch.salePricePerPack,
        });
        await Promise.all([get().hydratePOSData(), get().hydrateBusinessData()]);
        toastMutationSuccess('Batch added');
      } catch (error) {
        set({ medicines: prev.medicines, cart: prev.cart });
        toastMutationError('Batch was not saved', error);
        try {
          await get().hydratePOSData();
        } catch {
          /* ignore */
        }
      }
    })();
  },

  removeBatchFromMedicine: (medicineId, batchId) => {
    const prev = { medicines: structuredClone(get().medicines), cart: structuredClone(get().cart) };
    set((s) => {
      const medicines = s.medicines.map((m) => {
        if (m.id !== medicineId) return m;
        return { ...m, batches: m.batches.filter((b) => b.id !== batchId) };
      });
      const cart = recomputeCartAllocations(medicines, s.cart).map((line) =>
        line.medicineId === medicineId && line.preferredBatchId === batchId
          ? { ...line, preferredBatchId: null }
          : line
      );
      return { medicines, cart };
    });
    void (async () => {
      try {
        await posApi.batches.remove(batchId);
        await Promise.all([get().hydratePOSData(), get().hydrateBusinessData()]);
        toastMutationSuccess('Batch removed');
      } catch (error) {
        set({ medicines: prev.medicines, cart: prev.cart });
        toastMutationError('Batch was not removed', error);
        try {
          await get().hydratePOSData();
        } catch {
          /* ignore */
        }
      }
    })();
  },

  updateMedicineMeta: (medicineId, patch) => {
    const prev = { medicines: structuredClone(get().medicines), cart: structuredClone(get().cart) };
    set((s) => ({
      medicines: s.medicines.map((m) => {
        if (m.id !== medicineId) return m;
        return {
          ...m,
          ...(patch.name != null ? { name: patch.name } : {}),
          ...(patch.generic != null ? { generic: patch.generic } : {}),
          ...(patch.category != null ? { category: patch.category } : {}),
          ...(patch.unit != null ? { unit: patch.unit } : {}),
          ...(patch.manufacturer !== undefined ? { manufacturer: patch.manufacturer } : {}),
        };
      }),
      cart: s.cart.map((l) =>
        l.medicineId !== medicineId
          ? l
          : {
              ...l,
              ...(patch.name != null ? { name: patch.name } : {}),
              ...(patch.generic != null ? { generic: patch.generic } : {}),
              ...(patch.unit != null ? { unit: patch.unit } : {}),
            }
      ),
    }));
    void (async () => {
      try {
        await posApi.medicines.update(medicineId, {
          name: patch.name,
          generic: patch.generic,
          category: patch.category,
          unit: patch.unit,
          manufacturerName: patch.manufacturer,
        });
        await get().hydratePOSData();
        toastMutationSuccess('Medicine details saved');
      } catch (error) {
        set({
          medicines: prev.medicines,
          cart: prev.cart,
          syncError:
            error instanceof Error ? `Failed to update medicine: ${error.message}` : 'Failed to update medicine.',
        });
        toastMutationError('Medicine details were not saved', error);
      }
    })();
  },

  updateBatchFields: (medicineId, batchId, patch) => {
    const prev = { medicines: structuredClone(get().medicines), cart: structuredClone(get().cart) };
    const bn = patch.batchNo != null ? patch.batchNo.trim() : undefined;
    const spt =
      patch.salePricePerTablet != null
        ? Math.max(0.01, Math.round(patch.salePricePerTablet * 10000) / 10000)
        : undefined;
    const spp =
      patch.salePricePerPack != null ? Math.max(0.01, Math.round(patch.salePricePerPack * 100) / 100) : undefined;
    const cp =
      patch.costPricePerTablet != null ? Math.max(0, Math.round(patch.costPricePerTablet * 100) / 100) : undefined;

    set((s) => {
      const medicines = s.medicines.map((m) => {
        if (m.id !== medicineId) return m;
        return {
          ...m,
          batches: m.batches.map((b) => {
            if (b.id !== batchId) return b;
            return {
              ...b,
              ...(bn != null ? { batchNo: bn } : {}),
              ...(patch.expiryDate != null ? { expiryDate: patch.expiryDate } : {}),
              ...(spt != null ? { salePricePerTablet: spt } : {}),
              ...(spp != null ? { salePricePerPack: spp } : {}),
              ...(cp != null ? { costPricePerTablet: cp } : {}),
            };
          }),
        };
      });
      return { medicines, cart: recomputeCartAllocations(medicines, s.cart) };
    });
    void (async () => {
      try {
        await posApi.batches.update(batchId, {
          batchNo: bn,
          expiryDate: patch.expiryDate,
          salePricePerTablet: spt,
          salePricePerPack: spp,
          costPricePerTablet: cp,
        });
        await Promise.all([get().hydratePOSData(), get().hydrateBusinessData()]);
        toastMutationSuccess('Batch details saved');
      } catch (error) {
        set({ medicines: prev.medicines, cart: prev.cart });
        toastMutationError('Batch details were not saved', error);
        try {
          await Promise.all([get().hydratePOSData(), get().hydrateBusinessData()]);
        } catch {
          /* ignore */
        }
      }
    })();
  },

  addMedicineQuick: (payload) => {
    const id = `m-${Date.now()}`;
    const batchId = `b-${Date.now()}-0`;
    const mfr = (payload.manufacturer ?? '').trim();
    const g = payload.generic.trim() || payload.name.trim() || '—';
    const saltArr = parseGenericToSalts(g);
    const tpp = Math.max(1, Math.floor(Number(payload.tabletsPerPack) || 1));
    const packs = Math.max(0, Math.floor(Number(payload.quantityPackets) || 0));
    const totalTablets = packs * tpp;
    const salePp = Math.max(0.01, Math.round(payload.salePricePerPack * 100) / 100);
    const purchasePp = Math.max(0, Math.round(payload.purchasePricePerPack * 100) / 100);
    const salePt = tabletSaleFromPack(salePp, tpp);
    const costPt = purchasePp <= 0 ? 0 : tabletPurchaseFromPack(purchasePp, tpp);
    const medStub = {
      id,
      name: payload.name.trim() || 'New medicine',
      generic: g,
      unit: payload.unit.trim() || 'Unit',
      category: '',
      batches: [],
    } as Medicine;
    const med: Medicine = {
      id,
      name: payload.name.trim() || 'New medicine',
      generic: g,
      ...(saltArr.length ? { salts: saltArr } : {}),
      ...(mfr ? { brand: mfr, manufacturer: mfr.slice(0, 120) } : {}),
      strength: getMedicineStrength(medStub),
      form: inferFormFromUnit(payload.unit.trim() || 'Unit'),
      category: (payload.category.trim() || 'Uncategorized').slice(0, 80),
      unit: (payload.unit.trim() || 'Unit').slice(0, 40),
      ...(mfr ? { manufacturer: mfr.slice(0, 120) } : {}),
      tabletsPerPack: tpp,
      packSize: `${tpp} ${(payload.unit.trim() || 'tablet').toLowerCase()}`.slice(0, 80),
      salePricePerTablet: salePt,
      salePricePerPack: tpp >= 2 ? salePp : salePt,
      defaultSalePrice: salePt,
      defaultPurchasePrice: Math.max(0, Math.round(costPt * 10000) / 10000),
      batches: [
        {
          id: batchId,
          batchNo: payload.batchNo.trim() || `NEW-${Date.now()}`,
          expiryDate: payload.expiryDate,
          totalTablets: Math.max(0, Math.round(totalTablets * 1000) / 1000),
          salePricePerTablet: salePt,
          salePricePerPack: tpp >= 2 ? salePp : salePt,
          costPricePerTablet: Math.max(0, Math.round(costPt * 10000) / 10000),
        },
      ],
    };
    set((s) => ({ medicines: [...s.medicines, med] }));
    void posApi.medicines
      .create({
        id,
        name: med.name,
        generic: med.generic,
        type: 'tablet',
        category: med.category,
        unitType: 'tablet',
        unit: med.unit,
        tabletsPerPack: med.tabletsPerPack,
        volumeMl: null,
        supplierId: null,
        supplierName: '',
        manufacturerId: null,
        manufacturerName: med.manufacturer ?? '',
        lowStockThreshold: 0,
        purchasePerPack: purchasePp,
        salePerPack: salePp,
      })
      .then(() =>
        posApi.medicines.addBatch(id, {
          batchNo: med.batches[0]?.batchNo ?? `NEW-${Date.now()}`,
          expiryDate: med.batches[0]?.expiryDate ?? payload.expiryDate,
          quantityTablets: med.batches[0]?.totalTablets ?? 0,
          costPricePerTablet: med.batches[0]?.costPricePerTablet ?? 0,
          salePricePerTablet: med.batches[0]?.salePricePerTablet ?? salePt,
          salePricePerPack: med.batches[0]?.salePricePerPack ?? salePp,
        })
      )
      .then(async () => {
        await get().hydratePOSData();
        toastMutationSuccess('Medicine saved');
      })
      .catch((error) => {
        set((s) => ({
          syncError:
            error instanceof Error ? `Failed to persist quick medicine: ${error.message}` : 'Failed to persist quick medicine.',
          medicines: s.medicines.filter((m) => m.id !== id),
        }));
        toastMutationError('Quick add was not saved', error);
      });
  },

  addMedicineMasterRecord: (payload) => {
    const id = `m-${Date.now()}`;
    const batchId = `b-${id}-def`;
    const normalizedType = payload.type;
    const normalizedUnitType = payload.unitType;
    const isTablet = normalizedType === 'tablet';
    const tpp = isTablet ? Math.max(1, Math.floor(Number(payload.tabletsPerPack) || 0)) : 1;
    const unitFallback =
      normalizedUnitType === 'tablet'
        ? 'Tablet'
        : normalizedUnitType === 'ml'
          ? 'ml'
          : normalizedUnitType === 'vial'
            ? 'Vial'
            : 'Tube';
    const unit = (payload.unit?.trim() || unitFallback).slice(0, 40);
    const salePp = Math.max(0.01, Math.round(payload.salePricePerPack * 100) / 100);
    const purchasePp = Math.max(0, Math.round(payload.purchasePricePerPack * 100) / 100);
    const salePt = tabletSaleFromPack(salePp, tpp);
    const costPt = purchasePp <= 0 ? 0 : tabletPurchaseFromPack(purchasePp, tpp);
    const packLabel = (payload.packSize?.trim() || `${tpp} ${unit.toLowerCase()}`).slice(0, 80);
    const medSeed: Medicine = {
      id,
      name: payload.name.trim(),
      generic: payload.generic.trim() || '—',
      category: (payload.category.trim() || 'General').slice(0, 80),
      type: normalizedType,
      unitType: normalizedUnitType,
      unit,
      ...(payload.manufacturer?.trim()
        ? { manufacturer: payload.manufacturer.trim().slice(0, 120) }
        : {}),
      tabletsPerPack: tpp,
      packSize: packLabel,
      ...(payload.volume != null && Number.isFinite(payload.volume) && payload.volume > 0
        ? { volume: Math.round(payload.volume * 100) / 100 }
        : {}),
      defaultSalePrice: salePt,
      defaultPurchasePrice: Math.max(0, Math.round(costPt * 10000) / 10000),
      batches: [],
    };
    const prices = normalizeBatchSalePrices(medSeed, salePt, salePp);
    const lowTh = Math.max(0, Math.floor(Number(payload.lowStockThreshold) || 0));
    const supId = payload.supplierId.trim();
    const med: Medicine = {
      ...medSeed,
      salePricePerTablet: prices.salePricePerTablet,
      salePricePerPack: prices.salePricePerPack,
      lowStockThreshold: lowTh,
      ...(supId ? { supplierId: supId } : {}),
      batches: [
        {
          id: batchId,
          batchNo: 'DEFAULT',
          expiryDate: '2099-12-31',
          totalTablets: 0,
          salePricePerTablet: prices.salePricePerTablet,
          salePricePerPack: prices.salePricePerPack,
          costPricePerTablet: Math.max(0, Math.round(costPt * 10000) / 10000),
        },
      ],
    };
    set((s) => ({
      medicines: [...s.medicines, med],
      medicineCategories: mergeCategoryIntoList(s.medicineCategories, med.category),
    }));
    void posApi.medicines
      .create({
        id,
        name: med.name,
        generic: med.generic,
        type: med.type,
        category: med.category,
        unitType: med.unitType,
        unit: med.unit,
        tabletsPerPack: med.tabletsPerPack,
        volumeMl: med.volume ?? null,
        supplierId: med.supplierId ?? null,
        supplierName: '',
        manufacturerId: med.manufacturerId ?? null,
        manufacturerName: med.manufacturer ?? '',
        lowStockThreshold: med.lowStockThreshold ?? 0,
        purchasePerPack: Math.max(0, Math.round(payload.purchasePricePerPack * 100) / 100),
        salePerPack: Math.max(0.01, Math.round(payload.salePricePerPack * 100) / 100),
      })
      .then(async () => {
        await get().hydratePOSData();
        toastMutationSuccess('Medicine created');
      })
      .catch((error) => {
        set((s) => ({
          syncError:
            error instanceof Error
              ? `Failed to persist medicine: ${error.message}`
              : 'Failed to persist medicine.',
          // Remove optimistic row if backend rejected create, so UI matches source of truth.
          medicines: s.medicines.filter((m) => m.id !== id),
        }));
        toastMutationError('Medicine was not created', error);
      });
  },

  applyMedicineMasterPatch: (medicineId, patch) => {
    const prev = {
      medicines: structuredClone(get().medicines),
      cart: structuredClone(get().cart),
      medicineCategories: [...get().medicineCategories],
    };
    set((s) => {
      let medicineCategories = s.medicineCategories;
      if (patch.category != null) {
        medicineCategories = mergeCategoryIntoList(medicineCategories, patch.category);
      }
      const medicines = s.medicines.map((m) => {
        if (m.id !== medicineId) return m;
        const tppBase =
          patch.tabletsPerPack != null
            ? Math.max(1, Math.floor(patch.tabletsPerPack))
            : getMedicineTabletsPerPack(m);
        let next: Medicine = {
          ...m,
          ...(patch.name != null ? { name: patch.name } : {}),
          ...(patch.generic != null ? { generic: patch.generic } : {}),
          ...(patch.category != null ? { category: patch.category } : {}),
          ...(patch.type != null ? { type: patch.type } : {}),
          ...(patch.unitType != null ? { unitType: patch.unitType } : {}),
          ...(patch.manufacturer !== undefined ? { manufacturer: patch.manufacturer } : {}),
          ...(patch.unit != null ? { unit: patch.unit } : {}),
          ...(patch.volume !== undefined
            ? patch.volume != null && Number.isFinite(patch.volume) && patch.volume > 0
              ? { volume: Math.round(patch.volume * 100) / 100 }
              : { volume: undefined }
            : {}),
          ...(patch.tabletsPerPack != null ? { tabletsPerPack: tppBase } : {}),
          ...(patch.packSize !== undefined
            ? {
                packSize: patch.packSize.trim()
                  ? patch.packSize.trim().slice(0, 80)
                  : `${tppBase} ${(patch.unit ?? m.unit).toLowerCase()}`.slice(0, 80),
              }
            : patch.tabletsPerPack != null
              ? {
                  packSize: `${tppBase} ${(patch.unit ?? m.unit).toLowerCase()}`.slice(0, 80),
                }
              : {}),
        };
        if (patch.supplierId !== undefined) {
          const sid = patch.supplierId.trim();
          if (sid) next = { ...next, supplierId: sid };
          else {
            const rest = { ...next };
            delete rest.supplierId;
            next = rest as Medicine;
          }
        }
        if (patch.lowStockThreshold !== undefined) {
          next = {
            ...next,
            lowStockThreshold: Math.max(0, Math.floor(Number(patch.lowStockThreshold) || 0)),
          };
        }
        const tpp = getMedicineTabletsPerPack(next);
        if (patch.salePricePerPack != null) {
          const salePp = Math.max(0.01, Math.round(patch.salePricePerPack * 100) / 100);
          const salePt = tabletSaleFromPack(salePp, tpp);
          const pr = normalizeBatchSalePrices(next, salePt, salePp);
          next = {
            ...next,
            salePricePerTablet: pr.salePricePerTablet,
            salePricePerPack: pr.salePricePerPack,
            defaultSalePrice: pr.salePricePerTablet,
          };
        }
        if (patch.purchasePricePerPack != null) {
          const purchasePp = Math.max(0, Math.round(patch.purchasePricePerPack * 100) / 100);
          const costPt = purchasePp <= 0 ? 0 : tabletPurchaseFromPack(purchasePp, tpp);
          next = {
            ...next,
            defaultPurchasePrice: Math.max(0, Math.round(costPt * 10000) / 10000),
          };
        }
        if (
          patch.salePricePerPack != null ||
          patch.purchasePricePerPack != null ||
          patch.tabletsPerPack != null
        ) {
          const catNorm = normalizeMedicineCatalogPrices(next);
          const purchaseTablet = next.defaultPurchasePrice ?? 0;
          next = {
            ...next,
            salePricePerTablet: catNorm.salePricePerTablet,
            salePricePerPack: catNorm.salePricePerPack,
            defaultSalePrice: catNorm.salePricePerTablet,
            batches: next.batches.map((b) =>
              b.totalTablets <= 0
                ? {
                    ...b,
                    salePricePerTablet: catNorm.salePricePerTablet,
                    salePricePerPack: catNorm.salePricePerPack,
                    costPricePerTablet: Math.max(0, Math.round(purchaseTablet * 10000) / 10000),
                  }
                : b
            ),
          };
        }
        return next;
      });
      const cart = s.cart.map((l) => {
        if (l.medicineId !== medicineId) return l;
        const nm = medicines.find((x) => x.id === medicineId);
        const tpp = nm ? getMedicineTabletsPerPack(nm) : l.tabletsPerPack;
        return {
          ...l,
          ...(patch.name != null ? { name: patch.name } : {}),
          ...(patch.generic != null ? { generic: patch.generic } : {}),
          ...(patch.unit != null ? { unit: patch.unit } : {}),
          ...(patch.tabletsPerPack != null ? { tabletsPerPack: Math.max(1, Math.floor(patch.tabletsPerPack)) } : {}),
          ...(nm && patch.tabletsPerPack != null ? { tabletsPerPack: tpp } : {}),
        };
      });
      return { medicineCategories, medicines, cart: recomputeCartAllocations(medicines, cart) };
    });
    void (async () => {
      try {
        await posApi.medicines.update(medicineId, {
          name: patch.name,
          generic: patch.generic,
          type: patch.type,
          category: patch.category,
          unitType: patch.unitType,
          unit: patch.unit,
          tabletsPerPack: patch.tabletsPerPack,
          volumeMl: patch.volume,
          supplierId: patch.supplierId,
          manufacturerName: patch.manufacturer,
          lowStockThreshold: patch.lowStockThreshold,
          purchasePerPack: patch.purchasePricePerPack,
          salePerPack: patch.salePricePerPack,
        });
        await get().hydratePOSData();
        toastMutationSuccess('Medicine updated');
      } catch (error) {
        set({
          medicines: prev.medicines,
          cart: prev.cart,
          medicineCategories: prev.medicineCategories,
          syncError:
            error instanceof Error ? `Failed to update medicine: ${error.message}` : 'Failed to update medicine.',
        });
        toastMutationError('Medicine was not updated', error);
      }
    })();
  },

  addMedicineCategory: (name) => {
    const t = name.trim();
    if (!t) return;
    set((s) => {
      if (s.medicineCategories.some((c) => c.toLowerCase() === t.toLowerCase())) return s;
      return {
        medicineCategories: [...s.medicineCategories, t].sort((a, b) =>
          a.localeCompare(b, undefined, { sensitivity: 'base' })
        ),
      };
    });
  },

  removeMedicineCategory: (name) => {
    const trimmed = name.trim();
    if (!trimmed || trimmed.toLowerCase() === 'general') return;
    const prev = {
      medicineCategories: [...get().medicineCategories],
      medicines: structuredClone(get().medicines),
    };
    const affectedMedicineIds = get()
      .medicines.filter((m) => m.category === trimmed)
      .map((m) => m.id);
    set((s) => ({
      medicineCategories: s.medicineCategories.filter((c) => c !== trimmed),
      medicines: s.medicines.map((m) =>
        m.category === trimmed ? { ...m, category: 'General' } : m
      ),
    }));
    if (affectedMedicineIds.length === 0) return;
    void (async () => {
      try {
        await Promise.all(
          affectedMedicineIds.map((medicineId) => posApi.medicines.update(medicineId, { category: 'General' }))
        );
        await get().hydratePOSData();
        toastMutationSuccess('Category removed');
      } catch (error) {
        set({
          medicineCategories: prev.medicineCategories,
          medicines: prev.medicines,
          syncError:
            error instanceof Error ? `Failed to update category: ${error.message}` : 'Failed to update category.',
        });
        toastMutationError('Category change was not saved', error);
        try {
          await get().hydratePOSData();
        } catch {
          /* ignore */
        }
      }
    })();
  },

  removeMedicine: (medicineId) => {
    const prev = {
      medicines: structuredClone(get().medicines),
      cart: structuredClone(get().cart),
      selectedLineId: get().selectedLineId,
    };
    set((s) => {
      const medicines = s.medicines.filter((m) => m.id !== medicineId);
      const cart = s.cart.filter((l) => l.medicineId !== medicineId);
      return {
        medicines,
        cart: recomputeCartAllocations(medicines, cart),
        selectedLineId: s.cart.some((l) => l.medicineId === medicineId && l.lineId === s.selectedLineId)
          ? null
          : s.selectedLineId,
      };
    });
    void (async () => {
      try {
        await posApi.medicines.remove(medicineId);
        await get().hydratePOSData();
        toastMutationSuccess('Medicine removed');
      } catch (error) {
        set({
          medicines: prev.medicines,
          cart: prev.cart,
          selectedLineId: prev.selectedLineId,
          syncError:
            error instanceof Error ? `Failed to remove medicine: ${error.message}` : 'Failed to remove medicine.',
        });
        toastMutationError('Medicine was not removed', error);
        try {
          await get().hydratePOSData();
        } catch {
          /* ignore */
        }
      }
    })();
  },

  addMedicineToCart: (medicineId, opts) => {
    const rawQ = opts?.quantity;
    const qtyDesired =
      rawQ != null && Number.isFinite(rawQ) ? Math.max(1, Math.min(999_999, Math.floor(Number(rawQ)))) : 1;

    const med = findMedicine(get().medicines, medicineId);
    if (!med) return { ok: false, message: 'Product not found.' };

    const batch = pickDefaultBatch(med);
    if (!batch) {
      const anyLiveStock = med.batches.some((b) => !isExpired(b.expiryDate) && b.totalTablets > 0);
      if (!anyLiveStock && med.batches.some((b) => isExpired(b.expiryDate)))
        return { ok: false, message: 'Cannot add — all sellable lots expired or empty.' };
      return { ok: false, message: 'Out of stock.' };
    }

    const tabletsPerPack = getMedicineTabletsPerPack(med);
    const stockTablets = batch.totalTablets;
    let quantityMode: CartQuantityMode;
    if (opts?.quantityMode === 'packet' || opts?.quantityMode === 'tablet') {
      if (opts.quantityMode === 'packet') {
        if (!packetModeAvailable(stockTablets, tabletsPerPack)) {
          return { ok: false, message: 'Full packs are not available for this product right now.' };
        }
        quantityMode = 'packet';
      } else {
        if (!tabletModeAvailable(stockTablets)) {
          return { ok: false, message: 'Loose units are not available for this stock lot.' };
        }
        quantityMode = 'tablet';
      }
    } else {
      quantityMode = chooseInitialQuantityMode(med.id, stockTablets, tabletsPerPack);
    }

    const medicines = get().medicines;
    const cart = get().cart;
    const existing = cart.find(
      (l) =>
        l.medicineId === medicineId &&
        l.quantityMode === quantityMode &&
        (l.pricingMode ?? 'fefo') === 'fefo'
    );
    if (existing) {
      const nextCart = cart.map((l) =>
        l.lineId === existing.lineId ? { ...l, quantity: l.quantity + qtyDesired } : l
      );
      const recomputed = recomputeCartAllocations(medicines, nextCart);
      const upd = recomputed.find((l) => l.lineId === existing.lineId);
      if (upd?.allocationError) return { ok: false, message: upd.allocationError };
      set({ cart: recomputed, lastAddPulse: Date.now(), selectedLineId: existing.lineId });
      return { ok: true };
    }

    const unitPrice =
      quantityMode === 'packet'
        ? Math.round(batch.salePricePerPack * 100) / 100
        : Math.round(batch.salePricePerTablet * 100) / 100;
    const costPrice =
      quantityMode === 'packet'
        ? Math.round(costPerPackFromTablet(batch.costPricePerTablet, tabletsPerPack) * 100) / 100
        : Math.round(batch.costPricePerTablet * 100) / 100;
    const line: CartLine = {
      lineId: nextLineId(),
      medicineId: med.id,
      batchId: batch.id,
      name: med.name,
      generic: med.generic,
      manufacturer: med.manufacturer?.trim() ? med.manufacturer.trim() : undefined,
      batchNo: batch.batchNo,
      expiryDate: batch.expiryDate,
      unit: med.unit,
      quantityMode,
      tabletsPerPack,
      quantity: qtyDesired,
      unitPrice,
      costPrice,
      batchSlices: [],
      preferredBatchId: null,
      pricingMode: 'fefo',
    };
    const tentative = recomputeCartAllocations(medicines, [...cart, line]);
    const added = tentative.find((l) => l.lineId === line.lineId);
    if (added?.allocationError) return { ok: false, message: added.allocationError };

    rememberQuantityMode(med.id, quantityMode);
    set({ cart: tentative, selectedLineId: line.lineId, lastAddPulse: Date.now() });
    return { ok: true };
  },

  removeLine: (lineId) => {
    set((s) => ({
      cart: recomputeCartAllocations(
        s.medicines,
        s.cart.filter((l) => l.lineId !== lineId)
      ),
      selectedLineId: s.selectedLineId === lineId ? null : s.selectedLineId,
    }));
  },

  setSelectedLine: (lineId) => set({ selectedLineId: lineId }),

  setLineBatch: (lineId, batchId) => {
    const line = get().cart.find((l) => l.lineId === lineId);
    if (!line) return { ok: false, message: 'Line not found.' };
    const med = findMedicine(get().medicines, line.medicineId);
    if (!med) return { ok: false, message: 'Product not found.' };

    if (batchId == null || batchId === '') {
      const nextCart = get().cart.map((l) => (l.lineId === lineId ? { ...l, preferredBatchId: null } : l));
      set({ cart: recomputeCartAllocations(get().medicines, nextCart) });
      return { ok: true };
    }

    const nb = findBatch(med, batchId);
    if (!nb) return { ok: false, message: 'Batch not found.' };
    if (isExpired(nb.expiryDate)) return { ok: false, message: 'This lot is expired.' };

    const nextCart = get().cart.map((l) => (l.lineId === lineId ? { ...l, preferredBatchId: nb.id } : l));
    const nextAlloc = recomputeCartAllocations(get().medicines, nextCart);
    const err = nextAlloc.find((l) => l.lineId === lineId)?.allocationError;
    if (err) return { ok: false, message: err };
    set({ cart: nextAlloc });
    return { ok: true };
  },

  setLineQuantity: (lineId, quantity) => {
    if (!Number.isFinite(quantity) || quantity < 1) {
      return { ok: false, message: 'Quantity must be at least 1.' };
    }
    const line = get().cart.find((l) => l.lineId === lineId);
    if (!line) return { ok: false, message: 'Line not found.' };

    const nextCart = get().cart.map((l) => (l.lineId === lineId ? { ...l, quantity } : l));
    const nextAlloc = recomputeCartAllocations(get().medicines, nextCart);
    const upd = nextAlloc.find((l) => l.lineId === lineId);
    if (upd?.allocationError) return { ok: false, message: upd.allocationError };

    set({ cart: nextAlloc });
    return { ok: true };
  },

  bumpLineQuantity: (lineId, delta) => {
    const line = get().cart.find((l) => l.lineId === lineId);
    if (!line) return { ok: false, message: 'Line not found.' };
    const next = line.quantity + delta;
    if (next < 1) {
      get().removeLine(lineId);
      return { ok: true };
    }
    return get().setLineQuantity(lineId, next);
  },

  setLineUnitPrice: (lineId, price) => {
    set((s) => {
      const reconciled = recomputeCartAllocations(s.medicines, s.cart);
      const line = reconciled.find((l) => l.lineId === lineId);
      let p = Math.max(0.01, Math.round(price * 100) / 100);
      if (line && !useSettingsStore.getState().allowSellBelowCost) {
        const floor = Math.round(line.costPrice * 100) / 100;
        p = Math.max(p, Math.max(0.01, floor));
      }
      const nextCart = reconciled.map((l) =>
        l.lineId === lineId ? { ...l, unitPrice: p, pricingMode: 'custom' as const } : l
      );
      return { cart: recomputeCartAllocations(s.medicines, nextCart) };
    });
  },

  setLineQuantityMode: (lineId, mode) => {
    const line = get().cart.find((l) => l.lineId === lineId);
    if (!line) return { ok: false, message: 'Line not found.' };
    if (line.quantityMode === mode) return { ok: true };

    const med = findMedicine(get().medicines, line.medicineId);
    if (!med) return { ok: false, message: 'Product not found.' };

    const tpp = line.tabletsPerPack;
    if (mode === 'packet' && tpp < 2) {
      return {
        ok: false,
        message: 'Add a numeric pack size on the medicine master to sell in packets.',
      };
    }

    const currentTablets = lineTotalTablets(line);

    let nextQty: number;
    if (mode === 'tablet') {
      nextQty = Math.max(1, currentTablets);
    } else {
      nextQty = Math.max(1, Math.floor(currentTablets / tpp));
    }

    rememberQuantityMode(line.medicineId, mode);

    const nextCart = get().cart.map((l) =>
      l.lineId === lineId ? { ...l, quantityMode: mode, quantity: nextQty } : l
    );
    const nextAlloc = recomputeCartAllocations(get().medicines, nextCart);
    const upd = nextAlloc.find((l) => l.lineId === lineId);
    if (upd?.allocationError) return { ok: false, message: upd.allocationError };

    set({ cart: nextAlloc });
    return { ok: true };
  },

  setCustomer: (c) => set({ customer: c }),

  setDiscount: (value, type) => {
    const v = Math.max(0, value);
    set({ discount: v, discountType: type });
  },

  setPaymentMethod: (m) => set({ paymentMethod: m }),

  getTotals: () => {
    const { cart, discount, discountType, appliedServiceCharges, medicines } = get();
    const subtotal = cart.reduce((acc, l) => acc + cartLineSubtotal(medicines, l), 0);
    const rawDisc =
      discountType === 'percentage' ? (subtotal * Math.min(100, discount)) / 100 : discount;
    const discountAmt = Math.min(rawDisc, subtotal);
    const serviceTotal = serviceSum(appliedServiceCharges);
    const afterDisc = Math.max(0, subtotal - discountAmt);
    const taxable = afterDisc + serviceTotal;
    const taxRate = Math.max(0, useSettingsStore.getState().taxPercent) / 100;
    const tax = Math.round(taxable * taxRate * 100) / 100;
    const total = Math.round((taxable + tax) * 100) / 100;
    return { subtotal, discountAmt, serviceTotal, tax, total };
  },

  finalizeCheckoutFromReceipt: async (action, options) => {
    void action;
    const snap = get();
    const { customer, discount, discountType, paymentMethod, appliedServiceCharges, receiptInvoiceNo } = snap;
    const cart = recomputeCartAllocations(snap.medicines, snap.cart);
    if (cart.length === 0) return { ok: false, message: 'Cart is empty.' };
    const bad = cart.find((l) => l.allocationError);
    if (bad?.allocationError) {
      set({ cart });
      return { ok: false, message: bad.allocationError };
    }

    set({ cart });
    const { subtotal, discountAmt, serviceTotal, tax, total } = get().getTotals();
    const invPrefix = useSettingsStore.getState().invoicePrefix.replace(/-+$/, '') || 'INV';
    const invoiceNo = receiptInvoiceNo ?? `${invPrefix}-${Date.now()}`;

    let creditAmountPosted: number | undefined;
    let paidCashPortion: number | undefined;
    let finalPaymentMethod = paymentMethod;

    if (options?.creditAmount != null) {
      if (!customer) return { ok: false, message: 'Select a customer before using credit.' };
      const raw = Number(options.creditAmount);
      if (!Number.isFinite(raw) || raw <= 0) {
        return { ok: false, message: 'Credit amount must be greater than zero.' };
      }
      const cap = Math.round(total * 100) / 100;
      const amt = Math.min(Math.round(raw * 100) / 100, cap);
      if (amt <= 0) return { ok: false, message: 'Invalid credit amount.' };
      creditAmountPosted = amt;
      finalPaymentMethod = 'credit';
      const cashPart = Math.round((cap - amt) * 100) / 100;
      paidCashPortion = cashPart > 0.001 ? cashPart : undefined;
    }

    const billT = Math.round(total * 100) / 100;
    const openingB = customer ? Math.round(customer.balance * 100) / 100 : 0;
    let counterPaid: number | undefined;
    let duesPaid = 0;
    let closingB = openingB;

    if (customer && (finalPaymentMethod === 'cash' || finalPaymentMethod === 'card')) {
      const raw =
        options?.counterPayment != null ? Number(options.counterPayment) : billT;
      if (!Number.isFinite(raw) || raw < 0) {
        return { ok: false, message: 'Invalid payment amount.' };
      }
      counterPaid = Math.round(raw * 100) / 100;
      closingB = Math.max(0, Math.round((openingB + billT - counterPaid) * 100) / 100);
      if (counterPaid > billT + 1e-6) {
        duesPaid = Math.round(Math.min(openingB, counterPaid - billT) * 100) / 100;
      }
    } else if (customer && finalPaymentMethod === 'credit' && creditAmountPosted != null) {
      closingB = Math.round((openingB + creditAmountPosted) * 100) / 100;
    }

    const sale: Sale = {
      id: `S-${Date.now()}`,
      invoiceNo,
      customer,
      items: enrichCartLinesForSaleLedger(snap.medicines, cart.map((l) => ({ ...l }))),
      subtotal,
      discountInput: discount,
      discountType,
      discountApplied: discountAmt,
      serviceCharges: { ...appliedServiceCharges },
      serviceChargeTotal: serviceTotal,
      tax,
      total,
      paymentMethod: finalPaymentMethod,
      ...(creditAmountPosted != null
        ? {
            creditAmount: creditAmountPosted,
            ...(paidCashPortion != null ? { paidCashPortion } : {}),
          }
        : {}),
      ...(customer && counterPaid != null
        ? {
            counterPaymentTotal: counterPaid,
            ...(duesPaid > 0.001 ? { duesPaidWithSale: duesPaid } : {}),
            customerOpeningBalance: openingB,
            customerClosingBalance: closingB,
          }
        : {}),
      ...(customer && finalPaymentMethod === 'credit'
        ? {
            customerOpeningBalance: openingB,
            customerClosingBalance: closingB,
          }
        : {}),
      timestamp: new Date().toISOString(),
    };

    // Persist sale/stock mutation in backend transaction first.
    try {
      const normalizedCustomerId = customer?.id?.trim();
      await posApi.sales.create({
        ...(normalizedCustomerId ? { customerId: normalizedCustomerId } : {}),
        customerName: customer?.name ?? '',
        paymentMethod: finalPaymentMethod,
        ...(creditAmountPosted != null ? { creditAmount: creditAmountPosted } : {}),
        ...(counterPaid != null ? { counterPayment: counterPaid } : {}),
        discount: discountAmt,
        tax,
        items: cart.map((line) => ({
          medicineId: line.medicineId,
          quantityMode: line.quantityMode,
          quantity: line.quantity,
        })),
      });
    } catch (error) {
      toastMutationError('Sale was not recorded', error);
      return {
        ok: false,
        message: error instanceof Error ? error.message : 'Failed to finalize sale.',
      };
    }

    let medicinesAfterSync = snap.medicines;
    try {
      medicinesAfterSync = await posApi.medicines.list();
    } catch (error) {
      toastMutationInfo(
        `Sale was recorded, but live stock could not be refreshed (${apiErrMessage(error)}). Pull to refresh inventory when online.`
      );
    }

    set((s) => {
      let customers = s.customers;
      if (customer && creditAmountPosted != null) {
        const day = sale.timestamp.slice(0, 10);
        const entry: CustomerCreditHistoryEntry = {
          invoiceId: invoiceNo,
          amount: creditAmountPosted,
          date: sale.timestamp,
          kind: 'credit',
        };
        customers = customers.map((c) => {
          if (c.id !== customer.id) return c;
          const next = applyCreditSaleToCustomer(c, entry, creditAmountPosted!);
          return { ...next, lastPurchase: day };
        });
      } else if (customer && (finalPaymentMethod === 'cash' || finalPaymentMethod === 'card')) {
        const day = sale.timestamp.slice(0, 10);
        customers = customers.map((c) => {
          if (c.id !== customer.id) return c;
          const prevHist = c.creditHistory ?? [];
          const payEntry: CustomerCreditHistoryEntry | null =
            duesPaid > 0.001
              ? {
                  invoiceId: `${invoiceNo}-DU`,
                  amount: duesPaid,
                  date: sale.timestamp,
                  kind: 'payment',
                }
              : null;
          return {
            ...c,
            balance: closingB,
            creditHistory: payEntry ? [...prevHist, payEntry] : prevHist,
            lastPurchase: day,
          };
        });
      } else if (customer) {
        const day = sale.timestamp.slice(0, 10);
        customers = customers.map((c) => (c.id === customer.id ? { ...c, lastPurchase: day } : c));
      }
      return {
        sales: [...s.sales, sale],
        customers,
        medicines: medicinesAfterSync,
        cart: [],
        selectedLineId: null,
        customer: null,
        discount: 0,
        discountType: 'fixed',
        paymentMethod: 'cash',
        appliedServiceCharges: { ...EMPTY_SERVICE },
        checkoutFlowStep: null,
        receiptInvoiceNo: null,
      };
    });

    window.setTimeout(() => {
      if (useSettingsStore.getState().defaultFocusSearch) {
        document.getElementById('pos-search-input')?.focus();
      }
    }, 50);

    try {
      await get().hydrateReferenceData();
      await get().hydrateBusinessData();
    } catch (error) {
      toastMutationInfo(`Sale completed; directory refresh failed (${apiErrMessage(error)}).`);
    }

    return { ok: true };
  },

  recordCustomerBalancePayment: async (customerId, amount) => {
    const raw = Number(amount);
    if (!Number.isFinite(raw) || raw <= 0) {
      return { ok: false, message: 'Enter a positive amount.' };
    }
    const am = Math.round(raw * 100) / 100;
    const s = get();
    const c = s.customers.find((x) => x.id === customerId);
    if (!c) return { ok: false, message: 'Customer not found.' };
    if (am > c.balance + 1e-6) {
      return { ok: false, message: 'Amount cannot exceed outstanding balance.' };
    }
    const prev = { customers: structuredClone(s.customers), customer: s.customer };
    const iso = new Date().toISOString();
    const ref = `PAY-${Date.now()}`;
    const entry: CustomerCreditHistoryEntry = {
      invoiceId: ref,
      amount: am,
      date: iso,
      kind: 'payment',
    };
    const newBal = Math.max(0, Math.round((c.balance - am) * 100) / 100);
    const updated: Customer = {
      ...c,
      balance: newBal,
      creditHistory: [...(c.creditHistory ?? []), entry],
    };
    set({
      customers: s.customers.map((x) => (x.id === customerId ? updated : x)),
      customer: s.customer?.id === customerId ? updated : s.customer,
    });
    try {
      await posApi.customers.payBalance(customerId, am);
      await get().hydrateReferenceData();
      toastMutationSuccess('Balance payment recorded.');
      return { ok: true };
    } catch (error) {
      set({ customers: prev.customers, customer: prev.customer });
      toastMutationError('Payment was not saved', error);
      return { ok: false, message: apiErrMessage(error) };
    }
  },

  deleteSale: async (saleId) => {
    const prev = { sales: structuredClone(get().sales) };
    set((s) => ({ sales: s.sales.filter((x) => x.id !== saleId) }));
    try {
      await posApi.sales.remove(saleId);
      await Promise.all([get().hydratePOSData(), get().hydrateBusinessData()]);
      toastMutationSuccess('Sale deleted');
    } catch (error) {
      set({ sales: prev.sales });
      toastMutationError('Sale was not deleted', error);
      try {
        await Promise.all([get().hydratePOSData(), get().hydrateBusinessData()]);
      } catch {
        /* ignore */
      }
    }
  },

  addCustomer: async (payload) => {
    const id = `c-${Date.now()}`;
    const row: Customer = {
      id,
      name: payload.name.trim() || 'Customer',
      phone: payload.phone.trim() || '—',
      balance: Math.max(0, Math.round((payload.balance ?? 0) * 100) / 100),
      creditHistory: [],
      ...(payload.address?.trim() ? { address: payload.address.trim().slice(0, 200) } : {}),
      ...(payload.creditLimit != null && payload.creditLimit > 0
        ? { creditLimit: Math.round(payload.creditLimit * 100) / 100 }
        : {}),
    };
    set((s) => ({ customers: [...s.customers, row] }));
    try {
      await posApi.customers.create({
        id,
        name: row.name,
        phone: row.phone,
        address: row.address ?? '',
        creditLimit: row.creditLimit ?? 0,
        balanceDue: row.balance,
      });
      await get().hydrateReferenceData();
      return id;
    } catch (error) {
      set((s) => ({ customers: s.customers.filter((c) => c.id !== id) }));
      toastMutationError('Customer was not saved', error);
      return null;
    }
  },

  updateCustomer: async (customerId, patch) => {
    const prev = { customers: structuredClone(get().customers), customer: get().customer };
    set((s) => {
      const next = s.customers.map((c) => {
        if (c.id !== customerId) return c;
        return {
          ...c,
          ...(patch.name != null ? { name: patch.name } : {}),
          ...(patch.phone != null ? { phone: patch.phone } : {}),
          ...(patch.balance !== undefined
            ? { balance: Math.max(0, Math.round(patch.balance * 100) / 100) }
            : {}),
          ...(patch.address !== undefined
            ? { address: patch.address?.trim() ? patch.address.trim().slice(0, 200) : undefined }
            : {}),
          ...(patch.creditLimit !== undefined
            ? {
                creditLimit:
                  patch.creditLimit != null && patch.creditLimit > 0
                    ? Math.round(patch.creditLimit * 100) / 100
                    : undefined,
              }
            : {}),
          ...(patch.lastPurchase !== undefined ? { lastPurchase: patch.lastPurchase } : {}),
        };
      });
      const updated = next.find((c) => c.id === customerId);
      return {
        customers: next,
        customer: s.customer?.id === customerId && updated ? updated : s.customer,
      };
    });
    try {
      await posApi.customers.update(customerId, {
        name: patch.name,
        phone: patch.phone,
        address: patch.address,
        creditLimit: patch.creditLimit,
        balanceDue: patch.balance,
        lastPurchaseAt: patch.lastPurchase,
      });
      await get().hydrateReferenceData();
      toastMutationSuccess('Customer updated');
    } catch (error) {
      set({ customers: prev.customers, customer: prev.customer });
      toastMutationError('Customer was not updated', error);
    }
  },

  removeCustomer: async (customerId) => {
    const prev = { customers: structuredClone(get().customers), customer: get().customer };
    set((s) => ({
      customers: s.customers.filter((c) => c.id !== customerId),
      customer: s.customer?.id === customerId ? null : s.customer,
    }));
    try {
      await posApi.customers.remove(customerId);
      await get().hydrateReferenceData();
      toastMutationSuccess('Customer removed');
      return true;
    } catch (error) {
      set({ customers: prev.customers, customer: prev.customer });
      toastMutationError('Customer was not removed', error);
      return false;
    }
  },

  addSupplier: async (payload) => {
    const id = `sup-${Date.now()}`;
    const row: Supplier = {
      id,
      name: payload.name.trim() || 'Supplier',
      phone: payload.phone.trim() || '—',
      ...(payload.company?.trim() ? { company: payload.company.trim().slice(0, 120) } : {}),
      ...(payload.address?.trim() ? { address: payload.address.trim().slice(0, 200) } : {}),
      outstandingBalance: Math.max(0, Math.round((payload.outstandingBalance ?? 0) * 100) / 100),
    };
    set((s) => ({ suppliers: [...s.suppliers, row] }));
    try {
      await posApi.suppliers.create({
        id,
        name: row.name,
        phone: row.phone,
        company: row.company ?? '',
        address: row.address ?? '',
      });
      await get().hydrateReferenceData();
      toastMutationSuccess('Supplier added');
      return id;
    } catch (error) {
      set((s) => ({ suppliers: s.suppliers.filter((x) => x.id !== id) }));
      toastMutationError('Supplier was not saved', error);
      return null;
    }
  },

  updateSupplier: async (supplierId, patch) => {
    const prev = structuredClone(get().suppliers);
    set((s) => ({
      suppliers: s.suppliers.map((x) =>
        x.id !== supplierId
          ? x
          : {
              ...x,
              ...(patch.name !== undefined ? { name: patch.name } : {}),
              ...(patch.phone !== undefined ? { phone: patch.phone } : {}),
              ...(patch.company !== undefined ? { company: patch.company } : {}),
              ...(patch.address !== undefined ? { address: patch.address } : {}),
              ...(patch.outstandingBalance !== undefined
                ? {
                    outstandingBalance: Math.max(
                      0,
                      Math.round(patch.outstandingBalance * 100) / 100
                    ),
                  }
                : {}),
            }
      ),
    }));
    try {
      await posApi.suppliers.update(supplierId, {
        name: patch.name,
        phone: patch.phone,
        company: patch.company,
        address: patch.address,
      });
      await get().hydrateReferenceData();
      toastMutationSuccess('Supplier updated');
    } catch (error) {
      set({ suppliers: prev });
      toastMutationError('Supplier was not updated', error);
    }
  },

  removeSupplier: async (supplierId) => {
    if (get().purchases.some((p) => p.supplierId === supplierId)) return false;
    const prev = structuredClone(get().suppliers);
    set((s) => ({ suppliers: s.suppliers.filter((x) => x.id !== supplierId) }));
    try {
      await posApi.suppliers.remove(supplierId);
      await get().hydrateReferenceData();
      toastMutationSuccess('Supplier removed');
      return true;
    } catch (error) {
      set({ suppliers: prev });
      toastMutationError('Supplier was not removed', error);
      return false;
    }
  },

  addManufacturer: async (payload) => {
    const id = `mfr-${Date.now()}`;
    const row: Manufacturer = {
      id,
      name: payload.name.trim() || 'Manufacturer',
      phone: payload.phone.trim() || '—',
      ...(payload.company?.trim() ? { company: payload.company.trim().slice(0, 120) } : {}),
      ...(payload.address?.trim() ? { address: payload.address.trim().slice(0, 200) } : {}),
    };
    set((s) => ({ manufacturers: [...s.manufacturers, row] }));
    try {
      await posApi.manufacturers.create({
        id,
        name: row.name,
        phone: row.phone,
        company: row.company ?? '',
        address: row.address ?? '',
      });
      await get().hydrateReferenceData();
      toastMutationSuccess('Manufacturer added');
      return id;
    } catch (error) {
      set((s) => ({ manufacturers: s.manufacturers.filter((x) => x.id !== id) }));
      toastMutationError('Manufacturer was not saved', error);
      return null;
    }
  },

  updateManufacturer: async (manufacturerId, patch) => {
    const prev = structuredClone(get().manufacturers);
    set((s) => ({
      manufacturers: s.manufacturers.map((x) =>
        x.id !== manufacturerId
          ? x
          : {
              ...x,
              ...(patch.name !== undefined ? { name: patch.name } : {}),
              ...(patch.phone !== undefined ? { phone: patch.phone } : {}),
              ...(patch.company !== undefined ? { company: patch.company } : {}),
              ...(patch.address !== undefined ? { address: patch.address } : {}),
            }
      ),
    }));
    try {
      await posApi.manufacturers.update(manufacturerId, {
        name: patch.name,
        phone: patch.phone,
        company: patch.company,
        address: patch.address,
      });
      await get().hydrateReferenceData();
      toastMutationSuccess('Manufacturer updated');
    } catch (error) {
      set({ manufacturers: prev });
      toastMutationError('Manufacturer was not updated', error);
    }
  },

  removeManufacturer: async (manufacturerId) => {
    const target = get().manufacturers.find((m) => m.id === manufacturerId);
    if (!target) return false;
    const inUse = get().medicines.some((m) => (m.manufacturer ?? '').trim().toLowerCase() === target.name.toLowerCase());
    if (inUse) return false;
    const prev = structuredClone(get().manufacturers);
    set((s) => ({ manufacturers: s.manufacturers.filter((x) => x.id !== manufacturerId) }));
    try {
      await posApi.manufacturers.remove(manufacturerId);
      await get().hydrateReferenceData();
      toastMutationSuccess('Manufacturer removed');
      return true;
    } catch (error) {
      set({ manufacturers: prev });
      toastMutationError('Manufacturer was not removed', error);
      return false;
    }
  },

  createPurchase: async (row) => {
    const tempId = `p-${Date.now()}`;
    const full: Purchase = {
      ...row,
      id: tempId,
      status: 'pending',
      timestamp: new Date().toISOString(),
    };
    set((s) => ({ purchases: [full, ...s.purchases] }));
    try {
      const created = (await posApi.purchases.createPending({
        id: tempId,
        supplierId: row.supplierId,
        supplierName: row.supplierName,
        purchaseDate: row.purchaseDate,
        grnNo: row.grnNo,
        tax: row.tax,
        discount: row.discount,
        items: row.lines.map((l) => ({
          medicineId: l.medicineId,
          medicineName: l.medicineName,
          batchNo: l.batchNo,
          expiryDate: l.expiryDate,
          quantityPacks: Math.max(1, Math.round(l.quantity / Math.max(1, get().medicines.find((m) => m.id === l.medicineId)?.tabletsPerPack || 1))),
          tabletsPerPack: Math.max(1, get().medicines.find((m) => m.id === l.medicineId)?.tabletsPerPack || 1),
          unitCostPerTablet: l.unitCost,
        })),
      })) as { id?: string } | null;
      const persistedId = created?.id && typeof created.id === 'string' ? created.id : tempId;
      if (persistedId !== tempId) {
        set((s) => ({
          purchases: s.purchases.map((p) => (p.id === tempId ? { ...p, id: persistedId } : p)),
        }));
      }
      await Promise.all([get().hydratePOSData(), get().hydrateBusinessData()]);
      toastMutationSuccess('Purchase saved');
      return persistedId;
    } catch (error) {
      set((s) => ({
        purchases: s.purchases.filter((p) => p.id !== tempId),
        syncError:
          error instanceof Error ? `Failed to create purchase: ${error.message}` : 'Failed to create purchase.',
      }));
      toastMutationError('Purchase was not created', error);
      throw error;
    }
  },

  updatePurchase: async (purchaseId, row) => {
    const prev = structuredClone(get().purchases);
    set((s) => ({
      purchases: s.purchases.map((p) =>
        p.id === purchaseId && p.status === 'pending'
          ? { ...p, ...row, id: p.id, status: 'pending', timestamp: p.timestamp }
          : p
      ),
    }));
    try {
      await posApi.purchases.updatePending(purchaseId, {
        supplierId: row.supplierId,
        supplierName: row.supplierName,
        purchaseDate: row.purchaseDate,
        grnNo: row.grnNo,
        tax: row.tax,
        discount: row.discount,
        items: row.lines.map((l) => ({
          medicineId: l.medicineId,
          medicineName: l.medicineName,
          batchNo: l.batchNo,
          expiryDate: l.expiryDate,
          quantityPacks: Math.max(1, Math.round(l.quantity / Math.max(1, get().medicines.find((m) => m.id === l.medicineId)?.tabletsPerPack || 1))),
          tabletsPerPack: Math.max(1, get().medicines.find((m) => m.id === l.medicineId)?.tabletsPerPack || 1),
          unitCostPerTablet: l.unitCost,
        })),
      });
      await Promise.all([get().hydratePOSData(), get().hydrateBusinessData()]);
      toastMutationSuccess('Purchase updated');
    } catch (error) {
      set({ purchases: prev });
      toastMutationError('Purchase was not saved', error);
      try {
        await Promise.all([get().hydratePOSData(), get().hydrateBusinessData()]);
      } catch {
        /* ignore */
      }
    }
  },

  deletePurchase: async (purchaseId) => {
    const p = get().purchases.find((x) => x.id === purchaseId);
    if (!p || p.status !== 'pending') return false;
    const prev = structuredClone(get().purchases);
    set((s) => ({ purchases: s.purchases.filter((x) => x.id !== purchaseId) }));
    try {
      await posApi.purchases.removePending(purchaseId);
      await get().hydrateBusinessData();
      toastMutationSuccess('Draft purchase deleted');
      return true;
    } catch (error) {
      set({ purchases: prev });
      toastMutationError('Purchase was not deleted', error);
      try {
        await get().hydrateBusinessData();
      } catch {
        /* ignore */
      }
      return false;
    }
  },

  completePurchase: async (purchaseId) => {
    let p = get().purchases.find((x) => x.id === purchaseId);
    if (!p) return { ok: false, message: 'Purchase not found.' };
    const initialPurchase = p;
    if (p.status !== 'pending') return { ok: false, message: 'Already received.' };
    try {
      let receiveId = purchaseId;
      // Temporary optimistic ids are local-only; resolve the real backend id before receive.
      if (receiveId.startsWith('p-')) {
        await get().hydrateBusinessData();
        const resolved = get().purchases.find(
          (x) =>
            x.status === 'pending' &&
            x.grnNo === initialPurchase.grnNo &&
            x.supplierId === initialPurchase.supplierId &&
            Math.abs((x.total ?? 0) - (initialPurchase.total ?? 0)) < 0.0001
        );
        if (!resolved) return { ok: false, message: 'Purchase is not yet synced. Please retry in a moment.' };
        receiveId = resolved.id;
        p = resolved;
      }
      await posApi.purchases.receive(receiveId);
      await Promise.all([get().hydratePOSData(), get().hydrateReferenceData(), get().hydrateBusinessData()]);
      toastMutationSuccess('Purchase received');
      return { ok: true };
    } catch (error) {
      toastMutationError('Could not complete purchase', error);
      return { ok: false, message: error instanceof Error ? error.message : 'Could not complete purchase.' };
    }
  },

  processReturn: async (payload) => {
    const rows = payload.lines
      .map((l) => ({
        ...l,
        tablets: Math.max(0, Math.floor(Number(l.tablets) || 0)),
        unitPrice: Math.max(0, Number(l.unitPrice) || 0),
      }))
      .filter((l) => l.tablets > 0);
    if (rows.length === 0) return { ok: false, message: 'Add at least one item.' };
    const saleIds = [...new Set(rows.map((r) => r.sourceSaleId).filter(Boolean))];
    const saleId = saleIds.length === 1 ? saleIds[0] : null;
    try {
      await posApi.returns.create({
        returnType: payload.kind,
        supplierId: payload.supplierId,
        saleId,
        notes: payload.note ?? '',
        items: rows.map((l) => ({
          medicineId: l.medicineId,
          batchId: l.batchId,
          batchNo: l.batchNo,
          quantityTablets: l.tablets,
          unitPrice: l.unitPrice,
        })),
      });
      await Promise.all([get().hydratePOSData(), get().hydrateReferenceData(), get().hydrateBusinessData()]);
      toastMutationSuccess('Return processed');
      return { ok: true };
    } catch (error) {
      toastMutationError('Return was not processed', error);
      return { ok: false, message: error instanceof Error ? error.message : 'Could not process return.' };
    }
  },

  voidCart: () => {
    set({
      cart: [],
      selectedLineId: null,
      appliedServiceCharges: { ...EMPTY_SERVICE },
      checkoutFlowStep: null,
      receiptInvoiceNo: null,
    });
  },

  resetToDemoSeed: () => {
    set({
      medicines: [],
      medicineCategories: [],
      customers: [],
      suppliers: [],
      manufacturers: [],
      purchases: [],
      sales: [],
      returns: [],
      cart: [],
      selectedLineId: null,
      customer: null,
      discount: 0,
      discountType: 'fixed',
      paymentMethod: 'cash',
      lastAddPulse: 0,
      appliedServiceCharges: { ...EMPTY_SERVICE },
      checkoutFlowStep: null,
      receiptInvoiceNo: null,
    });
    void (async () => {
      try {
        await Promise.all([get().hydratePOSData(), get().hydrateReferenceData(), get().hydrateBusinessData()]);
        toastMutationSuccess('Reloaded from server');
      } catch (error) {
        toastMutationError('Reload from server failed', error);
      }
    })();
  },
}));

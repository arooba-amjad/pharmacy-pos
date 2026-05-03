/** One sellable lot. Stock is ONLY in smallest units (tablets/capsules/etc.). */
export interface MedicineBatch {
  id: string;
  batchNo: string;
  expiryDate: string;
  /** Single source of truth — smallest sellable units on hand. */
  totalTablets: number;
  salePricePerTablet: number;
  salePricePerPack: number;
  /** Landed cost per smallest unit. */
  costPricePerTablet: number;
}

export type MedicineForm = 'tablet' | 'syrup' | 'capsule' | 'other';
export type MedicineType = 'tablet' | 'syrup' | 'injection' | 'cream' | 'drops' | (string & {});
export type MedicineUnitType = 'tablet' | 'ml' | 'vial' | 'tube';

export interface Medicine {
  id: string;
  name: string;
  generic: string;
  /** Commercial / trade label for salt-alternative UI (defaults to manufacturer if unset). */
  brand?: string;
  /**
   * Active pharmaceutical ingredients; when empty, POS derives from `generic`
   * (e.g. "Amoxicillin + Clavulanic Acid").
   */
  salts?: string[];
  /** e.g. 625mg, 10mg — used for salt-alternative ranking. */
  strength?: string;
  /** Dosage form for salt matching; inferred from `unit` when omitted. */
  form?: MedicineForm;
  /** Category-aware medicine type used by creation/edit forms. */
  type?: MedicineType;
  /** Canonical stock/sale unit associated with the selected type. */
  unitType?: MedicineUnitType;
  unit: string;
  /** Therapeutic class — salt alternatives only match inside the same category. */
  category: string;
  /** Optional; shown on Medicines screen and searchable. */
  manufacturer?: string;
  /** Linked manufacturer record when selected from master list. */
  manufacturerId?: string;
  /** Tablets per full commercial pack (≥1). Canonical pack size; overrides parsing `packSize` when set. */
  tabletsPerPack?: number;
  /** Human-readable pack label, e.g. "10 caplets" (display only; stock is always in tablets). */
  packSize?: string;
  /** Volume in ml for liquid/drop products when relevant. */
  volume?: number;
  /** Master sale price per smallest unit (derived from pack sale when using packet-driven entry). */
  salePricePerTablet?: number;
  /** Master sale price per full pack (aligned with tabletsPerPack). */
  salePricePerPack?: number;
  /** @deprecated Mirror of salePricePerTablet for legacy reads. */
  defaultSalePrice?: number;
  /** Default landed cost per smallest unit (derived from purchase price per pack). */
  defaultPurchasePrice?: number;
  /**
   * Sellable tablets at or below this level → low-stock in inventory, POS, and dashboard.
   * When omitted, Settings → default low-stock threshold (tablets) applies.
   */
  lowStockThreshold?: number;
  /** Primary supplier for purchases and reporting (set at catalog creation). */
  supplierId?: string;
  batches: MedicineBatch[];
}

export type CartQuantityMode = 'tablet' | 'packet';

/** One portion of a cart line taken from a specific lot (preview until checkout). */
export interface CartBatchSlice {
  batchId: string;
  batchNo: string;
  expiryDate: string;
  tablets: number;
  /** Landed cost per tablet at sale time (from batch). */
  costPricePerTablet?: number;
  /** Effective sale $/tablet for this slice (batch price, or spread for custom line price). */
  salePricePerTablet?: number;
}

export interface CartLine {
  lineId: string;
  medicineId: string;
  /** Primary lot for display — mirrors first FEFO slice after allocation. */
  batchId: string;
  name: string;
  generic: string;
  /** Snapshot from medicine master for receipts and POS cart. */
  manufacturer?: string;
  batchNo: string;
  expiryDate: string;
  unit: string;
  /** How `quantity` is counted: loose units vs full packs (see `tabletsPerPack`). */
  quantityMode: CartQuantityMode;
  /** Parsed pack size at add-to-cart time; loose mode uses 1. */
  tabletsPerPack: number;
  quantity: number;
  /** Price per `quantity` (per tablet/capsule or per pack depending on `quantityMode`). */
  unitPrice: number;
  /** Cost per `quantity` (aligned with `quantityMode`). */
  costPrice: number;
  /** Per-batch tablet splits (FEFO + optional preferred lot). */
  batchSlices: CartBatchSlice[];
  /** When set, that lot is consumed first; remainder follows FEFO. */
  preferredBatchId?: string | null;
  /** Set when total demand exceeds non-expired virtual stock (unless negative stock is allowed). */
  allocationError?: string;
  /** `custom` = cashier overrode line price; lots still drive stock preview. */
  pricingMode?: 'fefo' | 'custom';
}

/** Ledger entry: credit sale (charge to account) or cash/card payment toward balance. */
export interface CustomerCreditHistoryEntry {
  invoiceId: string;
  amount: number;
  /** ISO timestamp */
  date: string;
  /** `payment` = customer paid down balance at counter (not a new credit charge). */
  kind?: 'credit' | 'payment';
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  balance: number;
  lastPurchase?: string;
  address?: string;
  /** Optional credit ceiling for UI hints (not enforced in demo POS). */
  creditLimit?: number;
  /** Append-only credit sales from checkout (customer-based credit payment). */
  creditHistory?: CustomerCreditHistoryEntry[];
}

export interface ServiceChargeSnapshot {
  deliveryFee: number;
  serviceFee: number;
  customLabel: string;
  customAmount: number;
}

export interface Sale {
  id: string;
  invoiceNo: string;
  /** Persisted from checkout — wholesale/bulk channel shows “Bulk sale” in history. */
  pricingChannel?: 'retail' | 'wholesale';
  customer: Customer | null;
  items: CartLine[];
  subtotal: number;
  discountInput: number;
  discountType: 'percentage' | 'fixed';
  discountApplied: number;
  serviceCharges: ServiceChargeSnapshot;
  serviceChargeTotal: number;
  tax: number;
  total: number;
  paymentMethod: 'cash' | 'card' | 'credit';
  /**
   * When `paymentMethod === 'credit'`, amount posted to customer ledger (≤ `total`).
   * If less than `total`, remainder is treated as cash collected at counter.
   */
  creditAmount?: number;
  /** When partial credit: `total - creditAmount` collected as cash. */
  paidCashPortion?: number;
  /** Cash/card collected at counter (may exceed `total` when paying prior balance). */
  counterPaymentTotal?: number;
  /** Portion of counter payment applied to prior customer balance (same invoice). */
  duesPaidWithSale?: number;
  /** Customer balance before this invoice (dues + effect of this sale). */
  customerOpeningBalance?: number;
  /** Customer balance after this invoice. */
  customerClosingBalance?: number;
  timestamp: string;
}

export interface Supplier {
  id: string;
  name: string;
  phone: string;
  company?: string;
  address?: string;
  /** Amount owed to this supplier (demo: increases when purchase is received). */
  outstandingBalance: number;
}

export interface Manufacturer {
  id: string;
  name: string;
  phone: string;
  company?: string;
  address?: string;
}

export interface PurchaseLine {
  id: string;
  medicineId: string;
  medicineName: string;
  batchNo: string;
  expiryDate: string;
  /** Received quantity in smallest units (tablets/capsules). */
  quantity: number;
  /** True when the line was entered as packs at GRN time (UI hint only). */
  enteredAsPackets?: boolean;
  /** Cost per smallest unit (matches inventory batch cost). */
  unitCost: number;
  lineTotal: number;
}

export interface Purchase {
  id: string;
  grnNo: string;
  supplierId: string;
  supplierName: string;
  /** ISO date (calendar day) for GRN. */
  purchaseDate: string;
  timestamp: string;
  status: 'pending' | 'completed';
  lines: PurchaseLine[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
}

export type ReturnKind = 'customer' | 'supplier';
export type CustomerReturnSettlement = 'cash' | 'credit' | 'exchange';

export interface ReturnLine {
  id: string;
  medicineId: string;
  medicineName: string;
  batchId: string;
  batchNo: string;
  tablets: number;
  unitPrice: number;
  lineTotal?: number;
  sourceSaleId?: string;
  sourceInvoiceNo?: string;
}

export interface ReturnRecord {
  id: string;
  kind: ReturnKind;
  settlement?: CustomerReturnSettlement;
  supplierId?: string;
  supplierName?: string;
  customerId?: string;
  customerName?: string;
  note?: string;
  lines: ReturnLine[];
  total: number;
  /** Cash drawer impact: negative for refund outflow, positive for inflow. */
  cashImpact: number;
  /** Customer balance delta: positive increases dues, negative decreases dues. */
  customerBalanceDelta: number;
  /** Indicates this return should continue as exchange sale in POS. */
  exchangeRedirectToPOS?: boolean;
  timestamp: string;
}

export type AppScreen =
  | 'POS'
  | 'Dashboard'
  | 'Inventory'
  | 'Medicines'
  | 'Sales'
  | 'Returns'
  | 'Customers'
  | 'Reports'
  | 'Purchases'
  | 'Suppliers'
  | 'Settings';

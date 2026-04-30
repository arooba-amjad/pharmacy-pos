import type { Medicine, MedicineBatch, Purchase, ReturnRecord, Sale } from '@/types';

type ApiResponse<T> = {
  ok?: boolean;
  success?: boolean;
  data?: T;
  error?: string;
  message?: string;
};

type MedicineApiRow = {
  id: string;
  name: string;
  generic: string;
  type?: string;
  category?: string;
  unit_type?: string;
  unit?: string;
  tablets_per_pack?: number;
  volume_ml?: number;
  supplier_id?: string | null;
  supplier_name?: string;
  manufacturer_id?: string | null;
  manufacturer_name?: string;
  low_stock_threshold?: number;
  purchase_per_pack?: number;
  sale_per_pack?: number;
  batches?: BatchApiRow[];
};

type BatchApiRow = {
  id: string;
  batch_no: string;
  expiry_date: string;
  quantity_tablets: number;
  sale_price_per_tablet: number;
  sale_price_per_pack: number;
  cost_price_per_tablet: number;
};

type SupplierApiRow = {
  id: string;
  name: string;
  phone?: string;
  company?: string;
  address?: string;
  balance_payable?: number;
};

type ManufacturerApiRow = {
  id: string;
  name: string;
  phone?: string;
  company?: string;
  address?: string;
};

type CustomerApiRow = {
  id: string;
  name: string;
  phone?: string;
  address?: string;
  credit_limit?: number;
  balance_due?: number;
  last_purchase_at?: string | null;
};

type SaleItemApiRow = {
  id: string;
  medicine_id: string;
  batch_id: string;
  batch_no: string;
  quantity_units: number;
  quantity_tablets: number;
  quantity_mode: 'tablet' | 'packet';
  unit_price: number;
  expiry_date: string;
};

type SaleApiRow = {
  id: string;
  customer_name?: string;
  customerName?: string;
  customer_phone?: string;
  customerPhone?: string;
  payment_method: 'cash' | 'card' | 'credit';
  subtotal: number;
  discount: number;
  tax?: number;
  total: number;
  created_at: string;
  items?: SaleItemApiRow[];
};

type PurchaseItemApiRow = {
  id: string;
  medicine_id: string;
  batch_no: string;
  expiry_date: string;
  quantity_tablets: number;
  unit_cost_per_tablet: number;
  line_total: number;
};

type PurchaseApiRow = {
  id: string;
  grn_no?: string;
  supplier_id: string;
  supplier_name: string;
  purchase_date: string;
  status: 'pending' | 'received' | 'cancelled';
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  created_at: string;
  items?: PurchaseItemApiRow[];
};

type ReturnItemApiRow = {
  id: string;
  medicine_id: string;
  batch_id?: string | null;
  batch_no: string;
  quantity_tablets: number;
  unit_price: number;
  line_total: number;
};

type ReturnApiRow = {
  id: string;
  return_type: 'customer' | 'supplier';
  supplier_id?: string | null;
  subtotal: number;
  total: number;
  created_at: string;
  items?: ReturnItemApiRow[];
};

function toMedicineBatch(row: BatchApiRow): MedicineBatch {
  return {
    id: row.id,
    batchNo: row.batch_no,
    expiryDate: row.expiry_date,
    totalTablets: Number(row.quantity_tablets) || 0,
    salePricePerTablet: Number(row.sale_price_per_tablet) || 0,
    salePricePerPack: Number(row.sale_price_per_pack) || 0,
    costPricePerTablet: Number(row.cost_price_per_tablet) || 0,
  };
}

function toMedicine(row: MedicineApiRow): Medicine {
  const tpp = Math.max(1, Number(row.tablets_per_pack) || 1);
  const salePack = Number(row.sale_per_pack) || 0;
  return {
    id: row.id,
    name: row.name,
    generic: row.generic ?? '',
    type: row.type,
    category: row.category ?? '',
    unitType: (row.unit_type as Medicine['unitType']) ?? 'tablet',
    unit: row.unit ?? 'Tablet',
    tabletsPerPack: tpp,
    volume: row.volume_ml ? Number(row.volume_ml) : undefined,
    supplierId: row.supplier_id ?? undefined,
    manufacturerId: row.manufacturer_id ?? undefined,
    manufacturer: row.manufacturer_name ?? undefined,
    lowStockThreshold: Number(row.low_stock_threshold) || 0,
    salePricePerPack: salePack,
    salePricePerTablet: tpp >= 2 ? salePack / tpp : salePack,
    defaultSalePrice: tpp >= 2 ? salePack / tpp : salePack,
    defaultPurchasePrice: tpp >= 2 ? (Number(row.purchase_per_pack) || 0) / tpp : Number(row.purchase_per_pack) || 0,
    batches: (row.batches ?? []).map(toMedicineBatch),
  };
}

function mapSaleRow(row: SaleApiRow, medicines: Medicine[]): Sale {
  const customerName = (row.customer_name ?? row.customerName ?? '').trim();
  const customer =
    customerName.length > 0
      ? {
          id: `sale-customer-${row.id}`,
          name: customerName,
          phone: row.customer_phone ?? row.customerPhone ?? '',
          balance: 0,
        }
      : null;
  const items = (row.items ?? []).map((it) => {
    const med = medicines.find((m) => m.id === it.medicine_id);
    const tpp = Math.max(1, med?.tabletsPerPack || 1);
    const quantity =
      it.quantity_mode === 'packet' ? Math.max(1, Math.round(Number(it.quantity_units) || 1)) : Math.max(1, Math.round(Number(it.quantity_units) || 1));
    return {
      lineId: it.id,
      medicineId: it.medicine_id,
      batchId: it.batch_id,
      name: med?.name ?? 'Medicine',
      generic: med?.generic ?? '',
      manufacturer: med?.manufacturer,
      batchNo: it.batch_no,
      expiryDate: it.expiry_date,
      unit: med?.unit ?? 'Unit',
      quantityMode: it.quantity_mode,
      tabletsPerPack: tpp,
      quantity,
      unitPrice: Number(it.unit_price) || 0,
      costPrice: 0,
      batchSlices: [],
      preferredBatchId: null,
      pricingMode: 'fefo' as const,
    };
  });
  return {
    id: row.id,
    invoiceNo: `INV-${row.id.slice(-8).toUpperCase()}`,
    customer,
    items,
    subtotal: Number(row.subtotal) || 0,
    discountInput: Number(row.discount) || 0,
    discountType: 'fixed',
    discountApplied: Number(row.discount) || 0,
    serviceCharges: { deliveryFee: 0, serviceFee: 0, customLabel: 'Service charge', customAmount: 0 },
    serviceChargeTotal: 0,
    tax: Number(row.tax) || 0,
    total: Number(row.total) || 0,
    paymentMethod: row.payment_method,
    timestamp: row.created_at,
  };
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const method = (init?.method?.toUpperCase() ?? 'GET') as 'GET' | 'POST' | 'PUT' | 'DELETE';
  if (!window.api?.request) {
    throw new Error('Desktop API bridge is unavailable.');
  }
  const body = init?.body ? JSON.parse(String(init.body)) : undefined;
  const json = (await window.api.request({
    method,
    path,
    body,
  })) as ApiResponse<T>;
  const success = Boolean(json?.ok ?? json?.success ?? (json?.data !== undefined && !json?.error));
  if (!success) throw new Error(json?.error ?? json?.message ?? 'IPC request failed');
  return json?.data as T;
}

export const posApi = {
  health: () => request('/health'),

  medicines: {
    list: async () => {
      const rows = await request<MedicineApiRow[]>('/medicines');
      return rows.map(toMedicine);
    },
    create: (payload: unknown) => request('/medicines', { method: 'POST', body: JSON.stringify(payload) }),
    update: (id: string, payload: unknown) =>
      request(`/medicines/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
    remove: (id: string) => request(`/medicines/${id}`, { method: 'DELETE' }),
    addBatch: (id: string, payload: unknown) =>
      request(`/medicines/${id}/batches`, { method: 'POST', body: JSON.stringify(payload) }),
  },

  suppliers: {
    list: async () => {
      const rows = await request<SupplierApiRow[]>('/suppliers');
      return rows.map((r) => ({
        id: r.id,
        name: r.name,
        phone: r.phone ?? '',
        company: r.company || undefined,
        address: r.address || undefined,
        outstandingBalance: Number(r.balance_payable) || 0,
      }));
    },
    create: (payload: unknown) => request('/suppliers', { method: 'POST', body: JSON.stringify(payload) }),
    update: (id: string, payload: unknown) =>
      request(`/suppliers/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
    remove: (id: string) => request(`/suppliers/${id}`, { method: 'DELETE' }),
  },

  manufacturers: {
    list: async () => {
      const rows = await request<ManufacturerApiRow[]>('/manufacturers');
      return rows.map((r) => ({
        id: r.id,
        name: r.name,
        phone: r.phone ?? '',
        company: r.company || undefined,
        address: r.address || undefined,
      }));
    },
    create: (payload: unknown) => request('/manufacturers', { method: 'POST', body: JSON.stringify(payload) }),
    update: (id: string, payload: unknown) =>
      request(`/manufacturers/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
    remove: (id: string) => request(`/manufacturers/${id}`, { method: 'DELETE' }),
  },

  customers: {
    list: async () => {
      const rows = await request<CustomerApiRow[]>('/customers');
      return rows.map((r) => ({
        id: r.id,
        name: r.name,
        phone: r.phone ?? '',
        address: r.address || undefined,
        creditLimit: Number(r.credit_limit) || undefined,
        balance: Number(r.balance_due) || 0,
        lastPurchase: r.last_purchase_at || undefined,
        creditHistory: [],
      }));
    },
    create: (payload: unknown) => request('/customers', { method: 'POST', body: JSON.stringify(payload) }),
    update: (id: string, payload: unknown) =>
      request(`/customers/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
    remove: (id: string) => request(`/customers/${id}`, { method: 'DELETE' }),
    payBalance: (id: string, amount: number) =>
      request(`/customers/${id}/payments`, { method: 'POST', body: JSON.stringify({ amount }) }),
  },

  purchases: {
    list: () => request('/purchases'),
    listDetailed: async (medicines: Medicine[]): Promise<Purchase[]> => {
      const rows = await request<PurchaseApiRow[]>('/purchases?includeItems=1');
      return rows.map((p) => ({
        id: p.id,
        grnNo: p.grn_no || `GRN-${p.id.slice(-8).toUpperCase()}`,
        supplierId: p.supplier_id,
        supplierName: p.supplier_name,
        purchaseDate: p.purchase_date,
        timestamp: p.created_at,
        status: p.status === 'received' ? 'completed' : 'pending',
        lines: (p.items ?? []).map((it) => ({
          id: it.id,
          medicineId: it.medicine_id,
          medicineName: medicines.find((m) => m.id === it.medicine_id)?.name ?? 'Medicine',
          batchNo: it.batch_no,
          expiryDate: it.expiry_date,
          quantity: Number(it.quantity_tablets) || 0,
          unitCost: Number(it.unit_cost_per_tablet) || 0,
          lineTotal: Number(it.line_total) || 0,
        })),
        subtotal: Number(p.subtotal) || 0,
        discount: Number(p.discount) || 0,
        tax: Number(p.tax) || 0,
        total: Number(p.total) || 0,
      }));
    },
    createPending: (payload: unknown) => request('/purchases', { method: 'POST', body: JSON.stringify(payload) }),
    updatePending: (id: string, payload: unknown) =>
      request(`/purchases/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
    removePending: (id: string) => request(`/purchases/${id}`, { method: 'DELETE' }),
    receive: (id: string) => request(`/purchases/${id}/receive`, { method: 'POST' }),
  },

  sales: {
    list: () => request('/sales'),
    listDetailed: async (medicines: Medicine[]): Promise<Sale[]> => {
      const rows = await request<SaleApiRow[]>('/sales?includeItems=1');
      return rows.map((s) => mapSaleRow(s, medicines));
    },
    create: (payload: unknown) => request('/sales', { method: 'POST', body: JSON.stringify(payload) }),
    remove: (id: string) => request(`/sales/${id}`, { method: 'DELETE' }),
  },
  batches: {
    list: (medicineId?: string) =>
      request(medicineId ? `/batches?medicineId=${encodeURIComponent(medicineId)}` : '/batches'),
    update: (id: string, payload: unknown) =>
      request(`/batches/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
    remove: (id: string) => request(`/batches/${id}`, { method: 'DELETE' }),
  },


  returns: {
    list: () => request('/returns'),
    listDetailed: async (): Promise<ReturnRecord[]> => {
      const rows = await request<ReturnApiRow[]>('/returns?includeItems=1');
      return rows.map((r) => ({
        id: r.id,
        kind: r.return_type,
        supplierId: r.supplier_id ?? undefined,
        lines: (r.items ?? []).map((it) => ({
          id: it.id,
          medicineId: it.medicine_id,
          medicineName: 'Medicine',
          batchId: it.batch_id ?? '',
          batchNo: it.batch_no,
          tablets: Number(it.quantity_tablets) || 0,
          unitPrice: Number(it.unit_price) || 0,
          lineTotal: Number(it.line_total) || 0,
        })),
        total: Number(r.total) || 0,
        cashImpact: 0,
        customerBalanceDelta: 0,
        timestamp: r.created_at,
      }));
    },
    create: (payload: unknown) => request('/returns', { method: 'POST', body: JSON.stringify(payload) }),
  },
};

import { z } from 'zod';

export const idSchema = z.string().trim().min(1);
export const isoDateSchema = z.string().trim().min(1);

export const medicineCreateSchema = z.object({
  id: z.string().trim().optional(),
  name: z.string().trim().min(1),
  generic: z.string().optional().default(''),
  type: z.string().optional().default('tablet'),
  category: z.string().optional().default(''),
  unitType: z.string().optional().default('tablet'),
  unit: z.string().optional().default('Tablet'),
  tabletsPerPack: z.coerce.number().int().min(1).optional().default(1),
  volumeMl: z.coerce.number().min(0).optional().default(0),
  supplierId: z.string().nullable().optional(),
  supplierName: z.string().optional().default(''),
  manufacturerId: z.string().nullable().optional(),
  manufacturerName: z.string().optional().default(''),
  lowStockThreshold: z.coerce.number().min(0).optional().default(0),
  purchasePerPack: z.coerce.number().min(0).optional().default(0),
  salePerPack: z.coerce.number().min(0).optional().default(0),
});

export const medicineUpdateSchema = medicineCreateSchema.partial();

export const batchCreateSchema = z.object({
  id: z.string().trim().optional(),
  batchNo: z.string().trim().min(1),
  expiryDate: isoDateSchema,
  quantityTablets: z.coerce.number().int().min(0).default(0),
  costPricePerTablet: z.coerce.number().min(0).default(0),
  salePricePerTablet: z.coerce.number().min(0).default(0),
  salePricePerPack: z.coerce.number().min(0).default(0),
});

export const supplierUpsertSchema = z.object({
  id: z.string().trim().optional(),
  name: z.string().trim().min(1),
  phone: z.string().optional().default(''),
  company: z.string().optional().default(''),
  address: z.string().optional().default(''),
});

export const customerUpsertSchema = z.object({
  id: z.string().trim().optional(),
  name: z.string().trim().min(1),
  phone: z.string().optional().default(''),
  address: z.string().optional().default(''),
  creditLimit: z.coerce.number().min(0).optional().default(0),
  balanceDue: z.coerce.number().min(0).optional().default(0),
});

export const saleCreateSchema = z.object({
  customerId: z.string().trim().optional(),
  customerName: z.string().optional(),
  paymentMethod: z.enum(['cash', 'card', 'credit']).default('cash'),
  creditAmount: z.coerce.number().min(0).optional(),
  counterPayment: z.coerce.number().min(0).optional(),
  discount: z.coerce.number().min(0).optional().default(0),
  tax: z.coerce.number().min(0).optional().default(0),
  items: z
    .array(
      z.object({
        medicineId: z.string().trim().min(1),
        quantityMode: z.enum(['tablet', 'packet']).default('tablet'),
        quantity: z.coerce.number().int().positive(),
      })
    )
    .min(1),
});

export const purchaseCreateSchema = z.object({
  supplierId: z.string().trim().min(1),
  supplierName: z.string().optional(),
  purchaseDate: z.string().optional(),
  grnNo: z.string().optional(),
  notes: z.string().optional(),
  tax: z.coerce.number().min(0).optional().default(0),
  discount: z.coerce.number().min(0).optional().default(0),
  items: z
    .array(
      z.object({
        medicineId: z.string().trim().min(1),
        quantityPacks: z.coerce.number().int().positive(),
        tabletsPerPack: z.coerce.number().int().positive().optional(),
        unitCostPerTablet: z.coerce.number().min(0).optional().default(0),
        batchNo: z.string().optional().default(''),
        expiryDate: z.string().optional().default(''),
      })
    )
    .min(1),
});

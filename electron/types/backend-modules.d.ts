declare module '../backend/db.js' {
  export const db: {
    prepare: (sql: string) => {
      get: (...args: unknown[]) => any;
      all: (...args: unknown[]) => any[];
      run: (...args: unknown[]) => { changes: number };
    };
  };
  export function generateId(prefix: string): string;
  export function nowIso(): string;
}

declare module '../backend/services.js' {
  export function createPendingPurchase(payload: Record<string, unknown>): unknown;
  export function createReturn(payload: Record<string, unknown>): unknown;
  export function createSale(payload: Record<string, unknown>): unknown;
  export function deleteBatch(batchId: string): unknown;
  export function getPurchaseById(purchaseId: string): unknown;
  export function receivePurchase(purchaseId: string): unknown;
  export function reverseSale(saleId: string): unknown;
  export function updateBatch(batchId: string, payload: Record<string, unknown>): unknown;
}

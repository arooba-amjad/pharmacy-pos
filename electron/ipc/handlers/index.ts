import { ipcMain } from 'electron';
import { isFeatureEnabled } from '../../features';
import { logger } from '../../logger';
import { createBatchesHandlers } from './batches';
import { createMedicinesHandlers } from './medicines';
import { createPurchasesHandlers } from './purchases';
import { createReturnsHandlers } from './returns';
import { createSalesHandlers } from './sales';
import { createSuppliersHandlers } from './suppliers';
import type { IpcHandler, IpcHandlerMap, LegacyRequest } from './types';

type Deps = {
  db: any;
  nowIso: () => string;
  generateId: (prefix: string) => string;
  createPendingPurchase: (payload: Record<string, unknown>) => unknown;
  createReturn: (payload: Record<string, unknown>) => unknown;
  createSale: (payload: Record<string, unknown>) => unknown;
  deleteBatch: (batchId: string) => unknown;
  getPurchaseById: (purchaseId: string) => unknown;
  receivePurchase: (purchaseId: string) => unknown;
  reverseSale: (saleId: string) => unknown;
  updateBatch: (batchId: string, payload: Record<string, unknown>) => unknown;
};

const RATE_LIMIT_PER_SEC = 50;
const hitStore = new Map<string, { sec: number; count: number }>();

function assertRateLimit(channel: string): void {
  const nowSec = Math.floor(Date.now() / 1000);
  const key = `global:${channel}`;
  const prev = hitStore.get(key);
  if (!prev || prev.sec !== nowSec) {
    hitStore.set(key, { sec: nowSec, count: 1 });
    return;
  }
  prev.count += 1;
  if (prev.count > RATE_LIMIT_PER_SEC) {
    throw new Error(`Rate limit exceeded for ${channel}`);
  }
}

function withGuard(channel: string, fn: IpcHandler): IpcHandler {
  return async (payload?: unknown) => {
    try {
      assertRateLimit(channel);
      return await fn(payload);
    } catch (error) {
      logger.error('IPC handler failed', { channel, payload, error: String(error) });
      throw error instanceof Error ? error : new Error(String(error));
    }
  };
}

function joinHandlerMaps(...maps: IpcHandlerMap[]): IpcHandlerMap {
  return maps.reduce<IpcHandlerMap>((acc, cur) => ({ ...acc, ...cur }), {});
}

function toLegacyResult(data: unknown) {
  return { ok: true, success: true, data };
}

function mapLegacyRequestToChannel(req: LegacyRequest): { channel: string; payload?: unknown } {
  const m = req.method;
  const p = req.path;
  if (m === 'GET' && p === '/health') return { channel: 'app:health' };

  if (m === 'GET' && p === '/medicines') return { channel: 'medicines:list' };
  if (m === 'POST' && p === '/medicines') return { channel: 'medicines:create', payload: req.body };
  if (m === 'PUT' && /^\/medicines\/[^/]+$/.test(p)) return { channel: 'medicines:update', payload: { id: p.split('/')[2], body: req.body } };
  if (m === 'DELETE' && /^\/medicines\/[^/]+$/.test(p)) return { channel: 'medicines:remove', payload: p.split('/')[2] };
  if (m === 'POST' && /^\/medicines\/[^/]+\/batches$/.test(p)) return { channel: 'medicines:addBatch', payload: { medicineId: p.split('/')[2], body: req.body } };

  if (m === 'GET' && p === '/suppliers') return { channel: 'suppliers:list' };
  if (m === 'POST' && p === '/suppliers') return { channel: 'suppliers:create', payload: req.body };
  if (m === 'PUT' && /^\/suppliers\/[^/]+$/.test(p)) return { channel: 'suppliers:update', payload: { id: p.split('/')[2], body: req.body } };
  if (m === 'DELETE' && /^\/suppliers\/[^/]+$/.test(p)) return { channel: 'suppliers:remove', payload: p.split('/')[2] };

  if (m === 'GET' && p === '/manufacturers') return { channel: 'manufacturers:list' };
  if (m === 'POST' && p === '/manufacturers') return { channel: 'manufacturers:create', payload: req.body };
  if (m === 'PUT' && /^\/manufacturers\/[^/]+$/.test(p)) return { channel: 'manufacturers:update', payload: { id: p.split('/')[2], body: req.body } };
  if (m === 'DELETE' && /^\/manufacturers\/[^/]+$/.test(p)) return { channel: 'manufacturers:remove', payload: p.split('/')[2] };

  if (m === 'GET' && p === '/customers') return { channel: 'customers:list' };
  if (m === 'POST' && p === '/customers') return { channel: 'customers:create', payload: req.body };
  if (m === 'PUT' && /^\/customers\/[^/]+$/.test(p)) return { channel: 'customers:update', payload: { id: p.split('/')[2], body: req.body } };
  if (m === 'DELETE' && /^\/customers\/[^/]+$/.test(p)) return { channel: 'customers:remove', payload: p.split('/')[2] };
  if (m === 'POST' && /^\/customers\/[^/]+\/payments$/.test(p)) return { channel: 'customers:payBalance', payload: { id: p.split('/')[2], amount: (req.body as { amount?: unknown })?.amount } };

  if (m === 'GET' && p.startsWith('/sales')) {
    const byId = p.match(/^\/sales\/([^/?]+)$/);
    if (byId) return { channel: 'sales:get', payload: byId[1] };
    return { channel: 'sales:list', payload: { includeItems: p.includes('includeItems=1') } };
  }
  if (m === 'POST' && p === '/sales') return { channel: 'sales:create', payload: req.body };
  if (m === 'DELETE' && /^\/sales\/[^/]+$/.test(p)) return { channel: 'sales:remove', payload: p.split('/')[2] };

  if (m === 'GET' && p.startsWith('/purchases')) {
    const byId = p.match(/^\/purchases\/([^/?]+)$/);
    if (byId) return { channel: 'purchases:get', payload: byId[1] };
    return { channel: 'purchases:list', payload: { includeItems: p.includes('includeItems=1') } };
  }
  if (m === 'POST' && p === '/purchases') return { channel: 'purchases:create', payload: req.body };
  if (m === 'PUT' && /^\/purchases\/[^/]+$/.test(p)) return { channel: 'purchases:update', payload: { id: p.split('/')[2], body: req.body } };
  if (m === 'DELETE' && /^\/purchases\/[^/]+$/.test(p)) return { channel: 'purchases:remove', payload: p.split('/')[2] };
  if (m === 'POST' && /^\/purchases\/[^/]+\/receive$/.test(p)) return { channel: 'purchases:receive', payload: p.split('/')[2] };

  if (m === 'GET' && p.startsWith('/returns')) {
    const byId = p.match(/^\/returns\/([^/?]+)$/);
    if (byId) return { channel: 'returns:get', payload: byId[1] };
    return { channel: 'returns:list', payload: { includeItems: p.includes('includeItems=1') } };
  }
  if (m === 'POST' && p === '/returns') return { channel: 'returns:create', payload: req.body };

  if (m === 'GET' && p.startsWith('/batches')) {
    const u = new URL(`ipc://local${p}`);
    return { channel: 'batches:list', payload: { medicineId: u.searchParams.get('medicineId') ?? undefined } };
  }
  if (m === 'PUT' && /^\/batches\/[^/]+$/.test(p)) return { channel: 'batches:update', payload: { id: p.split('/')[2], body: req.body } };
  if (m === 'DELETE' && /^\/batches\/[^/]+$/.test(p)) return { channel: 'batches:remove', payload: p.split('/')[2] };

  throw new Error(`Unsupported legacy request: ${m} ${p}`);
}

export function registerDomainHandlers(deps: Deps): void {
  const handlers = joinHandlerMaps(
    createMedicinesHandlers(deps),
    createSuppliersHandlers(deps),
    createSalesHandlers(deps),
    createPurchasesHandlers(deps),
    createReturnsHandlers(deps),
    createBatchesHandlers(deps),
    {
      'app:health': () => ({
        status: 'up',
        time: deps.nowIso(),
        features: {
          cloudSync: isFeatureEnabled('cloud-sync'),
        },
      }),
    }
  );

  for (const [channel, handler] of Object.entries(handlers)) {
    ipcMain.handle(channel, (_event, payload) => withGuard(channel, handler)(payload));
  }

  // Backward-compat adapter for existing renderer API layer.
  ipcMain.handle('pos:request', async (_event, request: LegacyRequest) => {
    const mapped = mapLegacyRequestToChannel(request);
    const handler = handlers[mapped.channel];
    if (!handler) {
      throw new Error(`No IPC handler found for channel: ${mapped.channel}`);
    }
    const data = await withGuard(mapped.channel, handler)(mapped.payload);
    return toLegacyResult(data);
  });
}

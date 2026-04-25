# SQLite Backend Integration Map

This project now includes an Express + SQLite backend in `backend/` that can be adopted without changing UI/UX flows.

## Run

- Start frontend/electron as before: `npm run dev`
- Start backend API in another terminal: `npm run api:dev`
- API base URL defaults to `http://localhost:4789` (override with `VITE_POS_API_URL`)

## Endpoint Mapping (Zustand action -> API)

- `addMedicineMasterRecord(payload)` -> `POST /api/medicines`
- `applyMedicineMasterPatch(id, patch)` -> `PUT /api/medicines/:id`
- `removeMedicine(id)` -> `DELETE /api/medicines/:id`
- `loadMedicines()` (new startup hydration step) -> `GET /api/medicines`

- `addSupplier(payload)` -> `POST /api/suppliers`
- `updateSupplier(id, patch)` -> `PUT /api/suppliers/:id`
- `removeSupplier(id)` -> `DELETE /api/suppliers/:id`
- `loadSuppliers()` -> `GET /api/suppliers`

- `addManufacturer(payload)` -> `POST /api/manufacturers`
- `updateManufacturer(id, patch)` -> `PUT /api/manufacturers/:id`
- `removeManufacturer(id)` -> `DELETE /api/manufacturers/:id`
- `loadManufacturers()` -> `GET /api/manufacturers`

- `createPurchasePending(payload)` -> `POST /api/purchases`
- `receivePurchase(id)` -> `POST /api/purchases/:id/receive`
- `loadPurchases()` -> `GET /api/purchases`

- `recordSale(payload)` -> `POST /api/sales`
- `loadSales()` -> `GET /api/sales`

- `recordReturn(payload)` -> `POST /api/returns`
- `loadReturns()` -> `GET /api/returns`

## Transaction Safety

The backend wraps these in SQLite transactions:

- purchase receiving (`/api/purchases/:id/receive`)
- sale creation with FEFO (`/api/sales`)
- returns (`/api/returns`)

## Migration Strategy (non-breaking)

1. Keep Zustand as the source of UI state.
2. Add async store actions that call `src/lib/api/posApi.ts`.
3. On success, update Zustand using the API response (instead of local-only mutation).
4. Add startup hydration:
   - medicines, suppliers, manufacturers, purchases, sales, returns.
5. Keep existing UI and component events unchanged (only swap action internals).

## Notes

- Supplier and manufacturer names are unique in DB.
- Delete checks block linked records to protect relational integrity.
- Batch stock is maintained at batch row level and mirrored to `medicines.total_stock_tablets`.
- FEFO stock deduction is automatic in sales.

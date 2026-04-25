# Pharmacy POS Backend (Express + SQLite)

## Start

```bash
npm run api:dev
```

Server: `http://localhost:4789`

Health: `GET /health`

## Main APIs

- `GET /api/medicines`
- `POST /api/medicines`
- `PUT /api/medicines/:id`
- `DELETE /api/medicines/:id`

- `GET /api/suppliers`
- `POST /api/suppliers`
- `PUT /api/suppliers/:id`
- `DELETE /api/suppliers/:id`

- `GET /api/manufacturers`
- `POST /api/manufacturers`
- `PUT /api/manufacturers/:id`
- `DELETE /api/manufacturers/:id`

- `GET /api/purchases`
- `GET /api/purchases/:id`
- `POST /api/purchases` (create pending)
- `POST /api/purchases/:id/receive` (receive + stock + supplier payable update)

- `GET /api/sales`
- `GET /api/sales/:id`
- `POST /api/sales` (FEFO stock deduction)

- `GET /api/returns`
- `POST /api/returns` (customer/supplier return stock adjustment)

## Notes

- SQLite file is created at `backend/data/pharmacy.sqlite`.
- Foreign keys are enabled.
- Purchase receive / Sale create / Return create are transaction-safe.

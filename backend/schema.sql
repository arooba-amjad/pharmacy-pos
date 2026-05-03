PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS suppliers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  phone TEXT NOT NULL DEFAULT '',
  company TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  balance_payable REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS manufacturers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  phone TEXT NOT NULL DEFAULT '',
  company TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  credit_limit REAL NOT NULL DEFAULT 0,
  balance_due REAL NOT NULL DEFAULT 0,
  last_purchase_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);

CREATE TABLE IF NOT EXISTS medicines (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  generic TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL DEFAULT 'tablet',
  category TEXT NOT NULL DEFAULT '',
  unit_type TEXT NOT NULL DEFAULT 'tablet',
  unit TEXT NOT NULL DEFAULT 'Tablet',
  tablets_per_pack INTEGER NOT NULL DEFAULT 1,
  volume_ml REAL NOT NULL DEFAULT 0,
  supplier_id TEXT,
  supplier_name TEXT NOT NULL DEFAULT '',
  manufacturer_id TEXT,
  manufacturer_name TEXT NOT NULL DEFAULT '',
  low_stock_threshold INTEGER NOT NULL DEFAULT 0,
  purchase_per_pack REAL NOT NULL DEFAULT 0,
  sale_per_pack REAL NOT NULL DEFAULT 0,
  total_stock_tablets INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON UPDATE CASCADE ON DELETE SET NULL,
  FOREIGN KEY (manufacturer_id) REFERENCES manufacturers(id) ON UPDATE CASCADE ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_medicines_name ON medicines(name);
CREATE INDEX IF NOT EXISTS idx_medicines_type ON medicines(type);

CREATE TABLE IF NOT EXISTS batches (
  id TEXT PRIMARY KEY,
  medicine_id TEXT NOT NULL,
  batch_no TEXT NOT NULL,
  expiry_date TEXT NOT NULL,
  quantity_tablets INTEGER NOT NULL DEFAULT 0,
  cost_price_per_tablet REAL NOT NULL DEFAULT 0,
  sale_price_per_tablet REAL NOT NULL DEFAULT 0,
  sale_price_per_pack REAL NOT NULL DEFAULT 0,
  received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (medicine_id) REFERENCES medicines(id) ON UPDATE CASCADE ON DELETE CASCADE,
  UNIQUE (medicine_id, batch_no)
);

CREATE INDEX IF NOT EXISTS idx_batches_medicine_expiry ON batches(medicine_id, expiry_date);

CREATE TABLE IF NOT EXISTS purchases (
  id TEXT PRIMARY KEY,
  supplier_id TEXT NOT NULL,
  supplier_name TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK (status IN ('pending', 'received', 'cancelled')),
  subtotal REAL NOT NULL DEFAULT 0,
  tax REAL NOT NULL DEFAULT 0,
  discount REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL DEFAULT 0,
  purchase_date TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  grn_no TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  received_at TEXT,
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_purchases_supplier ON purchases(supplier_id);

CREATE TABLE IF NOT EXISTS purchase_items (
  id TEXT PRIMARY KEY,
  purchase_id TEXT NOT NULL,
  medicine_id TEXT NOT NULL,
  batch_no TEXT NOT NULL DEFAULT '',
  expiry_date TEXT NOT NULL,
  quantity_packs INTEGER NOT NULL DEFAULT 0,
  tablets_per_pack INTEGER NOT NULL DEFAULT 1,
  quantity_tablets INTEGER NOT NULL DEFAULT 0,
  unit_cost_per_tablet REAL NOT NULL DEFAULT 0,
  line_total REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON UPDATE CASCADE ON DELETE CASCADE,
  FOREIGN KEY (medicine_id) REFERENCES medicines(id) ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase ON purchase_items(purchase_id);

CREATE TABLE IF NOT EXISTS sales (
  id TEXT PRIMARY KEY,
  customer_name TEXT NOT NULL DEFAULT '',
  payment_method TEXT NOT NULL DEFAULT 'cash',
  pricing_channel TEXT NOT NULL DEFAULT 'retail',
  subtotal REAL NOT NULL DEFAULT 0,
  discount REAL NOT NULL DEFAULT 0,
  tax REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sale_items (
  id TEXT PRIMARY KEY,
  sale_id TEXT NOT NULL,
  medicine_id TEXT NOT NULL,
  batch_id TEXT NOT NULL,
  batch_no TEXT NOT NULL,
  quantity_units INTEGER NOT NULL DEFAULT 0,
  quantity_tablets INTEGER NOT NULL DEFAULT 0,
  quantity_mode TEXT NOT NULL CHECK (quantity_mode IN ('tablet', 'packet')),
  unit_price REAL NOT NULL DEFAULT 0,
  line_total REAL NOT NULL DEFAULT 0,
  expiry_date TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sale_id) REFERENCES sales(id) ON UPDATE CASCADE ON DELETE CASCADE,
  FOREIGN KEY (medicine_id) REFERENCES medicines(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (batch_id) REFERENCES batches(id) ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_batch ON sale_items(batch_id);

CREATE TABLE IF NOT EXISTS returns (
  id TEXT PRIMARY KEY,
  return_type TEXT NOT NULL CHECK (return_type IN ('customer', 'supplier')),
  supplier_id TEXT,
  sale_id TEXT,
  notes TEXT NOT NULL DEFAULT '',
  subtotal REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (sale_id) REFERENCES sales(id) ON UPDATE CASCADE ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS return_items (
  id TEXT PRIMARY KEY,
  return_id TEXT NOT NULL,
  medicine_id TEXT NOT NULL,
  batch_id TEXT,
  batch_no TEXT NOT NULL DEFAULT '',
  quantity_tablets INTEGER NOT NULL DEFAULT 0,
  unit_price REAL NOT NULL DEFAULT 0,
  line_total REAL NOT NULL DEFAULT 0,
  reason TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (return_id) REFERENCES returns(id) ON UPDATE CASCADE ON DELETE CASCADE,
  FOREIGN KEY (medicine_id) REFERENCES medicines(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (batch_id) REFERENCES batches(id) ON UPDATE CASCADE ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_returns_type ON returns(return_type);
CREATE INDEX IF NOT EXISTS idx_return_items_return ON return_items(return_id);

CREATE TABLE IF NOT EXISTS app_users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
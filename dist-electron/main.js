var vo = Object.defineProperty;
var wo = (t, e, r) => e in t ? vo(t, e, { enumerable: !0, configurable: !0, writable: !0, value: r }) : t[e] = r;
var kt = (t, e, r) => wo(t, typeof e != "symbol" ? e + "" : e, r);
import K from "node:path";
import { createRequire as bo } from "node:module";
import { fileURLToPath as To } from "node:url";
import { app as Y, ipcMain as ne, BrowserWindow as $t, dialog as hr, shell as So } from "electron";
import Oo from "electron-updater";
import V from "node:fs";
import oi from "better-sqlite3";
import Fn from "node:os";
import Ao from "fs";
import bn from "path";
import ai from "zlib";
import ko from "crypto";
import dr from "node:crypto";
const Ro = `PRAGMA foreign_keys = ON;\r
\r
CREATE TABLE IF NOT EXISTS suppliers (\r
  id TEXT PRIMARY KEY,\r
  name TEXT NOT NULL UNIQUE,\r
  phone TEXT NOT NULL DEFAULT '',\r
  company TEXT NOT NULL DEFAULT '',\r
  address TEXT NOT NULL DEFAULT '',\r
  balance_payable REAL NOT NULL DEFAULT 0,\r
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,\r
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP\r
);\r
\r
CREATE TABLE IF NOT EXISTS manufacturers (\r
  id TEXT PRIMARY KEY,\r
  name TEXT NOT NULL UNIQUE,\r
  phone TEXT NOT NULL DEFAULT '',\r
  company TEXT NOT NULL DEFAULT '',\r
  address TEXT NOT NULL DEFAULT '',\r
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,\r
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP\r
);\r
\r
CREATE TABLE IF NOT EXISTS customers (\r
  id TEXT PRIMARY KEY,\r
  name TEXT NOT NULL,\r
  phone TEXT NOT NULL DEFAULT '',\r
  address TEXT NOT NULL DEFAULT '',\r
  credit_limit REAL NOT NULL DEFAULT 0,\r
  balance_due REAL NOT NULL DEFAULT 0,\r
  last_purchase_at TEXT,\r
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,\r
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP\r
);\r
\r
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);\r
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);\r
\r
CREATE TABLE IF NOT EXISTS medicines (\r
  id TEXT PRIMARY KEY,\r
  name TEXT NOT NULL,\r
  generic TEXT NOT NULL DEFAULT '',\r
  type TEXT NOT NULL DEFAULT 'tablet',\r
  category TEXT NOT NULL DEFAULT '',\r
  unit_type TEXT NOT NULL DEFAULT 'tablet',\r
  unit TEXT NOT NULL DEFAULT 'Tablet',\r
  tablets_per_pack INTEGER NOT NULL DEFAULT 1,\r
  volume_ml REAL NOT NULL DEFAULT 0,\r
  supplier_id TEXT,\r
  supplier_name TEXT NOT NULL DEFAULT '',\r
  manufacturer_id TEXT,\r
  manufacturer_name TEXT NOT NULL DEFAULT '',\r
  low_stock_threshold INTEGER NOT NULL DEFAULT 0,\r
  purchase_per_pack REAL NOT NULL DEFAULT 0,\r
  sale_per_pack REAL NOT NULL DEFAULT 0,\r
  total_stock_tablets INTEGER NOT NULL DEFAULT 0,\r
  is_active INTEGER NOT NULL DEFAULT 1,\r
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,\r
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,\r
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON UPDATE CASCADE ON DELETE SET NULL,\r
  FOREIGN KEY (manufacturer_id) REFERENCES manufacturers(id) ON UPDATE CASCADE ON DELETE SET NULL\r
);\r
\r
CREATE INDEX IF NOT EXISTS idx_medicines_name ON medicines(name);\r
CREATE INDEX IF NOT EXISTS idx_medicines_type ON medicines(type);\r
\r
CREATE TABLE IF NOT EXISTS batches (\r
  id TEXT PRIMARY KEY,\r
  medicine_id TEXT NOT NULL,\r
  batch_no TEXT NOT NULL,\r
  expiry_date TEXT NOT NULL,\r
  quantity_tablets INTEGER NOT NULL DEFAULT 0,\r
  cost_price_per_tablet REAL NOT NULL DEFAULT 0,\r
  sale_price_per_tablet REAL NOT NULL DEFAULT 0,\r
  sale_price_per_pack REAL NOT NULL DEFAULT 0,\r
  received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,\r
  FOREIGN KEY (medicine_id) REFERENCES medicines(id) ON UPDATE CASCADE ON DELETE CASCADE,\r
  UNIQUE (medicine_id, batch_no)\r
);\r
\r
CREATE INDEX IF NOT EXISTS idx_batches_medicine_expiry ON batches(medicine_id, expiry_date);\r
\r
CREATE TABLE IF NOT EXISTS purchases (\r
  id TEXT PRIMARY KEY,\r
  supplier_id TEXT NOT NULL,\r
  supplier_name TEXT NOT NULL DEFAULT '',\r
  status TEXT NOT NULL CHECK (status IN ('pending', 'received', 'cancelled')),\r
  subtotal REAL NOT NULL DEFAULT 0,\r
  tax REAL NOT NULL DEFAULT 0,\r
  discount REAL NOT NULL DEFAULT 0,\r
  total REAL NOT NULL DEFAULT 0,\r
  purchase_date TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,\r
  grn_no TEXT NOT NULL DEFAULT '',\r
  notes TEXT NOT NULL DEFAULT '',\r
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,\r
  received_at TEXT,\r
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON UPDATE CASCADE ON DELETE RESTRICT\r
);\r
\r
CREATE INDEX IF NOT EXISTS idx_purchases_supplier ON purchases(supplier_id);\r
\r
CREATE TABLE IF NOT EXISTS purchase_items (\r
  id TEXT PRIMARY KEY,\r
  purchase_id TEXT NOT NULL,\r
  medicine_id TEXT NOT NULL,\r
  batch_no TEXT NOT NULL DEFAULT '',\r
  expiry_date TEXT NOT NULL,\r
  quantity_packs INTEGER NOT NULL DEFAULT 0,\r
  tablets_per_pack INTEGER NOT NULL DEFAULT 1,\r
  quantity_tablets INTEGER NOT NULL DEFAULT 0,\r
  unit_cost_per_tablet REAL NOT NULL DEFAULT 0,\r
  line_total REAL NOT NULL DEFAULT 0,\r
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,\r
  FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON UPDATE CASCADE ON DELETE CASCADE,\r
  FOREIGN KEY (medicine_id) REFERENCES medicines(id) ON UPDATE CASCADE ON DELETE RESTRICT\r
);\r
\r
CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase ON purchase_items(purchase_id);\r
\r
CREATE TABLE IF NOT EXISTS sales (\r
  id TEXT PRIMARY KEY,\r
  customer_name TEXT NOT NULL DEFAULT '',\r
  payment_method TEXT NOT NULL DEFAULT 'cash',\r
  subtotal REAL NOT NULL DEFAULT 0,\r
  discount REAL NOT NULL DEFAULT 0,\r
  tax REAL NOT NULL DEFAULT 0,\r
  total REAL NOT NULL DEFAULT 0,\r
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP\r
);\r
\r
CREATE TABLE IF NOT EXISTS sale_items (\r
  id TEXT PRIMARY KEY,\r
  sale_id TEXT NOT NULL,\r
  medicine_id TEXT NOT NULL,\r
  batch_id TEXT NOT NULL,\r
  batch_no TEXT NOT NULL,\r
  quantity_units INTEGER NOT NULL DEFAULT 0,\r
  quantity_tablets INTEGER NOT NULL DEFAULT 0,\r
  quantity_mode TEXT NOT NULL CHECK (quantity_mode IN ('tablet', 'packet')),\r
  unit_price REAL NOT NULL DEFAULT 0,\r
  line_total REAL NOT NULL DEFAULT 0,\r
  expiry_date TEXT NOT NULL,\r
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,\r
  FOREIGN KEY (sale_id) REFERENCES sales(id) ON UPDATE CASCADE ON DELETE CASCADE,\r
  FOREIGN KEY (medicine_id) REFERENCES medicines(id) ON UPDATE CASCADE ON DELETE RESTRICT,\r
  FOREIGN KEY (batch_id) REFERENCES batches(id) ON UPDATE CASCADE ON DELETE RESTRICT\r
);\r
\r
CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);\r
CREATE INDEX IF NOT EXISTS idx_sale_items_batch ON sale_items(batch_id);\r
\r
CREATE TABLE IF NOT EXISTS returns (\r
  id TEXT PRIMARY KEY,\r
  return_type TEXT NOT NULL CHECK (return_type IN ('customer', 'supplier')),\r
  supplier_id TEXT,\r
  sale_id TEXT,\r
  notes TEXT NOT NULL DEFAULT '',\r
  subtotal REAL NOT NULL DEFAULT 0,\r
  total REAL NOT NULL DEFAULT 0,\r
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,\r
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON UPDATE CASCADE ON DELETE RESTRICT,\r
  FOREIGN KEY (sale_id) REFERENCES sales(id) ON UPDATE CASCADE ON DELETE SET NULL\r
);\r
\r
CREATE TABLE IF NOT EXISTS return_items (\r
  id TEXT PRIMARY KEY,\r
  return_id TEXT NOT NULL,\r
  medicine_id TEXT NOT NULL,\r
  batch_id TEXT,\r
  batch_no TEXT NOT NULL DEFAULT '',\r
  quantity_tablets INTEGER NOT NULL DEFAULT 0,\r
  unit_price REAL NOT NULL DEFAULT 0,\r
  line_total REAL NOT NULL DEFAULT 0,\r
  reason TEXT NOT NULL DEFAULT '',\r
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,\r
  FOREIGN KEY (return_id) REFERENCES returns(id) ON UPDATE CASCADE ON DELETE CASCADE,\r
  FOREIGN KEY (medicine_id) REFERENCES medicines(id) ON UPDATE CASCADE ON DELETE RESTRICT,\r
  FOREIGN KEY (batch_id) REFERENCES batches(id) ON UPDATE CASCADE ON DELETE SET NULL\r
);\r
\r
CREATE INDEX IF NOT EXISTS idx_returns_type ON returns(return_type);\r
CREATE INDEX IF NOT EXISTS idx_return_items_return ON return_items(return_id);\r
\r
CREATE TABLE IF NOT EXISTS app_users (\r
  id TEXT PRIMARY KEY,\r
  username TEXT NOT NULL UNIQUE,\r
  email TEXT NOT NULL UNIQUE,\r
  password_hash TEXT NOT NULL,\r
  password_salt TEXT NOT NULL,\r
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,\r
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP\r
);`, No = [
  {
    version: 1,
    description: "Baseline schema (CREATE IF NOT EXISTS)",
    up(t) {
      t.prepare("SELECT 1 AS ok FROM sqlite_master WHERE type = 'table' AND name = 'medicines' LIMIT 1").get() || t.exec(String(Ro));
    }
  },
  {
    version: 2,
    description: "Add app_users table for local desktop authentication",
    up(t) {
      t.exec(`
        CREATE TABLE IF NOT EXISTS app_users (
          id TEXT PRIMARY KEY,
          username TEXT NOT NULL UNIQUE,
          email TEXT NOT NULL UNIQUE,
          password_hash TEXT NOT NULL,
          password_salt TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);
    }
  },
  {
    version: 3,
    description: "Add tax column to sales for persisted invoice totals",
    up(t) {
      t.prepare("PRAGMA table_info('sales')").all().some((n) => String(n.name).toLowerCase() === "tax") || t.exec("ALTER TABLE sales ADD COLUMN tax REAL NOT NULL DEFAULT 0;");
    }
  }
];
function zn(t) {
  const e = t.prepare("SELECT value FROM meta WHERE key = 'db_version'").get();
  if (!(e != null && e.value)) return 0;
  const r = parseInt(String(e.value), 10);
  return Number.isFinite(r) && r >= 0 ? r : 0;
}
function Io(t) {
  t.exec(`
    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
  let e = zn(t);
  e === 0 && t.prepare("SELECT 1 AS ok FROM sqlite_master WHERE type = 'table' AND name = 'medicines' LIMIT 1").get() && (t.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES ('db_version', '1')").run(), e = zn(t));
  for (const r of No)
    r.version <= e || (t.transaction(() => {
      r.up(t);
    })(), t.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES ('db_version', ?)").run(String(r.version)), e = r.version);
}
function ci() {
  const t = K.join(Y.getPath("userData"), "logs");
  return V.mkdirSync(t, { recursive: !0 }), t;
}
function Lo() {
  const t = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  return K.join(ci(), `app-${t}.log`);
}
function Co(t, e, r) {
  const n = r === void 0 ? "" : ` ${JSON.stringify(r)}`;
  return `[${(/* @__PURE__ */ new Date()).toISOString()}] [${t.toUpperCase()}] ${e}${n}
`;
}
function Cr(t, e, r) {
  const n = Co(t, e, r);
  V.appendFileSync(Lo(), n, "utf8"), t === "error" ? console.error(n.trim()) : t === "warn" ? console.warn(n.trim()) : console.log(n.trim());
}
const ge = {
  info: (t, e) => Cr("info", t, e),
  warn: (t, e) => Cr("warn", t, e),
  error: (t, e) => Cr("error", t, e)
};
function Po(t) {
  const e = ci(), r = K.resolve(t), n = V.readdirSync(e).filter((i) => i.endsWith(".log"));
  if (n.length === 0)
    throw new Error("No logs available to export.");
  V.mkdirSync(K.dirname(r), { recursive: !0 });
  const s = n.sort().map((i) => `
===== ${i} =====
` + V.readFileSync(K.join(e, i), "utf8"));
  return V.writeFileSync(r, s.join(""), "utf8"), r;
}
const Do = "pharmacy.db", ui = 1, li = process.env.PHARMACY_DEBUG_DB_WRITES === "1", Uo = process.env.PHARMACY_DEBUG_CRASH_SAFE === "1";
let nt = null, Pr = "";
function ot() {
  return Pr || (Pr = K.join(Y.getPath("userData"), Do)), Pr;
}
function $o(t) {
  t.prepare(
    `CREATE TABLE IF NOT EXISTS app_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`
  ).run();
}
function jo(t, e) {
  t.prepare(
    `INSERT INTO app_meta (key, value, updated_at)
     VALUES ('db_version', ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
  ).run(String(e), (/* @__PURE__ */ new Date()).toISOString());
}
function qt() {
  if (nt) return nt;
  const t = ot();
  V.mkdirSync(K.dirname(t), { recursive: !0 });
  const e = new oi(t);
  return e.pragma("journal_mode = WAL"), e.pragma("foreign_keys = ON"), Uo && (e.pragma("synchronous = FULL"), ge.warn("Crash-safe mode enabled: synchronous=FULL")), Io(e), $o(e), jo(e, ui), nt = e, li && ge.info("DB write debug mode enabled"), nt;
}
function Tn() {
  const e = qt().prepare("SELECT value FROM app_meta WHERE key = 'db_version'").get();
  return Number((e == null ? void 0 : e.value) ?? ui);
}
function Bn() {
  const t = qt(), e = t.prepare("PRAGMA integrity_check").get(), r = String((e == null ? void 0 : e.integrity_check) ?? Object.values(e ?? {})[0] ?? "unknown"), n = t.prepare("PRAGMA foreign_key_check").all();
  return { ok: r.toLowerCase() === "ok" && n.length === 0, integrity: r, foreignKeyViolations: n };
}
function hi() {
  nt && (nt.close(), nt = null);
}
function ue(t, e) {
  li && ge.info(`DB WRITE ${t}`, e);
}
const xo = 5, Fo = 24 * 60 * 60 * 1e3;
function Tr() {
  const t = K.join(Y.getPath("userData"), "backups");
  return V.mkdirSync(t, { recursive: !0 }), t;
}
function zo(t = "") {
  const e = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-");
  return `${t}pharmacy-backup-${e}.db`;
}
function di() {
  const t = Tr();
  return V.readdirSync(t).filter((r) => r.endsWith(".db") && r.includes("pharmacy-backup-")).sort((r, n) => {
    const s = V.statSync(K.join(t, r)).mtimeMs;
    return V.statSync(K.join(t, n)).mtimeMs - s;
  });
}
function fi() {
  const t = Tr();
  return di().map((e) => K.join(t, e));
}
function Bo() {
  const t = fi();
  for (const e of t.slice(xo))
    try {
      V.unlinkSync(e);
    } catch {
    }
}
function Mo() {
  try {
    qt().pragma("wal_checkpoint(FULL)");
  } catch (t) {
    ge.warn("WAL checkpoint failed before backup", { error: String(t) });
  }
}
function Wt(t = "") {
  const e = ot();
  if (!V.existsSync(e))
    throw new Error("Database not found for backup.");
  Mo();
  const r = K.join(Tr(), zo(t));
  V.copyFileSync(e, r);
  const n = `${r}.meta.json`;
  return V.writeFileSync(
    n,
    JSON.stringify(
      {
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        appVersion: Y.getVersion(),
        dbVersion: Tn(),
        dbFileName: K.basename(e)
      },
      null,
      2
    ),
    "utf8"
  ), Bo(), ge.info("Backup created", { path: r, metaPath: n }), r;
}
function Zo() {
  const t = fi();
  if (t.length > 0) {
    const e = V.statSync(t[0]).mtimeMs;
    if (Date.now() - e < Fo) return null;
  }
  return Wt("daily-");
}
function Ho() {
  return Wt("startup-");
}
function tn(t) {
  const e = K.basename(t);
  if (e !== t || !e.endsWith(".db") || !e.includes("pharmacy-backup-"))
    throw new Error("Invalid backup file name.");
  const r = K.join(Tr(), e);
  if (!V.existsSync(r)) throw new Error("Backup file not found.");
  const n = ot();
  He("pre-restore-"), hi();
  for (const s of ["-wal", "-shm"])
    try {
      V.unlinkSync(n + s);
    } catch {
    }
  V.copyFileSync(r, n), qt(), ge.info("Backup restored", { source: r });
}
function rn() {
  return di();
}
function Mn() {
  const t = rn();
  return t.length > 0 ? t[0] : null;
}
function He(t) {
  try {
    return Wt(`${t}`);
  } catch (e) {
    return ge.warn("Pre-operation backup failed", { label: t, error: String(e) }), null;
  }
}
var Zn = typeof globalThis < "u" ? globalThis : typeof window < "u" ? window : typeof global < "u" ? global : typeof self < "u" ? self : {};
function pi(t) {
  return t && t.__esModule && Object.prototype.hasOwnProperty.call(t, "default") ? t.default : t;
}
var Je = { exports: {} }, Dr, Hn;
function mi() {
  return Hn || (Hn = 1, Dr = {
    /* The local file header */
    LOCHDR: 30,
    // LOC header size
    LOCSIG: 67324752,
    // "PK\003\004"
    LOCVER: 4,
    // version needed to extract
    LOCFLG: 6,
    // general purpose bit flag
    LOCHOW: 8,
    // compression method
    LOCTIM: 10,
    // modification time (2 bytes time, 2 bytes date)
    LOCCRC: 14,
    // uncompressed file crc-32 value
    LOCSIZ: 18,
    // compressed size
    LOCLEN: 22,
    // uncompressed size
    LOCNAM: 26,
    // filename length
    LOCEXT: 28,
    // extra field length
    /* The Data descriptor */
    EXTSIG: 134695760,
    // "PK\007\008"
    EXTHDR: 16,
    // EXT header size
    EXTCRC: 4,
    // uncompressed file crc-32 value
    EXTSIZ: 8,
    // compressed size
    EXTLEN: 12,
    // uncompressed size
    /* The central directory file header */
    CENHDR: 46,
    // CEN header size
    CENSIG: 33639248,
    // "PK\001\002"
    CENVEM: 4,
    // version made by
    CENVER: 6,
    // version needed to extract
    CENFLG: 8,
    // encrypt, decrypt flags
    CENHOW: 10,
    // compression method
    CENTIM: 12,
    // modification time (2 bytes time, 2 bytes date)
    CENCRC: 16,
    // uncompressed file crc-32 value
    CENSIZ: 20,
    // compressed size
    CENLEN: 24,
    // uncompressed size
    CENNAM: 28,
    // filename length
    CENEXT: 30,
    // extra field length
    CENCOM: 32,
    // file comment length
    CENDSK: 34,
    // volume number start
    CENATT: 36,
    // internal file attributes
    CENATX: 38,
    // external file attributes (host system dependent)
    CENOFF: 42,
    // LOC header offset
    /* The entries in the end of central directory */
    ENDHDR: 22,
    // END header size
    ENDSIG: 101010256,
    // "PK\005\006"
    ENDSUB: 8,
    // number of entries on this disk
    ENDTOT: 10,
    // total number of entries
    ENDSIZ: 12,
    // central directory size in bytes
    ENDOFF: 16,
    // offset of first CEN header
    ENDCOM: 20,
    // zip file comment length
    END64HDR: 20,
    // zip64 END header size
    END64SIG: 117853008,
    // zip64 Locator signature, "PK\006\007"
    END64START: 4,
    // number of the disk with the start of the zip64
    END64OFF: 8,
    // relative offset of the zip64 end of central directory
    END64NUMDISKS: 16,
    // total number of disks
    ZIP64SIG: 101075792,
    // zip64 signature, "PK\006\006"
    ZIP64HDR: 56,
    // zip64 record minimum size
    ZIP64LEAD: 12,
    // leading bytes at the start of the record, not counted by the value stored in ZIP64SIZE
    ZIP64SIZE: 4,
    // zip64 size of the central directory record
    ZIP64VEM: 12,
    // zip64 version made by
    ZIP64VER: 14,
    // zip64 version needed to extract
    ZIP64DSK: 16,
    // zip64 number of this disk
    ZIP64DSKDIR: 20,
    // number of the disk with the start of the record directory
    ZIP64SUB: 24,
    // number of entries on this disk
    ZIP64TOT: 32,
    // total number of entries
    ZIP64SIZB: 40,
    // zip64 central directory size in bytes
    ZIP64OFF: 48,
    // offset of start of central directory with respect to the starting disk number
    ZIP64EXTRA: 56,
    // extensible data sector
    /* Compression methods */
    STORED: 0,
    // no compression
    SHRUNK: 1,
    // shrunk
    REDUCED1: 2,
    // reduced with compression factor 1
    REDUCED2: 3,
    // reduced with compression factor 2
    REDUCED3: 4,
    // reduced with compression factor 3
    REDUCED4: 5,
    // reduced with compression factor 4
    IMPLODED: 6,
    // imploded
    // 7 reserved for Tokenizing compression algorithm
    DEFLATED: 8,
    // deflated
    ENHANCED_DEFLATED: 9,
    // enhanced deflated
    PKWARE: 10,
    // PKWare DCL imploded
    // 11 reserved by PKWARE
    BZIP2: 12,
    //  compressed using BZIP2
    // 13 reserved by PKWARE
    LZMA: 14,
    // LZMA
    // 15-17 reserved by PKWARE
    IBM_TERSE: 18,
    // compressed using IBM TERSE
    IBM_LZ77: 19,
    // IBM LZ77 z
    AES_ENCRYPT: 99,
    // WinZIP AES encryption method
    /* General purpose bit flag */
    // values can obtained with expression 2**bitnr
    FLG_ENC: 1,
    // Bit 0: encrypted file
    FLG_COMP1: 2,
    // Bit 1, compression option
    FLG_COMP2: 4,
    // Bit 2, compression option
    FLG_DESC: 8,
    // Bit 3, data descriptor
    FLG_ENH: 16,
    // Bit 4, enhanced deflating
    FLG_PATCH: 32,
    // Bit 5, indicates that the file is compressed patched data.
    FLG_STR: 64,
    // Bit 6, strong encryption (patented)
    // Bits 7-10: Currently unused.
    FLG_EFS: 2048,
    // Bit 11: Language encoding flag (EFS)
    // Bit 12: Reserved by PKWARE for enhanced compression.
    // Bit 13: encrypted the Central Directory (patented).
    // Bits 14-15: Reserved by PKWARE.
    FLG_MSK: 4096,
    // mask header values
    /* Load type */
    FILE: 2,
    BUFFER: 1,
    NONE: 0,
    /* 4.5 Extensible data fields */
    EF_ID: 0,
    EF_SIZE: 2,
    /* Header IDs */
    ID_ZIP64: 1,
    ID_AVINFO: 7,
    ID_PFS: 8,
    ID_OS2: 9,
    ID_NTFS: 10,
    ID_OPENVMS: 12,
    ID_UNIX: 13,
    ID_FORK: 14,
    ID_PATCH: 15,
    ID_X509_PKCS7: 20,
    ID_X509_CERTID_F: 21,
    ID_X509_CERTID_C: 22,
    ID_STRONGENC: 23,
    ID_RECORD_MGT: 24,
    ID_X509_PKCS7_RL: 25,
    ID_IBM1: 101,
    ID_IBM2: 102,
    ID_POSZIP: 18064,
    EF_ZIP64_OR_32: 4294967295,
    EF_ZIP64_OR_16: 65535,
    EF_ZIP64_SUNCOMP: 0,
    EF_ZIP64_SCOMP: 8,
    EF_ZIP64_RHO: 16,
    EF_ZIP64_DSN: 24
  }), Dr;
}
var Ur = {}, qn;
function Sn() {
  return qn || (qn = 1, function(t) {
    const e = {
      /* Header error messages */
      INVALID_LOC: "Invalid LOC header (bad signature)",
      INVALID_CEN: "Invalid CEN header (bad signature)",
      INVALID_END: "Invalid END header (bad signature)",
      /* Descriptor */
      DESCRIPTOR_NOT_EXIST: "No descriptor present",
      DESCRIPTOR_UNKNOWN: "Unknown descriptor format",
      DESCRIPTOR_FAULTY: "Descriptor data is malformed",
      /* ZipEntry error messages*/
      NO_DATA: "Nothing to decompress",
      BAD_CRC: "CRC32 checksum failed {0}",
      FILE_IN_THE_WAY: "There is a file in the way: {0}",
      UNKNOWN_METHOD: "Invalid/unsupported compression method",
      /* Inflater error messages */
      AVAIL_DATA: "inflate::Available inflate data did not terminate",
      INVALID_DISTANCE: "inflate::Invalid literal/length or distance code in fixed or dynamic block",
      TO_MANY_CODES: "inflate::Dynamic block code description: too many length or distance codes",
      INVALID_REPEAT_LEN: "inflate::Dynamic block code description: repeat more than specified lengths",
      INVALID_REPEAT_FIRST: "inflate::Dynamic block code description: repeat lengths with no first length",
      INCOMPLETE_CODES: "inflate::Dynamic block code description: code lengths codes incomplete",
      INVALID_DYN_DISTANCE: "inflate::Dynamic block code description: invalid distance code lengths",
      INVALID_CODES_LEN: "inflate::Dynamic block code description: invalid literal/length code lengths",
      INVALID_STORE_BLOCK: "inflate::Stored block length did not match one's complement",
      INVALID_BLOCK_TYPE: "inflate::Invalid block type (type == 3)",
      /* ADM-ZIP error messages */
      CANT_EXTRACT_FILE: "Could not extract the file",
      CANT_OVERRIDE: "Target file already exists",
      DISK_ENTRY_TOO_LARGE: "Number of disk entries is too large",
      NO_ZIP: "No zip file was loaded",
      NO_ENTRY: "Entry doesn't exist",
      DIRECTORY_CONTENT_ERROR: "A directory cannot have content",
      FILE_NOT_FOUND: 'File not found: "{0}"',
      NOT_IMPLEMENTED: "Not implemented",
      INVALID_FILENAME: "Invalid filename",
      INVALID_FORMAT: "Invalid or unsupported zip format. No END header found",
      INVALID_PASS_PARAM: "Incompatible password parameter",
      WRONG_PASSWORD: "Wrong Password",
      /* ADM-ZIP */
      COMMENT_TOO_LONG: "Comment is too long",
      // Comment can be max 65535 bytes long (NOTE: some non-US characters may take more space)
      EXTRA_FIELD_PARSE_ERROR: "Extra field parsing error"
    };
    function r(n) {
      return function(...s) {
        return s.length && (n = n.replace(/\{(\d)\}/g, (i, o) => s[o] || "")), new Error("ADM-ZIP: " + n);
      };
    }
    for (const n of Object.keys(e))
      t[n] = r(e[n]);
  }(Ur)), Ur;
}
var $r, Wn;
function qo() {
  if (Wn) return $r;
  Wn = 1;
  const t = Ao, e = bn, r = mi(), n = Sn(), s = typeof process == "object" && process.platform === "win32", i = (c) => typeof c == "object" && c !== null, o = new Uint32Array(256).map((c, u) => {
    for (let l = 0; l < 8; l++)
      u & 1 ? u = 3988292384 ^ u >>> 1 : u >>>= 1;
    return u >>> 0;
  });
  function a(c) {
    this.sep = e.sep, this.fs = t, i(c) && i(c.fs) && typeof c.fs.statSync == "function" && (this.fs = c.fs);
  }
  return $r = a, a.prototype.makeDir = function(c) {
    const u = this;
    function l(h) {
      let f = h.split(u.sep)[0];
      h.split(u.sep).forEach(function(d) {
        if (!(!d || d.substr(-1, 1) === ":")) {
          f += u.sep + d;
          var g;
          try {
            g = u.fs.statSync(f);
          } catch (y) {
            if (y.message && y.message.startsWith("ENOENT"))
              u.fs.mkdirSync(f);
            else
              throw y;
          }
          if (g && g.isFile()) throw n.FILE_IN_THE_WAY(`"${f}"`);
        }
      });
    }
    l(c);
  }, a.prototype.writeFileTo = function(c, u, l, h) {
    const f = this;
    if (f.fs.existsSync(c)) {
      if (!l) return !1;
      var d = f.fs.statSync(c);
      if (d.isDirectory())
        return !1;
    }
    var g = e.dirname(c);
    f.fs.existsSync(g) || f.makeDir(g);
    var y;
    try {
      y = f.fs.openSync(c, "w", 438);
    } catch {
      f.fs.chmodSync(c, 438), y = f.fs.openSync(c, "w", 438);
    }
    if (y)
      try {
        f.fs.writeSync(y, u, 0, u.length, 0);
      } finally {
        f.fs.closeSync(y);
      }
    return f.fs.chmodSync(c, h || 438), !0;
  }, a.prototype.writeFileToAsync = function(c, u, l, h, f) {
    typeof h == "function" && (f = h, h = void 0);
    const d = this;
    d.fs.exists(c, function(g) {
      if (g && !l) return f(!1);
      d.fs.stat(c, function(y, I) {
        if (g && I.isDirectory())
          return f(!1);
        var k = e.dirname(c);
        d.fs.exists(k, function(w) {
          w || d.makeDir(k), d.fs.open(c, "w", 438, function(S, m) {
            S ? d.fs.chmod(c, 438, function() {
              d.fs.open(c, "w", 438, function(p, E) {
                d.fs.write(E, u, 0, u.length, 0, function() {
                  d.fs.close(E, function() {
                    d.fs.chmod(c, h || 438, function() {
                      f(!0);
                    });
                  });
                });
              });
            }) : m ? d.fs.write(m, u, 0, u.length, 0, function() {
              d.fs.close(m, function() {
                d.fs.chmod(c, h || 438, function() {
                  f(!0);
                });
              });
            }) : d.fs.chmod(c, h || 438, function() {
              f(!0);
            });
          });
        });
      });
    });
  }, a.prototype.findFiles = function(c) {
    const u = this;
    function l(h, f, d) {
      let g = [];
      return u.fs.readdirSync(h).forEach(function(y) {
        const I = e.join(h, y), k = u.fs.statSync(I);
        g.push(e.normalize(I) + (k.isDirectory() ? u.sep : "")), k.isDirectory() && d && (g = g.concat(l(I, f, d)));
      }), g;
    }
    return l(c, void 0, !0);
  }, a.prototype.findFilesAsync = function(c, u) {
    const l = this;
    let h = [];
    l.fs.readdir(c, function(f, d) {
      if (f) return u(f);
      let g = d.length;
      if (!g) return u(null, h);
      d.forEach(function(y) {
        y = e.join(c, y), l.fs.stat(y, function(I, k) {
          if (I) return u(I);
          k && (h.push(e.normalize(y) + (k.isDirectory() ? l.sep : "")), k.isDirectory() ? l.findFilesAsync(y, function(w, S) {
            if (w) return u(w);
            h = h.concat(S), --g || u(null, h);
          }) : --g || u(null, h));
        });
      });
    });
  }, a.prototype.getAttributes = function() {
  }, a.prototype.setAttributes = function() {
  }, a.crc32update = function(c, u) {
    return o[(c ^ u) & 255] ^ c >>> 8;
  }, a.crc32 = function(c) {
    typeof c == "string" && (c = Buffer.from(c, "utf8"));
    let u = c.length, l = -1;
    for (let h = 0; h < u; ) l = a.crc32update(l, c[h++]);
    return ~l >>> 0;
  }, a.methodToString = function(c) {
    switch (c) {
      case r.STORED:
        return "STORED (" + c + ")";
      case r.DEFLATED:
        return "DEFLATED (" + c + ")";
      default:
        return "UNSUPPORTED (" + c + ")";
    }
  }, a.canonical = function(c) {
    if (!c) return "";
    const u = e.posix.normalize("/" + c.split("\\").join("/"));
    return e.join(".", u);
  }, a.zipnamefix = function(c) {
    if (!c) return "";
    const u = e.posix.normalize("/" + c.split("\\").join("/"));
    return e.posix.join(".", u);
  }, a.findLast = function(c, u) {
    if (!Array.isArray(c)) throw new TypeError("arr is not array");
    const l = c.length >>> 0;
    for (let h = l - 1; h >= 0; h--)
      if (u(c[h], h, c))
        return c[h];
  }, a.sanitize = function(c, u) {
    c = e.resolve(e.normalize(c));
    for (var l = u.split("/"), h = 0, f = l.length; h < f; h++) {
      var d = e.normalize(e.join(c, l.slice(h, f).join(e.sep)));
      if (d.indexOf(c) === 0)
        return d;
    }
    return e.normalize(e.join(c, e.basename(u)));
  }, a.toBuffer = function(u, l) {
    return Buffer.isBuffer(u) ? u : u instanceof Uint8Array ? Buffer.from(u) : typeof u == "string" ? l(u) : Buffer.alloc(0);
  }, a.readBigUInt64LE = function(c, u) {
    const l = c.readUInt32LE(u);
    return c.readUInt32LE(u + 4) * 4294967296 + l;
  }, a.fromDOS2Date = function(c) {
    return new Date((c >> 25 & 127) + 1980, Math.max((c >> 21 & 15) - 1, 0), Math.max(c >> 16 & 31, 1), c >> 11 & 31, c >> 5 & 63, (c & 31) << 1);
  }, a.fromDate2DOS = function(c) {
    let u = 0, l = 0;
    return c.getFullYear() > 1979 && (u = (c.getFullYear() - 1980 & 127) << 9 | c.getMonth() + 1 << 5 | c.getDate(), l = c.getHours() << 11 | c.getMinutes() << 5 | c.getSeconds() >> 1), u << 16 | l;
  }, a.isWin = s, a.crcTable = o, $r;
}
var jr, Kn;
function Wo() {
  if (Kn) return jr;
  Kn = 1;
  const t = bn;
  return jr = function(e, { fs: r }) {
    var n = e || "", s = o(), i = null;
    function o() {
      return {
        directory: !1,
        readonly: !1,
        hidden: !1,
        executable: !1,
        mtime: 0,
        atime: 0
      };
    }
    return n && r.existsSync(n) ? (i = r.statSync(n), s.directory = i.isDirectory(), s.mtime = i.mtime, s.atime = i.atime, s.executable = (73 & i.mode) !== 0, s.readonly = (128 & i.mode) === 0, s.hidden = t.basename(n)[0] === ".") : console.warn("Invalid path: " + n), {
      get directory() {
        return s.directory;
      },
      get readOnly() {
        return s.readonly;
      },
      get hidden() {
        return s.hidden;
      },
      get mtime() {
        return s.mtime;
      },
      get atime() {
        return s.atime;
      },
      get executable() {
        return s.executable;
      },
      decodeAttributes: function() {
      },
      encodeAttributes: function() {
      },
      toJSON: function() {
        return {
          path: n,
          isDirectory: s.directory,
          isReadOnly: s.readonly,
          isHidden: s.hidden,
          isExecutable: s.executable,
          mTime: s.mtime,
          aTime: s.atime
        };
      },
      toString: function() {
        return JSON.stringify(this.toJSON(), null, "	");
      }
    };
  }, jr;
}
var xr, Vn;
function Ko() {
  return Vn || (Vn = 1, xr = {
    efs: !0,
    encode: (t) => Buffer.from(t, "utf8"),
    decode: (t) => t.toString("utf8")
  }), xr;
}
var Gn;
function Kt() {
  return Gn || (Gn = 1, Je.exports = qo(), Je.exports.Constants = mi(), Je.exports.Errors = Sn(), Je.exports.FileAttr = Wo(), Je.exports.decoder = Ko()), Je.exports;
}
var Gt = {}, Fr, Jn;
function Vo() {
  if (Jn) return Fr;
  Jn = 1;
  var t = Kt(), e = t.Constants;
  return Fr = function() {
    var r = 20, n = 10, s = 0, i = 0, o = 0, a = 0, c = 0, u = 0, l = 0, h = 0, f = 0, d = 0, g = 0, y = 0, I = 0;
    r |= t.isWin ? 2560 : 768, s |= e.FLG_EFS;
    const k = {
      extraLen: 0
    }, w = (m) => Math.max(0, m) >>> 0, S = (m) => Math.max(0, m) & 255;
    return o = t.fromDate2DOS(/* @__PURE__ */ new Date()), {
      get made() {
        return r;
      },
      set made(m) {
        r = m;
      },
      get version() {
        return n;
      },
      set version(m) {
        n = m;
      },
      get flags() {
        return s;
      },
      set flags(m) {
        s = m;
      },
      get flags_efs() {
        return (s & e.FLG_EFS) > 0;
      },
      set flags_efs(m) {
        m ? s |= e.FLG_EFS : s &= ~e.FLG_EFS;
      },
      get flags_desc() {
        return (s & e.FLG_DESC) > 0;
      },
      set flags_desc(m) {
        m ? s |= e.FLG_DESC : s &= ~e.FLG_DESC;
      },
      get method() {
        return i;
      },
      set method(m) {
        switch (m) {
          case e.STORED:
            this.version = 10;
          case e.DEFLATED:
          default:
            this.version = 20;
        }
        i = m;
      },
      get time() {
        return t.fromDOS2Date(this.timeval);
      },
      set time(m) {
        m = new Date(m), this.timeval = t.fromDate2DOS(m);
      },
      get timeval() {
        return o;
      },
      set timeval(m) {
        o = w(m);
      },
      get timeHighByte() {
        return S(o >>> 8);
      },
      get crc() {
        return a;
      },
      set crc(m) {
        a = w(m);
      },
      get compressedSize() {
        return c;
      },
      set compressedSize(m) {
        c = w(m);
      },
      get size() {
        return u;
      },
      set size(m) {
        u = w(m);
      },
      get fileNameLength() {
        return l;
      },
      set fileNameLength(m) {
        l = m;
      },
      get extraLength() {
        return h;
      },
      set extraLength(m) {
        h = m;
      },
      get extraLocalLength() {
        return k.extraLen;
      },
      set extraLocalLength(m) {
        k.extraLen = m;
      },
      get commentLength() {
        return f;
      },
      set commentLength(m) {
        f = m;
      },
      get diskNumStart() {
        return d;
      },
      set diskNumStart(m) {
        d = w(m);
      },
      get inAttr() {
        return g;
      },
      set inAttr(m) {
        g = w(m);
      },
      get attr() {
        return y;
      },
      set attr(m) {
        y = w(m);
      },
      // get Unix file permissions
      get fileAttr() {
        return (y || 0) >> 16 & 4095;
      },
      get offset() {
        return I;
      },
      set offset(m) {
        I = w(m);
      },
      get encrypted() {
        return (s & e.FLG_ENC) === e.FLG_ENC;
      },
      get centralHeaderSize() {
        return e.CENHDR + l + h + f;
      },
      get realDataOffset() {
        return I + e.LOCHDR + k.fnameLen + k.extraLen;
      },
      get localHeader() {
        return k;
      },
      loadLocalHeaderFromBinary: function(m) {
        var p = m.slice(I, I + e.LOCHDR);
        if (p.readUInt32LE(0) !== e.LOCSIG)
          throw t.Errors.INVALID_LOC();
        k.version = p.readUInt16LE(e.LOCVER), k.flags = p.readUInt16LE(e.LOCFLG), k.flags_desc = (k.flags & e.FLG_DESC) > 0, k.method = p.readUInt16LE(e.LOCHOW), k.time = p.readUInt32LE(e.LOCTIM), k.crc = p.readUInt32LE(e.LOCCRC), k.compressedSize = p.readUInt32LE(e.LOCSIZ), k.size = p.readUInt32LE(e.LOCLEN), k.fnameLen = p.readUInt16LE(e.LOCNAM), k.extraLen = p.readUInt16LE(e.LOCEXT);
        const E = I + e.LOCHDR + k.fnameLen, _ = E + k.extraLen;
        return m.slice(E, _);
      },
      loadFromBinary: function(m) {
        if (m.length !== e.CENHDR || m.readUInt32LE(0) !== e.CENSIG)
          throw t.Errors.INVALID_CEN();
        r = m.readUInt16LE(e.CENVEM), n = m.readUInt16LE(e.CENVER), s = m.readUInt16LE(e.CENFLG), i = m.readUInt16LE(e.CENHOW), o = m.readUInt32LE(e.CENTIM), a = m.readUInt32LE(e.CENCRC), c = m.readUInt32LE(e.CENSIZ), u = m.readUInt32LE(e.CENLEN), l = m.readUInt16LE(e.CENNAM), h = m.readUInt16LE(e.CENEXT), f = m.readUInt16LE(e.CENCOM), d = m.readUInt16LE(e.CENDSK), g = m.readUInt16LE(e.CENATT), y = m.readUInt32LE(e.CENATX), I = m.readUInt32LE(e.CENOFF);
      },
      localHeaderToBinary: function() {
        var m = Buffer.alloc(e.LOCHDR);
        return m.writeUInt32LE(e.LOCSIG, 0), m.writeUInt16LE(n, e.LOCVER), m.writeUInt16LE(s, e.LOCFLG), m.writeUInt16LE(i, e.LOCHOW), m.writeUInt32LE(o, e.LOCTIM), m.writeUInt32LE(a, e.LOCCRC), m.writeUInt32LE(c, e.LOCSIZ), m.writeUInt32LE(u, e.LOCLEN), m.writeUInt16LE(l, e.LOCNAM), m.writeUInt16LE(k.extraLen, e.LOCEXT), m;
      },
      centralHeaderToBinary: function() {
        var m = Buffer.alloc(e.CENHDR + l + h + f);
        return m.writeUInt32LE(e.CENSIG, 0), m.writeUInt16LE(r, e.CENVEM), m.writeUInt16LE(n, e.CENVER), m.writeUInt16LE(s, e.CENFLG), m.writeUInt16LE(i, e.CENHOW), m.writeUInt32LE(o, e.CENTIM), m.writeUInt32LE(a, e.CENCRC), m.writeUInt32LE(c, e.CENSIZ), m.writeUInt32LE(u, e.CENLEN), m.writeUInt16LE(l, e.CENNAM), m.writeUInt16LE(h, e.CENEXT), m.writeUInt16LE(f, e.CENCOM), m.writeUInt16LE(d, e.CENDSK), m.writeUInt16LE(g, e.CENATT), m.writeUInt32LE(y, e.CENATX), m.writeUInt32LE(I, e.CENOFF), m;
      },
      toJSON: function() {
        const m = function(p) {
          return p + " bytes";
        };
        return {
          made: r,
          version: n,
          flags: s,
          method: t.methodToString(i),
          time: this.time,
          crc: "0x" + a.toString(16).toUpperCase(),
          compressedSize: m(c),
          size: m(u),
          fileNameLength: m(l),
          extraLength: m(h),
          commentLength: m(f),
          diskNumStart: d,
          inAttr: g,
          attr: y,
          offset: I,
          centralHeaderSize: m(e.CENHDR + l + h + f)
        };
      },
      toString: function() {
        return JSON.stringify(this.toJSON(), null, "	");
      }
    };
  }, Fr;
}
var zr, Xn;
function Go() {
  if (Xn) return zr;
  Xn = 1;
  var t = Kt(), e = t.Constants;
  return zr = function() {
    var r = 0, n = 0, s = 0, i = 0, o = 0;
    return {
      get diskEntries() {
        return r;
      },
      set diskEntries(a) {
        r = n = a;
      },
      get totalEntries() {
        return n;
      },
      set totalEntries(a) {
        n = r = a;
      },
      get size() {
        return s;
      },
      set size(a) {
        s = a;
      },
      get offset() {
        return i;
      },
      set offset(a) {
        i = a;
      },
      get commentLength() {
        return o;
      },
      set commentLength(a) {
        o = a;
      },
      get mainHeaderSize() {
        return e.ENDHDR + o;
      },
      loadFromBinary: function(a) {
        if ((a.length !== e.ENDHDR || a.readUInt32LE(0) !== e.ENDSIG) && (a.length < e.ZIP64HDR || a.readUInt32LE(0) !== e.ZIP64SIG))
          throw t.Errors.INVALID_END();
        a.readUInt32LE(0) === e.ENDSIG ? (r = a.readUInt16LE(e.ENDSUB), n = a.readUInt16LE(e.ENDTOT), s = a.readUInt32LE(e.ENDSIZ), i = a.readUInt32LE(e.ENDOFF), o = a.readUInt16LE(e.ENDCOM)) : (r = t.readBigUInt64LE(a, e.ZIP64SUB), n = t.readBigUInt64LE(a, e.ZIP64TOT), s = t.readBigUInt64LE(a, e.ZIP64SIZE), i = t.readBigUInt64LE(a, e.ZIP64OFF), o = 0);
      },
      toBinary: function() {
        var a = Buffer.alloc(e.ENDHDR + o);
        return a.writeUInt32LE(e.ENDSIG, 0), a.writeUInt32LE(0, 4), a.writeUInt16LE(r, e.ENDSUB), a.writeUInt16LE(n, e.ENDTOT), a.writeUInt32LE(s, e.ENDSIZ), a.writeUInt32LE(i, e.ENDOFF), a.writeUInt16LE(o, e.ENDCOM), a.fill(" ", e.ENDHDR), a;
      },
      toJSON: function() {
        const a = function(c, u) {
          let l = c.toString(16).toUpperCase();
          for (; l.length < u; ) l = "0" + l;
          return "0x" + l;
        };
        return {
          diskEntries: r,
          totalEntries: n,
          size: s + " bytes",
          offset: a(i, 4),
          commentLength: o
        };
      },
      toString: function() {
        return JSON.stringify(this.toJSON(), null, "	");
      }
    };
  }, zr;
}
var Yn;
function gi() {
  return Yn || (Yn = 1, Gt.EntryHeader = Vo(), Gt.MainHeader = Go()), Gt;
}
var Rt = {}, Br, Qn;
function Jo() {
  return Qn || (Qn = 1, Br = function(t) {
    var e = ai, r = { chunkSize: (parseInt(t.length / 1024) + 1) * 1024 };
    return {
      deflate: function() {
        return e.deflateRawSync(t, r);
      },
      deflateAsync: function(n) {
        var s = e.createDeflateRaw(r), i = [], o = 0;
        s.on("data", function(a) {
          i.push(a), o += a.length;
        }), s.on("end", function() {
          var a = Buffer.alloc(o), c = 0;
          a.fill(0);
          for (var u = 0; u < i.length; u++) {
            var l = i[u];
            l.copy(a, c), c += l.length;
          }
          n && n(a);
        }), s.end(t);
      }
    };
  }), Br;
}
var Mr, es;
function Xo() {
  if (es) return Mr;
  es = 1;
  const t = +(process.versions ? process.versions.node : "").split(".")[0] || 0;
  return Mr = function(e, r) {
    var n = ai;
    const s = t >= 15 && r > 0 ? { maxOutputLength: r } : {};
    return {
      inflate: function() {
        return n.inflateRawSync(e, s);
      },
      inflateAsync: function(i) {
        var o = n.createInflateRaw(s), a = [], c = 0;
        o.on("data", function(u) {
          a.push(u), c += u.length;
        }), o.on("end", function() {
          var u = Buffer.alloc(c), l = 0;
          u.fill(0);
          for (var h = 0; h < a.length; h++) {
            var f = a[h];
            f.copy(u, l), l += f.length;
          }
          i && i(u);
        }), o.end(e);
      }
    };
  }, Mr;
}
var Zr, ts;
function Yo() {
  if (ts) return Zr;
  ts = 1;
  const { randomFillSync: t } = ko, e = Sn(), r = new Uint32Array(256).map((d, g) => {
    for (let y = 0; y < 8; y++)
      g & 1 ? g = g >>> 1 ^ 3988292384 : g >>>= 1;
    return g >>> 0;
  }), n = (d, g) => Math.imul(d, g) >>> 0, s = (d, g) => r[(d ^ g) & 255] ^ d >>> 8, i = () => typeof t == "function" ? t(Buffer.alloc(12)) : i.node();
  i.node = () => {
    const d = Buffer.alloc(12), g = d.length;
    for (let y = 0; y < g; y++) d[y] = Math.random() * 256 & 255;
    return d;
  };
  const o = {
    genSalt: i
  };
  function a(d) {
    const g = Buffer.isBuffer(d) ? d : Buffer.from(d);
    this.keys = new Uint32Array([305419896, 591751049, 878082192]);
    for (let y = 0; y < g.length; y++)
      this.updateKeys(g[y]);
  }
  a.prototype.updateKeys = function(d) {
    const g = this.keys;
    return g[0] = s(g[0], d), g[1] += g[0] & 255, g[1] = n(g[1], 134775813) + 1, g[2] = s(g[2], g[1] >>> 24), d;
  }, a.prototype.next = function() {
    const d = (this.keys[2] | 2) >>> 0;
    return n(d, d ^ 1) >> 8 & 255;
  };
  function c(d) {
    const g = new a(d);
    return function(y) {
      const I = Buffer.alloc(y.length);
      let k = 0;
      for (let w of y)
        I[k++] = g.updateKeys(w ^ g.next());
      return I;
    };
  }
  function u(d) {
    const g = new a(d);
    return function(y, I, k = 0) {
      I || (I = Buffer.alloc(y.length));
      for (let w of y) {
        const S = g.next();
        I[k++] = w ^ S, g.updateKeys(w);
      }
      return I;
    };
  }
  function l(d, g, y) {
    if (!d || !Buffer.isBuffer(d) || d.length < 12)
      return Buffer.alloc(0);
    const I = c(y), k = I(d.slice(0, 12)), w = (g.flags & 8) === 8 ? g.timeHighByte : g.crc >>> 24;
    if (k[11] !== w)
      throw e.WRONG_PASSWORD();
    return I(d.slice(12));
  }
  function h(d) {
    Buffer.isBuffer(d) && d.length >= 12 ? o.genSalt = function() {
      return d.slice(0, 12);
    } : d === "node" ? o.genSalt = i.node : o.genSalt = i;
  }
  function f(d, g, y, I = !1) {
    d == null && (d = Buffer.alloc(0)), Buffer.isBuffer(d) || (d = Buffer.from(d.toString()));
    const k = u(y), w = o.genSalt();
    w[11] = g.crc >>> 24 & 255, I && (w[10] = g.crc >>> 16 & 255);
    const S = Buffer.alloc(d.length + 12);
    return k(w, S), k(d, S, 12);
  }
  return Zr = { decrypt: l, encrypt: f, _salter: h }, Zr;
}
var rs;
function Qo() {
  return rs || (rs = 1, Rt.Deflater = Jo(), Rt.Inflater = Xo(), Rt.ZipCrypto = Yo()), Rt;
}
var Hr, ns;
function _i() {
  if (ns) return Hr;
  ns = 1;
  var t = Kt(), e = gi(), r = t.Constants, n = Qo();
  return Hr = function(s, i) {
    var o = new e.EntryHeader(), a = Buffer.alloc(0), c = Buffer.alloc(0), u = !1, l = null, h = Buffer.alloc(0), f = Buffer.alloc(0), d = !0;
    const g = s, y = typeof g.decoder == "object" ? g.decoder : t.decoder;
    d = y.hasOwnProperty("efs") ? y.efs : !1;
    function I() {
      return !i || !(i instanceof Uint8Array) ? Buffer.alloc(0) : (f = o.loadLocalHeaderFromBinary(i), i.slice(o.realDataOffset, o.realDataOffset + o.compressedSize));
    }
    function k(_) {
      if (!o.flags_desc && !o.localHeader.flags_desc) {
        if (t.crc32(_) !== o.localHeader.crc)
          return !1;
      } else {
        const b = {}, O = o.realDataOffset + o.compressedSize;
        if (i.readUInt32LE(O) == r.LOCSIG || i.readUInt32LE(O) == r.CENSIG)
          throw t.Errors.DESCRIPTOR_NOT_EXIST();
        if (i.readUInt32LE(O) == r.EXTSIG)
          b.crc = i.readUInt32LE(O + r.EXTCRC), b.compressedSize = i.readUInt32LE(O + r.EXTSIZ), b.size = i.readUInt32LE(O + r.EXTLEN);
        else if (i.readUInt16LE(O + 12) === 19280)
          b.crc = i.readUInt32LE(O + r.EXTCRC - 4), b.compressedSize = i.readUInt32LE(O + r.EXTSIZ - 4), b.size = i.readUInt32LE(O + r.EXTLEN - 4);
        else
          throw t.Errors.DESCRIPTOR_UNKNOWN();
        if (b.compressedSize !== o.compressedSize || b.size !== o.size || b.crc !== o.crc)
          throw t.Errors.DESCRIPTOR_FAULTY();
        if (t.crc32(_) !== b.crc)
          return !1;
      }
      return !0;
    }
    function w(_, b, O) {
      if (typeof b > "u" && typeof _ == "string" && (O = _, _ = void 0), u)
        return _ && b && b(Buffer.alloc(0), t.Errors.DIRECTORY_CONTENT_ERROR()), Buffer.alloc(0);
      var D = I();
      if (D.length === 0)
        return _ && b && b(D), D;
      if (o.encrypted) {
        if (typeof O != "string" && !Buffer.isBuffer(O))
          throw t.Errors.INVALID_PASS_PARAM();
        D = n.ZipCrypto.decrypt(D, o, O);
      }
      var $ = Buffer.alloc(o.size);
      switch (o.method) {
        case t.Constants.STORED:
          if (D.copy($), k($))
            return _ && b && b($), $;
          throw _ && b && b($, t.Errors.BAD_CRC()), t.Errors.BAD_CRC();
        case t.Constants.DEFLATED:
          var H = new n.Inflater(D, o.size);
          if (_)
            H.inflateAsync(function(L) {
              L.copy(L, 0), b && (k(L) ? b(L) : b(L, t.Errors.BAD_CRC()));
            });
          else {
            if (H.inflate($).copy($, 0), !k($))
              throw t.Errors.BAD_CRC(`"${y.decode(a)}"`);
            return $;
          }
          break;
        default:
          throw _ && b && b(Buffer.alloc(0), t.Errors.UNKNOWN_METHOD()), t.Errors.UNKNOWN_METHOD();
      }
    }
    function S(_, b) {
      if ((!l || !l.length) && Buffer.isBuffer(i))
        return _ && b && b(I()), I();
      if (l.length && !u) {
        var O;
        switch (o.method) {
          case t.Constants.STORED:
            return o.compressedSize = o.size, O = Buffer.alloc(l.length), l.copy(O), _ && b && b(O), O;
          default:
          case t.Constants.DEFLATED:
            var D = new n.Deflater(l);
            if (_)
              D.deflateAsync(function(H) {
                O = Buffer.alloc(H.length), o.compressedSize = H.length, H.copy(O), b && b(O);
              });
            else {
              var $ = D.deflate();
              return o.compressedSize = $.length, $;
            }
            D = null;
            break;
        }
      } else if (_ && b)
        b(Buffer.alloc(0));
      else
        return Buffer.alloc(0);
    }
    function m(_, b) {
      return t.readBigUInt64LE(_, b);
    }
    function p(_) {
      try {
        for (var b = 0, O, D, $; b + 4 < _.length; )
          O = _.readUInt16LE(b), b += 2, D = _.readUInt16LE(b), b += 2, $ = _.slice(b, b + D), b += D, r.ID_ZIP64 === O && E($);
      } catch {
        throw t.Errors.EXTRA_FIELD_PARSE_ERROR();
      }
    }
    function E(_) {
      var b, O, D, $;
      _.length >= r.EF_ZIP64_SCOMP && (b = m(_, r.EF_ZIP64_SUNCOMP), o.size === r.EF_ZIP64_OR_32 && (o.size = b)), _.length >= r.EF_ZIP64_RHO && (O = m(_, r.EF_ZIP64_SCOMP), o.compressedSize === r.EF_ZIP64_OR_32 && (o.compressedSize = O)), _.length >= r.EF_ZIP64_DSN && (D = m(_, r.EF_ZIP64_RHO), o.offset === r.EF_ZIP64_OR_32 && (o.offset = D)), _.length >= r.EF_ZIP64_DSN + 4 && ($ = _.readUInt32LE(r.EF_ZIP64_DSN), o.diskNumStart === r.EF_ZIP64_OR_16 && (o.diskNumStart = $));
    }
    return {
      get entryName() {
        return y.decode(a);
      },
      get rawEntryName() {
        return a;
      },
      set entryName(_) {
        a = t.toBuffer(_, y.encode);
        var b = a[a.length - 1];
        u = b === 47 || b === 92, o.fileNameLength = a.length;
      },
      get efs() {
        return typeof d == "function" ? d(this.entryName) : d;
      },
      get extra() {
        return h;
      },
      set extra(_) {
        h = _, o.extraLength = _.length, p(_);
      },
      get comment() {
        return y.decode(c);
      },
      set comment(_) {
        if (c = t.toBuffer(_, y.encode), o.commentLength = c.length, c.length > 65535) throw t.Errors.COMMENT_TOO_LONG();
      },
      get name() {
        var _ = y.decode(a);
        return u ? _.substr(_.length - 1).split("/").pop() : _.split("/").pop();
      },
      get isDirectory() {
        return u;
      },
      getCompressedData: function() {
        return S(!1, null);
      },
      getCompressedDataAsync: function(_) {
        S(!0, _);
      },
      setData: function(_) {
        l = t.toBuffer(_, t.decoder.encode), !u && l.length ? (o.size = l.length, o.method = t.Constants.DEFLATED, o.crc = t.crc32(_), o.changed = !0) : o.method = t.Constants.STORED;
      },
      getData: function(_) {
        return o.changed ? l : w(!1, null, _);
      },
      getDataAsync: function(_, b) {
        o.changed ? _(l) : w(!0, _, b);
      },
      set attr(_) {
        o.attr = _;
      },
      get attr() {
        return o.attr;
      },
      set header(_) {
        o.loadFromBinary(_);
      },
      get header() {
        return o;
      },
      packCentralHeader: function() {
        o.flags_efs = this.efs, o.extraLength = h.length;
        var _ = o.centralHeaderToBinary(), b = t.Constants.CENHDR;
        return a.copy(_, b), b += a.length, h.copy(_, b), b += o.extraLength, c.copy(_, b), _;
      },
      packLocalHeader: function() {
        let _ = 0;
        o.flags_efs = this.efs, o.extraLocalLength = f.length;
        const b = o.localHeaderToBinary(), O = Buffer.alloc(b.length + a.length + o.extraLocalLength);
        return b.copy(O, _), _ += b.length, a.copy(O, _), _ += a.length, f.copy(O, _), _ += f.length, O;
      },
      toJSON: function() {
        const _ = function(b) {
          return "<" + (b && b.length + " bytes buffer" || "null") + ">";
        };
        return {
          entryName: this.entryName,
          name: this.name,
          comment: this.comment,
          isDirectory: this.isDirectory,
          header: o.toJSON(),
          compressedData: _(i),
          data: _(l)
        };
      },
      toString: function() {
        return JSON.stringify(this.toJSON(), null, "	");
      }
    };
  }, Hr;
}
var qr, ss;
function ea() {
  if (ss) return qr;
  ss = 1;
  const t = _i(), e = gi(), r = Kt();
  return qr = function(n, s) {
    var i = [], o = {}, a = Buffer.alloc(0), c = new e.MainHeader(), u = !1;
    const l = /* @__PURE__ */ new Set(), h = s, { noSort: f, decoder: d } = h;
    n ? I(h.readEntries) : u = !0;
    function g() {
      const w = /* @__PURE__ */ new Set();
      for (const S of Object.keys(o)) {
        const m = S.split("/");
        if (m.pop(), !!m.length)
          for (let p = 0; p < m.length; p++) {
            const E = m.slice(0, p + 1).join("/") + "/";
            w.add(E);
          }
      }
      for (const S of w)
        if (!(S in o)) {
          const m = new t(h);
          m.entryName = S, m.attr = 16, m.temporary = !0, i.push(m), o[m.entryName] = m, l.add(m);
        }
    }
    function y() {
      if (u = !0, o = {}, c.diskEntries > (n.length - c.offset) / r.Constants.CENHDR)
        throw r.Errors.DISK_ENTRY_TOO_LARGE();
      i = new Array(c.diskEntries);
      for (var w = c.offset, S = 0; S < i.length; S++) {
        var m = w, p = new t(h, n);
        p.header = n.slice(m, m += r.Constants.CENHDR), p.entryName = n.slice(m, m += p.header.fileNameLength), p.header.extraLength && (p.extra = n.slice(m, m += p.header.extraLength)), p.header.commentLength && (p.comment = n.slice(m, m + p.header.commentLength)), w += p.header.centralHeaderSize, i[S] = p, o[p.entryName] = p;
      }
      l.clear(), g();
    }
    function I(w) {
      var S = n.length - r.Constants.ENDHDR, m = Math.max(0, S - 65535), p = m, E = n.length, _ = -1, b = 0;
      for ((typeof h.trailingSpace == "boolean" ? h.trailingSpace : !1) && (m = 0), S; S >= p; S--)
        if (n[S] === 80) {
          if (n.readUInt32LE(S) === r.Constants.ENDSIG) {
            _ = S, b = S, E = S + r.Constants.ENDHDR, p = S - r.Constants.END64HDR;
            continue;
          }
          if (n.readUInt32LE(S) === r.Constants.END64SIG) {
            p = m;
            continue;
          }
          if (n.readUInt32LE(S) === r.Constants.ZIP64SIG) {
            _ = S, E = S + r.readBigUInt64LE(n, S + r.Constants.ZIP64SIZE) + r.Constants.ZIP64LEAD;
            break;
          }
        }
      if (_ == -1) throw r.Errors.INVALID_FORMAT();
      c.loadFromBinary(n.slice(_, E)), c.commentLength && (a = n.slice(b + r.Constants.ENDHDR)), w && y();
    }
    function k() {
      i.length > 1 && !f && i.sort((w, S) => w.entryName.toLowerCase().localeCompare(S.entryName.toLowerCase()));
    }
    return {
      /**
       * Returns an array of ZipEntry objects existent in the current opened archive
       * @return Array
       */
      get entries() {
        return u || y(), i.filter((w) => !l.has(w));
      },
      /**
       * Archive comment
       * @return {String}
       */
      get comment() {
        return d.decode(a);
      },
      set comment(w) {
        a = r.toBuffer(w, d.encode), c.commentLength = a.length;
      },
      getEntryCount: function() {
        return u ? i.length : c.diskEntries;
      },
      forEach: function(w) {
        this.entries.forEach(w);
      },
      /**
       * Returns a reference to the entry with the given name or null if entry is inexistent
       *
       * @param entryName
       * @return ZipEntry
       */
      getEntry: function(w) {
        return u || y(), o[w] || null;
      },
      /**
       * Adds the given entry to the entry list
       *
       * @param entry
       */
      setEntry: function(w) {
        u || y(), i.push(w), o[w.entryName] = w, c.totalEntries = i.length;
      },
      /**
       * Removes the file with the given name from the entry list.
       *
       * If the entry is a directory, then all nested files and directories will be removed
       * @param entryName
       * @returns {void}
       */
      deleteFile: function(w, S = !0) {
        u || y();
        const m = o[w];
        this.getEntryChildren(m, S).map((E) => E.entryName).forEach(this.deleteEntry);
      },
      /**
       * Removes the entry with the given name from the entry list.
       *
       * @param {string} entryName
       * @returns {void}
       */
      deleteEntry: function(w) {
        u || y();
        const S = o[w], m = i.indexOf(S);
        m >= 0 && (i.splice(m, 1), delete o[w], c.totalEntries = i.length);
      },
      /**
       *  Iterates and returns all nested files and directories of the given entry
       *
       * @param entry
       * @return Array
       */
      getEntryChildren: function(w, S = !0) {
        if (u || y(), typeof w == "object")
          if (w.isDirectory && S) {
            const m = [], p = w.entryName;
            for (const E of i)
              E.entryName.startsWith(p) && m.push(E);
            return m;
          } else
            return [w];
        return [];
      },
      /**
       *  How many child elements entry has
       *
       * @param {ZipEntry} entry
       * @return {integer}
       */
      getChildCount: function(w) {
        if (w && w.isDirectory) {
          const S = this.getEntryChildren(w);
          return S.includes(w) ? S.length - 1 : S.length;
        }
        return 0;
      },
      /**
       * Returns the zip file
       *
       * @return Buffer
       */
      compressToBuffer: function() {
        u || y(), k();
        const w = [], S = [];
        let m = 0, p = 0;
        c.size = 0, c.offset = 0;
        let E = 0;
        for (const O of this.entries) {
          const D = O.getCompressedData();
          O.header.offset = p;
          const $ = O.packLocalHeader(), H = $.length + D.length;
          p += H, w.push($), w.push(D);
          const L = O.packCentralHeader();
          S.push(L), c.size += L.length, m += H + L.length, E++;
        }
        m += c.mainHeaderSize, c.offset = p, c.totalEntries = E, p = 0;
        const _ = Buffer.alloc(m);
        for (const O of w)
          O.copy(_, p), p += O.length;
        for (const O of S)
          O.copy(_, p), p += O.length;
        const b = c.toBinary();
        return a && a.copy(b, r.Constants.ENDHDR), b.copy(_, p), n = _, u = !1, _;
      },
      toAsyncBuffer: function(w, S, m, p) {
        try {
          u || y(), k();
          const E = [], _ = [];
          let b = 0, O = 0, D = 0;
          c.size = 0, c.offset = 0;
          const $ = function(H) {
            if (H.length > 0) {
              const L = H.shift(), W = L.entryName + L.extra.toString();
              m && m(W), L.getCompressedDataAsync(function(q) {
                p && p(W), L.header.offset = O;
                const le = L.packLocalHeader(), j = le.length + q.length;
                O += j, E.push(le), E.push(q);
                const he = L.packCentralHeader();
                _.push(he), c.size += he.length, b += j + he.length, D++, $(H);
              });
            } else {
              b += c.mainHeaderSize, c.offset = O, c.totalEntries = D, O = 0;
              const L = Buffer.alloc(b);
              E.forEach(function(q) {
                q.copy(L, O), O += q.length;
              }), _.forEach(function(q) {
                q.copy(L, O), O += q.length;
              });
              const W = c.toBinary();
              a && a.copy(W, r.Constants.ENDHDR), W.copy(L, O), n = L, u = !1, w(L);
            }
          };
          $(Array.from(this.entries));
        } catch (E) {
          S(E);
        }
      }
    };
  }, qr;
}
var Wr, is;
function ta() {
  if (is) return Wr;
  is = 1;
  const t = Kt(), e = bn, r = _i(), n = ea(), s = (...c) => t.findLast(c, (u) => typeof u == "boolean"), i = (...c) => t.findLast(c, (u) => typeof u == "string"), o = (...c) => t.findLast(c, (u) => typeof u == "function"), a = {
    // option "noSort" : if true it disables files sorting
    noSort: !1,
    // read entries during load (initial loading may be slower)
    readEntries: !1,
    // default method is none
    method: t.Constants.NONE,
    // file system
    fs: null
  };
  return Wr = function(c, u) {
    let l = null;
    const h = Object.assign(/* @__PURE__ */ Object.create(null), a);
    c && typeof c == "object" && (c instanceof Uint8Array || (Object.assign(h, c), c = h.input ? h.input : void 0, h.input && delete h.input), Buffer.isBuffer(c) && (l = c, h.method = t.Constants.BUFFER, c = void 0)), Object.assign(h, u);
    const f = new t(h);
    if ((typeof h.decoder != "object" || typeof h.decoder.encode != "function" || typeof h.decoder.decode != "function") && (h.decoder = t.decoder), c && typeof c == "string")
      if (f.fs.existsSync(c))
        h.method = t.Constants.FILE, h.filename = c, l = f.fs.readFileSync(c);
      else
        throw t.Errors.INVALID_FILENAME();
    const d = new n(l, h), { canonical: g, sanitize: y, zipnamefix: I } = t;
    function k(p) {
      if (p && d) {
        var E;
        if (typeof p == "string" && (E = d.getEntry(e.posix.normalize(p))), typeof p == "object" && typeof p.entryName < "u" && typeof p.header < "u" && (E = d.getEntry(p.entryName)), E)
          return E;
      }
      return null;
    }
    function w(p) {
      const { join: E, normalize: _, sep: b } = e.posix;
      return E(e.isAbsolute(p) ? "/" : ".", _(b + p.split("\\").join(b) + b));
    }
    function S(p) {
      return p instanceof RegExp ? /* @__PURE__ */ function(E) {
        return function(_) {
          return E.test(_);
        };
      }(p) : typeof p != "function" ? () => !0 : p;
    }
    const m = (p, E) => {
      let _ = E.slice(-1);
      return _ = _ === f.sep ? f.sep : "", e.relative(p, E) + _;
    };
    return {
      /**
       * Extracts the given entry from the archive and returns the content as a Buffer object
       * @param {ZipEntry|string} entry ZipEntry object or String with the full path of the entry
       * @param {Buffer|string} [pass] - password
       * @return Buffer or Null in case of error
       */
      readFile: function(p, E) {
        var _ = k(p);
        return _ && _.getData(E) || null;
      },
      /**
       * Returns how many child elements has on entry (directories) on files it is always 0
       * @param {ZipEntry|string} entry ZipEntry object or String with the full path of the entry
       * @returns {integer}
       */
      childCount: function(p) {
        const E = k(p);
        if (E)
          return d.getChildCount(E);
      },
      /**
       * Asynchronous readFile
       * @param {ZipEntry|string} entry ZipEntry object or String with the full path of the entry
       * @param {callback} callback
       *
       * @return Buffer or Null in case of error
       */
      readFileAsync: function(p, E) {
        var _ = k(p);
        _ ? _.getDataAsync(E) : E(null, "getEntry failed for:" + p);
      },
      /**
       * Extracts the given entry from the archive and returns the content as plain text in the given encoding
       * @param {ZipEntry|string} entry - ZipEntry object or String with the full path of the entry
       * @param {string} encoding - Optional. If no encoding is specified utf8 is used
       *
       * @return String
       */
      readAsText: function(p, E) {
        var _ = k(p);
        if (_) {
          var b = _.getData();
          if (b && b.length)
            return b.toString(E || "utf8");
        }
        return "";
      },
      /**
       * Asynchronous readAsText
       * @param {ZipEntry|string} entry ZipEntry object or String with the full path of the entry
       * @param {callback} callback
       * @param {string} [encoding] - Optional. If no encoding is specified utf8 is used
       *
       * @return String
       */
      readAsTextAsync: function(p, E, _) {
        var b = k(p);
        b ? b.getDataAsync(function(O, D) {
          if (D) {
            E(O, D);
            return;
          }
          O && O.length ? E(O.toString(_ || "utf8")) : E("");
        }) : E("");
      },
      /**
       * Remove the entry from the file or the entry and all it's nested directories and files if the given entry is a directory
       *
       * @param {ZipEntry|string} entry
       * @returns {void}
       */
      deleteFile: function(p, E = !0) {
        var _ = k(p);
        _ && d.deleteFile(_.entryName, E);
      },
      /**
       * Remove the entry from the file or directory without affecting any nested entries
       *
       * @param {ZipEntry|string} entry
       * @returns {void}
       */
      deleteEntry: function(p) {
        var E = k(p);
        E && d.deleteEntry(E.entryName);
      },
      /**
       * Adds a comment to the zip. The zip must be rewritten after adding the comment.
       *
       * @param {string} comment
       */
      addZipComment: function(p) {
        d.comment = p;
      },
      /**
       * Returns the zip comment
       *
       * @return String
       */
      getZipComment: function() {
        return d.comment || "";
      },
      /**
       * Adds a comment to a specified zipEntry. The zip must be rewritten after adding the comment
       * The comment cannot exceed 65535 characters in length
       *
       * @param {ZipEntry} entry
       * @param {string} comment
       */
      addZipEntryComment: function(p, E) {
        var _ = k(p);
        _ && (_.comment = E);
      },
      /**
       * Returns the comment of the specified entry
       *
       * @param {ZipEntry} entry
       * @return String
       */
      getZipEntryComment: function(p) {
        var E = k(p);
        return E && E.comment || "";
      },
      /**
       * Updates the content of an existing entry inside the archive. The zip must be rewritten after updating the content
       *
       * @param {ZipEntry} entry
       * @param {Buffer} content
       */
      updateFile: function(p, E) {
        var _ = k(p);
        _ && _.setData(E);
      },
      /**
       * Adds a file from the disk to the archive
       *
       * @param {string} localPath File to add to zip
       * @param {string} [zipPath] Optional path inside the zip
       * @param {string} [zipName] Optional name for the file
       * @param {string} [comment] Optional file comment
       */
      addLocalFile: function(p, E, _, b) {
        if (f.fs.existsSync(p)) {
          E = E ? w(E) : "";
          const O = e.win32.basename(e.win32.normalize(p));
          E += _ || O;
          const D = f.fs.statSync(p), $ = D.isFile() ? f.fs.readFileSync(p) : Buffer.alloc(0);
          D.isDirectory() && (E += f.sep), this.addFile(E, $, b, D);
        } else
          throw t.Errors.FILE_NOT_FOUND(p);
      },
      /**
       * Callback for showing if everything was done.
       *
       * @callback doneCallback
       * @param {Error} err - Error object
       * @param {boolean} done - was request fully completed
       */
      /**
       * Adds a file from the disk to the archive
       *
       * @param {(object|string)} options - options object, if it is string it us used as localPath.
       * @param {string} options.localPath - Local path to the file.
       * @param {string} [options.comment] - Optional file comment.
       * @param {string} [options.zipPath] - Optional path inside the zip
       * @param {string} [options.zipName] - Optional name for the file
       * @param {doneCallback} callback - The callback that handles the response.
       */
      addLocalFileAsync: function(p, E) {
        p = typeof p == "object" ? p : { localPath: p };
        const _ = e.resolve(p.localPath), { comment: b } = p;
        let { zipPath: O, zipName: D } = p;
        const $ = this;
        f.fs.stat(_, function(H, L) {
          if (H) return E(H, !1);
          O = O ? w(O) : "";
          const W = e.win32.basename(e.win32.normalize(_));
          if (O += D || W, L.isFile())
            f.fs.readFile(_, function(q, le) {
              return q ? E(q, !1) : ($.addFile(O, le, b, L), setImmediate(E, void 0, !0));
            });
          else if (L.isDirectory())
            return O += f.sep, $.addFile(O, Buffer.alloc(0), b, L), setImmediate(E, void 0, !0);
        });
      },
      /**
       * Adds a local directory and all its nested files and directories to the archive
       *
       * @param {string} localPath - local path to the folder
       * @param {string} [zipPath] - optional path inside zip
       * @param {(RegExp|function)} [filter] - optional RegExp or Function if files match will be included.
       */
      addLocalFolder: function(p, E, _) {
        if (_ = S(_), E = E ? w(E) : "", p = e.normalize(p), f.fs.existsSync(p)) {
          const b = f.findFiles(p), O = this;
          if (b.length)
            for (const D of b) {
              const $ = e.join(E, m(p, D));
              _($) && O.addLocalFile(D, e.dirname($));
            }
        } else
          throw t.Errors.FILE_NOT_FOUND(p);
      },
      /**
       * Asynchronous addLocalFolder
       * @param {string} localPath
       * @param {callback} callback
       * @param {string} [zipPath] optional path inside zip
       * @param {RegExp|function} [filter] optional RegExp or Function if files match will
       *               be included.
       */
      addLocalFolderAsync: function(p, E, _, b) {
        b = S(b), _ = _ ? w(_) : "", p = e.normalize(p);
        var O = this;
        f.fs.open(p, "r", function(D) {
          if (D && D.code === "ENOENT")
            E(void 0, t.Errors.FILE_NOT_FOUND(p));
          else if (D)
            E(void 0, D);
          else {
            var $ = f.findFiles(p), H = -1, L = function() {
              if (H += 1, H < $.length) {
                var W = $[H], q = m(p, W).split("\\").join("/");
                q = q.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\x20-\x7E]/g, ""), b(q) ? f.fs.stat(W, function(le, j) {
                  le && E(void 0, le), j.isFile() ? f.fs.readFile(W, function(he, be) {
                    he ? E(void 0, he) : (O.addFile(_ + q, be, "", j), L());
                  }) : (O.addFile(_ + q + "/", Buffer.alloc(0), "", j), L());
                }) : process.nextTick(() => {
                  L();
                });
              } else
                E(!0, void 0);
            };
            L();
          }
        });
      },
      /**
       * Adds a local directory and all its nested files and directories to the archive
       *
       * @param {object | string} options - options object, if it is string it us used as localPath.
       * @param {string} options.localPath - Local path to the folder.
       * @param {string} [options.zipPath] - optional path inside zip.
       * @param {RegExp|function} [options.filter] - optional RegExp or Function if files match will be included.
       * @param {function|string} [options.namefix] - optional function to help fix filename
       * @param {doneCallback} callback - The callback that handles the response.
       *
       */
      addLocalFolderAsync2: function(p, E) {
        const _ = this;
        p = typeof p == "object" ? p : { localPath: p }, localPath = e.resolve(w(p.localPath));
        let { zipPath: b, filter: O, namefix: D } = p;
        O instanceof RegExp ? O = /* @__PURE__ */ function(L) {
          return function(W) {
            return L.test(W);
          };
        }(O) : typeof O != "function" && (O = function() {
          return !0;
        }), b = b ? w(b) : "", D == "latin1" && (D = (L) => L.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\x20-\x7E]/g, "")), typeof D != "function" && (D = (L) => L);
        const $ = (L) => e.join(b, D(m(localPath, L))), H = (L) => e.win32.basename(e.win32.normalize(D(L)));
        f.fs.open(localPath, "r", function(L) {
          L && L.code === "ENOENT" ? E(void 0, t.Errors.FILE_NOT_FOUND(localPath)) : L ? E(void 0, L) : f.findFilesAsync(localPath, function(W, q) {
            if (W) return E(W);
            q = q.filter((le) => O($(le))), q.length || E(void 0, !1), setImmediate(
              q.reverse().reduce(function(le, j) {
                return function(he, be) {
                  if (he || be === !1) return setImmediate(le, he, !1);
                  _.addLocalFileAsync(
                    {
                      localPath: j,
                      zipPath: e.dirname($(j)),
                      zipName: H(j)
                    },
                    le
                  );
                };
              }, E)
            );
          });
        });
      },
      /**
       * Adds a local directory and all its nested files and directories to the archive
       *
       * @param {string} localPath - path where files will be extracted
       * @param {object} props - optional properties
       * @param {string} [props.zipPath] - optional path inside zip
       * @param {RegExp|function} [props.filter] - optional RegExp or Function if files match will be included.
       * @param {function|string} [props.namefix] - optional function to help fix filename
       */
      addLocalFolderPromise: function(p, E) {
        return new Promise((_, b) => {
          this.addLocalFolderAsync2(Object.assign({ localPath: p }, E), (O, D) => {
            O && b(O), D && _(this);
          });
        });
      },
      /**
       * Allows you to create a entry (file or directory) in the zip file.
       * If you want to create a directory the entryName must end in / and a null buffer should be provided.
       * Comment and attributes are optional
       *
       * @param {string} entryName
       * @param {Buffer | string} content - file content as buffer or utf8 coded string
       * @param {string} [comment] - file comment
       * @param {number | object} [attr] - number as unix file permissions, object as filesystem Stats object
       */
      addFile: function(p, E, _, b) {
        p = I(p);
        let O = k(p);
        const D = O != null;
        D || (O = new r(h), O.entryName = p), O.comment = _ || "";
        const $ = typeof b == "object" && b instanceof f.fs.Stats;
        $ && (O.header.time = b.mtime);
        var H = O.isDirectory ? 16 : 0;
        let L = O.isDirectory ? 16384 : 32768;
        return $ ? L |= 4095 & b.mode : typeof b == "number" ? L |= 4095 & b : L |= O.isDirectory ? 493 : 420, H = (H | L << 16) >>> 0, O.attr = H, O.setData(E), D || d.setEntry(O), O;
      },
      /**
       * Returns an array of ZipEntry objects representing the files and folders inside the archive
       *
       * @param {string} [password]
       * @returns Array
       */
      getEntries: function(p) {
        return d.password = p, d ? d.entries : [];
      },
      /**
       * Returns a ZipEntry object representing the file or folder specified by ``name``.
       *
       * @param {string} name
       * @return ZipEntry
       */
      getEntry: function(p) {
        return k(p);
      },
      getEntryCount: function() {
        return d.getEntryCount();
      },
      forEach: function(p) {
        return d.forEach(p);
      },
      /**
       * Extracts the given entry to the given targetPath
       * If the entry is a directory inside the archive, the entire directory and it's subdirectories will be extracted
       *
       * @param {string|ZipEntry} entry - ZipEntry object or String with the full path of the entry
       * @param {string} targetPath - Target folder where to write the file
       * @param {boolean} [maintainEntryPath=true] - If maintainEntryPath is true and the entry is inside a folder, the entry folder will be created in targetPath as well. Default is TRUE
       * @param {boolean} [overwrite=false] - If the file already exists at the target path, the file will be overwriten if this is true.
       * @param {boolean} [keepOriginalPermission=false] - The file will be set as the permission from the entry if this is true.
       * @param {string} [outFileName] - String If set will override the filename of the extracted file (Only works if the entry is a file)
       *
       * @return Boolean
       */
      extractEntryTo: function(p, E, _, b, O, D) {
        b = s(!1, b), O = s(!1, O), _ = s(!0, _), D = i(O, D);
        var $ = k(p);
        if (!$)
          throw t.Errors.NO_ENTRY();
        var H = g($.entryName), L = y(E, D && !$.isDirectory ? D : _ ? H : e.basename(H));
        if ($.isDirectory) {
          var W = d.getEntryChildren($);
          return W.forEach(function(j) {
            if (j.isDirectory) return;
            var he = j.getData();
            if (!he)
              throw t.Errors.CANT_EXTRACT_FILE();
            var be = g(j.entryName), Re = y(E, _ ? be : e.basename(be));
            const Be = O ? j.header.fileAttr : void 0;
            f.writeFileTo(Re, he, b, Be);
          }), !0;
        }
        var q = $.getData(d.password);
        if (!q) throw t.Errors.CANT_EXTRACT_FILE();
        if (f.fs.existsSync(L) && !b)
          throw t.Errors.CANT_OVERRIDE();
        const le = O ? p.header.fileAttr : void 0;
        return f.writeFileTo(L, q, b, le), !0;
      },
      /**
       * Test the archive
       * @param {string} [pass]
       */
      test: function(p) {
        if (!d)
          return !1;
        for (var E in d.entries)
          try {
            if (E.isDirectory)
              continue;
            var _ = d.entries[E].getData(p);
            if (!_)
              return !1;
          } catch {
            return !1;
          }
        return !0;
      },
      /**
       * Extracts the entire archive to the given location
       *
       * @param {string} targetPath Target location
       * @param {boolean} [overwrite=false] If the file already exists at the target path, the file will be overwriten if this is true.
       *                  Default is FALSE
       * @param {boolean} [keepOriginalPermission=false] The file will be set as the permission from the entry if this is true.
       *                  Default is FALSE
       * @param {string|Buffer} [pass] password
       */
      extractAllTo: function(p, E, _, b) {
        if (_ = s(!1, _), b = i(_, b), E = s(!1, E), !d) throw t.Errors.NO_ZIP();
        d.entries.forEach(function(O) {
          var D = y(p, g(O.entryName));
          if (O.isDirectory) {
            f.makeDir(D);
            return;
          }
          var $ = O.getData(b);
          if (!$)
            throw t.Errors.CANT_EXTRACT_FILE();
          const H = _ ? O.header.fileAttr : void 0;
          f.writeFileTo(D, $, E, H);
          try {
            f.fs.utimesSync(D, O.header.time, O.header.time);
          } catch {
            throw t.Errors.CANT_EXTRACT_FILE();
          }
        });
      },
      /**
       * Asynchronous extractAllTo
       *
       * @param {string} targetPath Target location
       * @param {boolean} [overwrite=false] If the file already exists at the target path, the file will be overwriten if this is true.
       *                  Default is FALSE
       * @param {boolean} [keepOriginalPermission=false] The file will be set as the permission from the entry if this is true.
       *                  Default is FALSE
       * @param {function} callback The callback will be executed when all entries are extracted successfully or any error is thrown.
       */
      extractAllToAsync: function(p, E, _, b) {
        if (b = o(E, _, b), _ = s(!1, _), E = s(!1, E), !b)
          return new Promise((L, W) => {
            this.extractAllToAsync(p, E, _, function(q) {
              q ? W(q) : L(this);
            });
          });
        if (!d) {
          b(t.Errors.NO_ZIP());
          return;
        }
        p = e.resolve(p);
        const O = (L) => y(p, e.normalize(g(L.entryName))), D = (L, W) => new Error(L + ': "' + W + '"'), $ = [], H = [];
        d.entries.forEach((L) => {
          L.isDirectory ? $.push(L) : H.push(L);
        });
        for (const L of $) {
          const W = O(L), q = _ ? L.header.fileAttr : void 0;
          try {
            f.makeDir(W), q && f.fs.chmodSync(W, q), f.fs.utimesSync(W, L.header.time, L.header.time);
          } catch {
            b(D("Unable to create folder", W));
          }
        }
        H.reverse().reduce(function(L, W) {
          return function(q) {
            if (q)
              L(q);
            else {
              const le = e.normalize(g(W.entryName)), j = y(p, le);
              W.getDataAsync(function(he, be) {
                if (be)
                  L(be);
                else if (!he)
                  L(t.Errors.CANT_EXTRACT_FILE());
                else {
                  const Re = _ ? W.header.fileAttr : void 0;
                  f.writeFileToAsync(j, he, E, Re, function(Be) {
                    Be || L(D("Unable to write file", j)), f.fs.utimes(j, W.header.time, W.header.time, function(v) {
                      v ? L(D("Unable to set times", j)) : L();
                    });
                  });
                }
              });
            }
          };
        }, b)();
      },
      /**
       * Writes the newly created zip file to disk at the specified location or if a zip was opened and no ``targetFileName`` is provided, it will overwrite the opened zip
       *
       * @param {string} targetFileName
       * @param {function} callback
       */
      writeZip: function(p, E) {
        if (arguments.length === 1 && typeof p == "function" && (E = p, p = ""), !p && h.filename && (p = h.filename), !!p) {
          var _ = d.compressToBuffer();
          if (_) {
            var b = f.writeFileTo(p, _, !0);
            typeof E == "function" && E(b ? null : new Error("failed"), "");
          }
        }
      },
      /**
      	         *
      	         * @param {string} targetFileName
      	         * @param {object} [props]
      	         * @param {boolean} [props.overwrite=true] If the file already exists at the target path, the file will be overwriten if this is true.
      	         * @param {boolean} [props.perm] The file will be set as the permission from the entry if this is true.
      
      	         * @returns {Promise<void>}
      	         */
      writeZipPromise: function(p, E) {
        const { overwrite: _, perm: b } = Object.assign({ overwrite: !0 }, E);
        return new Promise((O, D) => {
          !p && h.filename && (p = h.filename), p || D("ADM-ZIP: ZIP File Name Missing"), this.toBufferPromise().then(($) => {
            const H = (L) => L ? O(L) : D("ADM-ZIP: Wasn't able to write zip file");
            f.writeFileToAsync(p, $, _, b, H);
          }, D);
        });
      },
      /**
       * @returns {Promise<Buffer>} A promise to the Buffer.
       */
      toBufferPromise: function() {
        return new Promise((p, E) => {
          d.toAsyncBuffer(p, E);
        });
      },
      /**
       * Returns the content of the entire zip file as a Buffer object
       *
       * @prop {function} [onSuccess]
       * @prop {function} [onFail]
       * @prop {function} [onItemStart]
       * @prop {function} [onItemEnd]
       * @returns {Buffer}
       */
      toBuffer: function(p, E, _, b) {
        return typeof p == "function" ? (d.toAsyncBuffer(p, E, _, b), null) : d.compressToBuffer();
      }
    };
  }, Wr;
}
var ra = ta();
const na = /* @__PURE__ */ pi(ra), yi = {
  "cloud-sync": !1,
  "diagnostics-export": !0,
  "query-performance-logs": !0
};
function sa(t) {
  return `PHARMACY_FEATURE_${t.replace(/-/g, "_").toUpperCase()}`;
}
function On(t) {
  const e = process.env[sa(t)];
  return e === "1" || e === "true" ? !0 : e === "0" || e === "false" ? !1 : !!yi[t];
}
function ia() {
  const t = Object.keys(yi);
  return Object.fromEntries(t.map((e) => [e, On(e)]));
}
function oa(t) {
  return V.existsSync(t) ? V.readdirSync(t).filter((e) => e.endsWith(".log")).map((e) => K.join(t, e)) : [];
}
function aa(t) {
  const e = K.resolve(t);
  V.mkdirSync(K.dirname(e), { recursive: !0 });
  const r = new na(), n = ot();
  V.existsSync(n) && r.addLocalFile(n, "database", "pharmacy.db");
  const s = K.join(Y.getPath("userData"), "logs");
  for (const o of oa(s))
    r.addLocalFile(o, "logs");
  const i = {
    osPlatform: Fn.platform(),
    osRelease: Fn.release(),
    nodeVersion: process.version,
    appVersion: Y.getVersion(),
    dbVersion: Tn(),
    userDataPath: Y.getPath("userData"),
    featureFlags: ia(),
    generatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  return r.addFile("system-info.json", Buffer.from(JSON.stringify(i, null, 2), "utf8")), r.writeZip(e), e;
}
function Kr(t, e, r) {
  const n = Date.now(), s = r(), i = Date.now() - n;
  return i > 100 && On("query-performance-logs") && ge.warn("Slow query detected", { ms: i, op: e, sql: t }), s;
}
function ca(t) {
  return {
    transaction: t.transaction.bind(t),
    prepare(e) {
      const r = t.prepare(e);
      return {
        run: (...n) => Kr(e, "run", () => r.run(...n)),
        get: (...n) => Kr(e, "get", () => r.get(...n)),
        all: (...n) => Kr(e, "all", () => r.all(...n))
      };
    }
  };
}
function R(t, e, r) {
  function n(a, c) {
    if (a._zod || Object.defineProperty(a, "_zod", {
      value: {
        def: c,
        constr: o,
        traits: /* @__PURE__ */ new Set()
      },
      enumerable: !1
    }), a._zod.traits.has(t))
      return;
    a._zod.traits.add(t), e(a, c);
    const u = o.prototype, l = Object.keys(u);
    for (let h = 0; h < l.length; h++) {
      const f = l[h];
      f in a || (a[f] = u[f].bind(a));
    }
  }
  const s = (r == null ? void 0 : r.Parent) ?? Object;
  class i extends s {
  }
  Object.defineProperty(i, "name", { value: t });
  function o(a) {
    var c;
    const u = r != null && r.Parent ? new i() : this;
    n(u, a), (c = u._zod).deferred ?? (c.deferred = []);
    for (const l of u._zod.deferred)
      l();
    return u;
  }
  return Object.defineProperty(o, "init", { value: n }), Object.defineProperty(o, Symbol.hasInstance, {
    value: (a) => {
      var c, u;
      return r != null && r.Parent && a instanceof r.Parent ? !0 : (u = (c = a == null ? void 0 : a._zod) == null ? void 0 : c.traits) == null ? void 0 : u.has(t);
    }
  }), Object.defineProperty(o, "name", { value: t }), o;
}
class wt extends Error {
  constructor() {
    super("Encountered Promise during synchronous parse. Use .parseAsync() instead.");
  }
}
class Ei extends Error {
  constructor(e) {
    super(`Encountered unidirectional transform during encode: ${e}`), this.name = "ZodEncodeError";
  }
}
const vi = {};
function qe(t) {
  return vi;
}
function wi(t) {
  const e = Object.values(t).filter((n) => typeof n == "number");
  return Object.entries(t).filter(([n, s]) => e.indexOf(+n) === -1).map(([n, s]) => s);
}
function nn(t, e) {
  return typeof e == "bigint" ? e.toString() : e;
}
function An(t) {
  return {
    get value() {
      {
        const e = t();
        return Object.defineProperty(this, "value", { value: e }), e;
      }
    }
  };
}
function kn(t) {
  return t == null;
}
function Rn(t) {
  const e = t.startsWith("^") ? 1 : 0, r = t.endsWith("$") ? t.length - 1 : t.length;
  return t.slice(e, r);
}
function ua(t, e) {
  const r = (t.toString().split(".")[1] || "").length, n = e.toString();
  let s = (n.split(".")[1] || "").length;
  if (s === 0 && /\d?e-\d?/.test(n)) {
    const c = n.match(/\d?e-(\d?)/);
    c != null && c[1] && (s = Number.parseInt(c[1]));
  }
  const i = r > s ? r : s, o = Number.parseInt(t.toFixed(i).replace(".", "")), a = Number.parseInt(e.toFixed(i).replace(".", ""));
  return o % a / 10 ** i;
}
const os = Symbol("evaluating");
function G(t, e, r) {
  let n;
  Object.defineProperty(t, e, {
    get() {
      if (n !== os)
        return n === void 0 && (n = os, n = r()), n;
    },
    set(s) {
      Object.defineProperty(t, e, {
        value: s
        // configurable: true,
      });
    },
    configurable: !0
  });
}
function at(t, e, r) {
  Object.defineProperty(t, e, {
    value: r,
    writable: !0,
    enumerable: !0,
    configurable: !0
  });
}
function Ke(...t) {
  const e = {};
  for (const r of t) {
    const n = Object.getOwnPropertyDescriptors(r);
    Object.assign(e, n);
  }
  return Object.defineProperties({}, e);
}
function as(t) {
  return JSON.stringify(t);
}
function la(t) {
  return t.toLowerCase().trim().replace(/[^\w\s-]/g, "").replace(/[\s_-]+/g, "-").replace(/^-+|-+$/g, "");
}
const bi = "captureStackTrace" in Error ? Error.captureStackTrace : (...t) => {
};
function pr(t) {
  return typeof t == "object" && t !== null && !Array.isArray(t);
}
const ha = An(() => {
  var t;
  if (typeof navigator < "u" && ((t = navigator == null ? void 0 : navigator.userAgent) != null && t.includes("Cloudflare")))
    return !1;
  try {
    const e = Function;
    return new e(""), !0;
  } catch {
    return !1;
  }
});
function Tt(t) {
  if (pr(t) === !1)
    return !1;
  const e = t.constructor;
  if (e === void 0 || typeof e != "function")
    return !0;
  const r = e.prototype;
  return !(pr(r) === !1 || Object.prototype.hasOwnProperty.call(r, "isPrototypeOf") === !1);
}
function Ti(t) {
  return Tt(t) ? { ...t } : Array.isArray(t) ? [...t] : t;
}
const da = /* @__PURE__ */ new Set(["string", "number", "symbol"]);
function Sr(t) {
  return t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function Ve(t, e, r) {
  const n = new t._zod.constr(e ?? t._zod.def);
  return (!e || r != null && r.parent) && (n._zod.parent = t), n;
}
function F(t) {
  const e = t;
  if (!e)
    return {};
  if (typeof e == "string")
    return { error: () => e };
  if ((e == null ? void 0 : e.message) !== void 0) {
    if ((e == null ? void 0 : e.error) !== void 0)
      throw new Error("Cannot specify both `message` and `error` params");
    e.error = e.message;
  }
  return delete e.message, typeof e.error == "string" ? { ...e, error: () => e.error } : e;
}
function fa(t) {
  return Object.keys(t).filter((e) => t[e]._zod.optin === "optional" && t[e]._zod.optout === "optional");
}
const pa = {
  safeint: [Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER],
  int32: [-2147483648, 2147483647],
  uint32: [0, 4294967295],
  float32: [-34028234663852886e22, 34028234663852886e22],
  float64: [-Number.MAX_VALUE, Number.MAX_VALUE]
};
function ma(t, e) {
  const r = t._zod.def, n = r.checks;
  if (n && n.length > 0)
    throw new Error(".pick() cannot be used on object schemas containing refinements");
  const i = Ke(t._zod.def, {
    get shape() {
      const o = {};
      for (const a in e) {
        if (!(a in r.shape))
          throw new Error(`Unrecognized key: "${a}"`);
        e[a] && (o[a] = r.shape[a]);
      }
      return at(this, "shape", o), o;
    },
    checks: []
  });
  return Ve(t, i);
}
function ga(t, e) {
  const r = t._zod.def, n = r.checks;
  if (n && n.length > 0)
    throw new Error(".omit() cannot be used on object schemas containing refinements");
  const i = Ke(t._zod.def, {
    get shape() {
      const o = { ...t._zod.def.shape };
      for (const a in e) {
        if (!(a in r.shape))
          throw new Error(`Unrecognized key: "${a}"`);
        e[a] && delete o[a];
      }
      return at(this, "shape", o), o;
    },
    checks: []
  });
  return Ve(t, i);
}
function _a(t, e) {
  if (!Tt(e))
    throw new Error("Invalid input to extend: expected a plain object");
  const r = t._zod.def.checks;
  if (r && r.length > 0) {
    const i = t._zod.def.shape;
    for (const o in e)
      if (Object.getOwnPropertyDescriptor(i, o) !== void 0)
        throw new Error("Cannot overwrite keys on object schemas containing refinements. Use `.safeExtend()` instead.");
  }
  const s = Ke(t._zod.def, {
    get shape() {
      const i = { ...t._zod.def.shape, ...e };
      return at(this, "shape", i), i;
    }
  });
  return Ve(t, s);
}
function ya(t, e) {
  if (!Tt(e))
    throw new Error("Invalid input to safeExtend: expected a plain object");
  const r = Ke(t._zod.def, {
    get shape() {
      const n = { ...t._zod.def.shape, ...e };
      return at(this, "shape", n), n;
    }
  });
  return Ve(t, r);
}
function Ea(t, e) {
  const r = Ke(t._zod.def, {
    get shape() {
      const n = { ...t._zod.def.shape, ...e._zod.def.shape };
      return at(this, "shape", n), n;
    },
    get catchall() {
      return e._zod.def.catchall;
    },
    checks: []
    // delete existing checks
  });
  return Ve(t, r);
}
function va(t, e, r) {
  const s = e._zod.def.checks;
  if (s && s.length > 0)
    throw new Error(".partial() cannot be used on object schemas containing refinements");
  const o = Ke(e._zod.def, {
    get shape() {
      const a = e._zod.def.shape, c = { ...a };
      if (r)
        for (const u in r) {
          if (!(u in a))
            throw new Error(`Unrecognized key: "${u}"`);
          r[u] && (c[u] = t ? new t({
            type: "optional",
            innerType: a[u]
          }) : a[u]);
        }
      else
        for (const u in a)
          c[u] = t ? new t({
            type: "optional",
            innerType: a[u]
          }) : a[u];
      return at(this, "shape", c), c;
    },
    checks: []
  });
  return Ve(e, o);
}
function wa(t, e, r) {
  const n = Ke(e._zod.def, {
    get shape() {
      const s = e._zod.def.shape, i = { ...s };
      if (r)
        for (const o in r) {
          if (!(o in i))
            throw new Error(`Unrecognized key: "${o}"`);
          r[o] && (i[o] = new t({
            type: "nonoptional",
            innerType: s[o]
          }));
        }
      else
        for (const o in s)
          i[o] = new t({
            type: "nonoptional",
            innerType: s[o]
          });
      return at(this, "shape", i), i;
    }
  });
  return Ve(e, n);
}
function yt(t, e = 0) {
  var r;
  if (t.aborted === !0)
    return !0;
  for (let n = e; n < t.issues.length; n++)
    if (((r = t.issues[n]) == null ? void 0 : r.continue) !== !0)
      return !0;
  return !1;
}
function Et(t, e) {
  return e.map((r) => {
    var n;
    return (n = r).path ?? (n.path = []), r.path.unshift(t), r;
  });
}
function Jt(t) {
  return typeof t == "string" ? t : t == null ? void 0 : t.message;
}
function We(t, e, r) {
  var s, i, o, a, c, u;
  const n = { ...t, path: t.path ?? [] };
  if (!t.message) {
    const l = Jt((o = (i = (s = t.inst) == null ? void 0 : s._zod.def) == null ? void 0 : i.error) == null ? void 0 : o.call(i, t)) ?? Jt((a = e == null ? void 0 : e.error) == null ? void 0 : a.call(e, t)) ?? Jt((c = r.customError) == null ? void 0 : c.call(r, t)) ?? Jt((u = r.localeError) == null ? void 0 : u.call(r, t)) ?? "Invalid input";
    n.message = l;
  }
  return delete n.inst, delete n.continue, e != null && e.reportInput || delete n.input, n;
}
function Nn(t) {
  return Array.isArray(t) ? "array" : typeof t == "string" ? "string" : "unknown";
}
function jt(...t) {
  const [e, r, n] = t;
  return typeof e == "string" ? {
    message: e,
    code: "custom",
    input: r,
    inst: n
  } : { ...e };
}
const Si = (t, e) => {
  t.name = "$ZodError", Object.defineProperty(t, "_zod", {
    value: t._zod,
    enumerable: !1
  }), Object.defineProperty(t, "issues", {
    value: e,
    enumerable: !1
  }), t.message = JSON.stringify(e, nn, 2), Object.defineProperty(t, "toString", {
    value: () => t.message,
    enumerable: !1
  });
}, Oi = R("$ZodError", Si), Ai = R("$ZodError", Si, { Parent: Error });
function ba(t, e = (r) => r.message) {
  const r = {}, n = [];
  for (const s of t.issues)
    s.path.length > 0 ? (r[s.path[0]] = r[s.path[0]] || [], r[s.path[0]].push(e(s))) : n.push(e(s));
  return { formErrors: n, fieldErrors: r };
}
function Ta(t, e = (r) => r.message) {
  const r = { _errors: [] }, n = (s) => {
    for (const i of s.issues)
      if (i.code === "invalid_union" && i.errors.length)
        i.errors.map((o) => n({ issues: o }));
      else if (i.code === "invalid_key")
        n({ issues: i.issues });
      else if (i.code === "invalid_element")
        n({ issues: i.issues });
      else if (i.path.length === 0)
        r._errors.push(e(i));
      else {
        let o = r, a = 0;
        for (; a < i.path.length; ) {
          const c = i.path[a];
          a === i.path.length - 1 ? (o[c] = o[c] || { _errors: [] }, o[c]._errors.push(e(i))) : o[c] = o[c] || { _errors: [] }, o = o[c], a++;
        }
      }
  };
  return n(t), r;
}
const In = (t) => (e, r, n, s) => {
  const i = n ? Object.assign(n, { async: !1 }) : { async: !1 }, o = e._zod.run({ value: r, issues: [] }, i);
  if (o instanceof Promise)
    throw new wt();
  if (o.issues.length) {
    const a = new ((s == null ? void 0 : s.Err) ?? t)(o.issues.map((c) => We(c, i, qe())));
    throw bi(a, s == null ? void 0 : s.callee), a;
  }
  return o.value;
}, Ln = (t) => async (e, r, n, s) => {
  const i = n ? Object.assign(n, { async: !0 }) : { async: !0 };
  let o = e._zod.run({ value: r, issues: [] }, i);
  if (o instanceof Promise && (o = await o), o.issues.length) {
    const a = new ((s == null ? void 0 : s.Err) ?? t)(o.issues.map((c) => We(c, i, qe())));
    throw bi(a, s == null ? void 0 : s.callee), a;
  }
  return o.value;
}, Or = (t) => (e, r, n) => {
  const s = n ? { ...n, async: !1 } : { async: !1 }, i = e._zod.run({ value: r, issues: [] }, s);
  if (i instanceof Promise)
    throw new wt();
  return i.issues.length ? {
    success: !1,
    error: new (t ?? Oi)(i.issues.map((o) => We(o, s, qe())))
  } : { success: !0, data: i.value };
}, Sa = /* @__PURE__ */ Or(Ai), Ar = (t) => async (e, r, n) => {
  const s = n ? Object.assign(n, { async: !0 }) : { async: !0 };
  let i = e._zod.run({ value: r, issues: [] }, s);
  return i instanceof Promise && (i = await i), i.issues.length ? {
    success: !1,
    error: new t(i.issues.map((o) => We(o, s, qe())))
  } : { success: !0, data: i.value };
}, Oa = /* @__PURE__ */ Ar(Ai), Aa = (t) => (e, r, n) => {
  const s = n ? Object.assign(n, { direction: "backward" }) : { direction: "backward" };
  return In(t)(e, r, s);
}, ka = (t) => (e, r, n) => In(t)(e, r, n), Ra = (t) => async (e, r, n) => {
  const s = n ? Object.assign(n, { direction: "backward" }) : { direction: "backward" };
  return Ln(t)(e, r, s);
}, Na = (t) => async (e, r, n) => Ln(t)(e, r, n), Ia = (t) => (e, r, n) => {
  const s = n ? Object.assign(n, { direction: "backward" }) : { direction: "backward" };
  return Or(t)(e, r, s);
}, La = (t) => (e, r, n) => Or(t)(e, r, n), Ca = (t) => async (e, r, n) => {
  const s = n ? Object.assign(n, { direction: "backward" }) : { direction: "backward" };
  return Ar(t)(e, r, s);
}, Pa = (t) => async (e, r, n) => Ar(t)(e, r, n), Da = /^[cC][^\s-]{8,}$/, Ua = /^[0-9a-z]+$/, $a = /^[0-9A-HJKMNP-TV-Za-hjkmnp-tv-z]{26}$/, ja = /^[0-9a-vA-V]{20}$/, xa = /^[A-Za-z0-9]{27}$/, Fa = /^[a-zA-Z0-9_-]{21}$/, za = /^P(?:(\d+W)|(?!.*W)(?=\d|T\d)(\d+Y)?(\d+M)?(\d+D)?(T(?=\d)(\d+H)?(\d+M)?(\d+([.,]\d+)?S)?)?)$/, Ba = /^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$/, cs = (t) => t ? new RegExp(`^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-${t}[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12})$`) : /^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$/, Ma = /^(?!\.)(?!.*\.\.)([A-Za-z0-9_'+\-\.]*)[A-Za-z0-9_+-]@([A-Za-z0-9][A-Za-z0-9\-]*\.)+[A-Za-z]{2,}$/, Za = "^(\\p{Extended_Pictographic}|\\p{Emoji_Component})+$";
function Ha() {
  return new RegExp(Za, "u");
}
const qa = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$/, Wa = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:))$/, Ka = /^((25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\/([0-9]|[1-2][0-9]|3[0-2])$/, Va = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|::|([0-9a-fA-F]{1,4})?::([0-9a-fA-F]{1,4}:?){0,6})\/(12[0-8]|1[01][0-9]|[1-9]?[0-9])$/, Ga = /^$|^(?:[0-9a-zA-Z+/]{4})*(?:(?:[0-9a-zA-Z+/]{2}==)|(?:[0-9a-zA-Z+/]{3}=))?$/, ki = /^[A-Za-z0-9_-]*$/, Ja = /^\+[1-9]\d{6,14}$/, Ri = "(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))", Xa = /* @__PURE__ */ new RegExp(`^${Ri}$`);
function Ni(t) {
  const e = "(?:[01]\\d|2[0-3]):[0-5]\\d";
  return typeof t.precision == "number" ? t.precision === -1 ? `${e}` : t.precision === 0 ? `${e}:[0-5]\\d` : `${e}:[0-5]\\d\\.\\d{${t.precision}}` : `${e}(?::[0-5]\\d(?:\\.\\d+)?)?`;
}
function Ya(t) {
  return new RegExp(`^${Ni(t)}$`);
}
function Qa(t) {
  const e = Ni({ precision: t.precision }), r = ["Z"];
  t.local && r.push(""), t.offset && r.push("([+-](?:[01]\\d|2[0-3]):[0-5]\\d)");
  const n = `${e}(?:${r.join("|")})`;
  return new RegExp(`^${Ri}T(?:${n})$`);
}
const ec = (t) => {
  const e = t ? `[\\s\\S]{${(t == null ? void 0 : t.minimum) ?? 0},${(t == null ? void 0 : t.maximum) ?? ""}}` : "[\\s\\S]*";
  return new RegExp(`^${e}$`);
}, tc = /^-?\d+$/, Ii = /^-?\d+(?:\.\d+)?$/, rc = /^(?:true|false)$/i, nc = /^[^A-Z]*$/, sc = /^[^a-z]*$/, Se = /* @__PURE__ */ R("$ZodCheck", (t, e) => {
  var r;
  t._zod ?? (t._zod = {}), t._zod.def = e, (r = t._zod).onattach ?? (r.onattach = []);
}), Li = {
  number: "number",
  bigint: "bigint",
  object: "date"
}, Ci = /* @__PURE__ */ R("$ZodCheckLessThan", (t, e) => {
  Se.init(t, e);
  const r = Li[typeof e.value];
  t._zod.onattach.push((n) => {
    const s = n._zod.bag, i = (e.inclusive ? s.maximum : s.exclusiveMaximum) ?? Number.POSITIVE_INFINITY;
    e.value < i && (e.inclusive ? s.maximum = e.value : s.exclusiveMaximum = e.value);
  }), t._zod.check = (n) => {
    (e.inclusive ? n.value <= e.value : n.value < e.value) || n.issues.push({
      origin: r,
      code: "too_big",
      maximum: typeof e.value == "object" ? e.value.getTime() : e.value,
      input: n.value,
      inclusive: e.inclusive,
      inst: t,
      continue: !e.abort
    });
  };
}), Pi = /* @__PURE__ */ R("$ZodCheckGreaterThan", (t, e) => {
  Se.init(t, e);
  const r = Li[typeof e.value];
  t._zod.onattach.push((n) => {
    const s = n._zod.bag, i = (e.inclusive ? s.minimum : s.exclusiveMinimum) ?? Number.NEGATIVE_INFINITY;
    e.value > i && (e.inclusive ? s.minimum = e.value : s.exclusiveMinimum = e.value);
  }), t._zod.check = (n) => {
    (e.inclusive ? n.value >= e.value : n.value > e.value) || n.issues.push({
      origin: r,
      code: "too_small",
      minimum: typeof e.value == "object" ? e.value.getTime() : e.value,
      input: n.value,
      inclusive: e.inclusive,
      inst: t,
      continue: !e.abort
    });
  };
}), ic = /* @__PURE__ */ R("$ZodCheckMultipleOf", (t, e) => {
  Se.init(t, e), t._zod.onattach.push((r) => {
    var n;
    (n = r._zod.bag).multipleOf ?? (n.multipleOf = e.value);
  }), t._zod.check = (r) => {
    if (typeof r.value != typeof e.value)
      throw new Error("Cannot mix number and bigint in multiple_of check.");
    (typeof r.value == "bigint" ? r.value % e.value === BigInt(0) : ua(r.value, e.value) === 0) || r.issues.push({
      origin: typeof r.value,
      code: "not_multiple_of",
      divisor: e.value,
      input: r.value,
      inst: t,
      continue: !e.abort
    });
  };
}), oc = /* @__PURE__ */ R("$ZodCheckNumberFormat", (t, e) => {
  var o;
  Se.init(t, e), e.format = e.format || "float64";
  const r = (o = e.format) == null ? void 0 : o.includes("int"), n = r ? "int" : "number", [s, i] = pa[e.format];
  t._zod.onattach.push((a) => {
    const c = a._zod.bag;
    c.format = e.format, c.minimum = s, c.maximum = i, r && (c.pattern = tc);
  }), t._zod.check = (a) => {
    const c = a.value;
    if (r) {
      if (!Number.isInteger(c)) {
        a.issues.push({
          expected: n,
          format: e.format,
          code: "invalid_type",
          continue: !1,
          input: c,
          inst: t
        });
        return;
      }
      if (!Number.isSafeInteger(c)) {
        c > 0 ? a.issues.push({
          input: c,
          code: "too_big",
          maximum: Number.MAX_SAFE_INTEGER,
          note: "Integers must be within the safe integer range.",
          inst: t,
          origin: n,
          inclusive: !0,
          continue: !e.abort
        }) : a.issues.push({
          input: c,
          code: "too_small",
          minimum: Number.MIN_SAFE_INTEGER,
          note: "Integers must be within the safe integer range.",
          inst: t,
          origin: n,
          inclusive: !0,
          continue: !e.abort
        });
        return;
      }
    }
    c < s && a.issues.push({
      origin: "number",
      input: c,
      code: "too_small",
      minimum: s,
      inclusive: !0,
      inst: t,
      continue: !e.abort
    }), c > i && a.issues.push({
      origin: "number",
      input: c,
      code: "too_big",
      maximum: i,
      inclusive: !0,
      inst: t,
      continue: !e.abort
    });
  };
}), ac = /* @__PURE__ */ R("$ZodCheckMaxLength", (t, e) => {
  var r;
  Se.init(t, e), (r = t._zod.def).when ?? (r.when = (n) => {
    const s = n.value;
    return !kn(s) && s.length !== void 0;
  }), t._zod.onattach.push((n) => {
    const s = n._zod.bag.maximum ?? Number.POSITIVE_INFINITY;
    e.maximum < s && (n._zod.bag.maximum = e.maximum);
  }), t._zod.check = (n) => {
    const s = n.value;
    if (s.length <= e.maximum)
      return;
    const o = Nn(s);
    n.issues.push({
      origin: o,
      code: "too_big",
      maximum: e.maximum,
      inclusive: !0,
      input: s,
      inst: t,
      continue: !e.abort
    });
  };
}), cc = /* @__PURE__ */ R("$ZodCheckMinLength", (t, e) => {
  var r;
  Se.init(t, e), (r = t._zod.def).when ?? (r.when = (n) => {
    const s = n.value;
    return !kn(s) && s.length !== void 0;
  }), t._zod.onattach.push((n) => {
    const s = n._zod.bag.minimum ?? Number.NEGATIVE_INFINITY;
    e.minimum > s && (n._zod.bag.minimum = e.minimum);
  }), t._zod.check = (n) => {
    const s = n.value;
    if (s.length >= e.minimum)
      return;
    const o = Nn(s);
    n.issues.push({
      origin: o,
      code: "too_small",
      minimum: e.minimum,
      inclusive: !0,
      input: s,
      inst: t,
      continue: !e.abort
    });
  };
}), uc = /* @__PURE__ */ R("$ZodCheckLengthEquals", (t, e) => {
  var r;
  Se.init(t, e), (r = t._zod.def).when ?? (r.when = (n) => {
    const s = n.value;
    return !kn(s) && s.length !== void 0;
  }), t._zod.onattach.push((n) => {
    const s = n._zod.bag;
    s.minimum = e.length, s.maximum = e.length, s.length = e.length;
  }), t._zod.check = (n) => {
    const s = n.value, i = s.length;
    if (i === e.length)
      return;
    const o = Nn(s), a = i > e.length;
    n.issues.push({
      origin: o,
      ...a ? { code: "too_big", maximum: e.length } : { code: "too_small", minimum: e.length },
      inclusive: !0,
      exact: !0,
      input: n.value,
      inst: t,
      continue: !e.abort
    });
  };
}), kr = /* @__PURE__ */ R("$ZodCheckStringFormat", (t, e) => {
  var r, n;
  Se.init(t, e), t._zod.onattach.push((s) => {
    const i = s._zod.bag;
    i.format = e.format, e.pattern && (i.patterns ?? (i.patterns = /* @__PURE__ */ new Set()), i.patterns.add(e.pattern));
  }), e.pattern ? (r = t._zod).check ?? (r.check = (s) => {
    e.pattern.lastIndex = 0, !e.pattern.test(s.value) && s.issues.push({
      origin: "string",
      code: "invalid_format",
      format: e.format,
      input: s.value,
      ...e.pattern ? { pattern: e.pattern.toString() } : {},
      inst: t,
      continue: !e.abort
    });
  }) : (n = t._zod).check ?? (n.check = () => {
  });
}), lc = /* @__PURE__ */ R("$ZodCheckRegex", (t, e) => {
  kr.init(t, e), t._zod.check = (r) => {
    e.pattern.lastIndex = 0, !e.pattern.test(r.value) && r.issues.push({
      origin: "string",
      code: "invalid_format",
      format: "regex",
      input: r.value,
      pattern: e.pattern.toString(),
      inst: t,
      continue: !e.abort
    });
  };
}), hc = /* @__PURE__ */ R("$ZodCheckLowerCase", (t, e) => {
  e.pattern ?? (e.pattern = nc), kr.init(t, e);
}), dc = /* @__PURE__ */ R("$ZodCheckUpperCase", (t, e) => {
  e.pattern ?? (e.pattern = sc), kr.init(t, e);
}), fc = /* @__PURE__ */ R("$ZodCheckIncludes", (t, e) => {
  Se.init(t, e);
  const r = Sr(e.includes), n = new RegExp(typeof e.position == "number" ? `^.{${e.position}}${r}` : r);
  e.pattern = n, t._zod.onattach.push((s) => {
    const i = s._zod.bag;
    i.patterns ?? (i.patterns = /* @__PURE__ */ new Set()), i.patterns.add(n);
  }), t._zod.check = (s) => {
    s.value.includes(e.includes, e.position) || s.issues.push({
      origin: "string",
      code: "invalid_format",
      format: "includes",
      includes: e.includes,
      input: s.value,
      inst: t,
      continue: !e.abort
    });
  };
}), pc = /* @__PURE__ */ R("$ZodCheckStartsWith", (t, e) => {
  Se.init(t, e);
  const r = new RegExp(`^${Sr(e.prefix)}.*`);
  e.pattern ?? (e.pattern = r), t._zod.onattach.push((n) => {
    const s = n._zod.bag;
    s.patterns ?? (s.patterns = /* @__PURE__ */ new Set()), s.patterns.add(r);
  }), t._zod.check = (n) => {
    n.value.startsWith(e.prefix) || n.issues.push({
      origin: "string",
      code: "invalid_format",
      format: "starts_with",
      prefix: e.prefix,
      input: n.value,
      inst: t,
      continue: !e.abort
    });
  };
}), mc = /* @__PURE__ */ R("$ZodCheckEndsWith", (t, e) => {
  Se.init(t, e);
  const r = new RegExp(`.*${Sr(e.suffix)}$`);
  e.pattern ?? (e.pattern = r), t._zod.onattach.push((n) => {
    const s = n._zod.bag;
    s.patterns ?? (s.patterns = /* @__PURE__ */ new Set()), s.patterns.add(r);
  }), t._zod.check = (n) => {
    n.value.endsWith(e.suffix) || n.issues.push({
      origin: "string",
      code: "invalid_format",
      format: "ends_with",
      suffix: e.suffix,
      input: n.value,
      inst: t,
      continue: !e.abort
    });
  };
}), gc = /* @__PURE__ */ R("$ZodCheckOverwrite", (t, e) => {
  Se.init(t, e), t._zod.check = (r) => {
    r.value = e.tx(r.value);
  };
});
class _c {
  constructor(e = []) {
    this.content = [], this.indent = 0, this && (this.args = e);
  }
  indented(e) {
    this.indent += 1, e(this), this.indent -= 1;
  }
  write(e) {
    if (typeof e == "function") {
      e(this, { execution: "sync" }), e(this, { execution: "async" });
      return;
    }
    const n = e.split(`
`).filter((o) => o), s = Math.min(...n.map((o) => o.length - o.trimStart().length)), i = n.map((o) => o.slice(s)).map((o) => " ".repeat(this.indent * 2) + o);
    for (const o of i)
      this.content.push(o);
  }
  compile() {
    const e = Function, r = this == null ? void 0 : this.args, s = [...((this == null ? void 0 : this.content) ?? [""]).map((i) => `  ${i}`)];
    return new e(...r, s.join(`
`));
  }
}
const yc = {
  major: 4,
  minor: 3,
  patch: 6
}, oe = /* @__PURE__ */ R("$ZodType", (t, e) => {
  var s;
  var r;
  t ?? (t = {}), t._zod.def = e, t._zod.bag = t._zod.bag || {}, t._zod.version = yc;
  const n = [...t._zod.def.checks ?? []];
  t._zod.traits.has("$ZodCheck") && n.unshift(t);
  for (const i of n)
    for (const o of i._zod.onattach)
      o(t);
  if (n.length === 0)
    (r = t._zod).deferred ?? (r.deferred = []), (s = t._zod.deferred) == null || s.push(() => {
      t._zod.run = t._zod.parse;
    });
  else {
    const i = (a, c, u) => {
      let l = yt(a), h;
      for (const f of c) {
        if (f._zod.def.when) {
          if (!f._zod.def.when(a))
            continue;
        } else if (l)
          continue;
        const d = a.issues.length, g = f._zod.check(a);
        if (g instanceof Promise && (u == null ? void 0 : u.async) === !1)
          throw new wt();
        if (h || g instanceof Promise)
          h = (h ?? Promise.resolve()).then(async () => {
            await g, a.issues.length !== d && (l || (l = yt(a, d)));
          });
        else {
          if (a.issues.length === d)
            continue;
          l || (l = yt(a, d));
        }
      }
      return h ? h.then(() => a) : a;
    }, o = (a, c, u) => {
      if (yt(a))
        return a.aborted = !0, a;
      const l = i(c, n, u);
      if (l instanceof Promise) {
        if (u.async === !1)
          throw new wt();
        return l.then((h) => t._zod.parse(h, u));
      }
      return t._zod.parse(l, u);
    };
    t._zod.run = (a, c) => {
      if (c.skipChecks)
        return t._zod.parse(a, c);
      if (c.direction === "backward") {
        const l = t._zod.parse({ value: a.value, issues: [] }, { ...c, skipChecks: !0 });
        return l instanceof Promise ? l.then((h) => o(h, a, c)) : o(l, a, c);
      }
      const u = t._zod.parse(a, c);
      if (u instanceof Promise) {
        if (c.async === !1)
          throw new wt();
        return u.then((l) => i(l, n, c));
      }
      return i(u, n, c);
    };
  }
  G(t, "~standard", () => ({
    validate: (i) => {
      var o;
      try {
        const a = Sa(t, i);
        return a.success ? { value: a.data } : { issues: (o = a.error) == null ? void 0 : o.issues };
      } catch {
        return Oa(t, i).then((c) => {
          var u;
          return c.success ? { value: c.data } : { issues: (u = c.error) == null ? void 0 : u.issues };
        });
      }
    },
    vendor: "zod",
    version: 1
  }));
}), Cn = /* @__PURE__ */ R("$ZodString", (t, e) => {
  var r;
  oe.init(t, e), t._zod.pattern = [...((r = t == null ? void 0 : t._zod.bag) == null ? void 0 : r.patterns) ?? []].pop() ?? ec(t._zod.bag), t._zod.parse = (n, s) => {
    if (e.coerce)
      try {
        n.value = String(n.value);
      } catch {
      }
    return typeof n.value == "string" || n.issues.push({
      expected: "string",
      code: "invalid_type",
      input: n.value,
      inst: t
    }), n;
  };
}), te = /* @__PURE__ */ R("$ZodStringFormat", (t, e) => {
  kr.init(t, e), Cn.init(t, e);
}), Ec = /* @__PURE__ */ R("$ZodGUID", (t, e) => {
  e.pattern ?? (e.pattern = Ba), te.init(t, e);
}), vc = /* @__PURE__ */ R("$ZodUUID", (t, e) => {
  if (e.version) {
    const n = {
      v1: 1,
      v2: 2,
      v3: 3,
      v4: 4,
      v5: 5,
      v6: 6,
      v7: 7,
      v8: 8
    }[e.version];
    if (n === void 0)
      throw new Error(`Invalid UUID version: "${e.version}"`);
    e.pattern ?? (e.pattern = cs(n));
  } else
    e.pattern ?? (e.pattern = cs());
  te.init(t, e);
}), wc = /* @__PURE__ */ R("$ZodEmail", (t, e) => {
  e.pattern ?? (e.pattern = Ma), te.init(t, e);
}), bc = /* @__PURE__ */ R("$ZodURL", (t, e) => {
  te.init(t, e), t._zod.check = (r) => {
    try {
      const n = r.value.trim(), s = new URL(n);
      e.hostname && (e.hostname.lastIndex = 0, e.hostname.test(s.hostname) || r.issues.push({
        code: "invalid_format",
        format: "url",
        note: "Invalid hostname",
        pattern: e.hostname.source,
        input: r.value,
        inst: t,
        continue: !e.abort
      })), e.protocol && (e.protocol.lastIndex = 0, e.protocol.test(s.protocol.endsWith(":") ? s.protocol.slice(0, -1) : s.protocol) || r.issues.push({
        code: "invalid_format",
        format: "url",
        note: "Invalid protocol",
        pattern: e.protocol.source,
        input: r.value,
        inst: t,
        continue: !e.abort
      })), e.normalize ? r.value = s.href : r.value = n;
      return;
    } catch {
      r.issues.push({
        code: "invalid_format",
        format: "url",
        input: r.value,
        inst: t,
        continue: !e.abort
      });
    }
  };
}), Tc = /* @__PURE__ */ R("$ZodEmoji", (t, e) => {
  e.pattern ?? (e.pattern = Ha()), te.init(t, e);
}), Sc = /* @__PURE__ */ R("$ZodNanoID", (t, e) => {
  e.pattern ?? (e.pattern = Fa), te.init(t, e);
}), Oc = /* @__PURE__ */ R("$ZodCUID", (t, e) => {
  e.pattern ?? (e.pattern = Da), te.init(t, e);
}), Ac = /* @__PURE__ */ R("$ZodCUID2", (t, e) => {
  e.pattern ?? (e.pattern = Ua), te.init(t, e);
}), kc = /* @__PURE__ */ R("$ZodULID", (t, e) => {
  e.pattern ?? (e.pattern = $a), te.init(t, e);
}), Rc = /* @__PURE__ */ R("$ZodXID", (t, e) => {
  e.pattern ?? (e.pattern = ja), te.init(t, e);
}), Nc = /* @__PURE__ */ R("$ZodKSUID", (t, e) => {
  e.pattern ?? (e.pattern = xa), te.init(t, e);
}), Ic = /* @__PURE__ */ R("$ZodISODateTime", (t, e) => {
  e.pattern ?? (e.pattern = Qa(e)), te.init(t, e);
}), Lc = /* @__PURE__ */ R("$ZodISODate", (t, e) => {
  e.pattern ?? (e.pattern = Xa), te.init(t, e);
}), Cc = /* @__PURE__ */ R("$ZodISOTime", (t, e) => {
  e.pattern ?? (e.pattern = Ya(e)), te.init(t, e);
}), Pc = /* @__PURE__ */ R("$ZodISODuration", (t, e) => {
  e.pattern ?? (e.pattern = za), te.init(t, e);
}), Dc = /* @__PURE__ */ R("$ZodIPv4", (t, e) => {
  e.pattern ?? (e.pattern = qa), te.init(t, e), t._zod.bag.format = "ipv4";
}), Uc = /* @__PURE__ */ R("$ZodIPv6", (t, e) => {
  e.pattern ?? (e.pattern = Wa), te.init(t, e), t._zod.bag.format = "ipv6", t._zod.check = (r) => {
    try {
      new URL(`http://[${r.value}]`);
    } catch {
      r.issues.push({
        code: "invalid_format",
        format: "ipv6",
        input: r.value,
        inst: t,
        continue: !e.abort
      });
    }
  };
}), $c = /* @__PURE__ */ R("$ZodCIDRv4", (t, e) => {
  e.pattern ?? (e.pattern = Ka), te.init(t, e);
}), jc = /* @__PURE__ */ R("$ZodCIDRv6", (t, e) => {
  e.pattern ?? (e.pattern = Va), te.init(t, e), t._zod.check = (r) => {
    const n = r.value.split("/");
    try {
      if (n.length !== 2)
        throw new Error();
      const [s, i] = n;
      if (!i)
        throw new Error();
      const o = Number(i);
      if (`${o}` !== i)
        throw new Error();
      if (o < 0 || o > 128)
        throw new Error();
      new URL(`http://[${s}]`);
    } catch {
      r.issues.push({
        code: "invalid_format",
        format: "cidrv6",
        input: r.value,
        inst: t,
        continue: !e.abort
      });
    }
  };
});
function Di(t) {
  if (t === "")
    return !0;
  if (t.length % 4 !== 0)
    return !1;
  try {
    return atob(t), !0;
  } catch {
    return !1;
  }
}
const xc = /* @__PURE__ */ R("$ZodBase64", (t, e) => {
  e.pattern ?? (e.pattern = Ga), te.init(t, e), t._zod.bag.contentEncoding = "base64", t._zod.check = (r) => {
    Di(r.value) || r.issues.push({
      code: "invalid_format",
      format: "base64",
      input: r.value,
      inst: t,
      continue: !e.abort
    });
  };
});
function Fc(t) {
  if (!ki.test(t))
    return !1;
  const e = t.replace(/[-_]/g, (n) => n === "-" ? "+" : "/"), r = e.padEnd(Math.ceil(e.length / 4) * 4, "=");
  return Di(r);
}
const zc = /* @__PURE__ */ R("$ZodBase64URL", (t, e) => {
  e.pattern ?? (e.pattern = ki), te.init(t, e), t._zod.bag.contentEncoding = "base64url", t._zod.check = (r) => {
    Fc(r.value) || r.issues.push({
      code: "invalid_format",
      format: "base64url",
      input: r.value,
      inst: t,
      continue: !e.abort
    });
  };
}), Bc = /* @__PURE__ */ R("$ZodE164", (t, e) => {
  e.pattern ?? (e.pattern = Ja), te.init(t, e);
});
function Mc(t, e = null) {
  try {
    const r = t.split(".");
    if (r.length !== 3)
      return !1;
    const [n] = r;
    if (!n)
      return !1;
    const s = JSON.parse(atob(n));
    return !("typ" in s && (s == null ? void 0 : s.typ) !== "JWT" || !s.alg || e && (!("alg" in s) || s.alg !== e));
  } catch {
    return !1;
  }
}
const Zc = /* @__PURE__ */ R("$ZodJWT", (t, e) => {
  te.init(t, e), t._zod.check = (r) => {
    Mc(r.value, e.alg) || r.issues.push({
      code: "invalid_format",
      format: "jwt",
      input: r.value,
      inst: t,
      continue: !e.abort
    });
  };
}), Ui = /* @__PURE__ */ R("$ZodNumber", (t, e) => {
  oe.init(t, e), t._zod.pattern = t._zod.bag.pattern ?? Ii, t._zod.parse = (r, n) => {
    if (e.coerce)
      try {
        r.value = Number(r.value);
      } catch {
      }
    const s = r.value;
    if (typeof s == "number" && !Number.isNaN(s) && Number.isFinite(s))
      return r;
    const i = typeof s == "number" ? Number.isNaN(s) ? "NaN" : Number.isFinite(s) ? void 0 : "Infinity" : void 0;
    return r.issues.push({
      expected: "number",
      code: "invalid_type",
      input: s,
      inst: t,
      ...i ? { received: i } : {}
    }), r;
  };
}), Hc = /* @__PURE__ */ R("$ZodNumberFormat", (t, e) => {
  oc.init(t, e), Ui.init(t, e);
}), qc = /* @__PURE__ */ R("$ZodBoolean", (t, e) => {
  oe.init(t, e), t._zod.pattern = rc, t._zod.parse = (r, n) => {
    if (e.coerce)
      try {
        r.value = !!r.value;
      } catch {
      }
    const s = r.value;
    return typeof s == "boolean" || r.issues.push({
      expected: "boolean",
      code: "invalid_type",
      input: s,
      inst: t
    }), r;
  };
}), Wc = /* @__PURE__ */ R("$ZodUnknown", (t, e) => {
  oe.init(t, e), t._zod.parse = (r) => r;
}), Kc = /* @__PURE__ */ R("$ZodNever", (t, e) => {
  oe.init(t, e), t._zod.parse = (r, n) => (r.issues.push({
    expected: "never",
    code: "invalid_type",
    input: r.value,
    inst: t
  }), r);
});
function us(t, e, r) {
  t.issues.length && e.issues.push(...Et(r, t.issues)), e.value[r] = t.value;
}
const Vc = /* @__PURE__ */ R("$ZodArray", (t, e) => {
  oe.init(t, e), t._zod.parse = (r, n) => {
    const s = r.value;
    if (!Array.isArray(s))
      return r.issues.push({
        expected: "array",
        code: "invalid_type",
        input: s,
        inst: t
      }), r;
    r.value = Array(s.length);
    const i = [];
    for (let o = 0; o < s.length; o++) {
      const a = s[o], c = e.element._zod.run({
        value: a,
        issues: []
      }, n);
      c instanceof Promise ? i.push(c.then((u) => us(u, r, o))) : us(c, r, o);
    }
    return i.length ? Promise.all(i).then(() => r) : r;
  };
});
function mr(t, e, r, n, s) {
  if (t.issues.length) {
    if (s && !(r in n))
      return;
    e.issues.push(...Et(r, t.issues));
  }
  t.value === void 0 ? r in n && (e.value[r] = void 0) : e.value[r] = t.value;
}
function $i(t) {
  var n, s, i, o;
  const e = Object.keys(t.shape);
  for (const a of e)
    if (!((o = (i = (s = (n = t.shape) == null ? void 0 : n[a]) == null ? void 0 : s._zod) == null ? void 0 : i.traits) != null && o.has("$ZodType")))
      throw new Error(`Invalid element at key "${a}": expected a Zod schema`);
  const r = fa(t.shape);
  return {
    ...t,
    keys: e,
    keySet: new Set(e),
    numKeys: e.length,
    optionalKeys: new Set(r)
  };
}
function ji(t, e, r, n, s, i) {
  const o = [], a = s.keySet, c = s.catchall._zod, u = c.def.type, l = c.optout === "optional";
  for (const h in e) {
    if (a.has(h))
      continue;
    if (u === "never") {
      o.push(h);
      continue;
    }
    const f = c.run({ value: e[h], issues: [] }, n);
    f instanceof Promise ? t.push(f.then((d) => mr(d, r, h, e, l))) : mr(f, r, h, e, l);
  }
  return o.length && r.issues.push({
    code: "unrecognized_keys",
    keys: o,
    input: e,
    inst: i
  }), t.length ? Promise.all(t).then(() => r) : r;
}
const Gc = /* @__PURE__ */ R("$ZodObject", (t, e) => {
  oe.init(t, e);
  const r = Object.getOwnPropertyDescriptor(e, "shape");
  if (!(r != null && r.get)) {
    const a = e.shape;
    Object.defineProperty(e, "shape", {
      get: () => {
        const c = { ...a };
        return Object.defineProperty(e, "shape", {
          value: c
        }), c;
      }
    });
  }
  const n = An(() => $i(e));
  G(t._zod, "propValues", () => {
    const a = e.shape, c = {};
    for (const u in a) {
      const l = a[u]._zod;
      if (l.values) {
        c[u] ?? (c[u] = /* @__PURE__ */ new Set());
        for (const h of l.values)
          c[u].add(h);
      }
    }
    return c;
  });
  const s = pr, i = e.catchall;
  let o;
  t._zod.parse = (a, c) => {
    o ?? (o = n.value);
    const u = a.value;
    if (!s(u))
      return a.issues.push({
        expected: "object",
        code: "invalid_type",
        input: u,
        inst: t
      }), a;
    a.value = {};
    const l = [], h = o.shape;
    for (const f of o.keys) {
      const d = h[f], g = d._zod.optout === "optional", y = d._zod.run({ value: u[f], issues: [] }, c);
      y instanceof Promise ? l.push(y.then((I) => mr(I, a, f, u, g))) : mr(y, a, f, u, g);
    }
    return i ? ji(l, u, a, c, n.value, t) : l.length ? Promise.all(l).then(() => a) : a;
  };
}), Jc = /* @__PURE__ */ R("$ZodObjectJIT", (t, e) => {
  Gc.init(t, e);
  const r = t._zod.parse, n = An(() => $i(e)), s = (f) => {
    var S;
    const d = new _c(["shape", "payload", "ctx"]), g = n.value, y = (m) => {
      const p = as(m);
      return `shape[${p}]._zod.run({ value: input[${p}], issues: [] }, ctx)`;
    };
    d.write("const input = payload.value;");
    const I = /* @__PURE__ */ Object.create(null);
    let k = 0;
    for (const m of g.keys)
      I[m] = `key_${k++}`;
    d.write("const newResult = {};");
    for (const m of g.keys) {
      const p = I[m], E = as(m), _ = f[m], b = ((S = _ == null ? void 0 : _._zod) == null ? void 0 : S.optout) === "optional";
      d.write(`const ${p} = ${y(m)};`), b ? d.write(`
        if (${p}.issues.length) {
          if (${E} in input) {
            payload.issues = payload.issues.concat(${p}.issues.map(iss => ({
              ...iss,
              path: iss.path ? [${E}, ...iss.path] : [${E}]
            })));
          }
        }
        
        if (${p}.value === undefined) {
          if (${E} in input) {
            newResult[${E}] = undefined;
          }
        } else {
          newResult[${E}] = ${p}.value;
        }
        
      `) : d.write(`
        if (${p}.issues.length) {
          payload.issues = payload.issues.concat(${p}.issues.map(iss => ({
            ...iss,
            path: iss.path ? [${E}, ...iss.path] : [${E}]
          })));
        }
        
        if (${p}.value === undefined) {
          if (${E} in input) {
            newResult[${E}] = undefined;
          }
        } else {
          newResult[${E}] = ${p}.value;
        }
        
      `);
    }
    d.write("payload.value = newResult;"), d.write("return payload;");
    const w = d.compile();
    return (m, p) => w(f, m, p);
  };
  let i;
  const o = pr, a = !vi.jitless, u = a && ha.value, l = e.catchall;
  let h;
  t._zod.parse = (f, d) => {
    h ?? (h = n.value);
    const g = f.value;
    return o(g) ? a && u && (d == null ? void 0 : d.async) === !1 && d.jitless !== !0 ? (i || (i = s(e.shape)), f = i(f, d), l ? ji([], g, f, d, h, t) : f) : r(f, d) : (f.issues.push({
      expected: "object",
      code: "invalid_type",
      input: g,
      inst: t
    }), f);
  };
});
function ls(t, e, r, n) {
  for (const i of t)
    if (i.issues.length === 0)
      return e.value = i.value, e;
  const s = t.filter((i) => !yt(i));
  return s.length === 1 ? (e.value = s[0].value, s[0]) : (e.issues.push({
    code: "invalid_union",
    input: e.value,
    inst: r,
    errors: t.map((i) => i.issues.map((o) => We(o, n, qe())))
  }), e);
}
const Xc = /* @__PURE__ */ R("$ZodUnion", (t, e) => {
  oe.init(t, e), G(t._zod, "optin", () => e.options.some((s) => s._zod.optin === "optional") ? "optional" : void 0), G(t._zod, "optout", () => e.options.some((s) => s._zod.optout === "optional") ? "optional" : void 0), G(t._zod, "values", () => {
    if (e.options.every((s) => s._zod.values))
      return new Set(e.options.flatMap((s) => Array.from(s._zod.values)));
  }), G(t._zod, "pattern", () => {
    if (e.options.every((s) => s._zod.pattern)) {
      const s = e.options.map((i) => i._zod.pattern);
      return new RegExp(`^(${s.map((i) => Rn(i.source)).join("|")})$`);
    }
  });
  const r = e.options.length === 1, n = e.options[0]._zod.run;
  t._zod.parse = (s, i) => {
    if (r)
      return n(s, i);
    let o = !1;
    const a = [];
    for (const c of e.options) {
      const u = c._zod.run({
        value: s.value,
        issues: []
      }, i);
      if (u instanceof Promise)
        a.push(u), o = !0;
      else {
        if (u.issues.length === 0)
          return u;
        a.push(u);
      }
    }
    return o ? Promise.all(a).then((c) => ls(c, s, t, i)) : ls(a, s, t, i);
  };
}), Yc = /* @__PURE__ */ R("$ZodIntersection", (t, e) => {
  oe.init(t, e), t._zod.parse = (r, n) => {
    const s = r.value, i = e.left._zod.run({ value: s, issues: [] }, n), o = e.right._zod.run({ value: s, issues: [] }, n);
    return i instanceof Promise || o instanceof Promise ? Promise.all([i, o]).then(([c, u]) => hs(r, c, u)) : hs(r, i, o);
  };
});
function sn(t, e) {
  if (t === e)
    return { valid: !0, data: t };
  if (t instanceof Date && e instanceof Date && +t == +e)
    return { valid: !0, data: t };
  if (Tt(t) && Tt(e)) {
    const r = Object.keys(e), n = Object.keys(t).filter((i) => r.indexOf(i) !== -1), s = { ...t, ...e };
    for (const i of n) {
      const o = sn(t[i], e[i]);
      if (!o.valid)
        return {
          valid: !1,
          mergeErrorPath: [i, ...o.mergeErrorPath]
        };
      s[i] = o.data;
    }
    return { valid: !0, data: s };
  }
  if (Array.isArray(t) && Array.isArray(e)) {
    if (t.length !== e.length)
      return { valid: !1, mergeErrorPath: [] };
    const r = [];
    for (let n = 0; n < t.length; n++) {
      const s = t[n], i = e[n], o = sn(s, i);
      if (!o.valid)
        return {
          valid: !1,
          mergeErrorPath: [n, ...o.mergeErrorPath]
        };
      r.push(o.data);
    }
    return { valid: !0, data: r };
  }
  return { valid: !1, mergeErrorPath: [] };
}
function hs(t, e, r) {
  const n = /* @__PURE__ */ new Map();
  let s;
  for (const a of e.issues)
    if (a.code === "unrecognized_keys") {
      s ?? (s = a);
      for (const c of a.keys)
        n.has(c) || n.set(c, {}), n.get(c).l = !0;
    } else
      t.issues.push(a);
  for (const a of r.issues)
    if (a.code === "unrecognized_keys")
      for (const c of a.keys)
        n.has(c) || n.set(c, {}), n.get(c).r = !0;
    else
      t.issues.push(a);
  const i = [...n].filter(([, a]) => a.l && a.r).map(([a]) => a);
  if (i.length && s && t.issues.push({ ...s, keys: i }), yt(t))
    return t;
  const o = sn(e.value, r.value);
  if (!o.valid)
    throw new Error(`Unmergable intersection. Error path: ${JSON.stringify(o.mergeErrorPath)}`);
  return t.value = o.data, t;
}
const Qc = /* @__PURE__ */ R("$ZodRecord", (t, e) => {
  oe.init(t, e), t._zod.parse = (r, n) => {
    const s = r.value;
    if (!Tt(s))
      return r.issues.push({
        expected: "record",
        code: "invalid_type",
        input: s,
        inst: t
      }), r;
    const i = [], o = e.keyType._zod.values;
    if (o) {
      r.value = {};
      const a = /* @__PURE__ */ new Set();
      for (const u of o)
        if (typeof u == "string" || typeof u == "number" || typeof u == "symbol") {
          a.add(typeof u == "number" ? u.toString() : u);
          const l = e.valueType._zod.run({ value: s[u], issues: [] }, n);
          l instanceof Promise ? i.push(l.then((h) => {
            h.issues.length && r.issues.push(...Et(u, h.issues)), r.value[u] = h.value;
          })) : (l.issues.length && r.issues.push(...Et(u, l.issues)), r.value[u] = l.value);
        }
      let c;
      for (const u in s)
        a.has(u) || (c = c ?? [], c.push(u));
      c && c.length > 0 && r.issues.push({
        code: "unrecognized_keys",
        input: s,
        inst: t,
        keys: c
      });
    } else {
      r.value = {};
      for (const a of Reflect.ownKeys(s)) {
        if (a === "__proto__")
          continue;
        let c = e.keyType._zod.run({ value: a, issues: [] }, n);
        if (c instanceof Promise)
          throw new Error("Async schemas not supported in object keys currently");
        if (typeof a == "string" && Ii.test(a) && c.issues.length) {
          const h = e.keyType._zod.run({ value: Number(a), issues: [] }, n);
          if (h instanceof Promise)
            throw new Error("Async schemas not supported in object keys currently");
          h.issues.length === 0 && (c = h);
        }
        if (c.issues.length) {
          e.mode === "loose" ? r.value[a] = s[a] : r.issues.push({
            code: "invalid_key",
            origin: "record",
            issues: c.issues.map((h) => We(h, n, qe())),
            input: a,
            path: [a],
            inst: t
          });
          continue;
        }
        const l = e.valueType._zod.run({ value: s[a], issues: [] }, n);
        l instanceof Promise ? i.push(l.then((h) => {
          h.issues.length && r.issues.push(...Et(a, h.issues)), r.value[c.value] = h.value;
        })) : (l.issues.length && r.issues.push(...Et(a, l.issues)), r.value[c.value] = l.value);
      }
    }
    return i.length ? Promise.all(i).then(() => r) : r;
  };
}), eu = /* @__PURE__ */ R("$ZodEnum", (t, e) => {
  oe.init(t, e);
  const r = wi(e.entries), n = new Set(r);
  t._zod.values = n, t._zod.pattern = new RegExp(`^(${r.filter((s) => da.has(typeof s)).map((s) => typeof s == "string" ? Sr(s) : s.toString()).join("|")})$`), t._zod.parse = (s, i) => {
    const o = s.value;
    return n.has(o) || s.issues.push({
      code: "invalid_value",
      values: r,
      input: o,
      inst: t
    }), s;
  };
}), tu = /* @__PURE__ */ R("$ZodTransform", (t, e) => {
  oe.init(t, e), t._zod.parse = (r, n) => {
    if (n.direction === "backward")
      throw new Ei(t.constructor.name);
    const s = e.transform(r.value, r);
    if (n.async)
      return (s instanceof Promise ? s : Promise.resolve(s)).then((o) => (r.value = o, r));
    if (s instanceof Promise)
      throw new wt();
    return r.value = s, r;
  };
});
function ds(t, e) {
  return t.issues.length && e === void 0 ? { issues: [], value: void 0 } : t;
}
const xi = /* @__PURE__ */ R("$ZodOptional", (t, e) => {
  oe.init(t, e), t._zod.optin = "optional", t._zod.optout = "optional", G(t._zod, "values", () => e.innerType._zod.values ? /* @__PURE__ */ new Set([...e.innerType._zod.values, void 0]) : void 0), G(t._zod, "pattern", () => {
    const r = e.innerType._zod.pattern;
    return r ? new RegExp(`^(${Rn(r.source)})?$`) : void 0;
  }), t._zod.parse = (r, n) => {
    if (e.innerType._zod.optin === "optional") {
      const s = e.innerType._zod.run(r, n);
      return s instanceof Promise ? s.then((i) => ds(i, r.value)) : ds(s, r.value);
    }
    return r.value === void 0 ? r : e.innerType._zod.run(r, n);
  };
}), ru = /* @__PURE__ */ R("$ZodExactOptional", (t, e) => {
  xi.init(t, e), G(t._zod, "values", () => e.innerType._zod.values), G(t._zod, "pattern", () => e.innerType._zod.pattern), t._zod.parse = (r, n) => e.innerType._zod.run(r, n);
}), nu = /* @__PURE__ */ R("$ZodNullable", (t, e) => {
  oe.init(t, e), G(t._zod, "optin", () => e.innerType._zod.optin), G(t._zod, "optout", () => e.innerType._zod.optout), G(t._zod, "pattern", () => {
    const r = e.innerType._zod.pattern;
    return r ? new RegExp(`^(${Rn(r.source)}|null)$`) : void 0;
  }), G(t._zod, "values", () => e.innerType._zod.values ? /* @__PURE__ */ new Set([...e.innerType._zod.values, null]) : void 0), t._zod.parse = (r, n) => r.value === null ? r : e.innerType._zod.run(r, n);
}), su = /* @__PURE__ */ R("$ZodDefault", (t, e) => {
  oe.init(t, e), t._zod.optin = "optional", G(t._zod, "values", () => e.innerType._zod.values), t._zod.parse = (r, n) => {
    if (n.direction === "backward")
      return e.innerType._zod.run(r, n);
    if (r.value === void 0)
      return r.value = e.defaultValue, r;
    const s = e.innerType._zod.run(r, n);
    return s instanceof Promise ? s.then((i) => fs(i, e)) : fs(s, e);
  };
});
function fs(t, e) {
  return t.value === void 0 && (t.value = e.defaultValue), t;
}
const iu = /* @__PURE__ */ R("$ZodPrefault", (t, e) => {
  oe.init(t, e), t._zod.optin = "optional", G(t._zod, "values", () => e.innerType._zod.values), t._zod.parse = (r, n) => (n.direction === "backward" || r.value === void 0 && (r.value = e.defaultValue), e.innerType._zod.run(r, n));
}), ou = /* @__PURE__ */ R("$ZodNonOptional", (t, e) => {
  oe.init(t, e), G(t._zod, "values", () => {
    const r = e.innerType._zod.values;
    return r ? new Set([...r].filter((n) => n !== void 0)) : void 0;
  }), t._zod.parse = (r, n) => {
    const s = e.innerType._zod.run(r, n);
    return s instanceof Promise ? s.then((i) => ps(i, t)) : ps(s, t);
  };
});
function ps(t, e) {
  return !t.issues.length && t.value === void 0 && t.issues.push({
    code: "invalid_type",
    expected: "nonoptional",
    input: t.value,
    inst: e
  }), t;
}
const au = /* @__PURE__ */ R("$ZodCatch", (t, e) => {
  oe.init(t, e), G(t._zod, "optin", () => e.innerType._zod.optin), G(t._zod, "optout", () => e.innerType._zod.optout), G(t._zod, "values", () => e.innerType._zod.values), t._zod.parse = (r, n) => {
    if (n.direction === "backward")
      return e.innerType._zod.run(r, n);
    const s = e.innerType._zod.run(r, n);
    return s instanceof Promise ? s.then((i) => (r.value = i.value, i.issues.length && (r.value = e.catchValue({
      ...r,
      error: {
        issues: i.issues.map((o) => We(o, n, qe()))
      },
      input: r.value
    }), r.issues = []), r)) : (r.value = s.value, s.issues.length && (r.value = e.catchValue({
      ...r,
      error: {
        issues: s.issues.map((i) => We(i, n, qe()))
      },
      input: r.value
    }), r.issues = []), r);
  };
}), cu = /* @__PURE__ */ R("$ZodPipe", (t, e) => {
  oe.init(t, e), G(t._zod, "values", () => e.in._zod.values), G(t._zod, "optin", () => e.in._zod.optin), G(t._zod, "optout", () => e.out._zod.optout), G(t._zod, "propValues", () => e.in._zod.propValues), t._zod.parse = (r, n) => {
    if (n.direction === "backward") {
      const i = e.out._zod.run(r, n);
      return i instanceof Promise ? i.then((o) => Xt(o, e.in, n)) : Xt(i, e.in, n);
    }
    const s = e.in._zod.run(r, n);
    return s instanceof Promise ? s.then((i) => Xt(i, e.out, n)) : Xt(s, e.out, n);
  };
});
function Xt(t, e, r) {
  return t.issues.length ? (t.aborted = !0, t) : e._zod.run({ value: t.value, issues: t.issues }, r);
}
const uu = /* @__PURE__ */ R("$ZodReadonly", (t, e) => {
  oe.init(t, e), G(t._zod, "propValues", () => e.innerType._zod.propValues), G(t._zod, "values", () => e.innerType._zod.values), G(t._zod, "optin", () => {
    var r, n;
    return (n = (r = e.innerType) == null ? void 0 : r._zod) == null ? void 0 : n.optin;
  }), G(t._zod, "optout", () => {
    var r, n;
    return (n = (r = e.innerType) == null ? void 0 : r._zod) == null ? void 0 : n.optout;
  }), t._zod.parse = (r, n) => {
    if (n.direction === "backward")
      return e.innerType._zod.run(r, n);
    const s = e.innerType._zod.run(r, n);
    return s instanceof Promise ? s.then(ms) : ms(s);
  };
});
function ms(t) {
  return t.value = Object.freeze(t.value), t;
}
const lu = /* @__PURE__ */ R("$ZodCustom", (t, e) => {
  Se.init(t, e), oe.init(t, e), t._zod.parse = (r, n) => r, t._zod.check = (r) => {
    const n = r.value, s = e.fn(n);
    if (s instanceof Promise)
      return s.then((i) => gs(i, r, n, t));
    gs(s, r, n, t);
  };
});
function gs(t, e, r, n) {
  if (!t) {
    const s = {
      code: "custom",
      input: r,
      inst: n,
      // incorporates params.error into issue reporting
      path: [...n._zod.def.path ?? []],
      // incorporates params.error into issue reporting
      continue: !n._zod.def.abort
      // params: inst._zod.def.params,
    };
    n._zod.def.params && (s.params = n._zod.def.params), e.issues.push(jt(s));
  }
}
var _s;
class hu {
  constructor() {
    this._map = /* @__PURE__ */ new WeakMap(), this._idmap = /* @__PURE__ */ new Map();
  }
  add(e, ...r) {
    const n = r[0];
    return this._map.set(e, n), n && typeof n == "object" && "id" in n && this._idmap.set(n.id, e), this;
  }
  clear() {
    return this._map = /* @__PURE__ */ new WeakMap(), this._idmap = /* @__PURE__ */ new Map(), this;
  }
  remove(e) {
    const r = this._map.get(e);
    return r && typeof r == "object" && "id" in r && this._idmap.delete(r.id), this._map.delete(e), this;
  }
  get(e) {
    const r = e._zod.parent;
    if (r) {
      const n = { ...this.get(r) ?? {} };
      delete n.id;
      const s = { ...n, ...this._map.get(e) };
      return Object.keys(s).length ? s : void 0;
    }
    return this._map.get(e);
  }
  has(e) {
    return this._map.has(e);
  }
}
function du() {
  return new hu();
}
(_s = globalThis).__zod_globalRegistry ?? (_s.__zod_globalRegistry = du());
const It = globalThis.__zod_globalRegistry;
// @__NO_SIDE_EFFECTS__
function fu(t, e) {
  return new t({
    type: "string",
    ...F(e)
  });
}
// @__NO_SIDE_EFFECTS__
function pu(t, e) {
  return new t({
    type: "string",
    format: "email",
    check: "string_format",
    abort: !1,
    ...F(e)
  });
}
// @__NO_SIDE_EFFECTS__
function ys(t, e) {
  return new t({
    type: "string",
    format: "guid",
    check: "string_format",
    abort: !1,
    ...F(e)
  });
}
// @__NO_SIDE_EFFECTS__
function mu(t, e) {
  return new t({
    type: "string",
    format: "uuid",
    check: "string_format",
    abort: !1,
    ...F(e)
  });
}
// @__NO_SIDE_EFFECTS__
function gu(t, e) {
  return new t({
    type: "string",
    format: "uuid",
    check: "string_format",
    abort: !1,
    version: "v4",
    ...F(e)
  });
}
// @__NO_SIDE_EFFECTS__
function _u(t, e) {
  return new t({
    type: "string",
    format: "uuid",
    check: "string_format",
    abort: !1,
    version: "v6",
    ...F(e)
  });
}
// @__NO_SIDE_EFFECTS__
function yu(t, e) {
  return new t({
    type: "string",
    format: "uuid",
    check: "string_format",
    abort: !1,
    version: "v7",
    ...F(e)
  });
}
// @__NO_SIDE_EFFECTS__
function Eu(t, e) {
  return new t({
    type: "string",
    format: "url",
    check: "string_format",
    abort: !1,
    ...F(e)
  });
}
// @__NO_SIDE_EFFECTS__
function vu(t, e) {
  return new t({
    type: "string",
    format: "emoji",
    check: "string_format",
    abort: !1,
    ...F(e)
  });
}
// @__NO_SIDE_EFFECTS__
function wu(t, e) {
  return new t({
    type: "string",
    format: "nanoid",
    check: "string_format",
    abort: !1,
    ...F(e)
  });
}
// @__NO_SIDE_EFFECTS__
function bu(t, e) {
  return new t({
    type: "string",
    format: "cuid",
    check: "string_format",
    abort: !1,
    ...F(e)
  });
}
// @__NO_SIDE_EFFECTS__
function Tu(t, e) {
  return new t({
    type: "string",
    format: "cuid2",
    check: "string_format",
    abort: !1,
    ...F(e)
  });
}
// @__NO_SIDE_EFFECTS__
function Su(t, e) {
  return new t({
    type: "string",
    format: "ulid",
    check: "string_format",
    abort: !1,
    ...F(e)
  });
}
// @__NO_SIDE_EFFECTS__
function Ou(t, e) {
  return new t({
    type: "string",
    format: "xid",
    check: "string_format",
    abort: !1,
    ...F(e)
  });
}
// @__NO_SIDE_EFFECTS__
function Au(t, e) {
  return new t({
    type: "string",
    format: "ksuid",
    check: "string_format",
    abort: !1,
    ...F(e)
  });
}
// @__NO_SIDE_EFFECTS__
function ku(t, e) {
  return new t({
    type: "string",
    format: "ipv4",
    check: "string_format",
    abort: !1,
    ...F(e)
  });
}
// @__NO_SIDE_EFFECTS__
function Ru(t, e) {
  return new t({
    type: "string",
    format: "ipv6",
    check: "string_format",
    abort: !1,
    ...F(e)
  });
}
// @__NO_SIDE_EFFECTS__
function Nu(t, e) {
  return new t({
    type: "string",
    format: "cidrv4",
    check: "string_format",
    abort: !1,
    ...F(e)
  });
}
// @__NO_SIDE_EFFECTS__
function Iu(t, e) {
  return new t({
    type: "string",
    format: "cidrv6",
    check: "string_format",
    abort: !1,
    ...F(e)
  });
}
// @__NO_SIDE_EFFECTS__
function Lu(t, e) {
  return new t({
    type: "string",
    format: "base64",
    check: "string_format",
    abort: !1,
    ...F(e)
  });
}
// @__NO_SIDE_EFFECTS__
function Cu(t, e) {
  return new t({
    type: "string",
    format: "base64url",
    check: "string_format",
    abort: !1,
    ...F(e)
  });
}
// @__NO_SIDE_EFFECTS__
function Pu(t, e) {
  return new t({
    type: "string",
    format: "e164",
    check: "string_format",
    abort: !1,
    ...F(e)
  });
}
// @__NO_SIDE_EFFECTS__
function Du(t, e) {
  return new t({
    type: "string",
    format: "jwt",
    check: "string_format",
    abort: !1,
    ...F(e)
  });
}
// @__NO_SIDE_EFFECTS__
function Uu(t, e) {
  return new t({
    type: "string",
    format: "datetime",
    check: "string_format",
    offset: !1,
    local: !1,
    precision: null,
    ...F(e)
  });
}
// @__NO_SIDE_EFFECTS__
function $u(t, e) {
  return new t({
    type: "string",
    format: "date",
    check: "string_format",
    ...F(e)
  });
}
// @__NO_SIDE_EFFECTS__
function ju(t, e) {
  return new t({
    type: "string",
    format: "time",
    check: "string_format",
    precision: null,
    ...F(e)
  });
}
// @__NO_SIDE_EFFECTS__
function xu(t, e) {
  return new t({
    type: "string",
    format: "duration",
    check: "string_format",
    ...F(e)
  });
}
// @__NO_SIDE_EFFECTS__
function Fu(t, e) {
  return new t({
    type: "number",
    coerce: !0,
    checks: [],
    ...F(e)
  });
}
// @__NO_SIDE_EFFECTS__
function zu(t, e) {
  return new t({
    type: "number",
    check: "number_format",
    abort: !1,
    format: "safeint",
    ...F(e)
  });
}
// @__NO_SIDE_EFFECTS__
function Bu(t, e) {
  return new t({
    type: "boolean",
    ...F(e)
  });
}
// @__NO_SIDE_EFFECTS__
function Mu(t) {
  return new t({
    type: "unknown"
  });
}
// @__NO_SIDE_EFFECTS__
function Zu(t, e) {
  return new t({
    type: "never",
    ...F(e)
  });
}
// @__NO_SIDE_EFFECTS__
function Es(t, e) {
  return new Ci({
    check: "less_than",
    ...F(e),
    value: t,
    inclusive: !1
  });
}
// @__NO_SIDE_EFFECTS__
function Vr(t, e) {
  return new Ci({
    check: "less_than",
    ...F(e),
    value: t,
    inclusive: !0
  });
}
// @__NO_SIDE_EFFECTS__
function vs(t, e) {
  return new Pi({
    check: "greater_than",
    ...F(e),
    value: t,
    inclusive: !1
  });
}
// @__NO_SIDE_EFFECTS__
function Gr(t, e) {
  return new Pi({
    check: "greater_than",
    ...F(e),
    value: t,
    inclusive: !0
  });
}
// @__NO_SIDE_EFFECTS__
function ws(t, e) {
  return new ic({
    check: "multiple_of",
    ...F(e),
    value: t
  });
}
// @__NO_SIDE_EFFECTS__
function Fi(t, e) {
  return new ac({
    check: "max_length",
    ...F(e),
    maximum: t
  });
}
// @__NO_SIDE_EFFECTS__
function gr(t, e) {
  return new cc({
    check: "min_length",
    ...F(e),
    minimum: t
  });
}
// @__NO_SIDE_EFFECTS__
function zi(t, e) {
  return new uc({
    check: "length_equals",
    ...F(e),
    length: t
  });
}
// @__NO_SIDE_EFFECTS__
function Hu(t, e) {
  return new lc({
    check: "string_format",
    format: "regex",
    ...F(e),
    pattern: t
  });
}
// @__NO_SIDE_EFFECTS__
function qu(t) {
  return new hc({
    check: "string_format",
    format: "lowercase",
    ...F(t)
  });
}
// @__NO_SIDE_EFFECTS__
function Wu(t) {
  return new dc({
    check: "string_format",
    format: "uppercase",
    ...F(t)
  });
}
// @__NO_SIDE_EFFECTS__
function Ku(t, e) {
  return new fc({
    check: "string_format",
    format: "includes",
    ...F(e),
    includes: t
  });
}
// @__NO_SIDE_EFFECTS__
function Vu(t, e) {
  return new pc({
    check: "string_format",
    format: "starts_with",
    ...F(e),
    prefix: t
  });
}
// @__NO_SIDE_EFFECTS__
function Gu(t, e) {
  return new mc({
    check: "string_format",
    format: "ends_with",
    ...F(e),
    suffix: t
  });
}
// @__NO_SIDE_EFFECTS__
function St(t) {
  return new gc({
    check: "overwrite",
    tx: t
  });
}
// @__NO_SIDE_EFFECTS__
function Ju(t) {
  return /* @__PURE__ */ St((e) => e.normalize(t));
}
// @__NO_SIDE_EFFECTS__
function Xu() {
  return /* @__PURE__ */ St((t) => t.trim());
}
// @__NO_SIDE_EFFECTS__
function Yu() {
  return /* @__PURE__ */ St((t) => t.toLowerCase());
}
// @__NO_SIDE_EFFECTS__
function Qu() {
  return /* @__PURE__ */ St((t) => t.toUpperCase());
}
// @__NO_SIDE_EFFECTS__
function el() {
  return /* @__PURE__ */ St((t) => la(t));
}
// @__NO_SIDE_EFFECTS__
function tl(t, e, r) {
  return new t({
    type: "array",
    element: e,
    // get element() {
    //   return element;
    // },
    ...F(r)
  });
}
// @__NO_SIDE_EFFECTS__
function rl(t, e, r) {
  return new t({
    type: "custom",
    check: "custom",
    fn: e,
    ...F(r)
  });
}
// @__NO_SIDE_EFFECTS__
function nl(t) {
  const e = /* @__PURE__ */ sl((r) => (r.addIssue = (n) => {
    if (typeof n == "string")
      r.issues.push(jt(n, r.value, e._zod.def));
    else {
      const s = n;
      s.fatal && (s.continue = !1), s.code ?? (s.code = "custom"), s.input ?? (s.input = r.value), s.inst ?? (s.inst = e), s.continue ?? (s.continue = !e._zod.def.abort), r.issues.push(jt(s));
    }
  }, t(r.value, r)));
  return e;
}
// @__NO_SIDE_EFFECTS__
function sl(t, e) {
  const r = new Se({
    check: "custom",
    ...F(e)
  });
  return r._zod.check = t, r;
}
function Bi(t) {
  let e = (t == null ? void 0 : t.target) ?? "draft-2020-12";
  return e === "draft-4" && (e = "draft-04"), e === "draft-7" && (e = "draft-07"), {
    processors: t.processors ?? {},
    metadataRegistry: (t == null ? void 0 : t.metadata) ?? It,
    target: e,
    unrepresentable: (t == null ? void 0 : t.unrepresentable) ?? "throw",
    override: (t == null ? void 0 : t.override) ?? (() => {
    }),
    io: (t == null ? void 0 : t.io) ?? "output",
    counter: 0,
    seen: /* @__PURE__ */ new Map(),
    cycles: (t == null ? void 0 : t.cycles) ?? "ref",
    reused: (t == null ? void 0 : t.reused) ?? "inline",
    external: (t == null ? void 0 : t.external) ?? void 0
  };
}
function pe(t, e, r = { path: [], schemaPath: [] }) {
  var l, h;
  var n;
  const s = t._zod.def, i = e.seen.get(t);
  if (i)
    return i.count++, r.schemaPath.includes(t) && (i.cycle = r.path), i.schema;
  const o = { schema: {}, count: 1, cycle: void 0, path: r.path };
  e.seen.set(t, o);
  const a = (h = (l = t._zod).toJSONSchema) == null ? void 0 : h.call(l);
  if (a)
    o.schema = a;
  else {
    const f = {
      ...r,
      schemaPath: [...r.schemaPath, t],
      path: r.path
    };
    if (t._zod.processJSONSchema)
      t._zod.processJSONSchema(e, o.schema, f);
    else {
      const g = o.schema, y = e.processors[s.type];
      if (!y)
        throw new Error(`[toJSONSchema]: Non-representable type encountered: ${s.type}`);
      y(t, e, g, f);
    }
    const d = t._zod.parent;
    d && (o.ref || (o.ref = d), pe(d, e, f), e.seen.get(d).isParent = !0);
  }
  const c = e.metadataRegistry.get(t);
  return c && Object.assign(o.schema, c), e.io === "input" && we(t) && (delete o.schema.examples, delete o.schema.default), e.io === "input" && o.schema._prefault && ((n = o.schema).default ?? (n.default = o.schema._prefault)), delete o.schema._prefault, e.seen.get(t).schema;
}
function Mi(t, e) {
  var o, a, c, u;
  const r = t.seen.get(e);
  if (!r)
    throw new Error("Unprocessed schema. This is a bug in Zod.");
  const n = /* @__PURE__ */ new Map();
  for (const l of t.seen.entries()) {
    const h = (o = t.metadataRegistry.get(l[0])) == null ? void 0 : o.id;
    if (h) {
      const f = n.get(h);
      if (f && f !== l[0])
        throw new Error(`Duplicate schema id "${h}" detected during JSON Schema conversion. Two different schemas cannot share the same id when converted together.`);
      n.set(h, l[0]);
    }
  }
  const s = (l) => {
    var y;
    const h = t.target === "draft-2020-12" ? "$defs" : "definitions";
    if (t.external) {
      const I = (y = t.external.registry.get(l[0])) == null ? void 0 : y.id, k = t.external.uri ?? ((S) => S);
      if (I)
        return { ref: k(I) };
      const w = l[1].defId ?? l[1].schema.id ?? `schema${t.counter++}`;
      return l[1].defId = w, { defId: w, ref: `${k("__shared")}#/${h}/${w}` };
    }
    if (l[1] === r)
      return { ref: "#" };
    const d = `#/${h}/`, g = l[1].schema.id ?? `__schema${t.counter++}`;
    return { defId: g, ref: d + g };
  }, i = (l) => {
    if (l[1].schema.$ref)
      return;
    const h = l[1], { ref: f, defId: d } = s(l);
    h.def = { ...h.schema }, d && (h.defId = d);
    const g = h.schema;
    for (const y in g)
      delete g[y];
    g.$ref = f;
  };
  if (t.cycles === "throw")
    for (const l of t.seen.entries()) {
      const h = l[1];
      if (h.cycle)
        throw new Error(`Cycle detected: #/${(a = h.cycle) == null ? void 0 : a.join("/")}/<root>

Set the \`cycles\` parameter to \`"ref"\` to resolve cyclical schemas with defs.`);
    }
  for (const l of t.seen.entries()) {
    const h = l[1];
    if (e === l[0]) {
      i(l);
      continue;
    }
    if (t.external) {
      const d = (c = t.external.registry.get(l[0])) == null ? void 0 : c.id;
      if (e !== l[0] && d) {
        i(l);
        continue;
      }
    }
    if ((u = t.metadataRegistry.get(l[0])) == null ? void 0 : u.id) {
      i(l);
      continue;
    }
    if (h.cycle) {
      i(l);
      continue;
    }
    if (h.count > 1 && t.reused === "ref") {
      i(l);
      continue;
    }
  }
}
function Zi(t, e) {
  var o, a, c;
  const r = t.seen.get(e);
  if (!r)
    throw new Error("Unprocessed schema. This is a bug in Zod.");
  const n = (u) => {
    const l = t.seen.get(u);
    if (l.ref === null)
      return;
    const h = l.def ?? l.schema, f = { ...h }, d = l.ref;
    if (l.ref = null, d) {
      n(d);
      const y = t.seen.get(d), I = y.schema;
      if (I.$ref && (t.target === "draft-07" || t.target === "draft-04" || t.target === "openapi-3.0") ? (h.allOf = h.allOf ?? [], h.allOf.push(I)) : Object.assign(h, I), Object.assign(h, f), u._zod.parent === d)
        for (const w in h)
          w === "$ref" || w === "allOf" || w in f || delete h[w];
      if (I.$ref && y.def)
        for (const w in h)
          w === "$ref" || w === "allOf" || w in y.def && JSON.stringify(h[w]) === JSON.stringify(y.def[w]) && delete h[w];
    }
    const g = u._zod.parent;
    if (g && g !== d) {
      n(g);
      const y = t.seen.get(g);
      if (y != null && y.schema.$ref && (h.$ref = y.schema.$ref, y.def))
        for (const I in h)
          I === "$ref" || I === "allOf" || I in y.def && JSON.stringify(h[I]) === JSON.stringify(y.def[I]) && delete h[I];
    }
    t.override({
      zodSchema: u,
      jsonSchema: h,
      path: l.path ?? []
    });
  };
  for (const u of [...t.seen.entries()].reverse())
    n(u[0]);
  const s = {};
  if (t.target === "draft-2020-12" ? s.$schema = "https://json-schema.org/draft/2020-12/schema" : t.target === "draft-07" ? s.$schema = "http://json-schema.org/draft-07/schema#" : t.target === "draft-04" ? s.$schema = "http://json-schema.org/draft-04/schema#" : t.target, (o = t.external) != null && o.uri) {
    const u = (a = t.external.registry.get(e)) == null ? void 0 : a.id;
    if (!u)
      throw new Error("Schema is missing an `id` property");
    s.$id = t.external.uri(u);
  }
  Object.assign(s, r.def ?? r.schema);
  const i = ((c = t.external) == null ? void 0 : c.defs) ?? {};
  for (const u of t.seen.entries()) {
    const l = u[1];
    l.def && l.defId && (i[l.defId] = l.def);
  }
  t.external || Object.keys(i).length > 0 && (t.target === "draft-2020-12" ? s.$defs = i : s.definitions = i);
  try {
    const u = JSON.parse(JSON.stringify(s));
    return Object.defineProperty(u, "~standard", {
      value: {
        ...e["~standard"],
        jsonSchema: {
          input: _r(e, "input", t.processors),
          output: _r(e, "output", t.processors)
        }
      },
      enumerable: !1,
      writable: !1
    }), u;
  } catch {
    throw new Error("Error converting schema to JSON.");
  }
}
function we(t, e) {
  const r = e ?? { seen: /* @__PURE__ */ new Set() };
  if (r.seen.has(t))
    return !1;
  r.seen.add(t);
  const n = t._zod.def;
  if (n.type === "transform")
    return !0;
  if (n.type === "array")
    return we(n.element, r);
  if (n.type === "set")
    return we(n.valueType, r);
  if (n.type === "lazy")
    return we(n.getter(), r);
  if (n.type === "promise" || n.type === "optional" || n.type === "nonoptional" || n.type === "nullable" || n.type === "readonly" || n.type === "default" || n.type === "prefault")
    return we(n.innerType, r);
  if (n.type === "intersection")
    return we(n.left, r) || we(n.right, r);
  if (n.type === "record" || n.type === "map")
    return we(n.keyType, r) || we(n.valueType, r);
  if (n.type === "pipe")
    return we(n.in, r) || we(n.out, r);
  if (n.type === "object") {
    for (const s in n.shape)
      if (we(n.shape[s], r))
        return !0;
    return !1;
  }
  if (n.type === "union") {
    for (const s of n.options)
      if (we(s, r))
        return !0;
    return !1;
  }
  if (n.type === "tuple") {
    for (const s of n.items)
      if (we(s, r))
        return !0;
    return !!(n.rest && we(n.rest, r));
  }
  return !1;
}
const il = (t, e = {}) => (r) => {
  const n = Bi({ ...r, processors: e });
  return pe(t, n), Mi(n, t), Zi(n, t);
}, _r = (t, e, r = {}) => (n) => {
  const { libraryOptions: s, target: i } = n ?? {}, o = Bi({ ...s ?? {}, target: i, io: e, processors: r });
  return pe(t, o), Mi(o, t), Zi(o, t);
}, ol = {
  guid: "uuid",
  url: "uri",
  datetime: "date-time",
  json_string: "json-string",
  regex: ""
  // do not set
}, al = (t, e, r, n) => {
  const s = r;
  s.type = "string";
  const { minimum: i, maximum: o, format: a, patterns: c, contentEncoding: u } = t._zod.bag;
  if (typeof i == "number" && (s.minLength = i), typeof o == "number" && (s.maxLength = o), a && (s.format = ol[a] ?? a, s.format === "" && delete s.format, a === "time" && delete s.format), u && (s.contentEncoding = u), c && c.size > 0) {
    const l = [...c];
    l.length === 1 ? s.pattern = l[0].source : l.length > 1 && (s.allOf = [
      ...l.map((h) => ({
        ...e.target === "draft-07" || e.target === "draft-04" || e.target === "openapi-3.0" ? { type: "string" } : {},
        pattern: h.source
      }))
    ]);
  }
}, cl = (t, e, r, n) => {
  const s = r, { minimum: i, maximum: o, format: a, multipleOf: c, exclusiveMaximum: u, exclusiveMinimum: l } = t._zod.bag;
  typeof a == "string" && a.includes("int") ? s.type = "integer" : s.type = "number", typeof l == "number" && (e.target === "draft-04" || e.target === "openapi-3.0" ? (s.minimum = l, s.exclusiveMinimum = !0) : s.exclusiveMinimum = l), typeof i == "number" && (s.minimum = i, typeof l == "number" && e.target !== "draft-04" && (l >= i ? delete s.minimum : delete s.exclusiveMinimum)), typeof u == "number" && (e.target === "draft-04" || e.target === "openapi-3.0" ? (s.maximum = u, s.exclusiveMaximum = !0) : s.exclusiveMaximum = u), typeof o == "number" && (s.maximum = o, typeof u == "number" && e.target !== "draft-04" && (u <= o ? delete s.maximum : delete s.exclusiveMaximum)), typeof c == "number" && (s.multipleOf = c);
}, ul = (t, e, r, n) => {
  r.type = "boolean";
}, ll = (t, e, r, n) => {
  r.not = {};
}, hl = (t, e, r, n) => {
}, dl = (t, e, r, n) => {
  const s = t._zod.def, i = wi(s.entries);
  i.every((o) => typeof o == "number") && (r.type = "number"), i.every((o) => typeof o == "string") && (r.type = "string"), r.enum = i;
}, fl = (t, e, r, n) => {
  if (e.unrepresentable === "throw")
    throw new Error("Custom types cannot be represented in JSON Schema");
}, pl = (t, e, r, n) => {
  if (e.unrepresentable === "throw")
    throw new Error("Transforms cannot be represented in JSON Schema");
}, ml = (t, e, r, n) => {
  const s = r, i = t._zod.def, { minimum: o, maximum: a } = t._zod.bag;
  typeof o == "number" && (s.minItems = o), typeof a == "number" && (s.maxItems = a), s.type = "array", s.items = pe(i.element, e, { ...n, path: [...n.path, "items"] });
}, gl = (t, e, r, n) => {
  var u;
  const s = r, i = t._zod.def;
  s.type = "object", s.properties = {};
  const o = i.shape;
  for (const l in o)
    s.properties[l] = pe(o[l], e, {
      ...n,
      path: [...n.path, "properties", l]
    });
  const a = new Set(Object.keys(o)), c = new Set([...a].filter((l) => {
    const h = i.shape[l]._zod;
    return e.io === "input" ? h.optin === void 0 : h.optout === void 0;
  }));
  c.size > 0 && (s.required = Array.from(c)), ((u = i.catchall) == null ? void 0 : u._zod.def.type) === "never" ? s.additionalProperties = !1 : i.catchall ? i.catchall && (s.additionalProperties = pe(i.catchall, e, {
    ...n,
    path: [...n.path, "additionalProperties"]
  })) : e.io === "output" && (s.additionalProperties = !1);
}, _l = (t, e, r, n) => {
  const s = t._zod.def, i = s.inclusive === !1, o = s.options.map((a, c) => pe(a, e, {
    ...n,
    path: [...n.path, i ? "oneOf" : "anyOf", c]
  }));
  i ? r.oneOf = o : r.anyOf = o;
}, yl = (t, e, r, n) => {
  const s = t._zod.def, i = pe(s.left, e, {
    ...n,
    path: [...n.path, "allOf", 0]
  }), o = pe(s.right, e, {
    ...n,
    path: [...n.path, "allOf", 1]
  }), a = (u) => "allOf" in u && Object.keys(u).length === 1, c = [
    ...a(i) ? i.allOf : [i],
    ...a(o) ? o.allOf : [o]
  ];
  r.allOf = c;
}, El = (t, e, r, n) => {
  const s = r, i = t._zod.def;
  s.type = "object";
  const o = i.keyType, a = o._zod.bag, c = a == null ? void 0 : a.patterns;
  if (i.mode === "loose" && c && c.size > 0) {
    const l = pe(i.valueType, e, {
      ...n,
      path: [...n.path, "patternProperties", "*"]
    });
    s.patternProperties = {};
    for (const h of c)
      s.patternProperties[h.source] = l;
  } else
    (e.target === "draft-07" || e.target === "draft-2020-12") && (s.propertyNames = pe(i.keyType, e, {
      ...n,
      path: [...n.path, "propertyNames"]
    })), s.additionalProperties = pe(i.valueType, e, {
      ...n,
      path: [...n.path, "additionalProperties"]
    });
  const u = o._zod.values;
  if (u) {
    const l = [...u].filter((h) => typeof h == "string" || typeof h == "number");
    l.length > 0 && (s.required = l);
  }
}, vl = (t, e, r, n) => {
  const s = t._zod.def, i = pe(s.innerType, e, n), o = e.seen.get(t);
  e.target === "openapi-3.0" ? (o.ref = s.innerType, r.nullable = !0) : r.anyOf = [i, { type: "null" }];
}, wl = (t, e, r, n) => {
  const s = t._zod.def;
  pe(s.innerType, e, n);
  const i = e.seen.get(t);
  i.ref = s.innerType;
}, bl = (t, e, r, n) => {
  const s = t._zod.def;
  pe(s.innerType, e, n);
  const i = e.seen.get(t);
  i.ref = s.innerType, r.default = JSON.parse(JSON.stringify(s.defaultValue));
}, Tl = (t, e, r, n) => {
  const s = t._zod.def;
  pe(s.innerType, e, n);
  const i = e.seen.get(t);
  i.ref = s.innerType, e.io === "input" && (r._prefault = JSON.parse(JSON.stringify(s.defaultValue)));
}, Sl = (t, e, r, n) => {
  const s = t._zod.def;
  pe(s.innerType, e, n);
  const i = e.seen.get(t);
  i.ref = s.innerType;
  let o;
  try {
    o = s.catchValue(void 0);
  } catch {
    throw new Error("Dynamic catch values are not supported in JSON Schema");
  }
  r.default = o;
}, Ol = (t, e, r, n) => {
  const s = t._zod.def, i = e.io === "input" ? s.in._zod.def.type === "transform" ? s.out : s.in : s.out;
  pe(i, e, n);
  const o = e.seen.get(t);
  o.ref = i;
}, Al = (t, e, r, n) => {
  const s = t._zod.def;
  pe(s.innerType, e, n);
  const i = e.seen.get(t);
  i.ref = s.innerType, r.readOnly = !0;
}, Hi = (t, e, r, n) => {
  const s = t._zod.def;
  pe(s.innerType, e, n);
  const i = e.seen.get(t);
  i.ref = s.innerType;
}, kl = /* @__PURE__ */ R("ZodISODateTime", (t, e) => {
  Ic.init(t, e), re.init(t, e);
});
function Rl(t) {
  return /* @__PURE__ */ Uu(kl, t);
}
const Nl = /* @__PURE__ */ R("ZodISODate", (t, e) => {
  Lc.init(t, e), re.init(t, e);
});
function Il(t) {
  return /* @__PURE__ */ $u(Nl, t);
}
const Ll = /* @__PURE__ */ R("ZodISOTime", (t, e) => {
  Cc.init(t, e), re.init(t, e);
});
function Cl(t) {
  return /* @__PURE__ */ ju(Ll, t);
}
const Pl = /* @__PURE__ */ R("ZodISODuration", (t, e) => {
  Pc.init(t, e), re.init(t, e);
});
function Dl(t) {
  return /* @__PURE__ */ xu(Pl, t);
}
const Ul = (t, e) => {
  Oi.init(t, e), t.name = "ZodError", Object.defineProperties(t, {
    format: {
      value: (r) => Ta(t, r)
      // enumerable: false,
    },
    flatten: {
      value: (r) => ba(t, r)
      // enumerable: false,
    },
    addIssue: {
      value: (r) => {
        t.issues.push(r), t.message = JSON.stringify(t.issues, nn, 2);
      }
      // enumerable: false,
    },
    addIssues: {
      value: (r) => {
        t.issues.push(...r), t.message = JSON.stringify(t.issues, nn, 2);
      }
      // enumerable: false,
    },
    isEmpty: {
      get() {
        return t.issues.length === 0;
      }
      // enumerable: false,
    }
  });
}, Ne = R("ZodError", Ul, {
  Parent: Error
}), $l = /* @__PURE__ */ In(Ne), jl = /* @__PURE__ */ Ln(Ne), xl = /* @__PURE__ */ Or(Ne), Fl = /* @__PURE__ */ Ar(Ne), zl = /* @__PURE__ */ Aa(Ne), Bl = /* @__PURE__ */ ka(Ne), Ml = /* @__PURE__ */ Ra(Ne), Zl = /* @__PURE__ */ Na(Ne), Hl = /* @__PURE__ */ Ia(Ne), ql = /* @__PURE__ */ La(Ne), Wl = /* @__PURE__ */ Ca(Ne), Kl = /* @__PURE__ */ Pa(Ne), ae = /* @__PURE__ */ R("ZodType", (t, e) => (oe.init(t, e), Object.assign(t["~standard"], {
  jsonSchema: {
    input: _r(t, "input"),
    output: _r(t, "output")
  }
}), t.toJSONSchema = il(t, {}), t.def = e, t.type = e.type, Object.defineProperty(t, "_def", { value: e }), t.check = (...r) => t.clone(Ke(e, {
  checks: [
    ...e.checks ?? [],
    ...r.map((n) => typeof n == "function" ? { _zod: { check: n, def: { check: "custom" }, onattach: [] } } : n)
  ]
}), {
  parent: !0
}), t.with = t.check, t.clone = (r, n) => Ve(t, r, n), t.brand = () => t, t.register = (r, n) => (r.add(t, n), t), t.parse = (r, n) => $l(t, r, n, { callee: t.parse }), t.safeParse = (r, n) => xl(t, r, n), t.parseAsync = async (r, n) => jl(t, r, n, { callee: t.parseAsync }), t.safeParseAsync = async (r, n) => Fl(t, r, n), t.spa = t.safeParseAsync, t.encode = (r, n) => zl(t, r, n), t.decode = (r, n) => Bl(t, r, n), t.encodeAsync = async (r, n) => Ml(t, r, n), t.decodeAsync = async (r, n) => Zl(t, r, n), t.safeEncode = (r, n) => Hl(t, r, n), t.safeDecode = (r, n) => ql(t, r, n), t.safeEncodeAsync = async (r, n) => Wl(t, r, n), t.safeDecodeAsync = async (r, n) => Kl(t, r, n), t.refine = (r, n) => t.check(zh(r, n)), t.superRefine = (r) => t.check(Bh(r)), t.overwrite = (r) => t.check(/* @__PURE__ */ St(r)), t.optional = () => Ss(t), t.exactOptional = () => kh(t), t.nullable = () => Os(t), t.nullish = () => Ss(Os(t)), t.nonoptional = (r) => Ph(t, r), t.array = () => Dn(t), t.or = (r) => vh([t, r]), t.and = (r) => bh(t, r), t.transform = (r) => As(t, Oh(r)), t.default = (r) => Ih(t, r), t.prefault = (r) => Ch(t, r), t.catch = (r) => Uh(t, r), t.pipe = (r) => As(t, r), t.readonly = () => xh(t), t.describe = (r) => {
  const n = t.clone();
  return It.add(n, { description: r }), n;
}, Object.defineProperty(t, "description", {
  get() {
    var r;
    return (r = It.get(t)) == null ? void 0 : r.description;
  },
  configurable: !0
}), t.meta = (...r) => {
  if (r.length === 0)
    return It.get(t);
  const n = t.clone();
  return It.add(n, r[0]), n;
}, t.isOptional = () => t.safeParse(void 0).success, t.isNullable = () => t.safeParse(null).success, t.apply = (r) => r(t), t)), qi = /* @__PURE__ */ R("_ZodString", (t, e) => {
  Cn.init(t, e), ae.init(t, e), t._zod.processJSONSchema = (n, s, i) => al(t, n, s);
  const r = t._zod.bag;
  t.format = r.format ?? null, t.minLength = r.minimum ?? null, t.maxLength = r.maximum ?? null, t.regex = (...n) => t.check(/* @__PURE__ */ Hu(...n)), t.includes = (...n) => t.check(/* @__PURE__ */ Ku(...n)), t.startsWith = (...n) => t.check(/* @__PURE__ */ Vu(...n)), t.endsWith = (...n) => t.check(/* @__PURE__ */ Gu(...n)), t.min = (...n) => t.check(/* @__PURE__ */ gr(...n)), t.max = (...n) => t.check(/* @__PURE__ */ Fi(...n)), t.length = (...n) => t.check(/* @__PURE__ */ zi(...n)), t.nonempty = (...n) => t.check(/* @__PURE__ */ gr(1, ...n)), t.lowercase = (n) => t.check(/* @__PURE__ */ qu(n)), t.uppercase = (n) => t.check(/* @__PURE__ */ Wu(n)), t.trim = () => t.check(/* @__PURE__ */ Xu()), t.normalize = (...n) => t.check(/* @__PURE__ */ Ju(...n)), t.toLowerCase = () => t.check(/* @__PURE__ */ Yu()), t.toUpperCase = () => t.check(/* @__PURE__ */ Qu()), t.slugify = () => t.check(/* @__PURE__ */ el());
}), Vl = /* @__PURE__ */ R("ZodString", (t, e) => {
  Cn.init(t, e), qi.init(t, e), t.email = (r) => t.check(/* @__PURE__ */ pu(Gl, r)), t.url = (r) => t.check(/* @__PURE__ */ Eu(Jl, r)), t.jwt = (r) => t.check(/* @__PURE__ */ Du(hh, r)), t.emoji = (r) => t.check(/* @__PURE__ */ vu(Xl, r)), t.guid = (r) => t.check(/* @__PURE__ */ ys(bs, r)), t.uuid = (r) => t.check(/* @__PURE__ */ mu(Yt, r)), t.uuidv4 = (r) => t.check(/* @__PURE__ */ gu(Yt, r)), t.uuidv6 = (r) => t.check(/* @__PURE__ */ _u(Yt, r)), t.uuidv7 = (r) => t.check(/* @__PURE__ */ yu(Yt, r)), t.nanoid = (r) => t.check(/* @__PURE__ */ wu(Yl, r)), t.guid = (r) => t.check(/* @__PURE__ */ ys(bs, r)), t.cuid = (r) => t.check(/* @__PURE__ */ bu(Ql, r)), t.cuid2 = (r) => t.check(/* @__PURE__ */ Tu(eh, r)), t.ulid = (r) => t.check(/* @__PURE__ */ Su(th, r)), t.base64 = (r) => t.check(/* @__PURE__ */ Lu(ch, r)), t.base64url = (r) => t.check(/* @__PURE__ */ Cu(uh, r)), t.xid = (r) => t.check(/* @__PURE__ */ Ou(rh, r)), t.ksuid = (r) => t.check(/* @__PURE__ */ Au(nh, r)), t.ipv4 = (r) => t.check(/* @__PURE__ */ ku(sh, r)), t.ipv6 = (r) => t.check(/* @__PURE__ */ Ru(ih, r)), t.cidrv4 = (r) => t.check(/* @__PURE__ */ Nu(oh, r)), t.cidrv6 = (r) => t.check(/* @__PURE__ */ Iu(ah, r)), t.e164 = (r) => t.check(/* @__PURE__ */ Pu(lh, r)), t.datetime = (r) => t.check(Rl(r)), t.date = (r) => t.check(Il(r)), t.time = (r) => t.check(Cl(r)), t.duration = (r) => t.check(Dl(r));
});
function M(t) {
  return /* @__PURE__ */ fu(Vl, t);
}
const re = /* @__PURE__ */ R("ZodStringFormat", (t, e) => {
  te.init(t, e), qi.init(t, e);
}), Gl = /* @__PURE__ */ R("ZodEmail", (t, e) => {
  wc.init(t, e), re.init(t, e);
}), bs = /* @__PURE__ */ R("ZodGUID", (t, e) => {
  Ec.init(t, e), re.init(t, e);
}), Yt = /* @__PURE__ */ R("ZodUUID", (t, e) => {
  vc.init(t, e), re.init(t, e);
}), Jl = /* @__PURE__ */ R("ZodURL", (t, e) => {
  bc.init(t, e), re.init(t, e);
}), Xl = /* @__PURE__ */ R("ZodEmoji", (t, e) => {
  Tc.init(t, e), re.init(t, e);
}), Yl = /* @__PURE__ */ R("ZodNanoID", (t, e) => {
  Sc.init(t, e), re.init(t, e);
}), Ql = /* @__PURE__ */ R("ZodCUID", (t, e) => {
  Oc.init(t, e), re.init(t, e);
}), eh = /* @__PURE__ */ R("ZodCUID2", (t, e) => {
  Ac.init(t, e), re.init(t, e);
}), th = /* @__PURE__ */ R("ZodULID", (t, e) => {
  kc.init(t, e), re.init(t, e);
}), rh = /* @__PURE__ */ R("ZodXID", (t, e) => {
  Rc.init(t, e), re.init(t, e);
}), nh = /* @__PURE__ */ R("ZodKSUID", (t, e) => {
  Nc.init(t, e), re.init(t, e);
}), sh = /* @__PURE__ */ R("ZodIPv4", (t, e) => {
  Dc.init(t, e), re.init(t, e);
}), ih = /* @__PURE__ */ R("ZodIPv6", (t, e) => {
  Uc.init(t, e), re.init(t, e);
}), oh = /* @__PURE__ */ R("ZodCIDRv4", (t, e) => {
  $c.init(t, e), re.init(t, e);
}), ah = /* @__PURE__ */ R("ZodCIDRv6", (t, e) => {
  jc.init(t, e), re.init(t, e);
}), ch = /* @__PURE__ */ R("ZodBase64", (t, e) => {
  xc.init(t, e), re.init(t, e);
}), uh = /* @__PURE__ */ R("ZodBase64URL", (t, e) => {
  zc.init(t, e), re.init(t, e);
}), lh = /* @__PURE__ */ R("ZodE164", (t, e) => {
  Bc.init(t, e), re.init(t, e);
}), hh = /* @__PURE__ */ R("ZodJWT", (t, e) => {
  Zc.init(t, e), re.init(t, e);
}), Wi = /* @__PURE__ */ R("ZodNumber", (t, e) => {
  Ui.init(t, e), ae.init(t, e), t._zod.processJSONSchema = (n, s, i) => cl(t, n, s), t.gt = (n, s) => t.check(/* @__PURE__ */ vs(n, s)), t.gte = (n, s) => t.check(/* @__PURE__ */ Gr(n, s)), t.min = (n, s) => t.check(/* @__PURE__ */ Gr(n, s)), t.lt = (n, s) => t.check(/* @__PURE__ */ Es(n, s)), t.lte = (n, s) => t.check(/* @__PURE__ */ Vr(n, s)), t.max = (n, s) => t.check(/* @__PURE__ */ Vr(n, s)), t.int = (n) => t.check(Ts(n)), t.safe = (n) => t.check(Ts(n)), t.positive = (n) => t.check(/* @__PURE__ */ vs(0, n)), t.nonnegative = (n) => t.check(/* @__PURE__ */ Gr(0, n)), t.negative = (n) => t.check(/* @__PURE__ */ Es(0, n)), t.nonpositive = (n) => t.check(/* @__PURE__ */ Vr(0, n)), t.multipleOf = (n, s) => t.check(/* @__PURE__ */ ws(n, s)), t.step = (n, s) => t.check(/* @__PURE__ */ ws(n, s)), t.finite = () => t;
  const r = t._zod.bag;
  t.minValue = Math.max(r.minimum ?? Number.NEGATIVE_INFINITY, r.exclusiveMinimum ?? Number.NEGATIVE_INFINITY) ?? null, t.maxValue = Math.min(r.maximum ?? Number.POSITIVE_INFINITY, r.exclusiveMaximum ?? Number.POSITIVE_INFINITY) ?? null, t.isInt = (r.format ?? "").includes("int") || Number.isSafeInteger(r.multipleOf ?? 0.5), t.isFinite = !0, t.format = r.format ?? null;
}), dh = /* @__PURE__ */ R("ZodNumberFormat", (t, e) => {
  Hc.init(t, e), Wi.init(t, e);
});
function Ts(t) {
  return /* @__PURE__ */ zu(dh, t);
}
const fh = /* @__PURE__ */ R("ZodBoolean", (t, e) => {
  qc.init(t, e), ae.init(t, e), t._zod.processJSONSchema = (r, n, s) => ul(t, r, n);
});
function Pn(t) {
  return /* @__PURE__ */ Bu(fh, t);
}
const ph = /* @__PURE__ */ R("ZodUnknown", (t, e) => {
  Wc.init(t, e), ae.init(t, e), t._zod.processJSONSchema = (r, n, s) => hl();
});
function yr() {
  return /* @__PURE__ */ Mu(ph);
}
const mh = /* @__PURE__ */ R("ZodNever", (t, e) => {
  Kc.init(t, e), ae.init(t, e), t._zod.processJSONSchema = (r, n, s) => ll(t, r, n);
});
function gh(t) {
  return /* @__PURE__ */ Zu(mh, t);
}
const _h = /* @__PURE__ */ R("ZodArray", (t, e) => {
  Vc.init(t, e), ae.init(t, e), t._zod.processJSONSchema = (r, n, s) => ml(t, r, n, s), t.element = e.element, t.min = (r, n) => t.check(/* @__PURE__ */ gr(r, n)), t.nonempty = (r) => t.check(/* @__PURE__ */ gr(1, r)), t.max = (r, n) => t.check(/* @__PURE__ */ Fi(r, n)), t.length = (r, n) => t.check(/* @__PURE__ */ zi(r, n)), t.unwrap = () => t.element;
});
function Dn(t, e) {
  return /* @__PURE__ */ tl(_h, t, e);
}
const yh = /* @__PURE__ */ R("ZodObject", (t, e) => {
  Jc.init(t, e), ae.init(t, e), t._zod.processJSONSchema = (r, n, s) => gl(t, r, n, s), G(t, "shape", () => e.shape), t.keyof = () => an(Object.keys(t._zod.def.shape)), t.catchall = (r) => t.clone({ ...t._zod.def, catchall: r }), t.passthrough = () => t.clone({ ...t._zod.def, catchall: yr() }), t.loose = () => t.clone({ ...t._zod.def, catchall: yr() }), t.strict = () => t.clone({ ...t._zod.def, catchall: gh() }), t.strip = () => t.clone({ ...t._zod.def, catchall: void 0 }), t.extend = (r) => _a(t, r), t.safeExtend = (r) => ya(t, r), t.merge = (r) => Ea(t, r), t.pick = (r) => ma(t, r), t.omit = (r) => ga(t, r), t.partial = (...r) => va(Vi, t, r[0]), t.required = (...r) => wa(Gi, t, r[0]);
});
function ee(t, e) {
  const r = {
    type: "object",
    shape: t ?? {},
    ...F(e)
  };
  return new yh(r);
}
const Eh = /* @__PURE__ */ R("ZodUnion", (t, e) => {
  Xc.init(t, e), ae.init(t, e), t._zod.processJSONSchema = (r, n, s) => _l(t, r, n, s), t.options = e.options;
});
function vh(t, e) {
  return new Eh({
    type: "union",
    options: t,
    ...F(e)
  });
}
const wh = /* @__PURE__ */ R("ZodIntersection", (t, e) => {
  Yc.init(t, e), ae.init(t, e), t._zod.processJSONSchema = (r, n, s) => yl(t, r, n, s);
});
function bh(t, e) {
  return new wh({
    type: "intersection",
    left: t,
    right: e
  });
}
const Th = /* @__PURE__ */ R("ZodRecord", (t, e) => {
  Qc.init(t, e), ae.init(t, e), t._zod.processJSONSchema = (r, n, s) => El(t, r, n, s), t.keyType = e.keyType, t.valueType = e.valueType;
});
function Ki(t, e, r) {
  return new Th({
    type: "record",
    keyType: t,
    valueType: e,
    ...F(r)
  });
}
const on = /* @__PURE__ */ R("ZodEnum", (t, e) => {
  eu.init(t, e), ae.init(t, e), t._zod.processJSONSchema = (n, s, i) => dl(t, n, s), t.enum = e.entries, t.options = Object.values(e.entries);
  const r = new Set(Object.keys(e.entries));
  t.extract = (n, s) => {
    const i = {};
    for (const o of n)
      if (r.has(o))
        i[o] = e.entries[o];
      else
        throw new Error(`Key ${o} not found in enum`);
    return new on({
      ...e,
      checks: [],
      ...F(s),
      entries: i
    });
  }, t.exclude = (n, s) => {
    const i = { ...e.entries };
    for (const o of n)
      if (r.has(o))
        delete i[o];
      else
        throw new Error(`Key ${o} not found in enum`);
    return new on({
      ...e,
      checks: [],
      ...F(s),
      entries: i
    });
  };
});
function an(t, e) {
  const r = Array.isArray(t) ? Object.fromEntries(t.map((n) => [n, n])) : t;
  return new on({
    type: "enum",
    entries: r,
    ...F(e)
  });
}
const Sh = /* @__PURE__ */ R("ZodTransform", (t, e) => {
  tu.init(t, e), ae.init(t, e), t._zod.processJSONSchema = (r, n, s) => pl(t, r), t._zod.parse = (r, n) => {
    if (n.direction === "backward")
      throw new Ei(t.constructor.name);
    r.addIssue = (i) => {
      if (typeof i == "string")
        r.issues.push(jt(i, r.value, e));
      else {
        const o = i;
        o.fatal && (o.continue = !1), o.code ?? (o.code = "custom"), o.input ?? (o.input = r.value), o.inst ?? (o.inst = t), r.issues.push(jt(o));
      }
    };
    const s = e.transform(r.value, r);
    return s instanceof Promise ? s.then((i) => (r.value = i, r)) : (r.value = s, r);
  };
});
function Oh(t) {
  return new Sh({
    type: "transform",
    transform: t
  });
}
const Vi = /* @__PURE__ */ R("ZodOptional", (t, e) => {
  xi.init(t, e), ae.init(t, e), t._zod.processJSONSchema = (r, n, s) => Hi(t, r, n, s), t.unwrap = () => t._zod.def.innerType;
});
function Ss(t) {
  return new Vi({
    type: "optional",
    innerType: t
  });
}
const Ah = /* @__PURE__ */ R("ZodExactOptional", (t, e) => {
  ru.init(t, e), ae.init(t, e), t._zod.processJSONSchema = (r, n, s) => Hi(t, r, n, s), t.unwrap = () => t._zod.def.innerType;
});
function kh(t) {
  return new Ah({
    type: "optional",
    innerType: t
  });
}
const Rh = /* @__PURE__ */ R("ZodNullable", (t, e) => {
  nu.init(t, e), ae.init(t, e), t._zod.processJSONSchema = (r, n, s) => vl(t, r, n, s), t.unwrap = () => t._zod.def.innerType;
});
function Os(t) {
  return new Rh({
    type: "nullable",
    innerType: t
  });
}
const Nh = /* @__PURE__ */ R("ZodDefault", (t, e) => {
  su.init(t, e), ae.init(t, e), t._zod.processJSONSchema = (r, n, s) => bl(t, r, n, s), t.unwrap = () => t._zod.def.innerType, t.removeDefault = t.unwrap;
});
function Ih(t, e) {
  return new Nh({
    type: "default",
    innerType: t,
    get defaultValue() {
      return typeof e == "function" ? e() : Ti(e);
    }
  });
}
const Lh = /* @__PURE__ */ R("ZodPrefault", (t, e) => {
  iu.init(t, e), ae.init(t, e), t._zod.processJSONSchema = (r, n, s) => Tl(t, r, n, s), t.unwrap = () => t._zod.def.innerType;
});
function Ch(t, e) {
  return new Lh({
    type: "prefault",
    innerType: t,
    get defaultValue() {
      return typeof e == "function" ? e() : Ti(e);
    }
  });
}
const Gi = /* @__PURE__ */ R("ZodNonOptional", (t, e) => {
  ou.init(t, e), ae.init(t, e), t._zod.processJSONSchema = (r, n, s) => wl(t, r, n, s), t.unwrap = () => t._zod.def.innerType;
});
function Ph(t, e) {
  return new Gi({
    type: "nonoptional",
    innerType: t,
    ...F(e)
  });
}
const Dh = /* @__PURE__ */ R("ZodCatch", (t, e) => {
  au.init(t, e), ae.init(t, e), t._zod.processJSONSchema = (r, n, s) => Sl(t, r, n, s), t.unwrap = () => t._zod.def.innerType, t.removeCatch = t.unwrap;
});
function Uh(t, e) {
  return new Dh({
    type: "catch",
    innerType: t,
    catchValue: typeof e == "function" ? e : () => e
  });
}
const $h = /* @__PURE__ */ R("ZodPipe", (t, e) => {
  cu.init(t, e), ae.init(t, e), t._zod.processJSONSchema = (r, n, s) => Ol(t, r, n, s), t.in = e.in, t.out = e.out;
});
function As(t, e) {
  return new $h({
    type: "pipe",
    in: t,
    out: e
    // ...util.normalizeParams(params),
  });
}
const jh = /* @__PURE__ */ R("ZodReadonly", (t, e) => {
  uu.init(t, e), ae.init(t, e), t._zod.processJSONSchema = (r, n, s) => Al(t, r, n, s), t.unwrap = () => t._zod.def.innerType;
});
function xh(t) {
  return new jh({
    type: "readonly",
    innerType: t
  });
}
const Fh = /* @__PURE__ */ R("ZodCustom", (t, e) => {
  lu.init(t, e), ae.init(t, e), t._zod.processJSONSchema = (r, n, s) => fl(t, r);
});
function zh(t, e = {}) {
  return /* @__PURE__ */ rl(Fh, t, e);
}
function Bh(t) {
  return /* @__PURE__ */ nl(t);
}
function ie(t) {
  return /* @__PURE__ */ Fu(Wi, t);
}
var Jr = { exports: {} }, ks;
function Mh() {
  return ks || (ks = 1, function(t) {
    var e, r, n, s, i, o, a, c, u, l, h, f, d, g, y, I, k, w, S, m, p, E, _, b, O, D, $, H, L, W, q, le;
    (function(j) {
      var he = typeof Zn == "object" ? Zn : typeof self == "object" ? self : typeof this == "object" ? this : {};
      j(be(he, be(t.exports)));
      function be(Re, Be) {
        return Re !== he && (typeof Object.create == "function" ? Object.defineProperty(Re, "__esModule", { value: !0 }) : Re.__esModule = !0), function(v, T) {
          return Re[v] = Be ? Be(v, T) : T;
        };
      }
    })(function(j) {
      var he = Object.setPrototypeOf || { __proto__: [] } instanceof Array && function(v, T) {
        v.__proto__ = T;
      } || function(v, T) {
        for (var A in T) Object.prototype.hasOwnProperty.call(T, A) && (v[A] = T[A]);
      };
      e = function(v, T) {
        if (typeof T != "function" && T !== null)
          throw new TypeError("Class extends value " + String(T) + " is not a constructor or null");
        he(v, T);
        function A() {
          this.constructor = v;
        }
        v.prototype = T === null ? Object.create(T) : (A.prototype = T.prototype, new A());
      }, r = Object.assign || function(v) {
        for (var T, A = 1, N = arguments.length; A < N; A++) {
          T = arguments[A];
          for (var C in T) Object.prototype.hasOwnProperty.call(T, C) && (v[C] = T[C]);
        }
        return v;
      }, n = function(v, T) {
        var A = {};
        for (var N in v) Object.prototype.hasOwnProperty.call(v, N) && T.indexOf(N) < 0 && (A[N] = v[N]);
        if (v != null && typeof Object.getOwnPropertySymbols == "function")
          for (var C = 0, N = Object.getOwnPropertySymbols(v); C < N.length; C++)
            T.indexOf(N[C]) < 0 && Object.prototype.propertyIsEnumerable.call(v, N[C]) && (A[N[C]] = v[N[C]]);
        return A;
      }, s = function(v, T, A, N) {
        var C = arguments.length, P = C < 3 ? T : N === null ? N = Object.getOwnPropertyDescriptor(T, A) : N, z;
        if (typeof Reflect == "object" && typeof Reflect.decorate == "function") P = Reflect.decorate(v, T, A, N);
        else for (var J = v.length - 1; J >= 0; J--) (z = v[J]) && (P = (C < 3 ? z(P) : C > 3 ? z(T, A, P) : z(T, A)) || P);
        return C > 3 && P && Object.defineProperty(T, A, P), P;
      }, i = function(v, T) {
        return function(A, N) {
          T(A, N, v);
        };
      }, o = function(v, T, A, N, C, P) {
        function z(Ge) {
          if (Ge !== void 0 && typeof Ge != "function") throw new TypeError("Function expected");
          return Ge;
        }
        for (var J = N.kind, ve = J === "getter" ? "get" : J === "setter" ? "set" : "value", Z = !T && v ? N.static ? v : v.prototype : null, ce = T || (Z ? Object.getOwnPropertyDescriptor(Z, N.name) : {}), Ee, At = !1, Q = A.length - 1; Q >= 0; Q--) {
          var Oe = {};
          for (var Ie in N) Oe[Ie] = Ie === "access" ? {} : N[Ie];
          for (var Ie in N.access) Oe.access[Ie] = N.access[Ie];
          Oe.addInitializer = function(Ge) {
            if (At) throw new TypeError("Cannot add initializers after decoration has completed");
            P.push(z(Ge || null));
          };
          var $e = (0, A[Q])(J === "accessor" ? { get: ce.get, set: ce.set } : ce[ve], Oe);
          if (J === "accessor") {
            if ($e === void 0) continue;
            if ($e === null || typeof $e != "object") throw new TypeError("Object expected");
            (Ee = z($e.get)) && (ce.get = Ee), (Ee = z($e.set)) && (ce.set = Ee), (Ee = z($e.init)) && C.unshift(Ee);
          } else (Ee = z($e)) && (J === "field" ? C.unshift(Ee) : ce[ve] = Ee);
        }
        Z && Object.defineProperty(Z, N.name, ce), At = !0;
      }, a = function(v, T, A) {
        for (var N = arguments.length > 2, C = 0; C < T.length; C++)
          A = N ? T[C].call(v, A) : T[C].call(v);
        return N ? A : void 0;
      }, c = function(v) {
        return typeof v == "symbol" ? v : "".concat(v);
      }, u = function(v, T, A) {
        return typeof T == "symbol" && (T = T.description ? "[".concat(T.description, "]") : ""), Object.defineProperty(v, "name", { configurable: !0, value: A ? "".concat(A, " ", T) : T });
      }, l = function(v, T) {
        if (typeof Reflect == "object" && typeof Reflect.metadata == "function") return Reflect.metadata(v, T);
      }, h = function(v, T, A, N) {
        function C(P) {
          return P instanceof A ? P : new A(function(z) {
            z(P);
          });
        }
        return new (A || (A = Promise))(function(P, z) {
          function J(ce) {
            try {
              Z(N.next(ce));
            } catch (Ee) {
              z(Ee);
            }
          }
          function ve(ce) {
            try {
              Z(N.throw(ce));
            } catch (Ee) {
              z(Ee);
            }
          }
          function Z(ce) {
            ce.done ? P(ce.value) : C(ce.value).then(J, ve);
          }
          Z((N = N.apply(v, T || [])).next());
        });
      }, f = function(v, T) {
        var A = { label: 0, sent: function() {
          if (P[0] & 1) throw P[1];
          return P[1];
        }, trys: [], ops: [] }, N, C, P, z = Object.create((typeof Iterator == "function" ? Iterator : Object).prototype);
        return z.next = J(0), z.throw = J(1), z.return = J(2), typeof Symbol == "function" && (z[Symbol.iterator] = function() {
          return this;
        }), z;
        function J(Z) {
          return function(ce) {
            return ve([Z, ce]);
          };
        }
        function ve(Z) {
          if (N) throw new TypeError("Generator is already executing.");
          for (; z && (z = 0, Z[0] && (A = 0)), A; ) try {
            if (N = 1, C && (P = Z[0] & 2 ? C.return : Z[0] ? C.throw || ((P = C.return) && P.call(C), 0) : C.next) && !(P = P.call(C, Z[1])).done) return P;
            switch (C = 0, P && (Z = [Z[0] & 2, P.value]), Z[0]) {
              case 0:
              case 1:
                P = Z;
                break;
              case 4:
                return A.label++, { value: Z[1], done: !1 };
              case 5:
                A.label++, C = Z[1], Z = [0];
                continue;
              case 7:
                Z = A.ops.pop(), A.trys.pop();
                continue;
              default:
                if (P = A.trys, !(P = P.length > 0 && P[P.length - 1]) && (Z[0] === 6 || Z[0] === 2)) {
                  A = 0;
                  continue;
                }
                if (Z[0] === 3 && (!P || Z[1] > P[0] && Z[1] < P[3])) {
                  A.label = Z[1];
                  break;
                }
                if (Z[0] === 6 && A.label < P[1]) {
                  A.label = P[1], P = Z;
                  break;
                }
                if (P && A.label < P[2]) {
                  A.label = P[2], A.ops.push(Z);
                  break;
                }
                P[2] && A.ops.pop(), A.trys.pop();
                continue;
            }
            Z = T.call(v, A);
          } catch (ce) {
            Z = [6, ce], C = 0;
          } finally {
            N = P = 0;
          }
          if (Z[0] & 5) throw Z[1];
          return { value: Z[0] ? Z[1] : void 0, done: !0 };
        }
      }, d = function(v, T) {
        for (var A in v) A !== "default" && !Object.prototype.hasOwnProperty.call(T, A) && L(T, v, A);
      }, L = Object.create ? function(v, T, A, N) {
        N === void 0 && (N = A);
        var C = Object.getOwnPropertyDescriptor(T, A);
        (!C || ("get" in C ? !T.__esModule : C.writable || C.configurable)) && (C = { enumerable: !0, get: function() {
          return T[A];
        } }), Object.defineProperty(v, N, C);
      } : function(v, T, A, N) {
        N === void 0 && (N = A), v[N] = T[A];
      }, g = function(v) {
        var T = typeof Symbol == "function" && Symbol.iterator, A = T && v[T], N = 0;
        if (A) return A.call(v);
        if (v && typeof v.length == "number") return {
          next: function() {
            return v && N >= v.length && (v = void 0), { value: v && v[N++], done: !v };
          }
        };
        throw new TypeError(T ? "Object is not iterable." : "Symbol.iterator is not defined.");
      }, y = function(v, T) {
        var A = typeof Symbol == "function" && v[Symbol.iterator];
        if (!A) return v;
        var N = A.call(v), C, P = [], z;
        try {
          for (; (T === void 0 || T-- > 0) && !(C = N.next()).done; ) P.push(C.value);
        } catch (J) {
          z = { error: J };
        } finally {
          try {
            C && !C.done && (A = N.return) && A.call(N);
          } finally {
            if (z) throw z.error;
          }
        }
        return P;
      }, I = function() {
        for (var v = [], T = 0; T < arguments.length; T++)
          v = v.concat(y(arguments[T]));
        return v;
      }, k = function() {
        for (var v = 0, T = 0, A = arguments.length; T < A; T++) v += arguments[T].length;
        for (var N = Array(v), C = 0, T = 0; T < A; T++)
          for (var P = arguments[T], z = 0, J = P.length; z < J; z++, C++)
            N[C] = P[z];
        return N;
      }, w = function(v, T, A) {
        if (A || arguments.length === 2) for (var N = 0, C = T.length, P; N < C; N++)
          (P || !(N in T)) && (P || (P = Array.prototype.slice.call(T, 0, N)), P[N] = T[N]);
        return v.concat(P || Array.prototype.slice.call(T));
      }, S = function(v) {
        return this instanceof S ? (this.v = v, this) : new S(v);
      }, m = function(v, T, A) {
        if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
        var N = A.apply(v, T || []), C, P = [];
        return C = Object.create((typeof AsyncIterator == "function" ? AsyncIterator : Object).prototype), J("next"), J("throw"), J("return", z), C[Symbol.asyncIterator] = function() {
          return this;
        }, C;
        function z(Q) {
          return function(Oe) {
            return Promise.resolve(Oe).then(Q, Ee);
          };
        }
        function J(Q, Oe) {
          N[Q] && (C[Q] = function(Ie) {
            return new Promise(function($e, Ge) {
              P.push([Q, Ie, $e, Ge]) > 1 || ve(Q, Ie);
            });
          }, Oe && (C[Q] = Oe(C[Q])));
        }
        function ve(Q, Oe) {
          try {
            Z(N[Q](Oe));
          } catch (Ie) {
            At(P[0][3], Ie);
          }
        }
        function Z(Q) {
          Q.value instanceof S ? Promise.resolve(Q.value.v).then(ce, Ee) : At(P[0][2], Q);
        }
        function ce(Q) {
          ve("next", Q);
        }
        function Ee(Q) {
          ve("throw", Q);
        }
        function At(Q, Oe) {
          Q(Oe), P.shift(), P.length && ve(P[0][0], P[0][1]);
        }
      }, p = function(v) {
        var T, A;
        return T = {}, N("next"), N("throw", function(C) {
          throw C;
        }), N("return"), T[Symbol.iterator] = function() {
          return this;
        }, T;
        function N(C, P) {
          T[C] = v[C] ? function(z) {
            return (A = !A) ? { value: S(v[C](z)), done: !1 } : P ? P(z) : z;
          } : P;
        }
      }, E = function(v) {
        if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
        var T = v[Symbol.asyncIterator], A;
        return T ? T.call(v) : (v = typeof g == "function" ? g(v) : v[Symbol.iterator](), A = {}, N("next"), N("throw"), N("return"), A[Symbol.asyncIterator] = function() {
          return this;
        }, A);
        function N(P) {
          A[P] = v[P] && function(z) {
            return new Promise(function(J, ve) {
              z = v[P](z), C(J, ve, z.done, z.value);
            });
          };
        }
        function C(P, z, J, ve) {
          Promise.resolve(ve).then(function(Z) {
            P({ value: Z, done: J });
          }, z);
        }
      }, _ = function(v, T) {
        return Object.defineProperty ? Object.defineProperty(v, "raw", { value: T }) : v.raw = T, v;
      };
      var be = Object.create ? function(v, T) {
        Object.defineProperty(v, "default", { enumerable: !0, value: T });
      } : function(v, T) {
        v.default = T;
      }, Re = function(v) {
        return Re = Object.getOwnPropertyNames || function(T) {
          var A = [];
          for (var N in T) Object.prototype.hasOwnProperty.call(T, N) && (A[A.length] = N);
          return A;
        }, Re(v);
      };
      b = function(v) {
        if (v && v.__esModule) return v;
        var T = {};
        if (v != null) for (var A = Re(v), N = 0; N < A.length; N++) A[N] !== "default" && L(T, v, A[N]);
        return be(T, v), T;
      }, O = function(v) {
        return v && v.__esModule ? v : { default: v };
      }, D = function(v, T, A, N) {
        if (A === "a" && !N) throw new TypeError("Private accessor was defined without a getter");
        if (typeof T == "function" ? v !== T || !N : !T.has(v)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
        return A === "m" ? N : A === "a" ? N.call(v) : N ? N.value : T.get(v);
      }, $ = function(v, T, A, N, C) {
        if (N === "m") throw new TypeError("Private method is not writable");
        if (N === "a" && !C) throw new TypeError("Private accessor was defined without a setter");
        if (typeof T == "function" ? v !== T || !C : !T.has(v)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
        return N === "a" ? C.call(v, A) : C ? C.value = A : T.set(v, A), A;
      }, H = function(v, T) {
        if (T === null || typeof T != "object" && typeof T != "function") throw new TypeError("Cannot use 'in' operator on non-object");
        return typeof v == "function" ? T === v : v.has(T);
      }, W = function(v, T, A) {
        if (T != null) {
          if (typeof T != "object" && typeof T != "function") throw new TypeError("Object expected.");
          var N, C;
          if (A) {
            if (!Symbol.asyncDispose) throw new TypeError("Symbol.asyncDispose is not defined.");
            N = T[Symbol.asyncDispose];
          }
          if (N === void 0) {
            if (!Symbol.dispose) throw new TypeError("Symbol.dispose is not defined.");
            N = T[Symbol.dispose], A && (C = N);
          }
          if (typeof N != "function") throw new TypeError("Object not disposable.");
          C && (N = function() {
            try {
              C.call(this);
            } catch (P) {
              return Promise.reject(P);
            }
          }), v.stack.push({ value: T, dispose: N, async: A });
        } else A && v.stack.push({ async: !0 });
        return T;
      };
      var Be = typeof SuppressedError == "function" ? SuppressedError : function(v, T, A) {
        var N = new Error(A);
        return N.name = "SuppressedError", N.error = v, N.suppressed = T, N;
      };
      q = function(v) {
        function T(P) {
          v.error = v.hasError ? new Be(P, v.error, "An error was suppressed during disposal.") : P, v.hasError = !0;
        }
        var A, N = 0;
        function C() {
          for (; A = v.stack.pop(); )
            try {
              if (!A.async && N === 1) return N = 0, v.stack.push(A), Promise.resolve().then(C);
              if (A.dispose) {
                var P = A.dispose.call(A.value);
                if (A.async) return N |= 2, Promise.resolve(P).then(C, function(z) {
                  return T(z), C();
                });
              } else N |= 1;
            } catch (z) {
              T(z);
            }
          if (N === 1) return v.hasError ? Promise.reject(v.error) : Promise.resolve();
          if (v.hasError) throw v.error;
        }
        return C();
      }, le = function(v, T) {
        return typeof v == "string" && /^\.\.?\//.test(v) ? v.replace(/\.(tsx)$|((?:\.d)?)((?:\.[^./]+?)?)\.([cm]?)ts$/i, function(A, N, C, P, z) {
          return N ? T ? ".jsx" : ".js" : C && (!P || !z) ? A : C + P + "." + z.toLowerCase() + "js";
        }) : v;
      }, j("__extends", e), j("__assign", r), j("__rest", n), j("__decorate", s), j("__param", i), j("__esDecorate", o), j("__runInitializers", a), j("__propKey", c), j("__setFunctionName", u), j("__metadata", l), j("__awaiter", h), j("__generator", f), j("__exportStar", d), j("__createBinding", L), j("__values", g), j("__read", y), j("__spread", I), j("__spreadArrays", k), j("__spreadArray", w), j("__await", S), j("__asyncGenerator", m), j("__asyncDelegator", p), j("__asyncValues", E), j("__makeTemplateObject", _), j("__importStar", b), j("__importDefault", O), j("__classPrivateFieldGet", D), j("__classPrivateFieldSet", $), j("__classPrivateFieldIn", H), j("__addDisposableResource", W), j("__disposeResources", q), j("__rewriteRelativeImportExtension", le);
    });
  }(Jr)), Jr.exports;
}
var Zh = /* @__PURE__ */ Mh();
const Hh = /* @__PURE__ */ pi(Zh), {
  __extends: qm,
  __assign: Wm,
  __rest: Rr,
  __decorate: Km,
  __param: Vm,
  __esDecorate: Gm,
  __runInitializers: Jm,
  __propKey: Xm,
  __setFunctionName: Ym,
  __metadata: Qm,
  __awaiter: qh,
  __generator: eg,
  __exportStar: tg,
  __createBinding: rg,
  __values: ng,
  __read: sg,
  __spread: ig,
  __spreadArrays: og,
  __spreadArray: ag,
  __await: cg,
  __asyncGenerator: ug,
  __asyncDelegator: lg,
  __asyncValues: hg,
  __makeTemplateObject: dg,
  __importStar: fg,
  __importDefault: pg,
  __classPrivateFieldGet: mg,
  __classPrivateFieldSet: gg,
  __classPrivateFieldIn: _g,
  __addDisposableResource: yg,
  __disposeResources: Eg,
  __rewriteRelativeImportExtension: vg
} = Hh, Wh = (t) => t ? (...e) => t(...e) : (...e) => fetch(...e);
class Un extends Error {
  constructor(e, r = "FunctionsError", n) {
    super(e), this.name = r, this.context = n;
  }
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      context: this.context
    };
  }
}
class Kh extends Un {
  constructor(e) {
    super("Failed to send a request to the Edge Function", "FunctionsFetchError", e);
  }
}
class Rs extends Un {
  constructor(e) {
    super("Relay Error invoking the Edge Function", "FunctionsRelayError", e);
  }
}
class Ns extends Un {
  constructor(e) {
    super("Edge Function returned a non-2xx status code", "FunctionsHttpError", e);
  }
}
var cn;
(function(t) {
  t.Any = "any", t.ApNortheast1 = "ap-northeast-1", t.ApNortheast2 = "ap-northeast-2", t.ApSouth1 = "ap-south-1", t.ApSoutheast1 = "ap-southeast-1", t.ApSoutheast2 = "ap-southeast-2", t.CaCentral1 = "ca-central-1", t.EuCentral1 = "eu-central-1", t.EuWest1 = "eu-west-1", t.EuWest2 = "eu-west-2", t.EuWest3 = "eu-west-3", t.SaEast1 = "sa-east-1", t.UsEast1 = "us-east-1", t.UsWest1 = "us-west-1", t.UsWest2 = "us-west-2";
})(cn || (cn = {}));
class Vh {
  /**
   * Creates a new Functions client bound to an Edge Functions URL.
   *
   * @example Using supabase-js (recommended)
   * ```ts
   * import { createClient } from '@supabase/supabase-js'
   *
   * const supabase = createClient('https://xyzcompany.supabase.co', 'publishable-or-anon-key')
   * const { data, error } = await supabase.functions.invoke('hello-world')
   * ```
   *
   * @category Functions
   *
   * @example Standalone import for bundle-sensitive environments
   * ```ts
   * import { FunctionsClient, FunctionRegion } from '@supabase/functions-js'
   *
   * const functions = new FunctionsClient('https://xyzcompany.supabase.co/functions/v1', {
   *   headers: { apikey: 'publishable-or-anon-key' },
   *   region: FunctionRegion.UsEast1,
   * })
   * ```
   */
  constructor(e, { headers: r = {}, customFetch: n, region: s = cn.Any } = {}) {
    this.url = e, this.headers = r, this.region = s, this.fetch = Wh(n);
  }
  /**
   * Updates the authorization header
   * @param token - the new jwt token sent in the authorisation header
   *
   * @category Functions
   *
   * @example Setting the authorization header
   * ```ts
   * functions.setAuth(session.access_token)
   * ```
   */
  setAuth(e) {
    this.headers.Authorization = `Bearer ${e}`;
  }
  /**
   * Invokes a function
   * @param functionName - The name of the Function to invoke.
   * @param options - Options for invoking the Function.
   * @example
   * ```ts
   * const { data, error } = await functions.invoke('hello-world', {
   *   body: { name: 'Ada' },
   * })
   * ```
   *
   * @category Functions
   *
   * @remarks
   * - Requires an Authorization header.
   * - Invoke params generally match the [Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API) spec.
   * - When you pass in a body to your function, we automatically attach the Content-Type header for `Blob`, `ArrayBuffer`, `File`, `FormData` and `String`. If it doesn't match any of these types we assume the payload is `json`, serialize it and attach the `Content-Type` header as `application/json`. You can override this behavior by passing in a `Content-Type` header of your own.
   * - Responses are automatically parsed as `json`, `blob` and `form-data` depending on the `Content-Type` header sent by your function. Responses are parsed as `text` by default.
   *
   * @example Basic invocation
   * ```js
   * const { data, error } = await supabase.functions.invoke('hello', {
   *   body: { foo: 'bar' }
   * })
   * ```
   *
   * @exampleDescription Error handling
   * A `FunctionsHttpError` error is returned if your function throws an error, `FunctionsRelayError` if the Supabase Relay has an error processing your function and `FunctionsFetchError` if there is a network error in calling your function.
   *
   * @example Error handling
   * ```js
   * import { FunctionsHttpError, FunctionsRelayError, FunctionsFetchError } from "@supabase/supabase-js";
   *
   * const { data, error } = await supabase.functions.invoke('hello', {
   *   headers: {
   *     "my-custom-header": 'my-custom-header-value'
   *   },
   *   body: { foo: 'bar' }
   * })
   *
   * if (error instanceof FunctionsHttpError) {
   *   const errorMessage = await error.context.json()
   *   console.log('Function returned an error', errorMessage)
   * } else if (error instanceof FunctionsRelayError) {
   *   console.log('Relay error:', error.message)
   * } else if (error instanceof FunctionsFetchError) {
   *   console.log('Fetch error:', error.message)
   * }
   * ```
   *
   * @exampleDescription Passing custom headers
   * You can pass custom headers to your function. Note: supabase-js automatically passes the `Authorization` header with the signed in user's JWT.
   *
   * @example Passing custom headers
   * ```js
   * const { data, error } = await supabase.functions.invoke('hello', {
   *   headers: {
   *     "my-custom-header": 'my-custom-header-value'
   *   },
   *   body: { foo: 'bar' }
   * })
   * ```
   *
   * @exampleDescription Calling with DELETE HTTP verb
   * You can also set the HTTP verb to `DELETE` when calling your Edge Function.
   *
   * @example Calling with DELETE HTTP verb
   * ```js
   * const { data, error } = await supabase.functions.invoke('hello', {
   *   headers: {
   *     "my-custom-header": 'my-custom-header-value'
   *   },
   *   body: { foo: 'bar' },
   *   method: 'DELETE'
   * })
   * ```
   *
   * @exampleDescription Invoking a Function in the UsEast1 region
   * Here are the available regions:
   * - `FunctionRegion.Any`
   * - `FunctionRegion.ApNortheast1`
   * - `FunctionRegion.ApNortheast2`
   * - `FunctionRegion.ApSouth1`
   * - `FunctionRegion.ApSoutheast1`
   * - `FunctionRegion.ApSoutheast2`
   * - `FunctionRegion.CaCentral1`
   * - `FunctionRegion.EuCentral1`
   * - `FunctionRegion.EuWest1`
   * - `FunctionRegion.EuWest2`
   * - `FunctionRegion.EuWest3`
   * - `FunctionRegion.SaEast1`
   * - `FunctionRegion.UsEast1`
   * - `FunctionRegion.UsWest1`
   * - `FunctionRegion.UsWest2`
   *
   * @example Invoking a Function in the UsEast1 region
   * ```js
   * import { createClient, FunctionRegion } from '@supabase/supabase-js'
   *
   * const { data, error } = await supabase.functions.invoke('hello', {
   *   body: { foo: 'bar' },
   *   region: FunctionRegion.UsEast1
   * })
   * ```
   *
   * @exampleDescription Calling with GET HTTP verb
   * You can also set the HTTP verb to `GET` when calling your Edge Function.
   *
   * @example Calling with GET HTTP verb
   * ```js
   * const { data, error } = await supabase.functions.invoke('hello', {
   *   headers: {
   *     "my-custom-header": 'my-custom-header-value'
   *   },
   *   method: 'GET'
   * })
   * ```
   *
   * @example Example 7
   * ```ts
   * const { data, error } = await functions.invoke('hello-world', {
   *   body: { name: 'Ada' },
   * })
   * ```
   */
  invoke(e) {
    return qh(this, arguments, void 0, function* (r, n = {}) {
      var s;
      let i, o;
      try {
        const { headers: a, method: c, body: u, signal: l, timeout: h } = n;
        let f = {}, { region: d } = n;
        d || (d = this.region);
        const g = new URL(`${this.url}/${r}`);
        d && d !== "any" && (f["x-region"] = d, g.searchParams.set("forceFunctionRegion", d));
        let y;
        u && (a && !Object.prototype.hasOwnProperty.call(a, "Content-Type") || !a) ? typeof Blob < "u" && u instanceof Blob || u instanceof ArrayBuffer ? (f["Content-Type"] = "application/octet-stream", y = u) : typeof u == "string" ? (f["Content-Type"] = "text/plain", y = u) : typeof FormData < "u" && u instanceof FormData ? y = u : (f["Content-Type"] = "application/json", y = JSON.stringify(u)) : u && typeof u != "string" && !(typeof Blob < "u" && u instanceof Blob) && !(u instanceof ArrayBuffer) && !(typeof FormData < "u" && u instanceof FormData) ? y = JSON.stringify(u) : y = u;
        let I = l;
        h && (o = new AbortController(), i = setTimeout(() => o.abort(), h), l ? (I = o.signal, l.addEventListener("abort", () => o.abort())) : I = o.signal);
        const k = yield this.fetch(g.toString(), {
          method: c || "POST",
          // headers priority is (high to low):
          // 1. invoke-level headers
          // 2. client-level headers
          // 3. default Content-Type header
          headers: Object.assign(Object.assign(Object.assign({}, f), this.headers), a),
          body: y,
          signal: I
        }).catch((p) => {
          throw new Kh(p);
        }), w = k.headers.get("x-relay-error");
        if (w && w === "true")
          throw new Rs(k);
        if (!k.ok)
          throw new Ns(k);
        let S = ((s = k.headers.get("Content-Type")) !== null && s !== void 0 ? s : "text/plain").split(";")[0].trim(), m;
        return S === "application/json" ? m = yield k.json() : S === "application/octet-stream" || S === "application/pdf" ? m = yield k.blob() : S === "text/event-stream" ? m = k : S === "multipart/form-data" ? m = yield k.formData() : m = yield k.text(), { data: m, error: null, response: k };
      } catch (a) {
        return {
          data: null,
          error: a,
          response: a instanceof Ns || a instanceof Rs ? a.context : void 0
        };
      } finally {
        i && clearTimeout(i);
      }
    });
  }
}
const Ji = 3, Is = (t) => Math.min(1e3 * 2 ** t, 3e4), Gh = [520, 503], Xi = [
  "GET",
  "HEAD",
  "OPTIONS"
];
var Jh = class extends Error {
  /**
  * @example
  * ```ts
  * import PostgrestError from '@supabase/postgrest-js'
  *
  * throw new PostgrestError({
  *   message: 'Row level security prevented the request',
  *   details: 'RLS denied the insert',
  *   hint: 'Check your policies',
  *   code: 'PGRST301',
  * })
  * ```
  */
  constructor(t) {
    super(t.message), this.name = "PostgrestError", this.details = t.details, this.hint = t.hint, this.code = t.code;
  }
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      details: this.details,
      hint: this.hint,
      code: this.code
    };
  }
};
function Ls(t, e) {
  return new Promise((r) => {
    if (e != null && e.aborted) {
      r();
      return;
    }
    const n = setTimeout(() => {
      e == null || e.removeEventListener("abort", s), r();
    }, t);
    function s() {
      clearTimeout(n), r();
    }
    e == null || e.addEventListener("abort", s);
  });
}
function Xh(t, e, r, n) {
  return !(!n || r >= Ji || !Xi.includes(t) || !Gh.includes(e));
}
var Yh = class {
  /**
  * Creates a builder configured for a specific PostgREST request.
  *
  * @example Using supabase-js (recommended)
  * ```ts
  * import { createClient } from '@supabase/supabase-js'
  *
  * const supabase = createClient('https://xyzcompany.supabase.co', 'publishable-or-anon-key')
  * const { data, error } = await supabase.from('users').select('*')
  * ```
  *
  * @category Database
  *
  * @example Standalone import for bundle-sensitive environments
  * ```ts
  * import { PostgrestQueryBuilder } from '@supabase/postgrest-js'
  *
  * const builder = new PostgrestQueryBuilder(
  *   new URL('https://xyzcompany.supabase.co/rest/v1/users'),
  *   { headers: new Headers({ apikey: 'publishable-or-anon-key' }) }
  * )
  * ```
  */
  constructor(t) {
    var e, r, n, s, i;
    this.shouldThrowOnError = !1, this.retryEnabled = !0, this.method = t.method, this.url = t.url, this.headers = new Headers(t.headers), this.schema = t.schema, this.body = t.body, this.shouldThrowOnError = (e = t.shouldThrowOnError) !== null && e !== void 0 ? e : !1, this.signal = t.signal, this.isMaybeSingle = (r = t.isMaybeSingle) !== null && r !== void 0 ? r : !1, this.shouldStripNulls = (n = t.shouldStripNulls) !== null && n !== void 0 ? n : !1, this.urlLengthLimit = (s = t.urlLengthLimit) !== null && s !== void 0 ? s : 8e3, this.retryEnabled = (i = t.retry) !== null && i !== void 0 ? i : !0, t.fetch ? this.fetch = t.fetch : this.fetch = fetch;
  }
  /**
  * If there's an error with the query, throwOnError will reject the promise by
  * throwing the error instead of returning it as part of a successful response.
  *
  * {@link https://github.com/supabase/supabase-js/issues/92}
  *
  * @category Database
  */
  throwOnError() {
    return this.shouldThrowOnError = !0, this;
  }
  /**
  * Strip null values from the response data. Properties with `null` values
  * will be omitted from the returned JSON objects.
  *
  * Requires PostgREST 11.2.0+.
  *
  * {@link https://docs.postgrest.org/en/stable/references/api/resource_representation.html#stripped-nulls}
  *
  * @category Database
  *
  * @example With `select()`
  * ```ts
  * const { data, error } = await supabase
  *   .from('characters')
  *   .select()
  *   .stripNulls()
  * ```
  *
  * @exampleSql With `select()`
  * ```sql
  * create table
  *   characters (id int8 primary key, name text, bio text);
  *
  * insert into
  *   characters (id, name, bio)
  * values
  *   (1, 'Luke', null),
  *   (2, 'Leia', 'Princess of Alderaan');
  * ```
  *
  * @exampleResponse With `select()`
  * ```json
  * {
  *   "data": [
  *     {
  *       "id": 1,
  *       "name": "Luke"
  *     },
  *     {
  *       "id": 2,
  *       "name": "Leia",
  *       "bio": "Princess of Alderaan"
  *     }
  *   ],
  *   "status": 200,
  *   "statusText": "OK"
  * }
  * ```
  */
  stripNulls() {
    if (this.headers.get("Accept") === "text/csv") throw new Error("stripNulls() cannot be used with csv()");
    return this.shouldStripNulls = !0, this;
  }
  /**
  * Set an HTTP header for the request.
  *
  * @category Database
  */
  setHeader(t, e) {
    return this.headers = new Headers(this.headers), this.headers.set(t, e), this;
  }
  /**
  * @category Database
  *
  * Configure retry behavior for this request.
  *
  * By default, retries are enabled for idempotent requests (GET, HEAD, OPTIONS)
  * that fail with network errors or specific HTTP status codes (503, 520).
  * Retries use exponential backoff (1s, 2s, 4s) with a maximum of 3 attempts.
  *
  * @param enabled - Whether to enable retries for this request
  *
  * @example
  * ```ts
  * // Disable retries for a specific query
  * const { data, error } = await supabase
  *   .from('users')
  *   .select()
  *   .retry(false)
  * ```
  */
  retry(t) {
    return this.retryEnabled = t, this;
  }
  then(t, e) {
    var r = this;
    if (this.schema === void 0 || (["GET", "HEAD"].includes(this.method) ? this.headers.set("Accept-Profile", this.schema) : this.headers.set("Content-Profile", this.schema)), this.method !== "GET" && this.method !== "HEAD" && this.headers.set("Content-Type", "application/json"), this.shouldStripNulls) {
      const o = this.headers.get("Accept");
      o === "application/vnd.pgrst.object+json" ? this.headers.set("Accept", "application/vnd.pgrst.object+json;nulls=stripped") : (!o || o === "application/json") && this.headers.set("Accept", "application/vnd.pgrst.array+json;nulls=stripped");
    }
    const n = this.fetch;
    let i = (async () => {
      let o = 0;
      for (; ; ) {
        const u = new Headers(r.headers);
        o > 0 && u.set("X-Retry-Count", String(o));
        let l;
        try {
          l = await n(r.url.toString(), {
            method: r.method,
            headers: u,
            body: JSON.stringify(r.body, (h, f) => typeof f == "bigint" ? f.toString() : f),
            signal: r.signal
          });
        } catch (h) {
          if ((h == null ? void 0 : h.name) === "AbortError" || (h == null ? void 0 : h.code) === "ABORT_ERR" || !Xi.includes(r.method)) throw h;
          if (r.retryEnabled && o < Ji) {
            const f = Is(o);
            o++, await Ls(f, r.signal);
            continue;
          }
          throw h;
        }
        if (Xh(r.method, l.status, o, r.retryEnabled)) {
          var a, c;
          const h = (a = (c = l.headers) === null || c === void 0 ? void 0 : c.get("Retry-After")) !== null && a !== void 0 ? a : null, f = h !== null ? Math.max(0, parseInt(h, 10) || 0) * 1e3 : Is(o);
          await l.text(), o++, await Ls(f, r.signal);
          continue;
        }
        return await r.processResponse(l);
      }
    })();
    return this.shouldThrowOnError || (i = i.catch((o) => {
      var a;
      let c = "", u = "", l = "";
      const h = o == null ? void 0 : o.cause;
      if (h) {
        var f, d, g, y;
        const w = (f = h == null ? void 0 : h.message) !== null && f !== void 0 ? f : "", S = (d = h == null ? void 0 : h.code) !== null && d !== void 0 ? d : "";
        c = `${(g = o == null ? void 0 : o.name) !== null && g !== void 0 ? g : "FetchError"}: ${o == null ? void 0 : o.message}`, c += `

Caused by: ${(y = h == null ? void 0 : h.name) !== null && y !== void 0 ? y : "Error"}: ${w}`, S && (c += ` (${S})`), h != null && h.stack && (c += `
${h.stack}`);
      } else {
        var I;
        c = (I = o == null ? void 0 : o.stack) !== null && I !== void 0 ? I : "";
      }
      const k = this.url.toString().length;
      return (o == null ? void 0 : o.name) === "AbortError" || (o == null ? void 0 : o.code) === "ABORT_ERR" ? (l = "", u = "Request was aborted (timeout or manual cancellation)", k > this.urlLengthLimit && (u += `. Note: Your request URL is ${k} characters, which may exceed server limits. If selecting many fields, consider using views. If filtering with large arrays (e.g., .in('id', [many IDs])), consider using an RPC function to pass values server-side.`)) : ((h == null ? void 0 : h.name) === "HeadersOverflowError" || (h == null ? void 0 : h.code) === "UND_ERR_HEADERS_OVERFLOW") && (l = "", u = "HTTP headers exceeded server limits (typically 16KB)", k > this.urlLengthLimit && (u += `. Your request URL is ${k} characters. If selecting many fields, consider using views. If filtering with large arrays (e.g., .in('id', [200+ IDs])), consider using an RPC function instead.`)), {
        success: !1,
        error: {
          message: `${(a = o == null ? void 0 : o.name) !== null && a !== void 0 ? a : "FetchError"}: ${o == null ? void 0 : o.message}`,
          details: c,
          hint: u,
          code: l
        },
        data: null,
        count: null,
        status: 0,
        statusText: ""
      };
    })), i.then(t, e);
  }
  /**
  * Process a fetch response and return the standardized postgrest response.
  */
  async processResponse(t) {
    var e = this;
    let r = null, n = null, s = null, i = t.status, o = t.statusText;
    if (t.ok) {
      var a, c;
      if (e.method !== "HEAD") {
        var u;
        const f = await t.text();
        f === "" || (e.headers.get("Accept") === "text/csv" || e.headers.get("Accept") && (!((u = e.headers.get("Accept")) === null || u === void 0) && u.includes("application/vnd.pgrst.plan+text")) ? n = f : n = JSON.parse(f));
      }
      const l = (a = e.headers.get("Prefer")) === null || a === void 0 ? void 0 : a.match(/count=(exact|planned|estimated)/), h = (c = t.headers.get("content-range")) === null || c === void 0 ? void 0 : c.split("/");
      l && h && h.length > 1 && (s = parseInt(h[1])), e.isMaybeSingle && Array.isArray(n) && (n.length > 1 ? (r = {
        code: "PGRST116",
        details: `Results contain ${n.length} rows, application/vnd.pgrst.object+json requires 1 row`,
        hint: null,
        message: "JSON object requested, multiple (or no) rows returned"
      }, n = null, s = null, i = 406, o = "Not Acceptable") : n.length === 1 ? n = n[0] : n = null);
    } else {
      const l = await t.text();
      try {
        r = JSON.parse(l), Array.isArray(r) && t.status === 404 && (n = [], r = null, i = 200, o = "OK");
      } catch {
        t.status === 404 && l === "" ? (i = 204, o = "No Content") : r = { message: l };
      }
      if (r && e.shouldThrowOnError) throw new Jh(r);
    }
    return {
      success: r === null,
      error: r,
      data: n,
      count: s,
      status: i,
      statusText: o
    };
  }
  /**
  * Override the type of the returned `data`.
  *
  * @typeParam NewResult - The new result type to override with
  * @deprecated Use overrideTypes<yourType, { merge: false }>() method at the end of your call chain instead
  *
  * @category Database
  */
  returns() {
    return this;
  }
  /**
  * Override the type of the returned `data` field in the response.
  *
  * @typeParam NewResult - The new type to cast the response data to
  * @typeParam Options - Optional type configuration (defaults to { merge: true })
  * @typeParam Options.merge - When true, merges the new type with existing return type. When false, replaces the existing types entirely (defaults to true)
  * @example
  * ```typescript
  * // Merge with existing types (default behavior)
  * const query = supabase
  *   .from('users')
  *   .select()
  *   .overrideTypes<{ custom_field: string }>()
  *
  * // Replace existing types completely
  * const replaceQuery = supabase
  *   .from('users')
  *   .select()
  *   .overrideTypes<{ id: number; name: string }, { merge: false }>()
  * ```
  * @returns A PostgrestBuilder instance with the new type
  *
  * @category Database
  *
  * @example Complete Override type of successful response
  * ```ts
  * const { data } = await supabase
  *   .from('countries')
  *   .select()
  *   .overrideTypes<Array<MyType>, { merge: false }>()
  * ```
  *
  * @exampleResponse Complete Override type of successful response
  * ```ts
  * let x: typeof data // MyType[]
  * ```
  *
  * @example Complete Override type of object response
  * ```ts
  * const { data } = await supabase
  *   .from('countries')
  *   .select()
  *   .maybeSingle()
  *   .overrideTypes<MyType, { merge: false }>()
  * ```
  *
  * @exampleResponse Complete Override type of object response
  * ```ts
  * let x: typeof data // MyType | null
  * ```
  *
  * @example Partial Override type of successful response
  * ```ts
  * const { data } = await supabase
  *   .from('countries')
  *   .select()
  *   .overrideTypes<Array<{ status: "A" | "B" }>>()
  * ```
  *
  * @exampleResponse Partial Override type of successful response
  * ```ts
  * let x: typeof data // Array<CountryRowProperties & { status: "A" | "B" }>
  * ```
  *
  * @example Partial Override type of object response
  * ```ts
  * const { data } = await supabase
  *   .from('countries')
  *   .select()
  *   .maybeSingle()
  *   .overrideTypes<{ status: "A" | "B" }>()
  * ```
  *
  * @exampleResponse Partial Override type of object response
  * ```ts
  * let x: typeof data // CountryRowProperties & { status: "A" | "B" } | null
  * ```
  *
  * @example Example 5
  * ```typescript
  * // Merge with existing types (default behavior)
  * const query = supabase
  *   .from('users')
  *   .select()
  *   .overrideTypes<{ custom_field: string }>()
  *
  * // Replace existing types completely
  * const replaceQuery = supabase
  *   .from('users')
  *   .select()
  *   .overrideTypes<{ id: number; name: string }, { merge: false }>()
  * ```
  */
  overrideTypes() {
    return this;
  }
}, Qh = class extends Yh {
  /**
  * Perform a SELECT on the query result.
  *
  * By default, `.insert()`, `.update()`, `.upsert()`, and `.delete()` do not
  * return modified rows. By calling this method, modified rows are returned in
  * `data`.
  *
  * @param columns - The columns to retrieve, separated by commas
  *
  * @category Database
  *
  * @example With `upsert()`
  * ```ts
  * const { data, error } = await supabase
  *   .from('characters')
  *   .upsert({ id: 1, name: 'Han Solo' })
  *   .select()
  * ```
  *
  * @exampleSql With `upsert()`
  * ```sql
  * create table
  *   characters (id int8 primary key, name text);
  *
  * insert into
  *   characters (id, name)
  * values
  *   (1, 'Han');
  * ```
  *
  * @exampleResponse With `upsert()`
  * ```json
  * {
  *   "data": [
  *     {
  *       "id": 1,
  *       "name": "Han Solo"
  *     }
  *   ],
  *   "status": 201,
  *   "statusText": "Created"
  * }
  * ```
  */
  select(t) {
    let e = !1;
    const r = (t ?? "*").split("").map((n) => /\s/.test(n) && !e ? "" : (n === '"' && (e = !e), n)).join("");
    return this.url.searchParams.set("select", r), this.headers.append("Prefer", "return=representation"), this;
  }
  /**
  * Order the query result by `column`.
  *
  * You can call this method multiple times to order by multiple columns.
  *
  * You can order referenced tables, but it only affects the ordering of the
  * parent table if you use `!inner` in the query.
  *
  * @param column - The column to order by
  * @param options - Named parameters
  * @param options.ascending - If `true`, the result will be in ascending order
  * @param options.nullsFirst - If `true`, `null`s appear first. If `false`,
  * `null`s appear last.
  * @param options.referencedTable - Set this to order a referenced table by
  * its columns
  * @param options.foreignTable - Deprecated, use `options.referencedTable`
  * instead
  *
  * @category Database
  *
  * @example With `select()`
  * ```ts
  * const { data, error } = await supabase
  *   .from('characters')
  *   .select('id, name')
  *   .order('id', { ascending: false })
  * ```
  *
  * @exampleSql With `select()`
  * ```sql
  * create table
  *   characters (id int8 primary key, name text);
  *
  * insert into
  *   characters (id, name)
  * values
  *   (1, 'Luke'),
  *   (2, 'Leia'),
  *   (3, 'Han');
  * ```
  *
  * @exampleResponse With `select()`
  * ```json
  * {
  *   "data": [
  *     {
  *       "id": 3,
  *       "name": "Han"
  *     },
  *     {
  *       "id": 2,
  *       "name": "Leia"
  *     },
  *     {
  *       "id": 1,
  *       "name": "Luke"
  *     }
  *   ],
  *   "status": 200,
  *   "statusText": "OK"
  * }
  * ```
  *
  * @exampleDescription On a referenced table
  * Ordering with `referencedTable` doesn't affect the ordering of the
  * parent table.
  *
  * @example On a referenced table
  * ```ts
  *   const { data, error } = await supabase
  *     .from('orchestral_sections')
  *     .select(`
  *       name,
  *       instruments (
  *         name
  *       )
  *     `)
  *     .order('name', { referencedTable: 'instruments', ascending: false })
  *
  * ```
  *
  * @exampleSql On a referenced table
  * ```sql
  * create table
  *   orchestral_sections (id int8 primary key, name text);
  * create table
  *   instruments (
  *     id int8 primary key,
  *     section_id int8 not null references orchestral_sections,
  *     name text
  *   );
  *
  * insert into
  *   orchestral_sections (id, name)
  * values
  *   (1, 'strings'),
  *   (2, 'woodwinds');
  * insert into
  *   instruments (id, section_id, name)
  * values
  *   (1, 1, 'harp'),
  *   (2, 1, 'violin');
  * ```
  *
  * @exampleResponse On a referenced table
  * ```json
  * {
  *   "data": [
  *     {
  *       "name": "strings",
  *       "instruments": [
  *         {
  *           "name": "violin"
  *         },
  *         {
  *           "name": "harp"
  *         }
  *       ]
  *     },
  *     {
  *       "name": "woodwinds",
  *       "instruments": []
  *     }
  *   ],
  *   "status": 200,
  *   "statusText": "OK"
  * }
  * ```
  *
  * @exampleDescription Order parent table by a referenced table
  * Ordering with `referenced_table(col)` affects the ordering of the
  * parent table.
  *
  * @example Order parent table by a referenced table
  * ```ts
  *   const { data, error } = await supabase
  *     .from('instruments')
  *     .select(`
  *       name,
  *       section:orchestral_sections (
  *         name
  *       )
  *     `)
  *     .order('section(name)', { ascending: true })
  *
  * ```
  *
  * @exampleSql Order parent table by a referenced table
  * ```sql
  * create table
  *   orchestral_sections (id int8 primary key, name text);
  * create table
  *   instruments (
  *     id int8 primary key,
  *     section_id int8 not null references orchestral_sections,
  *     name text
  *   );
  *
  * insert into
  *   orchestral_sections (id, name)
  * values
  *   (1, 'strings'),
  *   (2, 'woodwinds');
  * insert into
  *   instruments (id, section_id, name)
  * values
  *   (1, 2, 'flute'),
  *   (2, 1, 'violin');
  * ```
  *
  * @exampleResponse Order parent table by a referenced table
  * ```json
  * {
  *   "data": [
  *     {
  *       "name": "violin",
  *       "orchestral_sections": {"name": "strings"}
  *     },
  *     {
  *       "name": "flute",
  *       "orchestral_sections": {"name": "woodwinds"}
  *     }
  *   ],
  *   "status": 200,
  *   "statusText": "OK"
  * }
  * ```
  */
  order(t, { ascending: e = !0, nullsFirst: r, foreignTable: n, referencedTable: s = n } = {}) {
    const i = s ? `${s}.order` : "order", o = this.url.searchParams.get(i);
    return this.url.searchParams.set(i, `${o ? `${o},` : ""}${t}.${e ? "asc" : "desc"}${r === void 0 ? "" : r ? ".nullsfirst" : ".nullslast"}`), this;
  }
  /**
  * Limit the query result by `count`.
  *
  * @param count - The maximum number of rows to return
  * @param options - Named parameters
  * @param options.referencedTable - Set this to limit rows of referenced
  * tables instead of the parent table
  * @param options.foreignTable - Deprecated, use `options.referencedTable`
  * instead
  *
  * @category Database
  *
  * @example With `select()`
  * ```ts
  * const { data, error } = await supabase
  *   .from('characters')
  *   .select('name')
  *   .limit(1)
  * ```
  *
  * @exampleSql With `select()`
  * ```sql
  * create table
  *   characters (id int8 primary key, name text);
  *
  * insert into
  *   characters (id, name)
  * values
  *   (1, 'Luke'),
  *   (2, 'Leia'),
  *   (3, 'Han');
  * ```
  *
  * @exampleResponse With `select()`
  * ```json
  * {
  *   "data": [
  *     {
  *       "name": "Luke"
  *     }
  *   ],
  *   "status": 200,
  *   "statusText": "OK"
  * }
  * ```
  *
  * @example On a referenced table
  * ```ts
  * const { data, error } = await supabase
  *   .from('orchestral_sections')
  *   .select(`
  *     name,
  *     instruments (
  *       name
  *     )
  *   `)
  *   .limit(1, { referencedTable: 'instruments' })
  * ```
  *
  * @exampleSql On a referenced table
  * ```sql
  * create table
  *   orchestral_sections (id int8 primary key, name text);
  * create table
  *   instruments (
  *     id int8 primary key,
  *     section_id int8 not null references orchestral_sections,
  *     name text
  *   );
  *
  * insert into
  *   orchestral_sections (id, name)
  * values
  *   (1, 'strings');
  * insert into
  *   instruments (id, section_id, name)
  * values
  *   (1, 1, 'harp'),
  *   (2, 1, 'violin');
  * ```
  *
  * @exampleResponse On a referenced table
  * ```json
  * {
  *   "data": [
  *     {
  *       "name": "strings",
  *       "instruments": [
  *         {
  *           "name": "violin"
  *         }
  *       ]
  *     }
  *   ],
  *   "status": 200,
  *   "statusText": "OK"
  * }
  * ```
  */
  limit(t, { foreignTable: e, referencedTable: r = e } = {}) {
    const n = typeof r > "u" ? "limit" : `${r}.limit`;
    return this.url.searchParams.set(n, `${t}`), this;
  }
  /**
  * Limit the query result by starting at an offset `from` and ending at the offset `to`.
  * Only records within this range are returned.
  * This respects the query order and if there is no order clause the range could behave unexpectedly.
  * The `from` and `to` values are 0-based and inclusive: `range(1, 3)` will include the second, third
  * and fourth rows of the query.
  *
  * @param from - The starting index from which to limit the result
  * @param to - The last index to which to limit the result
  * @param options - Named parameters
  * @param options.referencedTable - Set this to limit rows of referenced
  * tables instead of the parent table
  * @param options.foreignTable - Deprecated, use `options.referencedTable`
  * instead
  *
  * @category Database
  *
  * @example With `select()`
  * ```ts
  * const { data, error } = await supabase
  *   .from('characters')
  *   .select('name')
  *   .range(0, 1)
  * ```
  *
  * @exampleSql With `select()`
  * ```sql
  * create table
  *   characters (id int8 primary key, name text);
  *
  * insert into
  *   characters (id, name)
  * values
  *   (1, 'Luke'),
  *   (2, 'Leia'),
  *   (3, 'Han');
  * ```
  *
  * @exampleResponse With `select()`
  * ```json
  * {
  *   "data": [
  *     {
  *       "name": "Luke"
  *     },
  *     {
  *       "name": "Leia"
  *     }
  *   ],
  *   "status": 200,
  *   "statusText": "OK"
  * }
  * ```
  */
  range(t, e, { foreignTable: r, referencedTable: n = r } = {}) {
    const s = typeof n > "u" ? "offset" : `${n}.offset`, i = typeof n > "u" ? "limit" : `${n}.limit`;
    return this.url.searchParams.set(s, `${t}`), this.url.searchParams.set(i, `${e - t + 1}`), this;
  }
  /**
  * Set the AbortSignal for the fetch request.
  *
  * @param signal - The AbortSignal to use for the fetch request
  *
  * @category Database
  *
  * @remarks
  * You can use this to set a timeout for the request.
  *
  * @exampleDescription Aborting requests in-flight
  * You can use an [`AbortController`](https://developer.mozilla.org/en-US/docs/Web/API/AbortController) to abort requests.
  * Note that `status` and `statusText` don't mean anything for aborted requests as the request wasn't fulfilled.
  *
  * @example Aborting requests in-flight
  * ```ts
  * const ac = new AbortController()
  *
  * const { data, error } = await supabase
  *   .from('very_big_table')
  *   .select()
  *   .abortSignal(ac.signal)
  *
  * // Abort the request after 100 ms
  * setTimeout(() => ac.abort(), 100)
  * ```
  *
  * @exampleResponse Aborting requests in-flight
  * ```json
  *   {
  *     "error": {
  *       "message": "AbortError: The user aborted a request.",
  *       "details": "",
  *       "hint": "The request was aborted locally via the provided AbortSignal.",
  *       "code": ""
  *     },
  *     "status": 0,
  *     "statusText": ""
  *   }
  *
  * ```
  *
  * @example Set a timeout
  * ```ts
  * const { data, error } = await supabase
  *   .from('very_big_table')
  *   .select()
  *   .abortSignal(AbortSignal.timeout(1000 /* ms *\/))
  * ```
  *
  * @exampleResponse Set a timeout
  * ```json
  *   {
  *     "error": {
  *       "message": "FetchError: The user aborted a request.",
  *       "details": "",
  *       "hint": "",
  *       "code": ""
  *     },
  *     "status": 400,
  *     "statusText": "Bad Request"
  *   }
  *
  * ```
  */
  abortSignal(t) {
    return this.signal = t, this;
  }
  /**
  * Return `data` as a single object instead of an array of objects.
  *
  * Query result must be one row (e.g. using `.limit(1)`), otherwise this
  * returns an error.
  *
  * @category Database
  *
  * @example With `select()`
  * ```ts
  * const { data, error } = await supabase
  *   .from('characters')
  *   .select('name')
  *   .limit(1)
  *   .single()
  * ```
  *
  * @exampleSql With `select()`
  * ```sql
  * create table
  *   characters (id int8 primary key, name text);
  *
  * insert into
  *   characters (id, name)
  * values
  *   (1, 'Luke'),
  *   (2, 'Leia'),
  *   (3, 'Han');
  * ```
  *
  * @exampleResponse With `select()`
  * ```json
  * {
  *   "data": {
  *     "name": "Luke"
  *   },
  *   "status": 200,
  *   "statusText": "OK"
  * }
  * ```
  */
  single() {
    return this.headers.set("Accept", "application/vnd.pgrst.object+json"), this;
  }
  /**
  * Return `data` as a single object instead of an array of objects.
  *
  * Query result must be zero or one row (e.g. using `.limit(1)`), otherwise
  * this returns an error.
  *
  * @category Database
  *
  * @example With `select()`
  * ```ts
  * const { data, error } = await supabase
  *   .from('characters')
  *   .select()
  *   .eq('name', 'Katniss')
  *   .maybeSingle()
  * ```
  *
  * @exampleSql With `select()`
  * ```sql
  * create table
  *   characters (id int8 primary key, name text);
  *
  * insert into
  *   characters (id, name)
  * values
  *   (1, 'Luke'),
  *   (2, 'Leia'),
  *   (3, 'Han');
  * ```
  *
  * @exampleResponse With `select()`
  * ```json
  * {
  *   "status": 200,
  *   "statusText": "OK"
  * }
  * ```
  */
  maybeSingle() {
    return this.isMaybeSingle = !0, this;
  }
  /**
  * Return `data` as a string in CSV format.
  *
  * @category Database
  *
  * @exampleDescription Return data as CSV
  * By default, the data is returned in JSON format, but can also be returned as Comma Separated Values.
  *
  * @example Return data as CSV
  * ```ts
  * const { data, error } = await supabase
  *   .from('characters')
  *   .select()
  *   .csv()
  * ```
  *
  * @exampleSql Return data as CSV
  * ```sql
  * create table
  *   characters (id int8 primary key, name text);
  *
  * insert into
  *   characters (id, name)
  * values
  *   (1, 'Luke'),
  *   (2, 'Leia'),
  *   (3, 'Han');
  * ```
  *
  * @exampleResponse Return data as CSV
  * ```json
  * {
  *   "data": "id,name\n1,Luke\n2,Leia\n3,Han",
  *   "status": 200,
  *   "statusText": "OK"
  * }
  * ```
  */
  csv() {
    return this.headers.set("Accept", "text/csv"), this;
  }
  /**
  * Return `data` as an object in [GeoJSON](https://geojson.org) format.
  *
  * @category Database
  */
  geojson() {
    return this.headers.set("Accept", "application/geo+json"), this;
  }
  /**
  * Return `data` as the EXPLAIN plan for the query.
  *
  * You need to enable the
  * [db_plan_enabled](https://supabase.com/docs/guides/database/debugging-performance#enabling-explain)
  * setting before using this method.
  *
  * @param options - Named parameters
  *
  * @param options.analyze - If `true`, the query will be executed and the
  * actual run time will be returned
  *
  * @param options.verbose - If `true`, the query identifier will be returned
  * and `data` will include the output columns of the query
  *
  * @param options.settings - If `true`, include information on configuration
  * parameters that affect query planning
  *
  * @param options.buffers - If `true`, include information on buffer usage
  *
  * @param options.wal - If `true`, include information on WAL record generation
  *
  * @param options.format - The format of the output, can be `"text"` (default)
  * or `"json"`
  *
  * @category Database
  *
  * @exampleDescription Get the execution plan
  * By default, the data is returned in TEXT format, but can also be returned as JSON by using the `format` parameter.
  *
  * @example Get the execution plan
  * ```ts
  * const { data, error } = await supabase
  *   .from('characters')
  *   .select()
  *   .explain()
  * ```
  *
  * @exampleSql Get the execution plan
  * ```sql
  * create table
  *   characters (id int8 primary key, name text);
  *
  * insert into
  *   characters (id, name)
  * values
  *   (1, 'Luke'),
  *   (2, 'Leia'),
  *   (3, 'Han');
  * ```
  *
  * @exampleResponse Get the execution plan
  * ```js
  * Aggregate  (cost=33.34..33.36 rows=1 width=112)
  *   ->  Limit  (cost=0.00..18.33 rows=1000 width=40)
  *         ->  Seq Scan on characters  (cost=0.00..22.00 rows=1200 width=40)
  * ```
  *
  * @exampleDescription Get the execution plan with analyze and verbose
  * By default, the data is returned in TEXT format, but can also be returned as JSON by using the `format` parameter.
  *
  * @example Get the execution plan with analyze and verbose
  * ```ts
  * const { data, error } = await supabase
  *   .from('characters')
  *   .select()
  *   .explain({analyze:true,verbose:true})
  * ```
  *
  * @exampleSql Get the execution plan with analyze and verbose
  * ```sql
  * create table
  *   characters (id int8 primary key, name text);
  *
  * insert into
  *   characters (id, name)
  * values
  *   (1, 'Luke'),
  *   (2, 'Leia'),
  *   (3, 'Han');
  * ```
  *
  * @exampleResponse Get the execution plan with analyze and verbose
  * ```js
  * Aggregate  (cost=33.34..33.36 rows=1 width=112) (actual time=0.041..0.041 rows=1 loops=1)
  *   Output: NULL::bigint, count(ROW(characters.id, characters.name)), COALESCE(json_agg(ROW(characters.id, characters.name)), '[]'::json), NULLIF(current_setting('response.headers'::text, true), ''::text), NULLIF(current_setting('response.status'::text, true), ''::text)
  *   ->  Limit  (cost=0.00..18.33 rows=1000 width=40) (actual time=0.005..0.006 rows=3 loops=1)
  *         Output: characters.id, characters.name
  *         ->  Seq Scan on public.characters  (cost=0.00..22.00 rows=1200 width=40) (actual time=0.004..0.005 rows=3 loops=1)
  *               Output: characters.id, characters.name
  * Query Identifier: -4730654291623321173
  * Planning Time: 0.407 ms
  * Execution Time: 0.119 ms
  * ```
  */
  explain({ analyze: t = !1, verbose: e = !1, settings: r = !1, buffers: n = !1, wal: s = !1, format: i = "text" } = {}) {
    var o;
    const a = [
      t ? "analyze" : null,
      e ? "verbose" : null,
      r ? "settings" : null,
      n ? "buffers" : null,
      s ? "wal" : null
    ].filter(Boolean).join("|"), c = (o = this.headers.get("Accept")) !== null && o !== void 0 ? o : "application/json";
    return this.headers.set("Accept", `application/vnd.pgrst.plan+${i}; for="${c}"; options=${a};`), i === "json" ? this : this;
  }
  /**
  * Rollback the query.
  *
  * `data` will still be returned, but the query is not committed.
  *
  * @category Database
  */
  rollback() {
    return this.headers.append("Prefer", "tx=rollback"), this;
  }
  /**
  * Override the type of the returned `data`.
  *
  * @typeParam NewResult - The new result type to override with
  * @deprecated Use overrideTypes<yourType, { merge: false }>() method at the end of your call chain instead
  *
  * @category Database
  *
  * @remarks
  * - Deprecated: use overrideTypes method instead
  *
  * @example Override type of successful response
  * ```ts
  * const { data } = await supabase
  *   .from('countries')
  *   .select()
  *   .returns<Array<MyType>>()
  * ```
  *
  * @exampleResponse Override type of successful response
  * ```js
  * let x: typeof data // MyType[]
  * ```
  *
  * @example Override type of object response
  * ```ts
  * const { data } = await supabase
  *   .from('countries')
  *   .select()
  *   .maybeSingle()
  *   .returns<MyType>()
  * ```
  *
  * @exampleResponse Override type of object response
  * ```js
  * let x: typeof data // MyType | null
  * ```
  */
  returns() {
    return this;
  }
  /**
  * Set the maximum number of rows that can be affected by the query.
  * Only available in PostgREST v13+ and only works with PATCH and DELETE methods.
  *
  * @param value - The maximum number of rows that can be affected
  *
  * @category Database
  */
  maxAffected(t) {
    return this.headers.append("Prefer", "handling=strict"), this.headers.append("Prefer", `max-affected=${t}`), this;
  }
};
const Cs = /* @__PURE__ */ new RegExp("[,()]");
var pt = class extends Qh {
  /**
  * Match only rows where `column` is equal to `value`.
  *
  * To check if the value of `column` is NULL, you should use `.is()` instead.
  *
  * @param column - The column to filter on
  * @param value - The value to filter with
  *
  * @category Database
  *
  * @example With `select()`
  * ```ts
  * const { data, error } = await supabase
  *   .from('characters')
  *   .select()
  *   .eq('name', 'Leia')
  * ```
  *
  * @exampleSql With `select()`
  * ```sql
  * create table
  *   characters (id int8 primary key, name text);
  *
  * insert into
  *   characters (id, name)
  * values
  *   (1, 'Luke'),
  *   (2, 'Leia'),
  *   (3, 'Han');
  * ```
  *
  * @exampleResponse With `select()`
  * ```json
  * {
  *   "data": [
  *     {
  *       "id": 2,
  *       "name": "Leia"
  *     }
  *   ],
  *   "status": 200,
  *   "statusText": "OK"
  * }
  * ```
  */
  eq(t, e) {
    return this.url.searchParams.append(t, `eq.${e}`), this;
  }
  /**
  * Match only rows where `column` is not equal to `value`.
  *
  * @param column - The column to filter on
  * @param value - The value to filter with
  *
  * @category Database
  *
  * @example With `select()`
  * ```ts
  * const { data, error } = await supabase
  *   .from('characters')
  *   .select()
  *   .neq('name', 'Leia')
  * ```
  *
  * @exampleSql With `select()`
  * ```sql
  * create table
  *   characters (id int8 primary key, name text);
  *
  * insert into
  *   characters (id, name)
  * values
  *   (1, 'Luke'),
  *   (2, 'Leia'),
  *   (3, 'Han');
  * ```
  *
  * @exampleResponse With `select()`
  * ```json
  * {
  *   "data": [
  *     {
  *       "id": 1,
  *       "name": "Luke"
  *     },
  *     {
  *       "id": 3,
  *       "name": "Han"
  *     }
  *   ],
  *   "status": 200,
  *   "statusText": "OK"
  * }
  * ```
  */
  neq(t, e) {
    return this.url.searchParams.append(t, `neq.${e}`), this;
  }
  /**
  * Match only rows where `column` is greater than `value`.
  *
  * @param column - The column to filter on
  * @param value - The value to filter with
  *
  * @category Database
  *
  * @exampleDescription With `select()`
  * When using [reserved words](https://www.postgresql.org/docs/current/sql-keywords-appendix.html) for column names you need
  * to add double quotes e.g. `.gt('"order"', 2)`
  *
  * @example With `select()`
  * ```ts
  * const { data, error } = await supabase
  *   .from('characters')
  *   .select()
  *   .gt('id', 2)
  * ```
  *
  * @exampleSql With `select()`
  * ```sql
  * create table
  *   characters (id int8 primary key, name text);
  *
  * insert into
  *   characters (id, name)
  * values
  *   (1, 'Luke'),
  *   (2, 'Leia'),
  *   (3, 'Han');
  * ```
  *
  * @exampleResponse With `select()`
  * ```json
  * {
  *   "data": [
  *     {
  *       "id": 3,
  *       "name": "Han"
  *     }
  *   ],
  *   "status": 200,
  *   "statusText": "OK"
  * }
  * ```
  */
  gt(t, e) {
    return this.url.searchParams.append(t, `gt.${e}`), this;
  }
  /**
  * Match only rows where `column` is greater than or equal to `value`.
  *
  * @param column - The column to filter on
  * @param value - The value to filter with
  *
  * @category Database
  *
  * @example With `select()`
  * ```ts
  * const { data, error } = await supabase
  *   .from('characters')
  *   .select()
  *   .gte('id', 2)
  * ```
  *
  * @exampleSql With `select()`
  * ```sql
  * create table
  *   characters (id int8 primary key, name text);
  *
  * insert into
  *   characters (id, name)
  * values
  *   (1, 'Luke'),
  *   (2, 'Leia'),
  *   (3, 'Han');
  * ```
  *
  * @exampleResponse With `select()`
  * ```json
  * {
  *   "data": [
  *     {
  *       "id": 2,
  *       "name": "Leia"
  *     },
  *     {
  *       "id": 3,
  *       "name": "Han"
  *     }
  *   ],
  *   "status": 200,
  *   "statusText": "OK"
  * }
  * ```
  */
  gte(t, e) {
    return this.url.searchParams.append(t, `gte.${e}`), this;
  }
  /**
  * Match only rows where `column` is less than `value`.
  *
  * @param column - The column to filter on
  * @param value - The value to filter with
  *
  * @category Database
  *
  * @example With `select()`
  * ```ts
  * const { data, error } = await supabase
  *   .from('characters')
  *   .select()
  *   .lt('id', 2)
  * ```
  *
  * @exampleSql With `select()`
  * ```sql
  * create table
  *   characters (id int8 primary key, name text);
  *
  * insert into
  *   characters (id, name)
  * values
  *   (1, 'Luke'),
  *   (2, 'Leia'),
  *   (3, 'Han');
  * ```
  *
  * @exampleResponse With `select()`
  * ```json
  * {
  *   "data": [
  *     {
  *       "id": 1,
  *       "name": "Luke"
  *     }
  *   ],
  *   "status": 200,
  *   "statusText": "OK"
  * }
  * ```
  */
  lt(t, e) {
    return this.url.searchParams.append(t, `lt.${e}`), this;
  }
  /**
  * Match only rows where `column` is less than or equal to `value`.
  *
  * @param column - The column to filter on
  * @param value - The value to filter with
  *
  * @category Database
  *
  * @example With `select()`
  * ```ts
  * const { data, error } = await supabase
  *   .from('characters')
  *   .select()
  *   .lte('id', 2)
  * ```
  *
  * @exampleSql With `select()`
  * ```sql
  * create table
  *   characters (id int8 primary key, name text);
  *
  * insert into
  *   characters (id, name)
  * values
  *   (1, 'Luke'),
  *   (2, 'Leia'),
  *   (3, 'Han');
  * ```
  *
  * @exampleResponse With `select()`
  * ```json
  * {
  *   "data": [
  *     {
  *       "id": 1,
  *       "name": "Luke"
  *     },
  *     {
  *       "id": 2,
  *       "name": "Leia"
  *     }
  *   ],
  *   "status": 200,
  *   "statusText": "OK"
  * }
  * ```
  */
  lte(t, e) {
    return this.url.searchParams.append(t, `lte.${e}`), this;
  }
  /**
  * Match only rows where `column` matches `pattern` case-sensitively.
  *
  * @param column - The column to filter on
  * @param pattern - The pattern to match with
  *
  * @category Database
  *
  * @example With `select()`
  * ```ts
  * const { data, error } = await supabase
  *   .from('characters')
  *   .select()
  *   .like('name', '%Lu%')
  * ```
  *
  * @exampleSql With `select()`
  * ```sql
  * create table
  *   characters (id int8 primary key, name text);
  *
  * insert into
  *   characters (id, name)
  * values
  *   (1, 'Luke'),
  *   (2, 'Leia'),
  *   (3, 'Han');
  * ```
  *
  * @exampleResponse With `select()`
  * ```json
  * {
  *   "data": [
  *     {
  *       "id": 1,
  *       "name": "Luke"
  *     }
  *   ],
  *   "status": 200,
  *   "statusText": "OK"
  * }
  * ```
  */
  like(t, e) {
    return this.url.searchParams.append(t, `like.${e}`), this;
  }
  /**
  * Match only rows where `column` matches all of `patterns` case-sensitively.
  *
  * @param column - The column to filter on
  * @param patterns - The patterns to match with
  *
  * @category Database
  */
  likeAllOf(t, e) {
    return this.url.searchParams.append(t, `like(all).{${e.join(",")}}`), this;
  }
  /**
  * Match only rows where `column` matches any of `patterns` case-sensitively.
  *
  * @param column - The column to filter on
  * @param patterns - The patterns to match with
  *
  * @category Database
  */
  likeAnyOf(t, e) {
    return this.url.searchParams.append(t, `like(any).{${e.join(",")}}`), this;
  }
  /**
  * Match only rows where `column` matches `pattern` case-insensitively.
  *
  * @param column - The column to filter on
  * @param pattern - The pattern to match with
  *
  * @category Database
  *
  * @example With `select()`
  * ```ts
  * const { data, error } = await supabase
  *   .from('characters')
  *   .select()
  *   .ilike('name', '%lu%')
  * ```
  *
  * @exampleSql With `select()`
  * ```sql
  * create table
  *   characters (id int8 primary key, name text);
  *
  * insert into
  *   characters (id, name)
  * values
  *   (1, 'Luke'),
  *   (2, 'Leia'),
  *   (3, 'Han');
  * ```
  *
  * @exampleResponse With `select()`
  * ```json
  * {
  *   "data": [
  *     {
  *       "id": 1,
  *       "name": "Luke"
  *     }
  *   ],
  *   "status": 200,
  *   "statusText": "OK"
  * }
  * ```
  */
  ilike(t, e) {
    return this.url.searchParams.append(t, `ilike.${e}`), this;
  }
  /**
  * Match only rows where `column` matches all of `patterns` case-insensitively.
  *
  * @param column - The column to filter on
  * @param patterns - The patterns to match with
  *
  * @category Database
  */
  ilikeAllOf(t, e) {
    return this.url.searchParams.append(t, `ilike(all).{${e.join(",")}}`), this;
  }
  /**
  * Match only rows where `column` matches any of `patterns` case-insensitively.
  *
  * @param column - The column to filter on
  * @param patterns - The patterns to match with
  *
  * @category Database
  */
  ilikeAnyOf(t, e) {
    return this.url.searchParams.append(t, `ilike(any).{${e.join(",")}}`), this;
  }
  /**
  * Match only rows where `column` matches the PostgreSQL regex `pattern`
  * case-sensitively (using the `~` operator).
  *
  * @param column - The column to filter on
  * @param pattern - The PostgreSQL regular expression pattern to match with
  */
  regexMatch(t, e) {
    return this.url.searchParams.append(t, `match.${e}`), this;
  }
  /**
  * Match only rows where `column` matches the PostgreSQL regex `pattern`
  * case-insensitively (using the `~*` operator).
  *
  * @param column - The column to filter on
  * @param pattern - The PostgreSQL regular expression pattern to match with
  */
  regexIMatch(t, e) {
    return this.url.searchParams.append(t, `imatch.${e}`), this;
  }
  /**
  * Match only rows where `column` IS `value`.
  *
  * For non-boolean columns, this is only relevant for checking if the value of
  * `column` is NULL by setting `value` to `null`.
  *
  * For boolean columns, you can also set `value` to `true` or `false` and it
  * will behave the same way as `.eq()`.
  *
  * @param column - The column to filter on
  * @param value - The value to filter with
  *
  * @category Database
  *
  * @exampleDescription Checking for nullness, true or false
  * Using the `eq()` filter doesn't work when filtering for `null`.
  *
  * Instead, you need to use `is()`.
  *
  * @example Checking for nullness, true or false
  * ```ts
  * const { data, error } = await supabase
  *   .from('countries')
  *   .select()
  *   .is('name', null)
  * ```
  *
  * @exampleSql Checking for nullness, true or false
  * ```sql
  * create table
  *   countries (id int8 primary key, name text);
  *
  * insert into
  *   countries (id, name)
  * values
  *   (1, 'null'),
  *   (2, null);
  * ```
  *
  * @exampleResponse Checking for nullness, true or false
  * ```json
  * {
  *   "data": [
  *     {
  *       "id": 2,
  *       "name": "null"
  *     }
  *   ],
  *   "status": 200,
  *   "statusText": "OK"
  * }
  * ```
  */
  is(t, e) {
    return this.url.searchParams.append(t, `is.${e}`), this;
  }
  /**
  * Match only rows where `column` IS DISTINCT FROM `value`.
  *
  * Unlike `.neq()`, this treats `NULL` as a comparable value. Two `NULL` values
  * are considered equal (not distinct), and comparing `NULL` with any non-NULL
  * value returns true (distinct).
  *
  * @param column - The column to filter on
  * @param value - The value to filter with
  */
  isDistinct(t, e) {
    return this.url.searchParams.append(t, `isdistinct.${e}`), this;
  }
  /**
  * Match only rows where `column` is included in the `values` array.
  *
  * @param column - The column to filter on
  * @param values - The values array to filter with
  *
  * @category Database
  *
  * @example With `select()`
  * ```ts
  * const { data, error } = await supabase
  *   .from('characters')
  *   .select()
  *   .in('name', ['Leia', 'Han'])
  * ```
  *
  * @exampleSql With `select()`
  * ```sql
  * create table
  *   characters (id int8 primary key, name text);
  *
  * insert into
  *   characters (id, name)
  * values
  *   (1, 'Luke'),
  *   (2, 'Leia'),
  *   (3, 'Han');
  * ```
  *
  * @exampleResponse With `select()`
  * ```json
  * {
  *   "data": [
  *     {
  *       "id": 2,
  *       "name": "Leia"
  *     },
  *     {
  *       "id": 3,
  *       "name": "Han"
  *     }
  *   ],
  *   "status": 200,
  *   "statusText": "OK"
  * }
  * ```
  */
  in(t, e) {
    const r = Array.from(new Set(e)).map((n) => typeof n == "string" && Cs.test(n) ? `"${n}"` : `${n}`).join(",");
    return this.url.searchParams.append(t, `in.(${r})`), this;
  }
  /**
  * Match only rows where `column` is NOT included in the `values` array.
  *
  * @param column - The column to filter on
  * @param values - The values array to filter with
  */
  notIn(t, e) {
    const r = Array.from(new Set(e)).map((n) => typeof n == "string" && Cs.test(n) ? `"${n}"` : `${n}`).join(",");
    return this.url.searchParams.append(t, `not.in.(${r})`), this;
  }
  /**
  * Only relevant for jsonb, array, and range columns. Match only rows where
  * `column` contains every element appearing in `value`.
  *
  * @param column - The jsonb, array, or range column to filter on
  * @param value - The jsonb, array, or range value to filter with
  *
  * @category Database
  *
  * @example On array columns
  * ```ts
  * const { data, error } = await supabase
  *   .from('issues')
  *   .select()
  *   .contains('tags', ['is:open', 'priority:low'])
  * ```
  *
  * @exampleSql On array columns
  * ```sql
  * create table
  *   issues (
  *     id int8 primary key,
  *     title text,
  *     tags text[]
  *   );
  *
  * insert into
  *   issues (id, title, tags)
  * values
  *   (1, 'Cache invalidation is not working', array['is:open', 'severity:high', 'priority:low']),
  *   (2, 'Use better names', array['is:open', 'severity:low', 'priority:medium']);
  * ```
  *
  * @exampleResponse On array columns
  * ```json
  * {
  *   "data": [
  *     {
  *       "title": "Cache invalidation is not working"
  *     }
  *   ],
  *   "status": 200,
  *   "statusText": "OK"
  * }
  * ```
  *
  * @exampleDescription On range columns
  * Postgres supports a number of [range
  * types](https://www.postgresql.org/docs/current/rangetypes.html). You
  * can filter on range columns using the string representation of range
  * values.
  *
  * @example On range columns
  * ```ts
  * const { data, error } = await supabase
  *   .from('reservations')
  *   .select()
  *   .contains('during', '[2000-01-01 13:00, 2000-01-01 13:30)')
  * ```
  *
  * @exampleSql On range columns
  * ```sql
  * create table
  *   reservations (
  *     id int8 primary key,
  *     room_name text,
  *     during tsrange
  *   );
  *
  * insert into
  *   reservations (id, room_name, during)
  * values
  *   (1, 'Emerald', '[2000-01-01 13:00, 2000-01-01 15:00)'),
  *   (2, 'Topaz', '[2000-01-02 09:00, 2000-01-02 10:00)');
  * ```
  *
  * @exampleResponse On range columns
  * ```json
  * {
  *   "data": [
  *     {
  *       "id": 1,
  *       "room_name": "Emerald",
  *       "during": "[\"2000-01-01 13:00:00\",\"2000-01-01 15:00:00\")"
  *     }
  *   ],
  *   "status": 200,
  *   "statusText": "OK"
  * }
  * ```
  *
  * @example On `jsonb` columns
  * ```ts
  * const { data, error } = await supabase
  *   .from('users')
  *   .select('name')
  *   .contains('address', { postcode: 90210 })
  * ```
  *
  * @exampleSql On `jsonb` columns
  * ```sql
  * create table
  *   users (
  *     id int8 primary key,
  *     name text,
  *     address jsonb
  *   );
  *
  * insert into
  *   users (id, name, address)
  * values
  *   (1, 'Michael', '{ "postcode": 90210, "street": "Melrose Place" }'),
  *   (2, 'Jane', '{}');
  * ```
  *
  * @exampleResponse On `jsonb` columns
  * ```json
  * {
  *   "data": [
  *     {
  *       "name": "Michael"
  *     }
  *   ],
  *   "status": 200,
  *   "statusText": "OK"
  * }
  * ```
  */
  contains(t, e) {
    return typeof e == "string" ? this.url.searchParams.append(t, `cs.${e}`) : Array.isArray(e) ? this.url.searchParams.append(t, `cs.{${e.join(",")}}`) : this.url.searchParams.append(t, `cs.${JSON.stringify(e)}`), this;
  }
  /**
  * Only relevant for jsonb, array, and range columns. Match only rows where
  * every element appearing in `column` is contained by `value`.
  *
  * @param column - The jsonb, array, or range column to filter on
  * @param value - The jsonb, array, or range value to filter with
  *
  * @category Database
  *
  * @example On array columns
  * ```ts
  * const { data, error } = await supabase
  *   .from('classes')
  *   .select('name')
  *   .containedBy('days', ['monday', 'tuesday', 'wednesday', 'friday'])
  * ```
  *
  * @exampleSql On array columns
  * ```sql
  * create table
  *   classes (
  *     id int8 primary key,
  *     name text,
  *     days text[]
  *   );
  *
  * insert into
  *   classes (id, name, days)
  * values
  *   (1, 'Chemistry', array['monday', 'friday']),
  *   (2, 'History', array['monday', 'wednesday', 'thursday']);
  * ```
  *
  * @exampleResponse On array columns
  * ```json
  * {
  *   "data": [
  *     {
  *       "name": "Chemistry"
  *     }
  *   ],
  *   "status": 200,
  *   "statusText": "OK"
  * }
  * ```
  *
  * @exampleDescription On range columns
  * Postgres supports a number of [range
  * types](https://www.postgresql.org/docs/current/rangetypes.html). You
  * can filter on range columns using the string representation of range
  * values.
  *
  * @example On range columns
  * ```ts
  * const { data, error } = await supabase
  *   .from('reservations')
  *   .select()
  *   .containedBy('during', '[2000-01-01 00:00, 2000-01-01 23:59)')
  * ```
  *
  * @exampleSql On range columns
  * ```sql
  * create table
  *   reservations (
  *     id int8 primary key,
  *     room_name text,
  *     during tsrange
  *   );
  *
  * insert into
  *   reservations (id, room_name, during)
  * values
  *   (1, 'Emerald', '[2000-01-01 13:00, 2000-01-01 15:00)'),
  *   (2, 'Topaz', '[2000-01-02 09:00, 2000-01-02 10:00)');
  * ```
  *
  * @exampleResponse On range columns
  * ```json
  * {
  *   "data": [
  *     {
  *       "id": 1,
  *       "room_name": "Emerald",
  *       "during": "[\"2000-01-01 13:00:00\",\"2000-01-01 15:00:00\")"
  *     }
  *   ],
  *   "status": 200,
  *   "statusText": "OK"
  * }
  * ```
  *
  * @example On `jsonb` columns
  * ```ts
  * const { data, error } = await supabase
  *   .from('users')
  *   .select('name')
  *   .containedBy('address', {})
  * ```
  *
  * @exampleSql On `jsonb` columns
  * ```sql
  * create table
  *   users (
  *     id int8 primary key,
  *     name text,
  *     address jsonb
  *   );
  *
  * insert into
  *   users (id, name, address)
  * values
  *   (1, 'Michael', '{ "postcode": 90210, "street": "Melrose Place" }'),
  *   (2, 'Jane', '{}');
  * ```
  *
  * @exampleResponse On `jsonb` columns
  * ```json
  *   {
  *     "data": [
  *       {
  *         "name": "Jane"
  *       }
  *     ],
  *     "status": 200,
  *     "statusText": "OK"
  *   }
  *
  * ```
  */
  containedBy(t, e) {
    return typeof e == "string" ? this.url.searchParams.append(t, `cd.${e}`) : Array.isArray(e) ? this.url.searchParams.append(t, `cd.{${e.join(",")}}`) : this.url.searchParams.append(t, `cd.${JSON.stringify(e)}`), this;
  }
  /**
  * Only relevant for range columns. Match only rows where every element in
  * `column` is greater than any element in `range`.
  *
  * @param column - The range column to filter on
  * @param range - The range to filter with
  *
  * @category Database
  *
  * @exampleDescription With `select()`
  * Postgres supports a number of [range
  * types](https://www.postgresql.org/docs/current/rangetypes.html). You
  * can filter on range columns using the string representation of range
  * values.
  *
  * @example With `select()`
  * ```ts
  * const { data, error } = await supabase
  *   .from('reservations')
  *   .select()
  *   .rangeGt('during', '[2000-01-02 08:00, 2000-01-02 09:00)')
  * ```
  *
  * @exampleSql With `select()`
  * ```sql
  * create table
  *   reservations (
  *     id int8 primary key,
  *     room_name text,
  *     during tsrange
  *   );
  *
  * insert into
  *   reservations (id, room_name, during)
  * values
  *   (1, 'Emerald', '[2000-01-01 13:00, 2000-01-01 15:00)'),
  *   (2, 'Topaz', '[2000-01-02 09:00, 2000-01-02 10:00)');
  * ```
  *
  * @exampleResponse With `select()`
  * ```json
  *   {
  *     "data": [
  *       {
  *         "id": 2,
  *         "room_name": "Topaz",
  *         "during": "[\"2000-01-02 09:00:00\",\"2000-01-02 10:00:00\")"
  *       }
  *     ],
  *     "status": 200,
  *     "statusText": "OK"
  *   }
  *
  * ```
  */
  rangeGt(t, e) {
    return this.url.searchParams.append(t, `sr.${e}`), this;
  }
  /**
  * Only relevant for range columns. Match only rows where every element in
  * `column` is either contained in `range` or greater than any element in
  * `range`.
  *
  * @param column - The range column to filter on
  * @param range - The range to filter with
  *
  * @category Database
  *
  * @exampleDescription With `select()`
  * Postgres supports a number of [range
  * types](https://www.postgresql.org/docs/current/rangetypes.html). You
  * can filter on range columns using the string representation of range
  * values.
  *
  * @example With `select()`
  * ```ts
  * const { data, error } = await supabase
  *   .from('reservations')
  *   .select()
  *   .rangeGte('during', '[2000-01-02 08:30, 2000-01-02 09:30)')
  * ```
  *
  * @exampleSql With `select()`
  * ```sql
  * create table
  *   reservations (
  *     id int8 primary key,
  *     room_name text,
  *     during tsrange
  *   );
  *
  * insert into
  *   reservations (id, room_name, during)
  * values
  *   (1, 'Emerald', '[2000-01-01 13:00, 2000-01-01 15:00)'),
  *   (2, 'Topaz', '[2000-01-02 09:00, 2000-01-02 10:00)');
  * ```
  *
  * @exampleResponse With `select()`
  * ```json
  *   {
  *     "data": [
  *       {
  *         "id": 2,
  *         "room_name": "Topaz",
  *         "during": "[\"2000-01-02 09:00:00\",\"2000-01-02 10:00:00\")"
  *       }
  *     ],
  *     "status": 200,
  *     "statusText": "OK"
  *   }
  *
  * ```
  */
  rangeGte(t, e) {
    return this.url.searchParams.append(t, `nxl.${e}`), this;
  }
  /**
  * Only relevant for range columns. Match only rows where every element in
  * `column` is less than any element in `range`.
  *
  * @param column - The range column to filter on
  * @param range - The range to filter with
  *
  * @category Database
  *
  * @exampleDescription With `select()`
  * Postgres supports a number of [range
  * types](https://www.postgresql.org/docs/current/rangetypes.html). You
  * can filter on range columns using the string representation of range
  * values.
  *
  * @example With `select()`
  * ```ts
  * const { data, error } = await supabase
  *   .from('reservations')
  *   .select()
  *   .rangeLt('during', '[2000-01-01 15:00, 2000-01-01 16:00)')
  * ```
  *
  * @exampleSql With `select()`
  * ```sql
  * create table
  *   reservations (
  *     id int8 primary key,
  *     room_name text,
  *     during tsrange
  *   );
  *
  * insert into
  *   reservations (id, room_name, during)
  * values
  *   (1, 'Emerald', '[2000-01-01 13:00, 2000-01-01 15:00)'),
  *   (2, 'Topaz', '[2000-01-02 09:00, 2000-01-02 10:00)');
  * ```
  *
  * @exampleResponse With `select()`
  * ```json
  * {
  *   "data": [
  *     {
  *       "id": 1,
  *       "room_name": "Emerald",
  *       "during": "[\"2000-01-01 13:00:00\",\"2000-01-01 15:00:00\")"
  *     }
  *   ],
  *   "status": 200,
  *   "statusText": "OK"
  * }
  * ```
  */
  rangeLt(t, e) {
    return this.url.searchParams.append(t, `sl.${e}`), this;
  }
  /**
  * Only relevant for range columns. Match only rows where every element in
  * `column` is either contained in `range` or less than any element in
  * `range`.
  *
  * @param column - The range column to filter on
  * @param range - The range to filter with
  *
  * @category Database
  *
  * @exampleDescription With `select()`
  * Postgres supports a number of [range
  * types](https://www.postgresql.org/docs/current/rangetypes.html). You
  * can filter on range columns using the string representation of range
  * values.
  *
  * @example With `select()`
  * ```ts
  * const { data, error } = await supabase
  *   .from('reservations')
  *   .select()
  *   .rangeLte('during', '[2000-01-01 14:00, 2000-01-01 16:00)')
  * ```
  *
  * @exampleSql With `select()`
  * ```sql
  * create table
  *   reservations (
  *     id int8 primary key,
  *     room_name text,
  *     during tsrange
  *   );
  *
  * insert into
  *   reservations (id, room_name, during)
  * values
  *   (1, 'Emerald', '[2000-01-01 13:00, 2000-01-01 15:00)'),
  *   (2, 'Topaz', '[2000-01-02 09:00, 2000-01-02 10:00)');
  * ```
  *
  * @exampleResponse With `select()`
  * ```json
  *   {
  *     "data": [
  *       {
  *         "id": 1,
  *         "room_name": "Emerald",
  *         "during": "[\"2000-01-01 13:00:00\",\"2000-01-01 15:00:00\")"
  *       }
  *     ],
  *     "status": 200,
  *     "statusText": "OK"
  *   }
  *
  * ```
  */
  rangeLte(t, e) {
    return this.url.searchParams.append(t, `nxr.${e}`), this;
  }
  /**
  * Only relevant for range columns. Match only rows where `column` is
  * mutually exclusive to `range` and there can be no element between the two
  * ranges.
  *
  * @param column - The range column to filter on
  * @param range - The range to filter with
  *
  * @category Database
  *
  * @exampleDescription With `select()`
  * Postgres supports a number of [range
  * types](https://www.postgresql.org/docs/current/rangetypes.html). You
  * can filter on range columns using the string representation of range
  * values.
  *
  * @example With `select()`
  * ```ts
  * const { data, error } = await supabase
  *   .from('reservations')
  *   .select()
  *   .rangeAdjacent('during', '[2000-01-01 12:00, 2000-01-01 13:00)')
  * ```
  *
  * @exampleSql With `select()`
  * ```sql
  * create table
  *   reservations (
  *     id int8 primary key,
  *     room_name text,
  *     during tsrange
  *   );
  *
  * insert into
  *   reservations (id, room_name, during)
  * values
  *   (1, 'Emerald', '[2000-01-01 13:00, 2000-01-01 15:00)'),
  *   (2, 'Topaz', '[2000-01-02 09:00, 2000-01-02 10:00)');
  * ```
  *
  * @exampleResponse With `select()`
  * ```json
  * {
  *   "data": [
  *     {
  *       "id": 1,
  *       "room_name": "Emerald",
  *       "during": "[\"2000-01-01 13:00:00\",\"2000-01-01 15:00:00\")"
  *     }
  *   ],
  *   "status": 200,
  *   "statusText": "OK"
  * }
  * ```
  */
  rangeAdjacent(t, e) {
    return this.url.searchParams.append(t, `adj.${e}`), this;
  }
  /**
  * Only relevant for array and range columns. Match only rows where
  * `column` and `value` have an element in common.
  *
  * @param column - The array or range column to filter on
  * @param value - The array or range value to filter with
  *
  * @category Database
  *
  * @example On array columns
  * ```ts
  * const { data, error } = await supabase
  *   .from('issues')
  *   .select('title')
  *   .overlaps('tags', ['is:closed', 'severity:high'])
  * ```
  *
  * @exampleSql On array columns
  * ```sql
  * create table
  *   issues (
  *     id int8 primary key,
  *     title text,
  *     tags text[]
  *   );
  *
  * insert into
  *   issues (id, title, tags)
  * values
  *   (1, 'Cache invalidation is not working', array['is:open', 'severity:high', 'priority:low']),
  *   (2, 'Use better names', array['is:open', 'severity:low', 'priority:medium']);
  * ```
  *
  * @exampleResponse On array columns
  * ```json
  * {
  *   "data": [
  *     {
  *       "title": "Cache invalidation is not working"
  *     }
  *   ],
  *   "status": 200,
  *   "statusText": "OK"
  * }
  * ```
  *
  * @exampleDescription On range columns
  * Postgres supports a number of [range
  * types](https://www.postgresql.org/docs/current/rangetypes.html). You
  * can filter on range columns using the string representation of range
  * values.
  *
  * @example On range columns
  * ```ts
  * const { data, error } = await supabase
  *   .from('reservations')
  *   .select()
  *   .overlaps('during', '[2000-01-01 12:45, 2000-01-01 13:15)')
  * ```
  *
  * @exampleSql On range columns
  * ```sql
  * create table
  *   reservations (
  *     id int8 primary key,
  *     room_name text,
  *     during tsrange
  *   );
  *
  * insert into
  *   reservations (id, room_name, during)
  * values
  *   (1, 'Emerald', '[2000-01-01 13:00, 2000-01-01 15:00)'),
  *   (2, 'Topaz', '[2000-01-02 09:00, 2000-01-02 10:00)');
  * ```
  *
  * @exampleResponse On range columns
  * ```json
  * {
  *   "data": [
  *     {
  *       "id": 1,
  *       "room_name": "Emerald",
  *       "during": "[\"2000-01-01 13:00:00\",\"2000-01-01 15:00:00\")"
  *     }
  *   ],
  *   "status": 200,
  *   "statusText": "OK"
  * }
  * ```
  */
  overlaps(t, e) {
    return typeof e == "string" ? this.url.searchParams.append(t, `ov.${e}`) : this.url.searchParams.append(t, `ov.{${e.join(",")}}`), this;
  }
  /**
  * Only relevant for text and tsvector columns. Match only rows where
  * `column` matches the query string in `query`.
  *
  * @param column - The text or tsvector column to filter on
  * @param query - The query text to match with
  * @param options - Named parameters
  * @param options.config - The text search configuration to use
  * @param options.type - Change how the `query` text is interpreted
  *
  * @category Database
  *
  * @remarks
  * - For more information, see [Postgres full text search](/docs/guides/database/full-text-search).
  *
  * @example Text search
  * ```ts
  * const result = await supabase
  *   .from("texts")
  *   .select("content")
  *   .textSearch("content", `'eggs' & 'ham'`, {
  *     config: "english",
  *   });
  * ```
  *
  * @exampleSql Text search
  * ```sql
  * create table texts (
  *   id      bigint
  *           primary key
  *           generated always as identity,
  *   content text
  * );
  *
  * insert into texts (content) values
  *     ('Four score and seven years ago'),
  *     ('The road goes ever on and on'),
  *     ('Green eggs and ham')
  * ;
  * ```
  *
  * @exampleResponse Text search
  * ```json
  * {
  *   "data": [
  *     {
  *       "content": "Green eggs and ham"
  *     }
  *   ],
  *   "status": 200,
  *   "statusText": "OK"
  * }
  * ```
  *
  * @exampleDescription Basic normalization
  * Uses PostgreSQL's `plainto_tsquery` function.
  *
  * @example Basic normalization
  * ```ts
  * const { data, error } = await supabase
  *   .from('quotes')
  *   .select('catchphrase')
  *   .textSearch('catchphrase', `'fat' & 'cat'`, {
  *     type: 'plain',
  *     config: 'english'
  *   })
  * ```
  *
  * @exampleDescription Full normalization
  * Uses PostgreSQL's `phraseto_tsquery` function.
  *
  * @example Full normalization
  * ```ts
  * const { data, error } = await supabase
  *   .from('quotes')
  *   .select('catchphrase')
  *   .textSearch('catchphrase', `'fat' & 'cat'`, {
  *     type: 'phrase',
  *     config: 'english'
  *   })
  * ```
  *
  * @exampleDescription Websearch
  * Uses PostgreSQL's `websearch_to_tsquery` function.
  * This function will never raise syntax errors, which makes it possible to use raw user-supplied input for search, and can be used
  * with advanced operators.
  *
  * - `unquoted text`: text not inside quote marks will be converted to terms separated by & operators, as if processed by plainto_tsquery.
  * - `"quoted text"`: text inside quote marks will be converted to terms separated by `<->` operators, as if processed by phraseto_tsquery.
  * - `OR`: the word “or” will be converted to the | operator.
  * - `-`: a dash will be converted to the ! operator.
  *
  * @example Websearch
  * ```ts
  * const { data, error } = await supabase
  *   .from('quotes')
  *   .select('catchphrase')
  *   .textSearch('catchphrase', `'fat or cat'`, {
  *     type: 'websearch',
  *     config: 'english'
  *   })
  * ```
  */
  textSearch(t, e, { config: r, type: n } = {}) {
    let s = "";
    n === "plain" ? s = "pl" : n === "phrase" ? s = "ph" : n === "websearch" && (s = "w");
    const i = r === void 0 ? "" : `(${r})`;
    return this.url.searchParams.append(t, `${s}fts${i}.${e}`), this;
  }
  /**
  * Match only rows where each column in `query` keys is equal to its
  * associated value. Shorthand for multiple `.eq()`s.
  *
  * @param query - The object to filter with, with column names as keys mapped
  * to their filter values
  *
  * @category Database
  *
  * @example With `select()`
  * ```ts
  * const { data, error } = await supabase
  *   .from('characters')
  *   .select('name')
  *   .match({ id: 2, name: 'Leia' })
  * ```
  *
  * @exampleSql With `select()`
  * ```sql
  * create table
  *   characters (id int8 primary key, name text);
  *
  * insert into
  *   characters (id, name)
  * values
  *   (1, 'Luke'),
  *   (2, 'Leia'),
  *   (3, 'Han');
  * ```
  *
  * @exampleResponse With `select()`
  * ```json
  * {
  *   "data": [
  *     {
  *       "name": "Leia"
  *     }
  *   ],
  *   "status": 200,
  *   "statusText": "OK"
  * }
  * ```
  */
  match(t) {
    return Object.entries(t).filter(([e, r]) => r !== void 0).forEach(([e, r]) => {
      this.url.searchParams.append(e, `eq.${r}`);
    }), this;
  }
  /**
  * Match only rows which doesn't satisfy the filter.
  *
  * Unlike most filters, `opearator` and `value` are used as-is and need to
  * follow [PostgREST
  * syntax](https://postgrest.org/en/stable/api.html#operators). You also need
  * to make sure they are properly sanitized.
  *
  * @param column - The column to filter on
  * @param operator - The operator to be negated to filter with, following
  * PostgREST syntax
  * @param value - The value to filter with, following PostgREST syntax
  *
  * @category Database
  *
  * @remarks
  * not() expects you to use the raw PostgREST syntax for the filter values.
  *
  * ```ts
  * .not('id', 'in', '(5,6,7)')  // Use `()` for `in` filter
  * .not('arraycol', 'cs', '{"a","b"}')  // Use `cs` for `contains()`, `{}` for array values
  * ```
  *
  * @example With `select()`
  * ```ts
  * const { data, error } = await supabase
  *   .from('countries')
  *   .select()
  *   .not('name', 'is', null)
  * ```
  *
  * @exampleSql With `select()`
  * ```sql
  * create table
  *   countries (id int8 primary key, name text);
  *
  * insert into
  *   countries (id, name)
  * values
  *   (1, 'null'),
  *   (2, null);
  * ```
  *
  * @exampleResponse With `select()`
  * ```json
  *   {
  *     "data": [
  *       {
  *         "id": 1,
  *         "name": "null"
  *       }
  *     ],
  *     "status": 200,
  *     "statusText": "OK"
  *   }
  *
  * ```
  */
  not(t, e, r) {
    return this.url.searchParams.append(t, `not.${e}.${r}`), this;
  }
  /**
  * Match only rows which satisfy at least one of the filters.
  *
  * Unlike most filters, `filters` is used as-is and needs to follow [PostgREST
  * syntax](https://postgrest.org/en/stable/api.html#operators). You also need
  * to make sure it's properly sanitized.
  *
  * It's currently not possible to do an `.or()` filter across multiple tables.
  *
  * @param filters - The filters to use, following PostgREST syntax
  * @param options - Named parameters
  * @param options.referencedTable - Set this to filter on referenced tables
  * instead of the parent table
  * @param options.foreignTable - Deprecated, use `referencedTable` instead
  *
  * @category Database
  *
  * @remarks
  * or() expects you to use the raw PostgREST syntax for the filter names and values.
  *
  * ```ts
  * .or('id.in.(5,6,7), arraycol.cs.{"a","b"}')  // Use `()` for `in` filter, `{}` for array values and `cs` for `contains()`.
  * .or('id.in.(5,6,7), arraycol.cd.{"a","b"}')  // Use `cd` for `containedBy()`
  * ```
  *
  * @example With `select()`
  * ```ts
  * const { data, error } = await supabase
  *   .from('characters')
  *   .select('name')
  *   .or('id.eq.2,name.eq.Han')
  * ```
  *
  * @exampleSql With `select()`
  * ```sql
  * create table
  *   characters (id int8 primary key, name text);
  *
  * insert into
  *   characters (id, name)
  * values
  *   (1, 'Luke'),
  *   (2, 'Leia'),
  *   (3, 'Han');
  * ```
  *
  * @exampleResponse With `select()`
  * ```json
  * {
  *   "data": [
  *     {
  *       "name": "Leia"
  *     },
  *     {
  *       "name": "Han"
  *     }
  *   ],
  *   "status": 200,
  *   "statusText": "OK"
  * }
  * ```
  *
  * @example Use `or` with `and`
  * ```ts
  * const { data, error } = await supabase
  *   .from('characters')
  *   .select('name')
  *   .or('id.gt.3,and(id.eq.1,name.eq.Luke)')
  * ```
  *
  * @exampleSql Use `or` with `and`
  * ```sql
  * create table
  *   characters (id int8 primary key, name text);
  *
  * insert into
  *   characters (id, name)
  * values
  *   (1, 'Luke'),
  *   (2, 'Leia'),
  *   (3, 'Han');
  * ```
  *
  * @exampleResponse Use `or` with `and`
  * ```json
  * {
  *   "data": [
  *     {
  *       "name": "Luke"
  *     }
  *   ],
  *   "status": 200,
  *   "statusText": "OK"
  * }
  * ```
  *
  * @example Use `or` on referenced tables
  * ```ts
  * const { data, error } = await supabase
  *   .from('orchestral_sections')
  *   .select(`
  *     name,
  *     instruments!inner (
  *       name
  *     )
  *   `)
  *   .or('section_id.eq.1,name.eq.guzheng', { referencedTable: 'instruments' })
  * ```
  *
  * @exampleSql Use `or` on referenced tables
  * ```sql
  * create table
  *   orchestral_sections (id int8 primary key, name text);
  * create table
  *   instruments (
  *     id int8 primary key,
  *     section_id int8 not null references orchestral_sections,
  *     name text
  *   );
  *
  * insert into
  *   orchestral_sections (id, name)
  * values
  *   (1, 'strings'),
  *   (2, 'woodwinds');
  * insert into
  *   instruments (id, section_id, name)
  * values
  *   (1, 2, 'flute'),
  *   (2, 1, 'violin');
  * ```
  *
  * @exampleResponse Use `or` on referenced tables
  * ```json
  * {
  *   "data": [
  *     {
  *       "name": "strings",
  *       "instruments": [
  *         {
  *           "name": "violin"
  *         }
  *       ]
  *     }
  *   ],
  *   "status": 200,
  *   "statusText": "OK"
  * }
  * ```
  */
  or(t, { foreignTable: e, referencedTable: r = e } = {}) {
    const n = r ? `${r}.or` : "or";
    return this.url.searchParams.append(n, `(${t})`), this;
  }
  /**
  * Match only rows which satisfy the filter. This is an escape hatch - you
  * should use the specific filter methods wherever possible.
  *
  * Unlike most filters, `opearator` and `value` are used as-is and need to
  * follow [PostgREST
  * syntax](https://postgrest.org/en/stable/api.html#operators). You also need
  * to make sure they are properly sanitized.
  *
  * @param column - The column to filter on
  * @param operator - The operator to filter with, following PostgREST syntax
  * @param value - The value to filter with, following PostgREST syntax
  *
  * @category Database
  *
  * @remarks
  * filter() expects you to use the raw PostgREST syntax for the filter values.
  *
  * ```ts
  * .filter('id', 'in', '(5,6,7)')  // Use `()` for `in` filter
  * .filter('arraycol', 'cs', '{"a","b"}')  // Use `cs` for `contains()`, `{}` for array values
  * ```
  *
  * @example With `select()`
  * ```ts
  * const { data, error } = await supabase
  *   .from('characters')
  *   .select()
  *   .filter('name', 'in', '("Han","Yoda")')
  * ```
  *
  * @exampleSql With `select()`
  * ```sql
  * create table
  *   characters (id int8 primary key, name text);
  *
  * insert into
  *   characters (id, name)
  * values
  *   (1, 'Luke'),
  *   (2, 'Leia'),
  *   (3, 'Han');
  * ```
  *
  * @exampleResponse With `select()`
  * ```json
  * {
  *   "data": [
  *     {
  *       "id": 3,
  *       "name": "Han"
  *     }
  *   ],
  *   "status": 200,
  *   "statusText": "OK"
  * }
  * ```
  *
  * @example On a referenced table
  * ```ts
  * const { data, error } = await supabase
  *   .from('orchestral_sections')
  *   .select(`
  *     name,
  *     instruments!inner (
  *       name
  *     )
  *   `)
  *   .filter('instruments.name', 'eq', 'flute')
  * ```
  *
  * @exampleSql On a referenced table
  * ```sql
  * create table
  *   orchestral_sections (id int8 primary key, name text);
  * create table
  *    instruments (
  *     id int8 primary key,
  *     section_id int8 not null references orchestral_sections,
  *     name text
  *   );
  *
  * insert into
  *   orchestral_sections (id, name)
  * values
  *   (1, 'strings'),
  *   (2, 'woodwinds');
  * insert into
  *   instruments (id, section_id, name)
  * values
  *   (1, 2, 'flute'),
  *   (2, 1, 'violin');
  * ```
  *
  * @exampleResponse On a referenced table
  * ```json
  * {
  *   "data": [
  *     {
  *       "name": "woodwinds",
  *       "instruments": [
  *         {
  *           "name": "flute"
  *         }
  *       ]
  *     }
  *   ],
  *   "status": 200,
  *   "statusText": "OK"
  * }
  * ```
  */
  filter(t, e, r) {
    return this.url.searchParams.append(t, `${e}.${r}`), this;
  }
}, ed = class {
  /**
  * Creates a query builder scoped to a Postgres table or view.
  *
  * @category Database
  *
  * @param url - The URL for the query
  * @param options - Named parameters
  * @param options.headers - Custom headers
  * @param options.schema - Postgres schema to use
  * @param options.fetch - Custom fetch implementation
  * @param options.urlLengthLimit - Maximum URL length before warning
  * @param options.retry - Enable automatic retries for transient errors (default: true)
  *
  * @example Using supabase-js (recommended)
  * ```ts
  * import { createClient } from '@supabase/supabase-js'
  *
  * const supabase = createClient('https://xyzcompany.supabase.co', 'publishable-or-anon-key')
  * const { data, error } = await supabase.from('users').select('*')
  * ```
  *
  * @example Standalone import for bundle-sensitive environments
  * ```ts
  * import { PostgrestQueryBuilder } from '@supabase/postgrest-js'
  *
  * const query = new PostgrestQueryBuilder(
  *   new URL('https://xyzcompany.supabase.co/rest/v1/users'),
  *   { headers: { apikey: 'publishable-or-anon-key' }, retry: true }
  * )
  * ```
  */
  constructor(t, { headers: e = {}, schema: r, fetch: n, urlLengthLimit: s = 8e3, retry: i }) {
    this.url = t, this.headers = new Headers(e), this.schema = r, this.fetch = n, this.urlLengthLimit = s, this.retry = i;
  }
  /**
  * Clone URL and headers to prevent shared state between operations.
  */
  cloneRequestState() {
    return {
      url: new URL(this.url.toString()),
      headers: new Headers(this.headers)
    };
  }
  /**
  * Perform a SELECT query on the table or view.
  *
  * @param columns - The columns to retrieve, separated by commas. Columns can be renamed when returned with `customName:columnName`
  *
  * @param options - Named parameters
  *
  * @param options.head - When set to `true`, `data` will not be returned.
  * Useful if you only need the count.
  *
  * @param options.count - Count algorithm to use to count rows in the table or view.
  *
  * `"exact"`: Exact but slow count algorithm. Performs a `COUNT(*)` under the
  * hood.
  *
  * `"planned"`: Approximated but fast count algorithm. Uses the Postgres
  * statistics under the hood.
  *
  * `"estimated"`: Uses exact count for low numbers and planned count for high
  * numbers.
  *
  * @remarks
  * When using `count` with `.range()` or `.limit()`, the returned `count` is the total number of rows
  * that match your filters, not the number of rows in the current page. Use this to build pagination UI.
  
  * - By default, Supabase projects return a maximum of 1,000 rows. This setting can be changed in your project's [API settings](/dashboard/project/_/settings/api). It's recommended that you keep it low to limit the payload size of accidental or malicious requests. You can use `range()` queries to paginate through your data.
  * - `select()` can be combined with [Filters](/docs/reference/javascript/using-filters)
  * - `select()` can be combined with [Modifiers](/docs/reference/javascript/using-modifiers)
  * - `apikey` is a reserved keyword if you're using the [Supabase Platform](/docs/guides/platform) and [should be avoided as a column name](https://github.com/supabase/supabase/issues/5465). *
  * @category Database
  *
  * @example Getting your data
  * ```js
  * const { data, error } = await supabase
  *   .from('characters')
  *   .select()
  * ```
  *
  * @exampleSql Getting your data
  * ```sql
  * create table
  *   characters (id int8 primary key, name text);
  *
  * insert into
  *   characters (id, name)
  * values
  *   (1, 'Harry'),
  *   (2, 'Frodo'),
  *   (3, 'Katniss');
  * ```
  *
  * @exampleResponse Getting your data
  * ```json
  * {
  *   "data": [
  *     {
  *       "id": 1,
  *       "name": "Harry"
  *     },
  *     {
  *       "id": 2,
  *       "name": "Frodo"
  *     },
  *     {
  *       "id": 3,
  *       "name": "Katniss"
  *     }
  *   ],
  *   "status": 200,
  *   "statusText": "OK"
  * }
  * ```
  *
  * @example Selecting specific columns
  * ```js
  * const { data, error } = await supabase
  *   .from('characters')
  *   .select('name')
  * ```
  *
  * @exampleSql Selecting specific columns
  * ```sql
  * create table
  *   characters (id int8 primary key, name text);
  *
  * insert into
  *   characters (id, name)
  * values
  *   (1, 'Frodo'),
  *   (2, 'Harry'),
  *   (3, 'Katniss');
  * ```
  *
  * @exampleResponse Selecting specific columns
  * ```json
  * {
  *   "data": [
  *     {
  *       "name": "Frodo"
  *     },
  *     {
  *       "name": "Harry"
  *     },
  *     {
  *       "name": "Katniss"
  *     }
  *   ],
  *   "status": 200,
  *   "statusText": "OK"
  * }
  * ```
  *
  * @exampleDescription Query referenced tables
  * If your database has foreign key relationships, you can query related tables too.
  *
  * @example Query referenced tables
  * ```js
  * const { data, error } = await supabase
  *   .from('orchestral_sections')
  *   .select(`
  *     name,
  *     instruments (
  *       name
  *     )
  *   `)
  * ```
  *
  * @exampleSql Query referenced tables
  * ```sql
  * create table
  *   orchestral_sections (id int8 primary key, name text);
  * create table
  *   instruments (
  *     id int8 primary key,
  *     section_id int8 not null references orchestral_sections,
  *     name text
  *   );
  *
  * insert into
  *   orchestral_sections (id, name)
  * values
  *   (1, 'strings'),
  *   (2, 'woodwinds');
  * insert into
  *   instruments (id, section_id, name)
  * values
  *   (1, 2, 'flute'),
  *   (2, 1, 'violin');
  * ```
  *
  * @exampleResponse Query referenced tables
  * ```json
  * {
  *   "data": [
  *     {
  *       "name": "strings",
  *       "instruments": [
  *         {
  *           "name": "violin"
  *         }
  *       ]
  *     },
  *     {
  *       "name": "woodwinds",
  *       "instruments": [
  *         {
  *           "name": "flute"
  *         }
  *       ]
  *     }
  *   ],
  *   "status": 200,
  *   "statusText": "OK"
  * }
  * ```
  *
  * @exampleDescription Query referenced tables with spaces in their names
  * If your table name contains spaces, you must use double quotes in the `select` statement to reference the table.
  *
  * @example Query referenced tables with spaces in their names
  * ```js
  * const { data, error } = await supabase
  *   .from('orchestral sections')
  *   .select(`
  *     name,
  *     "musical instruments" (
  *       name
  *     )
  *   `)
  * ```
  *
  * @exampleSql Query referenced tables with spaces in their names
  * ```sql
  * create table
  *   "orchestral sections" (id int8 primary key, name text);
  * create table
  *   "musical instruments" (
  *     id int8 primary key,
  *     section_id int8 not null references "orchestral sections",
  *     name text
  *   );
  *
  * insert into
  *   "orchestral sections" (id, name)
  * values
  *   (1, 'strings'),
  *   (2, 'woodwinds');
  * insert into
  *   "musical instruments" (id, section_id, name)
  * values
  *   (1, 2, 'flute'),
  *   (2, 1, 'violin');
  * ```
  *
  * @exampleResponse Query referenced tables with spaces in their names
  * ```json
  * {
  *   "data": [
  *     {
  *       "name": "strings",
  *       "musical instruments": [
  *         {
  *           "name": "violin"
  *         }
  *       ]
  *     },
  *     {
  *       "name": "woodwinds",
  *       "musical instruments": [
  *         {
  *           "name": "flute"
  *         }
  *       ]
  *     }
  *   ],
  *   "status": 200,
  *   "statusText": "OK"
  * }
  * ```
  *
  * @exampleDescription Query referenced tables through a join table
  * If you're in a situation where your tables are **NOT** directly
  * related, but instead are joined by a _join table_, you can still use
  * the `select()` method to query the related data. The join table needs
  * to have the foreign keys as part of its composite primary key.
  *
  * @example Query referenced tables through a join table
  * ```ts
  * const { data, error } = await supabase
  *   .from('users')
  *   .select(`
  *     name,
  *     teams (
  *       name
  *     )
  *   `)
  *   
  * ```
  *
  * @exampleSql Query referenced tables through a join table
  * ```sql
  * create table
  *   users (
  *     id int8 primary key,
  *     name text
  *   );
  * create table
  *   teams (
  *     id int8 primary key,
  *     name text
  *   );
  * -- join table
  * create table
  *   users_teams (
  *     user_id int8 not null references users,
  *     team_id int8 not null references teams,
  *     -- both foreign keys must be part of a composite primary key
  *     primary key (user_id, team_id)
  *   );
  *
  * insert into
  *   users (id, name)
  * values
  *   (1, 'Kiran'),
  *   (2, 'Evan');
  * insert into
  *   teams (id, name)
  * values
  *   (1, 'Green'),
  *   (2, 'Blue');
  * insert into
  *   users_teams (user_id, team_id)
  * values
  *   (1, 1),
  *   (1, 2),
  *   (2, 2);
  * ```
  *
  * @exampleResponse Query referenced tables through a join table
  * ```json
  *   {
  *     "data": [
  *       {
  *         "name": "Kiran",
  *         "teams": [
  *           {
  *             "name": "Green"
  *           },
  *           {
  *             "name": "Blue"
  *           }
  *         ]
  *       },
  *       {
  *         "name": "Evan",
  *         "teams": [
  *           {
  *             "name": "Blue"
  *           }
  *         ]
  *       }
  *     ],
  *     "status": 200,
  *     "statusText": "OK"
  *   }
  *   
  * ```
  *
  * @exampleDescription Query the same referenced table multiple times
  * If you need to query the same referenced table twice, use the name of the
  * joined column to identify which join to use. You can also give each
  * column an alias.
  *
  * @example Query the same referenced table multiple times
  * ```ts
  * const { data, error } = await supabase
  *   .from('messages')
  *   .select(`
  *     content,
  *     from:sender_id(name),
  *     to:receiver_id(name)
  *   `)
  *
  * // To infer types, use the name of the table (in this case `users`) and
  * // the name of the foreign key constraint.
  * const { data, error } = await supabase
  *   .from('messages')
  *   .select(`
  *     content,
  *     from:users!messages_sender_id_fkey(name),
  *     to:users!messages_receiver_id_fkey(name)
  *   `)
  * ```
  *
  * @exampleSql Query the same referenced table multiple times
  * ```sql
  *  create table
  *  users (id int8 primary key, name text);
  *
  *  create table
  *    messages (
  *      sender_id int8 not null references users,
  *      receiver_id int8 not null references users,
  *      content text
  *    );
  *
  *  insert into
  *    users (id, name)
  *  values
  *    (1, 'Kiran'),
  *    (2, 'Evan');
  *
  *  insert into
  *    messages (sender_id, receiver_id, content)
  *  values
  *    (1, 2, '👋');
  *  ```
  * ```
  *
  * @exampleResponse Query the same referenced table multiple times
  * ```json
  * {
  *   "data": [
  *     {
  *       "content": "👋",
  *       "from": {
  *         "name": "Kiran"
  *       },
  *       "to": {
  *         "name": "Evan"
  *       }
  *     }
  *   ],
  *   "status": 200,
  *   "statusText": "OK"
  * }
  * ```
  *
  * @exampleDescription Query nested foreign tables through a join table
  * You can use the result of a joined table to gather data in
  * another foreign table. With multiple references to the same foreign
  * table you must specify the column on which to conduct the join.
  *
  * @example Query nested foreign tables through a join table
  * ```ts
  *   const { data, error } = await supabase
  *     .from('games')
  *     .select(`
  *       game_id:id,
  *       away_team:teams!games_away_team_fkey (
  *         users (
  *           id,
  *           name
  *         )
  *       )
  *     `)
  *   
  * ```
  *
  * @exampleSql Query nested foreign tables through a join table
  * ```sql
  * ```sql
  * create table
  *   users (
  *     id int8 primary key,
  *     name text
  *   );
  * create table
  *   teams (
  *     id int8 primary key,
  *     name text
  *   );
  * -- join table
  * create table
  *   users_teams (
  *     user_id int8 not null references users,
  *     team_id int8 not null references teams,
  *
  *     primary key (user_id, team_id)
  *   );
  * create table
  *   games (
  *     id int8 primary key,
  *     home_team int8 not null references teams,
  *     away_team int8 not null references teams,
  *     name text
  *   );
  *
  * insert into users (id, name)
  * values
  *   (1, 'Kiran'),
  *   (2, 'Evan');
  * insert into
  *   teams (id, name)
  * values
  *   (1, 'Green'),
  *   (2, 'Blue');
  * insert into
  *   users_teams (user_id, team_id)
  * values
  *   (1, 1),
  *   (1, 2),
  *   (2, 2);
  * insert into
  *   games (id, home_team, away_team, name)
  * values
  *   (1, 1, 2, 'Green vs Blue'),
  *   (2, 2, 1, 'Blue vs Green');
  * ```
  *
  * @exampleResponse Query nested foreign tables through a join table
  * ```json
  *   {
  *     "data": [
  *       {
  *         "game_id": 1,
  *         "away_team": {
  *           "users": [
  *             {
  *               "id": 1,
  *               "name": "Kiran"
  *             },
  *             {
  *               "id": 2,
  *               "name": "Evan"
  *             }
  *           ]
  *         }
  *       },
  *       {
  *         "game_id": 2,
  *         "away_team": {
  *           "users": [
  *             {
  *               "id": 1,
  *               "name": "Kiran"
  *             }
  *           ]
  *         }
  *       }
  *     ],
  *     "status": 200,
  *     "statusText": "OK"
  *   }
  *   
  * ```
  *
  * @exampleDescription Filtering through referenced tables
  * If the filter on a referenced table's column is not satisfied, the referenced
  * table returns `[]` or `null` but the parent table is not filtered out.
  * If you want to filter out the parent table rows, use the `!inner` hint
  *
  * @example Filtering through referenced tables
  * ```ts
  * const { data, error } = await supabase
  *   .from('instruments')
  *   .select('name, orchestral_sections(*)')
  *   .eq('orchestral_sections.name', 'percussion')
  * ```
  *
  * @exampleSql Filtering through referenced tables
  * ```sql
  * create table
  *   orchestral_sections (id int8 primary key, name text);
  * create table
  *   instruments (
  *     id int8 primary key,
  *     section_id int8 not null references orchestral_sections,
  *     name text
  *   );
  *
  * insert into
  *   orchestral_sections (id, name)
  * values
  *   (1, 'strings'),
  *   (2, 'woodwinds');
  * insert into
  *   instruments (id, section_id, name)
  * values
  *   (1, 2, 'flute'),
  *   (2, 1, 'violin');
  * ```
  *
  * @exampleResponse Filtering through referenced tables
  * ```json
  * {
  *   "data": [
  *     {
  *       "name": "flute",
  *       "orchestral_sections": null
  *     },
  *     {
  *       "name": "violin",
  *       "orchestral_sections": null
  *     }
  *   ],
  *   "status": 200,
  *   "statusText": "OK"
  * }
  * ```
  *
  * @exampleDescription Querying referenced table with count
  * You can get the number of rows in a related table by using the
  * **count** property.
  *
  * @example Querying referenced table with count
  * ```ts
  * const { data, error } = await supabase
  *   .from('orchestral_sections')
  *   .select(`*, instruments(count)`)
  * ```
  *
  * @exampleSql Querying referenced table with count
  * ```sql
  * create table orchestral_sections (
  *   "id" "uuid" primary key default "extensions"."uuid_generate_v4"() not null,
  *   "name" text
  * );
  *
  * create table characters (
  *   "id" "uuid" primary key default "extensions"."uuid_generate_v4"() not null,
  *   "name" text,
  *   "section_id" "uuid" references public.orchestral_sections on delete cascade
  * );
  *
  * with section as (
  *   insert into orchestral_sections (name)
  *   values ('strings') returning id
  * )
  * insert into instruments (name, section_id) values
  * ('violin', (select id from section)),
  * ('viola', (select id from section)),
  * ('cello', (select id from section)),
  * ('double bass', (select id from section));
  * ```
  *
  * @exampleResponse Querying referenced table with count
  * ```json
  * [
  *   {
  *     "id": "693694e7-d993-4360-a6d7-6294e325d9b6",
  *     "name": "strings",
  *     "instruments": [
  *       {
  *         "count": 4
  *       }
  *     ]
  *   }
  * ]
  * ```
  *
  * @exampleDescription Querying with count option
  * You can get the number of rows by using the
  * [count](/docs/reference/javascript/select#parameters) option.
  *
  * @example Querying with count option
  * ```ts
  * const { count, error } = await supabase
  *   .from('characters')
  *   .select('*', { count: 'exact', head: true })
  * ```
  *
  * @exampleSql Querying with count option
  * ```sql
  * create table
  *   characters (id int8 primary key, name text);
  *
  * insert into
  *   characters (id, name)
  * values
  *   (1, 'Luke'),
  *   (2, 'Leia'),
  *   (3, 'Han');
  * ```
  *
  * @exampleResponse Querying with count option
  * ```json
  * {
  *   "count": 3,
  *   "status": 200,
  *   "statusText": "OK"
  * }
  * ```
  *
  * @exampleDescription Querying JSON data
  * You can select and filter data inside of
  * [JSON](/docs/guides/database/json) columns. Postgres offers some
  * [operators](/docs/guides/database/json#query-the-jsonb-data) for
  * querying JSON data.
  *
  * @example Querying JSON data
  * ```ts
  * const { data, error } = await supabase
  *   .from('users')
  *   .select(`
  *     id, name,
  *     address->city
  *   `)
  * ```
  *
  * @exampleSql Querying JSON data
  * ```sql
  * create table
  *   users (
  *     id int8 primary key,
  *     name text,
  *     address jsonb
  *   );
  *
  * insert into
  *   users (id, name, address)
  * values
  *   (1, 'Frodo', '{"city":"Hobbiton"}');
  * ```
  *
  * @exampleResponse Querying JSON data
  * ```json
  * {
  *   "data": [
  *     {
  *       "id": 1,
  *       "name": "Frodo",
  *       "city": "Hobbiton"
  *     }
  *   ],
  *   "status": 200,
  *   "statusText": "OK"
  * }
  * ```
  *
  * @exampleDescription Querying referenced table with inner join
  * If you don't want to return the referenced table contents, you can leave the parenthesis empty.
  * Like `.select('name, orchestral_sections!inner()')`.
  *
  * @example Querying referenced table with inner join
  * ```ts
  * const { data, error } = await supabase
  *   .from('instruments')
  *   .select('name, orchestral_sections!inner(name)')
  *   .eq('orchestral_sections.name', 'woodwinds')
  *   .limit(1)
  * ```
  *
  * @exampleSql Querying referenced table with inner join
  * ```sql
  * create table orchestral_sections (
  *   "id" "uuid" primary key default "extensions"."uuid_generate_v4"() not null,
  *   "name" text
  * );
  *
  * create table instruments (
  *   "id" "uuid" primary key default "extensions"."uuid_generate_v4"() not null,
  *   "name" text,
  *   "section_id" "uuid" references public.orchestral_sections on delete cascade
  * );
  *
  * with section as (
  *   insert into orchestral_sections (name)
  *   values ('woodwinds') returning id
  * )
  * insert into instruments (name, section_id) values
  * ('flute', (select id from section)),
  * ('clarinet', (select id from section)),
  * ('bassoon', (select id from section)),
  * ('piccolo', (select id from section));
  * ```
  *
  * @exampleResponse Querying referenced table with inner join
  * ```json
  * {
  *   "data": [
  *     {
  *       "name": "flute",
  *       "orchestral_sections": {"name": "woodwinds"}
  *     }
  *   ],
  *   "status": 200,
  *   "statusText": "OK"
  * }
  * ```
  *
  * @exampleDescription Switching schemas per query
  * In addition to setting the schema during initialization, you can also switch schemas on a per-query basis.
  * Make sure you've set up your [database privileges and API settings](/docs/guides/api/using-custom-schemas).
  *
  * @example Switching schemas per query
  * ```ts
  * const { data, error } = await supabase
  *   .schema('myschema')
  *   .from('mytable')
  *   .select()
  * ```
  *
  * @exampleSql Switching schemas per query
  * ```sql
  * create schema myschema;
  *
  * create table myschema.mytable (
  *   id uuid primary key default gen_random_uuid(),
  *   data text
  * );
  *
  * insert into myschema.mytable (data) values ('mydata');
  * ```
  *
  * @exampleResponse Switching schemas per query
  * ```json
  * {
  *   "data": [
  *     {
  *       "id": "4162e008-27b0-4c0f-82dc-ccaeee9a624d",
  *       "data": "mydata"
  *     }
  *   ],
  *   "status": 200,
  *   "statusText": "OK"
  * }
  * ```
  */
  select(t, e) {
    const { head: r = !1, count: n } = e ?? {}, s = r ? "HEAD" : "GET";
    let i = !1;
    const o = (t ?? "*").split("").map((u) => /\s/.test(u) && !i ? "" : (u === '"' && (i = !i), u)).join(""), { url: a, headers: c } = this.cloneRequestState();
    return a.searchParams.set("select", o), n && c.append("Prefer", `count=${n}`), new pt({
      method: s,
      url: a,
      headers: c,
      schema: this.schema,
      fetch: this.fetch,
      urlLengthLimit: this.urlLengthLimit,
      retry: this.retry
    });
  }
  /**
  * Perform an INSERT into the table or view.
  *
  * By default, inserted rows are not returned. To return it, chain the call
  * with `.select()`.
  *
  * @param values - The values to insert. Pass an object to insert a single row
  * or an array to insert multiple rows.
  *
  * @param options - Named parameters
  *
  * @param options.count - Count algorithm to use to count inserted rows.
  *
  * `"exact"`: Exact but slow count algorithm. Performs a `COUNT(*)` under the
  * hood.
  *
  * `"planned"`: Approximated but fast count algorithm. Uses the Postgres
  * statistics under the hood.
  *
  * `"estimated"`: Uses exact count for low numbers and planned count for high
  * numbers.
  *
  * @param options.defaultToNull - Make missing fields default to `null`.
  * Otherwise, use the default value for the column. Only applies for bulk
  * inserts.
  *
  * @category Database
  *
  * @example Create a record
  * ```ts
  * const { error } = await supabase
  *   .from('countries')
  *   .insert({ id: 1, name: 'Mordor' })
  * ```
  *
  * @exampleSql Create a record
  * ```sql
  * create table
  *   countries (id int8 primary key, name text);
  * ```
  *
  * @exampleResponse Create a record
  * ```json
  * {
  *   "status": 201,
  *   "statusText": "Created"
  * }
  * ```
  *
  * @example Create a record and return it
  * ```ts
  * const { data, error } = await supabase
  *   .from('countries')
  *   .insert({ id: 1, name: 'Mordor' })
  *   .select()
  * ```
  *
  * @exampleSql Create a record and return it
  * ```sql
  * create table
  *   countries (id int8 primary key, name text);
  * ```
  *
  * @exampleResponse Create a record and return it
  * ```json
  * {
  *   "data": [
  *     {
  *       "id": 1,
  *       "name": "Mordor"
  *     }
  *   ],
  *   "status": 201,
  *   "statusText": "Created"
  * }
  * ```
  *
  * @exampleDescription Bulk create
  * A bulk create operation is handled in a single transaction.
  * If any of the inserts fail, none of the rows are inserted.
  *
  * @example Bulk create
  * ```ts
  * const { error } = await supabase
  *   .from('countries')
  *   .insert([
  *     { id: 1, name: 'Mordor' },
  *     { id: 1, name: 'The Shire' },
  *   ])
  * ```
  *
  * @exampleSql Bulk create
  * ```sql
  * create table
  *   countries (id int8 primary key, name text);
  * ```
  *
  * @exampleResponse Bulk create
  * ```json
  * {
  *   "error": {
  *     "code": "23505",
  *     "details": "Key (id)=(1) already exists.",
  *     "hint": null,
  *     "message": "duplicate key value violates unique constraint \"countries_pkey\""
  *   },
  *   "status": 409,
  *   "statusText": "Conflict"
  * }
  * ```
  */
  insert(t, { count: e, defaultToNull: r = !0 } = {}) {
    var n;
    const s = "POST", { url: i, headers: o } = this.cloneRequestState();
    if (e && o.append("Prefer", `count=${e}`), r || o.append("Prefer", "missing=default"), Array.isArray(t)) {
      const a = t.reduce((c, u) => c.concat(Object.keys(u)), []);
      if (a.length > 0) {
        const c = [...new Set(a)].map((u) => `"${u}"`);
        i.searchParams.set("columns", c.join(","));
      }
    }
    return new pt({
      method: s,
      url: i,
      headers: o,
      schema: this.schema,
      body: t,
      fetch: (n = this.fetch) !== null && n !== void 0 ? n : fetch,
      urlLengthLimit: this.urlLengthLimit,
      retry: this.retry
    });
  }
  /**
  * Perform an UPSERT on the table or view. Depending on the column(s) passed
  * to `onConflict`, `.upsert()` allows you to perform the equivalent of
  * `.insert()` if a row with the corresponding `onConflict` columns doesn't
  * exist, or if it does exist, perform an alternative action depending on
  * `ignoreDuplicates`.
  *
  * By default, upserted rows are not returned. To return it, chain the call
  * with `.select()`.
  *
  * @param values - The values to upsert with. Pass an object to upsert a
  * single row or an array to upsert multiple rows.
  *
  * @param options - Named parameters
  *
  * @param options.onConflict - Comma-separated UNIQUE column(s) to specify how
  * duplicate rows are determined. Two rows are duplicates if all the
  * `onConflict` columns are equal.
  *
  * @param options.ignoreDuplicates - If `true`, duplicate rows are ignored. If
  * `false`, duplicate rows are merged with existing rows.
  *
  * @param options.count - Count algorithm to use to count upserted rows.
  *
  * `"exact"`: Exact but slow count algorithm. Performs a `COUNT(*)` under the
  * hood.
  *
  * `"planned"`: Approximated but fast count algorithm. Uses the Postgres
  * statistics under the hood.
  *
  * `"estimated"`: Uses exact count for low numbers and planned count for high
  * numbers.
  *
  * @param options.defaultToNull - Make missing fields default to `null`.
  * Otherwise, use the default value for the column. This only applies when
  * inserting new rows, not when merging with existing rows under
  * `ignoreDuplicates: false`. This also only applies when doing bulk upserts.
  *
  * @example Upsert a single row using a unique key
  * ```ts
  * // Upserting a single row, overwriting based on the 'username' unique column
  * const { data, error } = await supabase
  *   .from('users')
  *   .upsert({ username: 'supabot' }, { onConflict: 'username' })
  *
  * // Example response:
  * // {
  * //   data: [
  * //     { id: 4, message: 'bar', username: 'supabot' }
  * //   ],
  * //   error: null
  * // }
  * ```
  *
  * @example Upsert with conflict resolution and exact row counting
  * ```ts
  * // Upserting and returning exact count
  * const { data, error, count } = await supabase
  *   .from('users')
  *   .upsert(
  *     {
  *       id: 3,
  *       message: 'foo',
  *       username: 'supabot'
  *     },
  *     {
  *       onConflict: 'username',
  *       count: 'exact'
  *     }
  *   )
  *
  * // Example response:
  * // {
  * //   data: [
  * //     {
  * //       id: 42,
  * //       handle: "saoirse",
  * //       display_name: "Saoirse"
  * //     }
  * //   ],
  * //   count: 1,
  * //   error: null
  * // }
  * ```
  *
  * @category Database
  *
  * @remarks
  * - Primary keys must be included in `values` to use upsert.
  *
  * @example Upsert your data
  * ```ts
  * const { data, error } = await supabase
  *   .from('instruments')
  *   .upsert({ id: 1, name: 'piano' })
  *   .select()
  * ```
  *
  * @exampleSql Upsert your data
  * ```sql
  * create table
  *   instruments (id int8 primary key, name text);
  *
  * insert into
  *   instruments (id, name)
  * values
  *   (1, 'harpsichord');
  * ```
  *
  * @exampleResponse Upsert your data
  * ```json
  * {
  *   "data": [
  *     {
  *       "id": 1,
  *       "name": "piano"
  *     }
  *   ],
  *   "status": 201,
  *   "statusText": "Created"
  * }
  * ```
  *
  * @example Bulk Upsert your data
  * ```ts
  * const { data, error } = await supabase
  *   .from('instruments')
  *   .upsert([
  *     { id: 1, name: 'piano' },
  *     { id: 2, name: 'harp' },
  *   ])
  *   .select()
  * ```
  *
  * @exampleSql Bulk Upsert your data
  * ```sql
  * create table
  *   instruments (id int8 primary key, name text);
  *
  * insert into
  *   instruments (id, name)
  * values
  *   (1, 'harpsichord');
  * ```
  *
  * @exampleResponse Bulk Upsert your data
  * ```json
  * {
  *   "data": [
  *     {
  *       "id": 1,
  *       "name": "piano"
  *     },
  *     {
  *       "id": 2,
  *       "name": "harp"
  *     }
  *   ],
  *   "status": 201,
  *   "statusText": "Created"
  * }
  * ```
  *
  * @exampleDescription Upserting into tables with constraints
  * In the following query, `upsert()` implicitly uses the `id`
  * (primary key) column to determine conflicts. If there is no existing
  * row with the same `id`, `upsert()` inserts a new row, which
  * will fail in this case as there is already a row with `handle` `"saoirse"`.
  * Using the `onConflict` option, you can instruct `upsert()` to use
  * another column with a unique constraint to determine conflicts.
  *
  * @example Upserting into tables with constraints
  * ```ts
  * const { data, error } = await supabase
  *   .from('users')
  *   .upsert({ id: 42, handle: 'saoirse', display_name: 'Saoirse' })
  *   .select()
  * ```
  *
  * @exampleSql Upserting into tables with constraints
  * ```sql
  * create table
  *   users (
  *     id int8 generated by default as identity primary key,
  *     handle text not null unique,
  *     display_name text
  *   );
  *
  * insert into
  *   users (id, handle, display_name)
  * values
  *   (1, 'saoirse', null);
  * ```
  *
  * @exampleResponse Upserting into tables with constraints
  * ```json
  * {
  *   "error": {
  *     "code": "23505",
  *     "details": "Key (handle)=(saoirse) already exists.",
  *     "hint": null,
  *     "message": "duplicate key value violates unique constraint \"users_handle_key\""
  *   },
  *   "status": 409,
  *   "statusText": "Conflict"
  * }
  * ```
  */
  upsert(t, { onConflict: e, ignoreDuplicates: r = !1, count: n, defaultToNull: s = !0 } = {}) {
    var i;
    const o = "POST", { url: a, headers: c } = this.cloneRequestState();
    if (c.append("Prefer", `resolution=${r ? "ignore" : "merge"}-duplicates`), e !== void 0 && a.searchParams.set("on_conflict", e), n && c.append("Prefer", `count=${n}`), s || c.append("Prefer", "missing=default"), Array.isArray(t)) {
      const u = t.reduce((l, h) => l.concat(Object.keys(h)), []);
      if (u.length > 0) {
        const l = [...new Set(u)].map((h) => `"${h}"`);
        a.searchParams.set("columns", l.join(","));
      }
    }
    return new pt({
      method: o,
      url: a,
      headers: c,
      schema: this.schema,
      body: t,
      fetch: (i = this.fetch) !== null && i !== void 0 ? i : fetch,
      urlLengthLimit: this.urlLengthLimit,
      retry: this.retry
    });
  }
  /**
  * Perform an UPDATE on the table or view.
  *
  * By default, updated rows are not returned. To return it, chain the call
  * with `.select()` after filters.
  *
  * @param values - The values to update with
  *
  * @param options - Named parameters
  *
  * @param options.count - Count algorithm to use to count updated rows.
  *
  * `"exact"`: Exact but slow count algorithm. Performs a `COUNT(*)` under the
  * hood.
  *
  * `"planned"`: Approximated but fast count algorithm. Uses the Postgres
  * statistics under the hood.
  *
  * `"estimated"`: Uses exact count for low numbers and planned count for high
  * numbers.
  *
  * @category Database
  *
  * @remarks
  * - `update()` should always be combined with [Filters](/docs/reference/javascript/using-filters) to target the item(s) you wish to update.
  *
  * @example Updating your data
  * ```ts
  * const { error } = await supabase
  *   .from('instruments')
  *   .update({ name: 'piano' })
  *   .eq('id', 1)
  * ```
  *
  * @exampleSql Updating your data
  * ```sql
  * create table
  *   instruments (id int8 primary key, name text);
  *
  * insert into
  *   instruments (id, name)
  * values
  *   (1, 'harpsichord');
  * ```
  *
  * @exampleResponse Updating your data
  * ```json
  * {
  *   "status": 204,
  *   "statusText": "No Content"
  * }
  * ```
  *
  * @example Update a record and return it
  * ```ts
  * const { data, error } = await supabase
  *   .from('instruments')
  *   .update({ name: 'piano' })
  *   .eq('id', 1)
  *   .select()
  * ```
  *
  * @exampleSql Update a record and return it
  * ```sql
  * create table
  *   instruments (id int8 primary key, name text);
  *
  * insert into
  *   instruments (id, name)
  * values
  *   (1, 'harpsichord');
  * ```
  *
  * @exampleResponse Update a record and return it
  * ```json
  * {
  *   "data": [
  *     {
  *       "id": 1,
  *       "name": "piano"
  *     }
  *   ],
  *   "status": 200,
  *   "statusText": "OK"
  * }
  * ```
  *
  * @exampleDescription Updating JSON data
  * Postgres offers some
  * [operators](/docs/guides/database/json#query-the-jsonb-data) for
  * working with JSON data. Currently, it is only possible to update the entire JSON document.
  *
  * @example Updating JSON data
  * ```ts
  * const { data, error } = await supabase
  *   .from('users')
  *   .update({
  *     address: {
  *       street: 'Melrose Place',
  *       postcode: 90210
  *     }
  *   })
  *   .eq('address->postcode', 90210)
  *   .select()
  * ```
  *
  * @exampleSql Updating JSON data
  * ```sql
  * create table
  *   users (
  *     id int8 primary key,
  *     name text,
  *     address jsonb
  *   );
  *
  * insert into
  *   users (id, name, address)
  * values
  *   (1, 'Michael', '{ "postcode": 90210 }');
  * ```
  *
  * @exampleResponse Updating JSON data
  * ```json
  * {
  *   "data": [
  *     {
  *       "id": 1,
  *       "name": "Michael",
  *       "address": {
  *         "street": "Melrose Place",
  *         "postcode": 90210
  *       }
  *     }
  *   ],
  *   "status": 200,
  *   "statusText": "OK"
  * }
  * ```
  */
  update(t, { count: e } = {}) {
    var r;
    const n = "PATCH", { url: s, headers: i } = this.cloneRequestState();
    return e && i.append("Prefer", `count=${e}`), new pt({
      method: n,
      url: s,
      headers: i,
      schema: this.schema,
      body: t,
      fetch: (r = this.fetch) !== null && r !== void 0 ? r : fetch,
      urlLengthLimit: this.urlLengthLimit,
      retry: this.retry
    });
  }
  /**
  * Perform a DELETE on the table or view.
  *
  * By default, deleted rows are not returned. To return it, chain the call
  * with `.select()` after filters.
  *
  * @param options - Named parameters
  *
  * @param options.count - Count algorithm to use to count deleted rows.
  *
  * `"exact"`: Exact but slow count algorithm. Performs a `COUNT(*)` under the
  * hood.
  *
  * `"planned"`: Approximated but fast count algorithm. Uses the Postgres
  * statistics under the hood.
  *
  * `"estimated"`: Uses exact count for low numbers and planned count for high
  * numbers.
  *
  * @category Database
  *
  * @remarks
  * - `delete()` should always be combined with [filters](/docs/reference/javascript/using-filters) to target the item(s) you wish to delete.
  * - If you use `delete()` with filters and you have
  *   [RLS](/docs/learn/auth-deep-dive/auth-row-level-security) enabled, only
  *   rows visible through `SELECT` policies are deleted. Note that by default
  *   no rows are visible, so you need at least one `SELECT`/`ALL` policy that
  *   makes the rows visible.
  * - When using `delete().in()`, specify an array of values to target multiple rows with a single query. This is particularly useful for batch deleting entries that share common criteria, such as deleting users by their IDs. Ensure that the array you provide accurately represents all records you intend to delete to avoid unintended data removal.
  *
  * @example Delete a single record
  * ```ts
  * const response = await supabase
  *   .from('countries')
  *   .delete()
  *   .eq('id', 1)
  * ```
  *
  * @exampleSql Delete a single record
  * ```sql
  * create table
  *   countries (id int8 primary key, name text);
  *
  * insert into
  *   countries (id, name)
  * values
  *   (1, 'Mordor');
  * ```
  *
  * @exampleResponse Delete a single record
  * ```json
  * {
  *   "status": 204,
  *   "statusText": "No Content"
  * }
  * ```
  *
  * @example Delete a record and return it
  * ```ts
  * const { data, error } = await supabase
  *   .from('countries')
  *   .delete()
  *   .eq('id', 1)
  *   .select()
  * ```
  *
  * @exampleSql Delete a record and return it
  * ```sql
  * create table
  *   countries (id int8 primary key, name text);
  *
  * insert into
  *   countries (id, name)
  * values
  *   (1, 'Mordor');
  * ```
  *
  * @exampleResponse Delete a record and return it
  * ```json
  * {
  *   "data": [
  *     {
  *       "id": 1,
  *       "name": "Mordor"
  *     }
  *   ],
  *   "status": 200,
  *   "statusText": "OK"
  * }
  * ```
  *
  * @example Delete multiple records
  * ```ts
  * const response = await supabase
  *   .from('countries')
  *   .delete()
  *   .in('id', [1, 2, 3])
  * ```
  *
  * @exampleSql Delete multiple records
  * ```sql
  * create table
  *   countries (id int8 primary key, name text);
  *
  * insert into
  *   countries (id, name)
  * values
  *   (1, 'Rohan'), (2, 'The Shire'), (3, 'Mordor');
  * ```
  *
  * @exampleResponse Delete multiple records
  * ```json
  * {
  *   "status": 204,
  *   "statusText": "No Content"
  * }
  * ```
  */
  delete({ count: t } = {}) {
    var e;
    const r = "DELETE", { url: n, headers: s } = this.cloneRequestState();
    return t && s.append("Prefer", `count=${t}`), new pt({
      method: r,
      url: n,
      headers: s,
      schema: this.schema,
      fetch: (e = this.fetch) !== null && e !== void 0 ? e : fetch,
      urlLengthLimit: this.urlLengthLimit,
      retry: this.retry
    });
  }
};
function xt(t) {
  "@babel/helpers - typeof";
  return xt = typeof Symbol == "function" && typeof Symbol.iterator == "symbol" ? function(e) {
    return typeof e;
  } : function(e) {
    return e && typeof Symbol == "function" && e.constructor === Symbol && e !== Symbol.prototype ? "symbol" : typeof e;
  }, xt(t);
}
function td(t, e) {
  if (xt(t) != "object" || !t) return t;
  var r = t[Symbol.toPrimitive];
  if (r !== void 0) {
    var n = r.call(t, e);
    if (xt(n) != "object") return n;
    throw new TypeError("@@toPrimitive must return a primitive value.");
  }
  return (e === "string" ? String : Number)(t);
}
function rd(t) {
  var e = td(t, "string");
  return xt(e) == "symbol" ? e : e + "";
}
function nd(t, e, r) {
  return (e = rd(e)) in t ? Object.defineProperty(t, e, {
    value: r,
    enumerable: !0,
    configurable: !0,
    writable: !0
  }) : t[e] = r, t;
}
function Ps(t, e) {
  var r = Object.keys(t);
  if (Object.getOwnPropertySymbols) {
    var n = Object.getOwnPropertySymbols(t);
    e && (n = n.filter(function(s) {
      return Object.getOwnPropertyDescriptor(t, s).enumerable;
    })), r.push.apply(r, n);
  }
  return r;
}
function Qt(t) {
  for (var e = 1; e < arguments.length; e++) {
    var r = arguments[e] != null ? arguments[e] : {};
    e % 2 ? Ps(Object(r), !0).forEach(function(n) {
      nd(t, n, r[n]);
    }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(t, Object.getOwnPropertyDescriptors(r)) : Ps(Object(r)).forEach(function(n) {
      Object.defineProperty(t, n, Object.getOwnPropertyDescriptor(r, n));
    });
  }
  return t;
}
var sd = class Yi {
  /**
  * Creates a PostgREST client.
  *
  * @param url - URL of the PostgREST endpoint
  * @param options - Named parameters
  * @param options.headers - Custom headers
  * @param options.schema - Postgres schema to switch to
  * @param options.fetch - Custom fetch
  * @param options.timeout - Optional timeout in milliseconds for all requests. When set, requests will automatically abort after this duration to prevent indefinite hangs.
  * @param options.urlLengthLimit - Maximum URL length in characters before warnings/errors are triggered. Defaults to 8000.
  * @param options.retry - Enable or disable automatic retries for transient errors.
  *   When enabled, idempotent requests (GET, HEAD, OPTIONS) that fail with network
  *   errors or HTTP 503/520 responses will be automatically retried up to 3 times
  *   with exponential backoff (1s, 2s, 4s). Defaults to `true`.
  * @example Using supabase-js (recommended)
  * ```ts
  * import { createClient } from '@supabase/supabase-js'
  *
  * const supabase = createClient('https://xyzcompany.supabase.co', 'publishable-or-anon-key')
  * const { data, error } = await supabase.from('profiles').select('*')
  * ```
  *
  * @category Database
  *
  * @remarks
  * - A `timeout` option (in milliseconds) can be set to automatically abort requests that take too long.
  * - A `urlLengthLimit` option (default: 8000) can be set to control when URL length warnings are included in error messages for aborted requests.
  *
  * @example Standalone import for bundle-sensitive environments
  * ```ts
  * import { PostgrestClient } from '@supabase/postgrest-js'
  *
  * const postgrest = new PostgrestClient('https://xyzcompany.supabase.co/rest/v1', {
  *   headers: { apikey: 'publishable-or-anon-key' },
  *   schema: 'public',
  *   timeout: 30000, // 30 second timeout
  * })
  * ```
  */
  constructor(e, { headers: r = {}, schema: n, fetch: s, timeout: i, urlLengthLimit: o = 8e3, retry: a } = {}) {
    this.url = e, this.headers = new Headers(r), this.schemaName = n, this.urlLengthLimit = o;
    const c = s ?? globalThis.fetch;
    i !== void 0 && i > 0 ? this.fetch = (u, l) => {
      const h = new AbortController(), f = setTimeout(() => h.abort(), i), d = l == null ? void 0 : l.signal;
      if (d) {
        if (d.aborted)
          return clearTimeout(f), c(u, l);
        const g = () => {
          clearTimeout(f), h.abort();
        };
        return d.addEventListener("abort", g, { once: !0 }), c(u, Qt(Qt({}, l), {}, { signal: h.signal })).finally(() => {
          clearTimeout(f), d.removeEventListener("abort", g);
        });
      }
      return c(u, Qt(Qt({}, l), {}, { signal: h.signal })).finally(() => clearTimeout(f));
    } : this.fetch = c, this.retry = a;
  }
  /**
  * Perform a query on a table or a view.
  *
  * @param relation - The table or view name to query
  *
  * @category Database
  */
  from(e) {
    if (!e || typeof e != "string" || e.trim() === "") throw new Error("Invalid relation name: relation must be a non-empty string.");
    return new ed(new URL(`${this.url}/${e}`), {
      headers: new Headers(this.headers),
      schema: this.schemaName,
      fetch: this.fetch,
      urlLengthLimit: this.urlLengthLimit,
      retry: this.retry
    });
  }
  /**
  * Select a schema to query or perform an function (rpc) call.
  *
  * The schema needs to be on the list of exposed schemas inside Supabase.
  *
  * @param schema - The schema to query
  *
  * @category Database
  */
  schema(e) {
    return new Yi(this.url, {
      headers: this.headers,
      schema: e,
      fetch: this.fetch,
      urlLengthLimit: this.urlLengthLimit,
      retry: this.retry
    });
  }
  /**
  * Perform a function call.
  *
  * @param fn - The function name to call
  * @param args - The arguments to pass to the function call
  * @param options - Named parameters
  * @param options.head - When set to `true`, `data` will not be returned.
  * Useful if you only need the count.
  * @param options.get - When set to `true`, the function will be called with
  * read-only access mode.
  * @param options.count - Count algorithm to use to count rows returned by the
  * function. Only applicable for [set-returning
  * functions](https://www.postgresql.org/docs/current/functions-srf.html).
  *
  * `"exact"`: Exact but slow count algorithm. Performs a `COUNT(*)` under the
  * hood.
  *
  * `"planned"`: Approximated but fast count algorithm. Uses the Postgres
  * statistics under the hood.
  *
  * `"estimated"`: Uses exact count for low numbers and planned count for high
  * numbers.
  *
  * @example
  * ```ts
  * // For cross-schema functions where type inference fails, use overrideTypes:
  * const { data } = await supabase
  *   .schema('schema_b')
  *   .rpc('function_a', {})
  *   .overrideTypes<{ id: string; user_id: string }[]>()
  * ```
  *
  * @category Database
  *
  * @example Call a Postgres function without arguments
  * ```ts
  * const { data, error } = await supabase.rpc('hello_world')
  * ```
  *
  * @exampleSql Call a Postgres function without arguments
  * ```sql
  * create function hello_world() returns text as $$
  *   select 'Hello world';
  * $$ language sql;
  * ```
  *
  * @exampleResponse Call a Postgres function without arguments
  * ```json
  * {
  *   "data": "Hello world",
  *   "status": 200,
  *   "statusText": "OK"
  * }
  * ```
  *
  * @example Call a Postgres function with arguments
  * ```ts
  * const { data, error } = await supabase.rpc('echo', { say: '👋' })
  * ```
  *
  * @exampleSql Call a Postgres function with arguments
  * ```sql
  * create function echo(say text) returns text as $$
  *   select say;
  * $$ language sql;
  * ```
  *
  * @exampleResponse Call a Postgres function with arguments
  * ```json
  *   {
  *     "data": "👋",
  *     "status": 200,
  *     "statusText": "OK"
  *   }
  *
  * ```
  *
  * @exampleDescription Bulk processing
  * You can process large payloads by passing in an array as an argument.
  *
  * @example Bulk processing
  * ```ts
  * const { data, error } = await supabase.rpc('add_one_each', { arr: [1, 2, 3] })
  * ```
  *
  * @exampleSql Bulk processing
  * ```sql
  * create function add_one_each(arr int[]) returns int[] as $$
  *   select array_agg(n + 1) from unnest(arr) as n;
  * $$ language sql;
  * ```
  *
  * @exampleResponse Bulk processing
  * ```json
  * {
  *   "data": [
  *     2,
  *     3,
  *     4
  *   ],
  *   "status": 200,
  *   "statusText": "OK"
  * }
  * ```
  *
  * @exampleDescription Call a Postgres function with filters
  * Postgres functions that return tables can also be combined with [Filters](/docs/reference/javascript/using-filters) and [Modifiers](/docs/reference/javascript/using-modifiers).
  *
  * @example Call a Postgres function with filters
  * ```ts
  * const { data, error } = await supabase
  *   .rpc('list_stored_countries')
  *   .eq('id', 1)
  *   .single()
  * ```
  *
  * @exampleSql Call a Postgres function with filters
  * ```sql
  * create table
  *   countries (id int8 primary key, name text);
  *
  * insert into
  *   countries (id, name)
  * values
  *   (1, 'Rohan'),
  *   (2, 'The Shire');
  *
  * create function list_stored_countries() returns setof countries as $$
  *   select * from countries;
  * $$ language sql;
  * ```
  *
  * @exampleResponse Call a Postgres function with filters
  * ```json
  * {
  *   "data": {
  *     "id": 1,
  *     "name": "Rohan"
  *   },
  *   "status": 200,
  *   "statusText": "OK"
  * }
  * ```
  *
  * @example Call a read-only Postgres function
  * ```ts
  * const { data, error } = await supabase.rpc('hello_world', undefined, { get: true })
  * ```
  *
  * @exampleSql Call a read-only Postgres function
  * ```sql
  * create function hello_world() returns text as $$
  *   select 'Hello world';
  * $$ language sql;
  * ```
  *
  * @exampleResponse Call a read-only Postgres function
  * ```json
  * {
  *   "data": "Hello world",
  *   "status": 200,
  *   "statusText": "OK"
  * }
  * ```
  */
  rpc(e, r = {}, { head: n = !1, get: s = !1, count: i } = {}) {
    var o;
    let a;
    const c = new URL(`${this.url}/rpc/${e}`);
    let u;
    const l = (d) => d !== null && typeof d == "object" && (!Array.isArray(d) || d.some(l)), h = n && Object.values(r).some(l);
    h ? (a = "POST", u = r) : n || s ? (a = n ? "HEAD" : "GET", Object.entries(r).filter(([d, g]) => g !== void 0).map(([d, g]) => [d, Array.isArray(g) ? `{${g.join(",")}}` : `${g}`]).forEach(([d, g]) => {
      c.searchParams.append(d, g);
    })) : (a = "POST", u = r);
    const f = new Headers(this.headers);
    return h ? f.set("Prefer", i ? `count=${i},return=minimal` : "return=minimal") : i && f.set("Prefer", `count=${i}`), new pt({
      method: a,
      url: c,
      headers: f,
      schema: this.schemaName,
      body: u,
      fetch: (o = this.fetch) !== null && o !== void 0 ? o : fetch,
      urlLengthLimit: this.urlLengthLimit,
      retry: this.retry
    });
  }
};
class id {
  /**
   * Static-only utility – prevent instantiation.
   */
  constructor() {
  }
  static detectEnvironment() {
    var e;
    if (typeof WebSocket < "u")
      return { type: "native", constructor: WebSocket };
    if (typeof globalThis < "u" && typeof globalThis.WebSocket < "u")
      return { type: "native", constructor: globalThis.WebSocket };
    if (typeof global < "u" && typeof global.WebSocket < "u")
      return { type: "native", constructor: global.WebSocket };
    if (typeof globalThis < "u" && typeof globalThis.WebSocketPair < "u" && typeof globalThis.WebSocket > "u")
      return {
        type: "cloudflare",
        error: "Cloudflare Workers detected. WebSocket clients are not supported in Cloudflare Workers.",
        workaround: "Use Cloudflare Workers WebSocket API for server-side WebSocket handling, or deploy to a different runtime."
      };
    if (typeof globalThis < "u" && globalThis.EdgeRuntime || typeof navigator < "u" && (!((e = navigator.userAgent) === null || e === void 0) && e.includes("Vercel-Edge")))
      return {
        type: "unsupported",
        error: "Edge runtime detected (Vercel Edge/Netlify Edge). WebSockets are not supported in edge functions.",
        workaround: "Use serverless functions or a different deployment target for WebSocket functionality."
      };
    const r = globalThis.process;
    if (r) {
      const n = r.versions;
      if (n && n.node) {
        const s = n.node, i = parseInt(s.replace(/^v/, "").split(".")[0]);
        return i >= 22 ? typeof globalThis.WebSocket < "u" ? { type: "native", constructor: globalThis.WebSocket } : {
          type: "unsupported",
          error: `Node.js ${i} detected but native WebSocket not found.`,
          workaround: "Provide a WebSocket implementation via the transport option."
        } : {
          type: "unsupported",
          error: `Node.js ${i} detected without native WebSocket support.`,
          workaround: `For Node.js < 22, install "ws" package and provide it via the transport option:
import ws from "ws"
new RealtimeClient(url, { transport: ws })`
        };
      }
    }
    return {
      type: "unsupported",
      error: "Unknown JavaScript runtime without WebSocket support.",
      workaround: "Ensure you're running in a supported environment (browser, Node.js, Deno) or provide a custom WebSocket implementation."
    };
  }
  /**
   * Returns the best available WebSocket constructor for the current runtime.
   *
   * @category Realtime
   *
   * @example Example with error handling
   * ```ts
   * try {
   *   const WS = WebSocketFactory.getWebSocketConstructor()
   *   const socket = new WS('wss://example.com/socket')
   * } catch (error) {
   *   console.error('WebSocket not available in this environment.', error)
   * }
   * ```
   */
  static getWebSocketConstructor() {
    const e = this.detectEnvironment();
    if (e.constructor)
      return e.constructor;
    let r = e.error || "WebSocket not supported in this environment.";
    throw e.workaround && (r += `

Suggested solution: ${e.workaround}`), new Error(r);
  }
  /**
   * Detects whether the runtime can establish WebSocket connections.
   *
   * @category Realtime
   *
   * @example Example in a Node.js script
   * ```ts
   * if (!WebSocketFactory.isWebSocketSupported()) {
   *   console.error('WebSockets are required for this script.')
   *   process.exitCode = 1
   * }
   * ```
   */
  static isWebSocketSupported() {
    try {
      const e = this.detectEnvironment();
      return e.type === "native" || e.type === "ws";
    } catch {
      return !1;
    }
  }
}
const od = "2.104.1", ad = `realtime-js/${od}`, cd = "1.0.0", Qi = "2.0.0", ud = Qi, ld = 1e4, hd = 100, Me = {
  closed: "closed",
  errored: "errored",
  joined: "joined",
  joining: "joining",
  leaving: "leaving"
}, eo = {
  close: "phx_close",
  error: "phx_error",
  join: "phx_join",
  leave: "phx_leave",
  access_token: "access_token"
}, un = {
  connecting: "connecting",
  closing: "closing",
  closed: "closed"
};
class dd {
  constructor(e) {
    this.HEADER_LENGTH = 1, this.USER_BROADCAST_PUSH_META_LENGTH = 6, this.KINDS = { userBroadcastPush: 3, userBroadcast: 4 }, this.BINARY_ENCODING = 0, this.JSON_ENCODING = 1, this.BROADCAST_EVENT = "broadcast", this.allowedMetadataKeys = [], this.allowedMetadataKeys = e ?? [];
  }
  encode(e, r) {
    if (e.event === this.BROADCAST_EVENT && !(e.payload instanceof ArrayBuffer) && typeof e.payload.event == "string")
      return r(this._binaryEncodeUserBroadcastPush(e));
    let n = [e.join_ref, e.ref, e.topic, e.event, e.payload];
    return r(JSON.stringify(n));
  }
  _binaryEncodeUserBroadcastPush(e) {
    var r;
    return this._isArrayBuffer((r = e.payload) === null || r === void 0 ? void 0 : r.payload) ? this._encodeBinaryUserBroadcastPush(e) : this._encodeJsonUserBroadcastPush(e);
  }
  _encodeBinaryUserBroadcastPush(e) {
    var r, n;
    const s = (n = (r = e.payload) === null || r === void 0 ? void 0 : r.payload) !== null && n !== void 0 ? n : new ArrayBuffer(0);
    return this._encodeUserBroadcastPush(e, this.BINARY_ENCODING, s);
  }
  _encodeJsonUserBroadcastPush(e) {
    var r, n;
    const s = (n = (r = e.payload) === null || r === void 0 ? void 0 : r.payload) !== null && n !== void 0 ? n : {}, o = new TextEncoder().encode(JSON.stringify(s)).buffer;
    return this._encodeUserBroadcastPush(e, this.JSON_ENCODING, o);
  }
  _encodeUserBroadcastPush(e, r, n) {
    var s, i;
    const o = e.topic, a = (s = e.ref) !== null && s !== void 0 ? s : "", c = (i = e.join_ref) !== null && i !== void 0 ? i : "", u = e.payload.event, l = this.allowedMetadataKeys ? this._pick(e.payload, this.allowedMetadataKeys) : {}, h = Object.keys(l).length === 0 ? "" : JSON.stringify(l);
    if (c.length > 255)
      throw new Error(`joinRef length ${c.length} exceeds maximum of 255`);
    if (a.length > 255)
      throw new Error(`ref length ${a.length} exceeds maximum of 255`);
    if (o.length > 255)
      throw new Error(`topic length ${o.length} exceeds maximum of 255`);
    if (u.length > 255)
      throw new Error(`userEvent length ${u.length} exceeds maximum of 255`);
    if (h.length > 255)
      throw new Error(`metadata length ${h.length} exceeds maximum of 255`);
    const f = this.USER_BROADCAST_PUSH_META_LENGTH + c.length + a.length + o.length + u.length + h.length, d = new ArrayBuffer(this.HEADER_LENGTH + f);
    let g = new DataView(d), y = 0;
    g.setUint8(y++, this.KINDS.userBroadcastPush), g.setUint8(y++, c.length), g.setUint8(y++, a.length), g.setUint8(y++, o.length), g.setUint8(y++, u.length), g.setUint8(y++, h.length), g.setUint8(y++, r), Array.from(c, (k) => g.setUint8(y++, k.charCodeAt(0))), Array.from(a, (k) => g.setUint8(y++, k.charCodeAt(0))), Array.from(o, (k) => g.setUint8(y++, k.charCodeAt(0))), Array.from(u, (k) => g.setUint8(y++, k.charCodeAt(0))), Array.from(h, (k) => g.setUint8(y++, k.charCodeAt(0)));
    var I = new Uint8Array(d.byteLength + n.byteLength);
    return I.set(new Uint8Array(d), 0), I.set(new Uint8Array(n), d.byteLength), I.buffer;
  }
  decode(e, r) {
    if (this._isArrayBuffer(e)) {
      let n = this._binaryDecode(e);
      return r(n);
    }
    if (typeof e == "string") {
      const n = JSON.parse(e), [s, i, o, a, c] = n;
      return r({ join_ref: s, ref: i, topic: o, event: a, payload: c });
    }
    return r({});
  }
  _binaryDecode(e) {
    const r = new DataView(e), n = r.getUint8(0), s = new TextDecoder();
    switch (n) {
      case this.KINDS.userBroadcast:
        return this._decodeUserBroadcast(e, r, s);
    }
  }
  _decodeUserBroadcast(e, r, n) {
    const s = r.getUint8(1), i = r.getUint8(2), o = r.getUint8(3), a = r.getUint8(4);
    let c = this.HEADER_LENGTH + 4;
    const u = n.decode(e.slice(c, c + s));
    c = c + s;
    const l = n.decode(e.slice(c, c + i));
    c = c + i;
    const h = n.decode(e.slice(c, c + o));
    c = c + o;
    const f = e.slice(c, e.byteLength), d = a === this.JSON_ENCODING ? JSON.parse(n.decode(f)) : f, g = {
      type: this.BROADCAST_EVENT,
      event: l,
      payload: d
    };
    return o > 0 && (g.meta = JSON.parse(h)), { join_ref: null, ref: null, topic: u, event: this.BROADCAST_EVENT, payload: g };
  }
  _isArrayBuffer(e) {
    var r;
    return e instanceof ArrayBuffer || ((r = e == null ? void 0 : e.constructor) === null || r === void 0 ? void 0 : r.name) === "ArrayBuffer";
  }
  _pick(e, r) {
    return !e || typeof e != "object" ? {} : Object.fromEntries(Object.entries(e).filter(([n]) => r.includes(n)));
  }
}
var X;
(function(t) {
  t.abstime = "abstime", t.bool = "bool", t.date = "date", t.daterange = "daterange", t.float4 = "float4", t.float8 = "float8", t.int2 = "int2", t.int4 = "int4", t.int4range = "int4range", t.int8 = "int8", t.int8range = "int8range", t.json = "json", t.jsonb = "jsonb", t.money = "money", t.numeric = "numeric", t.oid = "oid", t.reltime = "reltime", t.text = "text", t.time = "time", t.timestamp = "timestamp", t.timestamptz = "timestamptz", t.timetz = "timetz", t.tsrange = "tsrange", t.tstzrange = "tstzrange";
})(X || (X = {}));
const Ds = (t, e, r = {}) => {
  var n;
  const s = (n = r.skipTypes) !== null && n !== void 0 ? n : [];
  return e ? Object.keys(e).reduce((i, o) => (i[o] = fd(o, t, e, s), i), {}) : {};
}, fd = (t, e, r, n) => {
  const s = e.find((a) => a.name === t), i = s == null ? void 0 : s.type, o = r[t];
  return i && !n.includes(i) ? to(i, o) : ln(o);
}, to = (t, e) => {
  if (t.charAt(0) === "_") {
    const r = t.slice(1, t.length);
    return _d(e, r);
  }
  switch (t) {
    case X.bool:
      return pd(e);
    case X.float4:
    case X.float8:
    case X.int2:
    case X.int4:
    case X.int8:
    case X.numeric:
    case X.oid:
      return md(e);
    case X.json:
    case X.jsonb:
      return gd(e);
    case X.timestamp:
      return yd(e);
    // Format to be consistent with PostgREST
    case X.abstime:
    // To allow users to cast it based on Timezone
    case X.date:
    // To allow users to cast it based on Timezone
    case X.daterange:
    case X.int4range:
    case X.int8range:
    case X.money:
    case X.reltime:
    // To allow users to cast it based on Timezone
    case X.text:
    case X.time:
    // To allow users to cast it based on Timezone
    case X.timestamptz:
    // To allow users to cast it based on Timezone
    case X.timetz:
    // To allow users to cast it based on Timezone
    case X.tsrange:
    case X.tstzrange:
      return ln(e);
    default:
      return ln(e);
  }
}, ln = (t) => t, pd = (t) => {
  switch (t) {
    case "t":
      return !0;
    case "f":
      return !1;
    default:
      return t;
  }
}, md = (t) => {
  if (typeof t == "string") {
    const e = parseFloat(t);
    if (!Number.isNaN(e))
      return e;
  }
  return t;
}, gd = (t) => {
  if (typeof t == "string")
    try {
      return JSON.parse(t);
    } catch {
      return t;
    }
  return t;
}, _d = (t, e) => {
  if (typeof t != "string")
    return t;
  const r = t.length - 1, n = t[r];
  if (t[0] === "{" && n === "}") {
    let i;
    const o = t.slice(1, r);
    try {
      i = JSON.parse("[" + o + "]");
    } catch {
      i = o ? o.split(",") : [];
    }
    return i.map((a) => to(e, a));
  }
  return t;
}, yd = (t) => typeof t == "string" ? t.replace(" ", "T") : t, ro = (t) => {
  const e = new URL(t);
  return e.protocol = e.protocol.replace(/^ws/i, "http"), e.pathname = e.pathname.replace(/\/+$/, "").replace(/\/socket\/websocket$/i, "").replace(/\/socket$/i, "").replace(/\/websocket$/i, ""), e.pathname === "" || e.pathname === "/" ? e.pathname = "/api/broadcast" : e.pathname = e.pathname + "/api/broadcast", e.href;
};
var Pt = (t) => typeof t == "function" ? (
  /** @type {() => T} */
  t
) : function() {
  return t;
}, Ed = typeof self < "u" ? self : null, mt = typeof window < "u" ? window : null, De = Ed || mt || globalThis, vd = "2.0.0", wd = 1e4, bd = 1e3, Ue = (
  /** @type {const} */
  { connecting: 0, open: 1, closing: 2, closed: 3 }
), Te = (
  /** @type {const} */
  {
    closed: "closed",
    errored: "errored",
    joined: "joined",
    joining: "joining",
    leaving: "leaving"
  }
), xe = (
  /** @type {const} */
  {
    close: "phx_close",
    error: "phx_error",
    join: "phx_join",
    reply: "phx_reply",
    leave: "phx_leave"
  }
), hn = (
  /** @type {const} */
  {
    longpoll: "longpoll",
    websocket: "websocket"
  }
), Td = (
  /** @type {const} */
  {
    complete: 4
  }
), dn = "base64url.bearer.phx.", er = class {
  /**
   * Initializes the Push
   * @param {Channel} channel - The Channel
   * @param {ChannelEvent} event - The event, for example `"phx_join"`
   * @param {() => Record<string, unknown>} payload - The payload, for example `{user_id: 123}`
   * @param {number} timeout - The push timeout in milliseconds
   */
  constructor(t, e, r, n) {
    this.channel = t, this.event = e, this.payload = r || function() {
      return {};
    }, this.receivedResp = null, this.timeout = n, this.timeoutTimer = null, this.recHooks = [], this.sent = !1, this.ref = void 0;
  }
  /**
   *
   * @param {number} timeout
   */
  resend(t) {
    this.timeout = t, this.reset(), this.send();
  }
  /**
   *
   */
  send() {
    this.hasReceived("timeout") || (this.startTimeout(), this.sent = !0, this.channel.socket.push({
      topic: this.channel.topic,
      event: this.event,
      payload: this.payload(),
      ref: this.ref,
      join_ref: this.channel.joinRef()
    }));
  }
  /**
   *
   * @param {string} status
   * @param {(response: any) => void} callback
   */
  receive(t, e) {
    return this.hasReceived(t) && e(this.receivedResp.response), this.recHooks.push({ status: t, callback: e }), this;
  }
  reset() {
    this.cancelRefEvent(), this.ref = null, this.refEvent = null, this.receivedResp = null, this.sent = !1;
  }
  destroy() {
    this.cancelRefEvent(), this.cancelTimeout();
  }
  /**
   * @private
   */
  matchReceive({ status: t, response: e, _ref: r }) {
    this.recHooks.filter((n) => n.status === t).forEach((n) => n.callback(e));
  }
  /**
   * @private
   */
  cancelRefEvent() {
    this.refEvent && this.channel.off(this.refEvent);
  }
  cancelTimeout() {
    clearTimeout(this.timeoutTimer), this.timeoutTimer = null;
  }
  startTimeout() {
    this.timeoutTimer && this.cancelTimeout(), this.ref = this.channel.socket.makeRef(), this.refEvent = this.channel.replyEventName(this.ref), this.channel.on(this.refEvent, (t) => {
      this.cancelRefEvent(), this.cancelTimeout(), this.receivedResp = t, this.matchReceive(t);
    }), this.timeoutTimer = setTimeout(() => {
      this.trigger("timeout", {});
    }, this.timeout);
  }
  /**
   * @private
   */
  hasReceived(t) {
    return this.receivedResp && this.receivedResp.status === t;
  }
  trigger(t, e) {
    this.channel.trigger(this.refEvent, { status: t, response: e });
  }
}, no = class {
  /**
  * @param {() => void} callback
  * @param {(tries: number) => number} timerCalc
  */
  constructor(t, e) {
    this.callback = t, this.timerCalc = e, this.timer = void 0, this.tries = 0;
  }
  reset() {
    this.tries = 0, clearTimeout(this.timer);
  }
  /**
   * Cancels any previous scheduleTimeout and schedules callback
   */
  scheduleTimeout() {
    clearTimeout(this.timer), this.timer = setTimeout(() => {
      this.tries = this.tries + 1, this.callback();
    }, this.timerCalc(this.tries + 1));
  }
}, Sd = class {
  /**
   * @param {string} topic
   * @param {Params | (() => Params)} params
   * @param {Socket} socket
   */
  constructor(t, e, r) {
    this.state = Te.closed, this.topic = t, this.params = Pt(e || {}), this.socket = r, this.bindings = [], this.bindingRef = 0, this.timeout = this.socket.timeout, this.joinedOnce = !1, this.joinPush = new er(this, xe.join, this.params, this.timeout), this.pushBuffer = [], this.stateChangeRefs = [], this.rejoinTimer = new no(() => {
      this.socket.isConnected() && this.rejoin();
    }, this.socket.rejoinAfterMs), this.stateChangeRefs.push(this.socket.onError(() => this.rejoinTimer.reset())), this.stateChangeRefs.push(
      this.socket.onOpen(() => {
        this.rejoinTimer.reset(), this.isErrored() && this.rejoin();
      })
    ), this.joinPush.receive("ok", () => {
      this.state = Te.joined, this.rejoinTimer.reset(), this.pushBuffer.forEach((n) => n.send()), this.pushBuffer = [];
    }), this.joinPush.receive("error", (n) => {
      this.state = Te.errored, this.socket.hasLogger() && this.socket.log("channel", `error ${this.topic}`, n), this.socket.isConnected() && this.rejoinTimer.scheduleTimeout();
    }), this.onClose(() => {
      this.rejoinTimer.reset(), this.socket.hasLogger() && this.socket.log("channel", `close ${this.topic}`), this.state = Te.closed, this.socket.remove(this);
    }), this.onError((n) => {
      this.socket.hasLogger() && this.socket.log("channel", `error ${this.topic}`, n), this.isJoining() && this.joinPush.reset(), this.state = Te.errored, this.socket.isConnected() && this.rejoinTimer.scheduleTimeout();
    }), this.joinPush.receive("timeout", () => {
      this.socket.hasLogger() && this.socket.log("channel", `timeout ${this.topic}`, this.joinPush.timeout), new er(this, xe.leave, Pt({}), this.timeout).send(), this.state = Te.errored, this.joinPush.reset(), this.socket.isConnected() && this.rejoinTimer.scheduleTimeout();
    }), this.on(xe.reply, (n, s) => {
      this.trigger(this.replyEventName(s), n);
    });
  }
  /**
   * Join the channel
   * @param {number} timeout
   * @returns {Push}
   */
  join(t = this.timeout) {
    if (this.joinedOnce)
      throw new Error("tried to join multiple times. 'join' can only be called a single time per channel instance");
    return this.timeout = t, this.joinedOnce = !0, this.rejoin(), this.joinPush;
  }
  /**
   * Teardown the channel.
   *
   * Destroys and stops related timers.
   */
  teardown() {
    this.pushBuffer.forEach((t) => t.destroy()), this.pushBuffer = [], this.rejoinTimer.reset(), this.joinPush.destroy(), this.state = Te.closed, this.bindings = [];
  }
  /**
   * Hook into channel close
   * @param {ChannelBindingCallback} callback
   */
  onClose(t) {
    this.on(xe.close, t);
  }
  /**
   * Hook into channel errors
   * @param {ChannelOnErrorCallback} callback
   * @return {number}
   */
  onError(t) {
    return this.on(xe.error, (e) => t(e));
  }
  /**
   * Subscribes on channel events
   *
   * Subscription returns a ref counter, which can be used later to
   * unsubscribe the exact event listener
   *
   * @example
   * const ref1 = channel.on("event", do_stuff)
   * const ref2 = channel.on("event", do_other_stuff)
   * channel.off("event", ref1)
   * // Since unsubscription, do_stuff won't fire,
   * // while do_other_stuff will keep firing on the "event"
   *
   * @param {string} event
   * @param {ChannelBindingCallback} callback
   * @returns {number} ref
   */
  on(t, e) {
    let r = this.bindingRef++;
    return this.bindings.push({ event: t, ref: r, callback: e }), r;
  }
  /**
   * Unsubscribes off of channel events
   *
   * Use the ref returned from a channel.on() to unsubscribe one
   * handler, or pass nothing for the ref to unsubscribe all
   * handlers for the given event.
   *
   * @example
   * // Unsubscribe the do_stuff handler
   * const ref1 = channel.on("event", do_stuff)
   * channel.off("event", ref1)
   *
   * // Unsubscribe all handlers from event
   * channel.off("event")
   *
   * @param {string} event
   * @param {number} [ref]
   */
  off(t, e) {
    this.bindings = this.bindings.filter((r) => !(r.event === t && (typeof e > "u" || e === r.ref)));
  }
  /**
   * @private
   */
  canPush() {
    return this.socket.isConnected() && this.isJoined();
  }
  /**
   * Sends a message `event` to phoenix with the payload `payload`.
   * Phoenix receives this in the `handle_in(event, payload, socket)`
   * function. if phoenix replies or it times out (default 10000ms),
   * then optionally the reply can be received.
   *
   * @example
   * channel.push("event")
   *   .receive("ok", payload => console.log("phoenix replied:", payload))
   *   .receive("error", err => console.log("phoenix errored", err))
   *   .receive("timeout", () => console.log("timed out pushing"))
   * @param {string} event
   * @param {Object} payload
   * @param {number} [timeout]
   * @returns {Push}
   */
  push(t, e, r = this.timeout) {
    if (e = e || {}, !this.joinedOnce)
      throw new Error(`tried to push '${t}' to '${this.topic}' before joining. Use channel.join() before pushing events`);
    let n = new er(this, t, function() {
      return e;
    }, r);
    return this.canPush() ? n.send() : (n.startTimeout(), this.pushBuffer.push(n)), n;
  }
  /** Leaves the channel
   *
   * Unsubscribes from server events, and
   * instructs channel to terminate on server
   *
   * Triggers onClose() hooks
   *
   * To receive leave acknowledgements, use the `receive`
   * hook to bind to the server ack, ie:
   *
   * @example
   * channel.leave().receive("ok", () => alert("left!") )
   *
   * @param {number} timeout
   * @returns {Push}
   */
  leave(t = this.timeout) {
    this.rejoinTimer.reset(), this.joinPush.cancelTimeout(), this.state = Te.leaving;
    let e = () => {
      this.socket.hasLogger() && this.socket.log("channel", `leave ${this.topic}`), this.trigger(xe.close, "leave");
    }, r = new er(this, xe.leave, Pt({}), t);
    return r.receive("ok", () => e()).receive("timeout", () => e()), r.send(), this.canPush() || r.trigger("ok", {}), r;
  }
  /**
   * Overridable message hook
   *
   * Receives all events for specialized message handling
   * before dispatching to the channel callbacks.
   *
   * Must return the payload, modified or unmodified
   * @type{ChannelOnMessage}
   */
  onMessage(t, e, r) {
    return e;
  }
  /**
   * Overridable filter hook
   *
   * If this function returns `true`, `binding`'s callback will be called.
   *
   * @type{ChannelFilterBindings}
   */
  filterBindings(t, e, r) {
    return !0;
  }
  isMember(t, e, r, n) {
    return this.topic !== t ? !1 : n && n !== this.joinRef() ? (this.socket.hasLogger() && this.socket.log("channel", "dropping outdated message", { topic: t, event: e, payload: r, joinRef: n }), !1) : !0;
  }
  joinRef() {
    return this.joinPush.ref;
  }
  /**
   * @private
   */
  rejoin(t = this.timeout) {
    this.isLeaving() || (this.socket.leaveOpenTopic(this.topic), this.state = Te.joining, this.joinPush.resend(t));
  }
  /**
   * @param {string} event
   * @param {unknown} [payload]
   * @param {?string} [ref]
   * @param {?string} [joinRef]
   */
  trigger(t, e, r, n) {
    let s = this.onMessage(t, e, r, n);
    if (e && !s)
      throw new Error("channel onMessage callbacks must return the payload, modified or unmodified");
    let i = this.bindings.filter((o) => o.event === t && this.filterBindings(o, e, r));
    for (let o = 0; o < i.length; o++)
      i[o].callback(s, r, n || this.joinRef());
  }
  /**
  * @param {string} ref
  */
  replyEventName(t) {
    return `chan_reply_${t}`;
  }
  isClosed() {
    return this.state === Te.closed;
  }
  isErrored() {
    return this.state === Te.errored;
  }
  isJoined() {
    return this.state === Te.joined;
  }
  isJoining() {
    return this.state === Te.joining;
  }
  isLeaving() {
    return this.state === Te.leaving;
  }
}, Er = class {
  static request(t, e, r, n, s, i, o) {
    if (De.XDomainRequest) {
      let a = new De.XDomainRequest();
      return this.xdomainRequest(a, t, e, n, s, i, o);
    } else if (De.XMLHttpRequest) {
      let a = new De.XMLHttpRequest();
      return this.xhrRequest(a, t, e, r, n, s, i, o);
    } else {
      if (De.fetch && De.AbortController)
        return this.fetchRequest(t, e, r, n, s, i, o);
      throw new Error("No suitable XMLHttpRequest implementation found");
    }
  }
  static fetchRequest(t, e, r, n, s, i, o) {
    let a = {
      method: t,
      headers: r,
      body: n
    }, c = null;
    return s && (c = new AbortController(), setTimeout(() => c.abort(), s), a.signal = c.signal), De.fetch(e, a).then((u) => u.text()).then((u) => this.parseJSON(u)).then((u) => o && o(u)).catch((u) => {
      u.name === "AbortError" && i ? i() : o && o(null);
    }), c;
  }
  static xdomainRequest(t, e, r, n, s, i, o) {
    return t.timeout = s, t.open(e, r), t.onload = () => {
      let a = this.parseJSON(t.responseText);
      o && o(a);
    }, i && (t.ontimeout = i), t.onprogress = () => {
    }, t.send(n), t;
  }
  static xhrRequest(t, e, r, n, s, i, o, a) {
    t.open(e, r, !0), t.timeout = i;
    for (let [c, u] of Object.entries(n))
      t.setRequestHeader(c, u);
    return t.onerror = () => a && a(null), t.onreadystatechange = () => {
      if (t.readyState === Td.complete && a) {
        let c = this.parseJSON(t.responseText);
        a(c);
      }
    }, o && (t.ontimeout = o), t.send(s), t;
  }
  static parseJSON(t) {
    if (!t || t === "")
      return null;
    try {
      return JSON.parse(t);
    } catch {
      return console && console.log("failed to parse JSON response", t), null;
    }
  }
  static serialize(t, e) {
    let r = [];
    for (var n in t) {
      if (!Object.prototype.hasOwnProperty.call(t, n))
        continue;
      let s = e ? `${e}[${n}]` : n, i = t[n];
      typeof i == "object" ? r.push(this.serialize(i, s)) : r.push(encodeURIComponent(s) + "=" + encodeURIComponent(i));
    }
    return r.join("&");
  }
  static appendParams(t, e) {
    if (Object.keys(e).length === 0)
      return t;
    let r = t.match(/\?/) ? "&" : "?";
    return `${t}${r}${this.serialize(e)}`;
  }
}, Od = (t) => {
  let e = "", r = new Uint8Array(t), n = r.byteLength;
  for (let s = 0; s < n; s++)
    e += String.fromCharCode(r[s]);
  return btoa(e);
}, ct = class {
  constructor(t, e) {
    e && e.length === 2 && e[1].startsWith(dn) && (this.authToken = atob(e[1].slice(dn.length))), this.endPoint = null, this.token = null, this.skipHeartbeat = !0, this.reqs = /* @__PURE__ */ new Set(), this.awaitingBatchAck = !1, this.currentBatch = null, this.currentBatchTimer = null, this.batchBuffer = [], this.onopen = function() {
    }, this.onerror = function() {
    }, this.onmessage = function() {
    }, this.onclose = function() {
    }, this.pollEndpoint = this.normalizeEndpoint(t), this.readyState = Ue.connecting, setTimeout(() => this.poll(), 0);
  }
  normalizeEndpoint(t) {
    return t.replace("ws://", "http://").replace("wss://", "https://").replace(new RegExp("(.*)/" + hn.websocket), "$1/" + hn.longpoll);
  }
  endpointURL() {
    return Er.appendParams(this.pollEndpoint, { token: this.token });
  }
  closeAndRetry(t, e, r) {
    this.close(t, e, r), this.readyState = Ue.connecting;
  }
  ontimeout() {
    this.onerror("timeout"), this.closeAndRetry(1005, "timeout", !1);
  }
  isActive() {
    return this.readyState === Ue.open || this.readyState === Ue.connecting;
  }
  poll() {
    const t = { Accept: "application/json" };
    this.authToken && (t["X-Phoenix-AuthToken"] = this.authToken), this.ajax("GET", t, null, () => this.ontimeout(), (e) => {
      if (e) {
        var { status: r, token: n, messages: s } = e;
        if (r === 410 && this.token !== null) {
          this.onerror(410), this.closeAndRetry(3410, "session_gone", !1);
          return;
        }
        this.token = n;
      } else
        r = 0;
      switch (r) {
        case 200:
          s.forEach((i) => {
            setTimeout(() => this.onmessage({ data: i }), 0);
          }), this.poll();
          break;
        case 204:
          this.poll();
          break;
        case 410:
          this.readyState = Ue.open, this.onopen({}), this.poll();
          break;
        case 403:
          this.onerror(403), this.close(1008, "forbidden", !1);
          break;
        case 0:
        case 500:
          this.onerror(500), this.closeAndRetry(1011, "internal server error", 500);
          break;
        default:
          throw new Error(`unhandled poll status ${r}`);
      }
    });
  }
  // we collect all pushes within the current event loop by
  // setTimeout 0, which optimizes back-to-back procedural
  // pushes against an empty buffer
  send(t) {
    typeof t != "string" && (t = Od(t)), this.currentBatch ? this.currentBatch.push(t) : this.awaitingBatchAck ? this.batchBuffer.push(t) : (this.currentBatch = [t], this.currentBatchTimer = setTimeout(() => {
      this.batchSend(this.currentBatch), this.currentBatch = null;
    }, 0));
  }
  batchSend(t) {
    this.awaitingBatchAck = !0, this.ajax("POST", { "Content-Type": "application/x-ndjson" }, t.join(`
`), () => this.onerror("timeout"), (e) => {
      this.awaitingBatchAck = !1, !e || e.status !== 200 ? (this.onerror(e && e.status), this.closeAndRetry(1011, "internal server error", !1)) : this.batchBuffer.length > 0 && (this.batchSend(this.batchBuffer), this.batchBuffer = []);
    });
  }
  close(t, e, r) {
    for (let s of this.reqs)
      s.abort();
    this.readyState = Ue.closed;
    let n = Object.assign({ code: 1e3, reason: void 0, wasClean: !0 }, { code: t, reason: e, wasClean: r });
    this.batchBuffer = [], clearTimeout(this.currentBatchTimer), this.currentBatchTimer = null, typeof CloseEvent < "u" ? this.onclose(new CloseEvent("close", n)) : this.onclose(n);
  }
  ajax(t, e, r, n, s) {
    let i, o = () => {
      this.reqs.delete(i), n();
    };
    i = Er.request(t, this.endpointURL(), e, r, this.timeout, o, (a) => {
      this.reqs.delete(i), this.isActive() && s(a);
    }), this.reqs.add(i);
  }
}, Ad = class Lt {
  /**
   * Initializes the Presence
   * @param {Channel} channel - The Channel
   * @param {PresenceOptions} [opts] - The options, for example `{events: {state: "state", diff: "diff"}}`
   */
  constructor(e, r = {}) {
    let n = r.events || /** @type {PresenceEvents} */
    { state: "presence_state", diff: "presence_diff" };
    this.state = {}, this.pendingDiffs = [], this.channel = e, this.joinRef = null, this.caller = {
      onJoin: function() {
      },
      onLeave: function() {
      },
      onSync: function() {
      }
    }, this.channel.on(n.state, (s) => {
      let { onJoin: i, onLeave: o, onSync: a } = this.caller;
      this.joinRef = this.channel.joinRef(), this.state = Lt.syncState(this.state, s, i, o), this.pendingDiffs.forEach((c) => {
        this.state = Lt.syncDiff(this.state, c, i, o);
      }), this.pendingDiffs = [], a();
    }), this.channel.on(n.diff, (s) => {
      let { onJoin: i, onLeave: o, onSync: a } = this.caller;
      this.inPendingSyncState() ? this.pendingDiffs.push(s) : (this.state = Lt.syncDiff(this.state, s, i, o), a());
    });
  }
  /**
   * @param {PresenceOnJoin} callback
   */
  onJoin(e) {
    this.caller.onJoin = e;
  }
  /**
   * @param {PresenceOnLeave} callback
   */
  onLeave(e) {
    this.caller.onLeave = e;
  }
  /**
   * @param {PresenceOnSync} callback
   */
  onSync(e) {
    this.caller.onSync = e;
  }
  /**
   * Returns the array of presences, with selected metadata.
   *
   * @template [T=PresenceState]
   * @param {((key: string, obj: PresenceState) => T)} [by]
   *
   * @returns {T[]}
   */
  list(e) {
    return Lt.list(this.state, e);
  }
  inPendingSyncState() {
    return !this.joinRef || this.joinRef !== this.channel.joinRef();
  }
  // lower-level public static API
  /**
   * Used to sync the list of presences on the server
   * with the client's state. An optional `onJoin` and `onLeave` callback can
   * be provided to react to changes in the client's local presences across
   * disconnects and reconnects with the server.
   *
   * @param {Record<string, PresenceState>} currentState
   * @param {Record<string, PresenceState>} newState
   * @param {PresenceOnJoin} onJoin
   * @param {PresenceOnLeave} onLeave
   *
   * @returns {Record<string, PresenceState>}
   */
  static syncState(e, r, n, s) {
    let i = this.clone(e), o = {}, a = {};
    return this.map(i, (c, u) => {
      r[c] || (a[c] = u);
    }), this.map(r, (c, u) => {
      let l = i[c];
      if (l) {
        let h = u.metas.map((y) => y.phx_ref), f = l.metas.map((y) => y.phx_ref), d = u.metas.filter((y) => f.indexOf(y.phx_ref) < 0), g = l.metas.filter((y) => h.indexOf(y.phx_ref) < 0);
        d.length > 0 && (o[c] = u, o[c].metas = d), g.length > 0 && (a[c] = this.clone(l), a[c].metas = g);
      } else
        o[c] = u;
    }), this.syncDiff(i, { joins: o, leaves: a }, n, s);
  }
  /**
   *
   * Used to sync a diff of presence join and leave
   * events from the server, as they happen. Like `syncState`, `syncDiff`
   * accepts optional `onJoin` and `onLeave` callbacks to react to a user
   * joining or leaving from a device.
   *
   * @param {Record<string, PresenceState>} state
   * @param {PresenceDiff} diff
   * @param {PresenceOnJoin} onJoin
   * @param {PresenceOnLeave} onLeave
   *
   * @returns {Record<string, PresenceState>}
   */
  static syncDiff(e, r, n, s) {
    let { joins: i, leaves: o } = this.clone(r);
    return n || (n = function() {
    }), s || (s = function() {
    }), this.map(i, (a, c) => {
      let u = e[a];
      if (e[a] = this.clone(c), u) {
        let l = e[a].metas.map((f) => f.phx_ref), h = u.metas.filter((f) => l.indexOf(f.phx_ref) < 0);
        e[a].metas.unshift(...h);
      }
      n(a, u, c);
    }), this.map(o, (a, c) => {
      let u = e[a];
      if (!u)
        return;
      let l = c.metas.map((h) => h.phx_ref);
      u.metas = u.metas.filter((h) => l.indexOf(h.phx_ref) < 0), s(a, u, c), u.metas.length === 0 && delete e[a];
    }), e;
  }
  /**
   * Returns the array of presences, with selected metadata.
   *
   * @template [T=PresenceState]
   * @param {Record<string, PresenceState>} presences
   * @param {((key: string, obj: PresenceState) => T)} [chooser]
   *
   * @returns {T[]}
   */
  static list(e, r) {
    return r || (r = function(n, s) {
      return s;
    }), this.map(e, (n, s) => r(n, s));
  }
  // private
  /**
  * @template T
  * @param {Record<string, PresenceState>} obj
  * @param {(key: string, obj: PresenceState) => T} func
  */
  static map(e, r) {
    return Object.getOwnPropertyNames(e).map((n) => r(n, e[n]));
  }
  /**
  * @template T
  * @param {T} obj
  * @returns {T}
  */
  static clone(e) {
    return JSON.parse(JSON.stringify(e));
  }
}, tr = {
  HEADER_LENGTH: 1,
  META_LENGTH: 4,
  KINDS: { push: 0, reply: 1, broadcast: 2 },
  /**
  * @template T
  * @param {Message<Record<string, any>>} msg
  * @param {(msg: ArrayBuffer | string) => T} callback
  * @returns {T}
  */
  encode(t, e) {
    if (t.payload.constructor === ArrayBuffer)
      return e(this.binaryEncode(t));
    {
      let r = [t.join_ref, t.ref, t.topic, t.event, t.payload];
      return e(JSON.stringify(r));
    }
  },
  /**
  * @template T
  * @param {ArrayBuffer | string} rawPayload
  * @param {(msg: Message<unknown>) => T} callback
  * @returns {T}
  */
  decode(t, e) {
    if (t.constructor === ArrayBuffer)
      return e(this.binaryDecode(t));
    {
      let [r, n, s, i, o] = JSON.parse(t);
      return e({ join_ref: r, ref: n, topic: s, event: i, payload: o });
    }
  },
  /** @private */
  binaryEncode(t) {
    let { join_ref: e, ref: r, event: n, topic: s, payload: i } = t, o = this.META_LENGTH + e.length + r.length + s.length + n.length, a = new ArrayBuffer(this.HEADER_LENGTH + o), c = new DataView(a), u = 0;
    c.setUint8(u++, this.KINDS.push), c.setUint8(u++, e.length), c.setUint8(u++, r.length), c.setUint8(u++, s.length), c.setUint8(u++, n.length), Array.from(e, (h) => c.setUint8(u++, h.charCodeAt(0))), Array.from(r, (h) => c.setUint8(u++, h.charCodeAt(0))), Array.from(s, (h) => c.setUint8(u++, h.charCodeAt(0))), Array.from(n, (h) => c.setUint8(u++, h.charCodeAt(0)));
    var l = new Uint8Array(a.byteLength + i.byteLength);
    return l.set(new Uint8Array(a), 0), l.set(new Uint8Array(i), a.byteLength), l.buffer;
  },
  /**
  * @private
  */
  binaryDecode(t) {
    let e = new DataView(t), r = e.getUint8(0), n = new TextDecoder();
    switch (r) {
      case this.KINDS.push:
        return this.decodePush(t, e, n);
      case this.KINDS.reply:
        return this.decodeReply(t, e, n);
      case this.KINDS.broadcast:
        return this.decodeBroadcast(t, e, n);
    }
  },
  /** @private */
  decodePush(t, e, r) {
    let n = e.getUint8(1), s = e.getUint8(2), i = e.getUint8(3), o = this.HEADER_LENGTH + this.META_LENGTH - 1, a = r.decode(t.slice(o, o + n));
    o = o + n;
    let c = r.decode(t.slice(o, o + s));
    o = o + s;
    let u = r.decode(t.slice(o, o + i));
    o = o + i;
    let l = t.slice(o, t.byteLength);
    return { join_ref: a, ref: null, topic: c, event: u, payload: l };
  },
  /** @private */
  decodeReply(t, e, r) {
    let n = e.getUint8(1), s = e.getUint8(2), i = e.getUint8(3), o = e.getUint8(4), a = this.HEADER_LENGTH + this.META_LENGTH, c = r.decode(t.slice(a, a + n));
    a = a + n;
    let u = r.decode(t.slice(a, a + s));
    a = a + s;
    let l = r.decode(t.slice(a, a + i));
    a = a + i;
    let h = r.decode(t.slice(a, a + o));
    a = a + o;
    let f = t.slice(a, t.byteLength), d = { status: h, response: f };
    return { join_ref: c, ref: u, topic: l, event: xe.reply, payload: d };
  },
  /** @private */
  decodeBroadcast(t, e, r) {
    let n = e.getUint8(1), s = e.getUint8(2), i = this.HEADER_LENGTH + 2, o = r.decode(t.slice(i, i + n));
    i = i + n;
    let a = r.decode(t.slice(i, i + s));
    i = i + s;
    let c = t.slice(i, t.byteLength);
    return { join_ref: null, ref: null, topic: o, event: a, payload: c };
  }
}, kd = class {
  /** Initializes the Socket *
   *
   * For IE8 support use an ES5-shim (https://github.com/es-shims/es5-shim)
   *
   * @constructor
   * @param {string} endPoint - The string WebSocket endpoint, ie, `"ws://example.com/socket"`,
   *                                               `"wss://example.com"`
   *                                               `"/socket"` (inherited host & protocol)
   * @param {SocketOptions} [opts] - Optional configuration
   */
  constructor(t, e = {}) {
    this.stateChangeCallbacks = { open: [], close: [], error: [], message: [] }, this.channels = [], this.sendBuffer = [], this.ref = 0, this.fallbackRef = null, this.timeout = e.timeout || wd, this.transport = e.transport || De.WebSocket || ct, this.conn = void 0, this.primaryPassedHealthCheck = !1, this.longPollFallbackMs = e.longPollFallbackMs, this.fallbackTimer = null, this.sessionStore = e.sessionStorage || De && De.sessionStorage, this.establishedConnections = 0, this.defaultEncoder = tr.encode.bind(tr), this.defaultDecoder = tr.decode.bind(tr), this.closeWasClean = !0, this.disconnecting = !1, this.binaryType = e.binaryType || "arraybuffer", this.connectClock = 1, this.pageHidden = !1, this.encode = void 0, this.decode = void 0, this.transport !== ct ? (this.encode = e.encode || this.defaultEncoder, this.decode = e.decode || this.defaultDecoder) : (this.encode = this.defaultEncoder, this.decode = this.defaultDecoder);
    let r = null;
    mt && mt.addEventListener && (mt.addEventListener("pagehide", (n) => {
      this.conn && (this.disconnect(), r = this.connectClock);
    }), mt.addEventListener("pageshow", (n) => {
      r === this.connectClock && (r = null, this.connect());
    }), mt.addEventListener("visibilitychange", () => {
      document.visibilityState === "hidden" ? this.pageHidden = !0 : (this.pageHidden = !1, !this.isConnected() && !this.closeWasClean && this.teardown(() => this.connect()));
    })), this.heartbeatIntervalMs = e.heartbeatIntervalMs || 3e4, this.autoSendHeartbeat = e.autoSendHeartbeat ?? !0, this.heartbeatCallback = e.heartbeatCallback ?? (() => {
    }), this.rejoinAfterMs = (n) => e.rejoinAfterMs ? e.rejoinAfterMs(n) : [1e3, 2e3, 5e3][n - 1] || 1e4, this.reconnectAfterMs = (n) => e.reconnectAfterMs ? e.reconnectAfterMs(n) : [10, 50, 100, 150, 200, 250, 500, 1e3, 2e3][n - 1] || 5e3, this.logger = e.logger || null, !this.logger && e.debug && (this.logger = (n, s, i) => {
      console.log(`${n}: ${s}`, i);
    }), this.longpollerTimeout = e.longpollerTimeout || 2e4, this.params = Pt(e.params || {}), this.endPoint = `${t}/${hn.websocket}`, this.vsn = e.vsn || vd, this.heartbeatTimeoutTimer = null, this.heartbeatTimer = null, this.heartbeatSentAt = null, this.pendingHeartbeatRef = null, this.reconnectTimer = new no(() => {
      if (this.pageHidden) {
        this.log("Not reconnecting as page is hidden!"), this.teardown();
        return;
      }
      this.teardown(async () => {
        e.beforeReconnect && await e.beforeReconnect(), this.connect();
      });
    }, this.reconnectAfterMs), this.authToken = e.authToken;
  }
  /**
   * Returns the LongPoll transport reference
   */
  getLongPollTransport() {
    return ct;
  }
  /**
   * Disconnects and replaces the active transport
   *
   * @param {SocketTransport} newTransport - The new transport class to instantiate
   *
   */
  replaceTransport(t) {
    this.connectClock++, this.closeWasClean = !0, clearTimeout(this.fallbackTimer), this.reconnectTimer.reset(), this.conn && (this.conn.close(), this.conn = null), this.transport = t;
  }
  /**
   * Returns the socket protocol
   *
   * @returns {"wss" | "ws"}
   */
  protocol() {
    return location.protocol.match(/^https/) ? "wss" : "ws";
  }
  /**
   * The fully qualified socket url
   *
   * @returns {string}
   */
  endPointURL() {
    let t = Er.appendParams(
      Er.appendParams(this.endPoint, this.params()),
      { vsn: this.vsn }
    );
    return t.charAt(0) !== "/" ? t : t.charAt(1) === "/" ? `${this.protocol()}:${t}` : `${this.protocol()}://${location.host}${t}`;
  }
  /**
   * Disconnects the socket
   *
   * See https://developer.mozilla.org/en-US/docs/Web/API/CloseEvent#Status_codes for valid status codes.
   *
   * @param {() => void} [callback] - Optional callback which is called after socket is disconnected.
   * @param {number} [code] - A status code for disconnection (Optional).
   * @param {string} [reason] - A textual description of the reason to disconnect. (Optional)
   */
  disconnect(t, e, r) {
    this.connectClock++, this.disconnecting = !0, this.closeWasClean = !0, clearTimeout(this.fallbackTimer), this.reconnectTimer.reset(), this.teardown(() => {
      this.disconnecting = !1, t && t();
    }, e, r);
  }
  /**
   * @param {Params} [params] - [DEPRECATED] The params to send when connecting, for example `{user_id: userToken}`
   *
   * Passing params to connect is deprecated; pass them in the Socket constructor instead:
   * `new Socket("/socket", {params: {user_id: userToken}})`.
   */
  connect(t) {
    t && (console && console.log("passing params to connect is deprecated. Instead pass :params to the Socket constructor"), this.params = Pt(t)), !(this.conn && !this.disconnecting) && (this.longPollFallbackMs && this.transport !== ct ? this.connectWithFallback(ct, this.longPollFallbackMs) : this.transportConnect());
  }
  /**
   * Logs the message. Override `this.logger` for specialized logging. noops by default
   * @param {string} kind
   * @param {string} msg
   * @param {Object} data
   */
  log(t, e, r) {
    this.logger && this.logger(t, e, r);
  }
  /**
   * Returns true if a logger has been set on this socket.
   */
  hasLogger() {
    return this.logger !== null;
  }
  /**
   * Registers callbacks for connection open events
   *
   * @example socket.onOpen(function(){ console.info("the socket was opened") })
   *
   * @param {SocketOnOpen} callback
   */
  onOpen(t) {
    let e = this.makeRef();
    return this.stateChangeCallbacks.open.push([e, t]), e;
  }
  /**
   * Registers callbacks for connection close events
   * @param {SocketOnClose} callback
   * @returns {string}
   */
  onClose(t) {
    let e = this.makeRef();
    return this.stateChangeCallbacks.close.push([e, t]), e;
  }
  /**
   * Registers callbacks for connection error events
   *
   * @example socket.onError(function(error){ alert("An error occurred") })
   *
   * @param {SocketOnError} callback
   * @returns {string}
   */
  onError(t) {
    let e = this.makeRef();
    return this.stateChangeCallbacks.error.push([e, t]), e;
  }
  /**
   * Registers callbacks for connection message events
   * @param {SocketOnMessage} callback
   * @returns {string}
   */
  onMessage(t) {
    let e = this.makeRef();
    return this.stateChangeCallbacks.message.push([e, t]), e;
  }
  /**
   * Sets a callback that receives lifecycle events for internal heartbeat messages.
   * Useful for instrumenting connection health (e.g. sent/ok/timeout/disconnected).
   * @param {HeartbeatCallback} callback
   */
  onHeartbeat(t) {
    this.heartbeatCallback = t;
  }
  /**
   * Pings the server and invokes the callback with the RTT in milliseconds
   * @param {(timeDelta: number) => void} callback
   *
   * Returns true if the ping was pushed or false if unable to be pushed.
   */
  ping(t) {
    if (!this.isConnected())
      return !1;
    let e = this.makeRef(), r = Date.now();
    this.push({ topic: "phoenix", event: "heartbeat", payload: {}, ref: e });
    let n = this.onMessage((s) => {
      s.ref === e && (this.off([n]), t(Date.now() - r));
    });
    return !0;
  }
  /**
   * @private
   *
   * @param {Function}
   */
  transportName(t) {
    switch (t) {
      case ct:
        return "LongPoll";
      default:
        return t.name;
    }
  }
  /**
   * @private
   */
  transportConnect() {
    this.connectClock++, this.closeWasClean = !1;
    let t;
    this.authToken && (t = ["phoenix", `${dn}${btoa(this.authToken).replace(/=/g, "")}`]), this.conn = new this.transport(this.endPointURL(), t), this.conn.binaryType = this.binaryType, this.conn.timeout = this.longpollerTimeout, this.conn.onopen = () => this.onConnOpen(), this.conn.onerror = (e) => this.onConnError(e), this.conn.onmessage = (e) => this.onConnMessage(e), this.conn.onclose = (e) => this.onConnClose(e);
  }
  getSession(t) {
    return this.sessionStore && this.sessionStore.getItem(t);
  }
  storeSession(t, e) {
    this.sessionStore && this.sessionStore.setItem(t, e);
  }
  connectWithFallback(t, e = 2500) {
    clearTimeout(this.fallbackTimer);
    let r = !1, n = !0, s, i, o = this.transportName(t), a = (c) => {
      this.log("transport", `falling back to ${o}...`, c), this.off([s, i]), n = !1, this.replaceTransport(t), this.transportConnect();
    };
    if (this.getSession(`phx:fallback:${o}`))
      return a("memorized");
    this.fallbackTimer = setTimeout(a, e), i = this.onError((c) => {
      this.log("transport", "error", c), n && !r && (clearTimeout(this.fallbackTimer), a(c));
    }), this.fallbackRef && this.off([this.fallbackRef]), this.fallbackRef = this.onOpen(() => {
      if (r = !0, !n) {
        let c = this.transportName(t);
        return this.primaryPassedHealthCheck || this.storeSession(`phx:fallback:${c}`, "true"), this.log("transport", `established ${c} fallback`);
      }
      clearTimeout(this.fallbackTimer), this.fallbackTimer = setTimeout(a, e), this.ping((c) => {
        this.log("transport", "connected to primary after", c), this.primaryPassedHealthCheck = !0, clearTimeout(this.fallbackTimer);
      });
    }), this.transportConnect();
  }
  clearHeartbeats() {
    clearTimeout(this.heartbeatTimer), clearTimeout(this.heartbeatTimeoutTimer);
  }
  onConnOpen() {
    this.hasLogger() && this.log("transport", `connected to ${this.endPointURL()}`), this.closeWasClean = !1, this.disconnecting = !1, this.establishedConnections++, this.flushSendBuffer(), this.reconnectTimer.reset(), this.autoSendHeartbeat && this.resetHeartbeat(), this.triggerStateCallbacks("open");
  }
  /**
   * @private
   */
  heartbeatTimeout() {
    if (this.pendingHeartbeatRef) {
      this.pendingHeartbeatRef = null, this.heartbeatSentAt = null, this.hasLogger() && this.log("transport", "heartbeat timeout. Attempting to re-establish connection");
      try {
        this.heartbeatCallback("timeout");
      } catch (t) {
        this.log("error", "error in heartbeat callback", t);
      }
      this.triggerChanError(), this.closeWasClean = !1, this.teardown(() => this.reconnectTimer.scheduleTimeout(), bd, "heartbeat timeout");
    }
  }
  resetHeartbeat() {
    this.conn && this.conn.skipHeartbeat || (this.pendingHeartbeatRef = null, this.clearHeartbeats(), this.heartbeatTimer = setTimeout(() => this.sendHeartbeat(), this.heartbeatIntervalMs));
  }
  teardown(t, e, r) {
    if (!this.conn)
      return t && t();
    const n = this.conn;
    this.waitForBufferDone(n, () => {
      e ? n.close(e, r || "") : n.close(), this.waitForSocketClosed(n, () => {
        this.conn === n && (this.conn.onopen = function() {
        }, this.conn.onerror = function() {
        }, this.conn.onmessage = function() {
        }, this.conn.onclose = function() {
        }, this.conn = null), t && t();
      });
    });
  }
  waitForBufferDone(t, e, r = 1) {
    if (r === 5 || !t.bufferedAmount) {
      e();
      return;
    }
    setTimeout(() => {
      this.waitForBufferDone(t, e, r + 1);
    }, 150 * r);
  }
  waitForSocketClosed(t, e, r = 1) {
    if (r === 5 || t.readyState === Ue.closed) {
      e();
      return;
    }
    setTimeout(() => {
      this.waitForSocketClosed(t, e, r + 1);
    }, 150 * r);
  }
  /**
  * @param {CloseEvent} event
  */
  onConnClose(t) {
    this.conn && (this.conn.onclose = () => {
    }), this.hasLogger() && this.log("transport", "close", t), this.triggerChanError(), this.clearHeartbeats(), this.closeWasClean || this.reconnectTimer.scheduleTimeout(), this.triggerStateCallbacks("close", t);
  }
  /**
   * @private
   * @param {Event} error
   */
  onConnError(t) {
    this.hasLogger() && this.log("transport", t);
    let e = this.transport, r = this.establishedConnections;
    this.triggerStateCallbacks("error", t, e, r), (e === this.transport || r > 0) && this.triggerChanError();
  }
  /**
   * @private
   */
  triggerChanError() {
    this.channels.forEach((t) => {
      t.isErrored() || t.isLeaving() || t.isClosed() || t.trigger(xe.error);
    });
  }
  /**
   * @returns {string}
   */
  connectionState() {
    switch (this.conn && this.conn.readyState) {
      case Ue.connecting:
        return "connecting";
      case Ue.open:
        return "open";
      case Ue.closing:
        return "closing";
      default:
        return "closed";
    }
  }
  /**
   * @returns {boolean}
   */
  isConnected() {
    return this.connectionState() === "open";
  }
  /**
   *
   * @param {Channel} channel
   */
  remove(t) {
    this.off(t.stateChangeRefs), this.channels = this.channels.filter((e) => e !== t);
  }
  /**
   * Removes `onOpen`, `onClose`, `onError,` and `onMessage` registrations.
   *
   * @param {string[]} refs - list of refs returned by calls to
   *                 `onOpen`, `onClose`, `onError,` and `onMessage`
   */
  off(t) {
    for (let e in this.stateChangeCallbacks)
      this.stateChangeCallbacks[e] = this.stateChangeCallbacks[e].filter(([r]) => t.indexOf(r) === -1);
  }
  /**
   * Initiates a new channel for the given topic
   *
   * @param {string} topic
   * @param {Params | (() => Params)} [chanParams]- Parameters for the channel
   * @returns {Channel}
   */
  channel(t, e = {}) {
    let r = new Sd(t, e, this);
    return this.channels.push(r), r;
  }
  /**
   * @param {Message<Record<string, any>>} data
   */
  push(t) {
    if (this.hasLogger()) {
      let { topic: e, event: r, payload: n, ref: s, join_ref: i } = t;
      this.log("push", `${e} ${r} (${i}, ${s})`, n);
    }
    this.isConnected() ? this.encode(t, (e) => this.conn.send(e)) : this.sendBuffer.push(() => this.encode(t, (e) => this.conn.send(e)));
  }
  /**
   * Return the next message ref, accounting for overflows
   * @returns {string}
   */
  makeRef() {
    let t = this.ref + 1;
    return t === this.ref ? this.ref = 0 : this.ref = t, this.ref.toString();
  }
  sendHeartbeat() {
    if (!this.isConnected()) {
      try {
        this.heartbeatCallback("disconnected");
      } catch (t) {
        this.log("error", "error in heartbeat callback", t);
      }
      return;
    }
    if (this.pendingHeartbeatRef) {
      this.heartbeatTimeout();
      return;
    }
    this.pendingHeartbeatRef = this.makeRef(), this.heartbeatSentAt = Date.now(), this.push({ topic: "phoenix", event: "heartbeat", payload: {}, ref: this.pendingHeartbeatRef });
    try {
      this.heartbeatCallback("sent");
    } catch (t) {
      this.log("error", "error in heartbeat callback", t);
    }
    this.heartbeatTimeoutTimer = setTimeout(() => this.heartbeatTimeout(), this.heartbeatIntervalMs);
  }
  flushSendBuffer() {
    this.isConnected() && this.sendBuffer.length > 0 && (this.sendBuffer.forEach((t) => t()), this.sendBuffer = []);
  }
  /**
  * @param {MessageEvent<any>} rawMessage
  */
  onConnMessage(t) {
    this.decode(t.data, (e) => {
      let { topic: r, event: n, payload: s, ref: i, join_ref: o } = e;
      if (i && i === this.pendingHeartbeatRef) {
        const a = this.heartbeatSentAt ? Date.now() - this.heartbeatSentAt : void 0;
        this.clearHeartbeats();
        try {
          this.heartbeatCallback(s.status === "ok" ? "ok" : "error", a);
        } catch (c) {
          this.log("error", "error in heartbeat callback", c);
        }
        this.pendingHeartbeatRef = null, this.heartbeatSentAt = null, this.autoSendHeartbeat && (this.heartbeatTimer = setTimeout(() => this.sendHeartbeat(), this.heartbeatIntervalMs));
      }
      this.hasLogger() && this.log("receive", `${s.status || ""} ${r} ${n} ${i && "(" + i + ")" || ""}`.trim(), s);
      for (let a = 0; a < this.channels.length; a++) {
        const c = this.channels[a];
        c.isMember(r, n, s, o) && c.trigger(n, s, i, o);
      }
      this.triggerStateCallbacks("message", e);
    });
  }
  /**
   * @private
   * @template {keyof SocketStateChangeCallbacks} K
   * @param {K} event
   * @param {...Parameters<SocketStateChangeCallbacks[K][number][1]>} args
   * @returns {void}
   */
  triggerStateCallbacks(t, ...e) {
    try {
      this.stateChangeCallbacks[t].forEach(([r, n]) => {
        try {
          n(...e);
        } catch (s) {
          this.log("error", `error in ${t} callback`, s);
        }
      });
    } catch (r) {
      this.log("error", `error triggering ${t} callbacks`, r);
    }
  }
  leaveOpenTopic(t) {
    let e = this.channels.find((r) => r.topic === t && (r.isJoined() || r.isJoining()));
    e && (this.hasLogger() && this.log("transport", `leaving duplicate topic "${t}"`), e.leave());
  }
};
class Dt {
  constructor(e, r) {
    const n = Nd(r);
    this.presence = new Ad(e.getChannel(), n), this.presence.onJoin((s, i, o) => {
      const a = Dt.onJoinPayload(s, i, o);
      e.getChannel().trigger("presence", a);
    }), this.presence.onLeave((s, i, o) => {
      const a = Dt.onLeavePayload(s, i, o);
      e.getChannel().trigger("presence", a);
    }), this.presence.onSync(() => {
      e.getChannel().trigger("presence", { event: "sync" });
    });
  }
  get state() {
    return Dt.transformState(this.presence.state);
  }
  /**
   * @private
   * Remove 'metas' key
   * Change 'phx_ref' to 'presence_ref'
   * Remove 'phx_ref' and 'phx_ref_prev'
   *
   * @example Transform state
   * // returns {
   *  abc123: [
   *    { presence_ref: '2', user_id: 1 },
   *    { presence_ref: '3', user_id: 2 }
   *  ]
   * }
   * RealtimePresence.transformState({
   *  abc123: {
   *    metas: [
   *      { phx_ref: '2', phx_ref_prev: '1' user_id: 1 },
   *      { phx_ref: '3', user_id: 2 }
   *    ]
   *  }
   * })
   *
   */
  static transformState(e) {
    return e = Rd(e), Object.getOwnPropertyNames(e).reduce((r, n) => {
      const s = e[n];
      return r[n] = fr(s), r;
    }, {});
  }
  static onJoinPayload(e, r, n) {
    const s = Us(r), i = fr(n);
    return {
      event: "join",
      key: e,
      currentPresences: s,
      newPresences: i
    };
  }
  static onLeavePayload(e, r, n) {
    const s = Us(r), i = fr(n);
    return {
      event: "leave",
      key: e,
      currentPresences: s,
      leftPresences: i
    };
  }
}
function fr(t) {
  return t.metas.map((e) => (e.presence_ref = e.phx_ref, delete e.phx_ref, delete e.phx_ref_prev, e));
}
function Rd(t) {
  return JSON.parse(JSON.stringify(t));
}
function Nd(t) {
  return (t == null ? void 0 : t.events) && { events: t.events };
}
function Us(t) {
  return t != null && t.metas ? fr(t) : [];
}
var $s;
(function(t) {
  t.SYNC = "sync", t.JOIN = "join", t.LEAVE = "leave";
})($s || ($s = {}));
class Id {
  get state() {
    return this.presenceAdapter.state;
  }
  /**
   * Creates a Presence helper that keeps the local presence state in sync with the server.
   *
   * @param channel - The realtime channel to bind to.
   * @param opts - Optional custom event names, e.g. `{ events: { state: 'state', diff: 'diff' } }`.
   *
   * @category Realtime
   *
   * @example Example for a presence channel
   * ```ts
   * const presence = new RealtimePresence(channel)
   *
   * channel.on('presence', ({ event, key }) => {
   *   console.log(`Presence ${event} on ${key}`)
   * })
   * ```
   */
  constructor(e, r) {
    this.channel = e, this.presenceAdapter = new Dt(this.channel.channelAdapter, r);
  }
}
class Ld {
  constructor(e, r, n) {
    const s = Cd(n);
    this.channel = e.getSocket().channel(r, s), this.socket = e;
  }
  get state() {
    return this.channel.state;
  }
  set state(e) {
    this.channel.state = e;
  }
  get joinedOnce() {
    return this.channel.joinedOnce;
  }
  get joinPush() {
    return this.channel.joinPush;
  }
  get rejoinTimer() {
    return this.channel.rejoinTimer;
  }
  on(e, r) {
    return this.channel.on(e, r);
  }
  off(e, r) {
    this.channel.off(e, r);
  }
  subscribe(e) {
    return this.channel.join(e);
  }
  unsubscribe(e) {
    return this.channel.leave(e);
  }
  teardown() {
    this.channel.teardown();
  }
  onClose(e) {
    this.channel.onClose(e);
  }
  onError(e) {
    return this.channel.onError(e);
  }
  push(e, r, n) {
    let s;
    try {
      s = this.channel.push(e, r, n);
    } catch {
      throw new Error(`tried to push '${e}' to '${this.channel.topic}' before joining. Use channel.subscribe() before pushing events`);
    }
    if (this.channel.pushBuffer.length > hd) {
      const i = this.channel.pushBuffer.shift();
      i.cancelTimeout(), this.socket.log("channel", `discarded push due to buffer overflow: ${i.event}`, i.payload());
    }
    return s;
  }
  updateJoinPayload(e) {
    const r = this.channel.joinPush.payload();
    this.channel.joinPush.payload = () => Object.assign(Object.assign({}, r), e);
  }
  canPush() {
    return this.socket.isConnected() && this.state === Me.joined;
  }
  isJoined() {
    return this.state === Me.joined;
  }
  isJoining() {
    return this.state === Me.joining;
  }
  isClosed() {
    return this.state === Me.closed;
  }
  isLeaving() {
    return this.state === Me.leaving;
  }
  updateFilterBindings(e) {
    this.channel.filterBindings = e;
  }
  updatePayloadTransform(e) {
    this.channel.onMessage = e;
  }
  /**
   * @internal
   */
  getChannel() {
    return this.channel;
  }
}
function Cd(t) {
  return {
    config: Object.assign({
      broadcast: { ack: !1, self: !1 },
      presence: { key: "", enabled: !1 },
      private: !1
    }, t.config)
  };
}
var js;
(function(t) {
  t.ALL = "*", t.INSERT = "INSERT", t.UPDATE = "UPDATE", t.DELETE = "DELETE";
})(js || (js = {}));
var vt;
(function(t) {
  t.BROADCAST = "broadcast", t.PRESENCE = "presence", t.POSTGRES_CHANGES = "postgres_changes", t.SYSTEM = "system";
})(vt || (vt = {}));
var Fe;
(function(t) {
  t.SUBSCRIBED = "SUBSCRIBED", t.TIMED_OUT = "TIMED_OUT", t.CLOSED = "CLOSED", t.CHANNEL_ERROR = "CHANNEL_ERROR";
})(Fe || (Fe = {}));
class Ut {
  get state() {
    return this.channelAdapter.state;
  }
  set state(e) {
    this.channelAdapter.state = e;
  }
  get joinedOnce() {
    return this.channelAdapter.joinedOnce;
  }
  get timeout() {
    return this.socket.timeout;
  }
  get joinPush() {
    return this.channelAdapter.joinPush;
  }
  get rejoinTimer() {
    return this.channelAdapter.rejoinTimer;
  }
  /**
   * Creates a channel that can broadcast messages, sync presence, and listen to Postgres changes.
   *
   * The topic determines which realtime stream you are subscribing to. Config options let you
   * enable acknowledgement for broadcasts, presence tracking, or private channels.
   *
   * @category Realtime
   *
   * @example Using supabase-js (recommended)
   * ```ts
   * import { createClient } from '@supabase/supabase-js'
   *
   * const supabase = createClient('https://xyzcompany.supabase.co', 'publishable-or-anon-key')
   * const channel = supabase.channel('room1')
   * channel
   *   .on('broadcast', { event: 'cursor-pos' }, (payload) => console.log(payload))
   *   .subscribe()
   * ```
   *
   * @example Standalone import for bundle-sensitive environments
   * ```ts
   * import RealtimeClient from '@supabase/realtime-js'
   *
   * const client = new RealtimeClient('https://xyzcompany.supabase.co/realtime/v1', {
   *   params: { apikey: 'publishable-or-anon-key' },
   * })
   * const channel = new RealtimeChannel('realtime:public:messages', { config: {} }, client)
   * ```
   */
  constructor(e, r = { config: {} }, n) {
    var s, i;
    if (this.topic = e, this.params = r, this.socket = n, this.bindings = {}, this.subTopic = e.replace(/^realtime:/i, ""), this.params.config = Object.assign({
      broadcast: { ack: !1, self: !1 },
      presence: { key: "", enabled: !1 },
      private: !1
    }, r.config), this.channelAdapter = new Ld(this.socket.socketAdapter, e, this.params), this.presence = new Id(this), this._onClose(() => {
      this.socket._remove(this);
    }), this._updateFilterTransform(), this.broadcastEndpointURL = ro(this.socket.socketAdapter.endPointURL()), this.private = this.params.config.private || !1, !this.private && (!((i = (s = this.params.config) === null || s === void 0 ? void 0 : s.broadcast) === null || i === void 0) && i.replay))
      throw new Error(`tried to use replay on public channel '${this.topic}'. It must be a private channel.`);
  }
  /**
   * Subscribe registers your client with the server
   * @category Realtime
   */
  subscribe(e, r = this.timeout) {
    var n, s, i;
    if (this.socket.isConnected() || this.socket.connect(), this.channelAdapter.isClosed()) {
      const { config: { broadcast: o, presence: a, private: c } } = this.params, u = (s = (n = this.bindings.postgres_changes) === null || n === void 0 ? void 0 : n.map((d) => d.filter)) !== null && s !== void 0 ? s : [], l = !!this.bindings[vt.PRESENCE] && this.bindings[vt.PRESENCE].length > 0 || ((i = this.params.config.presence) === null || i === void 0 ? void 0 : i.enabled) === !0, h = {}, f = {
        broadcast: o,
        presence: Object.assign(Object.assign({}, a), { enabled: l }),
        postgres_changes: u,
        private: c
      };
      this.socket.accessTokenValue && (h.access_token = this.socket.accessTokenValue), this._onError((d) => {
        e == null || e(Fe.CHANNEL_ERROR, d);
      }), this._onClose(() => e == null ? void 0 : e(Fe.CLOSED)), this.updateJoinPayload(Object.assign({ config: f }, h)), this._updateFilterMessage(), this.channelAdapter.subscribe(r).receive("ok", async ({ postgres_changes: d }) => {
        if (this.socket._isManualToken() || this.socket.setAuth(), d === void 0) {
          e == null || e(Fe.SUBSCRIBED);
          return;
        }
        this._updatePostgresBindings(d, e);
      }).receive("error", (d) => {
        this.state = Me.errored, e == null || e(Fe.CHANNEL_ERROR, new Error(JSON.stringify(Object.values(d).join(", ") || "error")));
      }).receive("timeout", () => {
        e == null || e(Fe.TIMED_OUT);
      });
    }
    return this;
  }
  _updatePostgresBindings(e, r) {
    var n;
    const s = this.bindings.postgres_changes, i = (n = s == null ? void 0 : s.length) !== null && n !== void 0 ? n : 0, o = [];
    for (let a = 0; a < i; a++) {
      const c = s[a], { filter: { event: u, schema: l, table: h, filter: f } } = c, d = e && e[a];
      if (d && d.event === u && Ut.isFilterValueEqual(d.schema, l) && Ut.isFilterValueEqual(d.table, h) && Ut.isFilterValueEqual(d.filter, f))
        o.push(Object.assign(Object.assign({}, c), { id: d.id }));
      else {
        this.unsubscribe(), this.state = Me.errored, r == null || r(Fe.CHANNEL_ERROR, new Error("mismatch between server and client bindings for postgres changes"));
        return;
      }
    }
    this.bindings.postgres_changes = o, this.state != Me.errored && r && r(Fe.SUBSCRIBED);
  }
  /**
   * Returns the current presence state for this channel.
   *
   * The shape is a map keyed by presence key (for example a user id) where each entry contains the
   * tracked metadata for that user.
   *
   * @category Realtime
   */
  presenceState() {
    return this.presence.state;
  }
  /**
   * Sends the supplied payload to the presence tracker so other subscribers can see that this
   * client is online. Use `untrack` to stop broadcasting presence for the same key.
   *
   * @category Realtime
   */
  async track(e, r = {}) {
    return await this.send({
      type: "presence",
      event: "track",
      payload: e
    }, r.timeout || this.timeout);
  }
  /**
   * Removes the current presence state for this client.
   *
   * @category Realtime
   */
  async untrack(e = {}) {
    return await this.send({
      type: "presence",
      event: "untrack"
    }, e);
  }
  /**
   * Listen to realtime events on this channel.
   * @category Realtime
   *
   * @remarks
   * - By default, Broadcast and Presence are enabled for all projects.
   * - By default, listening to database changes is disabled for new projects due to database performance and security concerns. You can turn it on by managing Realtime's [replication](/docs/guides/api#realtime-api-overview).
   * - You can receive the "previous" data for updates and deletes by setting the table's `REPLICA IDENTITY` to `FULL` (e.g., `ALTER TABLE your_table REPLICA IDENTITY FULL;`).
   * - Row level security is not applied to delete statements. When RLS is enabled and replica identity is set to full, only the primary key is sent to clients.
   *
   * @example Listen to broadcast messages
   * ```js
   * const channel = supabase.channel("room1")
   *
   * channel.on("broadcast", { event: "cursor-pos" }, (payload) => {
   *   console.log("Cursor position received!", payload);
   * }).subscribe((status) => {
   *   if (status === "SUBSCRIBED") {
   *     channel.send({
   *       type: "broadcast",
   *       event: "cursor-pos",
   *       payload: { x: Math.random(), y: Math.random() },
   *     });
   *   }
   * });
   * ```
   *
   * @example Listen to presence sync
   * ```js
   * const channel = supabase.channel('room1')
   * channel
   *   .on('presence', { event: 'sync' }, () => {
   *     console.log('Synced presence state: ', channel.presenceState())
   *   })
   *   .subscribe(async (status) => {
   *     if (status === 'SUBSCRIBED') {
   *       await channel.track({ online_at: new Date().toISOString() })
   *     }
   *   })
   * ```
   *
   * @example Listen to presence join
   * ```js
   * const channel = supabase.channel('room1')
   * channel
   *   .on('presence', { event: 'join' }, ({ newPresences }) => {
   *     console.log('Newly joined presences: ', newPresences)
   *   })
   *   .subscribe(async (status) => {
   *     if (status === 'SUBSCRIBED') {
   *       await channel.track({ online_at: new Date().toISOString() })
   *     }
   *   })
   * ```
   *
   * @example Listen to presence leave
   * ```js
   * const channel = supabase.channel('room1')
   * channel
   *   .on('presence', { event: 'leave' }, ({ leftPresences }) => {
   *     console.log('Newly left presences: ', leftPresences)
   *   })
   *   .subscribe(async (status) => {
   *     if (status === 'SUBSCRIBED') {
   *       await channel.track({ online_at: new Date().toISOString() })
   *       await channel.untrack()
   *     }
   *   })
   * ```
   *
   * @example Listen to all database changes
   * ```js
   * supabase
   *   .channel('room1')
   *   .on('postgres_changes', { event: '*', schema: '*' }, payload => {
   *     console.log('Change received!', payload)
   *   })
   *   .subscribe()
   * ```
   *
   * @example Listen to a specific table
   * ```js
   * supabase
   *   .channel('room1')
   *   .on('postgres_changes', { event: '*', schema: 'public', table: 'countries' }, payload => {
   *     console.log('Change received!', payload)
   *   })
   *   .subscribe()
   * ```
   *
   * @example Listen to inserts
   * ```js
   * supabase
   *   .channel('room1')
   *   .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'countries' }, payload => {
   *     console.log('Change received!', payload)
   *   })
   *   .subscribe()
   * ```
   *
   * @exampleDescription Listen to updates
   * By default, Supabase will send only the updated record. If you want to receive the previous values as well you can
   * enable full replication for the table you are listening to:
   *
   * ```sql
   * alter table "your_table" replica identity full;
   * ```
   *
   * @example Listen to updates
   * ```js
   * supabase
   *   .channel('room1')
   *   .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'countries' }, payload => {
   *     console.log('Change received!', payload)
   *   })
   *   .subscribe()
   * ```
   *
   * @exampleDescription Listen to deletes
   * By default, Supabase does not send deleted records. If you want to receive the deleted record you can
   * enable full replication for the table you are listening to:
   *
   * ```sql
   * alter table "your_table" replica identity full;
   * ```
   *
   * @example Listen to deletes
   * ```js
   * supabase
   *   .channel('room1')
   *   .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'countries' }, payload => {
   *     console.log('Change received!', payload)
   *   })
   *   .subscribe()
   * ```
   *
   * @exampleDescription Listen to multiple events
   * You can chain listeners if you want to listen to multiple events for each table.
   *
   * @example Listen to multiple events
   * ```js
   * supabase
   *   .channel('room1')
   *   .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'countries' }, handleRecordInserted)
   *   .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'countries' }, handleRecordDeleted)
   *   .subscribe()
   * ```
   *
   * @exampleDescription Listen to row level changes
   * You can listen to individual rows using the format `{table}:{col}=eq.{val}` - where `{col}` is the column name, and `{val}` is the value which you want to match.
   *
   * @example Listen to row level changes
   * ```js
   * supabase
   *   .channel('room1')
   *   .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'countries', filter: 'id=eq.200' }, handleRecordUpdated)
   *   .subscribe()
   * ```
   */
  on(e, r, n) {
    const s = this.channelAdapter.isJoined() || this.channelAdapter.isJoining(), i = e === vt.PRESENCE || e === vt.POSTGRES_CHANGES;
    if (s && i)
      throw this.socket.log("channel", `cannot add \`${e}\` callbacks for ${this.topic} after \`subscribe()\`.`), new Error(`cannot add \`${e}\` callbacks for ${this.topic} after \`subscribe()\`.`);
    return this._on(e, r, n);
  }
  /**
   * Sends a broadcast message explicitly via REST API.
   *
   * This method always uses the REST API endpoint regardless of WebSocket connection state.
   * Useful when you want to guarantee REST delivery or when gradually migrating from implicit REST fallback.
   *
   * @param event The name of the broadcast event
   * @param payload Payload to be sent (required)
   * @param opts Options including timeout
   * @returns Promise resolving to object with success status, and error details if failed
   *
   * @category Realtime
   */
  async httpSend(e, r, n = {}) {
    var s;
    if (r == null)
      return Promise.reject(new Error("Payload is required for httpSend()"));
    const i = {
      apikey: this.socket.apiKey ? this.socket.apiKey : "",
      "Content-Type": "application/json"
    };
    this.socket.accessTokenValue && (i.Authorization = `Bearer ${this.socket.accessTokenValue}`);
    const o = {
      method: "POST",
      headers: i,
      body: JSON.stringify({
        messages: [
          {
            topic: this.subTopic,
            event: e,
            payload: r,
            private: this.private
          }
        ]
      })
    }, a = await this._fetchWithTimeout(this.broadcastEndpointURL, o, (s = n.timeout) !== null && s !== void 0 ? s : this.timeout);
    if (a.status === 202)
      return { success: !0 };
    let c = a.statusText;
    try {
      const u = await a.json();
      c = u.error || u.message || c;
    } catch {
    }
    return Promise.reject(new Error(c));
  }
  /**
   * Sends a message into the channel.
   *
   * @param args Arguments to send to channel
   * @param args.type The type of event to send
   * @param args.event The name of the event being sent
   * @param args.payload Payload to be sent
   * @param opts Options to be used during the send process
   *
   * @category Realtime
   *
   * @remarks
   * - When using REST you don't need to subscribe to the channel
   * - REST calls are only available from 2.37.0 onwards
   *
   * @example Send a message via websocket
   * ```js
   * const channel = supabase.channel('room1')
   *
   * channel.subscribe((status) => {
   *   if (status === 'SUBSCRIBED') {
   *     channel.send({
   *       type: 'broadcast',
   *       event: 'cursor-pos',
   *       payload: { x: Math.random(), y: Math.random() },
   *     })
   *   }
   * })
   * ```
   *
   * @exampleResponse Send a message via websocket
   * ```js
   * ok | timed out | error
   * ```
   *
   * @example Send a message via REST
   * ```js
   * supabase
   *   .channel('room1')
   *   .httpSend('cursor-pos', { x: Math.random(), y: Math.random() })
   * ```
   */
  async send(e, r = {}) {
    var n, s;
    if (!this.channelAdapter.canPush() && e.type === "broadcast") {
      console.warn("Realtime send() is automatically falling back to REST API. This behavior will be deprecated in the future. Please use httpSend() explicitly for REST delivery.");
      const { event: i, payload: o } = e, a = {
        apikey: this.socket.apiKey ? this.socket.apiKey : "",
        "Content-Type": "application/json"
      };
      this.socket.accessTokenValue && (a.Authorization = `Bearer ${this.socket.accessTokenValue}`);
      const c = {
        method: "POST",
        headers: a,
        body: JSON.stringify({
          messages: [
            {
              topic: this.subTopic,
              event: i,
              payload: o,
              private: this.private
            }
          ]
        })
      };
      try {
        const u = await this._fetchWithTimeout(this.broadcastEndpointURL, c, (n = r.timeout) !== null && n !== void 0 ? n : this.timeout);
        return await ((s = u.body) === null || s === void 0 ? void 0 : s.cancel()), u.ok ? "ok" : "error";
      } catch (u) {
        return u.name === "AbortError" ? "timed out" : "error";
      }
    } else
      return new Promise((i) => {
        var o, a, c;
        const u = this.channelAdapter.push(e.type, e, r.timeout || this.timeout);
        e.type === "broadcast" && !(!((c = (a = (o = this.params) === null || o === void 0 ? void 0 : o.config) === null || a === void 0 ? void 0 : a.broadcast) === null || c === void 0) && c.ack) && i("ok"), u.receive("ok", () => i("ok")), u.receive("error", () => i("error")), u.receive("timeout", () => i("timed out"));
      });
  }
  /**
   * Updates the payload that will be sent the next time the channel joins (reconnects).
   * Useful for rotating access tokens or updating config without re-creating the channel.
   *
   * @category Realtime
   */
  updateJoinPayload(e) {
    this.channelAdapter.updateJoinPayload(e);
  }
  /**
   * Leaves the channel.
   *
   * Unsubscribes from server events, and instructs channel to terminate on server.
   * Triggers onClose() hooks.
   *
   * To receive leave acknowledgements, use the a `receive` hook to bind to the server ack, ie:
   * channel.unsubscribe().receive("ok", () => alert("left!") )
   *
   * @category Realtime
   */
  async unsubscribe(e = this.timeout) {
    return new Promise((r) => {
      this.channelAdapter.unsubscribe(e).receive("ok", () => r("ok")).receive("timeout", () => r("timed out")).receive("error", () => r("error"));
    });
  }
  /**
   * Destroys and stops related timers.
   *
   * @category Realtime
   */
  teardown() {
    this.channelAdapter.teardown();
  }
  /** @internal */
  async _fetchWithTimeout(e, r, n) {
    const s = new AbortController(), i = setTimeout(() => s.abort(), n), o = await this.socket.fetch(e, Object.assign(Object.assign({}, r), { signal: s.signal }));
    return clearTimeout(i), o;
  }
  /** @internal */
  _on(e, r, n) {
    const s = e.toLocaleLowerCase(), i = this.channelAdapter.on(e, n), o = {
      type: s,
      filter: r,
      callback: n,
      ref: i
    };
    return this.bindings[s] ? this.bindings[s].push(o) : this.bindings[s] = [o], this._updateFilterMessage(), this;
  }
  /**
   * Registers a callback that will be executed when the channel closes.
   *
   * @internal
   */
  _onClose(e) {
    this.channelAdapter.onClose(e);
  }
  /**
   * Registers a callback that will be executed when the channel encounteres an error.
   *
   * @internal
   */
  _onError(e) {
    this.channelAdapter.onError(e);
  }
  /** @internal */
  _updateFilterMessage() {
    this.channelAdapter.updateFilterBindings((e, r, n) => {
      var s, i, o, a, c, u, l;
      const h = e.event.toLocaleLowerCase();
      if (this._notThisChannelEvent(h, n))
        return !1;
      const f = (s = this.bindings[h]) === null || s === void 0 ? void 0 : s.find((d) => d.ref === e.ref);
      if (!f)
        return !0;
      if (["broadcast", "presence", "postgres_changes"].includes(h))
        if ("id" in f) {
          const d = f.id, g = (i = f.filter) === null || i === void 0 ? void 0 : i.event;
          return d && ((o = r.ids) === null || o === void 0 ? void 0 : o.includes(d)) && (g === "*" || (g == null ? void 0 : g.toLocaleLowerCase()) === ((a = r.data) === null || a === void 0 ? void 0 : a.type.toLocaleLowerCase()));
        } else {
          const d = (u = (c = f == null ? void 0 : f.filter) === null || c === void 0 ? void 0 : c.event) === null || u === void 0 ? void 0 : u.toLocaleLowerCase();
          return d === "*" || d === ((l = r == null ? void 0 : r.event) === null || l === void 0 ? void 0 : l.toLocaleLowerCase());
        }
      else
        return f.type.toLocaleLowerCase() === h;
    });
  }
  /** @internal */
  _notThisChannelEvent(e, r) {
    const { close: n, error: s, leave: i, join: o } = eo;
    return r && [n, s, i, o].includes(e) && r !== this.joinPush.ref;
  }
  /** @internal */
  _updateFilterTransform() {
    this.channelAdapter.updatePayloadTransform((e, r, n) => {
      if (typeof r == "object" && "ids" in r) {
        const s = r.data, { schema: i, table: o, commit_timestamp: a, type: c, errors: u } = s;
        return Object.assign(Object.assign({}, {
          schema: i,
          table: o,
          commit_timestamp: a,
          eventType: c,
          new: {},
          old: {},
          errors: u
        }), this._getPayloadRecords(s));
      }
      return r;
    });
  }
  copyBindings(e) {
    if (this.joinedOnce)
      throw new Error("cannot copy bindings into joined channel");
    for (const r in e.bindings)
      for (const n of e.bindings[r])
        this._on(n.type, n.filter, n.callback);
  }
  /**
   * Compares two optional filter values for equality.
   * Treats undefined, null, and empty string as equivalent empty values.
   * @internal
   */
  static isFilterValueEqual(e, r) {
    return (e ?? void 0) === (r ?? void 0);
  }
  /** @internal */
  _getPayloadRecords(e) {
    const r = {
      new: {},
      old: {}
    };
    return (e.type === "INSERT" || e.type === "UPDATE") && (r.new = Ds(e.columns, e.record)), (e.type === "UPDATE" || e.type === "DELETE") && (r.old = Ds(e.columns, e.old_record)), r;
  }
}
class Pd {
  constructor(e, r) {
    this.socket = new kd(e, r);
  }
  get timeout() {
    return this.socket.timeout;
  }
  get endPoint() {
    return this.socket.endPoint;
  }
  get transport() {
    return this.socket.transport;
  }
  get heartbeatIntervalMs() {
    return this.socket.heartbeatIntervalMs;
  }
  get heartbeatCallback() {
    return this.socket.heartbeatCallback;
  }
  set heartbeatCallback(e) {
    this.socket.heartbeatCallback = e;
  }
  get heartbeatTimer() {
    return this.socket.heartbeatTimer;
  }
  get pendingHeartbeatRef() {
    return this.socket.pendingHeartbeatRef;
  }
  get reconnectTimer() {
    return this.socket.reconnectTimer;
  }
  get vsn() {
    return this.socket.vsn;
  }
  get encode() {
    return this.socket.encode;
  }
  get decode() {
    return this.socket.decode;
  }
  get reconnectAfterMs() {
    return this.socket.reconnectAfterMs;
  }
  get sendBuffer() {
    return this.socket.sendBuffer;
  }
  get stateChangeCallbacks() {
    return this.socket.stateChangeCallbacks;
  }
  connect() {
    this.socket.connect();
  }
  disconnect(e, r, n, s = 1e4) {
    return new Promise((i) => {
      setTimeout(() => i("timeout"), s), this.socket.disconnect(() => {
        e(), i("ok");
      }, r, n);
    });
  }
  push(e) {
    this.socket.push(e);
  }
  log(e, r, n) {
    this.socket.log(e, r, n);
  }
  makeRef() {
    return this.socket.makeRef();
  }
  onOpen(e) {
    this.socket.onOpen(e);
  }
  onClose(e) {
    this.socket.onClose(e);
  }
  onError(e) {
    this.socket.onError(e);
  }
  onMessage(e) {
    this.socket.onMessage(e);
  }
  isConnected() {
    return this.socket.isConnected();
  }
  isConnecting() {
    return this.socket.connectionState() == un.connecting;
  }
  isDisconnecting() {
    return this.socket.connectionState() == un.closing;
  }
  connectionState() {
    return this.socket.connectionState();
  }
  endPointURL() {
    return this.socket.endPointURL();
  }
  sendHeartbeat() {
    this.socket.sendHeartbeat();
  }
  /**
   * @internal
   */
  getSocket() {
    return this.socket;
  }
}
const Dd = {
  HEARTBEAT_INTERVAL: 25e3
}, Ud = [1e3, 2e3, 5e3, 1e4], $d = 1e4, jd = `
  addEventListener("message", (e) => {
    if (e.data.event === "start") {
      setInterval(() => postMessage({ event: "keepAlive" }), e.data.interval);
    }
  });`;
class xd {
  get endPoint() {
    return this.socketAdapter.endPoint;
  }
  get timeout() {
    return this.socketAdapter.timeout;
  }
  get transport() {
    return this.socketAdapter.transport;
  }
  get heartbeatCallback() {
    return this.socketAdapter.heartbeatCallback;
  }
  get heartbeatIntervalMs() {
    return this.socketAdapter.heartbeatIntervalMs;
  }
  get heartbeatTimer() {
    return this.worker ? this._workerHeartbeatTimer : this.socketAdapter.heartbeatTimer;
  }
  get pendingHeartbeatRef() {
    return this.worker ? this._pendingWorkerHeartbeatRef : this.socketAdapter.pendingHeartbeatRef;
  }
  get reconnectTimer() {
    return this.socketAdapter.reconnectTimer;
  }
  get vsn() {
    return this.socketAdapter.vsn;
  }
  get encode() {
    return this.socketAdapter.encode;
  }
  get decode() {
    return this.socketAdapter.decode;
  }
  get reconnectAfterMs() {
    return this.socketAdapter.reconnectAfterMs;
  }
  get sendBuffer() {
    return this.socketAdapter.sendBuffer;
  }
  get stateChangeCallbacks() {
    return this.socketAdapter.stateChangeCallbacks;
  }
  /**
   * Initializes the Socket.
   *
   * @param endPoint The string WebSocket endpoint, ie, "ws://example.com/socket", "wss://example.com", "/socket" (inherited host & protocol)
   * @param httpEndpoint The string HTTP endpoint, ie, "https://example.com", "/" (inherited host & protocol)
   * @param options.transport The Websocket Transport, for example WebSocket. This can be a custom implementation
   * @param options.timeout The default timeout in milliseconds to trigger push timeouts.
   * @param options.params The optional params to pass when connecting.
   * @param options.headers Deprecated: headers cannot be set on websocket connections and this option will be removed in the future.
   * @param options.heartbeatIntervalMs The millisec interval to send a heartbeat message.
   * @param options.heartbeatCallback The optional function to handle heartbeat status and latency.
   * @param options.logger The optional function for specialized logging, ie: logger: (kind, msg, data) => { console.log(`${kind}: ${msg}`, data) }
   * @param options.logLevel Sets the log level for Realtime
   * @param options.encode The function to encode outgoing messages. Defaults to JSON: (payload, callback) => callback(JSON.stringify(payload))
   * @param options.decode The function to decode incoming messages. Defaults to Serializer's decode.
   * @param options.reconnectAfterMs he optional function that returns the millsec reconnect interval. Defaults to stepped backoff off.
   * @param options.worker Use Web Worker to set a side flow. Defaults to false.
   * @param options.workerUrl The URL of the worker script. Defaults to https://realtime.supabase.com/worker.js that includes a heartbeat event call to keep the connection alive.
   * @param options.vsn The protocol version to use when connecting. Supported versions are "1.0.0" and "2.0.0". Defaults to "2.0.0".
   *
   * @category Realtime
   *
   * @example Using supabase-js (recommended)
   * ```ts
   * import { createClient } from '@supabase/supabase-js'
   *
   * const supabase = createClient('https://xyzcompany.supabase.co', 'publishable-or-anon-key')
   * const channel = supabase.channel('room1')
   * channel
   *   .on('broadcast', { event: 'cursor-pos' }, (payload) => console.log(payload))
   *   .subscribe()
   * ```
   *
   * @example Standalone import for bundle-sensitive environments
   * ```ts
   * import RealtimeClient from '@supabase/realtime-js'
   *
   * const client = new RealtimeClient('https://xyzcompany.supabase.co/realtime/v1', {
   *   params: { apikey: 'publishable-or-anon-key' },
   * })
   * client.connect()
   * ```
   */
  constructor(e, r) {
    var n;
    if (this.channels = new Array(), this.accessTokenValue = null, this.accessToken = null, this.apiKey = null, this.httpEndpoint = "", this.headers = {}, this.params = {}, this.ref = 0, this.serializer = new dd(), this._manuallySetToken = !1, this._authPromise = null, this._workerHeartbeatTimer = void 0, this._pendingWorkerHeartbeatRef = null, this._resolveFetch = (i) => i ? (...o) => i(...o) : (...o) => fetch(...o), !(!((n = r == null ? void 0 : r.params) === null || n === void 0) && n.apikey))
      throw new Error("API key is required to connect to Realtime");
    this.apiKey = r.params.apikey;
    const s = this._initializeOptions(r);
    this.socketAdapter = new Pd(e, s), this.httpEndpoint = ro(e), this.fetch = this._resolveFetch(r == null ? void 0 : r.fetch);
  }
  /**
   * Connects the socket, unless already connected.
   *
   * @category Realtime
   */
  connect() {
    if (!(this.isConnecting() || this.isDisconnecting() || this.isConnected())) {
      this.accessToken && !this._authPromise && this._setAuthSafely("connect"), this._setupConnectionHandlers();
      try {
        this.socketAdapter.connect();
      } catch (e) {
        const r = e.message;
        throw r.includes("Node.js") ? new Error(`${r}

To use Realtime in Node.js, you need to provide a WebSocket implementation:

Option 1: Use Node.js 22+ which has native WebSocket support
Option 2: Install and provide the "ws" package:

  npm install ws

  import ws from "ws"
  const client = new RealtimeClient(url, {
    ...options,
    transport: ws
  })`) : new Error(`WebSocket not available: ${r}`);
      }
      this._handleNodeJsRaceCondition();
    }
  }
  /**
   * Returns the URL of the websocket.
   * @returns string The URL of the websocket.
   *
   * @category Realtime
   */
  endpointURL() {
    return this.socketAdapter.endPointURL();
  }
  /**
   * Disconnects the socket.
   *
   * @param code A numeric status code to send on disconnect.
   * @param reason A custom reason for the disconnect.
   *
   * @category Realtime
   */
  async disconnect(e, r) {
    return this.isDisconnecting() ? "ok" : await this.socketAdapter.disconnect(() => {
      clearInterval(this._workerHeartbeatTimer), this._terminateWorker();
    }, e, r);
  }
  /**
   * Returns all created channels
   *
   * @category Realtime
   */
  getChannels() {
    return this.channels;
  }
  /**
   * Unsubscribes, removes and tears down a single channel
   * @param channel A RealtimeChannel instance
   *
   * @category Realtime
   */
  async removeChannel(e) {
    const r = await e.unsubscribe();
    return r === "ok" && e.teardown(), this.channels.length === 0 && this.disconnect(), r;
  }
  /**
   * Unsubscribes, removes and tears down all channels
   *
   * @category Realtime
   */
  async removeAllChannels() {
    const e = this.channels.map(async (n) => {
      const s = await n.unsubscribe();
      return n.teardown(), s;
    }), r = await Promise.all(e);
    return this.disconnect(), r;
  }
  /**
   * Logs the message.
   *
   * For customized logging, `this.logger` can be overridden in Client constructor.
   *
   * @category Realtime
   */
  log(e, r, n) {
    this.socketAdapter.log(e, r, n);
  }
  /**
   * Returns the current state of the socket.
   *
   * @category Realtime
   */
  connectionState() {
    return this.socketAdapter.connectionState() || un.closed;
  }
  /**
   * Returns `true` is the connection is open.
   *
   * @category Realtime
   */
  isConnected() {
    return this.socketAdapter.isConnected();
  }
  /**
   * Returns `true` if the connection is currently connecting.
   *
   * @category Realtime
   */
  isConnecting() {
    return this.socketAdapter.isConnecting();
  }
  /**
   * Returns `true` if the connection is currently disconnecting.
   *
   * @category Realtime
   */
  isDisconnecting() {
    return this.socketAdapter.isDisconnecting();
  }
  /**
   * Creates (or reuses) a {@link RealtimeChannel} for the provided topic.
   *
   * Topics are automatically prefixed with `realtime:` to match the Realtime service.
   * If a channel with the same topic already exists it will be returned instead of creating
   * a duplicate connection.
   *
   * @category Realtime
   */
  channel(e, r = { config: {} }) {
    const n = `realtime:${e}`, s = this.getChannels().find((i) => i.topic === n);
    if (s)
      return s;
    {
      const i = new Ut(`realtime:${e}`, r, this);
      return this.channels.push(i), i;
    }
  }
  /**
   * Push out a message if the socket is connected.
   *
   * If the socket is not connected, the message gets enqueued within a local buffer, and sent out when a connection is next established.
   *
   * @category Realtime
   */
  push(e) {
    this.socketAdapter.push(e);
  }
  /**
   * Sets the JWT access token used for channel subscription authorization and Realtime RLS.
   *
   * If param is null it will use the `accessToken` callback function or the token set on the client.
   *
   * On callback used, it will set the value of the token internal to the client.
   *
   * When a token is explicitly provided, it will be preserved across channel operations
   * (including removeChannel and resubscribe). The `accessToken` callback will not be
   * invoked until `setAuth()` is called without arguments.
   *
   * @param token A JWT string to override the token set on the client.
   *
   * @example Setting the authorization header
   * // Use a manual token (preserved across resubscribes, ignores accessToken callback)
   * client.realtime.setAuth('my-custom-jwt')
   *
   * // Switch back to using the accessToken callback
   * client.realtime.setAuth()
   *
   * @category Realtime
   */
  async setAuth(e = null) {
    this._authPromise = this._performAuth(e);
    try {
      await this._authPromise;
    } finally {
      this._authPromise = null;
    }
  }
  /**
   * Returns true if the current access token was explicitly set via setAuth(token),
   * false if it was obtained via the accessToken callback.
   * @internal
   */
  _isManualToken() {
    return this._manuallySetToken;
  }
  /**
   * Sends a heartbeat message if the socket is connected.
   *
   * @category Realtime
   */
  async sendHeartbeat() {
    this.socketAdapter.sendHeartbeat();
  }
  /**
   * Sets a callback that receives lifecycle events for internal heartbeat messages.
   * Useful for instrumenting connection health (e.g. sent/ok/timeout/disconnected).
   *
   * @category Realtime
   */
  onHeartbeat(e) {
    this.socketAdapter.heartbeatCallback = this._wrapHeartbeatCallback(e);
  }
  /**
   * Return the next message ref, accounting for overflows
   *
   * @internal
   */
  _makeRef() {
    return this.socketAdapter.makeRef();
  }
  /**
   * Removes a channel from RealtimeClient
   *
   * @param channel An open subscription.
   *
   * @internal
   */
  _remove(e) {
    this.channels = this.channels.filter((r) => r.topic !== e.topic);
  }
  /**
   * Perform the actual auth operation
   * @internal
   */
  async _performAuth(e = null) {
    let r, n = !1;
    if (e)
      r = e, n = !0;
    else if (this.accessToken)
      try {
        r = await this.accessToken();
      } catch (s) {
        this.log("error", "Error fetching access token from callback", s), r = this.accessTokenValue;
      }
    else
      r = this.accessTokenValue;
    n ? this._manuallySetToken = !0 : this.accessToken && (this._manuallySetToken = !1), this.accessTokenValue != r && (this.accessTokenValue = r, this.channels.forEach((s) => {
      const i = {
        access_token: r,
        version: ad
      };
      r && s.updateJoinPayload(i), s.joinedOnce && s.channelAdapter.isJoined() && s.channelAdapter.push(eo.access_token, {
        access_token: r
      });
    }));
  }
  /**
   * Wait for any in-flight auth operations to complete
   * @internal
   */
  async _waitForAuthIfNeeded() {
    this._authPromise && await this._authPromise;
  }
  /**
   * Safely call setAuth with standardized error handling
   * @internal
   */
  _setAuthSafely(e = "general") {
    this._isManualToken() || this.setAuth().catch((r) => {
      this.log("error", `Error setting auth in ${e}`, r);
    });
  }
  /** @internal */
  _setupConnectionHandlers() {
    this.socketAdapter.onOpen(() => {
      (this._authPromise || (this.accessToken && !this.accessTokenValue ? this.setAuth() : Promise.resolve())).catch((r) => {
        this.log("error", "error waiting for auth on connect", r);
      }), this.worker && !this.workerRef && this._startWorkerHeartbeat();
    }), this.socketAdapter.onClose(() => {
      this.worker && this.workerRef && this._terminateWorker();
    }), this.socketAdapter.onMessage((e) => {
      e.ref && e.ref === this._pendingWorkerHeartbeatRef && (this._pendingWorkerHeartbeatRef = null);
    });
  }
  /** @internal */
  _handleNodeJsRaceCondition() {
    this.socketAdapter.isConnected() && this.socketAdapter.getSocket().onConnOpen();
  }
  /** @internal */
  _wrapHeartbeatCallback(e) {
    return (r, n) => {
      r == "sent" && this._setAuthSafely(), e && e(r, n);
    };
  }
  /** @internal */
  _startWorkerHeartbeat() {
    this.workerUrl ? this.log("worker", `starting worker for from ${this.workerUrl}`) : this.log("worker", "starting default worker");
    const e = this._workerObjectUrl(this.workerUrl);
    this.workerRef = new Worker(e), this.workerRef.onerror = (r) => {
      this.log("worker", "worker error", r.message), this._terminateWorker(), this.disconnect();
    }, this.workerRef.onmessage = (r) => {
      r.data.event === "keepAlive" && this.sendHeartbeat();
    }, this.workerRef.postMessage({
      event: "start",
      interval: this.heartbeatIntervalMs
    });
  }
  /**
   * Terminate the Web Worker and clear the reference
   * @internal
   */
  _terminateWorker() {
    this.workerRef && (this.log("worker", "terminating worker"), this.workerRef.terminate(), this.workerRef = void 0);
  }
  /** @internal */
  _workerObjectUrl(e) {
    let r;
    if (e)
      r = e;
    else {
      const n = new Blob([jd], { type: "application/javascript" });
      r = URL.createObjectURL(n);
    }
    return r;
  }
  /**
   * Initialize socket options with defaults
   * @internal
   */
  _initializeOptions(e) {
    var r, n, s, i, o, a, c, u, l;
    this.worker = (r = e == null ? void 0 : e.worker) !== null && r !== void 0 ? r : !1, this.accessToken = (n = e == null ? void 0 : e.accessToken) !== null && n !== void 0 ? n : null;
    const h = {};
    h.timeout = (s = e == null ? void 0 : e.timeout) !== null && s !== void 0 ? s : ld, h.heartbeatIntervalMs = (i = e == null ? void 0 : e.heartbeatIntervalMs) !== null && i !== void 0 ? i : Dd.HEARTBEAT_INTERVAL, h.transport = (o = e == null ? void 0 : e.transport) !== null && o !== void 0 ? o : id.getWebSocketConstructor(), h.params = e == null ? void 0 : e.params, h.logger = e == null ? void 0 : e.logger, h.heartbeatCallback = this._wrapHeartbeatCallback(e == null ? void 0 : e.heartbeatCallback), h.reconnectAfterMs = (a = e == null ? void 0 : e.reconnectAfterMs) !== null && a !== void 0 ? a : (y) => Ud[y - 1] || $d;
    let f, d;
    const g = (c = e == null ? void 0 : e.vsn) !== null && c !== void 0 ? c : ud;
    switch (g) {
      case cd:
        f = (y, I) => I(JSON.stringify(y)), d = (y, I) => I(JSON.parse(y));
        break;
      case Qi:
        f = this.serializer.encode.bind(this.serializer), d = this.serializer.decode.bind(this.serializer);
        break;
      default:
        throw new Error(`Unsupported serializer version: ${h.vsn}`);
    }
    if (h.vsn = g, h.encode = (u = e == null ? void 0 : e.encode) !== null && u !== void 0 ? u : f, h.decode = (l = e == null ? void 0 : e.decode) !== null && l !== void 0 ? l : d, h.beforeReconnect = this._reconnectAuth.bind(this), (e != null && e.logLevel || e != null && e.log_level) && (this.logLevel = e.logLevel || e.log_level, h.params = Object.assign(Object.assign({}, h.params), { log_level: this.logLevel })), this.worker) {
      if (typeof window < "u" && !window.Worker)
        throw new Error("Web Worker is not supported");
      this.workerUrl = e == null ? void 0 : e.workerUrl, h.autoSendHeartbeat = !this.worker;
    }
    return h;
  }
  /** @internal */
  async _reconnectAuth() {
    await this._waitForAuthIfNeeded(), this.isConnected() || this.connect();
  }
}
var Ft = class extends Error {
  constructor(t, e) {
    var r;
    super(t), this.name = "IcebergError", this.status = e.status, this.icebergType = e.icebergType, this.icebergCode = e.icebergCode, this.details = e.details, this.isCommitStateUnknown = e.icebergType === "CommitStateUnknownException" || [500, 502, 504].includes(e.status) && ((r = e.icebergType) == null ? void 0 : r.includes("CommitState")) === !0;
  }
  /**
   * Returns true if the error is a 404 Not Found error.
   */
  isNotFound() {
    return this.status === 404;
  }
  /**
   * Returns true if the error is a 409 Conflict error.
   */
  isConflict() {
    return this.status === 409;
  }
  /**
   * Returns true if the error is a 419 Authentication Timeout error.
   */
  isAuthenticationTimeout() {
    return this.status === 419;
  }
};
function Fd(t, e, r) {
  const n = new URL(e, t);
  if (r)
    for (const [s, i] of Object.entries(r))
      i !== void 0 && n.searchParams.set(s, i);
  return n.toString();
}
async function zd(t) {
  return !t || t.type === "none" ? {} : t.type === "bearer" ? { Authorization: `Bearer ${t.token}` } : t.type === "header" ? { [t.name]: t.value } : t.type === "custom" ? await t.getHeaders() : {};
}
function Bd(t) {
  const e = t.fetchImpl ?? globalThis.fetch;
  return {
    async request({
      method: r,
      path: n,
      query: s,
      body: i,
      headers: o
    }) {
      const a = Fd(t.baseUrl, n, s), c = await zd(t.auth), u = await e(a, {
        method: r,
        headers: {
          ...i ? { "Content-Type": "application/json" } : {},
          ...c,
          ...o
        },
        body: i ? JSON.stringify(i) : void 0
      }), l = await u.text(), h = (u.headers.get("content-type") || "").includes("application/json"), f = h && l ? JSON.parse(l) : l;
      if (!u.ok) {
        const d = h ? f : void 0, g = d == null ? void 0 : d.error;
        throw new Ft(
          (g == null ? void 0 : g.message) ?? `Request failed with status ${u.status}`,
          {
            status: u.status,
            icebergType: g == null ? void 0 : g.type,
            icebergCode: g == null ? void 0 : g.code,
            details: d
          }
        );
      }
      return { status: u.status, headers: u.headers, data: f };
    }
  };
}
function rr(t) {
  return t.join("");
}
var Md = class {
  constructor(t, e = "") {
    this.client = t, this.prefix = e;
  }
  async listNamespaces(t) {
    const e = t ? { parent: rr(t.namespace) } : void 0;
    return (await this.client.request({
      method: "GET",
      path: `${this.prefix}/namespaces`,
      query: e
    })).data.namespaces.map((n) => ({ namespace: n }));
  }
  async createNamespace(t, e) {
    const r = {
      namespace: t.namespace,
      properties: e == null ? void 0 : e.properties
    };
    return (await this.client.request({
      method: "POST",
      path: `${this.prefix}/namespaces`,
      body: r
    })).data;
  }
  async dropNamespace(t) {
    await this.client.request({
      method: "DELETE",
      path: `${this.prefix}/namespaces/${rr(t.namespace)}`
    });
  }
  async loadNamespaceMetadata(t) {
    return {
      properties: (await this.client.request({
        method: "GET",
        path: `${this.prefix}/namespaces/${rr(t.namespace)}`
      })).data.properties
    };
  }
  async namespaceExists(t) {
    try {
      return await this.client.request({
        method: "HEAD",
        path: `${this.prefix}/namespaces/${rr(t.namespace)}`
      }), !0;
    } catch (e) {
      if (e instanceof Ft && e.status === 404)
        return !1;
      throw e;
    }
  }
  async createNamespaceIfNotExists(t, e) {
    try {
      return await this.createNamespace(t, e);
    } catch (r) {
      if (r instanceof Ft && r.status === 409)
        return;
      throw r;
    }
  }
};
function ut(t) {
  return t.join("");
}
var Zd = class {
  constructor(t, e = "", r) {
    this.client = t, this.prefix = e, this.accessDelegation = r;
  }
  async listTables(t) {
    return (await this.client.request({
      method: "GET",
      path: `${this.prefix}/namespaces/${ut(t.namespace)}/tables`
    })).data.identifiers;
  }
  async createTable(t, e) {
    const r = {};
    return this.accessDelegation && (r["X-Iceberg-Access-Delegation"] = this.accessDelegation), (await this.client.request({
      method: "POST",
      path: `${this.prefix}/namespaces/${ut(t.namespace)}/tables`,
      body: e,
      headers: r
    })).data.metadata;
  }
  async updateTable(t, e) {
    const r = await this.client.request({
      method: "POST",
      path: `${this.prefix}/namespaces/${ut(t.namespace)}/tables/${t.name}`,
      body: e
    });
    return {
      "metadata-location": r.data["metadata-location"],
      metadata: r.data.metadata
    };
  }
  async dropTable(t, e) {
    await this.client.request({
      method: "DELETE",
      path: `${this.prefix}/namespaces/${ut(t.namespace)}/tables/${t.name}`,
      query: { purgeRequested: String((e == null ? void 0 : e.purge) ?? !1) }
    });
  }
  async loadTable(t) {
    const e = {};
    return this.accessDelegation && (e["X-Iceberg-Access-Delegation"] = this.accessDelegation), (await this.client.request({
      method: "GET",
      path: `${this.prefix}/namespaces/${ut(t.namespace)}/tables/${t.name}`,
      headers: e
    })).data.metadata;
  }
  async tableExists(t) {
    const e = {};
    this.accessDelegation && (e["X-Iceberg-Access-Delegation"] = this.accessDelegation);
    try {
      return await this.client.request({
        method: "HEAD",
        path: `${this.prefix}/namespaces/${ut(t.namespace)}/tables/${t.name}`,
        headers: e
      }), !0;
    } catch (r) {
      if (r instanceof Ft && r.status === 404)
        return !1;
      throw r;
    }
  }
  async createTableIfNotExists(t, e) {
    try {
      return await this.createTable(t, e);
    } catch (r) {
      if (r instanceof Ft && r.status === 409)
        return await this.loadTable({ namespace: t.namespace, name: e.name });
      throw r;
    }
  }
}, Hd = class {
  /**
   * Creates a new Iceberg REST Catalog client.
   *
   * @param options - Configuration options for the catalog client
   */
  constructor(t) {
    var n;
    let e = "v1";
    t.catalogName && (e += `/${t.catalogName}`);
    const r = t.baseUrl.endsWith("/") ? t.baseUrl : `${t.baseUrl}/`;
    this.client = Bd({
      baseUrl: r,
      auth: t.auth,
      fetchImpl: t.fetch
    }), this.accessDelegation = (n = t.accessDelegation) == null ? void 0 : n.join(","), this.namespaceOps = new Md(this.client, e), this.tableOps = new Zd(this.client, e, this.accessDelegation);
  }
  /**
   * Lists all namespaces in the catalog.
   *
   * @param parent - Optional parent namespace to list children under
   * @returns Array of namespace identifiers
   *
   * @example
   * ```typescript
   * // List all top-level namespaces
   * const namespaces = await catalog.listNamespaces();
   *
   * // List namespaces under a parent
   * const children = await catalog.listNamespaces({ namespace: ['analytics'] });
   * ```
   */
  async listNamespaces(t) {
    return this.namespaceOps.listNamespaces(t);
  }
  /**
   * Creates a new namespace in the catalog.
   *
   * @param id - Namespace identifier to create
   * @param metadata - Optional metadata properties for the namespace
   * @returns Response containing the created namespace and its properties
   *
   * @example
   * ```typescript
   * const response = await catalog.createNamespace(
   *   { namespace: ['analytics'] },
   *   { properties: { owner: 'data-team' } }
   * );
   * console.log(response.namespace); // ['analytics']
   * console.log(response.properties); // { owner: 'data-team', ... }
   * ```
   */
  async createNamespace(t, e) {
    return this.namespaceOps.createNamespace(t, e);
  }
  /**
   * Drops a namespace from the catalog.
   *
   * The namespace must be empty (contain no tables) before it can be dropped.
   *
   * @param id - Namespace identifier to drop
   *
   * @example
   * ```typescript
   * await catalog.dropNamespace({ namespace: ['analytics'] });
   * ```
   */
  async dropNamespace(t) {
    await this.namespaceOps.dropNamespace(t);
  }
  /**
   * Loads metadata for a namespace.
   *
   * @param id - Namespace identifier to load
   * @returns Namespace metadata including properties
   *
   * @example
   * ```typescript
   * const metadata = await catalog.loadNamespaceMetadata({ namespace: ['analytics'] });
   * console.log(metadata.properties);
   * ```
   */
  async loadNamespaceMetadata(t) {
    return this.namespaceOps.loadNamespaceMetadata(t);
  }
  /**
   * Lists all tables in a namespace.
   *
   * @param namespace - Namespace identifier to list tables from
   * @returns Array of table identifiers
   *
   * @example
   * ```typescript
   * const tables = await catalog.listTables({ namespace: ['analytics'] });
   * console.log(tables); // [{ namespace: ['analytics'], name: 'events' }, ...]
   * ```
   */
  async listTables(t) {
    return this.tableOps.listTables(t);
  }
  /**
   * Creates a new table in the catalog.
   *
   * @param namespace - Namespace to create the table in
   * @param request - Table creation request including name, schema, partition spec, etc.
   * @returns Table metadata for the created table
   *
   * @example
   * ```typescript
   * const metadata = await catalog.createTable(
   *   { namespace: ['analytics'] },
   *   {
   *     name: 'events',
   *     schema: {
   *       type: 'struct',
   *       fields: [
   *         { id: 1, name: 'id', type: 'long', required: true },
   *         { id: 2, name: 'timestamp', type: 'timestamp', required: true }
   *       ],
   *       'schema-id': 0
   *     },
   *     'partition-spec': {
   *       'spec-id': 0,
   *       fields: [
   *         { source_id: 2, field_id: 1000, name: 'ts_day', transform: 'day' }
   *       ]
   *     }
   *   }
   * );
   * ```
   */
  async createTable(t, e) {
    return this.tableOps.createTable(t, e);
  }
  /**
   * Updates an existing table's metadata.
   *
   * Can update the schema, partition spec, or properties of a table.
   *
   * @param id - Table identifier to update
   * @param request - Update request with fields to modify
   * @returns Response containing the metadata location and updated table metadata
   *
   * @example
   * ```typescript
   * const response = await catalog.updateTable(
   *   { namespace: ['analytics'], name: 'events' },
   *   {
   *     properties: { 'read.split.target-size': '134217728' }
   *   }
   * );
   * console.log(response['metadata-location']); // s3://...
   * console.log(response.metadata); // TableMetadata object
   * ```
   */
  async updateTable(t, e) {
    return this.tableOps.updateTable(t, e);
  }
  /**
   * Drops a table from the catalog.
   *
   * @param id - Table identifier to drop
   *
   * @example
   * ```typescript
   * await catalog.dropTable({ namespace: ['analytics'], name: 'events' });
   * ```
   */
  async dropTable(t, e) {
    await this.tableOps.dropTable(t, e);
  }
  /**
   * Loads metadata for a table.
   *
   * @param id - Table identifier to load
   * @returns Table metadata including schema, partition spec, location, etc.
   *
   * @example
   * ```typescript
   * const metadata = await catalog.loadTable({ namespace: ['analytics'], name: 'events' });
   * console.log(metadata.schema);
   * console.log(metadata.location);
   * ```
   */
  async loadTable(t) {
    return this.tableOps.loadTable(t);
  }
  /**
   * Checks if a namespace exists in the catalog.
   *
   * @param id - Namespace identifier to check
   * @returns True if the namespace exists, false otherwise
   *
   * @example
   * ```typescript
   * const exists = await catalog.namespaceExists({ namespace: ['analytics'] });
   * console.log(exists); // true or false
   * ```
   */
  async namespaceExists(t) {
    return this.namespaceOps.namespaceExists(t);
  }
  /**
   * Checks if a table exists in the catalog.
   *
   * @param id - Table identifier to check
   * @returns True if the table exists, false otherwise
   *
   * @example
   * ```typescript
   * const exists = await catalog.tableExists({ namespace: ['analytics'], name: 'events' });
   * console.log(exists); // true or false
   * ```
   */
  async tableExists(t) {
    return this.tableOps.tableExists(t);
  }
  /**
   * Creates a namespace if it does not exist.
   *
   * If the namespace already exists, returns void. If created, returns the response.
   *
   * @param id - Namespace identifier to create
   * @param metadata - Optional metadata properties for the namespace
   * @returns Response containing the created namespace and its properties, or void if it already exists
   *
   * @example
   * ```typescript
   * const response = await catalog.createNamespaceIfNotExists(
   *   { namespace: ['analytics'] },
   *   { properties: { owner: 'data-team' } }
   * );
   * if (response) {
   *   console.log('Created:', response.namespace);
   * } else {
   *   console.log('Already exists');
   * }
   * ```
   */
  async createNamespaceIfNotExists(t, e) {
    return this.namespaceOps.createNamespaceIfNotExists(t, e);
  }
  /**
   * Creates a table if it does not exist.
   *
   * If the table already exists, returns its metadata instead.
   *
   * @param namespace - Namespace to create the table in
   * @param request - Table creation request including name, schema, partition spec, etc.
   * @returns Table metadata for the created or existing table
   *
   * @example
   * ```typescript
   * const metadata = await catalog.createTableIfNotExists(
   *   { namespace: ['analytics'] },
   *   {
   *     name: 'events',
   *     schema: {
   *       type: 'struct',
   *       fields: [
   *         { id: 1, name: 'id', type: 'long', required: true },
   *         { id: 2, name: 'timestamp', type: 'timestamp', required: true }
   *       ],
   *       'schema-id': 0
   *     }
   *   }
   * );
   * ```
   */
  async createTableIfNotExists(t, e) {
    return this.tableOps.createTableIfNotExists(t, e);
  }
};
function zt(t) {
  "@babel/helpers - typeof";
  return zt = typeof Symbol == "function" && typeof Symbol.iterator == "symbol" ? function(e) {
    return typeof e;
  } : function(e) {
    return e && typeof Symbol == "function" && e.constructor === Symbol && e !== Symbol.prototype ? "symbol" : typeof e;
  }, zt(t);
}
function qd(t, e) {
  if (zt(t) != "object" || !t) return t;
  var r = t[Symbol.toPrimitive];
  if (r !== void 0) {
    var n = r.call(t, e);
    if (zt(n) != "object") return n;
    throw new TypeError("@@toPrimitive must return a primitive value.");
  }
  return (e === "string" ? String : Number)(t);
}
function Wd(t) {
  var e = qd(t, "string");
  return zt(e) == "symbol" ? e : e + "";
}
function Kd(t, e, r) {
  return (e = Wd(e)) in t ? Object.defineProperty(t, e, {
    value: r,
    enumerable: !0,
    configurable: !0,
    writable: !0
  }) : t[e] = r, t;
}
function xs(t, e) {
  var r = Object.keys(t);
  if (Object.getOwnPropertySymbols) {
    var n = Object.getOwnPropertySymbols(t);
    e && (n = n.filter(function(s) {
      return Object.getOwnPropertyDescriptor(t, s).enumerable;
    })), r.push.apply(r, n);
  }
  return r;
}
function B(t) {
  for (var e = 1; e < arguments.length; e++) {
    var r = arguments[e] != null ? arguments[e] : {};
    e % 2 ? xs(Object(r), !0).forEach(function(n) {
      Kd(t, n, r[n]);
    }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(t, Object.getOwnPropertyDescriptors(r)) : xs(Object(r)).forEach(function(n) {
      Object.defineProperty(t, n, Object.getOwnPropertyDescriptor(r, n));
    });
  }
  return t;
}
var Nr = class extends Error {
  constructor(t, e = "storage", r, n) {
    super(t), this.__isStorageError = !0, this.namespace = e, this.name = e === "vectors" ? "StorageVectorsError" : "StorageError", this.status = r, this.statusCode = n;
  }
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      status: this.status,
      statusCode: this.statusCode
    };
  }
};
function Ir(t) {
  return typeof t == "object" && t !== null && "__isStorageError" in t;
}
var fn = class extends Nr {
  constructor(t, e, r, n = "storage") {
    super(t, n, e, r), this.name = n === "vectors" ? "StorageVectorsApiError" : "StorageApiError", this.status = e, this.statusCode = r;
  }
  toJSON() {
    return B({}, super.toJSON());
  }
}, so = class extends Nr {
  constructor(t, e, r = "storage") {
    super(t, r), this.name = r === "vectors" ? "StorageVectorsUnknownError" : "StorageUnknownError", this.originalError = e;
  }
};
function $n(t, e, r) {
  const n = B({}, t), s = e.toLowerCase();
  for (const i of Object.keys(n)) i.toLowerCase() === s && delete n[i];
  return n[s] = r, n;
}
function Vd(t) {
  const e = {};
  for (const [r, n] of Object.entries(t)) e[r.toLowerCase()] = n;
  return e;
}
const Gd = (t) => t ? (...e) => t(...e) : (...e) => fetch(...e), Jd = (t) => {
  if (typeof t != "object" || t === null) return !1;
  const e = Object.getPrototypeOf(t);
  return (e === null || e === Object.prototype || Object.getPrototypeOf(e) === null) && !(Symbol.toStringTag in t) && !(Symbol.iterator in t);
}, pn = (t) => {
  if (Array.isArray(t)) return t.map((r) => pn(r));
  if (typeof t == "function" || t !== Object(t)) return t;
  const e = {};
  return Object.entries(t).forEach(([r, n]) => {
    const s = r.replace(/([-_][a-z])/gi, (i) => i.toUpperCase().replace(/[-_]/g, ""));
    e[s] = pn(n);
  }), e;
}, Xd = (t) => !t || typeof t != "string" || t.length === 0 || t.length > 100 || t.trim() !== t || t.includes("/") || t.includes("\\") ? !1 : /^[\w!.\*'() &$@=;:+,?-]+$/.test(t), Fs = (t) => {
  var e;
  return t.msg || t.message || t.error_description || (typeof t.error == "string" ? t.error : (e = t.error) === null || e === void 0 ? void 0 : e.message) || JSON.stringify(t);
}, Yd = async (t, e, r, n) => {
  if (t !== null && typeof t == "object" && typeof t.json == "function") {
    const s = t;
    let i = parseInt(s.status, 10);
    Number.isFinite(i) || (i = 500), s.json().then((o) => {
      const a = (o == null ? void 0 : o.statusCode) || (o == null ? void 0 : o.code) || i + "";
      e(new fn(Fs(o), i, a, n));
    }).catch(() => {
      const o = i + "";
      e(new fn(s.statusText || `HTTP ${i} error`, i, o, n));
    });
  } else e(new so(Fs(t), t, n));
}, Qd = (t, e, r, n) => {
  const s = {
    method: t,
    headers: (e == null ? void 0 : e.headers) || {}
  };
  if (t === "GET" || t === "HEAD" || !n) return B(B({}, s), r);
  if (Jd(n)) {
    var i;
    const o = (e == null ? void 0 : e.headers) || {};
    let a;
    for (const [c, u] of Object.entries(o)) c.toLowerCase() === "content-type" && (a = u);
    s.headers = $n(o, "Content-Type", (i = a) !== null && i !== void 0 ? i : "application/json"), s.body = JSON.stringify(n);
  } else s.body = n;
  return e != null && e.duplex && (s.duplex = e.duplex), B(B({}, s), r);
};
async function Nt(t, e, r, n, s, i, o) {
  return new Promise((a, c) => {
    t(r, Qd(e, n, s, i)).then((u) => {
      if (!u.ok) throw u;
      if (n != null && n.noResolveJson) return u;
      if (o === "vectors") {
        const l = u.headers.get("content-type");
        if (u.headers.get("content-length") === "0" || u.status === 204) return {};
        if (!l || !l.includes("application/json")) return {};
      }
      return u.json();
    }).then((u) => a(u)).catch((u) => Yd(u, c, n, o));
  });
}
function io(t = "storage") {
  return {
    get: async (e, r, n, s) => Nt(e, "GET", r, n, s, void 0, t),
    post: async (e, r, n, s, i) => Nt(e, "POST", r, s, i, n, t),
    put: async (e, r, n, s, i) => Nt(e, "PUT", r, s, i, n, t),
    head: async (e, r, n, s) => Nt(e, "HEAD", r, B(B({}, n), {}, { noResolveJson: !0 }), s, void 0, t),
    remove: async (e, r, n, s, i) => Nt(e, "DELETE", r, s, i, n, t)
  };
}
const ef = io("storage"), { get: Bt, post: Ce, put: mn, head: tf, remove: jn } = ef, ke = io("vectors");
var Ot = class {
  /**
  * Creates a new BaseApiClient instance
  * @param url - Base URL for API requests
  * @param headers - Default headers for API requests
  * @param fetch - Optional custom fetch implementation
  * @param namespace - Error namespace ('storage' or 'vectors')
  */
  constructor(t, e = {}, r, n = "storage") {
    this.shouldThrowOnError = !1, this.url = t, this.headers = Vd(e), this.fetch = Gd(r), this.namespace = n;
  }
  /**
  * Enable throwing errors instead of returning them.
  * When enabled, errors are thrown instead of returned in { data, error } format.
  *
  * @returns this - For method chaining
  */
  throwOnError() {
    return this.shouldThrowOnError = !0, this;
  }
  /**
  * Set an HTTP header for the request.
  * Creates a shallow copy of headers to avoid mutating shared state.
  *
  * @param name - Header name
  * @param value - Header value
  * @returns this - For method chaining
  */
  setHeader(t, e) {
    return this.headers = $n(this.headers, t, e), this;
  }
  /**
  * Handles API operation with standardized error handling
  * Eliminates repetitive try-catch blocks across all API methods
  *
  * This wrapper:
  * 1. Executes the operation
  * 2. Returns { data, error: null } on success
  * 3. Returns { data: null, error } on failure (if shouldThrowOnError is false)
  * 4. Throws error on failure (if shouldThrowOnError is true)
  *
  * @typeParam T - The expected data type from the operation
  * @param operation - Async function that performs the API call
  * @returns Promise with { data, error } tuple
  *
  * @example Handling an operation
  * ```typescript
  * async listBuckets() {
  *   return this.handleOperation(async () => {
  *     return await get(this.fetch, `${this.url}/bucket`, {
  *       headers: this.headers,
  *     })
  *   })
  * }
  * ```
  */
  async handleOperation(t) {
    var e = this;
    try {
      return {
        data: await t(),
        error: null
      };
    } catch (r) {
      if (e.shouldThrowOnError) throw r;
      if (Ir(r)) return {
        data: null,
        error: r
      };
      throw r;
    }
  }
}, rf = class {
  constructor(t, e) {
    this.downloadFn = t, this.shouldThrowOnError = e;
  }
  then(t, e) {
    return this.execute().then(t, e);
  }
  async execute() {
    var t = this;
    try {
      return {
        data: (await t.downloadFn()).body,
        error: null
      };
    } catch (e) {
      if (t.shouldThrowOnError) throw e;
      if (Ir(e)) return {
        data: null,
        error: e
      };
      throw e;
    }
  }
};
let oo;
oo = Symbol.toStringTag;
var nf = class {
  constructor(t, e) {
    this.downloadFn = t, this.shouldThrowOnError = e, this[oo] = "BlobDownloadBuilder", this.promise = null;
  }
  asStream() {
    return new rf(this.downloadFn, this.shouldThrowOnError);
  }
  then(t, e) {
    return this.getPromise().then(t, e);
  }
  catch(t) {
    return this.getPromise().catch(t);
  }
  finally(t) {
    return this.getPromise().finally(t);
  }
  getPromise() {
    return this.promise || (this.promise = this.execute()), this.promise;
  }
  async execute() {
    var t = this;
    try {
      return {
        data: await (await t.downloadFn()).blob(),
        error: null
      };
    } catch (e) {
      if (t.shouldThrowOnError) throw e;
      if (Ir(e)) return {
        data: null,
        error: e
      };
      throw e;
    }
  }
};
const sf = {
  limit: 100,
  offset: 0,
  sortBy: {
    column: "name",
    order: "asc"
  }
}, zs = {
  cacheControl: "3600",
  contentType: "text/plain;charset=UTF-8",
  upsert: !1
};
var of = class extends Ot {
  constructor(t, e = {}, r, n) {
    super(t, e, n, "storage"), this.bucketId = r;
  }
  /**
  * Uploads a file to an existing bucket or replaces an existing file at the specified path with a new one.
  *
  * @param method HTTP method.
  * @param path The relative file path. Should be of the format `folder/subfolder/filename.png`. The bucket must already exist before attempting to upload.
  * @param fileBody The body of the file to be stored in the bucket.
  */
  async uploadOrUpdate(t, e, r, n) {
    var s = this;
    return s.handleOperation(async () => {
      let i;
      const o = B(B({}, zs), n);
      let a = B(B({}, s.headers), t === "POST" && { "x-upsert": String(o.upsert) });
      const c = o.metadata;
      if (typeof Blob < "u" && r instanceof Blob ? (i = new FormData(), i.append("cacheControl", o.cacheControl), c && i.append("metadata", s.encodeMetadata(c)), i.append("", r)) : typeof FormData < "u" && r instanceof FormData ? (i = r, i.has("cacheControl") || i.append("cacheControl", o.cacheControl), c && !i.has("metadata") && i.append("metadata", s.encodeMetadata(c))) : (i = r, a["cache-control"] = `max-age=${o.cacheControl}`, a["content-type"] = o.contentType, c && (a["x-metadata"] = s.toBase64(s.encodeMetadata(c))), (typeof ReadableStream < "u" && i instanceof ReadableStream || i && typeof i == "object" && "pipe" in i && typeof i.pipe == "function") && !o.duplex && (o.duplex = "half")), n != null && n.headers) for (const [f, d] of Object.entries(n.headers)) a = $n(a, f, d);
      const u = s._removeEmptyFolders(e), l = s._getFinalPath(u), h = await (t == "PUT" ? mn : Ce)(s.fetch, `${s.url}/object/${l}`, i, B({ headers: a }, o != null && o.duplex ? { duplex: o.duplex } : {}));
      return {
        path: u,
        id: h.Id,
        fullPath: h.Key
      };
    });
  }
  /**
  * Uploads a file to an existing bucket.
  *
  * @category File Buckets
  * @param path The file path, including the file name. Should be of the format `folder/subfolder/filename.png`. The bucket must already exist before attempting to upload.
  * @param fileBody The body of the file to be stored in the bucket.
  * @param fileOptions Optional file upload options including cacheControl, contentType, upsert, and metadata.
  * @returns Promise with response containing file path, id, and fullPath or error
  *
  * @example Upload file
  * ```js
  * const avatarFile = event.target.files[0]
  * const { data, error } = await supabase
  *   .storage
  *   .from('avatars')
  *   .upload('public/avatar1.png', avatarFile, {
  *     cacheControl: '3600',
  *     upsert: false
  *   })
  * ```
  *
  * Response:
  * ```json
  * {
  *   "data": {
  *     "path": "public/avatar1.png",
  *     "fullPath": "avatars/public/avatar1.png"
  *   },
  *   "error": null
  * }
  * ```
  *
  * @example Upload file using `ArrayBuffer` from base64 file data
  * ```js
  * import { decode } from 'base64-arraybuffer'
  *
  * const { data, error } = await supabase
  *   .storage
  *   .from('avatars')
  *   .upload('public/avatar1.png', decode('base64FileData'), {
  *     contentType: 'image/png'
  *   })
  * ```
  *
  * @remarks
  * - RLS policy permissions required:
  *   - `buckets` table permissions: none
  *   - `objects` table permissions: only `insert` when you are uploading new files and `select`, `insert` and `update` when you are upserting files
  * - Refer to the [Storage guide](/docs/guides/storage/security/access-control) on how access control works
  * - For React Native, using either `Blob`, `File` or `FormData` does not work as intended. Upload file using `ArrayBuffer` from base64 file data instead, see example below.
  */
  async upload(t, e, r) {
    return this.uploadOrUpdate("POST", t, e, r);
  }
  /**
  * Upload a file with a token generated from `createSignedUploadUrl`.
  *
  * @category File Buckets
  * @param path The file path, including the file name. Should be of the format `folder/subfolder/filename.png`. The bucket must already exist before attempting to upload.
  * @param token The token generated from `createSignedUploadUrl`
  * @param fileBody The body of the file to be stored in the bucket.
  * @param fileOptions HTTP headers (cacheControl, contentType, etc.).
  * **Note:** The `upsert` option has no effect here. To enable upsert behavior,
  * pass `{ upsert: true }` when calling `createSignedUploadUrl()` instead.
  * @returns Promise with response containing file path and fullPath or error
  *
  * @example Upload to a signed URL
  * ```js
  * const { data, error } = await supabase
  *   .storage
  *   .from('avatars')
  *   .uploadToSignedUrl('folder/cat.jpg', 'token-from-createSignedUploadUrl', file)
  * ```
  *
  * Response:
  * ```json
  * {
  *   "data": {
  *     "path": "folder/cat.jpg",
  *     "fullPath": "avatars/folder/cat.jpg"
  *   },
  *   "error": null
  * }
  * ```
  *
  * @remarks
  * - RLS policy permissions required:
  *   - `buckets` table permissions: none
  *   - `objects` table permissions: none
  * - Refer to the [Storage guide](/docs/guides/storage/security/access-control) on how access control works
  */
  async uploadToSignedUrl(t, e, r, n) {
    var s = this;
    const i = s._removeEmptyFolders(t), o = s._getFinalPath(i), a = new URL(s.url + `/object/upload/sign/${o}`);
    return a.searchParams.set("token", e), s.handleOperation(async () => {
      let c;
      const u = B(B({}, zs), n), l = B(B({}, s.headers), { "x-upsert": String(u.upsert) });
      return typeof Blob < "u" && r instanceof Blob ? (c = new FormData(), c.append("cacheControl", u.cacheControl), c.append("", r)) : typeof FormData < "u" && r instanceof FormData ? (c = r, c.append("cacheControl", u.cacheControl)) : (c = r, l["cache-control"] = `max-age=${u.cacheControl}`, l["content-type"] = u.contentType), {
        path: i,
        fullPath: (await mn(s.fetch, a.toString(), c, { headers: l })).Key
      };
    });
  }
  /**
  * Creates a signed upload URL.
  * Signed upload URLs can be used to upload files to the bucket without further authentication.
  * They are valid for 2 hours.
  *
  * @category File Buckets
  * @param path The file path, including the current file name. For example `folder/image.png`.
  * @param options.upsert If set to true, allows the file to be overwritten if it already exists.
  * @returns Promise with response containing signed upload URL, token, and path or error
  *
  * @example Create Signed Upload URL
  * ```js
  * const { data, error } = await supabase
  *   .storage
  *   .from('avatars')
  *   .createSignedUploadUrl('folder/cat.jpg')
  * ```
  *
  * Response:
  * ```json
  * {
  *   "data": {
  *     "signedUrl": "https://example.supabase.co/storage/v1/object/upload/sign/avatars/folder/cat.jpg?token=<TOKEN>",
  *     "path": "folder/cat.jpg",
  *     "token": "<TOKEN>"
  *   },
  *   "error": null
  * }
  * ```
  *
  * @remarks
  * - RLS policy permissions required:
  *   - `buckets` table permissions: none
  *   - `objects` table permissions: `insert`
  * - Refer to the [Storage guide](/docs/guides/storage/security/access-control) on how access control works
  */
  async createSignedUploadUrl(t, e) {
    var r = this;
    return r.handleOperation(async () => {
      let n = r._getFinalPath(t);
      const s = B({}, r.headers);
      e != null && e.upsert && (s["x-upsert"] = "true");
      const i = await Ce(r.fetch, `${r.url}/object/upload/sign/${n}`, {}, { headers: s }), o = new URL(r.url + i.url), a = o.searchParams.get("token");
      if (!a) throw new Nr("No token returned by API");
      return {
        signedUrl: o.toString(),
        path: t,
        token: a
      };
    });
  }
  /**
  * Replaces an existing file at the specified path with a new one.
  *
  * @category File Buckets
  * @param path The relative file path. Should be of the format `folder/subfolder/filename.png`. The bucket must already exist before attempting to update.
  * @param fileBody The body of the file to be stored in the bucket.
  * @param fileOptions Optional file upload options including cacheControl, contentType, upsert, and metadata.
  * @returns Promise with response containing file path, id, and fullPath or error
  *
  * @example Update file
  * ```js
  * const avatarFile = event.target.files[0]
  * const { data, error } = await supabase
  *   .storage
  *   .from('avatars')
  *   .update('public/avatar1.png', avatarFile, {
  *     cacheControl: '3600',
  *     upsert: true
  *   })
  * ```
  *
  * Response:
  * ```json
  * {
  *   "data": {
  *     "path": "public/avatar1.png",
  *     "fullPath": "avatars/public/avatar1.png"
  *   },
  *   "error": null
  * }
  * ```
  *
  * @example Update file using `ArrayBuffer` from base64 file data
  * ```js
  * import {decode} from 'base64-arraybuffer'
  *
  * const { data, error } = await supabase
  *   .storage
  *   .from('avatars')
  *   .update('public/avatar1.png', decode('base64FileData'), {
  *     contentType: 'image/png'
  *   })
  * ```
  *
  * @remarks
  * - RLS policy permissions required:
  *   - `buckets` table permissions: none
  *   - `objects` table permissions: `update` and `select`
  * - Refer to the [Storage guide](/docs/guides/storage/security/access-control) on how access control works
  * - For React Native, using either `Blob`, `File` or `FormData` does not work as intended. Update file using `ArrayBuffer` from base64 file data instead, see example below.
  */
  async update(t, e, r) {
    return this.uploadOrUpdate("PUT", t, e, r);
  }
  /**
  * Moves an existing file to a new path in the same bucket.
  *
  * @category File Buckets
  * @param fromPath The original file path, including the current file name. For example `folder/image.png`.
  * @param toPath The new file path, including the new file name. For example `folder/image-new.png`.
  * @param options The destination options.
  * @returns Promise with response containing success message or error
  *
  * @example Move file
  * ```js
  * const { data, error } = await supabase
  *   .storage
  *   .from('avatars')
  *   .move('public/avatar1.png', 'private/avatar2.png')
  * ```
  *
  * Response:
  * ```json
  * {
  *   "data": {
  *     "message": "Successfully moved"
  *   },
  *   "error": null
  * }
  * ```
  *
  * @remarks
  * - RLS policy permissions required:
  *   - `buckets` table permissions: none
  *   - `objects` table permissions: `update` and `select`
  * - Refer to the [Storage guide](/docs/guides/storage/security/access-control) on how access control works
  */
  async move(t, e, r) {
    var n = this;
    return n.handleOperation(async () => await Ce(n.fetch, `${n.url}/object/move`, {
      bucketId: n.bucketId,
      sourceKey: t,
      destinationKey: e,
      destinationBucket: r == null ? void 0 : r.destinationBucket
    }, { headers: n.headers }));
  }
  /**
  * Copies an existing file to a new path in the same bucket.
  *
  * @category File Buckets
  * @param fromPath The original file path, including the current file name. For example `folder/image.png`.
  * @param toPath The new file path, including the new file name. For example `folder/image-copy.png`.
  * @param options The destination options.
  * @returns Promise with response containing copied file path or error
  *
  * @example Copy file
  * ```js
  * const { data, error } = await supabase
  *   .storage
  *   .from('avatars')
  *   .copy('public/avatar1.png', 'private/avatar2.png')
  * ```
  *
  * Response:
  * ```json
  * {
  *   "data": {
  *     "path": "avatars/private/avatar2.png"
  *   },
  *   "error": null
  * }
  * ```
  *
  * @remarks
  * - RLS policy permissions required:
  *   - `buckets` table permissions: none
  *   - `objects` table permissions: `insert` and `select`
  * - Refer to the [Storage guide](/docs/guides/storage/security/access-control) on how access control works
  */
  async copy(t, e, r) {
    var n = this;
    return n.handleOperation(async () => ({ path: (await Ce(n.fetch, `${n.url}/object/copy`, {
      bucketId: n.bucketId,
      sourceKey: t,
      destinationKey: e,
      destinationBucket: r == null ? void 0 : r.destinationBucket
    }, { headers: n.headers })).Key }));
  }
  /**
  * Creates a signed URL. Use a signed URL to share a file for a fixed amount of time.
  *
  * @category File Buckets
  * @param path The file path, including the current file name. For example `folder/image.png`.
  * @param expiresIn The number of seconds until the signed URL expires. For example, `60` for a URL which is valid for one minute.
  * @param options.download triggers the file as a download if set to true. Set this parameter as the name of the file if you want to trigger the download with a different filename.
  * @param options.transform Transform the asset before serving it to the client.
  * @param options.cacheNonce Append a cache nonce parameter to the URL to invalidate the cache.
  * @returns Promise with response containing signed URL or error
  *
  * @example Create Signed URL
  * ```js
  * const { data, error } = await supabase
  *   .storage
  *   .from('avatars')
  *   .createSignedUrl('folder/avatar1.png', 60)
  * ```
  *
  * Response:
  * ```json
  * {
  *   "data": {
  *     "signedUrl": "https://example.supabase.co/storage/v1/object/sign/avatars/folder/avatar1.png?token=<TOKEN>"
  *   },
  *   "error": null
  * }
  * ```
  *
  * @example Create a signed URL for an asset with transformations
  * ```js
  * const { data } = await supabase
  *   .storage
  *   .from('avatars')
  *   .createSignedUrl('folder/avatar1.png', 60, {
  *     transform: {
  *       width: 100,
  *       height: 100,
  *     }
  *   })
  * ```
  *
  * @example Create a signed URL which triggers the download of the asset
  * ```js
  * const { data } = await supabase
  *   .storage
  *   .from('avatars')
  *   .createSignedUrl('folder/avatar1.png', 60, {
  *     download: true,
  *   })
  * ```
  *
  * @remarks
  * - RLS policy permissions required:
  *   - `buckets` table permissions: none
  *   - `objects` table permissions: `select`
  * - Refer to the [Storage guide](/docs/guides/storage/security/access-control) on how access control works
  */
  async createSignedUrl(t, e, r) {
    var n = this;
    return n.handleOperation(async () => {
      let s = n._getFinalPath(t);
      const i = typeof (r == null ? void 0 : r.transform) == "object" && r.transform !== null && Object.keys(r.transform).length > 0;
      let o = await Ce(n.fetch, `${n.url}/object/sign/${s}`, B({ expiresIn: e }, i ? { transform: r.transform } : {}), { headers: n.headers });
      const a = new URLSearchParams();
      r != null && r.download && a.set("download", r.download === !0 ? "" : r.download), (r == null ? void 0 : r.cacheNonce) != null && a.set("cacheNonce", String(r.cacheNonce));
      const c = a.toString();
      return { signedUrl: encodeURI(`${n.url}${o.signedURL}${c ? `&${c}` : ""}`) };
    });
  }
  /**
  * Creates multiple signed URLs. Use a signed URL to share a file for a fixed amount of time.
  *
  * @category File Buckets
  * @param paths The file paths to be downloaded, including the current file names. For example `['folder/image.png', 'folder2/image2.png']`.
  * @param expiresIn The number of seconds until the signed URLs expire. For example, `60` for URLs which are valid for one minute.
  * @param options.download triggers the file as a download if set to true. Set this parameter as the name of the file if you want to trigger the download with a different filename.
  * @param options.cacheNonce Append a cache nonce parameter to the URL to invalidate the cache.
  * @returns Promise with response containing array of objects with signedUrl, path, and error or error
  *
  * @example Create Signed URLs
  * ```js
  * const { data, error } = await supabase
  *   .storage
  *   .from('avatars')
  *   .createSignedUrls(['folder/avatar1.png', 'folder/avatar2.png'], 60)
  * ```
  *
  * Response:
  * ```json
  * {
  *   "data": [
  *     {
  *       "error": null,
  *       "path": "folder/avatar1.png",
  *       "signedURL": "/object/sign/avatars/folder/avatar1.png?token=<TOKEN>",
  *       "signedUrl": "https://example.supabase.co/storage/v1/object/sign/avatars/folder/avatar1.png?token=<TOKEN>"
  *     },
  *     {
  *       "error": null,
  *       "path": "folder/avatar2.png",
  *       "signedURL": "/object/sign/avatars/folder/avatar2.png?token=<TOKEN>",
  *       "signedUrl": "https://example.supabase.co/storage/v1/object/sign/avatars/folder/avatar2.png?token=<TOKEN>"
  *     }
  *   ],
  *   "error": null
  * }
  * ```
  *
  * @remarks
  * - RLS policy permissions required:
  *   - `buckets` table permissions: none
  *   - `objects` table permissions: `select`
  * - Refer to the [Storage guide](/docs/guides/storage/security/access-control) on how access control works
  */
  async createSignedUrls(t, e, r) {
    var n = this;
    return n.handleOperation(async () => {
      const s = await Ce(n.fetch, `${n.url}/object/sign/${n.bucketId}`, {
        expiresIn: e,
        paths: t
      }, { headers: n.headers }), i = new URLSearchParams();
      r != null && r.download && i.set("download", r.download === !0 ? "" : r.download), (r == null ? void 0 : r.cacheNonce) != null && i.set("cacheNonce", String(r.cacheNonce));
      const o = i.toString();
      return s.map((a) => B(B({}, a), {}, { signedUrl: a.signedURL ? encodeURI(`${n.url}${a.signedURL}${o ? `&${o}` : ""}`) : null }));
    });
  }
  /**
  * Downloads a file from a private bucket. For public buckets, make a request to the URL returned from `getPublicUrl` instead.
  *
  * @category File Buckets
  * @param path The full path and file name of the file to be downloaded. For example `folder/image.png`.
  * @param options.transform Transform the asset before serving it to the client.
  * @param options.cacheNonce Append a cache nonce parameter to the URL to invalidate the cache.
  * @param parameters Additional fetch parameters like signal for cancellation. Supports standard fetch options including cache control.
  * @returns BlobDownloadBuilder instance for downloading the file
  *
  * @example Download file
  * ```js
  * const { data, error } = await supabase
  *   .storage
  *   .from('avatars')
  *   .download('folder/avatar1.png')
  * ```
  *
  * Response:
  * ```json
  * {
  *   "data": <BLOB>,
  *   "error": null
  * }
  * ```
  *
  * @example Download file with transformations
  * ```js
  * const { data, error } = await supabase
  *   .storage
  *   .from('avatars')
  *   .download('folder/avatar1.png', {
  *     transform: {
  *       width: 100,
  *       height: 100,
  *       quality: 80
  *     }
  *   })
  * ```
  *
  * @example Download with cache control (useful in Edge Functions)
  * ```js
  * const { data, error } = await supabase
  *   .storage
  *   .from('avatars')
  *   .download('folder/avatar1.png', {}, { cache: 'no-store' })
  * ```
  *
  * @example Download with abort signal
  * ```js
  * const controller = new AbortController()
  * setTimeout(() => controller.abort(), 5000)
  *
  * const { data, error } = await supabase
  *   .storage
  *   .from('avatars')
  *   .download('folder/avatar1.png', {}, { signal: controller.signal })
  * ```
  *
  * @remarks
  * - RLS policy permissions required:
  *   - `buckets` table permissions: none
  *   - `objects` table permissions: `select`
  * - Refer to the [Storage guide](/docs/guides/storage/security/access-control) on how access control works
  */
  download(t, e, r) {
    const n = typeof (e == null ? void 0 : e.transform) == "object" && e.transform !== null && Object.keys(e.transform).length > 0 ? "render/image/authenticated" : "object", s = new URLSearchParams();
    e != null && e.transform && this.applyTransformOptsToQuery(s, e.transform), (e == null ? void 0 : e.cacheNonce) != null && s.set("cacheNonce", String(e.cacheNonce));
    const i = s.toString(), o = this._getFinalPath(t), a = () => Bt(this.fetch, `${this.url}/${n}/${o}${i ? `?${i}` : ""}`, {
      headers: this.headers,
      noResolveJson: !0
    }, r);
    return new nf(a, this.shouldThrowOnError);
  }
  /**
  * Retrieves the details of an existing file.
  *
  * Returns detailed file metadata including size, content type, and timestamps.
  * Note: The API returns `last_modified` field, not `updated_at`.
  *
  * @category File Buckets
  * @param path The file path, including the file name. For example `folder/image.png`.
  * @returns Promise with response containing file metadata or error
  *
  * @example Get file info
  * ```js
  * const { data, error } = await supabase
  *   .storage
  *   .from('avatars')
  *   .info('folder/avatar1.png')
  *
  * if (data) {
  *   console.log('Last modified:', data.lastModified)
  *   console.log('Size:', data.size)
  * }
  * ```
  */
  async info(t) {
    var e = this;
    const r = e._getFinalPath(t);
    return e.handleOperation(async () => pn(await Bt(e.fetch, `${e.url}/object/info/${r}`, { headers: e.headers })));
  }
  /**
  * Checks the existence of a file.
  *
  * @category File Buckets
  * @param path The file path, including the file name. For example `folder/image.png`.
  * @returns Promise with response containing boolean indicating file existence or error
  *
  * @example Check file existence
  * ```js
  * const { data, error } = await supabase
  *   .storage
  *   .from('avatars')
  *   .exists('folder/avatar1.png')
  * ```
  */
  async exists(t) {
    var e = this;
    const r = e._getFinalPath(t);
    try {
      return await tf(e.fetch, `${e.url}/object/${r}`, { headers: e.headers }), {
        data: !0,
        error: null
      };
    } catch (s) {
      if (e.shouldThrowOnError) throw s;
      if (Ir(s)) {
        var n;
        const i = s instanceof fn ? s.status : s instanceof so ? (n = s.originalError) === null || n === void 0 ? void 0 : n.status : void 0;
        if (i !== void 0 && [400, 404].includes(i)) return {
          data: !1,
          error: s
        };
      }
      throw s;
    }
  }
  /**
  * A simple convenience function to get the URL for an asset in a public bucket. If you do not want to use this function, you can construct the public URL by concatenating the bucket URL with the path to the asset.
  * This function does not verify if the bucket is public. If a public URL is created for a bucket which is not public, you will not be able to download the asset.
  *
  * @category File Buckets
  * @param path The path and name of the file to generate the public URL for. For example `folder/image.png`.
  * @param options.download Triggers the file as a download if set to true. Set this parameter as the name of the file if you want to trigger the download with a different filename.
  * @param options.transform Transform the asset before serving it to the client.
  * @param options.cacheNonce Append a cache nonce parameter to the URL to invalidate the cache.
  * @returns Object with public URL
  *
  * @example Returns the URL for an asset in a public bucket
  * ```js
  * const { data } = supabase
  *   .storage
  *   .from('public-bucket')
  *   .getPublicUrl('folder/avatar1.png')
  * ```
  *
  * Response:
  * ```json
  * {
  *   "data": {
  *     "publicUrl": "https://example.supabase.co/storage/v1/object/public/public-bucket/folder/avatar1.png"
  *   }
  * }
  * ```
  *
  * @example Returns the URL for an asset in a public bucket with transformations
  * ```js
  * const { data } = supabase
  *   .storage
  *   .from('public-bucket')
  *   .getPublicUrl('folder/avatar1.png', {
  *     transform: {
  *       width: 100,
  *       height: 100,
  *     }
  *   })
  * ```
  *
  * @example Returns the URL which triggers the download of an asset in a public bucket
  * ```js
  * const { data } = supabase
  *   .storage
  *   .from('public-bucket')
  *   .getPublicUrl('folder/avatar1.png', {
  *     download: true,
  *   })
  * ```
  *
  * @remarks
  * - The bucket needs to be set to public, either via [updateBucket()](/docs/reference/javascript/storage-updatebucket) or by going to Storage on [supabase.com/dashboard](https://supabase.com/dashboard), clicking the overflow menu on a bucket and choosing "Make public"
  * - RLS policy permissions required:
  *   - `buckets` table permissions: none
  *   - `objects` table permissions: none
  * - Refer to the [Storage guide](/docs/guides/storage/security/access-control) on how access control works
  */
  getPublicUrl(t, e) {
    const r = this._getFinalPath(t), n = new URLSearchParams();
    e != null && e.download && n.set("download", e.download === !0 ? "" : e.download), e != null && e.transform && this.applyTransformOptsToQuery(n, e.transform), (e == null ? void 0 : e.cacheNonce) != null && n.set("cacheNonce", String(e.cacheNonce));
    const s = n.toString(), i = typeof (e == null ? void 0 : e.transform) == "object" && e.transform !== null && Object.keys(e.transform).length > 0 ? "render/image" : "object";
    return { data: { publicUrl: encodeURI(`${this.url}/${i}/public/${r}`) + (s ? `?${s}` : "") } };
  }
  /**
  * Deletes files within the same bucket
  *
  * Returns an array of FileObject entries for the deleted files. Note that deprecated
  * fields like `bucket_id` may or may not be present in the response - do not rely on them.
  *
  * @category File Buckets
  * @param paths An array of files to delete, including the path and file name. For example [`'folder/image.png'`].
  * @returns Promise with response containing array of deleted file objects or error
  *
  * @example Delete file
  * ```js
  * const { data, error } = await supabase
  *   .storage
  *   .from('avatars')
  *   .remove(['folder/avatar1.png'])
  * ```
  *
  * Response:
  * ```json
  * {
  *   "data": [],
  *   "error": null
  * }
  * ```
  *
  * @remarks
  * - RLS policy permissions required:
  *   - `buckets` table permissions: none
  *   - `objects` table permissions: `delete` and `select`
  * - Refer to the [Storage guide](/docs/guides/storage/security/access-control) on how access control works
  */
  async remove(t) {
    var e = this;
    return e.handleOperation(async () => await jn(e.fetch, `${e.url}/object/${e.bucketId}`, { prefixes: t }, { headers: e.headers }));
  }
  /**
  * Get file metadata
  * @param id the file id to retrieve metadata
  */
  /**
  * Update file metadata
  * @param id the file id to update metadata
  * @param meta the new file metadata
  */
  /**
  * Lists all the files and folders within a path of the bucket.
  *
  * **Important:** For folder entries, fields like `id`, `updated_at`, `created_at`,
  * `last_accessed_at`, and `metadata` will be `null`. Only files have these fields populated.
  * Additionally, deprecated fields like `bucket_id`, `owner`, and `buckets` are NOT returned
  * by this method.
  *
  * @category File Buckets
  * @param path The folder path.
  * @param options Search options including limit (defaults to 100), offset, sortBy, and search
  * @param parameters Optional fetch parameters including signal for cancellation
  * @returns Promise with response containing array of files/folders or error
  *
  * @example List files in a bucket
  * ```js
  * const { data, error } = await supabase
  *   .storage
  *   .from('avatars')
  *   .list('folder', {
  *     limit: 100,
  *     offset: 0,
  *     sortBy: { column: 'name', order: 'asc' },
  *   })
  *
  * // Handle files vs folders
  * data?.forEach(item => {
  *   if (item.id !== null) {
  *     // It's a file
  *     console.log('File:', item.name, 'Size:', item.metadata?.size)
  *   } else {
  *     // It's a folder
  *     console.log('Folder:', item.name)
  *   }
  * })
  * ```
  *
  * Response:
  * ```json
  * {
  *   "data": [
  *     {
  *       "name": "avatar1.png",
  *       "id": "e668cf7f-821b-4a2f-9dce-7dfa5dd1cfd2",
  *       "updated_at": "2024-05-22T23:06:05.580Z",
  *       "created_at": "2024-05-22T23:04:34.443Z",
  *       "last_accessed_at": "2024-05-22T23:04:34.443Z",
  *       "metadata": {
  *         "eTag": "\"c5e8c553235d9af30ef4f6e280790b92\"",
  *         "size": 32175,
  *         "mimetype": "image/png",
  *         "cacheControl": "max-age=3600",
  *         "lastModified": "2024-05-22T23:06:05.574Z",
  *         "contentLength": 32175,
  *         "httpStatusCode": 200
  *       }
  *     }
  *   ],
  *   "error": null
  * }
  * ```
  *
  * @example Search files in a bucket
  * ```js
  * const { data, error } = await supabase
  *   .storage
  *   .from('avatars')
  *   .list('folder', {
  *     limit: 100,
  *     offset: 0,
  *     sortBy: { column: 'name', order: 'asc' },
  *     search: 'jon'
  *   })
  * ```
  *
  * @remarks
  * - RLS policy permissions required:
  *   - `buckets` table permissions: none
  *   - `objects` table permissions: `select`
  * - Refer to the [Storage guide](/docs/guides/storage/security/access-control) on how access control works
  */
  async list(t, e, r) {
    var n = this;
    return n.handleOperation(async () => {
      const s = B(B(B({}, sf), e), {}, { prefix: t || "" });
      return await Ce(n.fetch, `${n.url}/object/list/${n.bucketId}`, s, { headers: n.headers }, r);
    });
  }
  /**
  * Lists all the files and folders within a bucket using the V2 API with pagination support.
  *
  * **Important:** Folder entries in the `folders` array only contain `name` and optionally `key` —
  * they have no `id`, timestamps, or `metadata` fields. Full file metadata is only available
  * on entries in the `objects` array.
  *
  * @experimental this method signature might change in the future
  *
  * @category File Buckets
  * @param options Search options including prefix, cursor for pagination, limit, with_delimiter
  * @param parameters Optional fetch parameters including signal for cancellation
  * @returns Promise with response containing folders/objects arrays with pagination info or error
  *
  * @example List files with pagination
  * ```js
  * const { data, error } = await supabase
  *   .storage
  *   .from('avatars')
  *   .listV2({
  *     prefix: 'folder/',
  *     limit: 100,
  *   })
  *
  * // Handle pagination
  * if (data?.hasNext) {
  *   const nextPage = await supabase
  *     .storage
  *     .from('avatars')
  *     .listV2({
  *       prefix: 'folder/',
  *       cursor: data.nextCursor,
  *     })
  * }
  *
  * // Handle files vs folders
  * data?.objects.forEach(file => {
  *   if (file.id !== null) {
  *     console.log('File:', file.name, 'Size:', file.metadata?.size)
  *   }
  * })
  * data?.folders.forEach(folder => {
  *   console.log('Folder:', folder.name)
  * })
  * ```
  */
  async listV2(t, e) {
    var r = this;
    return r.handleOperation(async () => {
      const n = B({}, t);
      return await Ce(r.fetch, `${r.url}/object/list-v2/${r.bucketId}`, n, { headers: r.headers }, e);
    });
  }
  encodeMetadata(t) {
    return JSON.stringify(t);
  }
  toBase64(t) {
    return typeof Buffer < "u" ? Buffer.from(t).toString("base64") : btoa(t);
  }
  _getFinalPath(t) {
    return `${this.bucketId}/${t.replace(/^\/+/, "")}`;
  }
  _removeEmptyFolders(t) {
    return t.replace(/^\/|\/$/g, "").replace(/\/+/g, "/");
  }
  /** Modifies the `query`, appending values the from `transform` */
  applyTransformOptsToQuery(t, e) {
    return e.width && t.set("width", e.width.toString()), e.height && t.set("height", e.height.toString()), e.resize && t.set("resize", e.resize), e.format && t.set("format", e.format), e.quality && t.set("quality", e.quality.toString()), t;
  }
};
const af = "2.104.1", Vt = { "X-Client-Info": `storage-js/${af}` };
var cf = class extends Ot {
  constructor(t, e = {}, r, n) {
    const s = new URL(t);
    n != null && n.useNewHostname && /supabase\.(co|in|red)$/.test(s.hostname) && !s.hostname.includes("storage.supabase.") && (s.hostname = s.hostname.replace("supabase.", "storage.supabase."));
    const i = s.href.replace(/\/$/, ""), o = B(B({}, Vt), e);
    super(i, o, r, "storage");
  }
  /**
  * Retrieves the details of all Storage buckets within an existing project.
  *
  * @category File Buckets
  * @param options Query parameters for listing buckets
  * @param options.limit Maximum number of buckets to return
  * @param options.offset Number of buckets to skip
  * @param options.sortColumn Column to sort by ('id', 'name', 'created_at', 'updated_at')
  * @param options.sortOrder Sort order ('asc' or 'desc')
  * @param options.search Search term to filter bucket names
  * @returns Promise with response containing array of buckets or error
  *
  * @example List buckets
  * ```js
  * const { data, error } = await supabase
  *   .storage
  *   .listBuckets()
  * ```
  *
  * @example List buckets with options
  * ```js
  * const { data, error } = await supabase
  *   .storage
  *   .listBuckets({
  *     limit: 10,
  *     offset: 0,
  *     sortColumn: 'created_at',
  *     sortOrder: 'desc',
  *     search: 'prod'
  *   })
  * ```
  *
  * @remarks
  * - RLS policy permissions required:
  *   - `buckets` table permissions: `select`
  *   - `objects` table permissions: none
  * - Refer to the [Storage guide](/docs/guides/storage/security/access-control) on how access control works
  */
  async listBuckets(t) {
    var e = this;
    return e.handleOperation(async () => {
      const r = e.listBucketOptionsToQueryString(t);
      return await Bt(e.fetch, `${e.url}/bucket${r}`, { headers: e.headers });
    });
  }
  /**
  * Retrieves the details of an existing Storage bucket.
  *
  * @category File Buckets
  * @param id The unique identifier of the bucket you would like to retrieve.
  * @returns Promise with response containing bucket details or error
  *
  * @example Get bucket
  * ```js
  * const { data, error } = await supabase
  *   .storage
  *   .getBucket('avatars')
  * ```
  *
  * Response:
  * ```json
  * {
  *   "data": {
  *     "id": "avatars",
  *     "name": "avatars",
  *     "owner": "",
  *     "public": false,
  *     "file_size_limit": 1024,
  *     "allowed_mime_types": [
  *       "image/png"
  *     ],
  *     "created_at": "2024-05-22T22:26:05.100Z",
  *     "updated_at": "2024-05-22T22:26:05.100Z"
  *   },
  *   "error": null
  * }
  * ```
  *
  * @remarks
  * - RLS policy permissions required:
  *   - `buckets` table permissions: `select`
  *   - `objects` table permissions: none
  * - Refer to the [Storage guide](/docs/guides/storage/security/access-control) on how access control works
  */
  async getBucket(t) {
    var e = this;
    return e.handleOperation(async () => await Bt(e.fetch, `${e.url}/bucket/${t}`, { headers: e.headers }));
  }
  /**
  * Creates a new Storage bucket
  *
  * @category File Buckets
  * @param id A unique identifier for the bucket you are creating.
  * @param options.public The visibility of the bucket. Public buckets don't require an authorization token to download objects, but still require a valid token for all other operations. By default, buckets are private.
  * @param options.fileSizeLimit specifies the max file size in bytes that can be uploaded to this bucket.
  * The global file size limit takes precedence over this value.
  * The default value is null, which doesn't set a per bucket file size limit.
  * @param options.allowedMimeTypes specifies the allowed mime types that this bucket can accept during upload.
  * The default value is null, which allows files with all mime types to be uploaded.
  * Each mime type specified can be a wildcard, e.g. image/*, or a specific mime type, e.g. image/png.
  * @param options.type (private-beta) specifies the bucket type. see `BucketType` for more details.
  *   - default bucket type is `STANDARD`
  * @returns Promise with response containing newly created bucket name or error
  *
  * @example Create bucket
  * ```js
  * const { data, error } = await supabase
  *   .storage
  *   .createBucket('avatars', {
  *     public: false,
  *     allowedMimeTypes: ['image/png'],
  *     fileSizeLimit: 1024
  *   })
  * ```
  *
  * Response:
  * ```json
  * {
  *   "data": {
  *     "name": "avatars"
  *   },
  *   "error": null
  * }
  * ```
  *
  * @remarks
  * - RLS policy permissions required:
  *   - `buckets` table permissions: `insert`
  *   - `objects` table permissions: none
  * - Refer to the [Storage guide](/docs/guides/storage/security/access-control) on how access control works
  */
  async createBucket(t, e = { public: !1 }) {
    var r = this;
    return r.handleOperation(async () => await Ce(r.fetch, `${r.url}/bucket`, {
      id: t,
      name: t,
      type: e.type,
      public: e.public,
      file_size_limit: e.fileSizeLimit,
      allowed_mime_types: e.allowedMimeTypes
    }, { headers: r.headers }));
  }
  /**
  * Updates a Storage bucket
  *
  * @category File Buckets
  * @param id A unique identifier for the bucket you are updating.
  * @param options.public The visibility of the bucket. Public buckets don't require an authorization token to download objects, but still require a valid token for all other operations.
  * @param options.fileSizeLimit specifies the max file size in bytes that can be uploaded to this bucket.
  * The global file size limit takes precedence over this value.
  * The default value is null, which doesn't set a per bucket file size limit.
  * @param options.allowedMimeTypes specifies the allowed mime types that this bucket can accept during upload.
  * The default value is null, which allows files with all mime types to be uploaded.
  * Each mime type specified can be a wildcard, e.g. image/*, or a specific mime type, e.g. image/png.
  * @returns Promise with response containing success message or error
  *
  * @example Update bucket
  * ```js
  * const { data, error } = await supabase
  *   .storage
  *   .updateBucket('avatars', {
  *     public: false,
  *     allowedMimeTypes: ['image/png'],
  *     fileSizeLimit: 1024
  *   })
  * ```
  *
  * Response:
  * ```json
  * {
  *   "data": {
  *     "message": "Successfully updated"
  *   },
  *   "error": null
  * }
  * ```
  *
  * @remarks
  * - RLS policy permissions required:
  *   - `buckets` table permissions: `select` and `update`
  *   - `objects` table permissions: none
  * - Refer to the [Storage guide](/docs/guides/storage/security/access-control) on how access control works
  */
  async updateBucket(t, e) {
    var r = this;
    return r.handleOperation(async () => await mn(r.fetch, `${r.url}/bucket/${t}`, {
      id: t,
      name: t,
      public: e.public,
      file_size_limit: e.fileSizeLimit,
      allowed_mime_types: e.allowedMimeTypes
    }, { headers: r.headers }));
  }
  /**
  * Removes all objects inside a single bucket.
  *
  * @category File Buckets
  * @param id The unique identifier of the bucket you would like to empty.
  * @returns Promise with success message or error
  *
  * @example Empty bucket
  * ```js
  * const { data, error } = await supabase
  *   .storage
  *   .emptyBucket('avatars')
  * ```
  *
  * Response:
  * ```json
  * {
  *   "data": {
  *     "message": "Successfully emptied"
  *   },
  *   "error": null
  * }
  * ```
  *
  * @remarks
  * - RLS policy permissions required:
  *   - `buckets` table permissions: `select`
  *   - `objects` table permissions: `select` and `delete`
  * - Refer to the [Storage guide](/docs/guides/storage/security/access-control) on how access control works
  */
  async emptyBucket(t) {
    var e = this;
    return e.handleOperation(async () => await Ce(e.fetch, `${e.url}/bucket/${t}/empty`, {}, { headers: e.headers }));
  }
  /**
  * Deletes an existing bucket. A bucket can't be deleted with existing objects inside it.
  * You must first `empty()` the bucket.
  *
  * @category File Buckets
  * @param id The unique identifier of the bucket you would like to delete.
  * @returns Promise with success message or error
  *
  * @example Delete bucket
  * ```js
  * const { data, error } = await supabase
  *   .storage
  *   .deleteBucket('avatars')
  * ```
  *
  * Response:
  * ```json
  * {
  *   "data": {
  *     "message": "Successfully deleted"
  *   },
  *   "error": null
  * }
  * ```
  *
  * @remarks
  * - RLS policy permissions required:
  *   - `buckets` table permissions: `select` and `delete`
  *   - `objects` table permissions: none
  * - Refer to the [Storage guide](/docs/guides/storage/security/access-control) on how access control works
  */
  async deleteBucket(t) {
    var e = this;
    return e.handleOperation(async () => await jn(e.fetch, `${e.url}/bucket/${t}`, {}, { headers: e.headers }));
  }
  listBucketOptionsToQueryString(t) {
    const e = {};
    return t && ("limit" in t && (e.limit = String(t.limit)), "offset" in t && (e.offset = String(t.offset)), t.search && (e.search = t.search), t.sortColumn && (e.sortColumn = t.sortColumn), t.sortOrder && (e.sortOrder = t.sortOrder)), Object.keys(e).length > 0 ? "?" + new URLSearchParams(e).toString() : "";
  }
}, uf = class extends Ot {
  /**
  * @alpha
  *
  * Creates a new StorageAnalyticsClient instance
  *
  * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
  *
  * @category Analytics Buckets
  * @param url - The base URL for the storage API
  * @param headers - HTTP headers to include in requests
  * @param fetch - Optional custom fetch implementation
  *
  * @example Using supabase-js (recommended)
  * ```typescript
  * import { createClient } from '@supabase/supabase-js'
  *
  * const supabase = createClient('https://xyzcompany.supabase.co', 'publishable-or-anon-key')
  * const { data, error } = await supabase.storage.analytics.listBuckets()
  * ```
  *
  * @example Standalone import for bundle-sensitive environments
  * ```typescript
  * import { StorageAnalyticsClient } from '@supabase/storage-js'
  *
  * const client = new StorageAnalyticsClient(url, headers)
  * ```
  */
  constructor(t, e = {}, r) {
    const n = t.replace(/\/$/, ""), s = B(B({}, Vt), e);
    super(n, s, r, "storage");
  }
  /**
  * @alpha
  *
  * Creates a new analytics bucket using Iceberg tables
  * Analytics buckets are optimized for analytical queries and data processing
  *
  * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
  *
  * @category Analytics Buckets
  * @param name A unique name for the bucket you are creating
  * @returns Promise with response containing newly created analytics bucket or error
  *
  * @example Create analytics bucket
  * ```js
  * const { data, error } = await supabase
  *   .storage
  *   .analytics
  *   .createBucket('analytics-data')
  * ```
  *
  * Response:
  * ```json
  * {
  *   "data": {
  *     "name": "analytics-data",
  *     "type": "ANALYTICS",
  *     "format": "iceberg",
  *     "created_at": "2024-05-22T22:26:05.100Z",
  *     "updated_at": "2024-05-22T22:26:05.100Z"
  *   },
  *   "error": null
  * }
  * ```
  *
  * @remarks
  * - Creates a new analytics bucket using Iceberg tables
  * - Analytics buckets are optimized for analytical queries and data processing
  */
  async createBucket(t) {
    var e = this;
    return e.handleOperation(async () => await Ce(e.fetch, `${e.url}/bucket`, { name: t }, { headers: e.headers }));
  }
  /**
  * @alpha
  *
  * Retrieves the details of all Analytics Storage buckets within an existing project
  * Only returns buckets of type 'ANALYTICS'
  *
  * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
  *
  * @category Analytics Buckets
  * @param options Query parameters for listing buckets
  * @param options.limit Maximum number of buckets to return
  * @param options.offset Number of buckets to skip
  * @param options.sortColumn Column to sort by ('name', 'created_at', 'updated_at')
  * @param options.sortOrder Sort order ('asc' or 'desc')
  * @param options.search Search term to filter bucket names
  * @returns Promise with response containing array of analytics buckets or error
  *
  * @example List analytics buckets
  * ```js
  * const { data, error } = await supabase
  *   .storage
  *   .analytics
  *   .listBuckets({
  *     limit: 10,
  *     offset: 0,
  *     sortColumn: 'created_at',
  *     sortOrder: 'desc'
  *   })
  * ```
  *
  * Response:
  * ```json
  * {
  *   "data": [
  *     {
  *       "name": "analytics-data",
  *       "type": "ANALYTICS",
  *       "format": "iceberg",
  *       "created_at": "2024-05-22T22:26:05.100Z",
  *       "updated_at": "2024-05-22T22:26:05.100Z"
  *     }
  *   ],
  *   "error": null
  * }
  * ```
  *
  * @remarks
  * - Retrieves the details of all Analytics Storage buckets within an existing project
  * - Only returns buckets of type 'ANALYTICS'
  */
  async listBuckets(t) {
    var e = this;
    return e.handleOperation(async () => {
      const r = new URLSearchParams();
      (t == null ? void 0 : t.limit) !== void 0 && r.set("limit", t.limit.toString()), (t == null ? void 0 : t.offset) !== void 0 && r.set("offset", t.offset.toString()), t != null && t.sortColumn && r.set("sortColumn", t.sortColumn), t != null && t.sortOrder && r.set("sortOrder", t.sortOrder), t != null && t.search && r.set("search", t.search);
      const n = r.toString(), s = n ? `${e.url}/bucket?${n}` : `${e.url}/bucket`;
      return await Bt(e.fetch, s, { headers: e.headers });
    });
  }
  /**
  * @alpha
  *
  * Deletes an existing analytics bucket
  * A bucket can't be deleted with existing objects inside it
  * You must first empty the bucket before deletion
  *
  * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
  *
  * @category Analytics Buckets
  * @param bucketName The unique identifier of the bucket you would like to delete
  * @returns Promise with response containing success message or error
  *
  * @example Delete analytics bucket
  * ```js
  * const { data, error } = await supabase
  *   .storage
  *   .analytics
  *   .deleteBucket('analytics-data')
  * ```
  *
  * Response:
  * ```json
  * {
  *   "data": {
  *     "message": "Successfully deleted"
  *   },
  *   "error": null
  * }
  * ```
  *
  * @remarks
  * - Deletes an analytics bucket
  */
  async deleteBucket(t) {
    var e = this;
    return e.handleOperation(async () => await jn(e.fetch, `${e.url}/bucket/${t}`, {}, { headers: e.headers }));
  }
  /**
  * @alpha
  *
  * Get an Iceberg REST Catalog client configured for a specific analytics bucket
  * Use this to perform advanced table and namespace operations within the bucket
  * The returned client provides full access to the Apache Iceberg REST Catalog API
  * with the Supabase `{ data, error }` pattern for consistent error handling on all operations.
  *
  * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
  *
  * @category Analytics Buckets
  * @param bucketName - The name of the analytics bucket (warehouse) to connect to
  * @returns The wrapped Iceberg catalog client
  * @throws {StorageError} If the bucket name is invalid
  *
  * @example Get catalog and create table
  * ```js
  * // First, create an analytics bucket
  * const { data: bucket, error: bucketError } = await supabase
  *   .storage
  *   .analytics
  *   .createBucket('analytics-data')
  *
  * // Get the Iceberg catalog for that bucket
  * const catalog = supabase.storage.analytics.from('analytics-data')
  *
  * // Create a namespace
  * const { error: nsError } = await catalog.createNamespace({ namespace: ['default'] })
  *
  * // Create a table with schema
  * const { data: tableMetadata, error: tableError } = await catalog.createTable(
  *   { namespace: ['default'] },
  *   {
  *     name: 'events',
  *     schema: {
  *       type: 'struct',
  *       fields: [
  *         { id: 1, name: 'id', type: 'long', required: true },
  *         { id: 2, name: 'timestamp', type: 'timestamp', required: true },
  *         { id: 3, name: 'user_id', type: 'string', required: false }
  *       ],
  *       'schema-id': 0,
  *       'identifier-field-ids': [1]
  *     },
  *     'partition-spec': {
  *       'spec-id': 0,
  *       fields: []
  *     },
  *     'write-order': {
  *       'order-id': 0,
  *       fields: []
  *     },
  *     properties: {
  *       'write.format.default': 'parquet'
  *     }
  *   }
  * )
  * ```
  *
  * @example List tables in namespace
  * ```js
  * const catalog = supabase.storage.analytics.from('analytics-data')
  *
  * // List all tables in the default namespace
  * const { data: tables, error: listError } = await catalog.listTables({ namespace: ['default'] })
  * if (listError) {
  *   if (listError.isNotFound()) {
  *     console.log('Namespace not found')
  *   }
  *   return
  * }
  * console.log(tables) // [{ namespace: ['default'], name: 'events' }]
  * ```
  *
  * @example Working with namespaces
  * ```js
  * const catalog = supabase.storage.analytics.from('analytics-data')
  *
  * // List all namespaces
  * const { data: namespaces } = await catalog.listNamespaces()
  *
  * // Create namespace with properties
  * await catalog.createNamespace(
  *   { namespace: ['production'] },
  *   { properties: { owner: 'data-team', env: 'prod' } }
  * )
  * ```
  *
  * @example Cleanup operations
  * ```js
  * const catalog = supabase.storage.analytics.from('analytics-data')
  *
  * // Drop table with purge option (removes all data)
  * const { error: dropError } = await catalog.dropTable(
  *   { namespace: ['default'], name: 'events' },
  *   { purge: true }
  * )
  *
  * if (dropError?.isNotFound()) {
  *   console.log('Table does not exist')
  * }
  *
  * // Drop namespace (must be empty)
  * await catalog.dropNamespace({ namespace: ['default'] })
  * ```
  *
  * @remarks
  * This method provides a bridge between Supabase's bucket management and the standard
  * Apache Iceberg REST Catalog API. The bucket name maps to the Iceberg warehouse parameter.
  * All authentication and configuration is handled automatically using your Supabase credentials.
  *
  * **Error Handling**: Invalid bucket names throw immediately. All catalog
  * operations return `{ data, error }` where errors are `IcebergError` instances from iceberg-js.
  * Use helper methods like `error.isNotFound()` or check `error.status` for specific error handling.
  * Use `.throwOnError()` on the analytics client if you prefer exceptions for catalog operations.
  *
  * **Cleanup Operations**: When using `dropTable`, the `purge: true` option permanently
  * deletes all table data. Without it, the table is marked as deleted but data remains.
  *
  * **Library Dependency**: The returned catalog wraps `IcebergRestCatalog` from iceberg-js.
  * For complete API documentation and advanced usage, refer to the
  * [iceberg-js documentation](https://supabase.github.io/iceberg-js/).
  */
  from(t) {
    var e = this;
    if (!Xd(t)) throw new Nr("Invalid bucket name: File, folder, and bucket names must follow AWS object key naming guidelines and should avoid the use of any other characters.");
    const r = new Hd({
      baseUrl: this.url,
      catalogName: t,
      auth: {
        type: "custom",
        getHeaders: async () => e.headers
      },
      fetch: this.fetch
    }), n = this.shouldThrowOnError;
    return new Proxy(r, { get(s, i) {
      const o = s[i];
      return typeof o != "function" ? o : async (...a) => {
        try {
          return {
            data: await o.apply(s, a),
            error: null
          };
        } catch (c) {
          if (n) throw c;
          return {
            data: null,
            error: c
          };
        }
      };
    } });
  }
}, lf = class extends Ot {
  /** Creates a new VectorIndexApi instance */
  constructor(t, e = {}, r) {
    const n = t.replace(/\/$/, ""), s = B(B({}, Vt), {}, { "Content-Type": "application/json" }, e);
    super(n, s, r, "vectors");
  }
  /** Creates a new vector index within a bucket */
  async createIndex(t) {
    var e = this;
    return e.handleOperation(async () => await ke.post(e.fetch, `${e.url}/CreateIndex`, t, { headers: e.headers }) || {});
  }
  /** Retrieves metadata for a specific vector index */
  async getIndex(t, e) {
    var r = this;
    return r.handleOperation(async () => await ke.post(r.fetch, `${r.url}/GetIndex`, {
      vectorBucketName: t,
      indexName: e
    }, { headers: r.headers }));
  }
  /** Lists vector indexes within a bucket with optional filtering and pagination */
  async listIndexes(t) {
    var e = this;
    return e.handleOperation(async () => await ke.post(e.fetch, `${e.url}/ListIndexes`, t, { headers: e.headers }));
  }
  /** Deletes a vector index and all its data */
  async deleteIndex(t, e) {
    var r = this;
    return r.handleOperation(async () => await ke.post(r.fetch, `${r.url}/DeleteIndex`, {
      vectorBucketName: t,
      indexName: e
    }, { headers: r.headers }) || {});
  }
}, hf = class extends Ot {
  /** Creates a new VectorDataApi instance */
  constructor(t, e = {}, r) {
    const n = t.replace(/\/$/, ""), s = B(B({}, Vt), {}, { "Content-Type": "application/json" }, e);
    super(n, s, r, "vectors");
  }
  /** Inserts or updates vectors in batch (1-500 per request) */
  async putVectors(t) {
    var e = this;
    if (t.vectors.length < 1 || t.vectors.length > 500) throw new Error("Vector batch size must be between 1 and 500 items");
    return e.handleOperation(async () => await ke.post(e.fetch, `${e.url}/PutVectors`, t, { headers: e.headers }) || {});
  }
  /** Retrieves vectors by their keys in batch */
  async getVectors(t) {
    var e = this;
    return e.handleOperation(async () => await ke.post(e.fetch, `${e.url}/GetVectors`, t, { headers: e.headers }));
  }
  /** Lists vectors in an index with pagination */
  async listVectors(t) {
    var e = this;
    if (t.segmentCount !== void 0) {
      if (t.segmentCount < 1 || t.segmentCount > 16) throw new Error("segmentCount must be between 1 and 16");
      if (t.segmentIndex !== void 0 && (t.segmentIndex < 0 || t.segmentIndex >= t.segmentCount))
        throw new Error(`segmentIndex must be between 0 and ${t.segmentCount - 1}`);
    }
    return e.handleOperation(async () => await ke.post(e.fetch, `${e.url}/ListVectors`, t, { headers: e.headers }));
  }
  /** Queries for similar vectors using approximate nearest neighbor search */
  async queryVectors(t) {
    var e = this;
    return e.handleOperation(async () => await ke.post(e.fetch, `${e.url}/QueryVectors`, t, { headers: e.headers }));
  }
  /** Deletes vectors by their keys in batch (1-500 per request) */
  async deleteVectors(t) {
    var e = this;
    if (t.keys.length < 1 || t.keys.length > 500) throw new Error("Keys batch size must be between 1 and 500 items");
    return e.handleOperation(async () => await ke.post(e.fetch, `${e.url}/DeleteVectors`, t, { headers: e.headers }) || {});
  }
}, df = class extends Ot {
  /** Creates a new VectorBucketApi instance */
  constructor(t, e = {}, r) {
    const n = t.replace(/\/$/, ""), s = B(B({}, Vt), {}, { "Content-Type": "application/json" }, e);
    super(n, s, r, "vectors");
  }
  /** Creates a new vector bucket */
  async createBucket(t) {
    var e = this;
    return e.handleOperation(async () => await ke.post(e.fetch, `${e.url}/CreateVectorBucket`, { vectorBucketName: t }, { headers: e.headers }) || {});
  }
  /** Retrieves metadata for a specific vector bucket */
  async getBucket(t) {
    var e = this;
    return e.handleOperation(async () => await ke.post(e.fetch, `${e.url}/GetVectorBucket`, { vectorBucketName: t }, { headers: e.headers }));
  }
  /** Lists vector buckets with optional filtering and pagination */
  async listBuckets(t = {}) {
    var e = this;
    return e.handleOperation(async () => await ke.post(e.fetch, `${e.url}/ListVectorBuckets`, t, { headers: e.headers }));
  }
  /** Deletes a vector bucket (must be empty first) */
  async deleteBucket(t) {
    var e = this;
    return e.handleOperation(async () => await ke.post(e.fetch, `${e.url}/DeleteVectorBucket`, { vectorBucketName: t }, { headers: e.headers }) || {});
  }
}, ff = class extends df {
  /**
  * @alpha
  *
  * Creates a StorageVectorsClient that can manage buckets, indexes, and vectors.
  *
  * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
  *
  * @category Vector Buckets
  * @param url - Base URL of the Storage Vectors REST API.
  * @param options.headers - Optional headers (for example `Authorization`) applied to every request.
  * @param options.fetch - Optional custom `fetch` implementation for non-browser runtimes.
  *
  * @example Using supabase-js (recommended)
  * ```typescript
  * import { createClient } from '@supabase/supabase-js'
  *
  * const supabase = createClient('https://xyzcompany.supabase.co', 'publishable-or-anon-key')
  * const bucket = supabase.storage.vectors.from('embeddings-prod')
  * ```
  *
  * @example Standalone import for bundle-sensitive environments
  * ```typescript
  * import { StorageVectorsClient } from '@supabase/storage-js'
  *
  * const client = new StorageVectorsClient(url, options)
  * ```
  */
  constructor(t, e = {}) {
    super(t, e.headers || {}, e.fetch);
  }
  /**
  *
  * @alpha
  *
  * Access operations for a specific vector bucket
  * Returns a scoped client for index and vector operations within the bucket
  *
  * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
  *
  * @category Vector Buckets
  * @param vectorBucketName - Name of the vector bucket
  * @returns Bucket-scoped client with index and vector operations
  *
  * @example Accessing a vector bucket
  * ```typescript
  * const bucket = supabase.storage.vectors.from('embeddings-prod')
  * ```
  */
  from(t) {
    return new pf(this.url, this.headers, t, this.fetch);
  }
  /**
  *
  * @alpha
  *
  * Creates a new vector bucket
  * Vector buckets are containers for vector indexes and their data
  *
  * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
  *
  * @category Vector Buckets
  * @param vectorBucketName - Unique name for the vector bucket
  * @returns Promise with empty response on success or error
  *
  * @example Creating a vector bucket
  * ```typescript
  * const { data, error } = await supabase
  *   .storage
  *   .vectors
  *   .createBucket('embeddings-prod')
  * ```
  */
  async createBucket(t) {
    var e = () => super.createBucket, r = this;
    return e().call(r, t);
  }
  /**
  *
  * @alpha
  *
  * Retrieves metadata for a specific vector bucket
  *
  * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
  *
  * @category Vector Buckets
  * @param vectorBucketName - Name of the vector bucket
  * @returns Promise with bucket metadata or error
  *
  * @example Get bucket metadata
  * ```typescript
  * const { data, error } = await supabase
  *   .storage
  *   .vectors
  *   .getBucket('embeddings-prod')
  *
  * console.log('Bucket created:', data?.vectorBucket.creationTime)
  * ```
  */
  async getBucket(t) {
    var e = () => super.getBucket, r = this;
    return e().call(r, t);
  }
  /**
  *
  * @alpha
  *
  * Lists all vector buckets with optional filtering and pagination
  *
  * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
  *
  * @category Vector Buckets
  * @param options - Optional filters (prefix, maxResults, nextToken)
  * @returns Promise with list of buckets or error
  *
  * @example List vector buckets
  * ```typescript
  * const { data, error } = await supabase
  *   .storage
  *   .vectors
  *   .listBuckets({ prefix: 'embeddings-' })
  *
  * data?.vectorBuckets.forEach(bucket => {
  *   console.log(bucket.vectorBucketName)
  * })
  * ```
  */
  async listBuckets(t = {}) {
    var e = () => super.listBuckets, r = this;
    return e().call(r, t);
  }
  /**
  *
  * @alpha
  *
  * Deletes a vector bucket (bucket must be empty)
  * All indexes must be deleted before deleting the bucket
  *
  * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
  *
  * @category Vector Buckets
  * @param vectorBucketName - Name of the vector bucket to delete
  * @returns Promise with empty response on success or error
  *
  * @example Delete a vector bucket
  * ```typescript
  * const { data, error } = await supabase
  *   .storage
  *   .vectors
  *   .deleteBucket('embeddings-old')
  * ```
  */
  async deleteBucket(t) {
    var e = () => super.deleteBucket, r = this;
    return e().call(r, t);
  }
}, pf = class extends lf {
  /**
  * @alpha
  *
  * Creates a helper that automatically scopes all index operations to the provided bucket.
  *
  * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
  *
  * @category Vector Buckets
  * @example Creating a vector bucket scope
  * ```typescript
  * const bucket = supabase.storage.vectors.from('embeddings-prod')
  * ```
  */
  constructor(t, e, r, n) {
    super(t, e, n), this.vectorBucketName = r;
  }
  /**
  *
  * @alpha
  *
  * Creates a new vector index in this bucket
  * Convenience method that automatically includes the bucket name
  *
  * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
  *
  * @category Vector Buckets
  * @param options - Index configuration (vectorBucketName is automatically set)
  * @returns Promise with empty response on success or error
  *
  * @example Creating a vector index
  * ```typescript
  * const bucket = supabase.storage.vectors.from('embeddings-prod')
  * await bucket.createIndex({
  *   indexName: 'documents-openai',
  *   dataType: 'float32',
  *   dimension: 1536,
  *   distanceMetric: 'cosine',
  *   metadataConfiguration: {
  *     nonFilterableMetadataKeys: ['raw_text']
  *   }
  * })
  * ```
  */
  async createIndex(t) {
    var e = () => super.createIndex, r = this;
    return e().call(r, B(B({}, t), {}, { vectorBucketName: r.vectorBucketName }));
  }
  /**
  *
  * @alpha
  *
  * Lists indexes in this bucket
  * Convenience method that automatically includes the bucket name
  *
  * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
  *
  * @category Vector Buckets
  * @param options - Listing options (vectorBucketName is automatically set)
  * @returns Promise with response containing indexes array and pagination token or error
  *
  * @example List indexes
  * ```typescript
  * const bucket = supabase.storage.vectors.from('embeddings-prod')
  * const { data } = await bucket.listIndexes({ prefix: 'documents-' })
  * ```
  */
  async listIndexes(t = {}) {
    var e = () => super.listIndexes, r = this;
    return e().call(r, B(B({}, t), {}, { vectorBucketName: r.vectorBucketName }));
  }
  /**
  *
  * @alpha
  *
  * Retrieves metadata for a specific index in this bucket
  * Convenience method that automatically includes the bucket name
  *
  * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
  *
  * @category Vector Buckets
  * @param indexName - Name of the index to retrieve
  * @returns Promise with index metadata or error
  *
  * @example Get index metadata
  * ```typescript
  * const bucket = supabase.storage.vectors.from('embeddings-prod')
  * const { data } = await bucket.getIndex('documents-openai')
  * console.log('Dimension:', data?.index.dimension)
  * ```
  */
  async getIndex(t) {
    var e = () => super.getIndex, r = this;
    return e().call(r, r.vectorBucketName, t);
  }
  /**
  *
  * @alpha
  *
  * Deletes an index from this bucket
  * Convenience method that automatically includes the bucket name
  *
  * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
  *
  * @category Vector Buckets
  * @param indexName - Name of the index to delete
  * @returns Promise with empty response on success or error
  *
  * @example Delete an index
  * ```typescript
  * const bucket = supabase.storage.vectors.from('embeddings-prod')
  * await bucket.deleteIndex('old-index')
  * ```
  */
  async deleteIndex(t) {
    var e = () => super.deleteIndex, r = this;
    return e().call(r, r.vectorBucketName, t);
  }
  /**
  *
  * @alpha
  *
  * Access operations for a specific index within this bucket
  * Returns a scoped client for vector data operations
  *
  * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
  *
  * @category Vector Buckets
  * @param indexName - Name of the index
  * @returns Index-scoped client with vector data operations
  *
  * @example Accessing an index
  * ```typescript
  * const index = supabase.storage.vectors.from('embeddings-prod').index('documents-openai')
  *
  * // Insert vectors
  * await index.putVectors({
  *   vectors: [
  *     { key: 'doc-1', data: { float32: [...] }, metadata: { title: 'Intro' } }
  *   ]
  * })
  *
  * // Query similar vectors
  * const { data } = await index.queryVectors({
  *   queryVector: { float32: [...] },
  *   topK: 5
  * })
  * ```
  */
  index(t) {
    return new mf(this.url, this.headers, this.vectorBucketName, t, this.fetch);
  }
}, mf = class extends hf {
  /**
  *
  * @alpha
  *
  * Creates a helper that automatically scopes all vector operations to the provided bucket/index names.
  *
  * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
  *
  * @category Vector Buckets
  * @example Creating a vector index scope
  * ```typescript
  * const index = supabase.storage.vectors.from('embeddings-prod').index('documents-openai')
  * ```
  */
  constructor(t, e, r, n, s) {
    super(t, e, s), this.vectorBucketName = r, this.indexName = n;
  }
  /**
  *
  * @alpha
  *
  * Inserts or updates vectors in this index
  * Convenience method that automatically includes bucket and index names
  *
  * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
  *
  * @category Vector Buckets
  * @param options - Vector insertion options (bucket and index names automatically set)
  * @returns Promise with empty response on success or error
  *
  * @example Insert vectors into an index
  * ```typescript
  * const index = supabase.storage.vectors.from('embeddings-prod').index('documents-openai')
  * await index.putVectors({
  *   vectors: [
  *     {
  *       key: 'doc-1',
  *       data: { float32: [0.1, 0.2, ...] },
  *       metadata: { title: 'Introduction', page: 1 }
  *     }
  *   ]
  * })
  * ```
  */
  async putVectors(t) {
    var e = () => super.putVectors, r = this;
    return e().call(r, B(B({}, t), {}, {
      vectorBucketName: r.vectorBucketName,
      indexName: r.indexName
    }));
  }
  /**
  *
  * @alpha
  *
  * Retrieves vectors by keys from this index
  * Convenience method that automatically includes bucket and index names
  *
  * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
  *
  * @category Vector Buckets
  * @param options - Vector retrieval options (bucket and index names automatically set)
  * @returns Promise with response containing vectors array or error
  *
  * @example Get vectors by keys
  * ```typescript
  * const index = supabase.storage.vectors.from('embeddings-prod').index('documents-openai')
  * const { data } = await index.getVectors({
  *   keys: ['doc-1', 'doc-2'],
  *   returnMetadata: true
  * })
  * ```
  */
  async getVectors(t) {
    var e = () => super.getVectors, r = this;
    return e().call(r, B(B({}, t), {}, {
      vectorBucketName: r.vectorBucketName,
      indexName: r.indexName
    }));
  }
  /**
  *
  * @alpha
  *
  * Lists vectors in this index with pagination
  * Convenience method that automatically includes bucket and index names
  *
  * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
  *
  * @category Vector Buckets
  * @param options - Listing options (bucket and index names automatically set)
  * @returns Promise with response containing vectors array and pagination token or error
  *
  * @example List vectors with pagination
  * ```typescript
  * const index = supabase.storage.vectors.from('embeddings-prod').index('documents-openai')
  * const { data } = await index.listVectors({
  *   maxResults: 500,
  *   returnMetadata: true
  * })
  * ```
  */
  async listVectors(t = {}) {
    var e = () => super.listVectors, r = this;
    return e().call(r, B(B({}, t), {}, {
      vectorBucketName: r.vectorBucketName,
      indexName: r.indexName
    }));
  }
  /**
  *
  * @alpha
  *
  * Queries for similar vectors in this index
  * Convenience method that automatically includes bucket and index names
  *
  * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
  *
  * @category Vector Buckets
  * @param options - Query options (bucket and index names automatically set)
  * @returns Promise with response containing matches array of similar vectors ordered by distance or error
  *
  * @example Query similar vectors
  * ```typescript
  * const index = supabase.storage.vectors.from('embeddings-prod').index('documents-openai')
  * const { data } = await index.queryVectors({
  *   queryVector: { float32: [0.1, 0.2, ...] },
  *   topK: 5,
  *   filter: { category: 'technical' },
  *   returnDistance: true,
  *   returnMetadata: true
  * })
  * ```
  */
  async queryVectors(t) {
    var e = () => super.queryVectors, r = this;
    return e().call(r, B(B({}, t), {}, {
      vectorBucketName: r.vectorBucketName,
      indexName: r.indexName
    }));
  }
  /**
  *
  * @alpha
  *
  * Deletes vectors by keys from this index
  * Convenience method that automatically includes bucket and index names
  *
  * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
  *
  * @category Vector Buckets
  * @param options - Deletion options (bucket and index names automatically set)
  * @returns Promise with empty response on success or error
  *
  * @example Delete vectors by keys
  * ```typescript
  * const index = supabase.storage.vectors.from('embeddings-prod').index('documents-openai')
  * await index.deleteVectors({
  *   keys: ['doc-1', 'doc-2', 'doc-3']
  * })
  * ```
  */
  async deleteVectors(t) {
    var e = () => super.deleteVectors, r = this;
    return e().call(r, B(B({}, t), {}, {
      vectorBucketName: r.vectorBucketName,
      indexName: r.indexName
    }));
  }
}, gf = class extends cf {
  /**
  * Creates a client for Storage buckets, files, analytics, and vectors.
  *
  * @category File Buckets
  * @example Using supabase-js (recommended)
  * ```ts
  * import { createClient } from '@supabase/supabase-js'
  *
  * const supabase = createClient('https://xyzcompany.supabase.co', 'publishable-or-anon-key')
  * const avatars = supabase.storage.from('avatars')
  * ```
  *
  * @example Standalone import for bundle-sensitive environments
  * ```ts
  * import { StorageClient } from '@supabase/storage-js'
  *
  * const storage = new StorageClient('https://xyzcompany.supabase.co/storage/v1', {
  *   apikey: 'publishable-or-anon-key',
  * })
  * const avatars = storage.from('avatars')
  * ```
  */
  constructor(t, e = {}, r, n) {
    super(t, e, r, n);
  }
  /**
  * Perform file operation in a bucket.
  *
  * @category File Buckets
  * @param id The bucket id to operate on.
  *
  * @example Accessing a bucket
  * ```typescript
  * const avatars = supabase.storage.from('avatars')
  * ```
  */
  from(t) {
    return new of(this.url, this.headers, t, this.fetch);
  }
  /**
  *
  * @alpha
  *
  * Access vector storage operations.
  *
  * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
  *
  * @category Vector Buckets
  * @returns A StorageVectorsClient instance configured with the current storage settings.
  */
  get vectors() {
    return new ff(this.url + "/vector", {
      headers: this.headers,
      fetch: this.fetch
    });
  }
  /**
  *
  * @alpha
  *
  * Access analytics storage operations using Iceberg tables.
  *
  * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
  *
  * @category Analytics Buckets
  * @returns A StorageAnalyticsClient instance configured with the current storage settings.
  */
  get analytics() {
    return new uf(this.url + "/iceberg", this.headers, this.fetch);
  }
};
const ao = "2.104.1", gt = 30 * 1e3, gn = 3, Xr = gn * gt, _f = "http://localhost:9999", yf = "supabase.auth.token", Ef = { "X-Client-Info": `gotrue-js/${ao}` }, _n = "X-Supabase-Api-Version", co = {
  "2024-01-01": {
    timestamp: Date.parse("2024-01-01T00:00:00.0Z"),
    name: "2024-01-01"
  }
}, vf = /^([a-z0-9_-]{4})*($|[a-z0-9_-]{3}$|[a-z0-9_-]{2}$)$/i, wf = 10 * 60 * 1e3;
class Mt extends Error {
  constructor(e, r, n) {
    super(e), this.__isAuthError = !0, this.name = "AuthError", this.status = r, this.code = n;
  }
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      status: this.status,
      code: this.code
    };
  }
}
function U(t) {
  return typeof t == "object" && t !== null && "__isAuthError" in t;
}
class bf extends Mt {
  constructor(e, r, n) {
    super(e, r, n), this.name = "AuthApiError", this.status = r, this.code = n;
  }
}
function Tf(t) {
  return U(t) && t.name === "AuthApiError";
}
class rt extends Mt {
  constructor(e, r) {
    super(e), this.name = "AuthUnknownError", this.originalError = r;
  }
}
class ze extends Mt {
  constructor(e, r, n, s) {
    super(e, n, s), this.name = r, this.status = n;
  }
}
class Ae extends ze {
  constructor() {
    super("Auth session missing!", "AuthSessionMissingError", 400, void 0);
  }
}
function nr(t) {
  return U(t) && t.name === "AuthSessionMissingError";
}
class lt extends ze {
  constructor() {
    super("Auth session or user missing", "AuthInvalidTokenResponseError", 500, void 0);
  }
}
class sr extends ze {
  constructor(e) {
    super(e, "AuthInvalidCredentialsError", 400, void 0);
  }
}
class ir extends ze {
  constructor(e, r = null) {
    super(e, "AuthImplicitGrantRedirectError", 500, void 0), this.details = null, this.details = r;
  }
  toJSON() {
    return Object.assign(Object.assign({}, super.toJSON()), { details: this.details });
  }
}
function Sf(t) {
  return U(t) && t.name === "AuthImplicitGrantRedirectError";
}
class Bs extends ze {
  constructor(e, r = null) {
    super(e, "AuthPKCEGrantCodeExchangeError", 500, void 0), this.details = null, this.details = r;
  }
  toJSON() {
    return Object.assign(Object.assign({}, super.toJSON()), { details: this.details });
  }
}
class Of extends ze {
  constructor() {
    super("PKCE code verifier not found in storage. This can happen if the auth flow was initiated in a different browser or device, or if the storage was cleared. For SSR frameworks (Next.js, SvelteKit, etc.), use @supabase/ssr on both the server and client to store the code verifier in cookies.", "AuthPKCECodeVerifierMissingError", 400, "pkce_code_verifier_not_found");
  }
}
class yn extends ze {
  constructor(e, r) {
    super(e, "AuthRetryableFetchError", r, void 0);
  }
}
function Yr(t) {
  return U(t) && t.name === "AuthRetryableFetchError";
}
class Ms extends ze {
  constructor(e, r, n) {
    super(e, "AuthWeakPasswordError", r, "weak_password"), this.reasons = n;
  }
  toJSON() {
    return Object.assign(Object.assign({}, super.toJSON()), { reasons: this.reasons });
  }
}
class En extends ze {
  constructor(e) {
    super(e, "AuthInvalidJwtError", 400, "invalid_jwt");
  }
}
const vr = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_".split(""), Zs = ` 	
\r=`.split(""), Af = (() => {
  const t = new Array(128);
  for (let e = 0; e < t.length; e += 1)
    t[e] = -1;
  for (let e = 0; e < Zs.length; e += 1)
    t[Zs[e].charCodeAt(0)] = -2;
  for (let e = 0; e < vr.length; e += 1)
    t[vr[e].charCodeAt(0)] = e;
  return t;
})();
function Hs(t, e, r) {
  if (t !== null)
    for (e.queue = e.queue << 8 | t, e.queuedBits += 8; e.queuedBits >= 6; ) {
      const n = e.queue >> e.queuedBits - 6 & 63;
      r(vr[n]), e.queuedBits -= 6;
    }
  else if (e.queuedBits > 0)
    for (e.queue = e.queue << 6 - e.queuedBits, e.queuedBits = 6; e.queuedBits >= 6; ) {
      const n = e.queue >> e.queuedBits - 6 & 63;
      r(vr[n]), e.queuedBits -= 6;
    }
}
function uo(t, e, r) {
  const n = Af[t];
  if (n > -1)
    for (e.queue = e.queue << 6 | n, e.queuedBits += 6; e.queuedBits >= 8; )
      r(e.queue >> e.queuedBits - 8 & 255), e.queuedBits -= 8;
  else {
    if (n === -2)
      return;
    throw new Error(`Invalid Base64-URL character "${String.fromCharCode(t)}"`);
  }
}
function qs(t) {
  const e = [], r = (o) => {
    e.push(String.fromCodePoint(o));
  }, n = {
    utf8seq: 0,
    codepoint: 0
  }, s = { queue: 0, queuedBits: 0 }, i = (o) => {
    Nf(o, n, r);
  };
  for (let o = 0; o < t.length; o += 1)
    uo(t.charCodeAt(o), s, i);
  return e.join("");
}
function kf(t, e) {
  if (t <= 127) {
    e(t);
    return;
  } else if (t <= 2047) {
    e(192 | t >> 6), e(128 | t & 63);
    return;
  } else if (t <= 65535) {
    e(224 | t >> 12), e(128 | t >> 6 & 63), e(128 | t & 63);
    return;
  } else if (t <= 1114111) {
    e(240 | t >> 18), e(128 | t >> 12 & 63), e(128 | t >> 6 & 63), e(128 | t & 63);
    return;
  }
  throw new Error(`Unrecognized Unicode codepoint: ${t.toString(16)}`);
}
function Rf(t, e) {
  for (let r = 0; r < t.length; r += 1) {
    let n = t.charCodeAt(r);
    if (n > 55295 && n <= 56319) {
      const s = (n - 55296) * 1024 & 65535;
      n = (t.charCodeAt(r + 1) - 56320 & 65535 | s) + 65536, r += 1;
    }
    kf(n, e);
  }
}
function Nf(t, e, r) {
  if (e.utf8seq === 0) {
    if (t <= 127) {
      r(t);
      return;
    }
    for (let n = 1; n < 6; n += 1)
      if (!(t >> 7 - n & 1)) {
        e.utf8seq = n;
        break;
      }
    if (e.utf8seq === 2)
      e.codepoint = t & 31;
    else if (e.utf8seq === 3)
      e.codepoint = t & 15;
    else if (e.utf8seq === 4)
      e.codepoint = t & 7;
    else
      throw new Error("Invalid UTF-8 sequence");
    e.utf8seq -= 1;
  } else if (e.utf8seq > 0) {
    if (t <= 127)
      throw new Error("Invalid UTF-8 sequence");
    e.codepoint = e.codepoint << 6 | t & 63, e.utf8seq -= 1, e.utf8seq === 0 && r(e.codepoint);
  }
}
function bt(t) {
  const e = [], r = { queue: 0, queuedBits: 0 }, n = (s) => {
    e.push(s);
  };
  for (let s = 0; s < t.length; s += 1)
    uo(t.charCodeAt(s), r, n);
  return new Uint8Array(e);
}
function If(t) {
  const e = [];
  return Rf(t, (r) => e.push(r)), new Uint8Array(e);
}
function st(t) {
  const e = [], r = { queue: 0, queuedBits: 0 }, n = (s) => {
    e.push(s);
  };
  return t.forEach((s) => Hs(s, r, n)), Hs(null, r, n), e.join("");
}
function Lf(t) {
  return Math.round(Date.now() / 1e3) + t;
}
function Cf() {
  return Symbol("auth-callback");
}
const ye = () => typeof window < "u" && typeof document < "u", Xe = {
  tested: !1,
  writable: !1
}, lo = () => {
  if (!ye())
    return !1;
  try {
    if (typeof globalThis.localStorage != "object")
      return !1;
  } catch {
    return !1;
  }
  if (Xe.tested)
    return Xe.writable;
  const t = `lswt-${Math.random()}${Math.random()}`;
  try {
    globalThis.localStorage.setItem(t, t), globalThis.localStorage.removeItem(t), Xe.tested = !0, Xe.writable = !0;
  } catch {
    Xe.tested = !0, Xe.writable = !1;
  }
  return Xe.writable;
};
function Pf(t) {
  const e = {}, r = new URL(t);
  if (r.hash && r.hash[0] === "#")
    try {
      new URLSearchParams(r.hash.substring(1)).forEach((s, i) => {
        e[i] = s;
      });
    } catch {
    }
  return r.searchParams.forEach((n, s) => {
    e[s] = n;
  }), e;
}
const ho = (t) => t ? (...e) => t(...e) : (...e) => fetch(...e), Df = (t) => typeof t == "object" && t !== null && "status" in t && "ok" in t && "json" in t && typeof t.json == "function", _t = async (t, e, r) => {
  await t.setItem(e, JSON.stringify(r));
}, Ye = async (t, e) => {
  const r = await t.getItem(e);
  if (!r)
    return null;
  try {
    return JSON.parse(r);
  } catch {
    return r;
  }
}, _e = async (t, e) => {
  await t.removeItem(e);
};
class Lr {
  constructor() {
    this.promise = new Lr.promiseConstructor((e, r) => {
      this.resolve = e, this.reject = r;
    });
  }
}
Lr.promiseConstructor = Promise;
function or(t) {
  const e = t.split(".");
  if (e.length !== 3)
    throw new En("Invalid JWT structure");
  for (let n = 0; n < e.length; n++)
    if (!vf.test(e[n]))
      throw new En("JWT not in base64url format");
  return {
    // using base64url lib
    header: JSON.parse(qs(e[0])),
    payload: JSON.parse(qs(e[1])),
    signature: bt(e[2]),
    raw: {
      header: e[0],
      payload: e[1]
    }
  };
}
async function Uf(t) {
  return await new Promise((e) => {
    setTimeout(() => e(null), t);
  });
}
function $f(t, e) {
  return new Promise((n, s) => {
    (async () => {
      for (let i = 0; i < 1 / 0; i++)
        try {
          const o = await t(i);
          if (!e(i, null, o)) {
            n(o);
            return;
          }
        } catch (o) {
          if (!e(i, o)) {
            s(o);
            return;
          }
        }
    })();
  });
}
function jf(t) {
  return ("0" + t.toString(16)).substr(-2);
}
function xf() {
  const e = new Uint32Array(56);
  if (typeof crypto > "u") {
    const r = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~", n = r.length;
    let s = "";
    for (let i = 0; i < 56; i++)
      s += r.charAt(Math.floor(Math.random() * n));
    return s;
  }
  return crypto.getRandomValues(e), Array.from(e, jf).join("");
}
async function Ff(t) {
  const r = new TextEncoder().encode(t), n = await crypto.subtle.digest("SHA-256", r), s = new Uint8Array(n);
  return Array.from(s).map((i) => String.fromCharCode(i)).join("");
}
async function zf(t) {
  if (!(typeof crypto < "u" && typeof crypto.subtle < "u" && typeof TextEncoder < "u"))
    return console.warn("WebCrypto API is not supported. Code challenge method will default to use plain instead of sha256."), t;
  const r = await Ff(t);
  return btoa(r).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
async function ht(t, e, r = !1) {
  const n = xf();
  let s = n;
  r && (s += "/recovery"), await _t(t, `${e}-code-verifier`, s);
  const i = await zf(n);
  return [i, n === i ? "plain" : "s256"];
}
const Bf = /^2[0-9]{3}-(0[1-9]|1[0-2])-(0[1-9]|1[0-9]|2[0-9]|3[0-1])$/i;
function Mf(t) {
  const e = t.headers.get(_n);
  if (!e || !e.match(Bf))
    return null;
  try {
    return /* @__PURE__ */ new Date(`${e}T00:00:00.0Z`);
  } catch {
    return null;
  }
}
function Zf(t) {
  if (!t)
    throw new Error("Missing exp claim");
  const e = Math.floor(Date.now() / 1e3);
  if (t <= e)
    throw new Error("JWT has expired");
}
function Hf(t) {
  switch (t) {
    case "RS256":
      return {
        name: "RSASSA-PKCS1-v1_5",
        hash: { name: "SHA-256" }
      };
    case "ES256":
      return {
        name: "ECDSA",
        namedCurve: "P-256",
        hash: { name: "SHA-256" }
      };
    default:
      throw new Error("Invalid alg claim");
  }
}
const qf = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
function dt(t) {
  if (!qf.test(t))
    throw new Error("@supabase/auth-js: Expected parameter to be UUID but is not");
}
function Qr() {
  const t = {};
  return new Proxy(t, {
    get: (e, r) => {
      if (r === "__isUserNotAvailableProxy")
        return !0;
      if (typeof r == "symbol") {
        const n = r.toString();
        if (n === "Symbol(Symbol.toPrimitive)" || n === "Symbol(Symbol.toStringTag)" || n === "Symbol(util.inspect.custom)")
          return;
      }
      throw new Error(`@supabase/auth-js: client was created with userStorage option and there was no user stored in the user storage. Accessing the "${r}" property of the session object is not supported. Please use getUser() instead.`);
    },
    set: (e, r) => {
      throw new Error(`@supabase/auth-js: client was created with userStorage option and there was no user stored in the user storage. Setting the "${r}" property of the session object is not supported. Please use getUser() to fetch a user object you can manipulate.`);
    },
    deleteProperty: (e, r) => {
      throw new Error(`@supabase/auth-js: client was created with userStorage option and there was no user stored in the user storage. Deleting the "${r}" property of the session object is not supported. Please use getUser() to fetch a user object you can manipulate.`);
    }
  });
}
function Wf(t, e) {
  return new Proxy(t, {
    get: (r, n, s) => {
      if (n === "__isInsecureUserWarningProxy")
        return !0;
      if (typeof n == "symbol") {
        const i = n.toString();
        if (i === "Symbol(Symbol.toPrimitive)" || i === "Symbol(Symbol.toStringTag)" || i === "Symbol(util.inspect.custom)" || i === "Symbol(nodejs.util.inspect.custom)")
          return Reflect.get(r, n, s);
      }
      return !e.value && typeof n == "string" && (console.warn("Using the user object as returned from supabase.auth.getSession() or from some supabase.auth.onAuthStateChange() events could be insecure! This value comes directly from the storage medium (usually cookies on the server) and may not be authentic. Use supabase.auth.getUser() instead which authenticates the data by contacting the Supabase Auth server."), e.value = !0), Reflect.get(r, n, s);
    }
  });
}
function Ws(t) {
  return JSON.parse(JSON.stringify(t));
}
const tt = (t) => t.msg || t.message || t.error_description || t.error || JSON.stringify(t), Kf = [502, 503, 504, 520, 521, 522, 523, 524, 530];
async function Ks(t) {
  var e;
  if (!Df(t))
    throw new yn(tt(t), 0);
  if (Kf.includes(t.status))
    throw new yn(tt(t), t.status);
  let r;
  try {
    r = await t.json();
  } catch (i) {
    throw new rt(tt(i), i);
  }
  let n;
  const s = Mf(t);
  if (s && s.getTime() >= co["2024-01-01"].timestamp && typeof r == "object" && r && typeof r.code == "string" ? n = r.code : typeof r == "object" && r && typeof r.error_code == "string" && (n = r.error_code), n) {
    if (n === "weak_password")
      throw new Ms(tt(r), t.status, ((e = r.weak_password) === null || e === void 0 ? void 0 : e.reasons) || []);
    if (n === "session_not_found")
      throw new Ae();
  } else if (typeof r == "object" && r && typeof r.weak_password == "object" && r.weak_password && Array.isArray(r.weak_password.reasons) && r.weak_password.reasons.length && r.weak_password.reasons.reduce((i, o) => i && typeof o == "string", !0))
    throw new Ms(tt(r), t.status, r.weak_password.reasons);
  throw new bf(tt(r), t.status || 500, n);
}
const Vf = (t, e, r, n) => {
  const s = { method: t, headers: (e == null ? void 0 : e.headers) || {} };
  return t === "GET" ? s : (s.headers = Object.assign({ "Content-Type": "application/json;charset=UTF-8" }, e == null ? void 0 : e.headers), s.body = JSON.stringify(n), Object.assign(Object.assign({}, s), r));
};
async function x(t, e, r, n) {
  var s;
  const i = Object.assign({}, n == null ? void 0 : n.headers);
  i[_n] || (i[_n] = co["2024-01-01"].name), n != null && n.jwt && (i.Authorization = `Bearer ${n.jwt}`);
  const o = (s = n == null ? void 0 : n.query) !== null && s !== void 0 ? s : {};
  n != null && n.redirectTo && (o.redirect_to = n.redirectTo);
  const a = Object.keys(o).length ? "?" + new URLSearchParams(o).toString() : "", c = await Gf(t, e, r + a, {
    headers: i,
    noResolveJson: n == null ? void 0 : n.noResolveJson
  }, {}, n == null ? void 0 : n.body);
  return n != null && n.xform ? n == null ? void 0 : n.xform(c) : { data: Object.assign({}, c), error: null };
}
async function Gf(t, e, r, n, s, i) {
  const o = Vf(e, n, s, i);
  let a;
  try {
    a = await t(r, Object.assign({}, o));
  } catch (c) {
    throw console.error(c), new yn(tt(c), 0);
  }
  if (a.ok || await Ks(a), n != null && n.noResolveJson)
    return a;
  try {
    return await a.json();
  } catch (c) {
    await Ks(c);
  }
}
function Le(t) {
  var e;
  let r = null;
  Yf(t) && (r = Object.assign({}, t), t.expires_at || (r.expires_at = Lf(t.expires_in)));
  const n = (e = t.user) !== null && e !== void 0 ? e : t;
  return { data: { session: r, user: n }, error: null };
}
function Vs(t) {
  const e = Le(t);
  return !e.error && t.weak_password && typeof t.weak_password == "object" && Array.isArray(t.weak_password.reasons) && t.weak_password.reasons.length && t.weak_password.message && typeof t.weak_password.message == "string" && t.weak_password.reasons.reduce((r, n) => r && typeof n == "string", !0) && (e.data.weak_password = t.weak_password), e;
}
function Ze(t) {
  var e;
  return { data: { user: (e = t.user) !== null && e !== void 0 ? e : t }, error: null };
}
function Jf(t) {
  return { data: t, error: null };
}
function Xf(t) {
  const { action_link: e, email_otp: r, hashed_token: n, redirect_to: s, verification_type: i } = t, o = Rr(t, ["action_link", "email_otp", "hashed_token", "redirect_to", "verification_type"]), a = {
    action_link: e,
    email_otp: r,
    hashed_token: n,
    redirect_to: s,
    verification_type: i
  }, c = Object.assign({}, o);
  return {
    data: {
      properties: a,
      user: c
    },
    error: null
  };
}
function Gs(t) {
  return t;
}
function Yf(t) {
  return t.access_token && t.refresh_token && t.expires_in;
}
const en = ["global", "local", "others"];
class Qf {
  /**
   * Creates an admin API client that can be used to manage users and OAuth clients.
   *
   * @example Using supabase-js (recommended)
   * ```ts
   * import { createClient } from '@supabase/supabase-js'
   *
   * const supabase = createClient('https://xyzcompany.supabase.co', 'secret-or-service-role-key')
   * const { data, error } = await supabase.auth.admin.listUsers()
   * ```
   *
   * @example Standalone import for bundle-sensitive environments
   * ```ts
   * import { GoTrueAdminApi } from '@supabase/auth-js'
   *
   * const admin = new GoTrueAdminApi({
   *   url: 'https://xyzcompany.supabase.co/auth/v1',
   *   headers: { Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` },
   * })
   * ```
   */
  constructor({ url: e = "", headers: r = {}, fetch: n }) {
    this.url = e, this.headers = r, this.fetch = ho(n), this.mfa = {
      listFactors: this._listFactors.bind(this),
      deleteFactor: this._deleteFactor.bind(this)
    }, this.oauth = {
      listClients: this._listOAuthClients.bind(this),
      createClient: this._createOAuthClient.bind(this),
      getClient: this._getOAuthClient.bind(this),
      updateClient: this._updateOAuthClient.bind(this),
      deleteClient: this._deleteOAuthClient.bind(this),
      regenerateClientSecret: this._regenerateOAuthClientSecret.bind(this)
    }, this.customProviders = {
      listProviders: this._listCustomProviders.bind(this),
      createProvider: this._createCustomProvider.bind(this),
      getProvider: this._getCustomProvider.bind(this),
      updateProvider: this._updateCustomProvider.bind(this),
      deleteProvider: this._deleteCustomProvider.bind(this)
    };
  }
  /**
   * Removes a logged-in session.
   * @param jwt A valid, logged-in JWT.
   * @param scope The logout sope.
   *
   * @category Auth
   */
  async signOut(e, r = en[0]) {
    if (en.indexOf(r) < 0)
      throw new Error(`@supabase/auth-js: Parameter scope must be one of ${en.join(", ")}`);
    try {
      return await x(this.fetch, "POST", `${this.url}/logout?scope=${r}`, {
        headers: this.headers,
        jwt: e,
        noResolveJson: !0
      }), { data: null, error: null };
    } catch (n) {
      if (U(n))
        return { data: null, error: n };
      throw n;
    }
  }
  /**
   * Sends an invite link to an email address.
   * @param email The email address of the user.
   * @param options Additional options to be included when inviting.
   *
   * @category Auth
   *
   * @remarks
   * - Sends an invite link to the user's email address.
   * - The `inviteUserByEmail()` method is typically used by administrators to invite users to join the application.
   * - Note that PKCE is not supported when using `inviteUserByEmail`. This is because the browser initiating the invite is often different from the browser accepting the invite which makes it difficult to provide the security guarantees required of the PKCE flow.
   *
   * @example Invite a user
   * ```js
   * const { data, error } = await supabase.auth.admin.inviteUserByEmail('email@example.com')
   * ```
   *
   * @exampleResponse Invite a user
   * ```json
   * {
   *   "data": {
   *     "user": {
   *       "id": "11111111-1111-1111-1111-111111111111",
   *       "aud": "authenticated",
   *       "role": "authenticated",
   *       "email": "example@email.com",
   *       "invited_at": "2024-01-01T00:00:00Z",
   *       "phone": "",
   *       "confirmation_sent_at": "2024-01-01T00:00:00Z",
   *       "app_metadata": {
   *         "provider": "email",
   *         "providers": [
   *           "email"
   *         ]
   *       },
   *       "user_metadata": {},
   *       "identities": [
   *         {
   *           "identity_id": "22222222-2222-2222-2222-222222222222",
   *           "id": "11111111-1111-1111-1111-111111111111",
   *           "user_id": "11111111-1111-1111-1111-111111111111",
   *           "identity_data": {
   *             "email": "example@email.com",
   *             "email_verified": false,
   *             "phone_verified": false,
   *             "sub": "11111111-1111-1111-1111-111111111111"
   *           },
   *           "provider": "email",
   *           "last_sign_in_at": "2024-01-01T00:00:00Z",
   *           "created_at": "2024-01-01T00:00:00Z",
   *           "updated_at": "2024-01-01T00:00:00Z",
   *           "email": "example@email.com"
   *         }
   *       ],
   *       "created_at": "2024-01-01T00:00:00Z",
   *       "updated_at": "2024-01-01T00:00:00Z",
   *       "is_anonymous": false
   *     }
   *   },
   *   "error": null
   * }
   * ```
   */
  async inviteUserByEmail(e, r = {}) {
    try {
      return await x(this.fetch, "POST", `${this.url}/invite`, {
        body: { email: e, data: r.data },
        headers: this.headers,
        redirectTo: r.redirectTo,
        xform: Ze
      });
    } catch (n) {
      if (U(n))
        return { data: { user: null }, error: n };
      throw n;
    }
  }
  /**
   * Generates email links and OTPs to be sent via a custom email provider.
   * @param email The user's email.
   * @param options.password User password. For signup only.
   * @param options.data Optional user metadata. For signup only.
   * @param options.redirectTo The redirect url which should be appended to the generated link
   *
   * @category Auth
   *
   * @remarks
   * - The following types can be passed into `generateLink()`: `signup`, `magiclink`, `invite`, `recovery`, `email_change_current`, `email_change_new`, `phone_change`.
   * - `generateLink()` only generates the email link for `email_change_email` if the **Secure email change** is enabled in your project's [email auth provider settings](/dashboard/project/_/auth/providers).
   * - `generateLink()` handles the creation of the user for `signup`, `invite` and `magiclink`.
   *
   * @example Generate a signup link
   * ```js
   * const { data, error } = await supabase.auth.admin.generateLink({
   *   type: 'signup',
   *   email: 'email@example.com',
   *   password: 'secret'
   * })
   * ```
   *
   * @exampleResponse Generate a signup link
   * ```json
   * {
   *   "data": {
   *     "properties": {
   *       "action_link": "<LINK_TO_SEND_TO_USER>",
   *       "email_otp": "999999",
   *       "hashed_token": "<HASHED_TOKEN",
   *       "redirect_to": "<REDIRECT_URL>",
   *       "verification_type": "signup"
   *     },
   *     "user": {
   *       "id": "11111111-1111-1111-1111-111111111111",
   *       "aud": "authenticated",
   *       "role": "authenticated",
   *       "email": "email@example.com",
   *       "phone": "",
   *       "confirmation_sent_at": "2024-01-01T00:00:00Z",
   *       "app_metadata": {
   *         "provider": "email",
   *         "providers": [
   *           "email"
   *         ]
   *       },
   *       "user_metadata": {},
   *       "identities": [
   *         {
   *           "identity_id": "22222222-2222-2222-2222-222222222222",
   *           "id": "11111111-1111-1111-1111-111111111111",
   *           "user_id": "11111111-1111-1111-1111-111111111111",
   *           "identity_data": {
   *             "email": "email@example.com",
   *             "email_verified": false,
   *             "phone_verified": false,
   *             "sub": "11111111-1111-1111-1111-111111111111"
   *           },
   *           "provider": "email",
   *           "last_sign_in_at": "2024-01-01T00:00:00Z",
   *           "created_at": "2024-01-01T00:00:00Z",
   *           "updated_at": "2024-01-01T00:00:00Z",
   *           "email": "email@example.com"
   *         }
   *       ],
   *       "created_at": "2024-01-01T00:00:00Z",
   *       "updated_at": "2024-01-01T00:00:00Z",
   *       "is_anonymous": false
   *     }
   *   },
   *   "error": null
   * }
   * ```
   *
   * @example Generate an invite link
   * ```js
   * const { data, error } = await supabase.auth.admin.generateLink({
   *   type: 'invite',
   *   email: 'email@example.com'
   * })
   * ```
   *
   * @example Generate a magic link
   * ```js
   * const { data, error } = await supabase.auth.admin.generateLink({
   *   type: 'magiclink',
   *   email: 'email@example.com'
   * })
   * ```
   *
   * @example Generate a recovery link
   * ```js
   * const { data, error } = await supabase.auth.admin.generateLink({
   *   type: 'recovery',
   *   email: 'email@example.com'
   * })
   * ```
   *
   * @example Generate links to change current email address
   * ```js
   * // generate an email change link to be sent to the current email address
   * const { data, error } = await supabase.auth.admin.generateLink({
   *   type: 'email_change_current',
   *   email: 'current.email@example.com',
   *   newEmail: 'new.email@example.com'
   * })
   *
   * // generate an email change link to be sent to the new email address
   * const { data, error } = await supabase.auth.admin.generateLink({
   *   type: 'email_change_new',
   *   email: 'current.email@example.com',
   *   newEmail: 'new.email@example.com'
   * })
   * ```
   */
  async generateLink(e) {
    try {
      const { options: r } = e, n = Rr(e, ["options"]), s = Object.assign(Object.assign({}, n), r);
      return "newEmail" in n && (s.new_email = n == null ? void 0 : n.newEmail, delete s.newEmail), await x(this.fetch, "POST", `${this.url}/admin/generate_link`, {
        body: s,
        headers: this.headers,
        xform: Xf,
        redirectTo: r == null ? void 0 : r.redirectTo
      });
    } catch (r) {
      if (U(r))
        return {
          data: {
            properties: null,
            user: null
          },
          error: r
        };
      throw r;
    }
  }
  // User Admin API
  /**
   * Creates a new user.
   * This function should only be called on a server. Never expose your `service_role` key in the browser.
   *
   * @category Auth
   *
   * @remarks
   * - To confirm the user's email address or phone number, set `email_confirm` or `phone_confirm` to true. Both arguments default to false.
   * - `createUser()` will not send a confirmation email to the user. You can use [`inviteUserByEmail()`](/docs/reference/javascript/auth-admin-inviteuserbyemail) if you want to send them an email invite instead.
   * - If you are sure that the created user's email or phone number is legitimate and verified, you can set the `email_confirm` or `phone_confirm` param to `true`.
   *
   * @example With custom user metadata
   * ```js
   * const { data, error } = await supabase.auth.admin.createUser({
   *   email: 'user@email.com',
   *   password: 'password',
   *   user_metadata: { name: 'Yoda' }
   * })
   * ```
   *
   * @exampleResponse With custom user metadata
   * ```json
   * {
   *   data: {
   *     user: {
   *       id: '1',
   *       aud: 'authenticated',
   *       role: 'authenticated',
   *       email: 'example@email.com',
   *       email_confirmed_at: '2024-01-01T00:00:00Z',
   *       phone: '',
   *       confirmation_sent_at: '2024-01-01T00:00:00Z',
   *       confirmed_at: '2024-01-01T00:00:00Z',
   *       last_sign_in_at: '2024-01-01T00:00:00Z',
   *       app_metadata: {},
   *       user_metadata: {},
   *       identities: [
   *         {
   *           "identity_id": "22222222-2222-2222-2222-222222222222",
   *           "id": "1",
   *           "user_id": "1",
   *           "identity_data": {
   *             "email": "example@email.com",
   *             "email_verified": true,
   *             "phone_verified": false,
   *             "sub": "1"
   *           },
   *           "provider": "email",
   *           "last_sign_in_at": "2024-01-01T00:00:00Z",
   *           "created_at": "2024-01-01T00:00:00Z",
   *           "updated_at": "2024-01-01T00:00:00Z",
   *           "email": "email@example.com"
   *         },
   *       ],
   *       created_at: '2024-01-01T00:00:00Z',
   *       updated_at: '2024-01-01T00:00:00Z',
   *       is_anonymous: false,
   *     }
   *   }
   *   error: null
   * }
   * ```
   *
   * @example Auto-confirm the user's email
   * ```js
   * const { data, error } = await supabase.auth.admin.createUser({
   *   email: 'user@email.com',
   *   email_confirm: true
   * })
   * ```
   *
   * @example Auto-confirm the user's phone number
   * ```js
   * const { data, error } = await supabase.auth.admin.createUser({
   *   phone: '1234567890',
   *   phone_confirm: true
   * })
   * ```
   */
  async createUser(e) {
    try {
      return await x(this.fetch, "POST", `${this.url}/admin/users`, {
        body: e,
        headers: this.headers,
        xform: Ze
      });
    } catch (r) {
      if (U(r))
        return { data: { user: null }, error: r };
      throw r;
    }
  }
  /**
   * Get a list of users.
   *
   * This function should only be called on a server. Never expose your `service_role` key in the browser.
   * @param params An object which supports `page` and `perPage` as numbers, to alter the paginated results.
   *
   * @category Auth
   *
   * @remarks
   * - Defaults to return 50 users per page.
   *
   * @example Get a page of users
   * ```js
   * const { data: { users }, error } = await supabase.auth.admin.listUsers()
   * ```
   *
   * @example Paginated list of users
   * ```js
   * const { data: { users }, error } = await supabase.auth.admin.listUsers({
   *   page: 1,
   *   perPage: 1000
   * })
   * ```
   */
  async listUsers(e) {
    var r, n, s, i, o, a, c;
    try {
      const u = { nextPage: null, lastPage: 0, total: 0 }, l = await x(this.fetch, "GET", `${this.url}/admin/users`, {
        headers: this.headers,
        noResolveJson: !0,
        query: {
          page: (n = (r = e == null ? void 0 : e.page) === null || r === void 0 ? void 0 : r.toString()) !== null && n !== void 0 ? n : "",
          per_page: (i = (s = e == null ? void 0 : e.perPage) === null || s === void 0 ? void 0 : s.toString()) !== null && i !== void 0 ? i : ""
        },
        xform: Gs
      });
      if (l.error)
        throw l.error;
      const h = await l.json(), f = (o = l.headers.get("x-total-count")) !== null && o !== void 0 ? o : 0, d = (c = (a = l.headers.get("link")) === null || a === void 0 ? void 0 : a.split(",")) !== null && c !== void 0 ? c : [];
      return d.length > 0 && (d.forEach((g) => {
        const y = parseInt(g.split(";")[0].split("=")[1].substring(0, 1)), I = JSON.parse(g.split(";")[1].split("=")[1]);
        u[`${I}Page`] = y;
      }), u.total = parseInt(f)), { data: Object.assign(Object.assign({}, h), u), error: null };
    } catch (u) {
      if (U(u))
        return { data: { users: [] }, error: u };
      throw u;
    }
  }
  /**
   * Get user by id.
   *
   * @param uid The user's unique identifier
   *
   * This function should only be called on a server. Never expose your `service_role` key in the browser.
   *
   * @category Auth
   *
   * @remarks
   * - Fetches the user object from the database based on the user's id.
   * - The `getUserById()` method requires the user's id which maps to the `auth.users.id` column.
   *
   * @example Fetch the user object using the access_token jwt
   * ```js
   * const { data, error } = await supabase.auth.admin.getUserById(1)
   * ```
   *
   * @exampleResponse Fetch the user object using the access_token jwt
   * ```json
   * {
   *   data: {
   *     user: {
   *       id: '1',
   *       aud: 'authenticated',
   *       role: 'authenticated',
   *       email: 'example@email.com',
   *       email_confirmed_at: '2024-01-01T00:00:00Z',
   *       phone: '',
   *       confirmation_sent_at: '2024-01-01T00:00:00Z',
   *       confirmed_at: '2024-01-01T00:00:00Z',
   *       last_sign_in_at: '2024-01-01T00:00:00Z',
   *       app_metadata: {},
   *       user_metadata: {},
   *       identities: [
   *         {
   *           "identity_id": "22222222-2222-2222-2222-222222222222",
   *           "id": "1",
   *           "user_id": "1",
   *           "identity_data": {
   *             "email": "example@email.com",
   *             "email_verified": true,
   *             "phone_verified": false,
   *             "sub": "1"
   *           },
   *           "provider": "email",
   *           "last_sign_in_at": "2024-01-01T00:00:00Z",
   *           "created_at": "2024-01-01T00:00:00Z",
   *           "updated_at": "2024-01-01T00:00:00Z",
   *           "email": "email@example.com"
   *         },
   *       ],
   *       created_at: '2024-01-01T00:00:00Z',
   *       updated_at: '2024-01-01T00:00:00Z',
   *       is_anonymous: false,
   *     }
   *   }
   *   error: null
   * }
   * ```
   */
  async getUserById(e) {
    dt(e);
    try {
      return await x(this.fetch, "GET", `${this.url}/admin/users/${e}`, {
        headers: this.headers,
        xform: Ze
      });
    } catch (r) {
      if (U(r))
        return { data: { user: null }, error: r };
      throw r;
    }
  }
  /**
   * Updates the user data. Changes are applied directly without confirmation flows.
   *
   * @param uid The user's unique identifier
   * @param attributes The data you want to update.
   *
   * This function should only be called on a server. Never expose your `service_role` key in the browser.
   *
   * @remarks
   * **Important:** This is a server-side operation and does **not** trigger client-side
   * `onAuthStateChange` listeners. The admin API has no connection to client state.
   *
   * To sync changes to the client after calling this method:
   * 1. On the client, call `supabase.auth.refreshSession()` to fetch the updated user data
   * 2. This will trigger the `TOKEN_REFRESHED` event and notify all listeners
   *
   * @example
   * ```typescript
   * // Server-side (Edge Function)
   * const { data, error } = await supabase.auth.admin.updateUserById(
   *   userId,
   *   { user_metadata: { preferences: { theme: 'dark' } } }
   * )
   *
   * // Client-side (to sync the changes)
   * const { data, error } = await supabase.auth.refreshSession()
   * // onAuthStateChange listeners will now be notified with updated user
   * ```
   *
   * @see {@link GoTrueClient.refreshSession} for syncing admin changes to the client
   * @see {@link GoTrueClient.updateUser} for client-side user updates (triggers listeners automatically)
   *
   * @category Auth
   *
   * @example Updates a user's email
   * ```js
   * const { data: user, error } = await supabase.auth.admin.updateUserById(
   *   '11111111-1111-1111-1111-111111111111',
   *   { email: 'new@email.com' }
   * )
   * ```
   *
   * @exampleResponse Updates a user's email
   * ```json
   * {
   *   "data": {
   *     "user": {
   *       "id": "11111111-1111-1111-1111-111111111111",
   *       "aud": "authenticated",
   *       "role": "authenticated",
   *       "email": "new@email.com",
   *       "email_confirmed_at": "2024-01-01T00:00:00Z",
   *       "phone": "",
   *       "confirmed_at": "2024-01-01T00:00:00Z",
   *       "recovery_sent_at": "2024-01-01T00:00:00Z",
   *       "last_sign_in_at": "2024-01-01T00:00:00Z",
   *       "app_metadata": {
   *         "provider": "email",
   *         "providers": [
   *           "email"
   *         ]
   *       },
   *       "user_metadata": {
   *         "email": "example@email.com",
   *         "email_verified": false,
   *         "phone_verified": false,
   *         "sub": "11111111-1111-1111-1111-111111111111"
   *       },
   *       "identities": [
   *         {
   *           "identity_id": "22222222-2222-2222-2222-222222222222",
   *           "id": "11111111-1111-1111-1111-111111111111",
   *           "user_id": "11111111-1111-1111-1111-111111111111",
   *           "identity_data": {
   *             "email": "example@email.com",
   *             "email_verified": false,
   *             "phone_verified": false,
   *             "sub": "11111111-1111-1111-1111-111111111111"
   *           },
   *           "provider": "email",
   *           "last_sign_in_at": "2024-01-01T00:00:00Z",
   *           "created_at": "2024-01-01T00:00:00Z",
   *           "updated_at": "2024-01-01T00:00:00Z",
   *           "email": "example@email.com"
   *         }
   *       ],
   *       "created_at": "2024-01-01T00:00:00Z",
   *       "updated_at": "2024-01-01T00:00:00Z",
   *       "is_anonymous": false
   *     }
   *   },
   *   "error": null
   * }
   * ```
   *
   * @example Updates a user's password
   * ```js
   * const { data: user, error } = await supabase.auth.admin.updateUserById(
   *   '6aa5d0d4-2a9f-4483-b6c8-0cf4c6c98ac4',
   *   { password: 'new_password' }
   * )
   * ```
   *
   * @example Updates a user's metadata
   * ```js
   * const { data: user, error } = await supabase.auth.admin.updateUserById(
   *   '6aa5d0d4-2a9f-4483-b6c8-0cf4c6c98ac4',
   *   { user_metadata: { hello: 'world' } }
   * )
   * ```
   *
   * @example Updates a user's app_metadata
   * ```js
   * const { data: user, error } = await supabase.auth.admin.updateUserById(
   *   '6aa5d0d4-2a9f-4483-b6c8-0cf4c6c98ac4',
   *   { app_metadata: { plan: 'trial' } }
   * )
   * ```
   *
   * @example Confirms a user's email address
   * ```js
   * const { data: user, error } = await supabase.auth.admin.updateUserById(
   *   '6aa5d0d4-2a9f-4483-b6c8-0cf4c6c98ac4',
   *   { email_confirm: true }
   * )
   * ```
   *
   * @example Confirms a user's phone number
   * ```js
   * const { data: user, error } = await supabase.auth.admin.updateUserById(
   *   '6aa5d0d4-2a9f-4483-b6c8-0cf4c6c98ac4',
   *   { phone_confirm: true }
   * )
   * ```
   *
   * @example Ban a user for 100 years
   * ```js
   * const { data: user, error } = await supabase.auth.admin.updateUserById(
   *   '6aa5d0d4-2a9f-4483-b6c8-0cf4c6c98ac4',
   *   { ban_duration: '876000h' }
   * )
   * ```
   */
  async updateUserById(e, r) {
    dt(e);
    try {
      return await x(this.fetch, "PUT", `${this.url}/admin/users/${e}`, {
        body: r,
        headers: this.headers,
        xform: Ze
      });
    } catch (n) {
      if (U(n))
        return { data: { user: null }, error: n };
      throw n;
    }
  }
  /**
   * Delete a user. Requires a `service_role` key.
   *
   * @param id The user id you want to remove.
   * @param shouldSoftDelete If true, then the user will be soft-deleted from the auth schema. Soft deletion allows user identification from the hashed user ID but is not reversible.
   * Defaults to false for backward compatibility.
   *
   * This function should only be called on a server. Never expose your `service_role` key in the browser.
   *
   * @category Auth
   *
   * @remarks
   * - The `deleteUser()` method requires the user's ID, which maps to the `auth.users.id` column.
   *
   * @example Removes a user
   * ```js
   * const { data, error } = await supabase.auth.admin.deleteUser(
   *   '715ed5db-f090-4b8c-a067-640ecee36aa0'
   * )
   * ```
   *
   * @exampleResponse Removes a user
   * ```json
   * {
   *   "data": {
   *     "user": {}
   *   },
   *   "error": null
   * }
   * ```
   */
  async deleteUser(e, r = !1) {
    dt(e);
    try {
      return await x(this.fetch, "DELETE", `${this.url}/admin/users/${e}`, {
        headers: this.headers,
        body: {
          should_soft_delete: r
        },
        xform: Ze
      });
    } catch (n) {
      if (U(n))
        return { data: { user: null }, error: n };
      throw n;
    }
  }
  async _listFactors(e) {
    dt(e.userId);
    try {
      const { data: r, error: n } = await x(this.fetch, "GET", `${this.url}/admin/users/${e.userId}/factors`, {
        headers: this.headers,
        xform: (s) => ({ data: { factors: s }, error: null })
      });
      return { data: r, error: n };
    } catch (r) {
      if (U(r))
        return { data: null, error: r };
      throw r;
    }
  }
  async _deleteFactor(e) {
    dt(e.userId), dt(e.id);
    try {
      return { data: await x(this.fetch, "DELETE", `${this.url}/admin/users/${e.userId}/factors/${e.id}`, {
        headers: this.headers
      }), error: null };
    } catch (r) {
      if (U(r))
        return { data: null, error: r };
      throw r;
    }
  }
  /**
   * Lists all OAuth clients with optional pagination.
   * Only relevant when the OAuth 2.1 server is enabled in Supabase Auth.
   *
   * This function should only be called on a server. Never expose your `service_role` key in the browser.
   */
  async _listOAuthClients(e) {
    var r, n, s, i, o, a, c;
    try {
      const u = { nextPage: null, lastPage: 0, total: 0 }, l = await x(this.fetch, "GET", `${this.url}/admin/oauth/clients`, {
        headers: this.headers,
        noResolveJson: !0,
        query: {
          page: (n = (r = e == null ? void 0 : e.page) === null || r === void 0 ? void 0 : r.toString()) !== null && n !== void 0 ? n : "",
          per_page: (i = (s = e == null ? void 0 : e.perPage) === null || s === void 0 ? void 0 : s.toString()) !== null && i !== void 0 ? i : ""
        },
        xform: Gs
      });
      if (l.error)
        throw l.error;
      const h = await l.json(), f = (o = l.headers.get("x-total-count")) !== null && o !== void 0 ? o : 0, d = (c = (a = l.headers.get("link")) === null || a === void 0 ? void 0 : a.split(",")) !== null && c !== void 0 ? c : [];
      return d.length > 0 && (d.forEach((g) => {
        const y = parseInt(g.split(";")[0].split("=")[1].substring(0, 1)), I = JSON.parse(g.split(";")[1].split("=")[1]);
        u[`${I}Page`] = y;
      }), u.total = parseInt(f)), { data: Object.assign(Object.assign({}, h), u), error: null };
    } catch (u) {
      if (U(u))
        return { data: { clients: [] }, error: u };
      throw u;
    }
  }
  /**
   * Creates a new OAuth client.
   * Only relevant when the OAuth 2.1 server is enabled in Supabase Auth.
   *
   * This function should only be called on a server. Never expose your `service_role` key in the browser.
   */
  async _createOAuthClient(e) {
    try {
      return await x(this.fetch, "POST", `${this.url}/admin/oauth/clients`, {
        body: e,
        headers: this.headers,
        xform: (r) => ({ data: r, error: null })
      });
    } catch (r) {
      if (U(r))
        return { data: null, error: r };
      throw r;
    }
  }
  /**
   * Gets details of a specific OAuth client.
   * Only relevant when the OAuth 2.1 server is enabled in Supabase Auth.
   *
   * This function should only be called on a server. Never expose your `service_role` key in the browser.
   */
  async _getOAuthClient(e) {
    try {
      return await x(this.fetch, "GET", `${this.url}/admin/oauth/clients/${e}`, {
        headers: this.headers,
        xform: (r) => ({ data: r, error: null })
      });
    } catch (r) {
      if (U(r))
        return { data: null, error: r };
      throw r;
    }
  }
  /**
   * Updates an existing OAuth client.
   * Only relevant when the OAuth 2.1 server is enabled in Supabase Auth.
   *
   * This function should only be called on a server. Never expose your `service_role` key in the browser.
   */
  async _updateOAuthClient(e, r) {
    try {
      return await x(this.fetch, "PUT", `${this.url}/admin/oauth/clients/${e}`, {
        body: r,
        headers: this.headers,
        xform: (n) => ({ data: n, error: null })
      });
    } catch (n) {
      if (U(n))
        return { data: null, error: n };
      throw n;
    }
  }
  /**
   * Deletes an OAuth client.
   * Only relevant when the OAuth 2.1 server is enabled in Supabase Auth.
   *
   * This function should only be called on a server. Never expose your `service_role` key in the browser.
   */
  async _deleteOAuthClient(e) {
    try {
      return await x(this.fetch, "DELETE", `${this.url}/admin/oauth/clients/${e}`, {
        headers: this.headers,
        noResolveJson: !0
      }), { data: null, error: null };
    } catch (r) {
      if (U(r))
        return { data: null, error: r };
      throw r;
    }
  }
  /**
   * Regenerates the secret for an OAuth client.
   * Only relevant when the OAuth 2.1 server is enabled in Supabase Auth.
   *
   * This function should only be called on a server. Never expose your `service_role` key in the browser.
   */
  async _regenerateOAuthClientSecret(e) {
    try {
      return await x(this.fetch, "POST", `${this.url}/admin/oauth/clients/${e}/regenerate_secret`, {
        headers: this.headers,
        xform: (r) => ({ data: r, error: null })
      });
    } catch (r) {
      if (U(r))
        return { data: null, error: r };
      throw r;
    }
  }
  /**
   * Lists all custom providers with optional type filter.
   *
   * This function should only be called on a server. Never expose your `service_role` key in the browser.
   */
  async _listCustomProviders(e) {
    try {
      const r = {};
      return e != null && e.type && (r.type = e.type), await x(this.fetch, "GET", `${this.url}/admin/custom-providers`, {
        headers: this.headers,
        query: r,
        xform: (n) => {
          var s;
          return { data: { providers: (s = n == null ? void 0 : n.providers) !== null && s !== void 0 ? s : [] }, error: null };
        }
      });
    } catch (r) {
      if (U(r))
        return { data: { providers: [] }, error: r };
      throw r;
    }
  }
  /**
   * Creates a new custom OIDC/OAuth provider.
   *
   * For OIDC providers, the server fetches and validates the OpenID Connect discovery document
   * from the issuer's well-known endpoint (or the provided `discovery_url`) at creation time.
   * This may return a validation error (`error_code: "validation_failed"`) if the discovery
   * document is unreachable, not valid JSON, missing required fields, or if the issuer
   * in the document does not match the expected issuer.
   *
   * This function should only be called on a server. Never expose your `service_role` key in the browser.
   */
  async _createCustomProvider(e) {
    try {
      return await x(this.fetch, "POST", `${this.url}/admin/custom-providers`, {
        body: e,
        headers: this.headers,
        xform: (r) => ({ data: r, error: null })
      });
    } catch (r) {
      if (U(r))
        return { data: null, error: r };
      throw r;
    }
  }
  /**
   * Gets details of a specific custom provider by identifier.
   *
   * This function should only be called on a server. Never expose your `service_role` key in the browser.
   */
  async _getCustomProvider(e) {
    try {
      return await x(this.fetch, "GET", `${this.url}/admin/custom-providers/${e}`, {
        headers: this.headers,
        xform: (r) => ({ data: r, error: null })
      });
    } catch (r) {
      if (U(r))
        return { data: null, error: r };
      throw r;
    }
  }
  /**
   * Updates an existing custom provider.
   *
   * When `issuer` or `discovery_url` is changed on an OIDC provider, the server re-fetches and
   * validates the discovery document before persisting. This may return a validation error
   * (`error_code: "validation_failed"`) if the discovery document is unreachable, invalid, or
   * the issuer does not match.
   *
   * This function should only be called on a server. Never expose your `service_role` key in the browser.
   */
  async _updateCustomProvider(e, r) {
    try {
      return await x(this.fetch, "PUT", `${this.url}/admin/custom-providers/${e}`, {
        body: r,
        headers: this.headers,
        xform: (n) => ({ data: n, error: null })
      });
    } catch (n) {
      if (U(n))
        return { data: null, error: n };
      throw n;
    }
  }
  /**
   * Deletes a custom provider.
   *
   * This function should only be called on a server. Never expose your `service_role` key in the browser.
   */
  async _deleteCustomProvider(e) {
    try {
      return await x(this.fetch, "DELETE", `${this.url}/admin/custom-providers/${e}`, {
        headers: this.headers,
        noResolveJson: !0
      }), { data: null, error: null };
    } catch (r) {
      if (U(r))
        return { data: null, error: r };
      throw r;
    }
  }
}
function Js(t = {}) {
  return {
    getItem: (e) => t[e] || null,
    setItem: (e, r) => {
      t[e] = r;
    },
    removeItem: (e) => {
      delete t[e];
    }
  };
}
const Pe = {
  /**
   * @experimental
   */
  debug: !!(globalThis && lo() && globalThis.localStorage && globalThis.localStorage.getItem("supabase.gotrue-js.locks.debug") === "true")
};
class fo extends Error {
  constructor(e) {
    super(e), this.isAcquireTimeout = !0;
  }
}
class Xs extends fo {
}
async function ep(t, e, r) {
  Pe.debug && console.log("@supabase/gotrue-js: navigatorLock: acquire lock", t, e);
  const n = new globalThis.AbortController();
  let s;
  e > 0 && (s = setTimeout(() => {
    n.abort(), Pe.debug && console.log("@supabase/gotrue-js: navigatorLock acquire timed out", t);
  }, e)), await Promise.resolve();
  try {
    return await globalThis.navigator.locks.request(t, e === 0 ? {
      mode: "exclusive",
      ifAvailable: !0
    } : {
      mode: "exclusive",
      signal: n.signal
    }, async (i) => {
      if (i) {
        clearTimeout(s), Pe.debug && console.log("@supabase/gotrue-js: navigatorLock: acquired", t, i.name);
        try {
          return await r();
        } finally {
          Pe.debug && console.log("@supabase/gotrue-js: navigatorLock: released", t, i.name);
        }
      } else {
        if (e === 0)
          throw Pe.debug && console.log("@supabase/gotrue-js: navigatorLock: not immediately available", t), new Xs(`Acquiring an exclusive Navigator LockManager lock "${t}" immediately failed`);
        if (Pe.debug)
          try {
            const o = await globalThis.navigator.locks.query();
            console.log("@supabase/gotrue-js: Navigator LockManager state", JSON.stringify(o, null, "  "));
          } catch (o) {
            console.warn("@supabase/gotrue-js: Error when querying Navigator LockManager state", o);
          }
        return console.warn("@supabase/gotrue-js: Navigator LockManager returned a null lock when using #request without ifAvailable set to true, it appears this browser is not following the LockManager spec https://developer.mozilla.org/en-US/docs/Web/API/LockManager/request"), clearTimeout(s), await r();
      }
    });
  } catch (i) {
    if (e > 0 && clearTimeout(s), (i == null ? void 0 : i.name) === "AbortError" && e > 0) {
      if (n.signal.aborted)
        return Pe.debug && console.log("@supabase/gotrue-js: navigatorLock: acquire timeout, recovering by stealing lock", t), console.warn(`@supabase/gotrue-js: Lock "${t}" was not released within ${e}ms. This may indicate an orphaned lock from a component unmount (e.g., React Strict Mode). Forcefully acquiring the lock to recover.`), await Promise.resolve().then(() => globalThis.navigator.locks.request(t, {
          mode: "exclusive",
          steal: !0
        }, async (o) => {
          if (o) {
            Pe.debug && console.log("@supabase/gotrue-js: navigatorLock: recovered (stolen)", t, o.name);
            try {
              return await r();
            } finally {
              Pe.debug && console.log("@supabase/gotrue-js: navigatorLock: released (stolen)", t, o.name);
            }
          } else
            return console.warn("@supabase/gotrue-js: Navigator LockManager returned null lock even with steal: true"), await r();
        }));
      throw Pe.debug && console.log("@supabase/gotrue-js: navigatorLock: lock was stolen by another request", t), new Xs(`Lock "${t}" was released because another request stole it`);
    }
    throw i;
  }
}
function tp() {
  if (typeof globalThis != "object")
    try {
      Object.defineProperty(Object.prototype, "__magic__", {
        get: function() {
          return this;
        },
        configurable: !0
      }), __magic__.globalThis = __magic__, delete Object.prototype.__magic__;
    } catch {
      typeof self < "u" && (self.globalThis = self);
    }
}
function po(t) {
  if (!/^0x[a-fA-F0-9]{40}$/.test(t))
    throw new Error(`@supabase/auth-js: Address "${t}" is invalid.`);
  return t.toLowerCase();
}
function rp(t) {
  return parseInt(t, 16);
}
function np(t) {
  const e = new TextEncoder().encode(t);
  return "0x" + Array.from(e, (n) => n.toString(16).padStart(2, "0")).join("");
}
function sp(t) {
  var e;
  const { chainId: r, domain: n, expirationTime: s, issuedAt: i = /* @__PURE__ */ new Date(), nonce: o, notBefore: a, requestId: c, resources: u, scheme: l, uri: h, version: f } = t;
  {
    if (!Number.isInteger(r))
      throw new Error(`@supabase/auth-js: Invalid SIWE message field "chainId". Chain ID must be a EIP-155 chain ID. Provided value: ${r}`);
    if (!n)
      throw new Error('@supabase/auth-js: Invalid SIWE message field "domain". Domain must be provided.');
    if (o && o.length < 8)
      throw new Error(`@supabase/auth-js: Invalid SIWE message field "nonce". Nonce must be at least 8 characters. Provided value: ${o}`);
    if (!h)
      throw new Error('@supabase/auth-js: Invalid SIWE message field "uri". URI must be provided.');
    if (f !== "1")
      throw new Error(`@supabase/auth-js: Invalid SIWE message field "version". Version must be '1'. Provided value: ${f}`);
    if (!((e = t.statement) === null || e === void 0) && e.includes(`
`))
      throw new Error(`@supabase/auth-js: Invalid SIWE message field "statement". Statement must not include '\\n'. Provided value: ${t.statement}`);
  }
  const d = po(t.address), g = l ? `${l}://${n}` : n, y = t.statement ? `${t.statement}
` : "", I = `${g} wants you to sign in with your Ethereum account:
${d}

${y}`;
  let k = `URI: ${h}
Version: ${f}
Chain ID: ${r}${o ? `
Nonce: ${o}` : ""}
Issued At: ${i.toISOString()}`;
  if (s && (k += `
Expiration Time: ${s.toISOString()}`), a && (k += `
Not Before: ${a.toISOString()}`), c && (k += `
Request ID: ${c}`), u) {
    let w = `
Resources:`;
    for (const S of u) {
      if (!S || typeof S != "string")
        throw new Error(`@supabase/auth-js: Invalid SIWE message field "resources". Every resource must be a valid string. Provided value: ${S}`);
      w += `
- ${S}`;
    }
    k += w;
  }
  return `${I}
${k}`;
}
class fe extends Error {
  constructor({ message: e, code: r, cause: n, name: s }) {
    var i;
    super(e, { cause: n }), this.__isWebAuthnError = !0, this.name = (i = s ?? (n instanceof Error ? n.name : void 0)) !== null && i !== void 0 ? i : "Unknown Error", this.code = r;
  }
}
class wr extends fe {
  constructor(e, r) {
    super({
      code: "ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY",
      cause: r,
      message: e
    }), this.name = "WebAuthnUnknownError", this.originalError = r;
  }
}
function ip({ error: t, options: e }) {
  var r, n, s;
  const { publicKey: i } = e;
  if (!i)
    throw Error("options was missing required publicKey property");
  if (t.name === "AbortError") {
    if (e.signal instanceof AbortSignal)
      return new fe({
        message: "Registration ceremony was sent an abort signal",
        code: "ERROR_CEREMONY_ABORTED",
        cause: t
      });
  } else if (t.name === "ConstraintError") {
    if (((r = i.authenticatorSelection) === null || r === void 0 ? void 0 : r.requireResidentKey) === !0)
      return new fe({
        message: "Discoverable credentials were required but no available authenticator supported it",
        code: "ERROR_AUTHENTICATOR_MISSING_DISCOVERABLE_CREDENTIAL_SUPPORT",
        cause: t
      });
    if (
      // @ts-ignore: `mediation` doesn't yet exist on CredentialCreationOptions but it's possible as of Sept 2024
      e.mediation === "conditional" && ((n = i.authenticatorSelection) === null || n === void 0 ? void 0 : n.userVerification) === "required"
    )
      return new fe({
        message: "User verification was required during automatic registration but it could not be performed",
        code: "ERROR_AUTO_REGISTER_USER_VERIFICATION_FAILURE",
        cause: t
      });
    if (((s = i.authenticatorSelection) === null || s === void 0 ? void 0 : s.userVerification) === "required")
      return new fe({
        message: "User verification was required but no available authenticator supported it",
        code: "ERROR_AUTHENTICATOR_MISSING_USER_VERIFICATION_SUPPORT",
        cause: t
      });
  } else {
    if (t.name === "InvalidStateError")
      return new fe({
        message: "The authenticator was previously registered",
        code: "ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED",
        cause: t
      });
    if (t.name === "NotAllowedError")
      return new fe({
        message: t.message,
        code: "ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY",
        cause: t
      });
    if (t.name === "NotSupportedError")
      return i.pubKeyCredParams.filter((a) => a.type === "public-key").length === 0 ? new fe({
        message: 'No entry in pubKeyCredParams was of type "public-key"',
        code: "ERROR_MALFORMED_PUBKEYCREDPARAMS",
        cause: t
      }) : new fe({
        message: "No available authenticator supported any of the specified pubKeyCredParams algorithms",
        code: "ERROR_AUTHENTICATOR_NO_SUPPORTED_PUBKEYCREDPARAMS_ALG",
        cause: t
      });
    if (t.name === "SecurityError") {
      const o = window.location.hostname;
      if (mo(o)) {
        if (i.rp.id !== o)
          return new fe({
            message: `The RP ID "${i.rp.id}" is invalid for this domain`,
            code: "ERROR_INVALID_RP_ID",
            cause: t
          });
      } else return new fe({
        message: `${window.location.hostname} is an invalid domain`,
        code: "ERROR_INVALID_DOMAIN",
        cause: t
      });
    } else if (t.name === "TypeError") {
      if (i.user.id.byteLength < 1 || i.user.id.byteLength > 64)
        return new fe({
          message: "User ID was not between 1 and 64 characters",
          code: "ERROR_INVALID_USER_ID_LENGTH",
          cause: t
        });
    } else if (t.name === "UnknownError")
      return new fe({
        message: "The authenticator was unable to process the specified options, or could not create a new credential",
        code: "ERROR_AUTHENTICATOR_GENERAL_ERROR",
        cause: t
      });
  }
  return new fe({
    message: "a Non-Webauthn related error has occurred",
    code: "ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY",
    cause: t
  });
}
function op({ error: t, options: e }) {
  const { publicKey: r } = e;
  if (!r)
    throw Error("options was missing required publicKey property");
  if (t.name === "AbortError") {
    if (e.signal instanceof AbortSignal)
      return new fe({
        message: "Authentication ceremony was sent an abort signal",
        code: "ERROR_CEREMONY_ABORTED",
        cause: t
      });
  } else {
    if (t.name === "NotAllowedError")
      return new fe({
        message: t.message,
        code: "ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY",
        cause: t
      });
    if (t.name === "SecurityError") {
      const n = window.location.hostname;
      if (mo(n)) {
        if (r.rpId !== n)
          return new fe({
            message: `The RP ID "${r.rpId}" is invalid for this domain`,
            code: "ERROR_INVALID_RP_ID",
            cause: t
          });
      } else return new fe({
        message: `${window.location.hostname} is an invalid domain`,
        code: "ERROR_INVALID_DOMAIN",
        cause: t
      });
    } else if (t.name === "UnknownError")
      return new fe({
        message: "The authenticator was unable to process the specified options, or could not create a new assertion signature",
        code: "ERROR_AUTHENTICATOR_GENERAL_ERROR",
        cause: t
      });
  }
  return new fe({
    message: "a Non-Webauthn related error has occurred",
    code: "ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY",
    cause: t
  });
}
class ap {
  /**
   * Create an abort signal for a new WebAuthn operation.
   * Automatically cancels any existing operation.
   *
   * @returns {AbortSignal} Signal to pass to navigator.credentials.create() or .get()
   * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal MDN - AbortSignal}
   */
  createNewAbortSignal() {
    if (this.controller) {
      const r = new Error("Cancelling existing WebAuthn API call for new one");
      r.name = "AbortError", this.controller.abort(r);
    }
    const e = new AbortController();
    return this.controller = e, e.signal;
  }
  /**
   * Manually cancel the current WebAuthn operation.
   * Useful for cleaning up when user cancels or navigates away.
   *
   * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/AbortController/abort MDN - AbortController.abort}
   */
  cancelCeremony() {
    if (this.controller) {
      const e = new Error("Manually cancelling existing WebAuthn API call");
      e.name = "AbortError", this.controller.abort(e), this.controller = void 0;
    }
  }
}
const cp = new ap();
function up(t) {
  if (!t)
    throw new Error("Credential creation options are required");
  if (typeof PublicKeyCredential < "u" && "parseCreationOptionsFromJSON" in PublicKeyCredential && typeof PublicKeyCredential.parseCreationOptionsFromJSON == "function")
    return PublicKeyCredential.parseCreationOptionsFromJSON(
      /** we assert the options here as typescript still doesn't know about future webauthn types */
      t
    );
  const { challenge: e, user: r, excludeCredentials: n } = t, s = Rr(
    t,
    ["challenge", "user", "excludeCredentials"]
  ), i = bt(e).buffer, o = Object.assign(Object.assign({}, r), { id: bt(r.id).buffer }), a = Object.assign(Object.assign({}, s), {
    challenge: i,
    user: o
  });
  if (n && n.length > 0) {
    a.excludeCredentials = new Array(n.length);
    for (let c = 0; c < n.length; c++) {
      const u = n[c];
      a.excludeCredentials[c] = Object.assign(Object.assign({}, u), {
        id: bt(u.id).buffer,
        type: u.type || "public-key",
        // Cast transports to handle future transport types like "cable"
        transports: u.transports
      });
    }
  }
  return a;
}
function lp(t) {
  if (!t)
    throw new Error("Credential request options are required");
  if (typeof PublicKeyCredential < "u" && "parseRequestOptionsFromJSON" in PublicKeyCredential && typeof PublicKeyCredential.parseRequestOptionsFromJSON == "function")
    return PublicKeyCredential.parseRequestOptionsFromJSON(t);
  const { challenge: e, allowCredentials: r } = t, n = Rr(
    t,
    ["challenge", "allowCredentials"]
  ), s = bt(e).buffer, i = Object.assign(Object.assign({}, n), { challenge: s });
  if (r && r.length > 0) {
    i.allowCredentials = new Array(r.length);
    for (let o = 0; o < r.length; o++) {
      const a = r[o];
      i.allowCredentials[o] = Object.assign(Object.assign({}, a), {
        id: bt(a.id).buffer,
        type: a.type || "public-key",
        // Cast transports to handle future transport types like "cable"
        transports: a.transports
      });
    }
  }
  return i;
}
function hp(t) {
  var e;
  if ("toJSON" in t && typeof t.toJSON == "function")
    return t.toJSON();
  const r = t;
  return {
    id: t.id,
    rawId: t.id,
    response: {
      attestationObject: st(new Uint8Array(t.response.attestationObject)),
      clientDataJSON: st(new Uint8Array(t.response.clientDataJSON))
    },
    type: "public-key",
    clientExtensionResults: t.getClientExtensionResults(),
    // Convert null to undefined and cast to AuthenticatorAttachment type
    authenticatorAttachment: (e = r.authenticatorAttachment) !== null && e !== void 0 ? e : void 0
  };
}
function dp(t) {
  var e;
  if ("toJSON" in t && typeof t.toJSON == "function")
    return t.toJSON();
  const r = t, n = t.getClientExtensionResults(), s = t.response;
  return {
    id: t.id,
    rawId: t.id,
    // W3C spec expects rawId to match id for JSON format
    response: {
      authenticatorData: st(new Uint8Array(s.authenticatorData)),
      clientDataJSON: st(new Uint8Array(s.clientDataJSON)),
      signature: st(new Uint8Array(s.signature)),
      userHandle: s.userHandle ? st(new Uint8Array(s.userHandle)) : void 0
    },
    type: "public-key",
    clientExtensionResults: n,
    // Convert null to undefined and cast to AuthenticatorAttachment type
    authenticatorAttachment: (e = r.authenticatorAttachment) !== null && e !== void 0 ? e : void 0
  };
}
function mo(t) {
  return (
    // Consider localhost valid as well since it's okay wrt Secure Contexts
    t === "localhost" || /^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$/i.test(t)
  );
}
function Ys() {
  var t, e;
  return !!(ye() && "PublicKeyCredential" in window && window.PublicKeyCredential && "credentials" in navigator && typeof ((t = navigator == null ? void 0 : navigator.credentials) === null || t === void 0 ? void 0 : t.create) == "function" && typeof ((e = navigator == null ? void 0 : navigator.credentials) === null || e === void 0 ? void 0 : e.get) == "function");
}
async function fp(t) {
  try {
    const e = await navigator.credentials.create(
      /** we assert the type here until typescript types are updated */
      t
    );
    return e ? e instanceof PublicKeyCredential ? { data: e, error: null } : {
      data: null,
      error: new wr("Browser returned unexpected credential type", e)
    } : {
      data: null,
      error: new wr("Empty credential response", e)
    };
  } catch (e) {
    return {
      data: null,
      error: ip({
        error: e,
        options: t
      })
    };
  }
}
async function pp(t) {
  try {
    const e = await navigator.credentials.get(
      /** we assert the type here until typescript types are updated */
      t
    );
    return e ? e instanceof PublicKeyCredential ? { data: e, error: null } : {
      data: null,
      error: new wr("Browser returned unexpected credential type", e)
    } : {
      data: null,
      error: new wr("Empty credential response", e)
    };
  } catch (e) {
    return {
      data: null,
      error: op({
        error: e,
        options: t
      })
    };
  }
}
const mp = {
  hints: ["security-key"],
  authenticatorSelection: {
    authenticatorAttachment: "cross-platform",
    requireResidentKey: !1,
    /** set to preferred because older yubikeys don't have PIN/Biometric */
    userVerification: "preferred",
    residentKey: "discouraged"
  },
  attestation: "direct"
}, gp = {
  /** set to preferred because older yubikeys don't have PIN/Biometric */
  userVerification: "preferred",
  hints: ["security-key"],
  attestation: "direct"
};
function br(...t) {
  const e = (s) => s !== null && typeof s == "object" && !Array.isArray(s), r = (s) => s instanceof ArrayBuffer || ArrayBuffer.isView(s), n = {};
  for (const s of t)
    if (s)
      for (const i in s) {
        const o = s[i];
        if (o !== void 0)
          if (Array.isArray(o))
            n[i] = o;
          else if (r(o))
            n[i] = o;
          else if (e(o)) {
            const a = n[i];
            e(a) ? n[i] = br(a, o) : n[i] = br(o);
          } else
            n[i] = o;
      }
  return n;
}
function _p(t, e) {
  return br(mp, t, e || {});
}
function yp(t, e) {
  return br(gp, t, e || {});
}
class Ep {
  constructor(e) {
    this.client = e, this.enroll = this._enroll.bind(this), this.challenge = this._challenge.bind(this), this.verify = this._verify.bind(this), this.authenticate = this._authenticate.bind(this), this.register = this._register.bind(this);
  }
  /**
   * Enroll a new WebAuthn factor.
   * Creates an unverified WebAuthn factor that must be verified with a credential.
   *
   * @experimental This method is experimental and may change in future releases
   * @param {Omit<MFAEnrollWebauthnParams, 'factorType'>} params - Enrollment parameters (friendlyName required)
   * @returns {Promise<AuthMFAEnrollWebauthnResponse>} Enrolled factor details or error
   * @see {@link https://w3c.github.io/webauthn/#sctn-registering-a-new-credential W3C WebAuthn Spec - Registering a New Credential}
   */
  async _enroll(e) {
    return this.client.mfa.enroll(Object.assign(Object.assign({}, e), { factorType: "webauthn" }));
  }
  /**
   * Challenge for WebAuthn credential creation or authentication.
   * Combines server challenge with browser credential operations.
   * Handles both registration (create) and authentication (request) flows.
   *
   * @experimental This method is experimental and may change in future releases
   * @param {MFAChallengeWebauthnParams & { friendlyName?: string; signal?: AbortSignal }} params - Challenge parameters including factorId
   * @param {Object} overrides - Allows you to override the parameters passed to navigator.credentials
   * @param {PublicKeyCredentialCreationOptionsFuture} overrides.create - Override options for credential creation
   * @param {PublicKeyCredentialRequestOptionsFuture} overrides.request - Override options for credential request
   * @returns {Promise<RequestResult>} Challenge response with credential or error
   * @see {@link https://w3c.github.io/webauthn/#sctn-credential-creation W3C WebAuthn Spec - Credential Creation}
   * @see {@link https://w3c.github.io/webauthn/#sctn-verifying-assertion W3C WebAuthn Spec - Verifying Assertion}
   */
  async _challenge({ factorId: e, webauthn: r, friendlyName: n, signal: s }, i) {
    var o;
    try {
      const { data: a, error: c } = await this.client.mfa.challenge({
        factorId: e,
        webauthn: r
      });
      if (!a)
        return { data: null, error: c };
      const u = s ?? cp.createNewAbortSignal();
      if (a.webauthn.type === "create") {
        const { user: l } = a.webauthn.credential_options.publicKey;
        if (!l.name) {
          const h = n;
          if (h)
            l.name = `${l.id}:${h}`;
          else {
            const d = (await this.client.getUser()).data.user, g = ((o = d == null ? void 0 : d.user_metadata) === null || o === void 0 ? void 0 : o.name) || (d == null ? void 0 : d.email) || (d == null ? void 0 : d.id) || "User";
            l.name = `${l.id}:${g}`;
          }
        }
        l.displayName || (l.displayName = l.name);
      }
      switch (a.webauthn.type) {
        case "create": {
          const l = _p(a.webauthn.credential_options.publicKey, i == null ? void 0 : i.create), { data: h, error: f } = await fp({
            publicKey: l,
            signal: u
          });
          return h ? {
            data: {
              factorId: e,
              challengeId: a.id,
              webauthn: {
                type: a.webauthn.type,
                credential_response: h
              }
            },
            error: null
          } : { data: null, error: f };
        }
        case "request": {
          const l = yp(a.webauthn.credential_options.publicKey, i == null ? void 0 : i.request), { data: h, error: f } = await pp(Object.assign(Object.assign({}, a.webauthn.credential_options), { publicKey: l, signal: u }));
          return h ? {
            data: {
              factorId: e,
              challengeId: a.id,
              webauthn: {
                type: a.webauthn.type,
                credential_response: h
              }
            },
            error: null
          } : { data: null, error: f };
        }
      }
    } catch (a) {
      return U(a) ? { data: null, error: a } : {
        data: null,
        error: new rt("Unexpected error in challenge", a)
      };
    }
  }
  /**
   * Verify a WebAuthn credential with the server.
   * Completes the WebAuthn ceremony by sending the credential to the server for verification.
   *
   * @experimental This method is experimental and may change in future releases
   * @param {Object} params - Verification parameters
   * @param {string} params.challengeId - ID of the challenge being verified
   * @param {string} params.factorId - ID of the WebAuthn factor
   * @param {MFAVerifyWebauthnParams<T>['webauthn']} params.webauthn - WebAuthn credential response
   * @returns {Promise<AuthMFAVerifyResponse>} Verification result with session or error
   * @see {@link https://w3c.github.io/webauthn/#sctn-verifying-assertion W3C WebAuthn Spec - Verifying an Authentication Assertion}
   * */
  async _verify({ challengeId: e, factorId: r, webauthn: n }) {
    return this.client.mfa.verify({
      factorId: r,
      challengeId: e,
      webauthn: n
    });
  }
  /**
   * Complete WebAuthn authentication flow.
   * Performs challenge and verification in a single operation for existing credentials.
   *
   * @experimental This method is experimental and may change in future releases
   * @param {Object} params - Authentication parameters
   * @param {string} params.factorId - ID of the WebAuthn factor to authenticate with
   * @param {Object} params.webauthn - WebAuthn configuration
   * @param {string} params.webauthn.rpId - Relying Party ID (defaults to current hostname)
   * @param {string[]} params.webauthn.rpOrigins - Allowed origins (defaults to current origin)
   * @param {AbortSignal} params.webauthn.signal - Optional abort signal
   * @param {PublicKeyCredentialRequestOptionsFuture} overrides - Override options for navigator.credentials.get
   * @returns {Promise<RequestResult<AuthMFAVerifyResponseData, WebAuthnError | AuthError>>} Authentication result
   * @see {@link https://w3c.github.io/webauthn/#sctn-authentication W3C WebAuthn Spec - Authentication Ceremony}
   * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/PublicKeyCredentialRequestOptions MDN - PublicKeyCredentialRequestOptions}
   */
  async _authenticate({ factorId: e, webauthn: { rpId: r = typeof window < "u" ? window.location.hostname : void 0, rpOrigins: n = typeof window < "u" ? [window.location.origin] : void 0, signal: s } = {} }, i) {
    if (!r)
      return {
        data: null,
        error: new Mt("rpId is required for WebAuthn authentication")
      };
    try {
      if (!Ys())
        return {
          data: null,
          error: new rt("Browser does not support WebAuthn", null)
        };
      const { data: o, error: a } = await this.challenge({
        factorId: e,
        webauthn: { rpId: r, rpOrigins: n },
        signal: s
      }, { request: i });
      if (!o)
        return { data: null, error: a };
      const { webauthn: c } = o;
      return this._verify({
        factorId: e,
        challengeId: o.challengeId,
        webauthn: {
          type: c.type,
          rpId: r,
          rpOrigins: n,
          credential_response: c.credential_response
        }
      });
    } catch (o) {
      return U(o) ? { data: null, error: o } : {
        data: null,
        error: new rt("Unexpected error in authenticate", o)
      };
    }
  }
  /**
   * Complete WebAuthn registration flow.
   * Performs enrollment, challenge, and verification in a single operation for new credentials.
   *
   * @experimental This method is experimental and may change in future releases
   * @param {Object} params - Registration parameters
   * @param {string} params.friendlyName - User-friendly name for the credential
   * @param {string} params.rpId - Relying Party ID (defaults to current hostname)
   * @param {string[]} params.rpOrigins - Allowed origins (defaults to current origin)
   * @param {AbortSignal} params.signal - Optional abort signal
   * @param {PublicKeyCredentialCreationOptionsFuture} overrides - Override options for navigator.credentials.create
   * @returns {Promise<RequestResult<AuthMFAVerifyResponseData, WebAuthnError | AuthError>>} Registration result
   * @see {@link https://w3c.github.io/webauthn/#sctn-registering-a-new-credential W3C WebAuthn Spec - Registration Ceremony}
   * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/PublicKeyCredentialCreationOptions MDN - PublicKeyCredentialCreationOptions}
   */
  async _register({ friendlyName: e, webauthn: { rpId: r = typeof window < "u" ? window.location.hostname : void 0, rpOrigins: n = typeof window < "u" ? [window.location.origin] : void 0, signal: s } = {} }, i) {
    if (!r)
      return {
        data: null,
        error: new Mt("rpId is required for WebAuthn registration")
      };
    try {
      if (!Ys())
        return {
          data: null,
          error: new rt("Browser does not support WebAuthn", null)
        };
      const { data: o, error: a } = await this._enroll({
        friendlyName: e
      });
      if (!o)
        return await this.client.mfa.listFactors().then((l) => {
          var h;
          return (h = l.data) === null || h === void 0 ? void 0 : h.all.find((f) => f.factor_type === "webauthn" && f.friendly_name === e && f.status !== "unverified");
        }).then((l) => l ? this.client.mfa.unenroll({ factorId: l == null ? void 0 : l.id }) : void 0), { data: null, error: a };
      const { data: c, error: u } = await this._challenge({
        factorId: o.id,
        friendlyName: o.friendly_name,
        webauthn: { rpId: r, rpOrigins: n },
        signal: s
      }, {
        create: i
      });
      return c ? this._verify({
        factorId: o.id,
        challengeId: c.challengeId,
        webauthn: {
          rpId: r,
          rpOrigins: n,
          type: c.webauthn.type,
          credential_response: c.webauthn.credential_response
        }
      }) : { data: null, error: u };
    } catch (o) {
      return U(o) ? { data: null, error: o } : {
        data: null,
        error: new rt("Unexpected error in register", o)
      };
    }
  }
}
tp();
const vp = {
  url: _f,
  storageKey: yf,
  autoRefreshToken: !0,
  persistSession: !0,
  detectSessionInUrl: !0,
  headers: Ef,
  flowType: "implicit",
  debug: !1,
  hasCustomAuthorizationHeader: !1,
  throwOnError: !1,
  lockAcquireTimeout: 5e3,
  // 5 seconds
  skipAutoInitialize: !1
};
async function Qs(t, e, r) {
  return await r();
}
const ft = {};
class Zt {
  /**
   * The JWKS used for verifying asymmetric JWTs
   */
  get jwks() {
    var e, r;
    return (r = (e = ft[this.storageKey]) === null || e === void 0 ? void 0 : e.jwks) !== null && r !== void 0 ? r : { keys: [] };
  }
  set jwks(e) {
    ft[this.storageKey] = Object.assign(Object.assign({}, ft[this.storageKey]), { jwks: e });
  }
  get jwks_cached_at() {
    var e, r;
    return (r = (e = ft[this.storageKey]) === null || e === void 0 ? void 0 : e.cachedAt) !== null && r !== void 0 ? r : Number.MIN_SAFE_INTEGER;
  }
  set jwks_cached_at(e) {
    ft[this.storageKey] = Object.assign(Object.assign({}, ft[this.storageKey]), { cachedAt: e });
  }
  /**
   * Create a new client for use in the browser.
   *
   * @example Using supabase-js (recommended)
   * ```ts
   * import { createClient } from '@supabase/supabase-js'
   *
   * const supabase = createClient('https://xyzcompany.supabase.co', 'publishable-or-anon-key')
   * const { data, error } = await supabase.auth.getUser()
   * ```
   *
   * @example Standalone import for bundle-sensitive environments
   * ```ts
   * import { GoTrueClient } from '@supabase/auth-js'
   *
   * const auth = new GoTrueClient({
   *   url: 'https://xyzcompany.supabase.co/auth/v1',
   *   headers: { apikey: 'publishable-or-anon-key' },
   *   storageKey: 'supabase-auth',
   * })
   * ```
   */
  constructor(e) {
    var r, n, s;
    this.userStorage = null, this.memoryStorage = null, this.stateChangeEmitters = /* @__PURE__ */ new Map(), this.autoRefreshTicker = null, this.autoRefreshTickTimeout = null, this.visibilityChangedCallback = null, this.refreshingDeferred = null, this.initializePromise = null, this.detectSessionInUrl = !0, this.hasCustomAuthorizationHeader = !1, this.suppressGetSessionWarning = !1, this.lockAcquired = !1, this.pendingInLock = [], this.broadcastChannel = null, this.logger = console.log;
    const i = Object.assign(Object.assign({}, vp), e);
    if (this.storageKey = i.storageKey, this.instanceID = (r = Zt.nextInstanceID[this.storageKey]) !== null && r !== void 0 ? r : 0, Zt.nextInstanceID[this.storageKey] = this.instanceID + 1, this.logDebugMessages = !!i.debug, typeof i.debug == "function" && (this.logger = i.debug), this.instanceID > 0 && ye()) {
      const o = `${this._logPrefix()} Multiple GoTrueClient instances detected in the same browser context. It is not an error, but this should be avoided as it may produce undefined behavior when used concurrently under the same storage key.`;
      console.warn(o), this.logDebugMessages && console.trace(o);
    }
    if (this.persistSession = i.persistSession, this.autoRefreshToken = i.autoRefreshToken, this.admin = new Qf({
      url: i.url,
      headers: i.headers,
      fetch: i.fetch
    }), this.url = i.url, this.headers = i.headers, this.fetch = ho(i.fetch), this.lock = i.lock || Qs, this.detectSessionInUrl = i.detectSessionInUrl, this.flowType = i.flowType, this.hasCustomAuthorizationHeader = i.hasCustomAuthorizationHeader, this.throwOnError = i.throwOnError, this.lockAcquireTimeout = i.lockAcquireTimeout, i.lock ? this.lock = i.lock : this.persistSession && ye() && (!((n = globalThis == null ? void 0 : globalThis.navigator) === null || n === void 0) && n.locks) ? this.lock = ep : this.lock = Qs, this.jwks || (this.jwks = { keys: [] }, this.jwks_cached_at = Number.MIN_SAFE_INTEGER), this.mfa = {
      verify: this._verify.bind(this),
      enroll: this._enroll.bind(this),
      unenroll: this._unenroll.bind(this),
      challenge: this._challenge.bind(this),
      listFactors: this._listFactors.bind(this),
      challengeAndVerify: this._challengeAndVerify.bind(this),
      getAuthenticatorAssuranceLevel: this._getAuthenticatorAssuranceLevel.bind(this),
      webauthn: new Ep(this)
    }, this.oauth = {
      getAuthorizationDetails: this._getAuthorizationDetails.bind(this),
      approveAuthorization: this._approveAuthorization.bind(this),
      denyAuthorization: this._denyAuthorization.bind(this),
      listGrants: this._listOAuthGrants.bind(this),
      revokeGrant: this._revokeOAuthGrant.bind(this)
    }, this.persistSession ? (i.storage ? this.storage = i.storage : lo() ? this.storage = globalThis.localStorage : (this.memoryStorage = {}, this.storage = Js(this.memoryStorage)), i.userStorage && (this.userStorage = i.userStorage)) : (this.memoryStorage = {}, this.storage = Js(this.memoryStorage)), ye() && globalThis.BroadcastChannel && this.persistSession && this.storageKey) {
      try {
        this.broadcastChannel = new globalThis.BroadcastChannel(this.storageKey);
      } catch (o) {
        console.error("Failed to create a new BroadcastChannel, multi-tab state changes will not be available", o);
      }
      (s = this.broadcastChannel) === null || s === void 0 || s.addEventListener("message", async (o) => {
        this._debug("received broadcast notification from other tab or client", o);
        try {
          await this._notifyAllSubscribers(o.data.event, o.data.session, !1);
        } catch (a) {
          this._debug("#broadcastChannel", "error", a);
        }
      });
    }
    i.skipAutoInitialize || this.initialize().catch((o) => {
      this._debug("#initialize()", "error", o);
    });
  }
  /**
   * Returns whether error throwing mode is enabled for this client.
   */
  isThrowOnErrorEnabled() {
    return this.throwOnError;
  }
  /**
   * Centralizes return handling with optional error throwing. When `throwOnError` is enabled
   * and the provided result contains a non-nullish error, the error is thrown instead of
   * being returned. This ensures consistent behavior across all public API methods.
   */
  _returnResult(e) {
    if (this.throwOnError && e && e.error)
      throw e.error;
    return e;
  }
  _logPrefix() {
    return `GoTrueClient@${this.storageKey}:${this.instanceID} (${ao}) ${(/* @__PURE__ */ new Date()).toISOString()}`;
  }
  _debug(...e) {
    return this.logDebugMessages && this.logger(this._logPrefix(), ...e), this;
  }
  /**
   * Initializes the client session either from the url or from storage.
   * This method is automatically called when instantiating the client, but should also be called
   * manually when checking for an error from an auth redirect (oauth, magiclink, password recovery, etc).
   *
   * @category Auth
   */
  async initialize() {
    return this.initializePromise ? await this.initializePromise : (this.initializePromise = (async () => await this._acquireLock(this.lockAcquireTimeout, async () => await this._initialize()))(), await this.initializePromise);
  }
  /**
   * IMPORTANT:
   * 1. Never throw in this method, as it is called from the constructor
   * 2. Never return a session from this method as it would be cached over
   *    the whole lifetime of the client
   */
  async _initialize() {
    var e;
    try {
      let r = {}, n = "none";
      if (ye() && (r = Pf(window.location.href), this._isImplicitGrantCallback(r) ? n = "implicit" : await this._isPKCECallback(r) && (n = "pkce")), ye() && this.detectSessionInUrl && n !== "none") {
        const { data: s, error: i } = await this._getSessionFromURL(r, n);
        if (i) {
          if (this._debug("#_initialize()", "error detecting session from URL", i), Sf(i)) {
            const c = (e = i.details) === null || e === void 0 ? void 0 : e.code;
            if (c === "identity_already_exists" || c === "identity_not_found" || c === "single_identity_not_deletable")
              return { error: i };
          }
          return { error: i };
        }
        const { session: o, redirectType: a } = s;
        return this._debug("#_initialize()", "detected session in URL", o, "redirect type", a), await this._saveSession(o), setTimeout(async () => {
          a === "recovery" ? await this._notifyAllSubscribers("PASSWORD_RECOVERY", o) : await this._notifyAllSubscribers("SIGNED_IN", o);
        }, 0), { error: null };
      }
      return await this._recoverAndRefresh(), { error: null };
    } catch (r) {
      return U(r) ? this._returnResult({ error: r }) : this._returnResult({
        error: new rt("Unexpected error during initialization", r)
      });
    } finally {
      await this._handleVisibilityChange(), this._debug("#_initialize()", "end");
    }
  }
  /**
   * Creates a new anonymous user.
   *
   * @returns A session where the is_anonymous claim in the access token JWT set to true
   *
   * @category Auth
   *
   * @remarks
   * - Returns an anonymous user
   * - It is recommended to set up captcha for anonymous sign-ins to prevent abuse. You can pass in the captcha token in the `options` param.
   *
   * @example Create an anonymous user
   * ```js
   * const { data, error } = await supabase.auth.signInAnonymously({
   *   options: {
   *     captchaToken
   *   }
   * });
   * ```
   *
   * @exampleResponse Create an anonymous user
   * ```json
   * {
   *   "data": {
   *     "user": {
   *       "id": "11111111-1111-1111-1111-111111111111",
   *       "aud": "authenticated",
   *       "role": "authenticated",
   *       "email": "",
   *       "phone": "",
   *       "last_sign_in_at": "2024-01-01T00:00:00Z",
   *       "app_metadata": {},
   *       "user_metadata": {},
   *       "identities": [],
   *       "created_at": "2024-01-01T00:00:00Z",
   *       "updated_at": "2024-01-01T00:00:00Z",
   *       "is_anonymous": true
   *     },
   *     "session": {
   *       "access_token": "<ACCESS_TOKEN>",
   *       "token_type": "bearer",
   *       "expires_in": 3600,
   *       "expires_at": 1700000000,
   *       "refresh_token": "<REFRESH_TOKEN>",
   *       "user": {
   *         "id": "11111111-1111-1111-1111-111111111111",
   *         "aud": "authenticated",
   *         "role": "authenticated",
   *         "email": "",
   *         "phone": "",
   *         "last_sign_in_at": "2024-01-01T00:00:00Z",
   *         "app_metadata": {},
   *         "user_metadata": {},
   *         "identities": [],
   *         "created_at": "2024-01-01T00:00:00Z",
   *         "updated_at": "2024-01-01T00:00:00Z",
   *         "is_anonymous": true
   *       }
   *     }
   *   },
   *   "error": null
   * }
   * ```
   *
   * @example Create an anonymous user with custom user metadata
   * ```js
   * const { data, error } = await supabase.auth.signInAnonymously({
   *   options: {
   *     data
   *   }
   * })
   * ```
   */
  async signInAnonymously(e) {
    var r, n, s;
    try {
      const i = await x(this.fetch, "POST", `${this.url}/signup`, {
        headers: this.headers,
        body: {
          data: (n = (r = e == null ? void 0 : e.options) === null || r === void 0 ? void 0 : r.data) !== null && n !== void 0 ? n : {},
          gotrue_meta_security: { captcha_token: (s = e == null ? void 0 : e.options) === null || s === void 0 ? void 0 : s.captchaToken }
        },
        xform: Le
      }), { data: o, error: a } = i;
      if (a || !o)
        return this._returnResult({ data: { user: null, session: null }, error: a });
      const c = o.session, u = o.user;
      return o.session && (await this._saveSession(o.session), await this._notifyAllSubscribers("SIGNED_IN", c)), this._returnResult({ data: { user: u, session: c }, error: null });
    } catch (i) {
      if (U(i))
        return this._returnResult({ data: { user: null, session: null }, error: i });
      throw i;
    }
  }
  /**
   * Creates a new user.
   *
   * Be aware that if a user account exists in the system you may get back an
   * error message that attempts to hide this information from the user.
   * This method has support for PKCE via email signups. The PKCE flow cannot be used when autoconfirm is enabled.
   *
   * @returns A logged-in session if the server has "autoconfirm" ON
   * @returns A user if the server has "autoconfirm" OFF
   *
   * @category Auth
   *
   * @remarks
   * - By default, the user needs to verify their email address before logging in. To turn this off, disable **Confirm email** in [your project](/dashboard/project/_/auth/providers).
   * - **Confirm email** determines if users need to confirm their email address after signing up.
   *   - If **Confirm email** is enabled, a `user` is returned but `session` is null.
   *   - If **Confirm email** is disabled, both a `user` and a `session` are returned.
   * - When the user confirms their email address, they are redirected to the [`SITE_URL`](/docs/guides/auth/redirect-urls#use-wildcards-in-redirect-urls) by default. You can modify your `SITE_URL` or add additional redirect URLs in [your project](/dashboard/project/_/auth/url-configuration).
   * - If signUp() is called for an existing confirmed user:
   *   - When both **Confirm email** and **Confirm phone** (even when phone provider is disabled) are enabled in [your project](/dashboard/project/_/auth/providers), an obfuscated/fake user object is returned.
   *   - When either **Confirm email** or **Confirm phone** (even when phone provider is disabled) is disabled, the error message, `User already registered` is returned.
   * - To fetch the currently logged-in user, refer to [`getUser()`](/docs/reference/javascript/auth-getuser).
   *
   * @example Sign up with an email and password
   * ```js
   * const { data, error } = await supabase.auth.signUp({
   *   email: 'example@email.com',
   *   password: 'example-password',
   * })
   * ```
   *
   * @exampleResponse Sign up with an email and password
   * ```json
   * // Some fields may be null if "confirm email" is enabled.
   * {
   *   "data": {
   *     "user": {
   *       "id": "11111111-1111-1111-1111-111111111111",
   *       "aud": "authenticated",
   *       "role": "authenticated",
   *       "email": "example@email.com",
   *       "email_confirmed_at": "2024-01-01T00:00:00Z",
   *       "phone": "",
   *       "last_sign_in_at": "2024-01-01T00:00:00Z",
   *       "app_metadata": {
   *         "provider": "email",
   *         "providers": [
   *           "email"
   *         ]
   *       },
   *       "user_metadata": {},
   *       "identities": [
   *         {
   *           "identity_id": "22222222-2222-2222-2222-222222222222",
   *           "id": "11111111-1111-1111-1111-111111111111",
   *           "user_id": "11111111-1111-1111-1111-111111111111",
   *           "identity_data": {
   *             "email": "example@email.com",
   *             "email_verified": false,
   *             "phone_verified": false,
   *             "sub": "11111111-1111-1111-1111-111111111111"
   *           },
   *           "provider": "email",
   *           "last_sign_in_at": "2024-01-01T00:00:00Z",
   *           "created_at": "2024-01-01T00:00:00Z",
   *           "updated_at": "2024-01-01T00:00:00Z",
   *           "email": "example@email.com"
   *         }
   *       ],
   *       "created_at": "2024-01-01T00:00:00Z",
   *       "updated_at": "2024-01-01T00:00:00Z"
   *     },
   *     "session": {
   *       "access_token": "<ACCESS_TOKEN>",
   *       "token_type": "bearer",
   *       "expires_in": 3600,
   *       "expires_at": 1700000000,
   *       "refresh_token": "<REFRESH_TOKEN>",
   *       "user": {
   *         "id": "11111111-1111-1111-1111-111111111111",
   *         "aud": "authenticated",
   *         "role": "authenticated",
   *         "email": "example@email.com",
   *         "email_confirmed_at": "2024-01-01T00:00:00Z",
   *         "phone": "",
   *         "last_sign_in_at": "2024-01-01T00:00:00Z",
   *         "app_metadata": {
   *           "provider": "email",
   *           "providers": [
   *             "email"
   *           ]
   *         },
   *         "user_metadata": {},
   *         "identities": [
   *           {
   *             "identity_id": "22222222-2222-2222-2222-222222222222",
   *             "id": "11111111-1111-1111-1111-111111111111",
   *             "user_id": "11111111-1111-1111-1111-111111111111",
   *             "identity_data": {
   *               "email": "example@email.com",
   *               "email_verified": false,
   *               "phone_verified": false,
   *               "sub": "11111111-1111-1111-1111-111111111111"
   *             },
   *             "provider": "email",
   *             "last_sign_in_at": "2024-01-01T00:00:00Z",
   *             "created_at": "2024-01-01T00:00:00Z",
   *             "updated_at": "2024-01-01T00:00:00Z",
   *             "email": "example@email.com"
   *           }
   *         ],
   *         "created_at": "2024-01-01T00:00:00Z",
   *         "updated_at": "2024-01-01T00:00:00Z"
   *       }
   *     }
   *   },
   *   "error": null
   * }
   * ```
   *
   * @example Sign up with a phone number and password (SMS)
   * ```js
   * const { data, error } = await supabase.auth.signUp({
   *   phone: '123456789',
   *   password: 'example-password',
   *   options: {
   *     channel: 'sms'
   *   }
   * })
   * ```
   *
   * @exampleDescription Sign up with a phone number and password (whatsapp)
   * The user will be sent a WhatsApp message which contains a OTP. By default, a given user can only request a OTP once every 60 seconds. Note that a user will need to have a valid WhatsApp account that is linked to Twilio in order to use this feature.
   *
   * @example Sign up with a phone number and password (whatsapp)
   * ```js
   * const { data, error } = await supabase.auth.signUp({
   *   phone: '123456789',
   *   password: 'example-password',
   *   options: {
   *     channel: 'whatsapp'
   *   }
   * })
   * ```
   *
   * @example Sign up with additional user metadata
   * ```js
   * const { data, error } = await supabase.auth.signUp(
   *   {
   *     email: 'example@email.com',
   *     password: 'example-password',
   *     options: {
   *       data: {
   *         first_name: 'John',
   *         age: 27,
   *       }
   *     }
   *   }
   * )
   * ```
   *
   * @exampleDescription Sign up with a redirect URL
   * - See [redirect URLs and wildcards](/docs/guides/auth/redirect-urls#use-wildcards-in-redirect-urls) to add additional redirect URLs to your project.
   *
   * @example Sign up with a redirect URL
   * ```js
   * const { data, error } = await supabase.auth.signUp(
   *   {
   *     email: 'example@email.com',
   *     password: 'example-password',
   *     options: {
   *       emailRedirectTo: 'https://example.com/welcome'
   *     }
   *   }
   * )
   * ```
   */
  async signUp(e) {
    var r, n, s;
    try {
      let i;
      if ("email" in e) {
        const { email: l, password: h, options: f } = e;
        let d = null, g = null;
        this.flowType === "pkce" && ([d, g] = await ht(this.storage, this.storageKey)), i = await x(this.fetch, "POST", `${this.url}/signup`, {
          headers: this.headers,
          redirectTo: f == null ? void 0 : f.emailRedirectTo,
          body: {
            email: l,
            password: h,
            data: (r = f == null ? void 0 : f.data) !== null && r !== void 0 ? r : {},
            gotrue_meta_security: { captcha_token: f == null ? void 0 : f.captchaToken },
            code_challenge: d,
            code_challenge_method: g
          },
          xform: Le
        });
      } else if ("phone" in e) {
        const { phone: l, password: h, options: f } = e;
        i = await x(this.fetch, "POST", `${this.url}/signup`, {
          headers: this.headers,
          body: {
            phone: l,
            password: h,
            data: (n = f == null ? void 0 : f.data) !== null && n !== void 0 ? n : {},
            channel: (s = f == null ? void 0 : f.channel) !== null && s !== void 0 ? s : "sms",
            gotrue_meta_security: { captcha_token: f == null ? void 0 : f.captchaToken }
          },
          xform: Le
        });
      } else
        throw new sr("You must provide either an email or phone number and a password");
      const { data: o, error: a } = i;
      if (a || !o)
        return await _e(this.storage, `${this.storageKey}-code-verifier`), this._returnResult({ data: { user: null, session: null }, error: a });
      const c = o.session, u = o.user;
      return o.session && (await this._saveSession(o.session), await this._notifyAllSubscribers("SIGNED_IN", c)), this._returnResult({ data: { user: u, session: c }, error: null });
    } catch (i) {
      if (await _e(this.storage, `${this.storageKey}-code-verifier`), U(i))
        return this._returnResult({ data: { user: null, session: null }, error: i });
      throw i;
    }
  }
  /**
   * Log in an existing user with an email and password or phone and password.
   *
   * Be aware that you may get back an error message that will not distinguish
   * between the cases where the account does not exist or that the
   * email/phone and password combination is wrong or that the account can only
   * be accessed via social login.
   *
   * @category Auth
   *
   * @remarks
   * - Requires either an email and password or a phone number and password.
   *
   * @example Sign in with email and password
   * ```js
   * const { data, error } = await supabase.auth.signInWithPassword({
   *   email: 'example@email.com',
   *   password: 'example-password',
   * })
   * ```
   *
   * @exampleResponse Sign in with email and password
   * ```json
   * {
   *   "data": {
   *     "user": {
   *       "id": "11111111-1111-1111-1111-111111111111",
   *       "aud": "authenticated",
   *       "role": "authenticated",
   *       "email": "example@email.com",
   *       "email_confirmed_at": "2024-01-01T00:00:00Z",
   *       "phone": "",
   *       "last_sign_in_at": "2024-01-01T00:00:00Z",
   *       "app_metadata": {
   *         "provider": "email",
   *         "providers": [
   *           "email"
   *         ]
   *       },
   *       "user_metadata": {},
   *       "identities": [
   *         {
   *           "identity_id": "22222222-2222-2222-2222-222222222222",
   *           "id": "11111111-1111-1111-1111-111111111111",
   *           "user_id": "11111111-1111-1111-1111-111111111111",
   *           "identity_data": {
   *             "email": "example@email.com",
   *             "email_verified": false,
   *             "phone_verified": false,
   *             "sub": "11111111-1111-1111-1111-111111111111"
   *           },
   *           "provider": "email",
   *           "last_sign_in_at": "2024-01-01T00:00:00Z",
   *           "created_at": "2024-01-01T00:00:00Z",
   *           "updated_at": "2024-01-01T00:00:00Z",
   *           "email": "example@email.com"
   *         }
   *       ],
   *       "created_at": "2024-01-01T00:00:00Z",
   *       "updated_at": "2024-01-01T00:00:00Z"
   *     },
   *     "session": {
   *       "access_token": "<ACCESS_TOKEN>",
   *       "token_type": "bearer",
   *       "expires_in": 3600,
   *       "expires_at": 1700000000,
   *       "refresh_token": "<REFRESH_TOKEN>",
   *       "user": {
   *         "id": "11111111-1111-1111-1111-111111111111",
   *         "aud": "authenticated",
   *         "role": "authenticated",
   *         "email": "example@email.com",
   *         "email_confirmed_at": "2024-01-01T00:00:00Z",
   *         "phone": "",
   *         "last_sign_in_at": "2024-01-01T00:00:00Z",
   *         "app_metadata": {
   *           "provider": "email",
   *           "providers": [
   *             "email"
   *           ]
   *         },
   *         "user_metadata": {},
   *         "identities": [
   *           {
   *             "identity_id": "22222222-2222-2222-2222-222222222222",
   *             "id": "11111111-1111-1111-1111-111111111111",
   *             "user_id": "11111111-1111-1111-1111-111111111111",
   *             "identity_data": {
   *               "email": "example@email.com",
   *               "email_verified": false,
   *               "phone_verified": false,
   *               "sub": "11111111-1111-1111-1111-111111111111"
   *             },
   *             "provider": "email",
   *             "last_sign_in_at": "2024-01-01T00:00:00Z",
   *             "created_at": "2024-01-01T00:00:00Z",
   *             "updated_at": "2024-01-01T00:00:00Z",
   *             "email": "example@email.com"
   *           }
   *         ],
   *         "created_at": "2024-01-01T00:00:00Z",
   *         "updated_at": "2024-01-01T00:00:00Z"
   *       }
   *     }
   *   },
   *   "error": null
   * }
   * ```
   *
   * @example Sign in with phone and password
   * ```js
   * const { data, error } = await supabase.auth.signInWithPassword({
   *   phone: '+13334445555',
   *   password: 'some-password',
   * })
   * ```
   */
  async signInWithPassword(e) {
    try {
      let r;
      if ("email" in e) {
        const { email: i, password: o, options: a } = e;
        r = await x(this.fetch, "POST", `${this.url}/token?grant_type=password`, {
          headers: this.headers,
          body: {
            email: i,
            password: o,
            gotrue_meta_security: { captcha_token: a == null ? void 0 : a.captchaToken }
          },
          xform: Vs
        });
      } else if ("phone" in e) {
        const { phone: i, password: o, options: a } = e;
        r = await x(this.fetch, "POST", `${this.url}/token?grant_type=password`, {
          headers: this.headers,
          body: {
            phone: i,
            password: o,
            gotrue_meta_security: { captcha_token: a == null ? void 0 : a.captchaToken }
          },
          xform: Vs
        });
      } else
        throw new sr("You must provide either an email or phone number and a password");
      const { data: n, error: s } = r;
      if (s)
        return this._returnResult({ data: { user: null, session: null }, error: s });
      if (!n || !n.session || !n.user) {
        const i = new lt();
        return this._returnResult({ data: { user: null, session: null }, error: i });
      }
      return n.session && (await this._saveSession(n.session), await this._notifyAllSubscribers("SIGNED_IN", n.session)), this._returnResult({
        data: Object.assign({ user: n.user, session: n.session }, n.weak_password ? { weakPassword: n.weak_password } : null),
        error: s
      });
    } catch (r) {
      if (U(r))
        return this._returnResult({ data: { user: null, session: null }, error: r });
      throw r;
    }
  }
  /**
   * Log in an existing user via a third-party provider.
   * This method supports the PKCE flow.
   *
   * @category Auth
   *
   * @remarks
   * - This method is used for signing in using [Social Login (OAuth) providers](/docs/guides/auth#configure-third-party-providers).
   * - It works by redirecting your application to the provider's authorization screen, before bringing back the user to your app.
   *
   * @example Sign in using a third-party provider
   * ```js
   * const { data, error } = await supabase.auth.signInWithOAuth({
   *   provider: 'github'
   * })
   * ```
   *
   * @exampleResponse Sign in using a third-party provider
   * ```json
   * {
   *   data: {
   *     provider: 'github',
   *     url: <PROVIDER_URL_TO_REDIRECT_TO>
   *   },
   *   error: null
   * }
   * ```
   *
   * @exampleDescription Sign in using a third-party provider with redirect
   * - When the OAuth provider successfully authenticates the user, they are redirected to the URL specified in the `redirectTo` parameter. This parameter defaults to the [`SITE_URL`](/docs/guides/auth/redirect-urls#use-wildcards-in-redirect-urls). It does not redirect the user immediately after invoking this method.
   * - See [redirect URLs and wildcards](/docs/guides/auth/redirect-urls#use-wildcards-in-redirect-urls) to add additional redirect URLs to your project.
   *
   * @example Sign in using a third-party provider with redirect
   * ```js
   * const { data, error } = await supabase.auth.signInWithOAuth({
   *   provider: 'github',
   *   options: {
   *     redirectTo: 'https://example.com/welcome'
   *   }
   * })
   * ```
   *
   * @exampleDescription Sign in with scopes and access provider tokens
   * If you need additional access from an OAuth provider, in order to access provider specific APIs in the name of the user, you can do this by passing in the scopes the user should authorize for your application. Note that the `scopes` option takes in **a space-separated list** of scopes.
   *
   * Because OAuth sign-in often includes redirects, you should register an `onAuthStateChange` callback immediately after you create the Supabase client. This callback will listen for the presence of `provider_token` and `provider_refresh_token` properties on the `session` object and store them in local storage. The client library will emit these values **only once** immediately after the user signs in. You can then access them by looking them up in local storage, or send them to your backend servers for further processing.
   *
   * Finally, make sure you remove them from local storage on the `SIGNED_OUT` event. If the OAuth provider supports token revocation, make sure you call those APIs either from the frontend or schedule them to be called on the backend.
   *
   * @example Sign in with scopes and access provider tokens
   * ```js
   * // Register this immediately after calling createClient!
   * // Because signInWithOAuth causes a redirect, you need to fetch the
   * // provider tokens from the callback.
   * supabase.auth.onAuthStateChange((event, session) => {
   *   if (session && session.provider_token) {
   *     window.localStorage.setItem('oauth_provider_token', session.provider_token)
   *   }
   *
   *   if (session && session.provider_refresh_token) {
   *     window.localStorage.setItem('oauth_provider_refresh_token', session.provider_refresh_token)
   *   }
   *
   *   if (event === 'SIGNED_OUT') {
   *     window.localStorage.removeItem('oauth_provider_token')
   *     window.localStorage.removeItem('oauth_provider_refresh_token')
   *   }
   * })
   *
   * // Call this on your Sign in with GitHub button to initiate OAuth
   * // with GitHub with the requested elevated scopes.
   * await supabase.auth.signInWithOAuth({
   *   provider: 'github',
   *   options: {
   *     scopes: 'repo gist notifications'
   *   }
   * })
   * ```
   */
  async signInWithOAuth(e) {
    var r, n, s, i;
    return await this._handleProviderSignIn(e.provider, {
      redirectTo: (r = e.options) === null || r === void 0 ? void 0 : r.redirectTo,
      scopes: (n = e.options) === null || n === void 0 ? void 0 : n.scopes,
      queryParams: (s = e.options) === null || s === void 0 ? void 0 : s.queryParams,
      skipBrowserRedirect: (i = e.options) === null || i === void 0 ? void 0 : i.skipBrowserRedirect
    });
  }
  /**
   * Log in an existing user by exchanging an Auth Code issued during the PKCE flow.
   *
   * @category Auth
   *
   * @remarks
   * - Used when `flowType` is set to `pkce` in client options.
   *
   * @example Exchange Auth Code
   * ```js
   * supabase.auth.exchangeCodeForSession('34e770dd-9ff9-416c-87fa-43b31d7ef225')
   * ```
   *
   * @exampleResponse Exchange Auth Code
   * ```json
   * {
   *   "data": {
   *     session: {
   *       access_token: '<ACCESS_TOKEN>',
   *       token_type: 'bearer',
   *       expires_in: 3600,
   *       expires_at: 1700000000,
   *       refresh_token: '<REFRESH_TOKEN>',
   *       user: {
   *         id: '11111111-1111-1111-1111-111111111111',
   *         aud: 'authenticated',
   *         role: 'authenticated',
   *         email: 'example@email.com'
   *         email_confirmed_at: '2024-01-01T00:00:00Z',
   *         phone: '',
   *         confirmation_sent_at: '2024-01-01T00:00:00Z',
   *         confirmed_at: '2024-01-01T00:00:00Z',
   *         last_sign_in_at: '2024-01-01T00:00:00Z',
   *         app_metadata: {
   *           "provider": "email",
   *           "providers": [
   *             "email",
   *             "<OTHER_PROVIDER>"
   *           ]
   *         },
   *         user_metadata: {
   *           email: 'email@email.com',
   *           email_verified: true,
   *           full_name: 'User Name',
   *           iss: '<ISS>',
   *           name: 'User Name',
   *           phone_verified: false,
   *           provider_id: '<PROVIDER_ID>',
   *           sub: '<SUB>'
   *         },
   *         identities: [
   *           {
   *             "identity_id": "22222222-2222-2222-2222-222222222222",
   *             "id": "11111111-1111-1111-1111-111111111111",
   *             "user_id": "11111111-1111-1111-1111-111111111111",
   *             "identity_data": {
   *               "email": "example@email.com",
   *               "email_verified": false,
   *               "phone_verified": false,
   *               "sub": "11111111-1111-1111-1111-111111111111"
   *             },
   *             "provider": "email",
   *             "last_sign_in_at": "2024-01-01T00:00:00Z",
   *             "created_at": "2024-01-01T00:00:00Z",
   *             "updated_at": "2024-01-01T00:00:00Z",
   *             "email": "email@example.com"
   *           },
   *           {
   *             "identity_id": "33333333-3333-3333-3333-333333333333",
   *             "id": "<ID>",
   *             "user_id": "<USER_ID>",
   *             "identity_data": {
   *               "email": "example@email.com",
   *               "email_verified": true,
   *               "full_name": "User Name",
   *               "iss": "<ISS>",
   *               "name": "User Name",
   *               "phone_verified": false,
   *               "provider_id": "<PROVIDER_ID>",
   *               "sub": "<SUB>"
   *             },
   *             "provider": "<PROVIDER>",
   *             "last_sign_in_at": "2024-01-01T00:00:00Z",
   *             "created_at": "2024-01-01T00:00:00Z",
   *             "updated_at": "2024-01-01T00:00:00Z",
   *             "email": "example@email.com"
   *           }
   *         ],
   *         created_at: '2024-01-01T00:00:00Z',
   *         updated_at: '2024-01-01T00:00:00Z',
   *         is_anonymous: false
   *       },
   *       provider_token: '<PROVIDER_TOKEN>',
   *       provider_refresh_token: '<PROVIDER_REFRESH_TOKEN>'
   *     },
   *     user: {
   *       id: '11111111-1111-1111-1111-111111111111',
   *       aud: 'authenticated',
   *       role: 'authenticated',
   *       email: 'example@email.com',
   *       email_confirmed_at: '2024-01-01T00:00:00Z',
   *       phone: '',
   *       confirmation_sent_at: '2024-01-01T00:00:00Z',
   *       confirmed_at: '2024-01-01T00:00:00Z',
   *       last_sign_in_at: '2024-01-01T00:00:00Z',
   *       app_metadata: {
   *         provider: 'email',
   *         providers: [
   *           "email",
   *           "<OTHER_PROVIDER>"
   *         ]
   *       },
   *       user_metadata: {
   *         email: 'email@email.com',
   *         email_verified: true,
   *         full_name: 'User Name',
   *         iss: '<ISS>',
   *         name: 'User Name',
   *         phone_verified: false,
   *         provider_id: '<PROVIDER_ID>',
   *         sub: '<SUB>'
   *       },
   *       identities: [
   *         {
   *           "identity_id": "22222222-2222-2222-2222-222222222222",
   *           "id": "11111111-1111-1111-1111-111111111111",
   *           "user_id": "11111111-1111-1111-1111-111111111111",
   *           "identity_data": {
   *             "email": "example@email.com",
   *             "email_verified": false,
   *             "phone_verified": false,
   *             "sub": "11111111-1111-1111-1111-111111111111"
   *           },
   *           "provider": "email",
   *           "last_sign_in_at": "2024-01-01T00:00:00Z",
   *           "created_at": "2024-01-01T00:00:00Z",
   *           "updated_at": "2024-01-01T00:00:00Z",
   *           "email": "email@example.com"
   *         },
   *         {
   *           "identity_id": "33333333-3333-3333-3333-333333333333",
   *           "id": "<ID>",
   *           "user_id": "<USER_ID>",
   *           "identity_data": {
   *             "email": "example@email.com",
   *             "email_verified": true,
   *             "full_name": "User Name",
   *             "iss": "<ISS>",
   *             "name": "User Name",
   *             "phone_verified": false,
   *             "provider_id": "<PROVIDER_ID>",
   *             "sub": "<SUB>"
   *           },
   *           "provider": "<PROVIDER>",
   *           "last_sign_in_at": "2024-01-01T00:00:00Z",
   *           "created_at": "2024-01-01T00:00:00Z",
   *           "updated_at": "2024-01-01T00:00:00Z",
   *           "email": "example@email.com"
   *         }
   *       ],
   *       created_at: '2024-01-01T00:00:00Z',
   *       updated_at: '2024-01-01T00:00:00Z',
   *       is_anonymous: false
   *     },
   *     redirectType: null
   *   },
   *   "error": null
   * }
   * ```
   */
  async exchangeCodeForSession(e) {
    return await this.initializePromise, this._acquireLock(this.lockAcquireTimeout, async () => this._exchangeCodeForSession(e));
  }
  /**
   * Signs in a user by verifying a message signed by the user's private key.
   * Supports Ethereum (via Sign-In-With-Ethereum) & Solana (Sign-In-With-Solana) standards,
   * both of which derive from the EIP-4361 standard
   * With slight variation on Solana's side.
   * @reference https://eips.ethereum.org/EIPS/eip-4361
   *
   * @category Auth
   *
   * @remarks
   * - Uses a Web3 (Ethereum, Solana) wallet to sign a user in.
   * - Read up on the [potential for abuse](/docs/guides/auth/auth-web3#potential-for-abuse) before using it.
   *
   * @example Sign in with Solana or Ethereum (Window API)
   * ```js
   *   // uses window.ethereum for the wallet
   *   const { data, error } = await supabase.auth.signInWithWeb3({
   *     chain: 'ethereum',
   *     statement: 'I accept the Terms of Service at https://example.com/tos'
   *   })
   *
   *   // uses window.solana for the wallet
   *   const { data, error } = await supabase.auth.signInWithWeb3({
   *     chain: 'solana',
   *     statement: 'I accept the Terms of Service at https://example.com/tos'
   *   })
   * ```
   *
   * @example Sign in with Ethereum (Message and Signature)
   * ```js
   *   const { data, error } = await supabase.auth.signInWithWeb3({
   *     chain: 'ethereum',
   *     message: '<sign in with ethereum message>',
   *     signature: '<hex of the ethereum signature over the message>',
   *   })
   * ```
   *
   * @example Sign in with Solana (Brave)
   * ```js
   *   const { data, error } = await supabase.auth.signInWithWeb3({
   *     chain: 'solana',
   *     statement: 'I accept the Terms of Service at https://example.com/tos',
   *     wallet: window.braveSolana
   *   })
   * ```
   *
   * @example Sign in with Solana (Wallet Adapter)
   * ```jsx
   *   function SignInButton() {
   *   const wallet = useWallet()
   *
   *   return (
   *     <>
   *       {wallet.connected ? (
   *         <button
   *           onClick={() => {
   *             supabase.auth.signInWithWeb3({
   *               chain: 'solana',
   *               statement: 'I accept the Terms of Service at https://example.com/tos',
   *               wallet,
   *             })
   *           }}
   *         >
   *           Sign in with Solana
   *         </button>
   *       ) : (
   *         <WalletMultiButton />
   *       )}
   *     </>
   *   )
   * }
   *
   * function App() {
   *   const endpoint = clusterApiUrl('devnet')
   *   const wallets = useMemo(() => [], [])
   *
   *   return (
   *     <ConnectionProvider endpoint={endpoint}>
   *       <WalletProvider wallets={wallets}>
   *         <WalletModalProvider>
   *           <SignInButton />
   *         </WalletModalProvider>
   *       </WalletProvider>
   *     </ConnectionProvider>
   *   )
   * }
   * ```
   */
  async signInWithWeb3(e) {
    const { chain: r } = e;
    switch (r) {
      case "ethereum":
        return await this.signInWithEthereum(e);
      case "solana":
        return await this.signInWithSolana(e);
      default:
        throw new Error(`@supabase/auth-js: Unsupported chain "${r}"`);
    }
  }
  async signInWithEthereum(e) {
    var r, n, s, i, o, a, c, u, l, h, f;
    let d, g;
    if ("message" in e)
      d = e.message, g = e.signature;
    else {
      const { chain: y, wallet: I, statement: k, options: w } = e;
      let S;
      if (ye())
        if (typeof I == "object")
          S = I;
        else {
          const O = window;
          if ("ethereum" in O && typeof O.ethereum == "object" && "request" in O.ethereum && typeof O.ethereum.request == "function")
            S = O.ethereum;
          else
            throw new Error("@supabase/auth-js: No compatible Ethereum wallet interface on the window object (window.ethereum) detected. Make sure the user already has a wallet installed and connected for this app. Prefer passing the wallet interface object directly to signInWithWeb3({ chain: 'ethereum', wallet: resolvedUserWallet }) instead.");
        }
      else {
        if (typeof I != "object" || !(w != null && w.url))
          throw new Error("@supabase/auth-js: Both wallet and url must be specified in non-browser environments.");
        S = I;
      }
      const m = new URL((r = w == null ? void 0 : w.url) !== null && r !== void 0 ? r : window.location.href), p = await S.request({
        method: "eth_requestAccounts"
      }).then((O) => O).catch(() => {
        throw new Error("@supabase/auth-js: Wallet method eth_requestAccounts is missing or invalid");
      });
      if (!p || p.length === 0)
        throw new Error("@supabase/auth-js: No accounts available. Please ensure the wallet is connected.");
      const E = po(p[0]);
      let _ = (n = w == null ? void 0 : w.signInWithEthereum) === null || n === void 0 ? void 0 : n.chainId;
      if (!_) {
        const O = await S.request({
          method: "eth_chainId"
        });
        _ = rp(O);
      }
      const b = {
        domain: m.host,
        address: E,
        statement: k,
        uri: m.href,
        version: "1",
        chainId: _,
        nonce: (s = w == null ? void 0 : w.signInWithEthereum) === null || s === void 0 ? void 0 : s.nonce,
        issuedAt: (o = (i = w == null ? void 0 : w.signInWithEthereum) === null || i === void 0 ? void 0 : i.issuedAt) !== null && o !== void 0 ? o : /* @__PURE__ */ new Date(),
        expirationTime: (a = w == null ? void 0 : w.signInWithEthereum) === null || a === void 0 ? void 0 : a.expirationTime,
        notBefore: (c = w == null ? void 0 : w.signInWithEthereum) === null || c === void 0 ? void 0 : c.notBefore,
        requestId: (u = w == null ? void 0 : w.signInWithEthereum) === null || u === void 0 ? void 0 : u.requestId,
        resources: (l = w == null ? void 0 : w.signInWithEthereum) === null || l === void 0 ? void 0 : l.resources
      };
      d = sp(b), g = await S.request({
        method: "personal_sign",
        params: [np(d), E]
      });
    }
    try {
      const { data: y, error: I } = await x(this.fetch, "POST", `${this.url}/token?grant_type=web3`, {
        headers: this.headers,
        body: Object.assign({
          chain: "ethereum",
          message: d,
          signature: g
        }, !((h = e.options) === null || h === void 0) && h.captchaToken ? { gotrue_meta_security: { captcha_token: (f = e.options) === null || f === void 0 ? void 0 : f.captchaToken } } : null),
        xform: Le
      });
      if (I)
        throw I;
      if (!y || !y.session || !y.user) {
        const k = new lt();
        return this._returnResult({ data: { user: null, session: null }, error: k });
      }
      return y.session && (await this._saveSession(y.session), await this._notifyAllSubscribers("SIGNED_IN", y.session)), this._returnResult({ data: Object.assign({}, y), error: I });
    } catch (y) {
      if (U(y))
        return this._returnResult({ data: { user: null, session: null }, error: y });
      throw y;
    }
  }
  async signInWithSolana(e) {
    var r, n, s, i, o, a, c, u, l, h, f, d;
    let g, y;
    if ("message" in e)
      g = e.message, y = e.signature;
    else {
      const { chain: I, wallet: k, statement: w, options: S } = e;
      let m;
      if (ye())
        if (typeof k == "object")
          m = k;
        else {
          const E = window;
          if ("solana" in E && typeof E.solana == "object" && ("signIn" in E.solana && typeof E.solana.signIn == "function" || "signMessage" in E.solana && typeof E.solana.signMessage == "function"))
            m = E.solana;
          else
            throw new Error("@supabase/auth-js: No compatible Solana wallet interface on the window object (window.solana) detected. Make sure the user already has a wallet installed and connected for this app. Prefer passing the wallet interface object directly to signInWithWeb3({ chain: 'solana', wallet: resolvedUserWallet }) instead.");
        }
      else {
        if (typeof k != "object" || !(S != null && S.url))
          throw new Error("@supabase/auth-js: Both wallet and url must be specified in non-browser environments.");
        m = k;
      }
      const p = new URL((r = S == null ? void 0 : S.url) !== null && r !== void 0 ? r : window.location.href);
      if ("signIn" in m && m.signIn) {
        const E = await m.signIn(Object.assign(Object.assign(Object.assign({ issuedAt: (/* @__PURE__ */ new Date()).toISOString() }, S == null ? void 0 : S.signInWithSolana), {
          // non-overridable properties
          version: "1",
          domain: p.host,
          uri: p.href
        }), w ? { statement: w } : null));
        let _;
        if (Array.isArray(E) && E[0] && typeof E[0] == "object")
          _ = E[0];
        else if (E && typeof E == "object" && "signedMessage" in E && "signature" in E)
          _ = E;
        else
          throw new Error("@supabase/auth-js: Wallet method signIn() returned unrecognized value");
        if ("signedMessage" in _ && "signature" in _ && (typeof _.signedMessage == "string" || _.signedMessage instanceof Uint8Array) && _.signature instanceof Uint8Array)
          g = typeof _.signedMessage == "string" ? _.signedMessage : new TextDecoder().decode(_.signedMessage), y = _.signature;
        else
          throw new Error("@supabase/auth-js: Wallet method signIn() API returned object without signedMessage and signature fields");
      } else {
        if (!("signMessage" in m) || typeof m.signMessage != "function" || !("publicKey" in m) || typeof m != "object" || !m.publicKey || !("toBase58" in m.publicKey) || typeof m.publicKey.toBase58 != "function")
          throw new Error("@supabase/auth-js: Wallet does not have a compatible signMessage() and publicKey.toBase58() API");
        g = [
          `${p.host} wants you to sign in with your Solana account:`,
          m.publicKey.toBase58(),
          ...w ? ["", w, ""] : [""],
          "Version: 1",
          `URI: ${p.href}`,
          `Issued At: ${(s = (n = S == null ? void 0 : S.signInWithSolana) === null || n === void 0 ? void 0 : n.issuedAt) !== null && s !== void 0 ? s : (/* @__PURE__ */ new Date()).toISOString()}`,
          ...!((i = S == null ? void 0 : S.signInWithSolana) === null || i === void 0) && i.notBefore ? [`Not Before: ${S.signInWithSolana.notBefore}`] : [],
          ...!((o = S == null ? void 0 : S.signInWithSolana) === null || o === void 0) && o.expirationTime ? [`Expiration Time: ${S.signInWithSolana.expirationTime}`] : [],
          ...!((a = S == null ? void 0 : S.signInWithSolana) === null || a === void 0) && a.chainId ? [`Chain ID: ${S.signInWithSolana.chainId}`] : [],
          ...!((c = S == null ? void 0 : S.signInWithSolana) === null || c === void 0) && c.nonce ? [`Nonce: ${S.signInWithSolana.nonce}`] : [],
          ...!((u = S == null ? void 0 : S.signInWithSolana) === null || u === void 0) && u.requestId ? [`Request ID: ${S.signInWithSolana.requestId}`] : [],
          ...!((h = (l = S == null ? void 0 : S.signInWithSolana) === null || l === void 0 ? void 0 : l.resources) === null || h === void 0) && h.length ? [
            "Resources",
            ...S.signInWithSolana.resources.map((_) => `- ${_}`)
          ] : []
        ].join(`
`);
        const E = await m.signMessage(new TextEncoder().encode(g), "utf8");
        if (!E || !(E instanceof Uint8Array))
          throw new Error("@supabase/auth-js: Wallet signMessage() API returned an recognized value");
        y = E;
      }
    }
    try {
      const { data: I, error: k } = await x(this.fetch, "POST", `${this.url}/token?grant_type=web3`, {
        headers: this.headers,
        body: Object.assign({ chain: "solana", message: g, signature: st(y) }, !((f = e.options) === null || f === void 0) && f.captchaToken ? { gotrue_meta_security: { captcha_token: (d = e.options) === null || d === void 0 ? void 0 : d.captchaToken } } : null),
        xform: Le
      });
      if (k)
        throw k;
      if (!I || !I.session || !I.user) {
        const w = new lt();
        return this._returnResult({ data: { user: null, session: null }, error: w });
      }
      return I.session && (await this._saveSession(I.session), await this._notifyAllSubscribers("SIGNED_IN", I.session)), this._returnResult({ data: Object.assign({}, I), error: k });
    } catch (I) {
      if (U(I))
        return this._returnResult({ data: { user: null, session: null }, error: I });
      throw I;
    }
  }
  async _exchangeCodeForSession(e) {
    const r = await Ye(this.storage, `${this.storageKey}-code-verifier`), [n, s] = (r ?? "").split("/");
    try {
      if (!n && this.flowType === "pkce")
        throw new Of();
      const { data: i, error: o } = await x(this.fetch, "POST", `${this.url}/token?grant_type=pkce`, {
        headers: this.headers,
        body: {
          auth_code: e,
          code_verifier: n
        },
        xform: Le
      });
      if (await _e(this.storage, `${this.storageKey}-code-verifier`), o)
        throw o;
      if (!i || !i.session || !i.user) {
        const a = new lt();
        return this._returnResult({
          data: { user: null, session: null, redirectType: null },
          error: a
        });
      }
      return i.session && (await this._saveSession(i.session), await this._notifyAllSubscribers(s === "recovery" ? "PASSWORD_RECOVERY" : "SIGNED_IN", i.session)), this._returnResult({ data: Object.assign(Object.assign({}, i), { redirectType: s ?? null }), error: o });
    } catch (i) {
      if (await _e(this.storage, `${this.storageKey}-code-verifier`), U(i))
        return this._returnResult({
          data: { user: null, session: null, redirectType: null },
          error: i
        });
      throw i;
    }
  }
  /**
   * Allows signing in with an OIDC ID token. The authentication provider used
   * should be enabled and configured.
   *
   * @category Auth
   *
   * @remarks
   * - Use an ID token to sign in.
   * - Especially useful when implementing sign in using native platform dialogs in mobile or desktop apps using Sign in with Apple or Sign in with Google on iOS and Android.
   * - You can also use Google's [One Tap](https://developers.google.com/identity/gsi/web/guides/display-google-one-tap) and [Automatic sign-in](https://developers.google.com/identity/gsi/web/guides/automatic-sign-in-sign-out) via this API.
   *
   * @example Sign In using ID Token
   * ```js
   * const { data, error } = await supabase.auth.signInWithIdToken({
   *   provider: 'google',
   *   token: 'your-id-token'
   * })
   * ```
   *
   * @exampleResponse Sign In using ID Token
   * ```json
   * {
   *   "data": {
   *     "user": {
   *       "id": "11111111-1111-1111-1111-111111111111",
   *       "aud": "authenticated",
   *       "role": "authenticated",
   *       "last_sign_in_at": "2024-01-01T00:00:00Z",
   *       "app_metadata": {
   *         ...
   *       },
   *       "user_metadata": {
   *         ...
   *       },
   *       "identities": [
   *         {
   *           "identity_id": "22222222-2222-2222-2222-222222222222",
   *           "provider": "google",
   *         }
   *       ],
   *       "created_at": "2024-01-01T00:00:00Z",
   *       "updated_at": "2024-01-01T00:00:00Z",
   *     },
   *     "session": {
   *       "access_token": "<ACCESS_TOKEN>",
   *       "token_type": "bearer",
   *       "expires_in": 3600,
   *       "expires_at": 1700000000,
   *       "refresh_token": "<REFRESH_TOKEN>",
   *       "user": {
   *         "id": "11111111-1111-1111-1111-111111111111",
   *         "aud": "authenticated",
   *         "role": "authenticated",
   *         "last_sign_in_at": "2024-01-01T00:00:00Z",
   *         "app_metadata": {
   *           ...
   *         },
   *         "user_metadata": {
   *           ...
   *         },
   *         "identities": [
   *           {
   *             "identity_id": "22222222-2222-2222-2222-222222222222",
   *             "provider": "google",
   *           }
   *         ],
   *         "created_at": "2024-01-01T00:00:00Z",
   *         "updated_at": "2024-01-01T00:00:00Z",
   *       }
   *     }
   *   },
   *   "error": null
   * }
   * ```
   */
  async signInWithIdToken(e) {
    try {
      const { options: r, provider: n, token: s, access_token: i, nonce: o } = e, a = await x(this.fetch, "POST", `${this.url}/token?grant_type=id_token`, {
        headers: this.headers,
        body: {
          provider: n,
          id_token: s,
          access_token: i,
          nonce: o,
          gotrue_meta_security: { captcha_token: r == null ? void 0 : r.captchaToken }
        },
        xform: Le
      }), { data: c, error: u } = a;
      if (u)
        return this._returnResult({ data: { user: null, session: null }, error: u });
      if (!c || !c.session || !c.user) {
        const l = new lt();
        return this._returnResult({ data: { user: null, session: null }, error: l });
      }
      return c.session && (await this._saveSession(c.session), await this._notifyAllSubscribers("SIGNED_IN", c.session)), this._returnResult({ data: c, error: u });
    } catch (r) {
      if (U(r))
        return this._returnResult({ data: { user: null, session: null }, error: r });
      throw r;
    }
  }
  /**
   * Log in a user using magiclink or a one-time password (OTP).
   *
   * If the `{{ .ConfirmationURL }}` variable is specified in the email template, a magiclink will be sent.
   * If the `{{ .Token }}` variable is specified in the email template, an OTP will be sent.
   * If you're using phone sign-ins, only an OTP will be sent. You won't be able to send a magiclink for phone sign-ins.
   *
   * Be aware that you may get back an error message that will not distinguish
   * between the cases where the account does not exist or, that the account
   * can only be accessed via social login.
   *
   * Do note that you will need to configure a Whatsapp sender on Twilio
   * if you are using phone sign in with the 'whatsapp' channel. The whatsapp
   * channel is not supported on other providers
   * at this time.
   * This method supports PKCE when an email is passed.
   *
   * @category Auth
   *
   * @remarks
   * - Requires either an email or phone number.
   * - This method is used for passwordless sign-ins where a OTP is sent to the user's email or phone number.
   * - If the user doesn't exist, `signInWithOtp()` will signup the user instead. To restrict this behavior, you can set `shouldCreateUser` in `SignInWithPasswordlessCredentials.options` to `false`.
   * - If you're using an email, you can configure whether you want the user to receive a magiclink or a OTP.
   * - If you're using phone, you can configure whether you want the user to receive a OTP.
   * - The magic link's destination URL is determined by the [`SITE_URL`](/docs/guides/auth/redirect-urls#use-wildcards-in-redirect-urls).
   * - See [redirect URLs and wildcards](/docs/guides/auth/redirect-urls#use-wildcards-in-redirect-urls) to add additional redirect URLs to your project.
   * - Magic links and OTPs share the same implementation. To send users a one-time code instead of a magic link, [modify the magic link email template](/dashboard/project/_/auth/templates) to include `{{ .Token }}` instead of `{{ .ConfirmationURL }}`.
   * - See our [Twilio Phone Auth Guide](/docs/guides/auth/phone-login?showSMSProvider=Twilio) for details about configuring WhatsApp sign in.
   *
   * @exampleDescription Sign in with email
   * The user will be sent an email which contains either a magiclink or a OTP or both. By default, a given user can only request a OTP once every 60 seconds.
   *
   * @example Sign in with email
   * ```js
   * const { data, error } = await supabase.auth.signInWithOtp({
   *   email: 'example@email.com',
   *   options: {
   *     emailRedirectTo: 'https://example.com/welcome'
   *   }
   * })
   * ```
   *
   * @exampleResponse Sign in with email
   * ```json
   * {
   *   "data": {
   *     "user": null,
   *     "session": null
   *   },
   *   "error": null
   * }
   * ```
   *
   * @exampleDescription Sign in with SMS OTP
   * The user will be sent a SMS which contains a OTP. By default, a given user can only request a OTP once every 60 seconds.
   *
   * @example Sign in with SMS OTP
   * ```js
   * const { data, error } = await supabase.auth.signInWithOtp({
   *   phone: '+13334445555',
   * })
   * ```
   *
   * @exampleDescription Sign in with WhatsApp OTP
   * The user will be sent a WhatsApp message which contains a OTP. By default, a given user can only request a OTP once every 60 seconds. Note that a user will need to have a valid WhatsApp account that is linked to Twilio in order to use this feature.
   *
   * @example Sign in with WhatsApp OTP
   * ```js
   * const { data, error } = await supabase.auth.signInWithOtp({
   *   phone: '+13334445555',
   *   options: {
   *     channel:'whatsapp',
   *   }
   * })
   * ```
   */
  async signInWithOtp(e) {
    var r, n, s, i, o;
    try {
      if ("email" in e) {
        const { email: a, options: c } = e;
        let u = null, l = null;
        this.flowType === "pkce" && ([u, l] = await ht(this.storage, this.storageKey));
        const { error: h } = await x(this.fetch, "POST", `${this.url}/otp`, {
          headers: this.headers,
          body: {
            email: a,
            data: (r = c == null ? void 0 : c.data) !== null && r !== void 0 ? r : {},
            create_user: (n = c == null ? void 0 : c.shouldCreateUser) !== null && n !== void 0 ? n : !0,
            gotrue_meta_security: { captcha_token: c == null ? void 0 : c.captchaToken },
            code_challenge: u,
            code_challenge_method: l
          },
          redirectTo: c == null ? void 0 : c.emailRedirectTo
        });
        return this._returnResult({ data: { user: null, session: null }, error: h });
      }
      if ("phone" in e) {
        const { phone: a, options: c } = e, { data: u, error: l } = await x(this.fetch, "POST", `${this.url}/otp`, {
          headers: this.headers,
          body: {
            phone: a,
            data: (s = c == null ? void 0 : c.data) !== null && s !== void 0 ? s : {},
            create_user: (i = c == null ? void 0 : c.shouldCreateUser) !== null && i !== void 0 ? i : !0,
            gotrue_meta_security: { captcha_token: c == null ? void 0 : c.captchaToken },
            channel: (o = c == null ? void 0 : c.channel) !== null && o !== void 0 ? o : "sms"
          }
        });
        return this._returnResult({
          data: { user: null, session: null, messageId: u == null ? void 0 : u.message_id },
          error: l
        });
      }
      throw new sr("You must provide either an email or phone number.");
    } catch (a) {
      if (await _e(this.storage, `${this.storageKey}-code-verifier`), U(a))
        return this._returnResult({ data: { user: null, session: null }, error: a });
      throw a;
    }
  }
  /**
   * Log in a user given a User supplied OTP or TokenHash received through mobile or email.
   *
   * @category Auth
   *
   * @remarks
   * - The `verifyOtp` method takes in different verification types.
   * - If a phone number is used, the type can either be:
   *   1. `sms` – Used when verifying a one-time password (OTP) sent via SMS during sign-up or sign-in.
   *   2. `phone_change` – Used when verifying an OTP sent to a new phone number during a phone number update process.
   * - If an email address is used, the type can be one of the following (note: `signup` and `magiclink` types are deprecated):
   *   1. `email` – Used when verifying an OTP sent to the user's email during sign-up or sign-in.
   *   2. `recovery` – Used when verifying an OTP sent for account recovery, typically after a password reset request.
   *   3. `invite` – Used when verifying an OTP sent as part of an invitation to join a project or organization.
   *   4. `email_change` – Used when verifying an OTP sent to a new email address during an email update process.
   * - The verification type used should be determined based on the corresponding auth method called before `verifyOtp` to sign up / sign-in a user.
   * - The `TokenHash` is contained in the [email templates](/docs/guides/auth/auth-email-templates) and can be used to sign in.  You may wish to use the hash for the PKCE flow for Server Side Auth. Read [the Password-based Auth guide](/docs/guides/auth/passwords) for more details.
   *
   * @example Verify Signup One-Time Password (OTP)
   * ```js
   * const { data, error } = await supabase.auth.verifyOtp({ email, token, type: 'email'})
   * ```
   *
   * @exampleResponse Verify Signup One-Time Password (OTP)
   * ```json
   * {
   *   "data": {
   *     "user": {
   *       "id": "11111111-1111-1111-1111-111111111111",
   *       "aud": "authenticated",
   *       "role": "authenticated",
   *       "email": "example@email.com",
   *       "email_confirmed_at": "2024-01-01T00:00:00Z",
   *       "phone": "",
   *       "confirmed_at": "2024-01-01T00:00:00Z",
   *       "recovery_sent_at": "2024-01-01T00:00:00Z",
   *       "last_sign_in_at": "2024-01-01T00:00:00Z",
   *       "app_metadata": {
   *         "provider": "email",
   *         "providers": [
   *           "email"
   *         ]
   *       },
   *       "user_metadata": {
   *         "email": "example@email.com",
   *         "email_verified": false,
   *         "phone_verified": false,
   *         "sub": "11111111-1111-1111-1111-111111111111"
   *       },
   *       "identities": [
   *         {
   *           "identity_id": "22222222-2222-2222-2222-222222222222",
   *           "id": "11111111-1111-1111-1111-111111111111",
   *           "user_id": "11111111-1111-1111-1111-111111111111",
   *           "identity_data": {
   *             "email": "example@email.com",
   *             "email_verified": false,
   *             "phone_verified": false,
   *             "sub": "11111111-1111-1111-1111-111111111111"
   *           },
   *           "provider": "email",
   *           "last_sign_in_at": "2024-01-01T00:00:00Z",
   *           "created_at": "2024-01-01T00:00:00Z",
   *           "updated_at": "2024-01-01T00:00:00Z",
   *           "email": "example@email.com"
   *         }
   *       ],
   *       "created_at": "2024-01-01T00:00:00Z",
   *       "updated_at": "2024-01-01T00:00:00Z",
   *       "is_anonymous": false
   *     },
   *     "session": {
   *       "access_token": "<ACCESS_TOKEN>",
   *       "token_type": "bearer",
   *       "expires_in": 3600,
   *       "expires_at": 1700000000,
   *       "refresh_token": "<REFRESH_TOKEN>",
   *       "user": {
   *         "id": "11111111-1111-1111-1111-111111111111",
   *         "aud": "authenticated",
   *         "role": "authenticated",
   *         "email": "example@email.com",
   *         "email_confirmed_at": "2024-01-01T00:00:00Z",
   *         "phone": "",
   *         "confirmed_at": "2024-01-01T00:00:00Z",
   *         "recovery_sent_at": "2024-01-01T00:00:00Z",
   *         "last_sign_in_at": "2024-01-01T00:00:00Z",
   *         "app_metadata": {
   *           "provider": "email",
   *           "providers": [
   *             "email"
   *           ]
   *         },
   *         "user_metadata": {
   *           "email": "example@email.com",
   *           "email_verified": false,
   *           "phone_verified": false,
   *           "sub": "11111111-1111-1111-1111-111111111111"
   *         },
   *         "identities": [
   *           {
   *             "identity_id": "22222222-2222-2222-2222-222222222222",
   *             "id": "11111111-1111-1111-1111-111111111111",
   *             "user_id": "11111111-1111-1111-1111-111111111111",
   *             "identity_data": {
   *               "email": "example@email.com",
   *               "email_verified": false,
   *               "phone_verified": false,
   *               "sub": "11111111-1111-1111-1111-111111111111"
   *             },
   *             "provider": "email",
   *             "last_sign_in_at": "2024-01-01T00:00:00Z",
   *             "created_at": "2024-01-01T00:00:00Z",
   *             "updated_at": "2024-01-01T00:00:00Z",
   *             "email": "example@email.com"
   *           }
   *         ],
   *         "created_at": "2024-01-01T00:00:00Z",
   *         "updated_at": "2024-01-01T00:00:00Z",
   *         "is_anonymous": false
   *       }
   *     }
   *   },
   *   "error": null
   * }
   * ```
   *
   * @example Verify SMS One-Time Password (OTP)
   * ```js
   * const { data, error } = await supabase.auth.verifyOtp({ phone, token, type: 'sms'})
   * ```
   *
   * @example Verify Email Auth (Token Hash)
   * ```js
   * const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'email'})
   * ```
   */
  async verifyOtp(e) {
    var r, n;
    try {
      let s, i;
      "options" in e && (s = (r = e.options) === null || r === void 0 ? void 0 : r.redirectTo, i = (n = e.options) === null || n === void 0 ? void 0 : n.captchaToken);
      const { data: o, error: a } = await x(this.fetch, "POST", `${this.url}/verify`, {
        headers: this.headers,
        body: Object.assign(Object.assign({}, e), { gotrue_meta_security: { captcha_token: i } }),
        redirectTo: s,
        xform: Le
      });
      if (a)
        throw a;
      if (!o)
        throw new Error("An error occurred on token verification.");
      const c = o.session, u = o.user;
      return c != null && c.access_token && (await this._saveSession(c), await this._notifyAllSubscribers(e.type == "recovery" ? "PASSWORD_RECOVERY" : "SIGNED_IN", c)), this._returnResult({ data: { user: u, session: c }, error: null });
    } catch (s) {
      if (U(s))
        return this._returnResult({ data: { user: null, session: null }, error: s });
      throw s;
    }
  }
  /**
   * Attempts a single-sign on using an enterprise Identity Provider. A
   * successful SSO attempt will redirect the current page to the identity
   * provider authorization page. The redirect URL is implementation and SSO
   * protocol specific.
   *
   * You can use it by providing a SSO domain. Typically you can extract this
   * domain by asking users for their email address. If this domain is
   * registered on the Auth instance the redirect will use that organization's
   * currently active SSO Identity Provider for the login.
   *
   * If you have built an organization-specific login page, you can use the
   * organization's SSO Identity Provider UUID directly instead.
   *
   * @category Auth
   *
   * @remarks
   * - Before you can call this method you need to [establish a connection](/docs/guides/auth/sso/auth-sso-saml#managing-saml-20-connections) to an identity provider. Use the [CLI commands](/docs/reference/cli/supabase-sso) to do this.
   * - If you've associated an email domain to the identity provider, you can use the `domain` property to start a sign-in flow.
   * - In case you need to use a different way to start the authentication flow with an identity provider, you can use the `providerId` property. For example:
   *     - Mapping specific user email addresses with an identity provider.
   *     - Using different hints to identity the identity provider to be used by the user, like a company-specific page, IP address or other tracking information.
   *
   * @example Sign in with email domain
   * ```js
   *   // You can extract the user's email domain and use it to trigger the
   *   // authentication flow with the correct identity provider.
   *
   *   const { data, error } = await supabase.auth.signInWithSSO({
   *     domain: 'company.com'
   *   })
   *
   *   if (data?.url) {
   *     // redirect the user to the identity provider's authentication flow
   *     window.location.href = data.url
   *   }
   * ```
   *
   * @example Sign in with provider UUID
   * ```js
   *   // Useful when you need to map a user's sign in request according
   *   // to different rules that can't use email domains.
   *
   *   const { data, error } = await supabase.auth.signInWithSSO({
   *     providerId: '21648a9d-8d5a-4555-a9d1-d6375dc14e92'
   *   })
   *
   *   if (data?.url) {
   *     // redirect the user to the identity provider's authentication flow
   *     window.location.href = data.url
   *   }
   * ```
   */
  async signInWithSSO(e) {
    var r, n, s, i, o;
    try {
      let a = null, c = null;
      this.flowType === "pkce" && ([a, c] = await ht(this.storage, this.storageKey));
      const u = await x(this.fetch, "POST", `${this.url}/sso`, {
        body: Object.assign(Object.assign(Object.assign(Object.assign(Object.assign({}, "providerId" in e ? { provider_id: e.providerId } : null), "domain" in e ? { domain: e.domain } : null), { redirect_to: (n = (r = e.options) === null || r === void 0 ? void 0 : r.redirectTo) !== null && n !== void 0 ? n : void 0 }), !((s = e == null ? void 0 : e.options) === null || s === void 0) && s.captchaToken ? { gotrue_meta_security: { captcha_token: e.options.captchaToken } } : null), { skip_http_redirect: !0, code_challenge: a, code_challenge_method: c }),
        headers: this.headers,
        xform: Jf
      });
      return !((i = u.data) === null || i === void 0) && i.url && ye() && !(!((o = e.options) === null || o === void 0) && o.skipBrowserRedirect) && window.location.assign(u.data.url), this._returnResult(u);
    } catch (a) {
      if (await _e(this.storage, `${this.storageKey}-code-verifier`), U(a))
        return this._returnResult({ data: null, error: a });
      throw a;
    }
  }
  /**
   * Sends a reauthentication OTP to the user's email or phone number.
   * Requires the user to be signed-in.
   *
   * @category Auth
   *
   * @remarks
   * - This method is used together with `updateUser()` when a user's password needs to be updated.
   * - If you require your user to reauthenticate before updating their password, you need to enable the **Secure password change** option in your [project's email provider settings](/dashboard/project/_/auth/providers).
   * - A user is only require to reauthenticate before updating their password if **Secure password change** is enabled and the user **hasn't recently signed in**. A user is deemed recently signed in if the session was created in the last 24 hours.
   * - This method will send a nonce to the user's email. If the user doesn't have a confirmed email address, the method will send the nonce to the user's confirmed phone number instead.
   * - After receiving the OTP, include it as the `nonce` in your `updateUser()` call to finalize the password change.
   *
   * @exampleDescription Send reauthentication nonce
   * Sends a reauthentication nonce to the user's email or phone number.
   *
   * @example Send reauthentication nonce
   * ```js
   * const { error } = await supabase.auth.reauthenticate()
   * ```
   */
  async reauthenticate() {
    return await this.initializePromise, await this._acquireLock(this.lockAcquireTimeout, async () => await this._reauthenticate());
  }
  async _reauthenticate() {
    try {
      return await this._useSession(async (e) => {
        const { data: { session: r }, error: n } = e;
        if (n)
          throw n;
        if (!r)
          throw new Ae();
        const { error: s } = await x(this.fetch, "GET", `${this.url}/reauthenticate`, {
          headers: this.headers,
          jwt: r.access_token
        });
        return this._returnResult({ data: { user: null, session: null }, error: s });
      });
    } catch (e) {
      if (U(e))
        return this._returnResult({ data: { user: null, session: null }, error: e });
      throw e;
    }
  }
  /**
   * Resends an existing signup confirmation email, email change email, SMS OTP or phone change OTP.
   *
   * @category Auth
   *
   * @remarks
   * - Resends a signup confirmation, email change or phone change email to the user.
   * - Passwordless sign-ins can be resent by calling the `signInWithOtp()` method again.
   * - Password recovery emails can be resent by calling the `resetPasswordForEmail()` method again.
   * - This method will only resend an email or phone OTP to the user if there was an initial signup, email change or phone change request being made(note: For existing users signing in with OTP, you should use `signInWithOtp()` again to resend the OTP).
   * - You can specify a redirect url when you resend an email link using the `emailRedirectTo` option.
   *
   * @exampleDescription Resend an email signup confirmation
   * Resends the email signup confirmation to the user
   *
   * @example Resend an email signup confirmation
   * ```js
   * const { error } = await supabase.auth.resend({
   *   type: 'signup',
   *   email: 'email@example.com',
   *   options: {
   *     emailRedirectTo: 'https://example.com/welcome'
   *   }
   * })
   * ```
   *
   * @exampleDescription Resend a phone signup confirmation
   * Resends the phone signup confirmation email to the user
   *
   * @example Resend a phone signup confirmation
   * ```js
   * const { error } = await supabase.auth.resend({
   *   type: 'sms',
   *   phone: '1234567890'
   * })
   * ```
   *
   * @exampleDescription Resend email change email
   * Resends the email change email to the user
   *
   * @example Resend email change email
   * ```js
   * const { error } = await supabase.auth.resend({
   *   type: 'email_change',
   *   email: 'email@example.com'
   * })
   * ```
   *
   * @exampleDescription Resend phone change OTP
   * Resends the phone change OTP to the user
   *
   * @example Resend phone change OTP
   * ```js
   * const { error } = await supabase.auth.resend({
   *   type: 'phone_change',
   *   phone: '1234567890'
   * })
   * ```
   */
  async resend(e) {
    try {
      const r = `${this.url}/resend`;
      if ("email" in e) {
        const { email: n, type: s, options: i } = e, { error: o } = await x(this.fetch, "POST", r, {
          headers: this.headers,
          body: {
            email: n,
            type: s,
            gotrue_meta_security: { captcha_token: i == null ? void 0 : i.captchaToken }
          },
          redirectTo: i == null ? void 0 : i.emailRedirectTo
        });
        return this._returnResult({ data: { user: null, session: null }, error: o });
      } else if ("phone" in e) {
        const { phone: n, type: s, options: i } = e, { data: o, error: a } = await x(this.fetch, "POST", r, {
          headers: this.headers,
          body: {
            phone: n,
            type: s,
            gotrue_meta_security: { captcha_token: i == null ? void 0 : i.captchaToken }
          }
        });
        return this._returnResult({
          data: { user: null, session: null, messageId: o == null ? void 0 : o.message_id },
          error: a
        });
      }
      throw new sr("You must provide either an email or phone number and a type");
    } catch (r) {
      if (U(r))
        return this._returnResult({ data: { user: null, session: null }, error: r });
      throw r;
    }
  }
  /**
   * Returns the session, refreshing it if necessary.
   *
   * The session returned can be null if the session is not detected which can happen in the event a user is not signed-in or has logged out.
   *
   * **IMPORTANT:** This method loads values directly from the storage attached
   * to the client. If that storage is based on request cookies for example,
   * the values in it may not be authentic and therefore it's strongly advised
   * against using this method and its results in such circumstances. A warning
   * will be emitted if this is detected. Use {@link #getUser()} instead.
   *
   * @category Auth
   *
   * @remarks
   * - Since the introduction of [asymmetric JWT signing keys](/docs/guides/auth/signing-keys), this method is considered low-level and we encourage you to use `getClaims()` or `getUser()` instead.
   * - Retrieves the current [user session](/docs/guides/auth/sessions) from the storage medium (local storage, cookies).
   * - The session contains an access token (signed JWT), a refresh token and the user object.
   * - If the session's access token is expired or is about to expire, this method will use the refresh token to refresh the session.
   * - When using in a browser, or you've called `startAutoRefresh()` in your environment (React Native, etc.) this function always returns a valid access token without refreshing the session itself, as this is done in the background. This function returns very fast.
   * - **IMPORTANT SECURITY NOTICE:** If using an insecure storage medium, such as cookies or request headers, the user object returned by this function **must not be trusted**. Always verify the JWT using `getClaims()` or your own JWT verification library to securely establish the user's identity and access. You can also use `getUser()` to fetch the user object directly from the Auth server for this purpose.
   * - When using in a browser, this function is synchronized across all tabs using the [LockManager](https://developer.mozilla.org/en-US/docs/Web/API/LockManager) API. In other environments make sure you've defined a proper `lock` property, if necessary, to make sure there are no race conditions while the session is being refreshed.
   *
   * @example Get the session data
   * ```js
   * const { data, error } = await supabase.auth.getSession()
   * ```
   *
   * @exampleResponse Get the session data
   * ```json
   * {
   *   "data": {
   *     "session": {
   *       "access_token": "<ACCESS_TOKEN>",
   *       "token_type": "bearer",
   *       "expires_in": 3600,
   *       "expires_at": 1700000000,
   *       "refresh_token": "<REFRESH_TOKEN>",
   *       "user": {
   *         "id": "11111111-1111-1111-1111-111111111111",
   *         "aud": "authenticated",
   *         "role": "authenticated",
   *         "email": "example@email.com",
   *         "email_confirmed_at": "2024-01-01T00:00:00Z",
   *         "phone": "",
   *         "last_sign_in_at": "2024-01-01T00:00:00Z",
   *         "app_metadata": {
   *           "provider": "email",
   *           "providers": [
   *             "email"
   *           ]
   *         },
   *         "user_metadata": {
   *           "email": "example@email.com",
   *           "email_verified": false,
   *           "phone_verified": false,
   *           "sub": "11111111-1111-1111-1111-111111111111"
   *         },
   *         "identities": [
   *           {
   *             "identity_id": "22222222-2222-2222-2222-222222222222",
   *             "id": "11111111-1111-1111-1111-111111111111",
   *             "user_id": "11111111-1111-1111-1111-111111111111",
   *             "identity_data": {
   *               "email": "example@email.com",
   *               "email_verified": false,
   *               "phone_verified": false,
   *               "sub": "11111111-1111-1111-1111-111111111111"
   *             },
   *             "provider": "email",
   *             "last_sign_in_at": "2024-01-01T00:00:00Z",
   *             "created_at": "2024-01-01T00:00:00Z",
   *             "updated_at": "2024-01-01T00:00:00Z",
   *             "email": "example@email.com"
   *           }
   *         ],
   *         "created_at": "2024-01-01T00:00:00Z",
   *         "updated_at": "2024-01-01T00:00:00Z",
   *         "is_anonymous": false
   *       }
   *     }
   *   },
   *   "error": null
   * }
   * ```
   */
  async getSession() {
    return await this.initializePromise, await this._acquireLock(this.lockAcquireTimeout, async () => this._useSession(async (r) => r));
  }
  /**
   * Acquires a global lock based on the storage key.
   */
  async _acquireLock(e, r) {
    this._debug("#_acquireLock", "begin", e);
    try {
      if (this.lockAcquired) {
        const n = this.pendingInLock.length ? this.pendingInLock[this.pendingInLock.length - 1] : Promise.resolve(), s = (async () => (await n, await r()))();
        return this.pendingInLock.push((async () => {
          try {
            await s;
          } catch {
          }
        })()), s;
      }
      return await this.lock(`lock:${this.storageKey}`, e, async () => {
        this._debug("#_acquireLock", "lock acquired for storage key", this.storageKey);
        try {
          this.lockAcquired = !0;
          const n = r();
          for (this.pendingInLock.push((async () => {
            try {
              await n;
            } catch {
            }
          })()), await n; this.pendingInLock.length; ) {
            const s = [...this.pendingInLock];
            await Promise.all(s), this.pendingInLock.splice(0, s.length);
          }
          return await n;
        } finally {
          this._debug("#_acquireLock", "lock released for storage key", this.storageKey), this.lockAcquired = !1;
        }
      });
    } finally {
      this._debug("#_acquireLock", "end");
    }
  }
  /**
   * Use instead of {@link #getSession} inside the library. It is
   * semantically usually what you want, as getting a session involves some
   * processing afterwards that requires only one client operating on the
   * session at once across multiple tabs or processes.
   */
  async _useSession(e) {
    this._debug("#_useSession", "begin");
    try {
      const r = await this.__loadSession();
      return await e(r);
    } finally {
      this._debug("#_useSession", "end");
    }
  }
  /**
   * NEVER USE DIRECTLY!
   *
   * Always use {@link #_useSession}.
   */
  async __loadSession() {
    this._debug("#__loadSession()", "begin"), this.lockAcquired || this._debug("#__loadSession()", "used outside of an acquired lock!", new Error().stack);
    try {
      let e = null;
      const r = await Ye(this.storage, this.storageKey);
      if (this._debug("#getSession()", "session from storage", r), r !== null && (this._isValidSession(r) ? e = r : (this._debug("#getSession()", "session from storage is not valid"), await this._removeSession())), !e)
        return { data: { session: null }, error: null };
      const n = e.expires_at ? e.expires_at * 1e3 - Date.now() < Xr : !1;
      if (this._debug("#__loadSession()", `session has${n ? "" : " not"} expired`, "expires_at", e.expires_at), !n) {
        if (this.userStorage) {
          const o = await Ye(this.userStorage, this.storageKey + "-user");
          o != null && o.user ? e.user = o.user : e.user = Qr();
        }
        if (this.storage.isServer && e.user && !e.user.__isUserNotAvailableProxy) {
          const o = { value: this.suppressGetSessionWarning };
          e.user = Wf(e.user, o), o.value && (this.suppressGetSessionWarning = !0);
        }
        return { data: { session: e }, error: null };
      }
      const { data: s, error: i } = await this._callRefreshToken(e.refresh_token);
      return i ? this._returnResult({ data: { session: null }, error: i }) : this._returnResult({ data: { session: s }, error: null });
    } finally {
      this._debug("#__loadSession()", "end");
    }
  }
  /**
   * Gets the current user details if there is an existing session. This method
   * performs a network request to the Supabase Auth server, so the returned
   * value is authentic and can be used to base authorization rules on.
   *
   * @param jwt Takes in an optional access token JWT. If no JWT is provided, the JWT from the current session is used.
   *
   * @category Auth
   *
   * @remarks
   * - This method fetches the user object from the database instead of local session.
   * - This method is useful for checking if the user is authorized because it validates the user's access token JWT on the server.
   * - Should always be used when checking for user authorization on the server. On the client, you can instead use `getSession().session.user` for faster results. `getSession` is insecure on the server.
   *
   * @example Get the logged in user with the current existing session
   * ```js
   * const { data: { user } } = await supabase.auth.getUser()
   * ```
   *
   * @exampleResponse Get the logged in user with the current existing session
   * ```json
   * {
   *   "data": {
   *     "user": {
   *       "id": "11111111-1111-1111-1111-111111111111",
   *       "aud": "authenticated",
   *       "role": "authenticated",
   *       "email": "example@email.com",
   *       "email_confirmed_at": "2024-01-01T00:00:00Z",
   *       "phone": "",
   *       "confirmed_at": "2024-01-01T00:00:00Z",
   *       "last_sign_in_at": "2024-01-01T00:00:00Z",
   *       "app_metadata": {
   *         "provider": "email",
   *         "providers": [
   *           "email"
   *         ]
   *       },
   *       "user_metadata": {
   *         "email": "example@email.com",
   *         "email_verified": false,
   *         "phone_verified": false,
   *         "sub": "11111111-1111-1111-1111-111111111111"
   *       },
   *       "identities": [
   *         {
   *           "identity_id": "22222222-2222-2222-2222-222222222222",
   *           "id": "11111111-1111-1111-1111-111111111111",
   *           "user_id": "11111111-1111-1111-1111-111111111111",
   *           "identity_data": {
   *             "email": "example@email.com",
   *             "email_verified": false,
   *             "phone_verified": false,
   *             "sub": "11111111-1111-1111-1111-111111111111"
   *           },
   *           "provider": "email",
   *           "last_sign_in_at": "2024-01-01T00:00:00Z",
   *           "created_at": "2024-01-01T00:00:00Z",
   *           "updated_at": "2024-01-01T00:00:00Z",
   *           "email": "example@email.com"
   *         }
   *       ],
   *       "created_at": "2024-01-01T00:00:00Z",
   *       "updated_at": "2024-01-01T00:00:00Z",
   *       "is_anonymous": false
   *     }
   *   },
   *   "error": null
   * }
   * ```
   *
   * @example Get the logged in user with a custom access token jwt
   * ```js
   * const { data: { user } } = await supabase.auth.getUser(jwt)
   * ```
   */
  async getUser(e) {
    if (e)
      return await this._getUser(e);
    await this.initializePromise;
    const r = await this._acquireLock(this.lockAcquireTimeout, async () => await this._getUser());
    return r.data.user && (this.suppressGetSessionWarning = !0), r;
  }
  async _getUser(e) {
    try {
      return e ? await x(this.fetch, "GET", `${this.url}/user`, {
        headers: this.headers,
        jwt: e,
        xform: Ze
      }) : await this._useSession(async (r) => {
        var n, s, i;
        const { data: o, error: a } = r;
        if (a)
          throw a;
        return !(!((n = o.session) === null || n === void 0) && n.access_token) && !this.hasCustomAuthorizationHeader ? { data: { user: null }, error: new Ae() } : await x(this.fetch, "GET", `${this.url}/user`, {
          headers: this.headers,
          jwt: (i = (s = o.session) === null || s === void 0 ? void 0 : s.access_token) !== null && i !== void 0 ? i : void 0,
          xform: Ze
        });
      });
    } catch (r) {
      if (U(r))
        return nr(r) && (await this._removeSession(), await _e(this.storage, `${this.storageKey}-code-verifier`)), this._returnResult({ data: { user: null }, error: r });
      throw r;
    }
  }
  /**
   * Updates user data for a logged in user.
   *
   * @category Auth
   *
   * @remarks
   * - In order to use the `updateUser()` method, the user needs to be signed in first.
   * - By default, email updates sends a confirmation link to both the user's current and new email.
   * To only send a confirmation link to the user's new email, disable **Secure email change** in your project's [email auth provider settings](/dashboard/project/_/auth/providers).
   *
   * @exampleDescription Update the email for an authenticated user
   * Sends a "Confirm Email Change" email to the new address. If **Secure Email Change** is enabled (default), confirmation is also required from the **old email** before the change is applied. To skip dual confirmation and apply the change after only the new email is verified, disable **Secure Email Change** in the [Email Auth Provider settings](/dashboard/project/_/auth/providers?provider=Email).
   *
   * @example Update the email for an authenticated user
   * ```js
   * const { data, error } = await supabase.auth.updateUser({
   *   email: 'new@email.com'
   * })
   * ```
   *
   * @exampleResponse Update the email for an authenticated user
   * ```json
   * {
   *   "data": {
   *     "user": {
   *       "id": "11111111-1111-1111-1111-111111111111",
   *       "aud": "authenticated",
   *       "role": "authenticated",
   *       "email": "example@email.com",
   *       "email_confirmed_at": "2024-01-01T00:00:00Z",
   *       "phone": "",
   *       "confirmed_at": "2024-01-01T00:00:00Z",
   *       "new_email": "new@email.com",
   *       "email_change_sent_at": "2024-01-01T00:00:00Z",
   *       "last_sign_in_at": "2024-01-01T00:00:00Z",
   *       "app_metadata": {
   *         "provider": "email",
   *         "providers": [
   *           "email"
   *         ]
   *       },
   *       "user_metadata": {
   *         "email": "example@email.com",
   *         "email_verified": false,
   *         "phone_verified": false,
   *         "sub": "11111111-1111-1111-1111-111111111111"
   *       },
   *       "identities": [
   *         {
   *           "identity_id": "22222222-2222-2222-2222-222222222222",
   *           "id": "11111111-1111-1111-1111-111111111111",
   *           "user_id": "11111111-1111-1111-1111-111111111111",
   *           "identity_data": {
   *             "email": "example@email.com",
   *             "email_verified": false,
   *             "phone_verified": false,
   *             "sub": "11111111-1111-1111-1111-111111111111"
   *           },
   *           "provider": "email",
   *           "last_sign_in_at": "2024-01-01T00:00:00Z",
   *           "created_at": "2024-01-01T00:00:00Z",
   *           "updated_at": "2024-01-01T00:00:00Z",
   *           "email": "example@email.com"
   *         }
   *       ],
   *       "created_at": "2024-01-01T00:00:00Z",
   *       "updated_at": "2024-01-01T00:00:00Z",
   *       "is_anonymous": false
   *     }
   *   },
   *   "error": null
   * }
   * ```
   *
   * @exampleDescription Update the phone number for an authenticated user
   * Sends a one-time password (OTP) to the new phone number.
   *
   * @example Update the phone number for an authenticated user
   * ```js
   * const { data, error } = await supabase.auth.updateUser({
   *   phone: '123456789'
   * })
   * ```
   *
   * @example Update the password for an authenticated user
   * ```js
   * const { data, error } = await supabase.auth.updateUser({
   *   password: 'new password'
   * })
   * ```
   *
   * @exampleDescription Update the user's metadata
   * Updates the user's custom metadata.
   *
   * **Note**: The `data` field maps to the `auth.users.raw_user_meta_data` column in your Supabase database. When calling `getUser()`, the data will be available as `user.user_metadata`.
   *
   * @example Update the user's metadata
   * ```js
   * const { data, error } = await supabase.auth.updateUser({
   *   data: { hello: 'world' }
   * })
   * ```
   *
   * @exampleDescription Update the user's password with a nonce
   * If **Secure password change** is enabled in your [project's email provider settings](/dashboard/project/_/auth/providers), updating the user's password would require a nonce if the user **hasn't recently signed in**. The nonce is sent to the user's email or phone number. A user is deemed recently signed in if the session was created in the last 24 hours.
   *
   * @example Update the user's password with a nonce
   * ```js
   * const { data, error } = await supabase.auth.updateUser({
   *   password: 'new password',
   *   nonce: '123456'
   * })
   * ```
   */
  async updateUser(e, r = {}) {
    return await this.initializePromise, await this._acquireLock(this.lockAcquireTimeout, async () => await this._updateUser(e, r));
  }
  async _updateUser(e, r = {}) {
    try {
      return await this._useSession(async (n) => {
        const { data: s, error: i } = n;
        if (i)
          throw i;
        if (!s.session)
          throw new Ae();
        const o = s.session;
        let a = null, c = null;
        this.flowType === "pkce" && e.email != null && ([a, c] = await ht(this.storage, this.storageKey));
        const { data: u, error: l } = await x(this.fetch, "PUT", `${this.url}/user`, {
          headers: this.headers,
          redirectTo: r == null ? void 0 : r.emailRedirectTo,
          body: Object.assign(Object.assign({}, e), { code_challenge: a, code_challenge_method: c }),
          jwt: o.access_token,
          xform: Ze
        });
        if (l)
          throw l;
        return o.user = u.user, await this._saveSession(o), await this._notifyAllSubscribers("USER_UPDATED", o), this._returnResult({ data: { user: o.user }, error: null });
      });
    } catch (n) {
      if (await _e(this.storage, `${this.storageKey}-code-verifier`), U(n))
        return this._returnResult({ data: { user: null }, error: n });
      throw n;
    }
  }
  /**
   * Sets the session data from the current session. If the current session is expired, setSession will take care of refreshing it to obtain a new session.
   * If the refresh token or access token in the current session is invalid, an error will be thrown.
   * @param currentSession The current session that minimally contains an access token and refresh token.
   *
   * @category Auth
   *
   * @remarks
   * - This method sets the session using an `access_token` and `refresh_token`.
   * - If successful, a `SIGNED_IN` event is emitted.
   *
   * @exampleDescription Set the session
   * Sets the session data from an access_token and refresh_token, then returns an auth response or error.
   *
   * @example Set the session
   * ```js
   *   const { data, error } = await supabase.auth.setSession({
   *     access_token,
   *     refresh_token
   *   })
   * ```
   *
   * @exampleResponse Set the session
   * ```json
   * {
   *   "data": {
   *     "user": {
   *       "id": "11111111-1111-1111-1111-111111111111",
   *       "aud": "authenticated",
   *       "role": "authenticated",
   *       "email": "example@email.com",
   *       "email_confirmed_at": "2024-01-01T00:00:00Z",
   *       "phone": "",
   *       "confirmed_at": "2024-01-01T00:00:00Z",
   *       "last_sign_in_at": "2024-01-01T00:00:00Z",
   *       "app_metadata": {
   *         "provider": "email",
   *         "providers": [
   *           "email"
   *         ]
   *       },
   *       "user_metadata": {
   *         "email": "example@email.com",
   *         "email_verified": false,
   *         "phone_verified": false,
   *         "sub": "11111111-1111-1111-1111-111111111111"
   *       },
   *       "identities": [
   *         {
   *           "identity_id": "22222222-2222-2222-2222-222222222222",
   *           "id": "11111111-1111-1111-1111-111111111111",
   *           "user_id": "11111111-1111-1111-1111-111111111111",
   *           "identity_data": {
   *             "email": "example@email.com",
   *             "email_verified": false,
   *             "phone_verified": false,
   *             "sub": "11111111-1111-1111-1111-111111111111"
   *           },
   *           "provider": "email",
   *           "last_sign_in_at": "2024-01-01T00:00:00Z",
   *           "created_at": "2024-01-01T00:00:00Z",
   *           "updated_at": "2024-01-01T00:00:00Z",
   *           "email": "example@email.com"
   *         }
   *       ],
   *       "created_at": "2024-01-01T00:00:00Z",
   *       "updated_at": "2024-01-01T00:00:00Z",
   *       "is_anonymous": false
   *     },
   *     "session": {
   *       "access_token": "<ACCESS_TOKEN>",
   *       "refresh_token": "<REFRESH_TOKEN>",
   *       "user": {
   *         "id": "11111111-1111-1111-1111-111111111111",
   *         "aud": "authenticated",
   *         "role": "authenticated",
   *         "email": "example@email.com",
   *         "email_confirmed_at": "2024-01-01T00:00:00Z",
   *         "phone": "",
   *         "confirmed_at": "2024-01-01T00:00:00Z",
   *         "last_sign_in_at": "11111111-1111-1111-1111-111111111111",
   *         "app_metadata": {
   *           "provider": "email",
   *           "providers": [
   *             "email"
   *           ]
   *         },
   *         "user_metadata": {
   *           "email": "example@email.com",
   *           "email_verified": false,
   *           "phone_verified": false,
   *           "sub": "11111111-1111-1111-1111-111111111111"
   *         },
   *         "identities": [
   *           {
   *             "identity_id": "2024-01-01T00:00:00Z",
   *             "id": "11111111-1111-1111-1111-111111111111",
   *             "user_id": "11111111-1111-1111-1111-111111111111",
   *             "identity_data": {
   *               "email": "example@email.com",
   *               "email_verified": false,
   *               "phone_verified": false,
   *               "sub": "11111111-1111-1111-1111-111111111111"
   *             },
   *             "provider": "email",
   *             "last_sign_in_at": "2024-01-01T00:00:00Z",
   *             "created_at": "2024-01-01T00:00:00Z",
   *             "updated_at": "2024-01-01T00:00:00Z",
   *             "email": "example@email.com"
   *           }
   *         ],
   *         "created_at": "2024-01-01T00:00:00Z",
   *         "updated_at": "2024-01-01T00:00:00Z",
   *         "is_anonymous": false
   *       },
   *       "token_type": "bearer",
   *       "expires_in": 3500,
   *       "expires_at": 1700000000
   *     }
   *   },
   *   "error": null
   * }
   * ```
   */
  async setSession(e) {
    return await this.initializePromise, await this._acquireLock(this.lockAcquireTimeout, async () => await this._setSession(e));
  }
  async _setSession(e) {
    try {
      if (!e.access_token || !e.refresh_token)
        throw new Ae();
      const r = Date.now() / 1e3;
      let n = r, s = !0, i = null;
      const { payload: o } = or(e.access_token);
      if (o.exp && (n = o.exp, s = n <= r), s) {
        const { data: a, error: c } = await this._callRefreshToken(e.refresh_token);
        if (c)
          return this._returnResult({ data: { user: null, session: null }, error: c });
        if (!a)
          return { data: { user: null, session: null }, error: null };
        i = a;
      } else {
        const { data: a, error: c } = await this._getUser(e.access_token);
        if (c)
          return this._returnResult({ data: { user: null, session: null }, error: c });
        i = {
          access_token: e.access_token,
          refresh_token: e.refresh_token,
          user: a.user,
          token_type: "bearer",
          expires_in: n - r,
          expires_at: n
        }, await this._saveSession(i), await this._notifyAllSubscribers("SIGNED_IN", i);
      }
      return this._returnResult({ data: { user: i.user, session: i }, error: null });
    } catch (r) {
      if (U(r))
        return this._returnResult({ data: { session: null, user: null }, error: r });
      throw r;
    }
  }
  /**
   * Returns a new session, regardless of expiry status.
   * Takes in an optional current session. If not passed in, then refreshSession() will attempt to retrieve it from getSession().
   * If the current session's refresh token is invalid, an error will be thrown.
   * @param currentSession The current session. If passed in, it must contain a refresh token.
   *
   * @category Auth
   *
   * @remarks
   * - This method will refresh and return a new session whether the current one is expired or not.
   *
   * @example Refresh session using the current session
   * ```js
   * const { data, error } = await supabase.auth.refreshSession()
   * const { session, user } = data
   * ```
   *
   * @exampleResponse Refresh session using the current session
   * ```json
   * {
   *   "data": {
   *     "user": {
   *       "id": "11111111-1111-1111-1111-111111111111",
   *       "aud": "authenticated",
   *       "role": "authenticated",
   *       "email": "example@email.com",
   *       "email_confirmed_at": "2024-01-01T00:00:00Z",
   *       "phone": "",
   *       "confirmed_at": "2024-01-01T00:00:00Z",
   *       "last_sign_in_at": "2024-01-01T00:00:00Z",
   *       "app_metadata": {
   *         "provider": "email",
   *         "providers": [
   *           "email"
   *         ]
   *       },
   *       "user_metadata": {
   *         "email": "example@email.com",
   *         "email_verified": false,
   *         "phone_verified": false,
   *         "sub": "11111111-1111-1111-1111-111111111111"
   *       },
   *       "identities": [
   *         {
   *           "identity_id": "22222222-2222-2222-2222-222222222222",
   *           "id": "11111111-1111-1111-1111-111111111111",
   *           "user_id": "11111111-1111-1111-1111-111111111111",
   *           "identity_data": {
   *             "email": "example@email.com",
   *             "email_verified": false,
   *             "phone_verified": false,
   *             "sub": "11111111-1111-1111-1111-111111111111"
   *           },
   *           "provider": "email",
   *           "last_sign_in_at": "2024-01-01T00:00:00Z",
   *           "created_at": "2024-01-01T00:00:00Z",
   *           "updated_at": "2024-01-01T00:00:00Z",
   *           "email": "example@email.com"
   *         }
   *       ],
   *       "created_at": "2024-01-01T00:00:00Z",
   *       "updated_at": "2024-01-01T00:00:00Z",
   *       "is_anonymous": false
   *     },
   *     "session": {
   *       "access_token": "<ACCESS_TOKEN>",
   *       "token_type": "bearer",
   *       "expires_in": 3600,
   *       "expires_at": 1700000000,
   *       "refresh_token": "<REFRESH_TOKEN>",
   *       "user": {
   *         "id": "11111111-1111-1111-1111-111111111111",
   *         "aud": "authenticated",
   *         "role": "authenticated",
   *         "email": "example@email.com",
   *         "email_confirmed_at": "2024-01-01T00:00:00Z",
   *         "phone": "",
   *         "confirmed_at": "2024-01-01T00:00:00Z",
   *         "last_sign_in_at": "2024-01-01T00:00:00Z",
   *         "app_metadata": {
   *           "provider": "email",
   *           "providers": [
   *             "email"
   *           ]
   *         },
   *         "user_metadata": {
   *           "email": "example@email.com",
   *           "email_verified": false,
   *           "phone_verified": false,
   *           "sub": "11111111-1111-1111-1111-111111111111"
   *         },
   *         "identities": [
   *           {
   *             "identity_id": "22222222-2222-2222-2222-222222222222",
   *             "id": "11111111-1111-1111-1111-111111111111",
   *             "user_id": "11111111-1111-1111-1111-111111111111",
   *             "identity_data": {
   *               "email": "example@email.com",
   *               "email_verified": false,
   *               "phone_verified": false,
   *               "sub": "11111111-1111-1111-1111-111111111111"
   *             },
   *             "provider": "email",
   *             "last_sign_in_at": "2024-01-01T00:00:00Z",
   *             "created_at": "2024-01-01T00:00:00Z",
   *             "updated_at": "2024-01-01T00:00:00Z",
   *             "email": "example@email.com"
   *           }
   *         ],
   *         "created_at": "2024-01-01T00:00:00Z",
   *         "updated_at": "2024-01-01T00:00:00Z",
   *         "is_anonymous": false
   *       }
   *     }
   *   },
   *   "error": null
   * }
   * ```
   *
   * @example Refresh session using a refresh token
   * ```js
   * const { data, error } = await supabase.auth.refreshSession({ refresh_token })
   * const { session, user } = data
   * ```
   */
  async refreshSession(e) {
    return await this.initializePromise, await this._acquireLock(this.lockAcquireTimeout, async () => await this._refreshSession(e));
  }
  async _refreshSession(e) {
    try {
      return await this._useSession(async (r) => {
        var n;
        if (!e) {
          const { data: o, error: a } = r;
          if (a)
            throw a;
          e = (n = o.session) !== null && n !== void 0 ? n : void 0;
        }
        if (!(e != null && e.refresh_token))
          throw new Ae();
        const { data: s, error: i } = await this._callRefreshToken(e.refresh_token);
        return i ? this._returnResult({ data: { user: null, session: null }, error: i }) : s ? this._returnResult({ data: { user: s.user, session: s }, error: null }) : this._returnResult({ data: { user: null, session: null }, error: null });
      });
    } catch (r) {
      if (U(r))
        return this._returnResult({ data: { user: null, session: null }, error: r });
      throw r;
    }
  }
  /**
   * Gets the session data from a URL string
   */
  async _getSessionFromURL(e, r) {
    var n;
    try {
      if (!ye())
        throw new ir("No browser detected.");
      if (e.error || e.error_description || e.error_code)
        throw new ir(e.error_description || "Error in URL with unspecified error_description", {
          error: e.error || "unspecified_error",
          code: e.error_code || "unspecified_code"
        });
      switch (r) {
        case "implicit":
          if (this.flowType === "pkce")
            throw new Bs("Not a valid PKCE flow url.");
          break;
        case "pkce":
          if (this.flowType === "implicit")
            throw new ir("Not a valid implicit grant flow url.");
          break;
        default:
      }
      if (r === "pkce") {
        if (this._debug("#_initialize()", "begin", "is PKCE flow", !0), !e.code)
          throw new Bs("No code detected.");
        const { data: S, error: m } = await this._exchangeCodeForSession(e.code);
        if (m)
          throw m;
        const p = new URL(window.location.href);
        return p.searchParams.delete("code"), window.history.replaceState(window.history.state, "", p.toString()), {
          data: { session: S.session, redirectType: (n = S.redirectType) !== null && n !== void 0 ? n : null },
          error: null
        };
      }
      const { provider_token: s, provider_refresh_token: i, access_token: o, refresh_token: a, expires_in: c, expires_at: u, token_type: l } = e;
      if (!o || !c || !a || !l)
        throw new ir("No session defined in URL");
      const h = Math.round(Date.now() / 1e3), f = parseInt(c);
      let d = h + f;
      u && (d = parseInt(u));
      const g = d - h;
      g * 1e3 <= gt && console.warn(`@supabase/gotrue-js: Session as retrieved from URL expires in ${g}s, should have been closer to ${f}s`);
      const y = d - f;
      h - y >= 120 ? console.warn("@supabase/gotrue-js: Session as retrieved from URL was issued over 120s ago, URL could be stale", y, d, h) : h - y < 0 && console.warn("@supabase/gotrue-js: Session as retrieved from URL was issued in the future? Check the device clock for skew", y, d, h);
      const { data: I, error: k } = await this._getUser(o);
      if (k)
        throw k;
      const w = {
        provider_token: s,
        provider_refresh_token: i,
        access_token: o,
        expires_in: f,
        expires_at: d,
        refresh_token: a,
        token_type: l,
        user: I.user
      };
      return window.location.hash = "", this._debug("#_getSessionFromURL()", "clearing window.location.hash"), this._returnResult({ data: { session: w, redirectType: e.type }, error: null });
    } catch (s) {
      if (U(s))
        return this._returnResult({ data: { session: null, redirectType: null }, error: s });
      throw s;
    }
  }
  /**
   * Checks if the current URL contains parameters given by an implicit oauth grant flow (https://www.rfc-editor.org/rfc/rfc6749.html#section-4.2)
   *
   * If `detectSessionInUrl` is a function, it will be called with the URL and params to determine
   * if the URL should be processed as a Supabase auth callback. This allows users to exclude
   * URLs from other OAuth providers (e.g., Facebook Login) that also return access_token in the fragment.
   */
  _isImplicitGrantCallback(e) {
    return typeof this.detectSessionInUrl == "function" ? this.detectSessionInUrl(new URL(window.location.href), e) : !!(e.access_token || e.error_description);
  }
  /**
   * Checks if the current URL and backing storage contain parameters given by a PKCE flow
   */
  async _isPKCECallback(e) {
    const r = await Ye(this.storage, `${this.storageKey}-code-verifier`);
    return !!(e.code && r);
  }
  /**
   * Inside a browser context, `signOut()` will remove the logged in user from the browser session and log them out - removing all items from localstorage and then trigger a `"SIGNED_OUT"` event.
   *
   * For server-side management, you can revoke all refresh tokens for a user by passing a user's JWT through to `auth.api.signOut(JWT: string)`.
   * There is no way to revoke a user's access token jwt until it expires. It is recommended to set a shorter expiry on the jwt for this reason.
   *
   * If using `others` scope, no `SIGNED_OUT` event is fired!
   *
   * @category Auth
   *
   * @remarks
   * - In order to use the `signOut()` method, the user needs to be signed in first.
   * - By default, `signOut()` uses the global scope, which signs out all other sessions that the user is logged into as well. Customize this behavior by passing a scope parameter.
   * - Since Supabase Auth uses JWTs for authentication, the access token JWT will be valid until it's expired. When the user signs out, Supabase revokes the refresh token and deletes the JWT from the client-side. This does not revoke the JWT and it will still be valid until it expires.
   *
   * @example Sign out (all sessions)
   * ```js
   * const { error } = await supabase.auth.signOut()
   * ```
   *
   * @example Sign out (current session)
   * ```js
   * const { error } = await supabase.auth.signOut({ scope: 'local' })
   * ```
   *
   * @example Sign out (other sessions)
   * ```js
   * const { error } = await supabase.auth.signOut({ scope: 'others' })
   * ```
   */
  async signOut(e = { scope: "global" }) {
    return await this.initializePromise, await this._acquireLock(this.lockAcquireTimeout, async () => await this._signOut(e));
  }
  async _signOut({ scope: e } = { scope: "global" }) {
    return await this._useSession(async (r) => {
      var n;
      const { data: s, error: i } = r;
      if (i && !nr(i))
        return this._returnResult({ error: i });
      const o = (n = s.session) === null || n === void 0 ? void 0 : n.access_token;
      if (o) {
        const { error: a } = await this.admin.signOut(o, e);
        if (a && !(Tf(a) && (a.status === 404 || a.status === 401 || a.status === 403) || nr(a)))
          return this._returnResult({ error: a });
      }
      return e !== "others" && (await this._removeSession(), await _e(this.storage, `${this.storageKey}-code-verifier`)), this._returnResult({ error: null });
    });
  }
  /**  *
   * @category Auth
   *
   * @remarks
   * - Subscribes to important events occurring on the user's session.
   * - Use on the frontend/client. It is less useful on the server.
   * - Events are emitted across tabs to keep your application's UI up-to-date. Some events can fire very frequently, based on the number of tabs open. Use a quick and efficient callback function, and defer or debounce as many operations as you can to be performed outside of the callback.
   * - **Important:** A callback can be an `async` function and it runs synchronously during the processing of the changes causing the event. You can easily create a dead-lock by using `await` on a call to another method of the Supabase library.
   *   - Avoid using `async` functions as callbacks.
   *   - Limit the number of `await` calls in `async` callbacks.
   *   - Do not use other Supabase functions in the callback function. If you must, dispatch the functions once the callback has finished executing. Use this as a quick way to achieve this:
   *     ```js
   *     supabase.auth.onAuthStateChange((event, session) => {
   *       setTimeout(async () => {
   *         // await on other Supabase function here
   *         // this runs right after the callback has finished
   *       }, 0)
   *     })
   *     ```
   * - Emitted events:
   *   - `INITIAL_SESSION`
   *     - Emitted right after the Supabase client is constructed and the initial session from storage is loaded.
   *   - `SIGNED_IN`
   *     - Emitted each time a user session is confirmed or re-established, including on user sign in and when refocusing a tab.
   *     - Avoid making assumptions as to when this event is fired, this may occur even when the user is already signed in. Instead, check the user object attached to the event to see if a new user has signed in and update your application's UI.
   *     - This event can fire very frequently depending on the number of tabs open in your application.
   *   - `SIGNED_OUT`
   *     - Emitted when the user signs out. This can be after:
   *       - A call to `supabase.auth.signOut()`.
   *       - After the user's session has expired for any reason:
   *         - User has signed out on another device.
   *         - The session has reached its timebox limit or inactivity timeout.
   *         - User has signed in on another device with single session per user enabled.
   *         - Check the [User Sessions](/docs/guides/auth/sessions) docs for more information.
   *     - Use this to clean up any local storage your application has associated with the user.
   *   - `TOKEN_REFRESHED`
   *     - Emitted each time a new access and refresh token are fetched for the signed in user.
   *     - It's best practice and highly recommended to extract the access token (JWT) and store it in memory for further use in your application.
   *       - Avoid frequent calls to `supabase.auth.getSession()` for the same purpose.
   *     - There is a background process that keeps track of when the session should be refreshed so you will always receive valid tokens by listening to this event.
   *     - The frequency of this event is related to the JWT expiry limit configured on your project.
   *   - `USER_UPDATED`
   *     - Emitted each time the `supabase.auth.updateUser()` method finishes successfully. Listen to it to update your application's UI based on new profile information.
   *   - `PASSWORD_RECOVERY`
   *     - Emitted instead of the `SIGNED_IN` event when the user lands on a page that includes a password recovery link in the URL.
   *     - Use it to show a UI to the user where they can [reset their password](/docs/guides/auth/passwords#resetting-a-users-password-forgot-password).
   *
   * @example Listen to auth changes
   * ```js
   * const { data } = supabase.auth.onAuthStateChange((event, session) => {
   *   console.log(event, session)
   *
   *   if (event === 'INITIAL_SESSION') {
   *     // handle initial session
   *   } else if (event === 'SIGNED_IN') {
   *     // handle sign in event
   *   } else if (event === 'SIGNED_OUT') {
   *     // handle sign out event
   *   } else if (event === 'PASSWORD_RECOVERY') {
   *     // handle password recovery event
   *   } else if (event === 'TOKEN_REFRESHED') {
   *     // handle token refreshed event
   *   } else if (event === 'USER_UPDATED') {
   *     // handle user updated event
   *   }
   * })
   *
   * // call unsubscribe to remove the callback
   * data.subscription.unsubscribe()
   * ```
   *
   * @exampleDescription Listen to sign out
   * Make sure you clear out any local data, such as local and session storage, after the client library has detected the user's sign out.
   *
   * @example Listen to sign out
   * ```js
   * supabase.auth.onAuthStateChange((event, session) => {
   *   if (event === 'SIGNED_OUT') {
   *     console.log('SIGNED_OUT', session)
   *
   *     // clear local and session storage
   *     [
   *       window.localStorage,
   *       window.sessionStorage,
   *     ].forEach((storage) => {
   *       Object.entries(storage)
   *         .forEach(([key]) => {
   *           storage.removeItem(key)
   *         })
   *     })
   *   }
   * })
   * ```
   *
   * @exampleDescription Store OAuth provider tokens on sign in
   * When using [OAuth (Social Login)](/docs/guides/auth/social-login) you sometimes wish to get access to the provider's access token and refresh token, in order to call provider APIs in the name of the user.
   *
   * For example, if you are using [Sign in with Google](/docs/guides/auth/social-login/auth-google) you may want to use the provider token to call Google APIs on behalf of the user. Supabase Auth does not keep track of the provider access and refresh token, but does return them for you once, immediately after sign in. You can use the `onAuthStateChange` method to listen for the presence of the provider tokens and store them in local storage. You can further send them to your server's APIs for use on the backend.
   *
   * Finally, make sure you remove them from local storage on the `SIGNED_OUT` event. If the OAuth provider supports token revocation, make sure you call those APIs either from the frontend or schedule them to be called on the backend.
   *
   * @example Store OAuth provider tokens on sign in
   * ```js
   * // Register this immediately after calling createClient!
   * // Because signInWithOAuth causes a redirect, you need to fetch the
   * // provider tokens from the callback.
   * supabase.auth.onAuthStateChange((event, session) => {
   *   if (session && session.provider_token) {
   *     window.localStorage.setItem('oauth_provider_token', session.provider_token)
   *   }
   *
   *   if (session && session.provider_refresh_token) {
   *     window.localStorage.setItem('oauth_provider_refresh_token', session.provider_refresh_token)
   *   }
   *
   *   if (event === 'SIGNED_OUT') {
   *     window.localStorage.removeItem('oauth_provider_token')
   *     window.localStorage.removeItem('oauth_provider_refresh_token')
   *   }
   * })
   * ```
   *
   * @exampleDescription Use React Context for the User's session
   * Instead of relying on `supabase.auth.getSession()` within your React components, you can use a [React Context](https://react.dev/reference/react/createContext) to store the latest session information from the `onAuthStateChange` callback and access it that way.
   *
   * @example Use React Context for the User's session
   * ```js
   * const SessionContext = React.createContext(null)
   *
   * function main() {
   *   const [session, setSession] = React.useState(null)
   *
   *   React.useEffect(() => {
   *     const {data: { subscription }} = supabase.auth.onAuthStateChange(
   *       (event, session) => {
   *         if (event === 'SIGNED_OUT') {
   *           setSession(null)
   *         } else if (session) {
   *           setSession(session)
   *         }
   *       })
   *
   *     return () => {
   *       subscription.unsubscribe()
   *     }
   *   }, [])
   *
   *   return (
   *     <SessionContext.Provider value={session}>
   *       <App />
   *     </SessionContext.Provider>
   *   )
   * }
   * ```
   *
   * @example Listen to password recovery events
   * ```js
   * supabase.auth.onAuthStateChange((event, session) => {
   *   if (event === 'PASSWORD_RECOVERY') {
   *     console.log('PASSWORD_RECOVERY', session)
   *     // show screen to update user's password
   *     showPasswordResetScreen(true)
   *   }
   * })
   * ```
   *
   * @example Listen to sign in
   * ```js
   * supabase.auth.onAuthStateChange((event, session) => {
   *   if (event === 'SIGNED_IN') console.log('SIGNED_IN', session)
   * })
   * ```
   *
   * @example Listen to token refresh
   * ```js
   * supabase.auth.onAuthStateChange((event, session) => {
   *   if (event === 'TOKEN_REFRESHED') console.log('TOKEN_REFRESHED', session)
   * })
   * ```
   *
   * @example Listen to user updates
   * ```js
   * supabase.auth.onAuthStateChange((event, session) => {
   *   if (event === 'USER_UPDATED') console.log('USER_UPDATED', session)
   * })
   * ```
   */
  onAuthStateChange(e) {
    const r = Cf(), n = {
      id: r,
      callback: e,
      unsubscribe: () => {
        this._debug("#unsubscribe()", "state change callback with id removed", r), this.stateChangeEmitters.delete(r);
      }
    };
    return this._debug("#onAuthStateChange()", "registered callback with id", r), this.stateChangeEmitters.set(r, n), (async () => (await this.initializePromise, await this._acquireLock(this.lockAcquireTimeout, async () => {
      this._emitInitialSession(r);
    })))(), { data: { subscription: n } };
  }
  async _emitInitialSession(e) {
    return await this._useSession(async (r) => {
      var n, s;
      try {
        const { data: { session: i }, error: o } = r;
        if (o)
          throw o;
        await ((n = this.stateChangeEmitters.get(e)) === null || n === void 0 ? void 0 : n.callback("INITIAL_SESSION", i)), this._debug("INITIAL_SESSION", "callback id", e, "session", i);
      } catch (i) {
        await ((s = this.stateChangeEmitters.get(e)) === null || s === void 0 ? void 0 : s.callback("INITIAL_SESSION", null)), this._debug("INITIAL_SESSION", "callback id", e, "error", i), nr(i) ? console.warn(i) : console.error(i);
      }
    });
  }
  /**
   * Sends a password reset request to an email address. This method supports the PKCE flow.
   *
   * @param email The email address of the user.
   * @param options.redirectTo The URL to send the user to after they click the password reset link.
   * @param options.captchaToken Verification token received when the user completes the captcha on the site.
   *
   * @category Auth
   *
   * @remarks
   * - The password reset flow consist of 2 broad steps: (i) Allow the user to login via the password reset link; (ii) Update the user's password.
   * - The `resetPasswordForEmail()` only sends a password reset link to the user's email.
   * To update the user's password, see [`updateUser()`](/docs/reference/javascript/auth-updateuser).
   * - A `PASSWORD_RECOVERY` event will be emitted when the password recovery link is clicked.
   * You can use [`onAuthStateChange()`](/docs/reference/javascript/auth-onauthstatechange) to listen and invoke a callback function on these events.
   * - When the user clicks the reset link in the email they are redirected back to your application.
   * You can configure the URL that the user is redirected to with the `redirectTo` parameter.
   * See [redirect URLs and wildcards](/docs/guides/auth/redirect-urls#use-wildcards-in-redirect-urls) to add additional redirect URLs to your project.
   * - After the user has been redirected successfully, prompt them for a new password and call `updateUser()`:
   * ```js
   * const { data, error } = await supabase.auth.updateUser({
   *   password: new_password
   * })
   * ```
   *
   * @example Reset password
   * ```js
   * const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
   *   redirectTo: 'https://example.com/update-password',
   * })
   * ```
   *
   * @exampleResponse Reset password
   * ```json
   * {
   *   data: {}
   *   error: null
   * }
   * ```
   *
   * @example Reset password (React)
   * ```js
   * /**
   *  * Step 1: Send the user an email to get a password reset token.
   *  * This email contains a link which sends the user back to your application.
   *  *\/
   * const { data, error } = await supabase.auth
   *   .resetPasswordForEmail('user@email.com')
   *
   * /**
   *  * Step 2: Once the user is redirected back to your application,
   *  * ask the user to reset their password.
   *  *\/
   *  useEffect(() => {
   *    supabase.auth.onAuthStateChange(async (event, session) => {
   *      if (event == "PASSWORD_RECOVERY") {
   *        const newPassword = prompt("What would you like your new password to be?");
   *        const { data, error } = await supabase.auth
   *          .updateUser({ password: newPassword })
   *
   *        if (data) alert("Password updated successfully!")
   *        if (error) alert("There was an error updating your password.")
   *      }
   *    })
   *  }, [])
   * ```
   */
  async resetPasswordForEmail(e, r = {}) {
    let n = null, s = null;
    this.flowType === "pkce" && ([n, s] = await ht(
      this.storage,
      this.storageKey,
      !0
      // isPasswordRecovery
    ));
    try {
      return await x(this.fetch, "POST", `${this.url}/recover`, {
        body: {
          email: e,
          code_challenge: n,
          code_challenge_method: s,
          gotrue_meta_security: { captcha_token: r.captchaToken }
        },
        headers: this.headers,
        redirectTo: r.redirectTo
      });
    } catch (i) {
      if (await _e(this.storage, `${this.storageKey}-code-verifier`), U(i))
        return this._returnResult({ data: null, error: i });
      throw i;
    }
  }
  /**
   * Gets all the identities linked to a user.
   *
   * @category Auth
   *
   * @remarks
   * - The user needs to be signed in to call `getUserIdentities()`.
   *
   * @example Returns a list of identities linked to the user
   * ```js
   * const { data, error } = await supabase.auth.getUserIdentities()
   * ```
   *
   * @exampleResponse Returns a list of identities linked to the user
   * ```json
   * {
   *   "data": {
   *     "identities": [
   *       {
   *         "identity_id": "22222222-2222-2222-2222-222222222222",
   *         "id": "2024-01-01T00:00:00Z",
   *         "user_id": "2024-01-01T00:00:00Z",
   *         "identity_data": {
   *           "email": "example@email.com",
   *           "email_verified": false,
   *           "phone_verified": false,
   *           "sub": "11111111-1111-1111-1111-111111111111"
   *         },
   *         "provider": "email",
   *         "last_sign_in_at": "2024-01-01T00:00:00Z",
   *         "created_at": "2024-01-01T00:00:00Z",
   *         "updated_at": "2024-01-01T00:00:00Z",
   *         "email": "example@email.com"
   *       }
   *     ]
   *   },
   *   "error": null
   * }
   * ```
   */
  async getUserIdentities() {
    var e;
    try {
      const { data: r, error: n } = await this.getUser();
      if (n)
        throw n;
      return this._returnResult({ data: { identities: (e = r.user.identities) !== null && e !== void 0 ? e : [] }, error: null });
    } catch (r) {
      if (U(r))
        return this._returnResult({ data: null, error: r });
      throw r;
    }
  }
  /**  *
   * @category Auth
   *
   * @remarks
   * - The **Enable Manual Linking** option must be enabled from your [project's authentication settings](/dashboard/project/_/auth/providers).
   * - The user needs to be signed in to call `linkIdentity()`.
   * - If the candidate identity is already linked to the existing user or another user, `linkIdentity()` will fail.
   * - If `linkIdentity` is run in the browser, the user is automatically redirected to the returned URL. On the server, you should handle the redirect.
   *
   * @example Link an identity to a user
   * ```js
   * const { data, error } = await supabase.auth.linkIdentity({
   *   provider: 'github'
   * })
   * ```
   *
   * @exampleResponse Link an identity to a user
   * ```json
   * {
   *   data: {
   *     provider: 'github',
   *     url: <PROVIDER_URL_TO_REDIRECT_TO>
   *   },
   *   error: null
   * }
   * ```
   */
  async linkIdentity(e) {
    return "token" in e ? this.linkIdentityIdToken(e) : this.linkIdentityOAuth(e);
  }
  async linkIdentityOAuth(e) {
    var r;
    try {
      const { data: n, error: s } = await this._useSession(async (i) => {
        var o, a, c, u, l;
        const { data: h, error: f } = i;
        if (f)
          throw f;
        const d = await this._getUrlForProvider(`${this.url}/user/identities/authorize`, e.provider, {
          redirectTo: (o = e.options) === null || o === void 0 ? void 0 : o.redirectTo,
          scopes: (a = e.options) === null || a === void 0 ? void 0 : a.scopes,
          queryParams: (c = e.options) === null || c === void 0 ? void 0 : c.queryParams,
          skipBrowserRedirect: !0
        });
        return await x(this.fetch, "GET", d, {
          headers: this.headers,
          jwt: (l = (u = h.session) === null || u === void 0 ? void 0 : u.access_token) !== null && l !== void 0 ? l : void 0
        });
      });
      if (s)
        throw s;
      return ye() && !(!((r = e.options) === null || r === void 0) && r.skipBrowserRedirect) && window.location.assign(n == null ? void 0 : n.url), this._returnResult({
        data: { provider: e.provider, url: n == null ? void 0 : n.url },
        error: null
      });
    } catch (n) {
      if (U(n))
        return this._returnResult({ data: { provider: e.provider, url: null }, error: n });
      throw n;
    }
  }
  async linkIdentityIdToken(e) {
    return await this._useSession(async (r) => {
      var n;
      try {
        const { error: s, data: { session: i } } = r;
        if (s)
          throw s;
        const { options: o, provider: a, token: c, access_token: u, nonce: l } = e, h = await x(this.fetch, "POST", `${this.url}/token?grant_type=id_token`, {
          headers: this.headers,
          jwt: (n = i == null ? void 0 : i.access_token) !== null && n !== void 0 ? n : void 0,
          body: {
            provider: a,
            id_token: c,
            access_token: u,
            nonce: l,
            link_identity: !0,
            gotrue_meta_security: { captcha_token: o == null ? void 0 : o.captchaToken }
          },
          xform: Le
        }), { data: f, error: d } = h;
        return d ? this._returnResult({ data: { user: null, session: null }, error: d }) : !f || !f.session || !f.user ? this._returnResult({
          data: { user: null, session: null },
          error: new lt()
        }) : (f.session && (await this._saveSession(f.session), await this._notifyAllSubscribers("USER_UPDATED", f.session)), this._returnResult({ data: f, error: d }));
      } catch (s) {
        if (await _e(this.storage, `${this.storageKey}-code-verifier`), U(s))
          return this._returnResult({ data: { user: null, session: null }, error: s });
        throw s;
      }
    });
  }
  /**
   * Unlinks an identity from a user by deleting it. The user will no longer be able to sign in with that identity once it's unlinked.
   *
   * @category Auth
   *
   * @remarks
   * - The **Enable Manual Linking** option must be enabled from your [project's authentication settings](/dashboard/project/_/auth/providers).
   * - The user needs to be signed in to call `unlinkIdentity()`.
   * - The user must have at least 2 identities in order to unlink an identity.
   * - The identity to be unlinked must belong to the user.
   *
   * @example Unlink an identity
   * ```js
   * // retrieve all identities linked to a user
   * const identities = await supabase.auth.getUserIdentities()
   *
   * // find the google identity
   * const googleIdentity = identities.find(
   *   identity => identity.provider === 'google'
   * )
   *
   * // unlink the google identity
   * const { error } = await supabase.auth.unlinkIdentity(googleIdentity)
   * ```
   */
  async unlinkIdentity(e) {
    try {
      return await this._useSession(async (r) => {
        var n, s;
        const { data: i, error: o } = r;
        if (o)
          throw o;
        return await x(this.fetch, "DELETE", `${this.url}/user/identities/${e.identity_id}`, {
          headers: this.headers,
          jwt: (s = (n = i.session) === null || n === void 0 ? void 0 : n.access_token) !== null && s !== void 0 ? s : void 0
        });
      });
    } catch (r) {
      if (U(r))
        return this._returnResult({ data: null, error: r });
      throw r;
    }
  }
  /**
   * Generates a new JWT.
   * @param refreshToken A valid refresh token that was returned on login.
   */
  async _refreshAccessToken(e) {
    const r = `#_refreshAccessToken(${e.substring(0, 5)}...)`;
    this._debug(r, "begin");
    try {
      const n = Date.now();
      return await $f(async (s) => (s > 0 && await Uf(200 * Math.pow(2, s - 1)), this._debug(r, "refreshing attempt", s), await x(this.fetch, "POST", `${this.url}/token?grant_type=refresh_token`, {
        body: { refresh_token: e },
        headers: this.headers,
        xform: Le
      })), (s, i) => {
        const o = 200 * Math.pow(2, s);
        return i && Yr(i) && // retryable only if the request can be sent before the backoff overflows the tick duration
        Date.now() + o - n < gt;
      });
    } catch (n) {
      if (this._debug(r, "error", n), U(n))
        return this._returnResult({ data: { session: null, user: null }, error: n });
      throw n;
    } finally {
      this._debug(r, "end");
    }
  }
  _isValidSession(e) {
    return typeof e == "object" && e !== null && "access_token" in e && "refresh_token" in e && "expires_at" in e;
  }
  async _handleProviderSignIn(e, r) {
    const n = await this._getUrlForProvider(`${this.url}/authorize`, e, {
      redirectTo: r.redirectTo,
      scopes: r.scopes,
      queryParams: r.queryParams
    });
    return this._debug("#_handleProviderSignIn()", "provider", e, "options", r, "url", n), ye() && !r.skipBrowserRedirect && window.location.assign(n), { data: { provider: e, url: n }, error: null };
  }
  /**
   * Recovers the session from LocalStorage and refreshes the token
   * Note: this method is async to accommodate for AsyncStorage e.g. in React native.
   */
  async _recoverAndRefresh() {
    var e, r;
    const n = "#_recoverAndRefresh()";
    this._debug(n, "begin");
    try {
      const s = await Ye(this.storage, this.storageKey);
      if (s && this.userStorage) {
        let o = await Ye(this.userStorage, this.storageKey + "-user");
        !this.storage.isServer && Object.is(this.storage, this.userStorage) && !o && (o = { user: s.user }, await _t(this.userStorage, this.storageKey + "-user", o)), s.user = (e = o == null ? void 0 : o.user) !== null && e !== void 0 ? e : Qr();
      } else if (s && !s.user && !s.user) {
        const o = await Ye(this.storage, this.storageKey + "-user");
        o && (o != null && o.user) ? (s.user = o.user, await _e(this.storage, this.storageKey + "-user"), await _t(this.storage, this.storageKey, s)) : s.user = Qr();
      }
      if (this._debug(n, "session from storage", s), !this._isValidSession(s)) {
        this._debug(n, "session is not valid"), s !== null && await this._removeSession();
        return;
      }
      const i = ((r = s.expires_at) !== null && r !== void 0 ? r : 1 / 0) * 1e3 - Date.now() < Xr;
      if (this._debug(n, `session has${i ? "" : " not"} expired with margin of ${Xr}s`), i) {
        if (this.autoRefreshToken && s.refresh_token) {
          const { error: o } = await this._callRefreshToken(s.refresh_token);
          o && (console.error(o), Yr(o) || (this._debug(n, "refresh failed with a non-retryable error, removing the session", o), await this._removeSession()));
        }
      } else if (s.user && s.user.__isUserNotAvailableProxy === !0)
        try {
          const { data: o, error: a } = await this._getUser(s.access_token);
          !a && (o != null && o.user) ? (s.user = o.user, await this._saveSession(s), await this._notifyAllSubscribers("SIGNED_IN", s)) : this._debug(n, "could not get user data, skipping SIGNED_IN notification");
        } catch (o) {
          console.error("Error getting user data:", o), this._debug(n, "error getting user data, skipping SIGNED_IN notification", o);
        }
      else
        await this._notifyAllSubscribers("SIGNED_IN", s);
    } catch (s) {
      this._debug(n, "error", s), console.error(s);
      return;
    } finally {
      this._debug(n, "end");
    }
  }
  async _callRefreshToken(e) {
    var r, n;
    if (!e)
      throw new Ae();
    if (this.refreshingDeferred)
      return this.refreshingDeferred.promise;
    const s = `#_callRefreshToken(${e.substring(0, 5)}...)`;
    this._debug(s, "begin");
    try {
      this.refreshingDeferred = new Lr();
      const { data: i, error: o } = await this._refreshAccessToken(e);
      if (o)
        throw o;
      if (!i.session)
        throw new Ae();
      await this._saveSession(i.session), await this._notifyAllSubscribers("TOKEN_REFRESHED", i.session);
      const a = { data: i.session, error: null };
      return this.refreshingDeferred.resolve(a), a;
    } catch (i) {
      if (this._debug(s, "error", i), U(i)) {
        const o = { data: null, error: i };
        return Yr(i) || await this._removeSession(), (r = this.refreshingDeferred) === null || r === void 0 || r.resolve(o), o;
      }
      throw (n = this.refreshingDeferred) === null || n === void 0 || n.reject(i), i;
    } finally {
      this.refreshingDeferred = null, this._debug(s, "end");
    }
  }
  async _notifyAllSubscribers(e, r, n = !0) {
    const s = `#_notifyAllSubscribers(${e})`;
    this._debug(s, "begin", r, `broadcast = ${n}`);
    try {
      this.broadcastChannel && n && this.broadcastChannel.postMessage({ event: e, session: r });
      const i = [], o = Array.from(this.stateChangeEmitters.values()).map(async (a) => {
        try {
          await a.callback(e, r);
        } catch (c) {
          i.push(c);
        }
      });
      if (await Promise.all(o), i.length > 0) {
        for (let a = 0; a < i.length; a += 1)
          console.error(i[a]);
        throw i[0];
      }
    } finally {
      this._debug(s, "end");
    }
  }
  /**
   * set currentSession and currentUser
   * process to _startAutoRefreshToken if possible
   */
  async _saveSession(e) {
    this._debug("#_saveSession()", e), this.suppressGetSessionWarning = !0, await _e(this.storage, `${this.storageKey}-code-verifier`);
    const r = Object.assign({}, e), n = r.user && r.user.__isUserNotAvailableProxy === !0;
    if (this.userStorage) {
      !n && r.user && await _t(this.userStorage, this.storageKey + "-user", {
        user: r.user
      });
      const s = Object.assign({}, r);
      delete s.user;
      const i = Ws(s);
      await _t(this.storage, this.storageKey, i);
    } else {
      const s = Ws(r);
      await _t(this.storage, this.storageKey, s);
    }
  }
  async _removeSession() {
    this._debug("#_removeSession()"), this.suppressGetSessionWarning = !1, await _e(this.storage, this.storageKey), await _e(this.storage, this.storageKey + "-code-verifier"), await _e(this.storage, this.storageKey + "-user"), this.userStorage && await _e(this.userStorage, this.storageKey + "-user"), await this._notifyAllSubscribers("SIGNED_OUT", null);
  }
  /**
   * Removes any registered visibilitychange callback.
   *
   * {@see #startAutoRefresh}
   * {@see #stopAutoRefresh}
   */
  _removeVisibilityChangedCallback() {
    this._debug("#_removeVisibilityChangedCallback()");
    const e = this.visibilityChangedCallback;
    this.visibilityChangedCallback = null;
    try {
      e && ye() && (window != null && window.removeEventListener) && window.removeEventListener("visibilitychange", e);
    } catch (r) {
      console.error("removing visibilitychange callback failed", r);
    }
  }
  /**
   * This is the private implementation of {@link #startAutoRefresh}. Use this
   * within the library.
   */
  async _startAutoRefresh() {
    await this._stopAutoRefresh(), this._debug("#_startAutoRefresh()");
    const e = setInterval(() => this._autoRefreshTokenTick(), gt);
    this.autoRefreshTicker = e, e && typeof e == "object" && typeof e.unref == "function" ? e.unref() : typeof Deno < "u" && typeof Deno.unrefTimer == "function" && Deno.unrefTimer(e);
    const r = setTimeout(async () => {
      await this.initializePromise, await this._autoRefreshTokenTick();
    }, 0);
    this.autoRefreshTickTimeout = r, r && typeof r == "object" && typeof r.unref == "function" ? r.unref() : typeof Deno < "u" && typeof Deno.unrefTimer == "function" && Deno.unrefTimer(r);
  }
  /**
   * This is the private implementation of {@link #stopAutoRefresh}. Use this
   * within the library.
   */
  async _stopAutoRefresh() {
    this._debug("#_stopAutoRefresh()");
    const e = this.autoRefreshTicker;
    this.autoRefreshTicker = null, e && clearInterval(e);
    const r = this.autoRefreshTickTimeout;
    this.autoRefreshTickTimeout = null, r && clearTimeout(r);
  }
  /**
   * Starts an auto-refresh process in the background. The session is checked
   * every few seconds. Close to the time of expiration a process is started to
   * refresh the session. If refreshing fails it will be retried for as long as
   * necessary.
   *
   * If you set the {@link GoTrueClientOptions#autoRefreshToken} you don't need
   * to call this function, it will be called for you.
   *
   * On browsers the refresh process works only when the tab/window is in the
   * foreground to conserve resources as well as prevent race conditions and
   * flooding auth with requests. If you call this method any managed
   * visibility change callback will be removed and you must manage visibility
   * changes on your own.
   *
   * On non-browser platforms the refresh process works *continuously* in the
   * background, which may not be desirable. You should hook into your
   * platform's foreground indication mechanism and call these methods
   * appropriately to conserve resources.
   *
   * {@see #stopAutoRefresh}
   *
   * @category Auth
   *
   * @remarks
   * - Only useful in non-browser environments such as React Native or Electron.
   * - The Supabase Auth library automatically starts and stops proactively refreshing the session when a tab is focused or not.
   * - On non-browser platforms, such as mobile or desktop apps built with web technologies, the library is not able to effectively determine whether the application is _focused_ or not.
   * - To give this hint to the application, you should be calling this method when the app is in focus and calling `supabase.auth.stopAutoRefresh()` when it's out of focus.
   *
   * @example Start and stop auto refresh in React Native
   * ```js
   * import { AppState } from 'react-native'
   *
   * // make sure you register this only once!
   * AppState.addEventListener('change', (state) => {
   *   if (state === 'active') {
   *     supabase.auth.startAutoRefresh()
   *   } else {
   *     supabase.auth.stopAutoRefresh()
   *   }
   * })
   * ```
   */
  async startAutoRefresh() {
    this._removeVisibilityChangedCallback(), await this._startAutoRefresh();
  }
  /**
   * Stops an active auto refresh process running in the background (if any).
   *
   * If you call this method any managed visibility change callback will be
   * removed and you must manage visibility changes on your own.
   *
   * See {@link #startAutoRefresh} for more details.
   *
   * @category Auth
   *
   * @remarks
   * - Only useful in non-browser environments such as React Native or Electron.
   * - The Supabase Auth library automatically starts and stops proactively refreshing the session when a tab is focused or not.
   * - On non-browser platforms, such as mobile or desktop apps built with web technologies, the library is not able to effectively determine whether the application is _focused_ or not.
   * - When your application goes in the background or out of focus, call this method to stop the proactive refreshing of the session.
   *
   * @example Start and stop auto refresh in React Native
   * ```js
   * import { AppState } from 'react-native'
   *
   * // make sure you register this only once!
   * AppState.addEventListener('change', (state) => {
   *   if (state === 'active') {
   *     supabase.auth.startAutoRefresh()
   *   } else {
   *     supabase.auth.stopAutoRefresh()
   *   }
   * })
   * ```
   */
  async stopAutoRefresh() {
    this._removeVisibilityChangedCallback(), await this._stopAutoRefresh();
  }
  /**
   * Runs the auto refresh token tick.
   */
  async _autoRefreshTokenTick() {
    this._debug("#_autoRefreshTokenTick()", "begin");
    try {
      await this._acquireLock(0, async () => {
        try {
          const e = Date.now();
          try {
            return await this._useSession(async (r) => {
              const { data: { session: n } } = r;
              if (!n || !n.refresh_token || !n.expires_at) {
                this._debug("#_autoRefreshTokenTick()", "no session");
                return;
              }
              const s = Math.floor((n.expires_at * 1e3 - e) / gt);
              this._debug("#_autoRefreshTokenTick()", `access token expires in ${s} ticks, a tick lasts ${gt}ms, refresh threshold is ${gn} ticks`), s <= gn && await this._callRefreshToken(n.refresh_token);
            });
          } catch (r) {
            console.error("Auto refresh tick failed with error. This is likely a transient error.", r);
          }
        } finally {
          this._debug("#_autoRefreshTokenTick()", "end");
        }
      });
    } catch (e) {
      if (e.isAcquireTimeout || e instanceof fo)
        this._debug("auto refresh token tick lock not available");
      else
        throw e;
    }
  }
  /**
   * Registers callbacks on the browser / platform, which in-turn run
   * algorithms when the browser window/tab are in foreground. On non-browser
   * platforms it assumes always foreground.
   */
  async _handleVisibilityChange() {
    if (this._debug("#_handleVisibilityChange()"), !ye() || !(window != null && window.addEventListener))
      return this.autoRefreshToken && this.startAutoRefresh(), !1;
    try {
      this.visibilityChangedCallback = async () => {
        try {
          await this._onVisibilityChanged(!1);
        } catch (e) {
          this._debug("#visibilityChangedCallback", "error", e);
        }
      }, window == null || window.addEventListener("visibilitychange", this.visibilityChangedCallback), await this._onVisibilityChanged(!0);
    } catch (e) {
      console.error("_handleVisibilityChange", e);
    }
  }
  /**
   * Callback registered with `window.addEventListener('visibilitychange')`.
   */
  async _onVisibilityChanged(e) {
    const r = `#_onVisibilityChanged(${e})`;
    this._debug(r, "visibilityState", document.visibilityState), document.visibilityState === "visible" ? (this.autoRefreshToken && this._startAutoRefresh(), e || (await this.initializePromise, await this._acquireLock(this.lockAcquireTimeout, async () => {
      if (document.visibilityState !== "visible") {
        this._debug(r, "acquired the lock to recover the session, but the browser visibilityState is no longer visible, aborting");
        return;
      }
      await this._recoverAndRefresh();
    }))) : document.visibilityState === "hidden" && this.autoRefreshToken && this._stopAutoRefresh();
  }
  /**
   * Generates the relevant login URL for a third-party provider.
   * @param options.redirectTo A URL or mobile address to send the user to after they are confirmed.
   * @param options.scopes A space-separated list of scopes granted to the OAuth application.
   * @param options.queryParams An object of key-value pairs containing query parameters granted to the OAuth application.
   */
  async _getUrlForProvider(e, r, n) {
    const s = [`provider=${encodeURIComponent(r)}`];
    if (n != null && n.redirectTo && s.push(`redirect_to=${encodeURIComponent(n.redirectTo)}`), n != null && n.scopes && s.push(`scopes=${encodeURIComponent(n.scopes)}`), this.flowType === "pkce") {
      const [i, o] = await ht(this.storage, this.storageKey), a = new URLSearchParams({
        code_challenge: `${encodeURIComponent(i)}`,
        code_challenge_method: `${encodeURIComponent(o)}`
      });
      s.push(a.toString());
    }
    if (n != null && n.queryParams) {
      const i = new URLSearchParams(n.queryParams);
      s.push(i.toString());
    }
    return n != null && n.skipBrowserRedirect && s.push(`skip_http_redirect=${n.skipBrowserRedirect}`), `${e}?${s.join("&")}`;
  }
  async _unenroll(e) {
    try {
      return await this._useSession(async (r) => {
        var n;
        const { data: s, error: i } = r;
        return i ? this._returnResult({ data: null, error: i }) : await x(this.fetch, "DELETE", `${this.url}/factors/${e.factorId}`, {
          headers: this.headers,
          jwt: (n = s == null ? void 0 : s.session) === null || n === void 0 ? void 0 : n.access_token
        });
      });
    } catch (r) {
      if (U(r))
        return this._returnResult({ data: null, error: r });
      throw r;
    }
  }
  async _enroll(e) {
    try {
      return await this._useSession(async (r) => {
        var n, s;
        const { data: i, error: o } = r;
        if (o)
          return this._returnResult({ data: null, error: o });
        const a = Object.assign({ friendly_name: e.friendlyName, factor_type: e.factorType }, e.factorType === "phone" ? { phone: e.phone } : e.factorType === "totp" ? { issuer: e.issuer } : {}), { data: c, error: u } = await x(this.fetch, "POST", `${this.url}/factors`, {
          body: a,
          headers: this.headers,
          jwt: (n = i == null ? void 0 : i.session) === null || n === void 0 ? void 0 : n.access_token
        });
        return u ? this._returnResult({ data: null, error: u }) : (e.factorType === "totp" && c.type === "totp" && (!((s = c == null ? void 0 : c.totp) === null || s === void 0) && s.qr_code) && (c.totp.qr_code = `data:image/svg+xml;utf-8,${c.totp.qr_code}`), this._returnResult({ data: c, error: null }));
      });
    } catch (r) {
      if (U(r))
        return this._returnResult({ data: null, error: r });
      throw r;
    }
  }
  async _verify(e) {
    return this._acquireLock(this.lockAcquireTimeout, async () => {
      try {
        return await this._useSession(async (r) => {
          var n;
          const { data: s, error: i } = r;
          if (i)
            return this._returnResult({ data: null, error: i });
          const o = Object.assign({ challenge_id: e.challengeId }, "webauthn" in e ? {
            webauthn: Object.assign(Object.assign({}, e.webauthn), { credential_response: e.webauthn.type === "create" ? hp(e.webauthn.credential_response) : dp(e.webauthn.credential_response) })
          } : { code: e.code }), { data: a, error: c } = await x(this.fetch, "POST", `${this.url}/factors/${e.factorId}/verify`, {
            body: o,
            headers: this.headers,
            jwt: (n = s == null ? void 0 : s.session) === null || n === void 0 ? void 0 : n.access_token
          });
          return c ? this._returnResult({ data: null, error: c }) : (await this._saveSession(Object.assign({ expires_at: Math.round(Date.now() / 1e3) + a.expires_in }, a)), await this._notifyAllSubscribers("MFA_CHALLENGE_VERIFIED", a), this._returnResult({ data: a, error: c }));
        });
      } catch (r) {
        if (U(r))
          return this._returnResult({ data: null, error: r });
        throw r;
      }
    });
  }
  async _challenge(e) {
    return this._acquireLock(this.lockAcquireTimeout, async () => {
      try {
        return await this._useSession(async (r) => {
          var n;
          const { data: s, error: i } = r;
          if (i)
            return this._returnResult({ data: null, error: i });
          const o = await x(this.fetch, "POST", `${this.url}/factors/${e.factorId}/challenge`, {
            body: e,
            headers: this.headers,
            jwt: (n = s == null ? void 0 : s.session) === null || n === void 0 ? void 0 : n.access_token
          });
          if (o.error)
            return o;
          const { data: a } = o;
          if (a.type !== "webauthn")
            return { data: a, error: null };
          switch (a.webauthn.type) {
            case "create":
              return {
                data: Object.assign(Object.assign({}, a), { webauthn: Object.assign(Object.assign({}, a.webauthn), { credential_options: Object.assign(Object.assign({}, a.webauthn.credential_options), { publicKey: up(a.webauthn.credential_options.publicKey) }) }) }),
                error: null
              };
            case "request":
              return {
                data: Object.assign(Object.assign({}, a), { webauthn: Object.assign(Object.assign({}, a.webauthn), { credential_options: Object.assign(Object.assign({}, a.webauthn.credential_options), { publicKey: lp(a.webauthn.credential_options.publicKey) }) }) }),
                error: null
              };
          }
        });
      } catch (r) {
        if (U(r))
          return this._returnResult({ data: null, error: r });
        throw r;
      }
    });
  }
  /**
   * {@see GoTrueMFAApi#challengeAndVerify}
   */
  async _challengeAndVerify(e) {
    const { data: r, error: n } = await this._challenge({
      factorId: e.factorId
    });
    return n ? this._returnResult({ data: null, error: n }) : await this._verify({
      factorId: e.factorId,
      challengeId: r.id,
      code: e.code
    });
  }
  /**
   * {@see GoTrueMFAApi#listFactors}
   */
  async _listFactors() {
    var e;
    const { data: { user: r }, error: n } = await this.getUser();
    if (n)
      return { data: null, error: n };
    const s = {
      all: [],
      phone: [],
      totp: [],
      webauthn: []
    };
    for (const i of (e = r == null ? void 0 : r.factors) !== null && e !== void 0 ? e : [])
      s.all.push(i), i.status === "verified" && s[i.factor_type].push(i);
    return {
      data: s,
      error: null
    };
  }
  /**
   * {@see GoTrueMFAApi#getAuthenticatorAssuranceLevel}
   */
  async _getAuthenticatorAssuranceLevel(e) {
    var r, n, s, i;
    if (e)
      try {
        const { payload: d } = or(e);
        let g = null;
        d.aal && (g = d.aal);
        let y = g;
        const { data: { user: I }, error: k } = await this.getUser(e);
        if (k)
          return this._returnResult({ data: null, error: k });
        ((n = (r = I == null ? void 0 : I.factors) === null || r === void 0 ? void 0 : r.filter((m) => m.status === "verified")) !== null && n !== void 0 ? n : []).length > 0 && (y = "aal2");
        const S = d.amr || [];
        return { data: { currentLevel: g, nextLevel: y, currentAuthenticationMethods: S }, error: null };
      } catch (d) {
        if (U(d))
          return this._returnResult({ data: null, error: d });
        throw d;
      }
    const { data: { session: o }, error: a } = await this.getSession();
    if (a)
      return this._returnResult({ data: null, error: a });
    if (!o)
      return {
        data: { currentLevel: null, nextLevel: null, currentAuthenticationMethods: [] },
        error: null
      };
    const { payload: c } = or(o.access_token);
    let u = null;
    c.aal && (u = c.aal);
    let l = u;
    ((i = (s = o.user.factors) === null || s === void 0 ? void 0 : s.filter((d) => d.status === "verified")) !== null && i !== void 0 ? i : []).length > 0 && (l = "aal2");
    const f = c.amr || [];
    return { data: { currentLevel: u, nextLevel: l, currentAuthenticationMethods: f }, error: null };
  }
  /**
   * Retrieves details about an OAuth authorization request.
   * Only relevant when the OAuth 2.1 server is enabled in Supabase Auth.
   *
   * Returns authorization details including client info, scopes, and user information.
   * If the response includes only a redirect_url field, it means consent was already given - the caller
   * should handle the redirect manually if needed.
   */
  async _getAuthorizationDetails(e) {
    try {
      return await this._useSession(async (r) => {
        const { data: { session: n }, error: s } = r;
        return s ? this._returnResult({ data: null, error: s }) : n ? await x(this.fetch, "GET", `${this.url}/oauth/authorizations/${e}`, {
          headers: this.headers,
          jwt: n.access_token,
          xform: (i) => ({ data: i, error: null })
        }) : this._returnResult({ data: null, error: new Ae() });
      });
    } catch (r) {
      if (U(r))
        return this._returnResult({ data: null, error: r });
      throw r;
    }
  }
  /**
   * Approves an OAuth authorization request.
   * Only relevant when the OAuth 2.1 server is enabled in Supabase Auth.
   */
  async _approveAuthorization(e, r) {
    try {
      return await this._useSession(async (n) => {
        const { data: { session: s }, error: i } = n;
        if (i)
          return this._returnResult({ data: null, error: i });
        if (!s)
          return this._returnResult({ data: null, error: new Ae() });
        const o = await x(this.fetch, "POST", `${this.url}/oauth/authorizations/${e}/consent`, {
          headers: this.headers,
          jwt: s.access_token,
          body: { action: "approve" },
          xform: (a) => ({ data: a, error: null })
        });
        return o.data && o.data.redirect_url && ye() && !(r != null && r.skipBrowserRedirect) && window.location.assign(o.data.redirect_url), o;
      });
    } catch (n) {
      if (U(n))
        return this._returnResult({ data: null, error: n });
      throw n;
    }
  }
  /**
   * Denies an OAuth authorization request.
   * Only relevant when the OAuth 2.1 server is enabled in Supabase Auth.
   */
  async _denyAuthorization(e, r) {
    try {
      return await this._useSession(async (n) => {
        const { data: { session: s }, error: i } = n;
        if (i)
          return this._returnResult({ data: null, error: i });
        if (!s)
          return this._returnResult({ data: null, error: new Ae() });
        const o = await x(this.fetch, "POST", `${this.url}/oauth/authorizations/${e}/consent`, {
          headers: this.headers,
          jwt: s.access_token,
          body: { action: "deny" },
          xform: (a) => ({ data: a, error: null })
        });
        return o.data && o.data.redirect_url && ye() && !(r != null && r.skipBrowserRedirect) && window.location.assign(o.data.redirect_url), o;
      });
    } catch (n) {
      if (U(n))
        return this._returnResult({ data: null, error: n });
      throw n;
    }
  }
  /**
   * Lists all OAuth grants that the authenticated user has authorized.
   * Only relevant when the OAuth 2.1 server is enabled in Supabase Auth.
   */
  async _listOAuthGrants() {
    try {
      return await this._useSession(async (e) => {
        const { data: { session: r }, error: n } = e;
        return n ? this._returnResult({ data: null, error: n }) : r ? await x(this.fetch, "GET", `${this.url}/user/oauth/grants`, {
          headers: this.headers,
          jwt: r.access_token,
          xform: (s) => ({ data: s, error: null })
        }) : this._returnResult({ data: null, error: new Ae() });
      });
    } catch (e) {
      if (U(e))
        return this._returnResult({ data: null, error: e });
      throw e;
    }
  }
  /**
   * Revokes a user's OAuth grant for a specific client.
   * Only relevant when the OAuth 2.1 server is enabled in Supabase Auth.
   */
  async _revokeOAuthGrant(e) {
    try {
      return await this._useSession(async (r) => {
        const { data: { session: n }, error: s } = r;
        return s ? this._returnResult({ data: null, error: s }) : n ? (await x(this.fetch, "DELETE", `${this.url}/user/oauth/grants`, {
          headers: this.headers,
          jwt: n.access_token,
          query: { client_id: e.clientId },
          noResolveJson: !0
        }), { data: {}, error: null }) : this._returnResult({ data: null, error: new Ae() });
      });
    } catch (r) {
      if (U(r))
        return this._returnResult({ data: null, error: r });
      throw r;
    }
  }
  async fetchJwk(e, r = { keys: [] }) {
    let n = r.keys.find((a) => a.kid === e);
    if (n)
      return n;
    const s = Date.now();
    if (n = this.jwks.keys.find((a) => a.kid === e), n && this.jwks_cached_at + wf > s)
      return n;
    const { data: i, error: o } = await x(this.fetch, "GET", `${this.url}/.well-known/jwks.json`, {
      headers: this.headers
    });
    if (o)
      throw o;
    return !i.keys || i.keys.length === 0 || (this.jwks = i, this.jwks_cached_at = s, n = i.keys.find((a) => a.kid === e), !n) ? null : n;
  }
  /**
   * Extracts the JWT claims present in the access token by first verifying the
   * JWT against the server's JSON Web Key Set endpoint
   * `/.well-known/jwks.json` which is often cached, resulting in significantly
   * faster responses. Prefer this method over {@link #getUser} which always
   * sends a request to the Auth server for each JWT.
   *
   * If the project is not using an asymmetric JWT signing key (like ECC or
   * RSA) it always sends a request to the Auth server (similar to {@link
   * #getUser}) to verify the JWT.
   *
   * @param jwt An optional specific JWT you wish to verify, not the one you
   *            can obtain from {@link #getSession}.
   * @param options Various additional options that allow you to customize the
   *                behavior of this method.
   *
   * @category Auth
   *
   * @remarks
   * - Parses the user's [access token](/docs/guides/auth/sessions#access-token-jwt-claims) as a [JSON Web Token (JWT)](/docs/guides/auth/jwts) and returns its components if valid and not expired.
   * - If your project is using asymmetric JWT signing keys, then the verification is done locally usually without a network request using the [WebCrypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API).
   * - A network request is sent to your project's JWT signing key discovery endpoint `https://project-id.supabase.co/auth/v1/.well-known/jwks.json`, which is cached locally. If your environment is ephemeral, such as a Lambda function that is destroyed after every request, a network request will be sent for each new invocation. Supabase provides a network-edge cache providing fast responses for these situations.
   * - If the user's access token is about to expire when calling this function, the user's session will first be refreshed before validating the JWT.
   * - If your project is using a symmetric secret to sign the JWT, it always sends a request similar to `getUser()` to validate the JWT at the server before returning the decoded token. This is also used if the WebCrypto API is not available in the environment. Make sure you polyfill it in such situations.
   * - The returned claims can be customized per project using the [Custom Access Token Hook](/docs/guides/auth/auth-hooks/custom-access-token-hook).
   *
   * @example Get JWT claims, header and signature
   * ```js
   * const { data, error } = await supabase.auth.getClaims()
   * ```
   *
   * @exampleResponse Get JWT claims, header and signature
   * ```json
   * {
   *   "data": {
   *     "claims": {
   *       "aal": "aal1",
   *       "amr": [{
   *         "method": "email",
   *         "timestamp": 1715766000
   *       }],
   *       "app_metadata": {},
   *       "aud": "authenticated",
   *       "email": "example@email.com",
   *       "exp": 1715769600,
   *       "iat": 1715766000,
   *       "is_anonymous": false,
   *       "iss": "https://project-id.supabase.co/auth/v1",
   *       "phone": "+13334445555",
   *       "role": "authenticated",
   *       "session_id": "11111111-1111-1111-1111-111111111111",
   *       "sub": "11111111-1111-1111-1111-111111111111",
   *       "user_metadata": {}
   *     },
   *     "header": {
   *       "alg": "RS256",
   *       "typ": "JWT",
   *       "kid": "11111111-1111-1111-1111-111111111111"
   *     },
   *     "signature": [/** Uint8Array *\/],
   *   },
   *   "error": null
   * }
   * ```
   */
  async getClaims(e, r = {}) {
    try {
      let n = e;
      if (!n) {
        const { data: d, error: g } = await this.getSession();
        if (g || !d.session)
          return this._returnResult({ data: null, error: g });
        n = d.session.access_token;
      }
      const { header: s, payload: i, signature: o, raw: { header: a, payload: c } } = or(n);
      r != null && r.allowExpired || Zf(i.exp);
      const u = !s.alg || s.alg.startsWith("HS") || !s.kid || !("crypto" in globalThis && "subtle" in globalThis.crypto) ? null : await this.fetchJwk(s.kid, r != null && r.keys ? { keys: r.keys } : r == null ? void 0 : r.jwks);
      if (!u) {
        const { error: d } = await this.getUser(n);
        if (d)
          throw d;
        return {
          data: {
            claims: i,
            header: s,
            signature: o
          },
          error: null
        };
      }
      const l = Hf(s.alg), h = await crypto.subtle.importKey("jwk", u, l, !0, [
        "verify"
      ]);
      if (!await crypto.subtle.verify(l, h, o, If(`${a}.${c}`)))
        throw new En("Invalid JWT signature");
      return {
        data: {
          claims: i,
          header: s,
          signature: o
        },
        error: null
      };
    } catch (n) {
      if (U(n))
        return this._returnResult({ data: null, error: n });
      throw n;
    }
  }
}
Zt.nextInstanceID = {};
const wp = Zt, bp = "2.104.1";
let Ct = "";
typeof Deno < "u" ? Ct = "deno" : typeof document < "u" ? Ct = "web" : typeof navigator < "u" && navigator.product === "ReactNative" ? Ct = "react-native" : Ct = "node";
const Tp = { "X-Client-Info": `supabase-js-${Ct}/${bp}` }, Sp = { headers: Tp }, Op = { schema: "public" }, Ap = {
  autoRefreshToken: !0,
  persistSession: !0,
  detectSessionInUrl: !0,
  flowType: "implicit"
}, kp = {};
function Ht(t) {
  "@babel/helpers - typeof";
  return Ht = typeof Symbol == "function" && typeof Symbol.iterator == "symbol" ? function(e) {
    return typeof e;
  } : function(e) {
    return e && typeof Symbol == "function" && e.constructor === Symbol && e !== Symbol.prototype ? "symbol" : typeof e;
  }, Ht(t);
}
function Rp(t, e) {
  if (Ht(t) != "object" || !t) return t;
  var r = t[Symbol.toPrimitive];
  if (r !== void 0) {
    var n = r.call(t, e);
    if (Ht(n) != "object") return n;
    throw new TypeError("@@toPrimitive must return a primitive value.");
  }
  return (e === "string" ? String : Number)(t);
}
function Np(t) {
  var e = Rp(t, "string");
  return Ht(e) == "symbol" ? e : e + "";
}
function Ip(t, e, r) {
  return (e = Np(e)) in t ? Object.defineProperty(t, e, {
    value: r,
    enumerable: !0,
    configurable: !0,
    writable: !0
  }) : t[e] = r, t;
}
function ei(t, e) {
  var r = Object.keys(t);
  if (Object.getOwnPropertySymbols) {
    var n = Object.getOwnPropertySymbols(t);
    e && (n = n.filter(function(s) {
      return Object.getOwnPropertyDescriptor(t, s).enumerable;
    })), r.push.apply(r, n);
  }
  return r;
}
function se(t) {
  for (var e = 1; e < arguments.length; e++) {
    var r = arguments[e] != null ? arguments[e] : {};
    e % 2 ? ei(Object(r), !0).forEach(function(n) {
      Ip(t, n, r[n]);
    }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(t, Object.getOwnPropertyDescriptors(r)) : ei(Object(r)).forEach(function(n) {
      Object.defineProperty(t, n, Object.getOwnPropertyDescriptor(r, n));
    });
  }
  return t;
}
const Lp = (t) => t ? (...e) => t(...e) : (...e) => fetch(...e), Cp = () => Headers, Pp = (t, e, r) => {
  const n = Lp(r), s = Cp();
  return async (i, o) => {
    var a;
    const c = (a = await e()) !== null && a !== void 0 ? a : t;
    let u = new s(o == null ? void 0 : o.headers);
    return u.has("apikey") || u.set("apikey", t), u.has("Authorization") || u.set("Authorization", `Bearer ${c}`), n(i, se(se({}, o), {}, { headers: u }));
  };
};
function Dp(t) {
  return t.endsWith("/") ? t : t + "/";
}
function Up(t, e) {
  var r, n;
  const { db: s, auth: i, realtime: o, global: a } = t, { db: c, auth: u, realtime: l, global: h } = e, f = {
    db: se(se({}, c), s),
    auth: se(se({}, u), i),
    realtime: se(se({}, l), o),
    storage: {},
    global: se(se(se({}, h), a), {}, { headers: se(se({}, (r = h == null ? void 0 : h.headers) !== null && r !== void 0 ? r : {}), (n = a == null ? void 0 : a.headers) !== null && n !== void 0 ? n : {}) }),
    accessToken: async () => ""
  };
  return t.accessToken ? f.accessToken = t.accessToken : delete f.accessToken, f;
}
function $p(t) {
  const e = t == null ? void 0 : t.trim();
  if (!e) throw new Error("supabaseUrl is required.");
  if (!e.match(/^https?:\/\//i)) throw new Error("Invalid supabaseUrl: Must be a valid HTTP or HTTPS URL.");
  try {
    return new URL(Dp(e));
  } catch {
    throw Error("Invalid supabaseUrl: Provided URL is malformed.");
  }
}
var jp = class extends wp {
  constructor(t) {
    super(t);
  }
}, xp = class {
  /**
  * Create a new client for use in the browser.
  *
  * @category Initializing
  *
  * @param supabaseUrl The unique Supabase URL which is supplied when you create a new project in your project dashboard.
  * @param supabaseKey The unique Supabase Key which is supplied when you create a new project in your project dashboard.
  * @param options.db.schema You can switch in between schemas. The schema needs to be on the list of exposed schemas inside Supabase.
  * @param options.auth.autoRefreshToken Set to "true" if you want to automatically refresh the token before expiring.
  * @param options.auth.persistSession Set to "true" if you want to automatically save the user session into local storage.
  * @param options.auth.detectSessionInUrl Set to "true" if you want to automatically detects OAuth grants in the URL and signs in the user.
  * @param options.realtime Options passed along to realtime-js constructor.
  * @param options.storage Options passed along to the storage-js constructor.
  * @param options.global.fetch A custom fetch implementation.
  * @param options.global.headers Any additional headers to send with each network request.
  *
  * @example Creating a client
  * ```js
  * import { createClient } from '@supabase/supabase-js'
  *
  * // Create a single supabase client for interacting with your database
  * const supabase = createClient('https://xyzcompany.supabase.co', 'publishable-or-anon-key')
  * ```
  *
  * @example With a custom domain
  * ```js
  * import { createClient } from '@supabase/supabase-js'
  *
  * // Use a custom domain as the supabase URL
  * const supabase = createClient('https://my-custom-domain.com', 'publishable-or-anon-key')
  * ```
  *
  * @example With additional parameters
  * ```js
  * import { createClient } from '@supabase/supabase-js'
  *
  * const options = {
  *   db: {
  *     schema: 'public',
  *   },
  *   auth: {
  *     autoRefreshToken: true,
  *     persistSession: true,
  *     detectSessionInUrl: true
  *   },
  *   global: {
  *     headers: { 'x-my-custom-header': 'my-app-name' },
  *   },
  * }
  * const supabase = createClient("https://xyzcompany.supabase.co", "publishable-or-anon-key", options)
  * ```
  *
  * @exampleDescription With custom schemas
  * By default the API server points to the `public` schema. You can enable other database schemas within the Dashboard.
  * Go to [Settings > API > Exposed schemas](/dashboard/project/_/settings/api) and add the schema which you want to expose to the API.
  *
  * Note: each client connection can only access a single schema, so the code above can access the `other_schema` schema but cannot access the `public` schema.
  *
  * @example With custom schemas
  * ```js
  * import { createClient } from '@supabase/supabase-js'
  *
  * const supabase = createClient('https://xyzcompany.supabase.co', 'publishable-or-anon-key', {
  *   // Provide a custom schema. Defaults to "public".
  *   db: { schema: 'other_schema' }
  * })
  * ```
  *
  * @exampleDescription Custom fetch implementation
  * `supabase-js` uses the [`cross-fetch`](https://www.npmjs.com/package/cross-fetch) library to make HTTP requests,
  * but an alternative `fetch` implementation can be provided as an option.
  * This is most useful in environments where `cross-fetch` is not compatible (for instance Cloudflare Workers).
  *
  * @example Custom fetch implementation
  * ```js
  * import { createClient } from '@supabase/supabase-js'
  *
  * const supabase = createClient('https://xyzcompany.supabase.co', 'publishable-or-anon-key', {
  *   global: { fetch: fetch.bind(globalThis) }
  * })
  * ```
  *
  * @exampleDescription React Native options with AsyncStorage
  * For React Native we recommend using `AsyncStorage` as the storage implementation for Supabase Auth.
  *
  * @example React Native options with AsyncStorage
  * ```js
  * import 'react-native-url-polyfill/auto'
  * import { createClient } from '@supabase/supabase-js'
  * import AsyncStorage from "@react-native-async-storage/async-storage";
  *
  * const supabase = createClient("https://xyzcompany.supabase.co", "publishable-or-anon-key", {
  *   auth: {
  *     storage: AsyncStorage,
  *     autoRefreshToken: true,
  *     persistSession: true,
  *     detectSessionInUrl: false,
  *   },
  * });
  * ```
  *
  * @exampleDescription React Native options with Expo SecureStore
  * If you wish to encrypt the user's session information, you can use `aes-js` and store the encryption key in Expo SecureStore.
  * The `aes-js` library, a reputable JavaScript-only implementation of the AES encryption algorithm in CTR mode.
  * A new 256-bit encryption key is generated using the `react-native-get-random-values` library.
  * This key is stored inside Expo's SecureStore, while the value is encrypted and placed inside AsyncStorage.
  *
  * Please make sure that:
  * - You keep the `expo-secure-store`, `aes-js` and `react-native-get-random-values` libraries up-to-date.
  * - Choose the correct [`SecureStoreOptions`](https://docs.expo.dev/versions/latest/sdk/securestore/#securestoreoptions) for your app's needs.
  *   E.g. [`SecureStore.WHEN_UNLOCKED`](https://docs.expo.dev/versions/latest/sdk/securestore/#securestorewhen_unlocked) regulates when the data can be accessed.
  * - Carefully consider optimizations or other modifications to the above example, as those can lead to introducing subtle security vulnerabilities.
  *
  * @example React Native options with Expo SecureStore
  * ```ts
  * import 'react-native-url-polyfill/auto'
  * import { createClient } from '@supabase/supabase-js'
  * import AsyncStorage from '@react-native-async-storage/async-storage';
  * import * as SecureStore from 'expo-secure-store';
  * import * as aesjs from 'aes-js';
  * import 'react-native-get-random-values';
  *
  * // As Expo's SecureStore does not support values larger than 2048
  * // bytes, an AES-256 key is generated and stored in SecureStore, while
  * // it is used to encrypt/decrypt values stored in AsyncStorage.
  * class LargeSecureStore {
  *   private async _encrypt(key: string, value: string) {
  *     const encryptionKey = crypto.getRandomValues(new Uint8Array(256 / 8));
  *
  *     const cipher = new aesjs.ModeOfOperation.ctr(encryptionKey, new aesjs.Counter(1));
  *     const encryptedBytes = cipher.encrypt(aesjs.utils.utf8.toBytes(value));
  *
  *     await SecureStore.setItemAsync(key, aesjs.utils.hex.fromBytes(encryptionKey));
  *
  *     return aesjs.utils.hex.fromBytes(encryptedBytes);
  *   }
  *
  *   private async _decrypt(key: string, value: string) {
  *     const encryptionKeyHex = await SecureStore.getItemAsync(key);
  *     if (!encryptionKeyHex) {
  *       return encryptionKeyHex;
  *     }
  *
  *     const cipher = new aesjs.ModeOfOperation.ctr(aesjs.utils.hex.toBytes(encryptionKeyHex), new aesjs.Counter(1));
  *     const decryptedBytes = cipher.decrypt(aesjs.utils.hex.toBytes(value));
  *
  *     return aesjs.utils.utf8.fromBytes(decryptedBytes);
  *   }
  *
  *   async getItem(key: string) {
  *     const encrypted = await AsyncStorage.getItem(key);
  *     if (!encrypted) { return encrypted; }
  *
  *     return await this._decrypt(key, encrypted);
  *   }
  *
  *   async removeItem(key: string) {
  *     await AsyncStorage.removeItem(key);
  *     await SecureStore.deleteItemAsync(key);
  *   }
  *
  *   async setItem(key: string, value: string) {
  *     const encrypted = await this._encrypt(key, value);
  *
  *     await AsyncStorage.setItem(key, encrypted);
  *   }
  * }
  *
  * const supabase = createClient("https://xyzcompany.supabase.co", "publishable-or-anon-key", {
  *   auth: {
  *     storage: new LargeSecureStore(),
  *     autoRefreshToken: true,
  *     persistSession: true,
  *     detectSessionInUrl: false,
  *   },
  * });
  * ```
  *
  * @example With a database query
  * ```ts
  * import { createClient } from '@supabase/supabase-js'
  *
  * const supabase = createClient('https://xyzcompany.supabase.co', 'publishable-or-anon-key')
  *
  * const { data } = await supabase.from('profiles').select('*')
  * ```
  */
  constructor(t, e, r) {
    var n, s;
    this.supabaseUrl = t, this.supabaseKey = e;
    const i = $p(t);
    if (!e) throw new Error("supabaseKey is required.");
    this.realtimeUrl = new URL("realtime/v1", i), this.realtimeUrl.protocol = this.realtimeUrl.protocol.replace("http", "ws"), this.authUrl = new URL("auth/v1", i), this.storageUrl = new URL("storage/v1", i), this.functionsUrl = new URL("functions/v1", i);
    const o = `sb-${i.hostname.split(".")[0]}-auth-token`, a = {
      db: Op,
      realtime: kp,
      auth: se(se({}, Ap), {}, { storageKey: o }),
      global: Sp
    }, c = Up(r ?? {}, a);
    if (this.storageKey = (n = c.auth.storageKey) !== null && n !== void 0 ? n : "", this.headers = (s = c.global.headers) !== null && s !== void 0 ? s : {}, c.accessToken)
      this.accessToken = c.accessToken, this.auth = new Proxy({}, { get: (l, h) => {
        throw new Error(`@supabase/supabase-js: Supabase Client is configured with the accessToken option, accessing supabase.auth.${String(h)} is not possible`);
      } });
    else {
      var u;
      this.auth = this._initSupabaseAuthClient((u = c.auth) !== null && u !== void 0 ? u : {}, this.headers, c.global.fetch);
    }
    this.fetch = Pp(e, this._getAccessToken.bind(this), c.global.fetch), this.realtime = this._initRealtimeClient(se({
      headers: this.headers,
      accessToken: this._getAccessToken.bind(this),
      fetch: this.fetch
    }, c.realtime)), this.accessToken && Promise.resolve(this.accessToken()).then((l) => this.realtime.setAuth(l)).catch((l) => console.warn("Failed to set initial Realtime auth token:", l)), this.rest = new sd(new URL("rest/v1", i).href, {
      headers: this.headers,
      schema: c.db.schema,
      fetch: this.fetch,
      timeout: c.db.timeout,
      urlLengthLimit: c.db.urlLengthLimit
    }), this.storage = new gf(this.storageUrl.href, this.headers, this.fetch, r == null ? void 0 : r.storage), c.accessToken || this._listenForAuthEvents();
  }
  /**
  * Supabase Functions allows you to deploy and invoke edge functions.
  */
  get functions() {
    return new Vh(this.functionsUrl.href, {
      headers: this.headers,
      customFetch: this.fetch
    });
  }
  /**
  * Perform a query on a table or a view.
  *
  * @param relation - The table or view name to query
  */
  from(t) {
    return this.rest.from(t);
  }
  /**
  * Select a schema to query or perform an function (rpc) call.
  *
  * The schema needs to be on the list of exposed schemas inside Supabase.
  *
  * @param schema - The schema to query
  */
  schema(t) {
    return this.rest.schema(t);
  }
  /**
  * Perform a function call.
  *
  * @param fn - The function name to call
  * @param args - The arguments to pass to the function call
  * @param options - Named parameters
  * @param options.head - When set to `true`, `data` will not be returned.
  * Useful if you only need the count.
  * @param options.get - When set to `true`, the function will be called with
  * read-only access mode.
  * @param options.count - Count algorithm to use to count rows returned by the
  * function. Only applicable for [set-returning
  * functions](https://www.postgresql.org/docs/current/functions-srf.html).
  *
  * `"exact"`: Exact but slow count algorithm. Performs a `COUNT(*)` under the
  * hood.
  *
  * `"planned"`: Approximated but fast count algorithm. Uses the Postgres
  * statistics under the hood.
  *
  * `"estimated"`: Uses exact count for low numbers and planned count for high
  * numbers.
  */
  rpc(t, e = {}, r = {
    head: !1,
    get: !1,
    count: void 0
  }) {
    return this.rest.rpc(t, e, r);
  }
  /**
  * Creates a Realtime channel with Broadcast, Presence, and Postgres Changes.
  *
  * @param {string} name - The name of the Realtime channel.
  * @param {Object} opts - The options to pass to the Realtime channel.
  *
  */
  channel(t, e = { config: {} }) {
    return this.realtime.channel(t, e);
  }
  /**
  * Returns all Realtime channels.
  *
  * @category Initializing
  *
  * @example Get all channels
  * ```js
  * const channels = supabase.getChannels()
  * ```
  */
  getChannels() {
    return this.realtime.getChannels();
  }
  /**
  * Unsubscribes and removes Realtime channel from Realtime client.
  *
  * @param {RealtimeChannel} channel - The name of the Realtime channel.
  *
  *
  * @category Initializing
  *
  * @remarks
  * - Removing a channel is a great way to maintain the performance of your project's Realtime service as well as your database if you're listening to Postgres changes. Supabase will automatically handle cleanup 30 seconds after a client is disconnected, but unused channels may cause degradation as more clients are simultaneously subscribed.
  *
  * @example Removes a channel
  * ```js
  * supabase.removeChannel(myChannel)
  * ```
  */
  removeChannel(t) {
    return this.realtime.removeChannel(t);
  }
  /**
  * Unsubscribes and removes all Realtime channels from Realtime client.
  *
  * @category Initializing
  *
  * @remarks
  * - Removing channels is a great way to maintain the performance of your project's Realtime service as well as your database if you're listening to Postgres changes. Supabase will automatically handle cleanup 30 seconds after a client is disconnected, but unused channels may cause degradation as more clients are simultaneously subscribed.
  *
  * @example Remove all channels
  * ```js
  * supabase.removeAllChannels()
  * ```
  */
  removeAllChannels() {
    return this.realtime.removeAllChannels();
  }
  async _getAccessToken() {
    var t = this, e, r;
    if (t.accessToken) return await t.accessToken();
    const { data: n } = await t.auth.getSession();
    return (e = (r = n.session) === null || r === void 0 ? void 0 : r.access_token) !== null && e !== void 0 ? e : t.supabaseKey;
  }
  _initSupabaseAuthClient({ autoRefreshToken: t, persistSession: e, detectSessionInUrl: r, storage: n, userStorage: s, storageKey: i, flowType: o, lock: a, debug: c, throwOnError: u }, l, h) {
    const f = {
      Authorization: `Bearer ${this.supabaseKey}`,
      apikey: `${this.supabaseKey}`
    };
    return new jp({
      url: this.authUrl.href,
      headers: se(se({}, f), l),
      storageKey: i,
      autoRefreshToken: t,
      persistSession: e,
      detectSessionInUrl: r,
      storage: n,
      userStorage: s,
      flowType: o,
      lock: a,
      debug: c,
      throwOnError: u,
      fetch: h,
      hasCustomAuthorizationHeader: Object.keys(this.headers).some((d) => d.toLowerCase() === "authorization")
    });
  }
  _initRealtimeClient(t) {
    return new xd(this.realtimeUrl.href, se(se({}, t), {}, { params: se(se({}, { apikey: this.supabaseKey }), t == null ? void 0 : t.params) }));
  }
  _listenForAuthEvents() {
    return this.auth.onAuthStateChange((t, e) => {
      this._handleTokenChanged(t, "CLIENT", e == null ? void 0 : e.access_token);
    });
  }
  _handleTokenChanged(t, e, r) {
    (t === "TOKEN_REFRESHED" || t === "SIGNED_IN") && this.changedAccessToken !== r ? (this.changedAccessToken = r, this.realtime.setAuth(r)) : t === "SIGNED_OUT" && (this.realtime.setAuth(), e == "STORAGE" && this.auth.signOut(), this.changedAccessToken = void 0);
  }
};
const Fp = (t, e, r) => new xp(t, e, r);
function zp() {
  if (typeof window < "u") return !1;
  const t = globalThis.process;
  if (!t) return !1;
  const e = t.version;
  if (e == null) return !1;
  const r = e.match(/^v(\d+)\./);
  return r ? parseInt(r[1], 10) <= 18 : !1;
}
zp() && console.warn("⚠️  Node.js 18 and below are deprecated and will no longer be supported in future versions of @supabase/supabase-js. Please upgrade to Node.js 20 or later. For more information, visit: https://github.com/orgs/supabase/discussions/37217");
const Bp = "https://hzjvddohqvokcmbkfwfp.supabase.co", vn = process.env.PHARMACY_LICENSE_SUPABASE_ANON_KEY ?? "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6anZkZG9ocXZva2NtYmtmd2ZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5NDMwNTksImV4cCI6MjA4OTUxOTA1OX0.hm3KpyrzJb8nFTmf0ff1KpHMt56WdRCJyfoAprTsAYY", Mp = 24 * 60 * 60 * 1e3;
function ti() {
  if (!vn || vn.length < 32)
    throw new Error("License server is not configured. Set PHARMACY_LICENSE_SUPABASE_ANON_KEY in main process.");
}
function ri(t) {
  const e = new Date(t);
  return new Date(Date.UTC(e.getUTCFullYear(), e.getUTCMonth(), e.getUTCDate()));
}
function ar(t) {
  const e = ri((/* @__PURE__ */ new Date()).toISOString()), r = ri(t);
  return Math.ceil((r.getTime() - e.getTime()) / (24 * 60 * 60 * 1e3));
}
class Zp {
  constructor() {
    kt(this, "supabase");
    kt(this, "licenseFilePath");
    this.supabase = Fp(Bp, vn, {
      auth: { persistSession: !1, autoRefreshToken: !1 }
    });
    const e = Y.getPath("userData");
    this.licenseFilePath = K.join(e, "license.json");
  }
  isActivated() {
    const e = this.readStoredLicense();
    return !!(e != null && e.shopId && (e != null && e.activationKey));
  }
  async activateLicense(e, r) {
    const n = String(e ?? "").trim(), s = String(r ?? "").trim();
    if (!n || !s)
      return this.invalidResult("inactive", "", "", "Shop ID and activation key are required.");
    try {
      ti();
    } catch (c) {
      return this.invalidResult("inactive", "", "", c instanceof Error ? c.message : "License server not configured.");
    }
    let i = null;
    try {
      i = await this.fetchLicense(n, s);
    } catch (c) {
      return this.invalidResult(
        "inactive",
        "",
        "",
        c instanceof Error ? c.message : "License validation request failed."
      );
    }
    if (!i)
      return this.invalidResult("inactive", "", "", "Activation failed. Invalid Shop ID or activation key.");
    const o = ar(i.expires_at);
    if (i.status !== "active" || o < 0)
      return this.invalidResult(
        o < 0 ? "expired" : i.status,
        i.expires_at,
        i.client_name ?? "",
        o < 0 ? "License has expired." : "License is not active."
      );
    const a = (/* @__PURE__ */ new Date()).toISOString();
    return await this.updateRemoteLastChecked(n, s, a), this.writeStoredLicense({
      shopId: n,
      activationKey: s,
      expiresAt: i.expires_at,
      clientName: i.client_name ?? "",
      lastSuccessfulCheck: a
    }), {
      isValid: !0,
      status: "active",
      expiresAt: i.expires_at,
      clientName: i.client_name ?? "",
      daysRemaining: o,
      message: "License activated successfully."
    };
  }
  async checkLicense() {
    const e = this.readStoredLicense();
    if (!e)
      return this.invalidResult("inactive", "", "", "License not activated.");
    const r = ar(e.expiresAt);
    if (r < 0)
      return this.invalidResult("expired", e.expiresAt, e.clientName, "License has expired.");
    try {
      ti();
    } catch (n) {
      return this.invalidResult(
        "inactive",
        e.expiresAt,
        e.clientName,
        n instanceof Error ? n.message : "License server not configured."
      );
    }
    try {
      const n = await this.fetchLicense(e.shopId, e.activationKey);
      if (!n)
        return this.invalidResult("inactive", e.expiresAt, e.clientName, "License not found.");
      const s = ar(n.expires_at), i = s < 0 ? "expired" : n.status;
      if (i !== "active")
        return this.invalidResult(
          i,
          n.expires_at,
          n.client_name ?? e.clientName,
          i === "expired" ? "License has expired." : "License is inactive."
        );
      const o = (/* @__PURE__ */ new Date()).toISOString();
      return await this.updateRemoteLastChecked(e.shopId, e.activationKey, o), this.writeStoredLicense({
        shopId: e.shopId,
        activationKey: e.activationKey,
        expiresAt: n.expires_at,
        clientName: n.client_name ?? e.clientName,
        lastSuccessfulCheck: o
      }), {
        isValid: !0,
        status: "active",
        expiresAt: n.expires_at,
        clientName: n.client_name ?? e.clientName,
        daysRemaining: s,
        message: "License is valid."
      };
    } catch {
      const n = new Date(e.lastSuccessfulCheck).getTime();
      return Date.now() - (Number.isFinite(n) ? n : 0) <= Mp ? {
        isValid: !0,
        status: "active",
        expiresAt: e.expiresAt,
        clientName: e.clientName,
        daysRemaining: r,
        message: "Offline mode: using last successful license check.",
        offlineMode: !0
      } : this.invalidResult(
        "inactive",
        e.expiresAt,
        e.clientName,
        "Unable to validate license. Connect to internet to continue."
      );
    }
  }
  clearLicense() {
    V.existsSync(this.licenseFilePath) && V.unlinkSync(this.licenseFilePath);
  }
  invalidResult(e, r, n, s) {
    return {
      isValid: !1,
      status: e,
      expiresAt: r,
      clientName: n,
      daysRemaining: r ? ar(r) : 0,
      message: s
    };
  }
  async fetchLicense(e, r) {
    const { data: n, error: s } = await this.supabase.from("licenses").select("*").eq("shop_id", e).eq("activation_key", r).single();
    if (s) {
      const i = s;
      if (i.code === "PGRST116") return null;
      throw new Error(i.message || "License server query failed.");
    }
    return n ?? null;
  }
  async updateRemoteLastChecked(e, r, n) {
    const { error: s } = await this.supabase.from("licenses").update({ last_checked_at: n }).eq("shop_id", e).eq("activation_key", r);
    if (s) throw s;
  }
  readStoredLicense() {
    if (!V.existsSync(this.licenseFilePath)) return null;
    try {
      const e = V.readFileSync(this.licenseFilePath, "utf8"), r = JSON.parse(e);
      return !r.shopId || !r.activationKey || !r.expiresAt || !r.lastSuccessfulCheck ? null : {
        shopId: r.shopId,
        activationKey: r.activationKey,
        expiresAt: r.expiresAt,
        clientName: r.clientName ?? "",
        lastSuccessfulCheck: r.lastSuccessfulCheck
      };
    } catch {
      return null;
    }
  }
  writeStoredLicense(e) {
    V.writeFileSync(this.licenseFilePath, JSON.stringify(e, null, 2), "utf8");
  }
}
const Hp = ee({
  shopId: M().trim().min(1),
  key: M().trim().min(1)
});
function qp() {
  const t = new Zp();
  ne.handle("license:isActivated", () => t.isActivated()), ne.handle("license:activate", async (e, r) => {
    const n = Hp.parse(r ?? {});
    return t.activateLicense(n.shopId, n.key);
  }), ne.handle("license:check", async () => t.checkLicense()), ne.handle("license:clear", async () => (t.clearLicense(), !0));
}
const Wp = ee({
  username: M().trim().min(1),
  email: M().trim().email(),
  password: M().min(6)
}), Kp = ee({
  identity: M().trim().min(1),
  password: M().min(1)
}), Vp = ee({
  userId: M().trim().min(1),
  currentPassword: M().min(1),
  nextPassword: M().min(6)
});
function cr(t, e) {
  return dr.scryptSync(t, e, 64).toString("hex");
}
function Gp(t) {
  ne.handle("auth:status", () => {
    const e = t.prepare("SELECT id, username, email FROM app_users ORDER BY created_at ASC LIMIT 1").get();
    return e ? { hasUser: !0, user: { id: e.id, username: e.username, email: e.email } } : { hasUser: !1, user: null };
  }), ne.handle("auth:createFirstUser", (e, r) => {
    const n = Wp.parse(r ?? {});
    if (t.prepare("SELECT id FROM app_users LIMIT 1").get())
      return { ok: !1, message: "Account is already configured." };
    const i = `usr_${dr.randomUUID().replace(/-/g, "").slice(0, 20)}`, o = dr.randomBytes(16).toString("hex"), a = cr(n.password, o), c = (/* @__PURE__ */ new Date()).toISOString();
    try {
      return t.prepare(
        `INSERT INTO app_users (id, username, email, password_hash, password_salt, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(i, n.username, n.email.toLowerCase(), a, o, c, c), { ok: !0, user: { id: i, username: n.username, email: n.email.toLowerCase() } };
    } catch {
      return { ok: !1, message: "Could not create account. Username/email may already exist." };
    }
  }), ne.handle("auth:login", (e, r) => {
    const n = Kp.parse(r ?? {}), s = n.identity.toLowerCase(), i = t.prepare("SELECT * FROM app_users WHERE lower(username) = ? OR lower(email) = ? LIMIT 1").get(s, s);
    return i ? cr(n.password, i.password_salt) !== i.password_hash ? { ok: !1, message: "Invalid username/email or password." } : { ok: !0, user: { id: i.id, username: i.username, email: i.email } } : { ok: !1, message: "Invalid username/email or password." };
  }), ne.handle("auth:changePassword", (e, r) => {
    const n = Vp.parse(r ?? {}), s = t.prepare("SELECT * FROM app_users WHERE id = ? LIMIT 1").get(n.userId);
    if (!s) return { ok: !1, message: "No account found." };
    if (cr(n.currentPassword, s.password_salt) !== s.password_hash) return { ok: !1, message: "Current password is incorrect." };
    if (n.nextPassword === n.currentPassword)
      return { ok: !1, message: "New password must be different from current password." };
    const o = dr.randomBytes(16).toString("hex"), a = cr(n.nextPassword, o);
    return t.prepare("UPDATE app_users SET password_hash = ?, password_salt = ?, updated_at = ? WHERE id = ?").run(
      a,
      o,
      (/* @__PURE__ */ new Date()).toISOString(),
      s.id
    ), { ok: !0 };
  });
}
let Qe = null;
function Jp() {
  return K.join(K.dirname(ot()), "medicines.db");
}
function Xp() {
  if (Qe) return Qe;
  const t = Jp();
  return V.mkdirSync(K.dirname(t), { recursive: !0 }), Qe = new oi(t), Qe.pragma("journal_mode = WAL"), Qe.pragma("foreign_keys = OFF"), Qe.exec(`
    DROP TABLE IF EXISTS batches;
    DROP TABLE IF EXISTS medicines;

    CREATE TABLE IF NOT EXISTS medicines (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category_hint TEXT NOT NULL DEFAULT '',
      type_hint TEXT NOT NULL DEFAULT ''
    );
  `), Qe;
}
function it(t) {
  const e = Xp(), r = t.prepare("SELECT id, name, category, type FROM medicines WHERE is_active = 1 ORDER BY name ASC").all();
  e.transaction(() => {
    e.prepare("DELETE FROM medicines").run();
    const n = e.prepare(`
      INSERT INTO medicines
      (id, name, category_hint, type_hint)
      VALUES (?, ?, ?, ?)
    `);
    for (const s of r)
      n.run(
        s.id,
        s.name,
        s.category ?? "",
        s.type ?? ""
      );
  })();
}
const me = M().trim().min(1), Yp = M().trim().min(1), go = ee({
  id: M().trim().optional(),
  name: M().trim().min(1),
  generic: M().optional().default(""),
  type: M().optional().default("tablet"),
  category: M().optional().default(""),
  unitType: M().optional().default("tablet"),
  unit: M().optional().default("Tablet"),
  tabletsPerPack: ie().int().min(1).optional().default(1),
  volumeMl: ie().min(0).optional().default(0),
  supplierId: M().nullable().optional(),
  supplierName: M().optional().default(""),
  manufacturerId: M().nullable().optional(),
  manufacturerName: M().optional().default(""),
  lowStockThreshold: ie().min(0).optional().default(0),
  purchasePerPack: ie().min(0).optional().default(0),
  salePerPack: ie().min(0).optional().default(0)
}), Qp = go.partial(), em = ee({
  id: M().trim().optional(),
  batchNo: M().trim().min(1),
  expiryDate: Yp,
  quantityTablets: ie().int().min(0).default(0),
  costPricePerTablet: ie().min(0).default(0),
  salePricePerTablet: ie().min(0).default(0),
  salePricePerPack: ie().min(0).default(0)
}), ur = ee({
  id: M().trim().optional(),
  name: M().trim().min(1),
  phone: M().optional().default(""),
  company: M().optional().default(""),
  address: M().optional().default("")
}), ni = ee({
  id: M().trim().optional(),
  name: M().trim().min(1),
  phone: M().optional().default(""),
  address: M().optional().default(""),
  creditLimit: ie().min(0).optional().default(0),
  balanceDue: ie().min(0).optional().default(0)
}), tm = ee({
  customerId: M().trim().optional(),
  customerName: M().optional(),
  paymentMethod: an(["cash", "card", "credit"]).default("cash"),
  creditAmount: ie().min(0).optional(),
  counterPayment: ie().min(0).optional(),
  discount: ie().min(0).optional().default(0),
  tax: ie().min(0).optional().default(0),
  items: Dn(
    ee({
      medicineId: M().trim().min(1),
      quantityMode: an(["tablet", "packet"]).default("tablet"),
      quantity: ie().int().positive()
    })
  ).min(1)
}), rm = ee({
  supplierId: M().trim().min(1),
  supplierName: M().optional(),
  purchaseDate: M().optional(),
  grnNo: M().optional(),
  notes: M().optional(),
  tax: ie().min(0).optional().default(0),
  discount: ie().min(0).optional().default(0),
  items: Dn(
    ee({
      medicineId: M().trim().min(1),
      quantityPacks: ie().int().positive(),
      tabletsPerPack: ie().int().positive().optional(),
      unitCostPerTablet: ie().min(0).optional().default(0),
      batchNo: M().optional().default(""),
      expiryDate: M().optional().default("")
    })
  ).min(1)
});
function nm(t) {
  return {
    "batches:list": (e) => {
      const r = ee({ medicineId: M().trim().optional() }).parse(e ?? {});
      return r.medicineId ? t.db.prepare("SELECT * FROM batches WHERE medicine_id = ? ORDER BY date(expiry_date) ASC").all(r.medicineId) : t.db.prepare("SELECT * FROM batches ORDER BY date(expiry_date) ASC").all();
    },
    "batches:update": (e) => {
      const r = ee({ id: me, body: Ki(M(), yr()) }).parse(e ?? {});
      ue("batches:update", { id: r.id });
      const n = t.updateBatch(r.id, r.body);
      return it(t.db), n;
    },
    "batches:remove": (e) => {
      const r = me.parse(e);
      He("pre-delete-batch-"), ue("batches:remove", { id: r });
      const n = t.deleteBatch(r);
      return it(t.db), n;
    }
  };
}
class sm {
  constructor(e) {
    kt(this, "db");
    this.db = e;
  }
  listActive() {
    return this.db.prepare("SELECT * FROM medicines WHERE is_active = 1 ORDER BY name COLLATE NOCASE").all();
  }
  listBatches() {
    return this.db.prepare("SELECT * FROM batches ORDER BY date(expiry_date) ASC").all();
  }
  byId(e) {
    return this.db.prepare("SELECT * FROM medicines WHERE id = ?").get(e);
  }
}
function im(t) {
  const { db: e, nowIso: r, generateId: n } = t, s = new sm(e);
  return {
    "medicines:list": () => {
      const i = s.listActive(), o = s.listBatches(), a = /* @__PURE__ */ new Map();
      for (const c of o) {
        const u = a.get(c.medicine_id) ?? [];
        u.push(c), a.set(c.medicine_id, u);
      }
      return i.map((c) => ({ ...c, batches: a.get(c.id) ?? [] }));
    },
    "medicines:create": (i) => {
      const o = go.parse(i ?? {}), a = o.id ?? n("med");
      return ue("medicines:create", { id: a, name: o.name }), e.prepare(
        `INSERT INTO medicines
        (id, name, generic, type, category, unit_type, unit, tablets_per_pack, volume_ml, supplier_id, supplier_name, manufacturer_id, manufacturer_name, low_stock_threshold, purchase_per_pack, sale_per_pack, total_stock_tablets, is_active, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 1, ?, ?)`
      ).run(
        a,
        o.name,
        o.generic,
        o.type,
        o.category,
        o.unitType,
        o.unit,
        o.tabletsPerPack,
        o.volumeMl,
        o.supplierId ?? null,
        o.supplierName,
        o.manufacturerId ?? null,
        o.manufacturerName,
        o.lowStockThreshold,
        o.purchasePerPack,
        o.salePerPack,
        r(),
        r()
      ), it(e), s.byId(a);
    },
    "medicines:update": (i) => {
      const o = ee({ id: me, body: Qp }).parse(i ?? {});
      if (ue("medicines:update", { id: o.id }), !e.prepare(
        `UPDATE medicines SET
         name = COALESCE(?, name),
         generic = COALESCE(?, generic),
         category = COALESCE(?, category),
         unit = COALESCE(?, unit),
         tablets_per_pack = COALESCE(?, tablets_per_pack),
         low_stock_threshold = COALESCE(?, low_stock_threshold),
         purchase_per_pack = COALESCE(?, purchase_per_pack),
         sale_per_pack = COALESCE(?, sale_per_pack),
         updated_at = ?
         WHERE id = ?`
      ).run(
        o.body.name ?? null,
        o.body.generic ?? null,
        o.body.category ?? null,
        o.body.unit ?? null,
        o.body.tabletsPerPack ?? null,
        o.body.lowStockThreshold ?? null,
        o.body.purchasePerPack ?? null,
        o.body.salePerPack ?? null,
        r(),
        o.id
      ).changes) throw new Error("Medicine not found.");
      return it(e), s.byId(o.id);
    },
    "medicines:remove": (i) => {
      const o = me.parse(i);
      return He("pre-delete-medicine-"), ue("medicines:remove", { id: o }), e.prepare("UPDATE medicines SET is_active = 0, updated_at = ? WHERE id = ?").run(r(), o), it(e), ge.info("Medicine soft-deleted", { id: o }), { deleted: !0 };
    },
    "medicines:addBatch": (i) => {
      const o = ee({ medicineId: me, body: em }).parse(i ?? {}), a = o.body.id ?? n("bat");
      return ue("medicines:addBatch", { medicineId: o.medicineId, batchId: a }), e.prepare(
        `INSERT INTO batches
        (id, medicine_id, batch_no, expiry_date, quantity_tablets, cost_price_per_tablet, sale_price_per_tablet, sale_price_per_pack, received_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        a,
        o.medicineId,
        o.body.batchNo,
        o.body.expiryDate,
        o.body.quantityTablets,
        o.body.costPricePerTablet,
        o.body.salePricePerTablet,
        o.body.salePricePerPack,
        r()
      ), it(e), e.prepare("SELECT * FROM batches WHERE id = ?").get(a);
    }
  };
}
function xn(t, e) {
  return t.transaction(e)();
}
function om(t) {
  return {
    "purchases:list": (e) => ee({ includeItems: Pn().optional().default(!1) }).parse(e ?? {}).includeItems ? t.db.prepare("SELECT * FROM purchases ORDER BY created_at DESC").all().map((s) => t.getPurchaseById(s.id)) : t.db.prepare("SELECT * FROM purchases ORDER BY created_at DESC").all(),
    "purchases:get": (e) => t.getPurchaseById(me.parse(e)),
    "purchases:create": (e) => {
      const r = rm.parse(e ?? {});
      return ue("purchases:create", { supplierId: r.supplierId }), xn(t.db, () => t.createPendingPurchase(r));
    },
    "purchases:update": (e) => {
      const r = ee({ id: me, body: Ki(M(), yr()) }).parse(e ?? {});
      return r.body, t.getPurchaseById(r.id);
    },
    "purchases:receive": (e) => t.receivePurchase(me.parse(e)),
    "purchases:remove": (e) => {
      const r = me.parse(e);
      return He("pre-delete-purchase-"), ue("purchases:remove", { id: r }), t.db.prepare("DELETE FROM purchases WHERE id = ?").run(r), { deleted: !0 };
    }
  };
}
function am(t) {
  return {
    "returns:list": (e) => ee({ includeItems: Pn().optional().default(!1) }).parse(e ?? {}).includeItems ? t.db.prepare("SELECT * FROM returns ORDER BY created_at DESC").all().map((s) => ({
      ...s,
      items: t.db.prepare("SELECT * FROM return_items WHERE return_id = ? ORDER BY created_at ASC").all(s.id)
    })) : t.db.prepare("SELECT * FROM returns ORDER BY created_at DESC").all(),
    "returns:get": (e) => {
      const r = me.parse(e), n = t.db.prepare("SELECT * FROM returns WHERE id = ?").get(r);
      if (!n) throw new Error("Return not found.");
      return { ...n, items: t.db.prepare("SELECT * FROM return_items WHERE return_id = ? ORDER BY created_at ASC").all(r) };
    },
    "returns:create": (e) => {
      const r = e ?? {};
      return ue("returns:create"), xn(t.db, () => t.createReturn(r));
    }
  };
}
class cm {
  constructor(e) {
    kt(this, "db");
    this.db = e;
  }
  listSales() {
    return this.db.prepare("SELECT * FROM sales ORDER BY created_at DESC").all();
  }
  saleById(e) {
    return this.db.prepare("SELECT * FROM sales WHERE id = ?").get(e);
  }
  saleItems(e) {
    return this.db.prepare("SELECT * FROM sale_items WHERE sale_id = ? ORDER BY created_at ASC").all(e);
  }
}
function um(t) {
  const e = new cm(t.db);
  return {
    "sales:list": (r) => ee({ includeItems: Pn().optional().default(!1) }).parse(r ?? {}).includeItems ? e.listSales().map((i) => ({
      ...i,
      items: e.saleItems(i.id)
    })) : e.listSales(),
    "sales:get": (r) => {
      const n = me.parse(r), s = e.saleById(n);
      if (!s) throw new Error("Sale not found.");
      return { ...s, items: e.saleItems(n) };
    },
    "sales:create": (r) => {
      const n = tm.parse(r ?? {});
      return ue("sales:create", { itemCount: n.items.length }), xn(t.db, () => t.createSale(n));
    },
    "sales:remove": (r) => {
      const n = me.parse(r);
      return He("pre-delete-sale-"), ue("sales:remove", { id: n }), t.reverseSale(n);
    }
  };
}
function lm(t) {
  const { db: e, nowIso: r, generateId: n } = t;
  return {
    "suppliers:list": () => e.prepare("SELECT * FROM suppliers ORDER BY name COLLATE NOCASE").all(),
    "suppliers:create": (s) => {
      const i = ur.parse(s ?? {}), o = i.id ?? n("sup");
      return ue("suppliers:create", { id: o, name: i.name }), e.prepare(
        `INSERT INTO suppliers (id, name, phone, company, address, balance_payable, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 0, ?, ?)`
      ).run(o, i.name, i.phone, i.company, i.address, r(), r()), e.prepare("SELECT * FROM suppliers WHERE id = ?").get(o);
    },
    "suppliers:update": (s) => {
      const i = ee({ id: me, body: ur.partial() }).parse(s ?? {});
      if (ue("suppliers:update", { id: i.id }), !e.prepare(
        `UPDATE suppliers SET
         name = COALESCE(?, name),
         phone = COALESCE(?, phone),
         company = COALESCE(?, company),
         address = COALESCE(?, address),
         updated_at = ?
         WHERE id = ?`
      ).run(i.body.name ?? null, i.body.phone ?? null, i.body.company ?? null, i.body.address ?? null, r(), i.id).changes) throw new Error("Supplier not found.");
      return e.prepare("SELECT * FROM suppliers WHERE id = ?").get(i.id);
    },
    "suppliers:remove": (s) => {
      const i = me.parse(s);
      return He("pre-delete-supplier-"), ue("suppliers:remove", { id: i }), e.prepare("DELETE FROM suppliers WHERE id = ?").run(i), { deleted: !0 };
    },
    "manufacturers:list": () => e.prepare("SELECT * FROM manufacturers ORDER BY name COLLATE NOCASE").all(),
    "manufacturers:create": (s) => {
      const i = ur.parse(s ?? {}), o = i.id ?? n("man");
      return ue("manufacturers:create", { id: o, name: i.name }), e.prepare(
        `INSERT INTO manufacturers (id, name, phone, company, address, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(o, i.name, i.phone, i.company, i.address, r(), r()), e.prepare("SELECT * FROM manufacturers WHERE id = ?").get(o);
    },
    "manufacturers:update": (s) => {
      const i = ee({ id: me, body: ur.partial() }).parse(s ?? {});
      if (ue("manufacturers:update", { id: i.id }), !e.prepare(
        `UPDATE manufacturers SET
         name = COALESCE(?, name),
         phone = COALESCE(?, phone),
         company = COALESCE(?, company),
         address = COALESCE(?, address),
         updated_at = ?
         WHERE id = ?`
      ).run(i.body.name ?? null, i.body.phone ?? null, i.body.company ?? null, i.body.address ?? null, r(), i.id).changes) throw new Error("Manufacturer not found.");
      return e.prepare("SELECT * FROM manufacturers WHERE id = ?").get(i.id);
    },
    "manufacturers:remove": (s) => {
      const i = me.parse(s);
      return He("pre-delete-manufacturer-"), ue("manufacturers:remove", { id: i }), e.prepare("DELETE FROM manufacturers WHERE id = ?").run(i), { deleted: !0 };
    },
    "customers:list": () => e.prepare("SELECT * FROM customers ORDER BY name COLLATE NOCASE").all(),
    "customers:create": (s) => {
      const i = ni.parse(s ?? {}), o = i.id ?? n("cus");
      return ue("customers:create", { id: o, name: i.name }), e.prepare(
        `INSERT INTO customers (id, name, phone, address, credit_limit, balance_due, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(o, i.name, i.phone, i.address, i.creditLimit, i.balanceDue, r(), r()), e.prepare("SELECT * FROM customers WHERE id = ?").get(o);
    },
    "customers:update": (s) => {
      const i = ee({ id: me, body: ni.partial() }).parse(s ?? {});
      if (ue("customers:update", { id: i.id }), !e.prepare(
        `UPDATE customers SET
         name = COALESCE(?, name),
         phone = COALESCE(?, phone),
         address = COALESCE(?, address),
         credit_limit = COALESCE(?, credit_limit),
         balance_due = COALESCE(?, balance_due),
         updated_at = ?
         WHERE id = ?`
      ).run(
        i.body.name ?? null,
        i.body.phone ?? null,
        i.body.address ?? null,
        i.body.creditLimit ?? null,
        i.body.balanceDue ?? null,
        r(),
        i.id
      ).changes) throw new Error("Customer not found.");
      return e.prepare("SELECT * FROM customers WHERE id = ?").get(i.id);
    },
    "customers:remove": (s) => {
      const i = me.parse(s);
      return He("pre-delete-customer-"), ue("customers:remove", { id: i }), e.prepare("DELETE FROM customers WHERE id = ?").run(i), { deleted: !0 };
    },
    "customers:payBalance": (s) => {
      const i = ee({ id: me, amount: ie().min(0) }).parse(s ?? {});
      return ue("customers:payBalance", { id: i.id, amount: i.amount }), e.prepare("UPDATE customers SET balance_due = MAX(0, balance_due - ?), updated_at = ? WHERE id = ?").run(i.amount, r(), i.id), e.prepare("SELECT * FROM customers WHERE id = ?").get(i.id);
    }
  };
}
const hm = 50, si = /* @__PURE__ */ new Map();
function dm(t) {
  const e = Math.floor(Date.now() / 1e3), r = `global:${t}`, n = si.get(r);
  if (!n || n.sec !== e) {
    si.set(r, { sec: e, count: 1 });
    return;
  }
  if (n.count += 1, n.count > hm)
    throw new Error(`Rate limit exceeded for ${t}`);
}
function ii(t, e) {
  return async (r) => {
    try {
      return dm(t), await e(r);
    } catch (n) {
      throw ge.error("IPC handler failed", { channel: t, payload: r, error: String(n) }), n instanceof Error ? n : new Error(String(n));
    }
  };
}
function fm(...t) {
  return t.reduce((e, r) => ({ ...e, ...r }), {});
}
function pm(t) {
  return { ok: !0, success: !0, data: t };
}
function mm(t) {
  var n;
  const e = t.method, r = t.path;
  if (e === "GET" && r === "/health") return { channel: "app:health" };
  if (e === "GET" && r === "/medicines") return { channel: "medicines:list" };
  if (e === "POST" && r === "/medicines") return { channel: "medicines:create", payload: t.body };
  if (e === "PUT" && /^\/medicines\/[^/]+$/.test(r)) return { channel: "medicines:update", payload: { id: r.split("/")[2], body: t.body } };
  if (e === "DELETE" && /^\/medicines\/[^/]+$/.test(r)) return { channel: "medicines:remove", payload: r.split("/")[2] };
  if (e === "POST" && /^\/medicines\/[^/]+\/batches$/.test(r)) return { channel: "medicines:addBatch", payload: { medicineId: r.split("/")[2], body: t.body } };
  if (e === "GET" && r === "/suppliers") return { channel: "suppliers:list" };
  if (e === "POST" && r === "/suppliers") return { channel: "suppliers:create", payload: t.body };
  if (e === "PUT" && /^\/suppliers\/[^/]+$/.test(r)) return { channel: "suppliers:update", payload: { id: r.split("/")[2], body: t.body } };
  if (e === "DELETE" && /^\/suppliers\/[^/]+$/.test(r)) return { channel: "suppliers:remove", payload: r.split("/")[2] };
  if (e === "GET" && r === "/manufacturers") return { channel: "manufacturers:list" };
  if (e === "POST" && r === "/manufacturers") return { channel: "manufacturers:create", payload: t.body };
  if (e === "PUT" && /^\/manufacturers\/[^/]+$/.test(r)) return { channel: "manufacturers:update", payload: { id: r.split("/")[2], body: t.body } };
  if (e === "DELETE" && /^\/manufacturers\/[^/]+$/.test(r)) return { channel: "manufacturers:remove", payload: r.split("/")[2] };
  if (e === "GET" && r === "/customers") return { channel: "customers:list" };
  if (e === "POST" && r === "/customers") return { channel: "customers:create", payload: t.body };
  if (e === "PUT" && /^\/customers\/[^/]+$/.test(r)) return { channel: "customers:update", payload: { id: r.split("/")[2], body: t.body } };
  if (e === "DELETE" && /^\/customers\/[^/]+$/.test(r)) return { channel: "customers:remove", payload: r.split("/")[2] };
  if (e === "POST" && /^\/customers\/[^/]+\/payments$/.test(r)) return { channel: "customers:payBalance", payload: { id: r.split("/")[2], amount: (n = t.body) == null ? void 0 : n.amount } };
  if (e === "GET" && r.startsWith("/sales")) {
    const s = r.match(/^\/sales\/([^/?]+)$/);
    return s ? { channel: "sales:get", payload: s[1] } : { channel: "sales:list", payload: { includeItems: r.includes("includeItems=1") } };
  }
  if (e === "POST" && r === "/sales") return { channel: "sales:create", payload: t.body };
  if (e === "DELETE" && /^\/sales\/[^/]+$/.test(r)) return { channel: "sales:remove", payload: r.split("/")[2] };
  if (e === "GET" && r.startsWith("/purchases")) {
    const s = r.match(/^\/purchases\/([^/?]+)$/);
    return s ? { channel: "purchases:get", payload: s[1] } : { channel: "purchases:list", payload: { includeItems: r.includes("includeItems=1") } };
  }
  if (e === "POST" && r === "/purchases") return { channel: "purchases:create", payload: t.body };
  if (e === "PUT" && /^\/purchases\/[^/]+$/.test(r)) return { channel: "purchases:update", payload: { id: r.split("/")[2], body: t.body } };
  if (e === "DELETE" && /^\/purchases\/[^/]+$/.test(r)) return { channel: "purchases:remove", payload: r.split("/")[2] };
  if (e === "POST" && /^\/purchases\/[^/]+\/receive$/.test(r)) return { channel: "purchases:receive", payload: r.split("/")[2] };
  if (e === "GET" && r.startsWith("/returns")) {
    const s = r.match(/^\/returns\/([^/?]+)$/);
    return s ? { channel: "returns:get", payload: s[1] } : { channel: "returns:list", payload: { includeItems: r.includes("includeItems=1") } };
  }
  if (e === "POST" && r === "/returns") return { channel: "returns:create", payload: t.body };
  if (e === "GET" && r.startsWith("/batches"))
    return { channel: "batches:list", payload: { medicineId: new URL(`ipc://local${r}`).searchParams.get("medicineId") ?? void 0 } };
  if (e === "PUT" && /^\/batches\/[^/]+$/.test(r)) return { channel: "batches:update", payload: { id: r.split("/")[2], body: t.body } };
  if (e === "DELETE" && /^\/batches\/[^/]+$/.test(r)) return { channel: "batches:remove", payload: r.split("/")[2] };
  throw new Error(`Unsupported legacy request: ${e} ${r}`);
}
function gm(t) {
  const e = fm(
    im(t),
    lm(t),
    um(t),
    om(t),
    am(t),
    nm(t),
    {
      "app:health": () => ({
        status: "up",
        time: t.nowIso(),
        features: {
          cloudSync: On("cloud-sync")
        }
      })
    }
  );
  for (const [r, n] of Object.entries(e))
    ne.handle(r, (s, i) => ii(r, n)(i));
  ne.handle("pos:request", async (r, n) => {
    const s = mm(n), i = e[s.channel];
    if (!i)
      throw new Error(`No IPC handler found for channel: ${s.channel}`);
    const o = await ii(s.channel, i)(s.payload);
    return pm(o);
  });
}
const _o = bo(import.meta.url), { db: wn, generateId: _m, nowIso: ym } = _o("../backend/db.js"), {
  createPendingPurchase: Em,
  createReturn: vm,
  createSale: wm,
  deleteBatch: bm,
  getPurchaseById: Tm,
  receivePurchase: Sm,
  reverseSale: Om,
  updateBatch: Am
} = _o("../backend/services.js"), { autoUpdater: je } = Oo, km = To(import.meta.url), yo = K.dirname(km);
process.env.DIST = K.join(yo, "../dist");
process.env.VITE_PUBLIC = Y.isPackaged ? process.env.DIST : K.join(process.env.DIST, "../public");
process.env.PHARMACY_USER_DATA_DIR = Y.getPath("userData");
let de = null;
function lr(t, e) {
  let r = K.resolve(t), n = K.resolve(e);
  return process.platform === "win32" && (r = r.toLowerCase(), n = n.toLowerCase()), r === n ? !0 : r.startsWith(`${n}${K.sep}`);
}
function Rm(t) {
  const e = K.resolve(String(t ?? "").trim());
  if (!e) throw new Error("Path is required.");
  const r = Y.getPath("userData"), n = Y.getPath("desktop"), s = Y.getPath("downloads"), i = Y.getPath("documents");
  if (!lr(e, r) && !lr(e, n) && !lr(e, s) && !lr(e, i))
    throw new Error("Path is outside allowed directories.");
  return e;
}
function et(t) {
  for (const e of $t.getAllWindows())
    e.isDestroyed() || e.webContents.send("auto-update", t);
}
function Eo() {
  de = new $t({
    icon: K.join(process.env.VITE_PUBLIC ?? "", "electron-vite.svg"),
    width: 1280,
    height: 800,
    frame: !1,
    backgroundColor: "#f4f7fb",
    webPreferences: {
      preload: K.join(yo, "preload.mjs"),
      contextIsolation: !0,
      nodeIntegration: !1,
      sandbox: !0
    }
  });
  const t = process.env.VITE_DEV_SERVER_URL;
  t ? de.loadURL(t) : Y.isPackaged ? de.loadFile(K.join(process.env.DIST ?? "", "index.html")) : de.loadURL("http://127.0.0.1:5173/");
}
function Nm() {
  et({ phase: "checking", message: "Checking for updates..." }), je.autoDownload = !0, je.on(
    "checking-for-update",
    () => et({ phase: "checking", message: "Checking for updates..." })
  ), je.on(
    "update-not-available",
    () => et({ phase: "not-available", message: "You are on the latest version." })
  ), je.on(
    "download-progress",
    (t) => et({
      phase: "downloading",
      message: `Downloading update... ${Math.round(t.percent)}%`
    })
  ), je.on(
    "update-available",
    () => et({ phase: "available", message: "Update found. Downloading..." })
  ), je.on("update-downloaded", async () => {
    et({ phase: "downloaded", message: "Update downloaded." }), (await hr.showMessageBox({
      type: "info",
      title: "Update ready",
      message: "An update was downloaded. Restart now?",
      buttons: ["Restart now", "Later"],
      defaultId: 0,
      cancelId: 1
    })).response === 0 && je.quitAndInstall(!1, !0);
  }), je.on("error", (t) => {
    ge.error("Auto updater error", { message: t.message }), et({ phase: "error", message: t.message });
  }), Y.isPackaged && je.checkForUpdates().catch((t) => ge.warn("Update check failed", t));
}
function Im() {
  qp(), Gp(wn), ne.handle("window:minimize", () => de == null ? void 0 : de.minimize()), ne.handle("window:maximize", () => de != null && de.isMaximized() ? de.unmaximize() : de == null ? void 0 : de.maximize()), ne.handle("window:close", () => de == null ? void 0 : de.close()), ne.handle("window:set-theme", (t, e) => de == null ? void 0 : de.setBackgroundColor(e ? "#0f172a" : "#f4f7fb")), ne.handle("app:reload", () => $t.getAllWindows().forEach((t) => !t.isDestroyed() && t.reload())), gm({
    db: ca(wn),
    nowIso: ym,
    generateId: _m,
    createPendingPurchase: Em,
    createReturn: vm,
    createSale: wm,
    deleteBatch: bm,
    getPurchaseById: Tm,
    receivePurchase: Sm,
    reverseSale: Om,
    updateBatch: Am
  }), ne.handle("backup:create", () => Wt("manual-")), ne.handle("backup:list", () => rn()), ne.handle("backup:restore", (t, e) => (tn(String(e ?? "")), $t.getAllWindows().forEach((r) => !r.isDestroyed() && r.reload()), !0)), ne.handle("logs:export", (t, e) => Po(String(e ?? "").trim())), ne.handle(
    "diagnostics:export",
    (t, e) => aa(String(e ?? "").trim())
  ), ne.handle("system:openPath", async (t, e) => {
    const r = Rm(e), n = await So.openPath(r);
    if (n) throw new Error(n);
  }), ne.handle("app:diagnostics", () => ({ dbPath: ot(), dbVersion: Tn(), backups: rn() }));
}
Y.on("window-all-closed", () => {
  process.platform !== "darwin" && Y.quit();
});
Y.on("activate", () => {
  $t.getAllWindows().length === 0 && Eo();
});
Y.on("before-quit", () => {
  try {
    Wt("shutdown-");
  } catch (t) {
    ge.warn("Shutdown backup failed", t);
  }
});
Y.on("will-quit", () => hi());
Y.whenReady().then(() => {
  try {
    qt();
    const t = Bn();
    if (!t.ok) {
      ge.error("Database integrity check failed", t);
      const e = Mn(), r = hr.showMessageBoxSync({
        type: "error",
        title: "Database Recovery",
        message: "Database integrity checks failed. You can attempt restoring the latest backup, or exit the application.",
        detail: `integrity_check=${t.integrity}; foreign_key_violations=${t.foreignKeyViolations.length}`,
        buttons: e ? ["Restore latest backup", "Exit"] : ["Exit"],
        defaultId: 0,
        cancelId: e ? 1 : 0
      });
      if (!e || r !== 0) {
        Y.quit();
        return;
      }
      tn(e);
      const n = Bn();
      if (!n.ok) {
        ge.error("Database integrity still failing after restore", n), hr.showErrorBox(
          "Database Recovery Failed",
          "Restore did not repair database integrity. Please contact support and export diagnostics."
        ), Y.quit();
        return;
      }
    }
    Ho(), Zo(), it(wn), ge.info("Application started", { dbPath: ot() });
  } catch (t) {
    const e = t instanceof Error ? t.message : String(t);
    ge.error("Startup failed", { message: e });
    const r = Mn(), n = hr.showMessageBoxSync({
      type: "error",
      title: "Pharmacy POS Startup Failed",
      message: `Startup failed: ${e}`,
      detail: r ? "You can attempt Safe Mode recovery by restoring latest backup, or exit." : "No backup detected. Please export diagnostics and contact support.",
      buttons: r ? ["Restore latest backup", "Exit"] : ["Exit"],
      defaultId: 0,
      cancelId: r ? 1 : 0
    });
    if (r && n === 0)
      try {
        tn(r);
      } catch (s) {
        ge.error("Safe mode restore failed", { error: String(s) });
      }
    Y.quit();
    return;
  }
  Im(), Eo(), Nm();
});

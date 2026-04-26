var Er = Object.defineProperty;
var mr = (e, t, n) => t in e ? Er(e, t, { enumerable: !0, configurable: !0, writable: !0, value: n }) : e[t] = n;
var Ge = (e, t, n) => mr(e, typeof t != "symbol" ? t + "" : t, n);
import F from "node:path";
import { createRequire as _r } from "node:module";
import { fileURLToPath as gr } from "node:url";
import { app as P, ipcMain as ee, BrowserWindow as Le, dialog as Ue, shell as Tr } from "electron";
import yr from "electron-updater";
import $ from "node:fs";
import Nr from "better-sqlite3";
import Ct from "node:os";
import Lr from "fs";
import _t from "path";
import Ln from "zlib";
import Sr from "crypto";
const Ir = `PRAGMA foreign_keys = ON;\r
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
CREATE INDEX IF NOT EXISTS idx_return_items_return ON return_items(return_id);`, vr = [
  {
    version: 1,
    description: "Baseline schema (CREATE IF NOT EXISTS)",
    up(e) {
      e.prepare("SELECT 1 AS ok FROM sqlite_master WHERE type = 'table' AND name = 'medicines' LIMIT 1").get() || e.exec(String(Ir));
    }
  }
];
function wt(e) {
  const t = e.prepare("SELECT value FROM meta WHERE key = 'db_version'").get();
  if (!(t != null && t.value)) return 0;
  const n = parseInt(String(t.value), 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}
function Or(e) {
  e.exec(`
    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
  let t = wt(e);
  t === 0 && e.prepare("SELECT 1 AS ok FROM sqlite_master WHERE type = 'table' AND name = 'medicines' LIMIT 1").get() && (e.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES ('db_version', '1')").run(), t = wt(e));
  for (const n of vr)
    n.version <= t || (e.transaction(() => {
      n.up(e);
    })(), e.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES ('db_version', ?)").run(String(n.version)), t = n.version);
}
function Sn() {
  const e = F.join(P.getPath("userData"), "logs");
  return $.mkdirSync(e, { recursive: !0 }), e;
}
function br() {
  const e = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  return F.join(Sn(), `app-${e}.log`);
}
function Dr(e, t, n) {
  const r = n === void 0 ? "" : ` ${JSON.stringify(n)}`;
  return `[${(/* @__PURE__ */ new Date()).toISOString()}] [${e.toUpperCase()}] ${t}${r}
`;
}
function We(e, t, n) {
  const r = Dr(e, t, n);
  $.appendFileSync(br(), r, "utf8"), e === "error" ? console.error(r.trim()) : e === "warn" ? console.warn(r.trim()) : console.log(r.trim());
}
const K = {
  info: (e, t) => We("info", e, t),
  warn: (e, t) => We("warn", e, t),
  error: (e, t) => We("error", e, t)
};
function Ar(e) {
  const t = Sn(), n = F.resolve(e), r = $.readdirSync(t).filter((i) => i.endsWith(".log"));
  if (r.length === 0)
    throw new Error("No logs available to export.");
  $.mkdirSync(F.dirname(n), { recursive: !0 });
  const o = r.sort().map((i) => `
===== ${i} =====
` + $.readFileSync(F.join(t, i), "utf8"));
  return $.writeFileSync(n, o.join(""), "utf8"), n;
}
const Rr = "pharmacy.db", In = 1, vn = process.env.PHARMACY_DEBUG_DB_WRITES === "1", Cr = process.env.PHARMACY_DEBUG_CRASH_SAFE === "1";
let de = null, Ve = "";
function ge() {
  return Ve || (Ve = F.join(P.getPath("userData"), Rr)), Ve;
}
function wr(e) {
  e.prepare(
    `CREATE TABLE IF NOT EXISTS app_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`
  ).run();
}
function Ur(e, t) {
  e.prepare(
    `INSERT INTO app_meta (key, value, updated_at)
     VALUES ('db_version', ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
  ).run(String(t), (/* @__PURE__ */ new Date()).toISOString());
}
function Ie() {
  if (de) return de;
  const e = ge();
  $.mkdirSync(F.dirname(e), { recursive: !0 });
  const t = new Nr(e);
  return t.pragma("journal_mode = WAL"), t.pragma("foreign_keys = ON"), Cr && (t.pragma("synchronous = FULL"), K.warn("Crash-safe mode enabled: synchronous=FULL")), Or(t), wr(t), Ur(t, In), de = t, vn && K.info("DB write debug mode enabled"), de;
}
function gt() {
  const t = Ie().prepare("SELECT value FROM app_meta WHERE key = 'db_version'").get();
  return Number((t == null ? void 0 : t.value) ?? In);
}
function Ut() {
  const e = Ie(), t = e.prepare("PRAGMA integrity_check").get(), n = String((t == null ? void 0 : t.integrity_check) ?? Object.values(t ?? {})[0] ?? "unknown"), r = e.prepare("PRAGMA foreign_key_check").all();
  return { ok: n.toLowerCase() === "ok" && r.length === 0, integrity: n, foreignKeyViolations: r };
}
function On() {
  de && (de.close(), de = null);
}
function j(e, t) {
  vn && K.info(`DB WRITE ${e}`, t);
}
const kr = 5, zr = 24 * 60 * 60 * 1e3;
function $e() {
  const e = F.join(P.getPath("userData"), "backups");
  return $.mkdirSync(e, { recursive: !0 }), e;
}
function Fr(e = "") {
  const t = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-");
  return `${e}pharmacy-backup-${t}.db`;
}
function bn() {
  const e = $e();
  return $.readdirSync(e).filter((n) => n.endsWith(".db") && n.includes("pharmacy-backup-")).sort((n, r) => {
    const o = $.statSync(F.join(e, n)).mtimeMs;
    return $.statSync(F.join(e, r)).mtimeMs - o;
  });
}
function Dn() {
  const e = $e();
  return bn().map((t) => F.join(e, t));
}
function Pr() {
  const e = Dn();
  for (const t of e.slice(kr))
    try {
      $.unlinkSync(t);
    } catch {
    }
}
function Zr() {
  try {
    Ie().pragma("wal_checkpoint(FULL)");
  } catch (e) {
    K.warn("WAL checkpoint failed before backup", { error: String(e) });
  }
}
function ve(e = "") {
  const t = ge();
  if (!$.existsSync(t))
    throw new Error("Database not found for backup.");
  Zr();
  const n = F.join($e(), Fr(e));
  $.copyFileSync(t, n);
  const r = `${n}.meta.json`;
  return $.writeFileSync(
    r,
    JSON.stringify(
      {
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        appVersion: P.getVersion(),
        dbVersion: gt(),
        dbFileName: F.basename(t)
      },
      null,
      2
    ),
    "utf8"
  ), Pr(), K.info("Backup created", { path: n, metaPath: r }), n;
}
function $r() {
  const e = Dn();
  if (e.length > 0) {
    const t = $.statSync(e[0]).mtimeMs;
    if (Date.now() - t < zr) return null;
  }
  return ve("daily-");
}
function xr() {
  return ve("startup-");
}
function ft(e) {
  const t = F.basename(e);
  if (t !== e || !t.endsWith(".db") || !t.includes("pharmacy-backup-"))
    throw new Error("Invalid backup file name.");
  const n = F.join($e(), t);
  if (!$.existsSync(n)) throw new Error("Backup file not found.");
  const r = ge();
  ie("pre-restore-"), On();
  for (const o of ["-wal", "-shm"])
    try {
      $.unlinkSync(r + o);
    } catch {
    }
  $.copyFileSync(n, r), Ie(), K.info("Backup restored", { source: n });
}
function dt() {
  return bn();
}
function kt() {
  const e = dt();
  return e.length > 0 ? e[0] : null;
}
function ie(e) {
  try {
    return ve(`${e}`);
  } catch (t) {
    return K.warn("Pre-operation backup failed", { label: e, error: String(t) }), null;
  }
}
function Mr(e) {
  return e && e.__esModule && Object.prototype.hasOwnProperty.call(e, "default") ? e.default : e;
}
var le = { exports: {} }, Ye, zt;
function An() {
  return zt || (zt = 1, Ye = {
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
  }), Ye;
}
var Ke = {}, Ft;
function Tt() {
  return Ft || (Ft = 1, function(e) {
    const t = {
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
    function n(r) {
      return function(...o) {
        return o.length && (r = r.replace(/\{(\d)\}/g, (i, s) => o[s] || "")), new Error("ADM-ZIP: " + r);
      };
    }
    for (const r of Object.keys(t))
      e[r] = n(t[r]);
  }(Ke)), Ke;
}
var Je, Pt;
function Br() {
  if (Pt) return Je;
  Pt = 1;
  const e = Lr, t = _t, n = An(), r = Tt(), o = typeof process == "object" && process.platform === "win32", i = (a) => typeof a == "object" && a !== null, s = new Uint32Array(256).map((a, u) => {
    for (let l = 0; l < 8; l++)
      u & 1 ? u = 3988292384 ^ u >>> 1 : u >>>= 1;
    return u >>> 0;
  });
  function c(a) {
    this.sep = t.sep, this.fs = e, i(a) && i(a.fs) && typeof a.fs.statSync == "function" && (this.fs = a.fs);
  }
  return Je = c, c.prototype.makeDir = function(a) {
    const u = this;
    function l(d) {
      let g = d.split(u.sep)[0];
      d.split(u.sep).forEach(function(E) {
        if (!(!E || E.substr(-1, 1) === ":")) {
          g += u.sep + E;
          var N;
          try {
            N = u.fs.statSync(g);
          } catch (L) {
            if (L.message && L.message.startsWith("ENOENT"))
              u.fs.mkdirSync(g);
            else
              throw L;
          }
          if (N && N.isFile()) throw r.FILE_IN_THE_WAY(`"${g}"`);
        }
      });
    }
    l(a);
  }, c.prototype.writeFileTo = function(a, u, l, d) {
    const g = this;
    if (g.fs.existsSync(a)) {
      if (!l) return !1;
      var E = g.fs.statSync(a);
      if (E.isDirectory())
        return !1;
    }
    var N = t.dirname(a);
    g.fs.existsSync(N) || g.makeDir(N);
    var L;
    try {
      L = g.fs.openSync(a, "w", 438);
    } catch {
      g.fs.chmodSync(a, 438), L = g.fs.openSync(a, "w", 438);
    }
    if (L)
      try {
        g.fs.writeSync(L, u, 0, u.length, 0);
      } finally {
        g.fs.closeSync(L);
      }
    return g.fs.chmodSync(a, d || 438), !0;
  }, c.prototype.writeFileToAsync = function(a, u, l, d, g) {
    typeof d == "function" && (g = d, d = void 0);
    const E = this;
    E.fs.exists(a, function(N) {
      if (N && !l) return g(!1);
      E.fs.stat(a, function(L, D) {
        if (N && D.isDirectory())
          return g(!1);
        var O = t.dirname(a);
        E.fs.exists(O, function(S) {
          S || E.makeDir(O), E.fs.open(a, "w", 438, function(b, h) {
            b ? E.fs.chmod(a, 438, function() {
              E.fs.open(a, "w", 438, function(f, _) {
                E.fs.write(_, u, 0, u.length, 0, function() {
                  E.fs.close(_, function() {
                    E.fs.chmod(a, d || 438, function() {
                      g(!0);
                    });
                  });
                });
              });
            }) : h ? E.fs.write(h, u, 0, u.length, 0, function() {
              E.fs.close(h, function() {
                E.fs.chmod(a, d || 438, function() {
                  g(!0);
                });
              });
            }) : E.fs.chmod(a, d || 438, function() {
              g(!0);
            });
          });
        });
      });
    });
  }, c.prototype.findFiles = function(a) {
    const u = this;
    function l(d, g, E) {
      let N = [];
      return u.fs.readdirSync(d).forEach(function(L) {
        const D = t.join(d, L), O = u.fs.statSync(D);
        N.push(t.normalize(D) + (O.isDirectory() ? u.sep : "")), O.isDirectory() && E && (N = N.concat(l(D, g, E)));
      }), N;
    }
    return l(a, void 0, !0);
  }, c.prototype.findFilesAsync = function(a, u) {
    const l = this;
    let d = [];
    l.fs.readdir(a, function(g, E) {
      if (g) return u(g);
      let N = E.length;
      if (!N) return u(null, d);
      E.forEach(function(L) {
        L = t.join(a, L), l.fs.stat(L, function(D, O) {
          if (D) return u(D);
          O && (d.push(t.normalize(L) + (O.isDirectory() ? l.sep : "")), O.isDirectory() ? l.findFilesAsync(L, function(S, b) {
            if (S) return u(S);
            d = d.concat(b), --N || u(null, d);
          }) : --N || u(null, d));
        });
      });
    });
  }, c.prototype.getAttributes = function() {
  }, c.prototype.setAttributes = function() {
  }, c.crc32update = function(a, u) {
    return s[(a ^ u) & 255] ^ a >>> 8;
  }, c.crc32 = function(a) {
    typeof a == "string" && (a = Buffer.from(a, "utf8"));
    let u = a.length, l = -1;
    for (let d = 0; d < u; ) l = c.crc32update(l, a[d++]);
    return ~l >>> 0;
  }, c.methodToString = function(a) {
    switch (a) {
      case n.STORED:
        return "STORED (" + a + ")";
      case n.DEFLATED:
        return "DEFLATED (" + a + ")";
      default:
        return "UNSUPPORTED (" + a + ")";
    }
  }, c.canonical = function(a) {
    if (!a) return "";
    const u = t.posix.normalize("/" + a.split("\\").join("/"));
    return t.join(".", u);
  }, c.zipnamefix = function(a) {
    if (!a) return "";
    const u = t.posix.normalize("/" + a.split("\\").join("/"));
    return t.posix.join(".", u);
  }, c.findLast = function(a, u) {
    if (!Array.isArray(a)) throw new TypeError("arr is not array");
    const l = a.length >>> 0;
    for (let d = l - 1; d >= 0; d--)
      if (u(a[d], d, a))
        return a[d];
  }, c.sanitize = function(a, u) {
    a = t.resolve(t.normalize(a));
    for (var l = u.split("/"), d = 0, g = l.length; d < g; d++) {
      var E = t.normalize(t.join(a, l.slice(d, g).join(t.sep)));
      if (E.indexOf(a) === 0)
        return E;
    }
    return t.normalize(t.join(a, t.basename(u)));
  }, c.toBuffer = function(u, l) {
    return Buffer.isBuffer(u) ? u : u instanceof Uint8Array ? Buffer.from(u) : typeof u == "string" ? l(u) : Buffer.alloc(0);
  }, c.readBigUInt64LE = function(a, u) {
    const l = a.readUInt32LE(u);
    return a.readUInt32LE(u + 4) * 4294967296 + l;
  }, c.fromDOS2Date = function(a) {
    return new Date((a >> 25 & 127) + 1980, Math.max((a >> 21 & 15) - 1, 0), Math.max(a >> 16 & 31, 1), a >> 11 & 31, a >> 5 & 63, (a & 31) << 1);
  }, c.fromDate2DOS = function(a) {
    let u = 0, l = 0;
    return a.getFullYear() > 1979 && (u = (a.getFullYear() - 1980 & 127) << 9 | a.getMonth() + 1 << 5 | a.getDate(), l = a.getHours() << 11 | a.getMinutes() << 5 | a.getSeconds() >> 1), u << 16 | l;
  }, c.isWin = o, c.crcTable = s, Je;
}
var qe, Zt;
function jr() {
  if (Zt) return qe;
  Zt = 1;
  const e = _t;
  return qe = function(t, { fs: n }) {
    var r = t || "", o = s(), i = null;
    function s() {
      return {
        directory: !1,
        readonly: !1,
        hidden: !1,
        executable: !1,
        mtime: 0,
        atime: 0
      };
    }
    return r && n.existsSync(r) ? (i = n.statSync(r), o.directory = i.isDirectory(), o.mtime = i.mtime, o.atime = i.atime, o.executable = (73 & i.mode) !== 0, o.readonly = (128 & i.mode) === 0, o.hidden = e.basename(r)[0] === ".") : console.warn("Invalid path: " + r), {
      get directory() {
        return o.directory;
      },
      get readOnly() {
        return o.readonly;
      },
      get hidden() {
        return o.hidden;
      },
      get mtime() {
        return o.mtime;
      },
      get atime() {
        return o.atime;
      },
      get executable() {
        return o.executable;
      },
      decodeAttributes: function() {
      },
      encodeAttributes: function() {
      },
      toJSON: function() {
        return {
          path: r,
          isDirectory: o.directory,
          isReadOnly: o.readonly,
          isHidden: o.hidden,
          isExecutable: o.executable,
          mTime: o.mtime,
          aTime: o.atime
        };
      },
      toString: function() {
        return JSON.stringify(this.toJSON(), null, "	");
      }
    };
  }, qe;
}
var Qe, $t;
function Xr() {
  return $t || ($t = 1, Qe = {
    efs: !0,
    encode: (e) => Buffer.from(e, "utf8"),
    decode: (e) => e.toString("utf8")
  }), Qe;
}
var xt;
function Oe() {
  return xt || (xt = 1, le.exports = Br(), le.exports.Constants = An(), le.exports.Errors = Tt(), le.exports.FileAttr = jr(), le.exports.decoder = Xr()), le.exports;
}
var be = {}, et, Mt;
function Hr() {
  if (Mt) return et;
  Mt = 1;
  var e = Oe(), t = e.Constants;
  return et = function() {
    var n = 20, r = 10, o = 0, i = 0, s = 0, c = 0, a = 0, u = 0, l = 0, d = 0, g = 0, E = 0, N = 0, L = 0, D = 0;
    n |= e.isWin ? 2560 : 768, o |= t.FLG_EFS;
    const O = {
      extraLen: 0
    }, S = (h) => Math.max(0, h) >>> 0, b = (h) => Math.max(0, h) & 255;
    return s = e.fromDate2DOS(/* @__PURE__ */ new Date()), {
      get made() {
        return n;
      },
      set made(h) {
        n = h;
      },
      get version() {
        return r;
      },
      set version(h) {
        r = h;
      },
      get flags() {
        return o;
      },
      set flags(h) {
        o = h;
      },
      get flags_efs() {
        return (o & t.FLG_EFS) > 0;
      },
      set flags_efs(h) {
        h ? o |= t.FLG_EFS : o &= ~t.FLG_EFS;
      },
      get flags_desc() {
        return (o & t.FLG_DESC) > 0;
      },
      set flags_desc(h) {
        h ? o |= t.FLG_DESC : o &= ~t.FLG_DESC;
      },
      get method() {
        return i;
      },
      set method(h) {
        switch (h) {
          case t.STORED:
            this.version = 10;
          case t.DEFLATED:
          default:
            this.version = 20;
        }
        i = h;
      },
      get time() {
        return e.fromDOS2Date(this.timeval);
      },
      set time(h) {
        h = new Date(h), this.timeval = e.fromDate2DOS(h);
      },
      get timeval() {
        return s;
      },
      set timeval(h) {
        s = S(h);
      },
      get timeHighByte() {
        return b(s >>> 8);
      },
      get crc() {
        return c;
      },
      set crc(h) {
        c = S(h);
      },
      get compressedSize() {
        return a;
      },
      set compressedSize(h) {
        a = S(h);
      },
      get size() {
        return u;
      },
      set size(h) {
        u = S(h);
      },
      get fileNameLength() {
        return l;
      },
      set fileNameLength(h) {
        l = h;
      },
      get extraLength() {
        return d;
      },
      set extraLength(h) {
        d = h;
      },
      get extraLocalLength() {
        return O.extraLen;
      },
      set extraLocalLength(h) {
        O.extraLen = h;
      },
      get commentLength() {
        return g;
      },
      set commentLength(h) {
        g = h;
      },
      get diskNumStart() {
        return E;
      },
      set diskNumStart(h) {
        E = S(h);
      },
      get inAttr() {
        return N;
      },
      set inAttr(h) {
        N = S(h);
      },
      get attr() {
        return L;
      },
      set attr(h) {
        L = S(h);
      },
      // get Unix file permissions
      get fileAttr() {
        return (L || 0) >> 16 & 4095;
      },
      get offset() {
        return D;
      },
      set offset(h) {
        D = S(h);
      },
      get encrypted() {
        return (o & t.FLG_ENC) === t.FLG_ENC;
      },
      get centralHeaderSize() {
        return t.CENHDR + l + d + g;
      },
      get realDataOffset() {
        return D + t.LOCHDR + O.fnameLen + O.extraLen;
      },
      get localHeader() {
        return O;
      },
      loadLocalHeaderFromBinary: function(h) {
        var f = h.slice(D, D + t.LOCHDR);
        if (f.readUInt32LE(0) !== t.LOCSIG)
          throw e.Errors.INVALID_LOC();
        O.version = f.readUInt16LE(t.LOCVER), O.flags = f.readUInt16LE(t.LOCFLG), O.flags_desc = (O.flags & t.FLG_DESC) > 0, O.method = f.readUInt16LE(t.LOCHOW), O.time = f.readUInt32LE(t.LOCTIM), O.crc = f.readUInt32LE(t.LOCCRC), O.compressedSize = f.readUInt32LE(t.LOCSIZ), O.size = f.readUInt32LE(t.LOCLEN), O.fnameLen = f.readUInt16LE(t.LOCNAM), O.extraLen = f.readUInt16LE(t.LOCEXT);
        const _ = D + t.LOCHDR + O.fnameLen, p = _ + O.extraLen;
        return h.slice(_, p);
      },
      loadFromBinary: function(h) {
        if (h.length !== t.CENHDR || h.readUInt32LE(0) !== t.CENSIG)
          throw e.Errors.INVALID_CEN();
        n = h.readUInt16LE(t.CENVEM), r = h.readUInt16LE(t.CENVER), o = h.readUInt16LE(t.CENFLG), i = h.readUInt16LE(t.CENHOW), s = h.readUInt32LE(t.CENTIM), c = h.readUInt32LE(t.CENCRC), a = h.readUInt32LE(t.CENSIZ), u = h.readUInt32LE(t.CENLEN), l = h.readUInt16LE(t.CENNAM), d = h.readUInt16LE(t.CENEXT), g = h.readUInt16LE(t.CENCOM), E = h.readUInt16LE(t.CENDSK), N = h.readUInt16LE(t.CENATT), L = h.readUInt32LE(t.CENATX), D = h.readUInt32LE(t.CENOFF);
      },
      localHeaderToBinary: function() {
        var h = Buffer.alloc(t.LOCHDR);
        return h.writeUInt32LE(t.LOCSIG, 0), h.writeUInt16LE(r, t.LOCVER), h.writeUInt16LE(o, t.LOCFLG), h.writeUInt16LE(i, t.LOCHOW), h.writeUInt32LE(s, t.LOCTIM), h.writeUInt32LE(c, t.LOCCRC), h.writeUInt32LE(a, t.LOCSIZ), h.writeUInt32LE(u, t.LOCLEN), h.writeUInt16LE(l, t.LOCNAM), h.writeUInt16LE(O.extraLen, t.LOCEXT), h;
      },
      centralHeaderToBinary: function() {
        var h = Buffer.alloc(t.CENHDR + l + d + g);
        return h.writeUInt32LE(t.CENSIG, 0), h.writeUInt16LE(n, t.CENVEM), h.writeUInt16LE(r, t.CENVER), h.writeUInt16LE(o, t.CENFLG), h.writeUInt16LE(i, t.CENHOW), h.writeUInt32LE(s, t.CENTIM), h.writeUInt32LE(c, t.CENCRC), h.writeUInt32LE(a, t.CENSIZ), h.writeUInt32LE(u, t.CENLEN), h.writeUInt16LE(l, t.CENNAM), h.writeUInt16LE(d, t.CENEXT), h.writeUInt16LE(g, t.CENCOM), h.writeUInt16LE(E, t.CENDSK), h.writeUInt16LE(N, t.CENATT), h.writeUInt32LE(L, t.CENATX), h.writeUInt32LE(D, t.CENOFF), h;
      },
      toJSON: function() {
        const h = function(f) {
          return f + " bytes";
        };
        return {
          made: n,
          version: r,
          flags: o,
          method: e.methodToString(i),
          time: this.time,
          crc: "0x" + c.toString(16).toUpperCase(),
          compressedSize: h(a),
          size: h(u),
          fileNameLength: h(l),
          extraLength: h(d),
          commentLength: h(g),
          diskNumStart: E,
          inAttr: N,
          attr: L,
          offset: D,
          centralHeaderSize: h(t.CENHDR + l + d + g)
        };
      },
      toString: function() {
        return JSON.stringify(this.toJSON(), null, "	");
      }
    };
  }, et;
}
var tt, Bt;
function Gr() {
  if (Bt) return tt;
  Bt = 1;
  var e = Oe(), t = e.Constants;
  return tt = function() {
    var n = 0, r = 0, o = 0, i = 0, s = 0;
    return {
      get diskEntries() {
        return n;
      },
      set diskEntries(c) {
        n = r = c;
      },
      get totalEntries() {
        return r;
      },
      set totalEntries(c) {
        r = n = c;
      },
      get size() {
        return o;
      },
      set size(c) {
        o = c;
      },
      get offset() {
        return i;
      },
      set offset(c) {
        i = c;
      },
      get commentLength() {
        return s;
      },
      set commentLength(c) {
        s = c;
      },
      get mainHeaderSize() {
        return t.ENDHDR + s;
      },
      loadFromBinary: function(c) {
        if ((c.length !== t.ENDHDR || c.readUInt32LE(0) !== t.ENDSIG) && (c.length < t.ZIP64HDR || c.readUInt32LE(0) !== t.ZIP64SIG))
          throw e.Errors.INVALID_END();
        c.readUInt32LE(0) === t.ENDSIG ? (n = c.readUInt16LE(t.ENDSUB), r = c.readUInt16LE(t.ENDTOT), o = c.readUInt32LE(t.ENDSIZ), i = c.readUInt32LE(t.ENDOFF), s = c.readUInt16LE(t.ENDCOM)) : (n = e.readBigUInt64LE(c, t.ZIP64SUB), r = e.readBigUInt64LE(c, t.ZIP64TOT), o = e.readBigUInt64LE(c, t.ZIP64SIZE), i = e.readBigUInt64LE(c, t.ZIP64OFF), s = 0);
      },
      toBinary: function() {
        var c = Buffer.alloc(t.ENDHDR + s);
        return c.writeUInt32LE(t.ENDSIG, 0), c.writeUInt32LE(0, 4), c.writeUInt16LE(n, t.ENDSUB), c.writeUInt16LE(r, t.ENDTOT), c.writeUInt32LE(o, t.ENDSIZ), c.writeUInt32LE(i, t.ENDOFF), c.writeUInt16LE(s, t.ENDCOM), c.fill(" ", t.ENDHDR), c;
      },
      toJSON: function() {
        const c = function(a, u) {
          let l = a.toString(16).toUpperCase();
          for (; l.length < u; ) l = "0" + l;
          return "0x" + l;
        };
        return {
          diskEntries: n,
          totalEntries: r,
          size: o + " bytes",
          offset: c(i, 4),
          commentLength: s
        };
      },
      toString: function() {
        return JSON.stringify(this.toJSON(), null, "	");
      }
    };
  }, tt;
}
var jt;
function Rn() {
  return jt || (jt = 1, be.EntryHeader = Hr(), be.MainHeader = Gr()), be;
}
var ye = {}, nt, Xt;
function Wr() {
  return Xt || (Xt = 1, nt = function(e) {
    var t = Ln, n = { chunkSize: (parseInt(e.length / 1024) + 1) * 1024 };
    return {
      deflate: function() {
        return t.deflateRawSync(e, n);
      },
      deflateAsync: function(r) {
        var o = t.createDeflateRaw(n), i = [], s = 0;
        o.on("data", function(c) {
          i.push(c), s += c.length;
        }), o.on("end", function() {
          var c = Buffer.alloc(s), a = 0;
          c.fill(0);
          for (var u = 0; u < i.length; u++) {
            var l = i[u];
            l.copy(c, a), a += l.length;
          }
          r && r(c);
        }), o.end(e);
      }
    };
  }), nt;
}
var rt, Ht;
function Vr() {
  if (Ht) return rt;
  Ht = 1;
  const e = +(process.versions ? process.versions.node : "").split(".")[0] || 0;
  return rt = function(t, n) {
    var r = Ln;
    const o = e >= 15 && n > 0 ? { maxOutputLength: n } : {};
    return {
      inflate: function() {
        return r.inflateRawSync(t, o);
      },
      inflateAsync: function(i) {
        var s = r.createInflateRaw(o), c = [], a = 0;
        s.on("data", function(u) {
          c.push(u), a += u.length;
        }), s.on("end", function() {
          var u = Buffer.alloc(a), l = 0;
          u.fill(0);
          for (var d = 0; d < c.length; d++) {
            var g = c[d];
            g.copy(u, l), l += g.length;
          }
          i && i(u);
        }), s.end(t);
      }
    };
  }, rt;
}
var ot, Gt;
function Yr() {
  if (Gt) return ot;
  Gt = 1;
  const { randomFillSync: e } = Sr, t = Tt(), n = new Uint32Array(256).map((E, N) => {
    for (let L = 0; L < 8; L++)
      N & 1 ? N = N >>> 1 ^ 3988292384 : N >>>= 1;
    return N >>> 0;
  }), r = (E, N) => Math.imul(E, N) >>> 0, o = (E, N) => n[(E ^ N) & 255] ^ E >>> 8, i = () => typeof e == "function" ? e(Buffer.alloc(12)) : i.node();
  i.node = () => {
    const E = Buffer.alloc(12), N = E.length;
    for (let L = 0; L < N; L++) E[L] = Math.random() * 256 & 255;
    return E;
  };
  const s = {
    genSalt: i
  };
  function c(E) {
    const N = Buffer.isBuffer(E) ? E : Buffer.from(E);
    this.keys = new Uint32Array([305419896, 591751049, 878082192]);
    for (let L = 0; L < N.length; L++)
      this.updateKeys(N[L]);
  }
  c.prototype.updateKeys = function(E) {
    const N = this.keys;
    return N[0] = o(N[0], E), N[1] += N[0] & 255, N[1] = r(N[1], 134775813) + 1, N[2] = o(N[2], N[1] >>> 24), E;
  }, c.prototype.next = function() {
    const E = (this.keys[2] | 2) >>> 0;
    return r(E, E ^ 1) >> 8 & 255;
  };
  function a(E) {
    const N = new c(E);
    return function(L) {
      const D = Buffer.alloc(L.length);
      let O = 0;
      for (let S of L)
        D[O++] = N.updateKeys(S ^ N.next());
      return D;
    };
  }
  function u(E) {
    const N = new c(E);
    return function(L, D, O = 0) {
      D || (D = Buffer.alloc(L.length));
      for (let S of L) {
        const b = N.next();
        D[O++] = S ^ b, N.updateKeys(S);
      }
      return D;
    };
  }
  function l(E, N, L) {
    if (!E || !Buffer.isBuffer(E) || E.length < 12)
      return Buffer.alloc(0);
    const D = a(L), O = D(E.slice(0, 12)), S = (N.flags & 8) === 8 ? N.timeHighByte : N.crc >>> 24;
    if (O[11] !== S)
      throw t.WRONG_PASSWORD();
    return D(E.slice(12));
  }
  function d(E) {
    Buffer.isBuffer(E) && E.length >= 12 ? s.genSalt = function() {
      return E.slice(0, 12);
    } : E === "node" ? s.genSalt = i.node : s.genSalt = i;
  }
  function g(E, N, L, D = !1) {
    E == null && (E = Buffer.alloc(0)), Buffer.isBuffer(E) || (E = Buffer.from(E.toString()));
    const O = u(L), S = s.genSalt();
    S[11] = N.crc >>> 24 & 255, D && (S[10] = N.crc >>> 16 & 255);
    const b = Buffer.alloc(E.length + 12);
    return O(S, b), O(E, b, 12);
  }
  return ot = { decrypt: l, encrypt: g, _salter: d }, ot;
}
var Wt;
function Kr() {
  return Wt || (Wt = 1, ye.Deflater = Wr(), ye.Inflater = Vr(), ye.ZipCrypto = Yr()), ye;
}
var it, Vt;
function Cn() {
  if (Vt) return it;
  Vt = 1;
  var e = Oe(), t = Rn(), n = e.Constants, r = Kr();
  return it = function(o, i) {
    var s = new t.EntryHeader(), c = Buffer.alloc(0), a = Buffer.alloc(0), u = !1, l = null, d = Buffer.alloc(0), g = Buffer.alloc(0), E = !0;
    const N = o, L = typeof N.decoder == "object" ? N.decoder : e.decoder;
    E = L.hasOwnProperty("efs") ? L.efs : !1;
    function D() {
      return !i || !(i instanceof Uint8Array) ? Buffer.alloc(0) : (g = s.loadLocalHeaderFromBinary(i), i.slice(s.realDataOffset, s.realDataOffset + s.compressedSize));
    }
    function O(p) {
      if (!s.flags_desc && !s.localHeader.flags_desc) {
        if (e.crc32(p) !== s.localHeader.crc)
          return !1;
      } else {
        const m = {}, y = s.realDataOffset + s.compressedSize;
        if (i.readUInt32LE(y) == n.LOCSIG || i.readUInt32LE(y) == n.CENSIG)
          throw e.Errors.DESCRIPTOR_NOT_EXIST();
        if (i.readUInt32LE(y) == n.EXTSIG)
          m.crc = i.readUInt32LE(y + n.EXTCRC), m.compressedSize = i.readUInt32LE(y + n.EXTSIZ), m.size = i.readUInt32LE(y + n.EXTLEN);
        else if (i.readUInt16LE(y + 12) === 19280)
          m.crc = i.readUInt32LE(y + n.EXTCRC - 4), m.compressedSize = i.readUInt32LE(y + n.EXTSIZ - 4), m.size = i.readUInt32LE(y + n.EXTLEN - 4);
        else
          throw e.Errors.DESCRIPTOR_UNKNOWN();
        if (m.compressedSize !== s.compressedSize || m.size !== s.size || m.crc !== s.crc)
          throw e.Errors.DESCRIPTOR_FAULTY();
        if (e.crc32(p) !== m.crc)
          return !1;
      }
      return !0;
    }
    function S(p, m, y) {
      if (typeof m > "u" && typeof p == "string" && (y = p, p = void 0), u)
        return p && m && m(Buffer.alloc(0), e.Errors.DIRECTORY_CONTENT_ERROR()), Buffer.alloc(0);
      var v = D();
      if (v.length === 0)
        return p && m && m(v), v;
      if (s.encrypted) {
        if (typeof y != "string" && !Buffer.isBuffer(y))
          throw e.Errors.INVALID_PASS_PARAM();
        v = r.ZipCrypto.decrypt(v, s, y);
      }
      var A = Buffer.alloc(s.size);
      switch (s.method) {
        case e.Constants.STORED:
          if (v.copy(A), O(A))
            return p && m && m(A), A;
          throw p && m && m(A, e.Errors.BAD_CRC()), e.Errors.BAD_CRC();
        case e.Constants.DEFLATED:
          var w = new r.Inflater(v, s.size);
          if (p)
            w.inflateAsync(function(I) {
              I.copy(I, 0), m && (O(I) ? m(I) : m(I, e.Errors.BAD_CRC()));
            });
          else {
            if (w.inflate(A).copy(A, 0), !O(A))
              throw e.Errors.BAD_CRC(`"${L.decode(c)}"`);
            return A;
          }
          break;
        default:
          throw p && m && m(Buffer.alloc(0), e.Errors.UNKNOWN_METHOD()), e.Errors.UNKNOWN_METHOD();
      }
    }
    function b(p, m) {
      if ((!l || !l.length) && Buffer.isBuffer(i))
        return p && m && m(D()), D();
      if (l.length && !u) {
        var y;
        switch (s.method) {
          case e.Constants.STORED:
            return s.compressedSize = s.size, y = Buffer.alloc(l.length), l.copy(y), p && m && m(y), y;
          default:
          case e.Constants.DEFLATED:
            var v = new r.Deflater(l);
            if (p)
              v.deflateAsync(function(w) {
                y = Buffer.alloc(w.length), s.compressedSize = w.length, w.copy(y), m && m(y);
              });
            else {
              var A = v.deflate();
              return s.compressedSize = A.length, A;
            }
            v = null;
            break;
        }
      } else if (p && m)
        m(Buffer.alloc(0));
      else
        return Buffer.alloc(0);
    }
    function h(p, m) {
      return e.readBigUInt64LE(p, m);
    }
    function f(p) {
      try {
        for (var m = 0, y, v, A; m + 4 < p.length; )
          y = p.readUInt16LE(m), m += 2, v = p.readUInt16LE(m), m += 2, A = p.slice(m, m + v), m += v, n.ID_ZIP64 === y && _(A);
      } catch {
        throw e.Errors.EXTRA_FIELD_PARSE_ERROR();
      }
    }
    function _(p) {
      var m, y, v, A;
      p.length >= n.EF_ZIP64_SCOMP && (m = h(p, n.EF_ZIP64_SUNCOMP), s.size === n.EF_ZIP64_OR_32 && (s.size = m)), p.length >= n.EF_ZIP64_RHO && (y = h(p, n.EF_ZIP64_SCOMP), s.compressedSize === n.EF_ZIP64_OR_32 && (s.compressedSize = y)), p.length >= n.EF_ZIP64_DSN && (v = h(p, n.EF_ZIP64_RHO), s.offset === n.EF_ZIP64_OR_32 && (s.offset = v)), p.length >= n.EF_ZIP64_DSN + 4 && (A = p.readUInt32LE(n.EF_ZIP64_DSN), s.diskNumStart === n.EF_ZIP64_OR_16 && (s.diskNumStart = A));
    }
    return {
      get entryName() {
        return L.decode(c);
      },
      get rawEntryName() {
        return c;
      },
      set entryName(p) {
        c = e.toBuffer(p, L.encode);
        var m = c[c.length - 1];
        u = m === 47 || m === 92, s.fileNameLength = c.length;
      },
      get efs() {
        return typeof E == "function" ? E(this.entryName) : E;
      },
      get extra() {
        return d;
      },
      set extra(p) {
        d = p, s.extraLength = p.length, f(p);
      },
      get comment() {
        return L.decode(a);
      },
      set comment(p) {
        if (a = e.toBuffer(p, L.encode), s.commentLength = a.length, a.length > 65535) throw e.Errors.COMMENT_TOO_LONG();
      },
      get name() {
        var p = L.decode(c);
        return u ? p.substr(p.length - 1).split("/").pop() : p.split("/").pop();
      },
      get isDirectory() {
        return u;
      },
      getCompressedData: function() {
        return b(!1, null);
      },
      getCompressedDataAsync: function(p) {
        b(!0, p);
      },
      setData: function(p) {
        l = e.toBuffer(p, e.decoder.encode), !u && l.length ? (s.size = l.length, s.method = e.Constants.DEFLATED, s.crc = e.crc32(p), s.changed = !0) : s.method = e.Constants.STORED;
      },
      getData: function(p) {
        return s.changed ? l : S(!1, null, p);
      },
      getDataAsync: function(p, m) {
        s.changed ? p(l) : S(!0, p, m);
      },
      set attr(p) {
        s.attr = p;
      },
      get attr() {
        return s.attr;
      },
      set header(p) {
        s.loadFromBinary(p);
      },
      get header() {
        return s;
      },
      packCentralHeader: function() {
        s.flags_efs = this.efs, s.extraLength = d.length;
        var p = s.centralHeaderToBinary(), m = e.Constants.CENHDR;
        return c.copy(p, m), m += c.length, d.copy(p, m), m += s.extraLength, a.copy(p, m), p;
      },
      packLocalHeader: function() {
        let p = 0;
        s.flags_efs = this.efs, s.extraLocalLength = g.length;
        const m = s.localHeaderToBinary(), y = Buffer.alloc(m.length + c.length + s.extraLocalLength);
        return m.copy(y, p), p += m.length, c.copy(y, p), p += c.length, g.copy(y, p), p += g.length, y;
      },
      toJSON: function() {
        const p = function(m) {
          return "<" + (m && m.length + " bytes buffer" || "null") + ">";
        };
        return {
          entryName: this.entryName,
          name: this.name,
          comment: this.comment,
          isDirectory: this.isDirectory,
          header: s.toJSON(),
          compressedData: p(i),
          data: p(l)
        };
      },
      toString: function() {
        return JSON.stringify(this.toJSON(), null, "	");
      }
    };
  }, it;
}
var st, Yt;
function Jr() {
  if (Yt) return st;
  Yt = 1;
  const e = Cn(), t = Rn(), n = Oe();
  return st = function(r, o) {
    var i = [], s = {}, c = Buffer.alloc(0), a = new t.MainHeader(), u = !1;
    const l = /* @__PURE__ */ new Set(), d = o, { noSort: g, decoder: E } = d;
    r ? D(d.readEntries) : u = !0;
    function N() {
      const S = /* @__PURE__ */ new Set();
      for (const b of Object.keys(s)) {
        const h = b.split("/");
        if (h.pop(), !!h.length)
          for (let f = 0; f < h.length; f++) {
            const _ = h.slice(0, f + 1).join("/") + "/";
            S.add(_);
          }
      }
      for (const b of S)
        if (!(b in s)) {
          const h = new e(d);
          h.entryName = b, h.attr = 16, h.temporary = !0, i.push(h), s[h.entryName] = h, l.add(h);
        }
    }
    function L() {
      if (u = !0, s = {}, a.diskEntries > (r.length - a.offset) / n.Constants.CENHDR)
        throw n.Errors.DISK_ENTRY_TOO_LARGE();
      i = new Array(a.diskEntries);
      for (var S = a.offset, b = 0; b < i.length; b++) {
        var h = S, f = new e(d, r);
        f.header = r.slice(h, h += n.Constants.CENHDR), f.entryName = r.slice(h, h += f.header.fileNameLength), f.header.extraLength && (f.extra = r.slice(h, h += f.header.extraLength)), f.header.commentLength && (f.comment = r.slice(h, h + f.header.commentLength)), S += f.header.centralHeaderSize, i[b] = f, s[f.entryName] = f;
      }
      l.clear(), N();
    }
    function D(S) {
      var b = r.length - n.Constants.ENDHDR, h = Math.max(0, b - 65535), f = h, _ = r.length, p = -1, m = 0;
      for ((typeof d.trailingSpace == "boolean" ? d.trailingSpace : !1) && (h = 0), b; b >= f; b--)
        if (r[b] === 80) {
          if (r.readUInt32LE(b) === n.Constants.ENDSIG) {
            p = b, m = b, _ = b + n.Constants.ENDHDR, f = b - n.Constants.END64HDR;
            continue;
          }
          if (r.readUInt32LE(b) === n.Constants.END64SIG) {
            f = h;
            continue;
          }
          if (r.readUInt32LE(b) === n.Constants.ZIP64SIG) {
            p = b, _ = b + n.readBigUInt64LE(r, b + n.Constants.ZIP64SIZE) + n.Constants.ZIP64LEAD;
            break;
          }
        }
      if (p == -1) throw n.Errors.INVALID_FORMAT();
      a.loadFromBinary(r.slice(p, _)), a.commentLength && (c = r.slice(m + n.Constants.ENDHDR)), S && L();
    }
    function O() {
      i.length > 1 && !g && i.sort((S, b) => S.entryName.toLowerCase().localeCompare(b.entryName.toLowerCase()));
    }
    return {
      /**
       * Returns an array of ZipEntry objects existent in the current opened archive
       * @return Array
       */
      get entries() {
        return u || L(), i.filter((S) => !l.has(S));
      },
      /**
       * Archive comment
       * @return {String}
       */
      get comment() {
        return E.decode(c);
      },
      set comment(S) {
        c = n.toBuffer(S, E.encode), a.commentLength = c.length;
      },
      getEntryCount: function() {
        return u ? i.length : a.diskEntries;
      },
      forEach: function(S) {
        this.entries.forEach(S);
      },
      /**
       * Returns a reference to the entry with the given name or null if entry is inexistent
       *
       * @param entryName
       * @return ZipEntry
       */
      getEntry: function(S) {
        return u || L(), s[S] || null;
      },
      /**
       * Adds the given entry to the entry list
       *
       * @param entry
       */
      setEntry: function(S) {
        u || L(), i.push(S), s[S.entryName] = S, a.totalEntries = i.length;
      },
      /**
       * Removes the file with the given name from the entry list.
       *
       * If the entry is a directory, then all nested files and directories will be removed
       * @param entryName
       * @returns {void}
       */
      deleteFile: function(S, b = !0) {
        u || L();
        const h = s[S];
        this.getEntryChildren(h, b).map((_) => _.entryName).forEach(this.deleteEntry);
      },
      /**
       * Removes the entry with the given name from the entry list.
       *
       * @param {string} entryName
       * @returns {void}
       */
      deleteEntry: function(S) {
        u || L();
        const b = s[S], h = i.indexOf(b);
        h >= 0 && (i.splice(h, 1), delete s[S], a.totalEntries = i.length);
      },
      /**
       *  Iterates and returns all nested files and directories of the given entry
       *
       * @param entry
       * @return Array
       */
      getEntryChildren: function(S, b = !0) {
        if (u || L(), typeof S == "object")
          if (S.isDirectory && b) {
            const h = [], f = S.entryName;
            for (const _ of i)
              _.entryName.startsWith(f) && h.push(_);
            return h;
          } else
            return [S];
        return [];
      },
      /**
       *  How many child elements entry has
       *
       * @param {ZipEntry} entry
       * @return {integer}
       */
      getChildCount: function(S) {
        if (S && S.isDirectory) {
          const b = this.getEntryChildren(S);
          return b.includes(S) ? b.length - 1 : b.length;
        }
        return 0;
      },
      /**
       * Returns the zip file
       *
       * @return Buffer
       */
      compressToBuffer: function() {
        u || L(), O();
        const S = [], b = [];
        let h = 0, f = 0;
        a.size = 0, a.offset = 0;
        let _ = 0;
        for (const y of this.entries) {
          const v = y.getCompressedData();
          y.header.offset = f;
          const A = y.packLocalHeader(), w = A.length + v.length;
          f += w, S.push(A), S.push(v);
          const I = y.packCentralHeader();
          b.push(I), a.size += I.length, h += w + I.length, _++;
        }
        h += a.mainHeaderSize, a.offset = f, a.totalEntries = _, f = 0;
        const p = Buffer.alloc(h);
        for (const y of S)
          y.copy(p, f), f += y.length;
        for (const y of b)
          y.copy(p, f), f += y.length;
        const m = a.toBinary();
        return c && c.copy(m, n.Constants.ENDHDR), m.copy(p, f), r = p, u = !1, p;
      },
      toAsyncBuffer: function(S, b, h, f) {
        try {
          u || L(), O();
          const _ = [], p = [];
          let m = 0, y = 0, v = 0;
          a.size = 0, a.offset = 0;
          const A = function(w) {
            if (w.length > 0) {
              const I = w.shift(), k = I.entryName + I.extra.toString();
              h && h(k), I.getCompressedDataAsync(function(U) {
                f && f(k), I.header.offset = y;
                const J = I.packLocalHeader(), X = J.length + U.length;
                y += X, _.push(J), _.push(U);
                const q = I.packCentralHeader();
                p.push(q), a.size += q.length, m += X + q.length, v++, A(w);
              });
            } else {
              m += a.mainHeaderSize, a.offset = y, a.totalEntries = v, y = 0;
              const I = Buffer.alloc(m);
              _.forEach(function(U) {
                U.copy(I, y), y += U.length;
              }), p.forEach(function(U) {
                U.copy(I, y), y += U.length;
              });
              const k = a.toBinary();
              c && c.copy(k, n.Constants.ENDHDR), k.copy(I, y), r = I, u = !1, S(I);
            }
          };
          A(Array.from(this.entries));
        } catch (_) {
          b(_);
        }
      }
    };
  }, st;
}
var at, Kt;
function qr() {
  if (Kt) return at;
  Kt = 1;
  const e = Oe(), t = _t, n = Cn(), r = Jr(), o = (...a) => e.findLast(a, (u) => typeof u == "boolean"), i = (...a) => e.findLast(a, (u) => typeof u == "string"), s = (...a) => e.findLast(a, (u) => typeof u == "function"), c = {
    // option "noSort" : if true it disables files sorting
    noSort: !1,
    // read entries during load (initial loading may be slower)
    readEntries: !1,
    // default method is none
    method: e.Constants.NONE,
    // file system
    fs: null
  };
  return at = function(a, u) {
    let l = null;
    const d = Object.assign(/* @__PURE__ */ Object.create(null), c);
    a && typeof a == "object" && (a instanceof Uint8Array || (Object.assign(d, a), a = d.input ? d.input : void 0, d.input && delete d.input), Buffer.isBuffer(a) && (l = a, d.method = e.Constants.BUFFER, a = void 0)), Object.assign(d, u);
    const g = new e(d);
    if ((typeof d.decoder != "object" || typeof d.decoder.encode != "function" || typeof d.decoder.decode != "function") && (d.decoder = e.decoder), a && typeof a == "string")
      if (g.fs.existsSync(a))
        d.method = e.Constants.FILE, d.filename = a, l = g.fs.readFileSync(a);
      else
        throw e.Errors.INVALID_FILENAME();
    const E = new r(l, d), { canonical: N, sanitize: L, zipnamefix: D } = e;
    function O(f) {
      if (f && E) {
        var _;
        if (typeof f == "string" && (_ = E.getEntry(t.posix.normalize(f))), typeof f == "object" && typeof f.entryName < "u" && typeof f.header < "u" && (_ = E.getEntry(f.entryName)), _)
          return _;
      }
      return null;
    }
    function S(f) {
      const { join: _, normalize: p, sep: m } = t.posix;
      return _(t.isAbsolute(f) ? "/" : ".", p(m + f.split("\\").join(m) + m));
    }
    function b(f) {
      return f instanceof RegExp ? /* @__PURE__ */ function(_) {
        return function(p) {
          return _.test(p);
        };
      }(f) : typeof f != "function" ? () => !0 : f;
    }
    const h = (f, _) => {
      let p = _.slice(-1);
      return p = p === g.sep ? g.sep : "", t.relative(f, _) + p;
    };
    return {
      /**
       * Extracts the given entry from the archive and returns the content as a Buffer object
       * @param {ZipEntry|string} entry ZipEntry object or String with the full path of the entry
       * @param {Buffer|string} [pass] - password
       * @return Buffer or Null in case of error
       */
      readFile: function(f, _) {
        var p = O(f);
        return p && p.getData(_) || null;
      },
      /**
       * Returns how many child elements has on entry (directories) on files it is always 0
       * @param {ZipEntry|string} entry ZipEntry object or String with the full path of the entry
       * @returns {integer}
       */
      childCount: function(f) {
        const _ = O(f);
        if (_)
          return E.getChildCount(_);
      },
      /**
       * Asynchronous readFile
       * @param {ZipEntry|string} entry ZipEntry object or String with the full path of the entry
       * @param {callback} callback
       *
       * @return Buffer or Null in case of error
       */
      readFileAsync: function(f, _) {
        var p = O(f);
        p ? p.getDataAsync(_) : _(null, "getEntry failed for:" + f);
      },
      /**
       * Extracts the given entry from the archive and returns the content as plain text in the given encoding
       * @param {ZipEntry|string} entry - ZipEntry object or String with the full path of the entry
       * @param {string} encoding - Optional. If no encoding is specified utf8 is used
       *
       * @return String
       */
      readAsText: function(f, _) {
        var p = O(f);
        if (p) {
          var m = p.getData();
          if (m && m.length)
            return m.toString(_ || "utf8");
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
      readAsTextAsync: function(f, _, p) {
        var m = O(f);
        m ? m.getDataAsync(function(y, v) {
          if (v) {
            _(y, v);
            return;
          }
          y && y.length ? _(y.toString(p || "utf8")) : _("");
        }) : _("");
      },
      /**
       * Remove the entry from the file or the entry and all it's nested directories and files if the given entry is a directory
       *
       * @param {ZipEntry|string} entry
       * @returns {void}
       */
      deleteFile: function(f, _ = !0) {
        var p = O(f);
        p && E.deleteFile(p.entryName, _);
      },
      /**
       * Remove the entry from the file or directory without affecting any nested entries
       *
       * @param {ZipEntry|string} entry
       * @returns {void}
       */
      deleteEntry: function(f) {
        var _ = O(f);
        _ && E.deleteEntry(_.entryName);
      },
      /**
       * Adds a comment to the zip. The zip must be rewritten after adding the comment.
       *
       * @param {string} comment
       */
      addZipComment: function(f) {
        E.comment = f;
      },
      /**
       * Returns the zip comment
       *
       * @return String
       */
      getZipComment: function() {
        return E.comment || "";
      },
      /**
       * Adds a comment to a specified zipEntry. The zip must be rewritten after adding the comment
       * The comment cannot exceed 65535 characters in length
       *
       * @param {ZipEntry} entry
       * @param {string} comment
       */
      addZipEntryComment: function(f, _) {
        var p = O(f);
        p && (p.comment = _);
      },
      /**
       * Returns the comment of the specified entry
       *
       * @param {ZipEntry} entry
       * @return String
       */
      getZipEntryComment: function(f) {
        var _ = O(f);
        return _ && _.comment || "";
      },
      /**
       * Updates the content of an existing entry inside the archive. The zip must be rewritten after updating the content
       *
       * @param {ZipEntry} entry
       * @param {Buffer} content
       */
      updateFile: function(f, _) {
        var p = O(f);
        p && p.setData(_);
      },
      /**
       * Adds a file from the disk to the archive
       *
       * @param {string} localPath File to add to zip
       * @param {string} [zipPath] Optional path inside the zip
       * @param {string} [zipName] Optional name for the file
       * @param {string} [comment] Optional file comment
       */
      addLocalFile: function(f, _, p, m) {
        if (g.fs.existsSync(f)) {
          _ = _ ? S(_) : "";
          const y = t.win32.basename(t.win32.normalize(f));
          _ += p || y;
          const v = g.fs.statSync(f), A = v.isFile() ? g.fs.readFileSync(f) : Buffer.alloc(0);
          v.isDirectory() && (_ += g.sep), this.addFile(_, A, m, v);
        } else
          throw e.Errors.FILE_NOT_FOUND(f);
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
      addLocalFileAsync: function(f, _) {
        f = typeof f == "object" ? f : { localPath: f };
        const p = t.resolve(f.localPath), { comment: m } = f;
        let { zipPath: y, zipName: v } = f;
        const A = this;
        g.fs.stat(p, function(w, I) {
          if (w) return _(w, !1);
          y = y ? S(y) : "";
          const k = t.win32.basename(t.win32.normalize(p));
          if (y += v || k, I.isFile())
            g.fs.readFile(p, function(U, J) {
              return U ? _(U, !1) : (A.addFile(y, J, m, I), setImmediate(_, void 0, !0));
            });
          else if (I.isDirectory())
            return y += g.sep, A.addFile(y, Buffer.alloc(0), m, I), setImmediate(_, void 0, !0);
        });
      },
      /**
       * Adds a local directory and all its nested files and directories to the archive
       *
       * @param {string} localPath - local path to the folder
       * @param {string} [zipPath] - optional path inside zip
       * @param {(RegExp|function)} [filter] - optional RegExp or Function if files match will be included.
       */
      addLocalFolder: function(f, _, p) {
        if (p = b(p), _ = _ ? S(_) : "", f = t.normalize(f), g.fs.existsSync(f)) {
          const m = g.findFiles(f), y = this;
          if (m.length)
            for (const v of m) {
              const A = t.join(_, h(f, v));
              p(A) && y.addLocalFile(v, t.dirname(A));
            }
        } else
          throw e.Errors.FILE_NOT_FOUND(f);
      },
      /**
       * Asynchronous addLocalFolder
       * @param {string} localPath
       * @param {callback} callback
       * @param {string} [zipPath] optional path inside zip
       * @param {RegExp|function} [filter] optional RegExp or Function if files match will
       *               be included.
       */
      addLocalFolderAsync: function(f, _, p, m) {
        m = b(m), p = p ? S(p) : "", f = t.normalize(f);
        var y = this;
        g.fs.open(f, "r", function(v) {
          if (v && v.code === "ENOENT")
            _(void 0, e.Errors.FILE_NOT_FOUND(f));
          else if (v)
            _(void 0, v);
          else {
            var A = g.findFiles(f), w = -1, I = function() {
              if (w += 1, w < A.length) {
                var k = A[w], U = h(f, k).split("\\").join("/");
                U = U.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\x20-\x7E]/g, ""), m(U) ? g.fs.stat(k, function(J, X) {
                  J && _(void 0, J), X.isFile() ? g.fs.readFile(k, function(q, re) {
                    q ? _(void 0, q) : (y.addFile(p + U, re, "", X), I());
                  }) : (y.addFile(p + U + "/", Buffer.alloc(0), "", X), I());
                }) : process.nextTick(() => {
                  I();
                });
              } else
                _(!0, void 0);
            };
            I();
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
      addLocalFolderAsync2: function(f, _) {
        const p = this;
        f = typeof f == "object" ? f : { localPath: f }, localPath = t.resolve(S(f.localPath));
        let { zipPath: m, filter: y, namefix: v } = f;
        y instanceof RegExp ? y = /* @__PURE__ */ function(I) {
          return function(k) {
            return I.test(k);
          };
        }(y) : typeof y != "function" && (y = function() {
          return !0;
        }), m = m ? S(m) : "", v == "latin1" && (v = (I) => I.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\x20-\x7E]/g, "")), typeof v != "function" && (v = (I) => I);
        const A = (I) => t.join(m, v(h(localPath, I))), w = (I) => t.win32.basename(t.win32.normalize(v(I)));
        g.fs.open(localPath, "r", function(I) {
          I && I.code === "ENOENT" ? _(void 0, e.Errors.FILE_NOT_FOUND(localPath)) : I ? _(void 0, I) : g.findFilesAsync(localPath, function(k, U) {
            if (k) return _(k);
            U = U.filter((J) => y(A(J))), U.length || _(void 0, !1), setImmediate(
              U.reverse().reduce(function(J, X) {
                return function(q, re) {
                  if (q || re === !1) return setImmediate(J, q, !1);
                  p.addLocalFileAsync(
                    {
                      localPath: X,
                      zipPath: t.dirname(A(X)),
                      zipName: w(X)
                    },
                    J
                  );
                };
              }, _)
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
      addLocalFolderPromise: function(f, _) {
        return new Promise((p, m) => {
          this.addLocalFolderAsync2(Object.assign({ localPath: f }, _), (y, v) => {
            y && m(y), v && p(this);
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
      addFile: function(f, _, p, m) {
        f = D(f);
        let y = O(f);
        const v = y != null;
        v || (y = new n(d), y.entryName = f), y.comment = p || "";
        const A = typeof m == "object" && m instanceof g.fs.Stats;
        A && (y.header.time = m.mtime);
        var w = y.isDirectory ? 16 : 0;
        let I = y.isDirectory ? 16384 : 32768;
        return A ? I |= 4095 & m.mode : typeof m == "number" ? I |= 4095 & m : I |= y.isDirectory ? 493 : 420, w = (w | I << 16) >>> 0, y.attr = w, y.setData(_), v || E.setEntry(y), y;
      },
      /**
       * Returns an array of ZipEntry objects representing the files and folders inside the archive
       *
       * @param {string} [password]
       * @returns Array
       */
      getEntries: function(f) {
        return E.password = f, E ? E.entries : [];
      },
      /**
       * Returns a ZipEntry object representing the file or folder specified by ``name``.
       *
       * @param {string} name
       * @return ZipEntry
       */
      getEntry: function(f) {
        return O(f);
      },
      getEntryCount: function() {
        return E.getEntryCount();
      },
      forEach: function(f) {
        return E.forEach(f);
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
      extractEntryTo: function(f, _, p, m, y, v) {
        m = o(!1, m), y = o(!1, y), p = o(!0, p), v = i(y, v);
        var A = O(f);
        if (!A)
          throw e.Errors.NO_ENTRY();
        var w = N(A.entryName), I = L(_, v && !A.isDirectory ? v : p ? w : t.basename(w));
        if (A.isDirectory) {
          var k = E.getEntryChildren(A);
          return k.forEach(function(X) {
            if (X.isDirectory) return;
            var q = X.getData();
            if (!q)
              throw e.Errors.CANT_EXTRACT_FILE();
            var re = N(X.entryName), Xe = L(_, p ? re : t.basename(re));
            const He = y ? X.header.fileAttr : void 0;
            g.writeFileTo(Xe, q, m, He);
          }), !0;
        }
        var U = A.getData(E.password);
        if (!U) throw e.Errors.CANT_EXTRACT_FILE();
        if (g.fs.existsSync(I) && !m)
          throw e.Errors.CANT_OVERRIDE();
        const J = y ? f.header.fileAttr : void 0;
        return g.writeFileTo(I, U, m, J), !0;
      },
      /**
       * Test the archive
       * @param {string} [pass]
       */
      test: function(f) {
        if (!E)
          return !1;
        for (var _ in E.entries)
          try {
            if (_.isDirectory)
              continue;
            var p = E.entries[_].getData(f);
            if (!p)
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
      extractAllTo: function(f, _, p, m) {
        if (p = o(!1, p), m = i(p, m), _ = o(!1, _), !E) throw e.Errors.NO_ZIP();
        E.entries.forEach(function(y) {
          var v = L(f, N(y.entryName));
          if (y.isDirectory) {
            g.makeDir(v);
            return;
          }
          var A = y.getData(m);
          if (!A)
            throw e.Errors.CANT_EXTRACT_FILE();
          const w = p ? y.header.fileAttr : void 0;
          g.writeFileTo(v, A, _, w);
          try {
            g.fs.utimesSync(v, y.header.time, y.header.time);
          } catch {
            throw e.Errors.CANT_EXTRACT_FILE();
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
      extractAllToAsync: function(f, _, p, m) {
        if (m = s(_, p, m), p = o(!1, p), _ = o(!1, _), !m)
          return new Promise((I, k) => {
            this.extractAllToAsync(f, _, p, function(U) {
              U ? k(U) : I(this);
            });
          });
        if (!E) {
          m(e.Errors.NO_ZIP());
          return;
        }
        f = t.resolve(f);
        const y = (I) => L(f, t.normalize(N(I.entryName))), v = (I, k) => new Error(I + ': "' + k + '"'), A = [], w = [];
        E.entries.forEach((I) => {
          I.isDirectory ? A.push(I) : w.push(I);
        });
        for (const I of A) {
          const k = y(I), U = p ? I.header.fileAttr : void 0;
          try {
            g.makeDir(k), U && g.fs.chmodSync(k, U), g.fs.utimesSync(k, I.header.time, I.header.time);
          } catch {
            m(v("Unable to create folder", k));
          }
        }
        w.reverse().reduce(function(I, k) {
          return function(U) {
            if (U)
              I(U);
            else {
              const J = t.normalize(N(k.entryName)), X = L(f, J);
              k.getDataAsync(function(q, re) {
                if (re)
                  I(re);
                else if (!q)
                  I(e.Errors.CANT_EXTRACT_FILE());
                else {
                  const Xe = p ? k.header.fileAttr : void 0;
                  g.writeFileToAsync(X, q, _, Xe, function(He) {
                    He || I(v("Unable to write file", X)), g.fs.utimes(X, k.header.time, k.header.time, function(hr) {
                      hr ? I(v("Unable to set times", X)) : I();
                    });
                  });
                }
              });
            }
          };
        }, m)();
      },
      /**
       * Writes the newly created zip file to disk at the specified location or if a zip was opened and no ``targetFileName`` is provided, it will overwrite the opened zip
       *
       * @param {string} targetFileName
       * @param {function} callback
       */
      writeZip: function(f, _) {
        if (arguments.length === 1 && typeof f == "function" && (_ = f, f = ""), !f && d.filename && (f = d.filename), !!f) {
          var p = E.compressToBuffer();
          if (p) {
            var m = g.writeFileTo(f, p, !0);
            typeof _ == "function" && _(m ? null : new Error("failed"), "");
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
      writeZipPromise: function(f, _) {
        const { overwrite: p, perm: m } = Object.assign({ overwrite: !0 }, _);
        return new Promise((y, v) => {
          !f && d.filename && (f = d.filename), f || v("ADM-ZIP: ZIP File Name Missing"), this.toBufferPromise().then((A) => {
            const w = (I) => I ? y(I) : v("ADM-ZIP: Wasn't able to write zip file");
            g.writeFileToAsync(f, A, p, m, w);
          }, v);
        });
      },
      /**
       * @returns {Promise<Buffer>} A promise to the Buffer.
       */
      toBufferPromise: function() {
        return new Promise((f, _) => {
          E.toAsyncBuffer(f, _);
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
      toBuffer: function(f, _, p, m) {
        return typeof f == "function" ? (E.toAsyncBuffer(f, _, p, m), null) : E.compressToBuffer();
      }
    };
  }, at;
}
var Qr = qr();
const eo = /* @__PURE__ */ Mr(Qr), wn = {
  "cloud-sync": !1,
  "diagnostics-export": !0,
  "query-performance-logs": !0
};
function to(e) {
  return `PHARMACY_FEATURE_${e.replace(/-/g, "_").toUpperCase()}`;
}
function yt(e) {
  const t = process.env[to(e)];
  return t === "1" || t === "true" ? !0 : t === "0" || t === "false" ? !1 : !!wn[e];
}
function no() {
  const e = Object.keys(wn);
  return Object.fromEntries(e.map((t) => [t, yt(t)]));
}
function ro(e) {
  return $.existsSync(e) ? $.readdirSync(e).filter((t) => t.endsWith(".log")).map((t) => F.join(e, t)) : [];
}
function oo(e) {
  const t = F.resolve(e);
  $.mkdirSync(F.dirname(t), { recursive: !0 });
  const n = new eo(), r = ge();
  $.existsSync(r) && n.addLocalFile(r, "database", "pharmacy.db");
  const o = F.join(P.getPath("userData"), "logs");
  for (const s of ro(o))
    n.addLocalFile(s, "logs");
  const i = {
    osPlatform: Ct.platform(),
    osRelease: Ct.release(),
    nodeVersion: process.version,
    appVersion: P.getVersion(),
    dbVersion: gt(),
    userDataPath: P.getPath("userData"),
    featureFlags: no(),
    generatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  return n.addFile("system-info.json", Buffer.from(JSON.stringify(i, null, 2), "utf8")), n.writeZip(t), t;
}
function ct(e, t, n) {
  const r = Date.now(), o = n(), i = Date.now() - r;
  return i > 100 && yt("query-performance-logs") && K.warn("Slow query detected", { ms: i, op: t, sql: e }), o;
}
function io(e) {
  return {
    transaction: e.transaction.bind(e),
    prepare(t) {
      const n = e.prepare(t);
      return {
        run: (...r) => ct(t, "run", () => n.run(...r)),
        get: (...r) => ct(t, "get", () => n.get(...r)),
        all: (...r) => ct(t, "all", () => n.all(...r))
      };
    }
  };
}
function T(e, t, n) {
  function r(c, a) {
    if (c._zod || Object.defineProperty(c, "_zod", {
      value: {
        def: a,
        constr: s,
        traits: /* @__PURE__ */ new Set()
      },
      enumerable: !1
    }), c._zod.traits.has(e))
      return;
    c._zod.traits.add(e), t(c, a);
    const u = s.prototype, l = Object.keys(u);
    for (let d = 0; d < l.length; d++) {
      const g = l[d];
      g in c || (c[g] = u[g].bind(c));
    }
  }
  const o = (n == null ? void 0 : n.Parent) ?? Object;
  class i extends o {
  }
  Object.defineProperty(i, "name", { value: e });
  function s(c) {
    var a;
    const u = n != null && n.Parent ? new i() : this;
    r(u, c), (a = u._zod).deferred ?? (a.deferred = []);
    for (const l of u._zod.deferred)
      l();
    return u;
  }
  return Object.defineProperty(s, "init", { value: r }), Object.defineProperty(s, Symbol.hasInstance, {
    value: (c) => {
      var a, u;
      return n != null && n.Parent && c instanceof n.Parent ? !0 : (u = (a = c == null ? void 0 : c._zod) == null ? void 0 : a.traits) == null ? void 0 : u.has(e);
    }
  }), Object.defineProperty(s, "name", { value: e }), s;
}
class me extends Error {
  constructor() {
    super("Encountered Promise during synchronous parse. Use .parseAsync() instead.");
  }
}
class Un extends Error {
  constructor(t) {
    super(`Encountered unidirectional transform during encode: ${t}`), this.name = "ZodEncodeError";
  }
}
const kn = {};
function se(e) {
  return kn;
}
function zn(e) {
  const t = Object.values(e).filter((r) => typeof r == "number");
  return Object.entries(e).filter(([r, o]) => t.indexOf(+r) === -1).map(([r, o]) => o);
}
function pt(e, t) {
  return typeof t == "bigint" ? t.toString() : t;
}
function Nt(e) {
  return {
    get value() {
      {
        const t = e();
        return Object.defineProperty(this, "value", { value: t }), t;
      }
    }
  };
}
function Lt(e) {
  return e == null;
}
function St(e) {
  const t = e.startsWith("^") ? 1 : 0, n = e.endsWith("$") ? e.length - 1 : e.length;
  return e.slice(t, n);
}
function so(e, t) {
  const n = (e.toString().split(".")[1] || "").length, r = t.toString();
  let o = (r.split(".")[1] || "").length;
  if (o === 0 && /\d?e-\d?/.test(r)) {
    const a = r.match(/\d?e-(\d?)/);
    a != null && a[1] && (o = Number.parseInt(a[1]));
  }
  const i = n > o ? n : o, s = Number.parseInt(e.toFixed(i).replace(".", "")), c = Number.parseInt(t.toFixed(i).replace(".", ""));
  return s % c / 10 ** i;
}
const Jt = Symbol("evaluating");
function z(e, t, n) {
  let r;
  Object.defineProperty(e, t, {
    get() {
      if (r !== Jt)
        return r === void 0 && (r = Jt, r = n()), r;
    },
    set(o) {
      Object.defineProperty(e, t, {
        value: o
        // configurable: true,
      });
    },
    configurable: !0
  });
}
function pe(e, t, n) {
  Object.defineProperty(e, t, {
    value: n,
    writable: !0,
    enumerable: !0,
    configurable: !0
  });
}
function ce(...e) {
  const t = {};
  for (const n of e) {
    const r = Object.getOwnPropertyDescriptors(n);
    Object.assign(t, r);
  }
  return Object.defineProperties({}, t);
}
function qt(e) {
  return JSON.stringify(e);
}
function ao(e) {
  return e.toLowerCase().trim().replace(/[^\w\s-]/g, "").replace(/[\s_-]+/g, "-").replace(/^-+|-+$/g, "");
}
const Fn = "captureStackTrace" in Error ? Error.captureStackTrace : (...e) => {
};
function ke(e) {
  return typeof e == "object" && e !== null && !Array.isArray(e);
}
const co = Nt(() => {
  var e;
  if (typeof navigator < "u" && ((e = navigator == null ? void 0 : navigator.userAgent) != null && e.includes("Cloudflare")))
    return !1;
  try {
    const t = Function;
    return new t(""), !0;
  } catch {
    return !1;
  }
});
function _e(e) {
  if (ke(e) === !1)
    return !1;
  const t = e.constructor;
  if (t === void 0 || typeof t != "function")
    return !0;
  const n = t.prototype;
  return !(ke(n) === !1 || Object.prototype.hasOwnProperty.call(n, "isPrototypeOf") === !1);
}
function Pn(e) {
  return _e(e) ? { ...e } : Array.isArray(e) ? [...e] : e;
}
const uo = /* @__PURE__ */ new Set(["string", "number", "symbol"]);
function xe(e) {
  return e.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function ue(e, t, n) {
  const r = new e._zod.constr(t ?? e._zod.def);
  return (!t || n != null && n.parent) && (r._zod.parent = e), r;
}
function R(e) {
  const t = e;
  if (!t)
    return {};
  if (typeof t == "string")
    return { error: () => t };
  if ((t == null ? void 0 : t.message) !== void 0) {
    if ((t == null ? void 0 : t.error) !== void 0)
      throw new Error("Cannot specify both `message` and `error` params");
    t.error = t.message;
  }
  return delete t.message, typeof t.error == "string" ? { ...t, error: () => t.error } : t;
}
function lo(e) {
  return Object.keys(e).filter((t) => e[t]._zod.optin === "optional" && e[t]._zod.optout === "optional");
}
const fo = {
  safeint: [Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER],
  int32: [-2147483648, 2147483647],
  uint32: [0, 4294967295],
  float32: [-34028234663852886e22, 34028234663852886e22],
  float64: [-Number.MAX_VALUE, Number.MAX_VALUE]
};
function po(e, t) {
  const n = e._zod.def, r = n.checks;
  if (r && r.length > 0)
    throw new Error(".pick() cannot be used on object schemas containing refinements");
  const i = ce(e._zod.def, {
    get shape() {
      const s = {};
      for (const c in t) {
        if (!(c in n.shape))
          throw new Error(`Unrecognized key: "${c}"`);
        t[c] && (s[c] = n.shape[c]);
      }
      return pe(this, "shape", s), s;
    },
    checks: []
  });
  return ue(e, i);
}
function ho(e, t) {
  const n = e._zod.def, r = n.checks;
  if (r && r.length > 0)
    throw new Error(".omit() cannot be used on object schemas containing refinements");
  const i = ce(e._zod.def, {
    get shape() {
      const s = { ...e._zod.def.shape };
      for (const c in t) {
        if (!(c in n.shape))
          throw new Error(`Unrecognized key: "${c}"`);
        t[c] && delete s[c];
      }
      return pe(this, "shape", s), s;
    },
    checks: []
  });
  return ue(e, i);
}
function Eo(e, t) {
  if (!_e(t))
    throw new Error("Invalid input to extend: expected a plain object");
  const n = e._zod.def.checks;
  if (n && n.length > 0) {
    const i = e._zod.def.shape;
    for (const s in t)
      if (Object.getOwnPropertyDescriptor(i, s) !== void 0)
        throw new Error("Cannot overwrite keys on object schemas containing refinements. Use `.safeExtend()` instead.");
  }
  const o = ce(e._zod.def, {
    get shape() {
      const i = { ...e._zod.def.shape, ...t };
      return pe(this, "shape", i), i;
    }
  });
  return ue(e, o);
}
function mo(e, t) {
  if (!_e(t))
    throw new Error("Invalid input to safeExtend: expected a plain object");
  const n = ce(e._zod.def, {
    get shape() {
      const r = { ...e._zod.def.shape, ...t };
      return pe(this, "shape", r), r;
    }
  });
  return ue(e, n);
}
function _o(e, t) {
  const n = ce(e._zod.def, {
    get shape() {
      const r = { ...e._zod.def.shape, ...t._zod.def.shape };
      return pe(this, "shape", r), r;
    },
    get catchall() {
      return t._zod.def.catchall;
    },
    checks: []
    // delete existing checks
  });
  return ue(e, n);
}
function go(e, t, n) {
  const o = t._zod.def.checks;
  if (o && o.length > 0)
    throw new Error(".partial() cannot be used on object schemas containing refinements");
  const s = ce(t._zod.def, {
    get shape() {
      const c = t._zod.def.shape, a = { ...c };
      if (n)
        for (const u in n) {
          if (!(u in c))
            throw new Error(`Unrecognized key: "${u}"`);
          n[u] && (a[u] = e ? new e({
            type: "optional",
            innerType: c[u]
          }) : c[u]);
        }
      else
        for (const u in c)
          a[u] = e ? new e({
            type: "optional",
            innerType: c[u]
          }) : c[u];
      return pe(this, "shape", a), a;
    },
    checks: []
  });
  return ue(t, s);
}
function To(e, t, n) {
  const r = ce(t._zod.def, {
    get shape() {
      const o = t._zod.def.shape, i = { ...o };
      if (n)
        for (const s in n) {
          if (!(s in i))
            throw new Error(`Unrecognized key: "${s}"`);
          n[s] && (i[s] = new e({
            type: "nonoptional",
            innerType: o[s]
          }));
        }
      else
        for (const s in o)
          i[s] = new e({
            type: "nonoptional",
            innerType: o[s]
          });
      return pe(this, "shape", i), i;
    }
  });
  return ue(t, r);
}
function he(e, t = 0) {
  var n;
  if (e.aborted === !0)
    return !0;
  for (let r = t; r < e.issues.length; r++)
    if (((n = e.issues[r]) == null ? void 0 : n.continue) !== !0)
      return !0;
  return !1;
}
function Ee(e, t) {
  return t.map((n) => {
    var r;
    return (r = n).path ?? (r.path = []), n.path.unshift(e), n;
  });
}
function De(e) {
  return typeof e == "string" ? e : e == null ? void 0 : e.message;
}
function ae(e, t, n) {
  var o, i, s, c, a, u;
  const r = { ...e, path: e.path ?? [] };
  if (!e.message) {
    const l = De((s = (i = (o = e.inst) == null ? void 0 : o._zod.def) == null ? void 0 : i.error) == null ? void 0 : s.call(i, e)) ?? De((c = t == null ? void 0 : t.error) == null ? void 0 : c.call(t, e)) ?? De((a = n.customError) == null ? void 0 : a.call(n, e)) ?? De((u = n.localeError) == null ? void 0 : u.call(n, e)) ?? "Invalid input";
    r.message = l;
  }
  return delete r.inst, delete r.continue, t != null && t.reportInput || delete r.input, r;
}
function It(e) {
  return Array.isArray(e) ? "array" : typeof e == "string" ? "string" : "unknown";
}
function Se(...e) {
  const [t, n, r] = e;
  return typeof t == "string" ? {
    message: t,
    code: "custom",
    input: n,
    inst: r
  } : { ...t };
}
const Zn = (e, t) => {
  e.name = "$ZodError", Object.defineProperty(e, "_zod", {
    value: e._zod,
    enumerable: !1
  }), Object.defineProperty(e, "issues", {
    value: t,
    enumerable: !1
  }), e.message = JSON.stringify(t, pt, 2), Object.defineProperty(e, "toString", {
    value: () => e.message,
    enumerable: !1
  });
}, $n = T("$ZodError", Zn), xn = T("$ZodError", Zn, { Parent: Error });
function yo(e, t = (n) => n.message) {
  const n = {}, r = [];
  for (const o of e.issues)
    o.path.length > 0 ? (n[o.path[0]] = n[o.path[0]] || [], n[o.path[0]].push(t(o))) : r.push(t(o));
  return { formErrors: r, fieldErrors: n };
}
function No(e, t = (n) => n.message) {
  const n = { _errors: [] }, r = (o) => {
    for (const i of o.issues)
      if (i.code === "invalid_union" && i.errors.length)
        i.errors.map((s) => r({ issues: s }));
      else if (i.code === "invalid_key")
        r({ issues: i.issues });
      else if (i.code === "invalid_element")
        r({ issues: i.issues });
      else if (i.path.length === 0)
        n._errors.push(t(i));
      else {
        let s = n, c = 0;
        for (; c < i.path.length; ) {
          const a = i.path[c];
          c === i.path.length - 1 ? (s[a] = s[a] || { _errors: [] }, s[a]._errors.push(t(i))) : s[a] = s[a] || { _errors: [] }, s = s[a], c++;
        }
      }
  };
  return r(e), n;
}
const vt = (e) => (t, n, r, o) => {
  const i = r ? Object.assign(r, { async: !1 }) : { async: !1 }, s = t._zod.run({ value: n, issues: [] }, i);
  if (s instanceof Promise)
    throw new me();
  if (s.issues.length) {
    const c = new ((o == null ? void 0 : o.Err) ?? e)(s.issues.map((a) => ae(a, i, se())));
    throw Fn(c, o == null ? void 0 : o.callee), c;
  }
  return s.value;
}, Ot = (e) => async (t, n, r, o) => {
  const i = r ? Object.assign(r, { async: !0 }) : { async: !0 };
  let s = t._zod.run({ value: n, issues: [] }, i);
  if (s instanceof Promise && (s = await s), s.issues.length) {
    const c = new ((o == null ? void 0 : o.Err) ?? e)(s.issues.map((a) => ae(a, i, se())));
    throw Fn(c, o == null ? void 0 : o.callee), c;
  }
  return s.value;
}, Me = (e) => (t, n, r) => {
  const o = r ? { ...r, async: !1 } : { async: !1 }, i = t._zod.run({ value: n, issues: [] }, o);
  if (i instanceof Promise)
    throw new me();
  return i.issues.length ? {
    success: !1,
    error: new (e ?? $n)(i.issues.map((s) => ae(s, o, se())))
  } : { success: !0, data: i.value };
}, Lo = /* @__PURE__ */ Me(xn), Be = (e) => async (t, n, r) => {
  const o = r ? Object.assign(r, { async: !0 }) : { async: !0 };
  let i = t._zod.run({ value: n, issues: [] }, o);
  return i instanceof Promise && (i = await i), i.issues.length ? {
    success: !1,
    error: new e(i.issues.map((s) => ae(s, o, se())))
  } : { success: !0, data: i.value };
}, So = /* @__PURE__ */ Be(xn), Io = (e) => (t, n, r) => {
  const o = r ? Object.assign(r, { direction: "backward" }) : { direction: "backward" };
  return vt(e)(t, n, o);
}, vo = (e) => (t, n, r) => vt(e)(t, n, r), Oo = (e) => async (t, n, r) => {
  const o = r ? Object.assign(r, { direction: "backward" }) : { direction: "backward" };
  return Ot(e)(t, n, o);
}, bo = (e) => async (t, n, r) => Ot(e)(t, n, r), Do = (e) => (t, n, r) => {
  const o = r ? Object.assign(r, { direction: "backward" }) : { direction: "backward" };
  return Me(e)(t, n, o);
}, Ao = (e) => (t, n, r) => Me(e)(t, n, r), Ro = (e) => async (t, n, r) => {
  const o = r ? Object.assign(r, { direction: "backward" }) : { direction: "backward" };
  return Be(e)(t, n, o);
}, Co = (e) => async (t, n, r) => Be(e)(t, n, r), wo = /^[cC][^\s-]{8,}$/, Uo = /^[0-9a-z]+$/, ko = /^[0-9A-HJKMNP-TV-Za-hjkmnp-tv-z]{26}$/, zo = /^[0-9a-vA-V]{20}$/, Fo = /^[A-Za-z0-9]{27}$/, Po = /^[a-zA-Z0-9_-]{21}$/, Zo = /^P(?:(\d+W)|(?!.*W)(?=\d|T\d)(\d+Y)?(\d+M)?(\d+D)?(T(?=\d)(\d+H)?(\d+M)?(\d+([.,]\d+)?S)?)?)$/, $o = /^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$/, Qt = (e) => e ? new RegExp(`^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-${e}[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12})$`) : /^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$/, xo = /^(?!\.)(?!.*\.\.)([A-Za-z0-9_'+\-\.]*)[A-Za-z0-9_+-]@([A-Za-z0-9][A-Za-z0-9\-]*\.)+[A-Za-z]{2,}$/, Mo = "^(\\p{Extended_Pictographic}|\\p{Emoji_Component})+$";
function Bo() {
  return new RegExp(Mo, "u");
}
const jo = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$/, Xo = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:))$/, Ho = /^((25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\/([0-9]|[1-2][0-9]|3[0-2])$/, Go = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|::|([0-9a-fA-F]{1,4})?::([0-9a-fA-F]{1,4}:?){0,6})\/(12[0-8]|1[01][0-9]|[1-9]?[0-9])$/, Wo = /^$|^(?:[0-9a-zA-Z+/]{4})*(?:(?:[0-9a-zA-Z+/]{2}==)|(?:[0-9a-zA-Z+/]{3}=))?$/, Mn = /^[A-Za-z0-9_-]*$/, Vo = /^\+[1-9]\d{6,14}$/, Bn = "(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))", Yo = /* @__PURE__ */ new RegExp(`^${Bn}$`);
function jn(e) {
  const t = "(?:[01]\\d|2[0-3]):[0-5]\\d";
  return typeof e.precision == "number" ? e.precision === -1 ? `${t}` : e.precision === 0 ? `${t}:[0-5]\\d` : `${t}:[0-5]\\d\\.\\d{${e.precision}}` : `${t}(?::[0-5]\\d(?:\\.\\d+)?)?`;
}
function Ko(e) {
  return new RegExp(`^${jn(e)}$`);
}
function Jo(e) {
  const t = jn({ precision: e.precision }), n = ["Z"];
  e.local && n.push(""), e.offset && n.push("([+-](?:[01]\\d|2[0-3]):[0-5]\\d)");
  const r = `${t}(?:${n.join("|")})`;
  return new RegExp(`^${Bn}T(?:${r})$`);
}
const qo = (e) => {
  const t = e ? `[\\s\\S]{${(e == null ? void 0 : e.minimum) ?? 0},${(e == null ? void 0 : e.maximum) ?? ""}}` : "[\\s\\S]*";
  return new RegExp(`^${t}$`);
}, Qo = /^-?\d+$/, Xn = /^-?\d+(?:\.\d+)?$/, ei = /^(?:true|false)$/i, ti = /^[^A-Z]*$/, ni = /^[^a-z]*$/, te = /* @__PURE__ */ T("$ZodCheck", (e, t) => {
  var n;
  e._zod ?? (e._zod = {}), e._zod.def = t, (n = e._zod).onattach ?? (n.onattach = []);
}), Hn = {
  number: "number",
  bigint: "bigint",
  object: "date"
}, Gn = /* @__PURE__ */ T("$ZodCheckLessThan", (e, t) => {
  te.init(e, t);
  const n = Hn[typeof t.value];
  e._zod.onattach.push((r) => {
    const o = r._zod.bag, i = (t.inclusive ? o.maximum : o.exclusiveMaximum) ?? Number.POSITIVE_INFINITY;
    t.value < i && (t.inclusive ? o.maximum = t.value : o.exclusiveMaximum = t.value);
  }), e._zod.check = (r) => {
    (t.inclusive ? r.value <= t.value : r.value < t.value) || r.issues.push({
      origin: n,
      code: "too_big",
      maximum: typeof t.value == "object" ? t.value.getTime() : t.value,
      input: r.value,
      inclusive: t.inclusive,
      inst: e,
      continue: !t.abort
    });
  };
}), Wn = /* @__PURE__ */ T("$ZodCheckGreaterThan", (e, t) => {
  te.init(e, t);
  const n = Hn[typeof t.value];
  e._zod.onattach.push((r) => {
    const o = r._zod.bag, i = (t.inclusive ? o.minimum : o.exclusiveMinimum) ?? Number.NEGATIVE_INFINITY;
    t.value > i && (t.inclusive ? o.minimum = t.value : o.exclusiveMinimum = t.value);
  }), e._zod.check = (r) => {
    (t.inclusive ? r.value >= t.value : r.value > t.value) || r.issues.push({
      origin: n,
      code: "too_small",
      minimum: typeof t.value == "object" ? t.value.getTime() : t.value,
      input: r.value,
      inclusive: t.inclusive,
      inst: e,
      continue: !t.abort
    });
  };
}), ri = /* @__PURE__ */ T("$ZodCheckMultipleOf", (e, t) => {
  te.init(e, t), e._zod.onattach.push((n) => {
    var r;
    (r = n._zod.bag).multipleOf ?? (r.multipleOf = t.value);
  }), e._zod.check = (n) => {
    if (typeof n.value != typeof t.value)
      throw new Error("Cannot mix number and bigint in multiple_of check.");
    (typeof n.value == "bigint" ? n.value % t.value === BigInt(0) : so(n.value, t.value) === 0) || n.issues.push({
      origin: typeof n.value,
      code: "not_multiple_of",
      divisor: t.value,
      input: n.value,
      inst: e,
      continue: !t.abort
    });
  };
}), oi = /* @__PURE__ */ T("$ZodCheckNumberFormat", (e, t) => {
  var s;
  te.init(e, t), t.format = t.format || "float64";
  const n = (s = t.format) == null ? void 0 : s.includes("int"), r = n ? "int" : "number", [o, i] = fo[t.format];
  e._zod.onattach.push((c) => {
    const a = c._zod.bag;
    a.format = t.format, a.minimum = o, a.maximum = i, n && (a.pattern = Qo);
  }), e._zod.check = (c) => {
    const a = c.value;
    if (n) {
      if (!Number.isInteger(a)) {
        c.issues.push({
          expected: r,
          format: t.format,
          code: "invalid_type",
          continue: !1,
          input: a,
          inst: e
        });
        return;
      }
      if (!Number.isSafeInteger(a)) {
        a > 0 ? c.issues.push({
          input: a,
          code: "too_big",
          maximum: Number.MAX_SAFE_INTEGER,
          note: "Integers must be within the safe integer range.",
          inst: e,
          origin: r,
          inclusive: !0,
          continue: !t.abort
        }) : c.issues.push({
          input: a,
          code: "too_small",
          minimum: Number.MIN_SAFE_INTEGER,
          note: "Integers must be within the safe integer range.",
          inst: e,
          origin: r,
          inclusive: !0,
          continue: !t.abort
        });
        return;
      }
    }
    a < o && c.issues.push({
      origin: "number",
      input: a,
      code: "too_small",
      minimum: o,
      inclusive: !0,
      inst: e,
      continue: !t.abort
    }), a > i && c.issues.push({
      origin: "number",
      input: a,
      code: "too_big",
      maximum: i,
      inclusive: !0,
      inst: e,
      continue: !t.abort
    });
  };
}), ii = /* @__PURE__ */ T("$ZodCheckMaxLength", (e, t) => {
  var n;
  te.init(e, t), (n = e._zod.def).when ?? (n.when = (r) => {
    const o = r.value;
    return !Lt(o) && o.length !== void 0;
  }), e._zod.onattach.push((r) => {
    const o = r._zod.bag.maximum ?? Number.POSITIVE_INFINITY;
    t.maximum < o && (r._zod.bag.maximum = t.maximum);
  }), e._zod.check = (r) => {
    const o = r.value;
    if (o.length <= t.maximum)
      return;
    const s = It(o);
    r.issues.push({
      origin: s,
      code: "too_big",
      maximum: t.maximum,
      inclusive: !0,
      input: o,
      inst: e,
      continue: !t.abort
    });
  };
}), si = /* @__PURE__ */ T("$ZodCheckMinLength", (e, t) => {
  var n;
  te.init(e, t), (n = e._zod.def).when ?? (n.when = (r) => {
    const o = r.value;
    return !Lt(o) && o.length !== void 0;
  }), e._zod.onattach.push((r) => {
    const o = r._zod.bag.minimum ?? Number.NEGATIVE_INFINITY;
    t.minimum > o && (r._zod.bag.minimum = t.minimum);
  }), e._zod.check = (r) => {
    const o = r.value;
    if (o.length >= t.minimum)
      return;
    const s = It(o);
    r.issues.push({
      origin: s,
      code: "too_small",
      minimum: t.minimum,
      inclusive: !0,
      input: o,
      inst: e,
      continue: !t.abort
    });
  };
}), ai = /* @__PURE__ */ T("$ZodCheckLengthEquals", (e, t) => {
  var n;
  te.init(e, t), (n = e._zod.def).when ?? (n.when = (r) => {
    const o = r.value;
    return !Lt(o) && o.length !== void 0;
  }), e._zod.onattach.push((r) => {
    const o = r._zod.bag;
    o.minimum = t.length, o.maximum = t.length, o.length = t.length;
  }), e._zod.check = (r) => {
    const o = r.value, i = o.length;
    if (i === t.length)
      return;
    const s = It(o), c = i > t.length;
    r.issues.push({
      origin: s,
      ...c ? { code: "too_big", maximum: t.length } : { code: "too_small", minimum: t.length },
      inclusive: !0,
      exact: !0,
      input: r.value,
      inst: e,
      continue: !t.abort
    });
  };
}), je = /* @__PURE__ */ T("$ZodCheckStringFormat", (e, t) => {
  var n, r;
  te.init(e, t), e._zod.onattach.push((o) => {
    const i = o._zod.bag;
    i.format = t.format, t.pattern && (i.patterns ?? (i.patterns = /* @__PURE__ */ new Set()), i.patterns.add(t.pattern));
  }), t.pattern ? (n = e._zod).check ?? (n.check = (o) => {
    t.pattern.lastIndex = 0, !t.pattern.test(o.value) && o.issues.push({
      origin: "string",
      code: "invalid_format",
      format: t.format,
      input: o.value,
      ...t.pattern ? { pattern: t.pattern.toString() } : {},
      inst: e,
      continue: !t.abort
    });
  }) : (r = e._zod).check ?? (r.check = () => {
  });
}), ci = /* @__PURE__ */ T("$ZodCheckRegex", (e, t) => {
  je.init(e, t), e._zod.check = (n) => {
    t.pattern.lastIndex = 0, !t.pattern.test(n.value) && n.issues.push({
      origin: "string",
      code: "invalid_format",
      format: "regex",
      input: n.value,
      pattern: t.pattern.toString(),
      inst: e,
      continue: !t.abort
    });
  };
}), ui = /* @__PURE__ */ T("$ZodCheckLowerCase", (e, t) => {
  t.pattern ?? (t.pattern = ti), je.init(e, t);
}), li = /* @__PURE__ */ T("$ZodCheckUpperCase", (e, t) => {
  t.pattern ?? (t.pattern = ni), je.init(e, t);
}), fi = /* @__PURE__ */ T("$ZodCheckIncludes", (e, t) => {
  te.init(e, t);
  const n = xe(t.includes), r = new RegExp(typeof t.position == "number" ? `^.{${t.position}}${n}` : n);
  t.pattern = r, e._zod.onattach.push((o) => {
    const i = o._zod.bag;
    i.patterns ?? (i.patterns = /* @__PURE__ */ new Set()), i.patterns.add(r);
  }), e._zod.check = (o) => {
    o.value.includes(t.includes, t.position) || o.issues.push({
      origin: "string",
      code: "invalid_format",
      format: "includes",
      includes: t.includes,
      input: o.value,
      inst: e,
      continue: !t.abort
    });
  };
}), di = /* @__PURE__ */ T("$ZodCheckStartsWith", (e, t) => {
  te.init(e, t);
  const n = new RegExp(`^${xe(t.prefix)}.*`);
  t.pattern ?? (t.pattern = n), e._zod.onattach.push((r) => {
    const o = r._zod.bag;
    o.patterns ?? (o.patterns = /* @__PURE__ */ new Set()), o.patterns.add(n);
  }), e._zod.check = (r) => {
    r.value.startsWith(t.prefix) || r.issues.push({
      origin: "string",
      code: "invalid_format",
      format: "starts_with",
      prefix: t.prefix,
      input: r.value,
      inst: e,
      continue: !t.abort
    });
  };
}), pi = /* @__PURE__ */ T("$ZodCheckEndsWith", (e, t) => {
  te.init(e, t);
  const n = new RegExp(`.*${xe(t.suffix)}$`);
  t.pattern ?? (t.pattern = n), e._zod.onattach.push((r) => {
    const o = r._zod.bag;
    o.patterns ?? (o.patterns = /* @__PURE__ */ new Set()), o.patterns.add(n);
  }), e._zod.check = (r) => {
    r.value.endsWith(t.suffix) || r.issues.push({
      origin: "string",
      code: "invalid_format",
      format: "ends_with",
      suffix: t.suffix,
      input: r.value,
      inst: e,
      continue: !t.abort
    });
  };
}), hi = /* @__PURE__ */ T("$ZodCheckOverwrite", (e, t) => {
  te.init(e, t), e._zod.check = (n) => {
    n.value = t.tx(n.value);
  };
});
class Ei {
  constructor(t = []) {
    this.content = [], this.indent = 0, this && (this.args = t);
  }
  indented(t) {
    this.indent += 1, t(this), this.indent -= 1;
  }
  write(t) {
    if (typeof t == "function") {
      t(this, { execution: "sync" }), t(this, { execution: "async" });
      return;
    }
    const r = t.split(`
`).filter((s) => s), o = Math.min(...r.map((s) => s.length - s.trimStart().length)), i = r.map((s) => s.slice(o)).map((s) => " ".repeat(this.indent * 2) + s);
    for (const s of i)
      this.content.push(s);
  }
  compile() {
    const t = Function, n = this == null ? void 0 : this.args, o = [...((this == null ? void 0 : this.content) ?? [""]).map((i) => `  ${i}`)];
    return new t(...n, o.join(`
`));
  }
}
const mi = {
  major: 4,
  minor: 3,
  patch: 6
}, M = /* @__PURE__ */ T("$ZodType", (e, t) => {
  var o;
  var n;
  e ?? (e = {}), e._zod.def = t, e._zod.bag = e._zod.bag || {}, e._zod.version = mi;
  const r = [...e._zod.def.checks ?? []];
  e._zod.traits.has("$ZodCheck") && r.unshift(e);
  for (const i of r)
    for (const s of i._zod.onattach)
      s(e);
  if (r.length === 0)
    (n = e._zod).deferred ?? (n.deferred = []), (o = e._zod.deferred) == null || o.push(() => {
      e._zod.run = e._zod.parse;
    });
  else {
    const i = (c, a, u) => {
      let l = he(c), d;
      for (const g of a) {
        if (g._zod.def.when) {
          if (!g._zod.def.when(c))
            continue;
        } else if (l)
          continue;
        const E = c.issues.length, N = g._zod.check(c);
        if (N instanceof Promise && (u == null ? void 0 : u.async) === !1)
          throw new me();
        if (d || N instanceof Promise)
          d = (d ?? Promise.resolve()).then(async () => {
            await N, c.issues.length !== E && (l || (l = he(c, E)));
          });
        else {
          if (c.issues.length === E)
            continue;
          l || (l = he(c, E));
        }
      }
      return d ? d.then(() => c) : c;
    }, s = (c, a, u) => {
      if (he(c))
        return c.aborted = !0, c;
      const l = i(a, r, u);
      if (l instanceof Promise) {
        if (u.async === !1)
          throw new me();
        return l.then((d) => e._zod.parse(d, u));
      }
      return e._zod.parse(l, u);
    };
    e._zod.run = (c, a) => {
      if (a.skipChecks)
        return e._zod.parse(c, a);
      if (a.direction === "backward") {
        const l = e._zod.parse({ value: c.value, issues: [] }, { ...a, skipChecks: !0 });
        return l instanceof Promise ? l.then((d) => s(d, c, a)) : s(l, c, a);
      }
      const u = e._zod.parse(c, a);
      if (u instanceof Promise) {
        if (a.async === !1)
          throw new me();
        return u.then((l) => i(l, r, a));
      }
      return i(u, r, a);
    };
  }
  z(e, "~standard", () => ({
    validate: (i) => {
      var s;
      try {
        const c = Lo(e, i);
        return c.success ? { value: c.data } : { issues: (s = c.error) == null ? void 0 : s.issues };
      } catch {
        return So(e, i).then((a) => {
          var u;
          return a.success ? { value: a.data } : { issues: (u = a.error) == null ? void 0 : u.issues };
        });
      }
    },
    vendor: "zod",
    version: 1
  }));
}), bt = /* @__PURE__ */ T("$ZodString", (e, t) => {
  var n;
  M.init(e, t), e._zod.pattern = [...((n = e == null ? void 0 : e._zod.bag) == null ? void 0 : n.patterns) ?? []].pop() ?? qo(e._zod.bag), e._zod.parse = (r, o) => {
    if (t.coerce)
      try {
        r.value = String(r.value);
      } catch {
      }
    return typeof r.value == "string" || r.issues.push({
      expected: "string",
      code: "invalid_type",
      input: r.value,
      inst: e
    }), r;
  };
}), Z = /* @__PURE__ */ T("$ZodStringFormat", (e, t) => {
  je.init(e, t), bt.init(e, t);
}), _i = /* @__PURE__ */ T("$ZodGUID", (e, t) => {
  t.pattern ?? (t.pattern = $o), Z.init(e, t);
}), gi = /* @__PURE__ */ T("$ZodUUID", (e, t) => {
  if (t.version) {
    const r = {
      v1: 1,
      v2: 2,
      v3: 3,
      v4: 4,
      v5: 5,
      v6: 6,
      v7: 7,
      v8: 8
    }[t.version];
    if (r === void 0)
      throw new Error(`Invalid UUID version: "${t.version}"`);
    t.pattern ?? (t.pattern = Qt(r));
  } else
    t.pattern ?? (t.pattern = Qt());
  Z.init(e, t);
}), Ti = /* @__PURE__ */ T("$ZodEmail", (e, t) => {
  t.pattern ?? (t.pattern = xo), Z.init(e, t);
}), yi = /* @__PURE__ */ T("$ZodURL", (e, t) => {
  Z.init(e, t), e._zod.check = (n) => {
    try {
      const r = n.value.trim(), o = new URL(r);
      t.hostname && (t.hostname.lastIndex = 0, t.hostname.test(o.hostname) || n.issues.push({
        code: "invalid_format",
        format: "url",
        note: "Invalid hostname",
        pattern: t.hostname.source,
        input: n.value,
        inst: e,
        continue: !t.abort
      })), t.protocol && (t.protocol.lastIndex = 0, t.protocol.test(o.protocol.endsWith(":") ? o.protocol.slice(0, -1) : o.protocol) || n.issues.push({
        code: "invalid_format",
        format: "url",
        note: "Invalid protocol",
        pattern: t.protocol.source,
        input: n.value,
        inst: e,
        continue: !t.abort
      })), t.normalize ? n.value = o.href : n.value = r;
      return;
    } catch {
      n.issues.push({
        code: "invalid_format",
        format: "url",
        input: n.value,
        inst: e,
        continue: !t.abort
      });
    }
  };
}), Ni = /* @__PURE__ */ T("$ZodEmoji", (e, t) => {
  t.pattern ?? (t.pattern = Bo()), Z.init(e, t);
}), Li = /* @__PURE__ */ T("$ZodNanoID", (e, t) => {
  t.pattern ?? (t.pattern = Po), Z.init(e, t);
}), Si = /* @__PURE__ */ T("$ZodCUID", (e, t) => {
  t.pattern ?? (t.pattern = wo), Z.init(e, t);
}), Ii = /* @__PURE__ */ T("$ZodCUID2", (e, t) => {
  t.pattern ?? (t.pattern = Uo), Z.init(e, t);
}), vi = /* @__PURE__ */ T("$ZodULID", (e, t) => {
  t.pattern ?? (t.pattern = ko), Z.init(e, t);
}), Oi = /* @__PURE__ */ T("$ZodXID", (e, t) => {
  t.pattern ?? (t.pattern = zo), Z.init(e, t);
}), bi = /* @__PURE__ */ T("$ZodKSUID", (e, t) => {
  t.pattern ?? (t.pattern = Fo), Z.init(e, t);
}), Di = /* @__PURE__ */ T("$ZodISODateTime", (e, t) => {
  t.pattern ?? (t.pattern = Jo(t)), Z.init(e, t);
}), Ai = /* @__PURE__ */ T("$ZodISODate", (e, t) => {
  t.pattern ?? (t.pattern = Yo), Z.init(e, t);
}), Ri = /* @__PURE__ */ T("$ZodISOTime", (e, t) => {
  t.pattern ?? (t.pattern = Ko(t)), Z.init(e, t);
}), Ci = /* @__PURE__ */ T("$ZodISODuration", (e, t) => {
  t.pattern ?? (t.pattern = Zo), Z.init(e, t);
}), wi = /* @__PURE__ */ T("$ZodIPv4", (e, t) => {
  t.pattern ?? (t.pattern = jo), Z.init(e, t), e._zod.bag.format = "ipv4";
}), Ui = /* @__PURE__ */ T("$ZodIPv6", (e, t) => {
  t.pattern ?? (t.pattern = Xo), Z.init(e, t), e._zod.bag.format = "ipv6", e._zod.check = (n) => {
    try {
      new URL(`http://[${n.value}]`);
    } catch {
      n.issues.push({
        code: "invalid_format",
        format: "ipv6",
        input: n.value,
        inst: e,
        continue: !t.abort
      });
    }
  };
}), ki = /* @__PURE__ */ T("$ZodCIDRv4", (e, t) => {
  t.pattern ?? (t.pattern = Ho), Z.init(e, t);
}), zi = /* @__PURE__ */ T("$ZodCIDRv6", (e, t) => {
  t.pattern ?? (t.pattern = Go), Z.init(e, t), e._zod.check = (n) => {
    const r = n.value.split("/");
    try {
      if (r.length !== 2)
        throw new Error();
      const [o, i] = r;
      if (!i)
        throw new Error();
      const s = Number(i);
      if (`${s}` !== i)
        throw new Error();
      if (s < 0 || s > 128)
        throw new Error();
      new URL(`http://[${o}]`);
    } catch {
      n.issues.push({
        code: "invalid_format",
        format: "cidrv6",
        input: n.value,
        inst: e,
        continue: !t.abort
      });
    }
  };
});
function Vn(e) {
  if (e === "")
    return !0;
  if (e.length % 4 !== 0)
    return !1;
  try {
    return atob(e), !0;
  } catch {
    return !1;
  }
}
const Fi = /* @__PURE__ */ T("$ZodBase64", (e, t) => {
  t.pattern ?? (t.pattern = Wo), Z.init(e, t), e._zod.bag.contentEncoding = "base64", e._zod.check = (n) => {
    Vn(n.value) || n.issues.push({
      code: "invalid_format",
      format: "base64",
      input: n.value,
      inst: e,
      continue: !t.abort
    });
  };
});
function Pi(e) {
  if (!Mn.test(e))
    return !1;
  const t = e.replace(/[-_]/g, (r) => r === "-" ? "+" : "/"), n = t.padEnd(Math.ceil(t.length / 4) * 4, "=");
  return Vn(n);
}
const Zi = /* @__PURE__ */ T("$ZodBase64URL", (e, t) => {
  t.pattern ?? (t.pattern = Mn), Z.init(e, t), e._zod.bag.contentEncoding = "base64url", e._zod.check = (n) => {
    Pi(n.value) || n.issues.push({
      code: "invalid_format",
      format: "base64url",
      input: n.value,
      inst: e,
      continue: !t.abort
    });
  };
}), $i = /* @__PURE__ */ T("$ZodE164", (e, t) => {
  t.pattern ?? (t.pattern = Vo), Z.init(e, t);
});
function xi(e, t = null) {
  try {
    const n = e.split(".");
    if (n.length !== 3)
      return !1;
    const [r] = n;
    if (!r)
      return !1;
    const o = JSON.parse(atob(r));
    return !("typ" in o && (o == null ? void 0 : o.typ) !== "JWT" || !o.alg || t && (!("alg" in o) || o.alg !== t));
  } catch {
    return !1;
  }
}
const Mi = /* @__PURE__ */ T("$ZodJWT", (e, t) => {
  Z.init(e, t), e._zod.check = (n) => {
    xi(n.value, t.alg) || n.issues.push({
      code: "invalid_format",
      format: "jwt",
      input: n.value,
      inst: e,
      continue: !t.abort
    });
  };
}), Yn = /* @__PURE__ */ T("$ZodNumber", (e, t) => {
  M.init(e, t), e._zod.pattern = e._zod.bag.pattern ?? Xn, e._zod.parse = (n, r) => {
    if (t.coerce)
      try {
        n.value = Number(n.value);
      } catch {
      }
    const o = n.value;
    if (typeof o == "number" && !Number.isNaN(o) && Number.isFinite(o))
      return n;
    const i = typeof o == "number" ? Number.isNaN(o) ? "NaN" : Number.isFinite(o) ? void 0 : "Infinity" : void 0;
    return n.issues.push({
      expected: "number",
      code: "invalid_type",
      input: o,
      inst: e,
      ...i ? { received: i } : {}
    }), n;
  };
}), Bi = /* @__PURE__ */ T("$ZodNumberFormat", (e, t) => {
  oi.init(e, t), Yn.init(e, t);
}), ji = /* @__PURE__ */ T("$ZodBoolean", (e, t) => {
  M.init(e, t), e._zod.pattern = ei, e._zod.parse = (n, r) => {
    if (t.coerce)
      try {
        n.value = !!n.value;
      } catch {
      }
    const o = n.value;
    return typeof o == "boolean" || n.issues.push({
      expected: "boolean",
      code: "invalid_type",
      input: o,
      inst: e
    }), n;
  };
}), Xi = /* @__PURE__ */ T("$ZodUnknown", (e, t) => {
  M.init(e, t), e._zod.parse = (n) => n;
}), Hi = /* @__PURE__ */ T("$ZodNever", (e, t) => {
  M.init(e, t), e._zod.parse = (n, r) => (n.issues.push({
    expected: "never",
    code: "invalid_type",
    input: n.value,
    inst: e
  }), n);
});
function en(e, t, n) {
  e.issues.length && t.issues.push(...Ee(n, e.issues)), t.value[n] = e.value;
}
const Gi = /* @__PURE__ */ T("$ZodArray", (e, t) => {
  M.init(e, t), e._zod.parse = (n, r) => {
    const o = n.value;
    if (!Array.isArray(o))
      return n.issues.push({
        expected: "array",
        code: "invalid_type",
        input: o,
        inst: e
      }), n;
    n.value = Array(o.length);
    const i = [];
    for (let s = 0; s < o.length; s++) {
      const c = o[s], a = t.element._zod.run({
        value: c,
        issues: []
      }, r);
      a instanceof Promise ? i.push(a.then((u) => en(u, n, s))) : en(a, n, s);
    }
    return i.length ? Promise.all(i).then(() => n) : n;
  };
});
function ze(e, t, n, r, o) {
  if (e.issues.length) {
    if (o && !(n in r))
      return;
    t.issues.push(...Ee(n, e.issues));
  }
  e.value === void 0 ? n in r && (t.value[n] = void 0) : t.value[n] = e.value;
}
function Kn(e) {
  var r, o, i, s;
  const t = Object.keys(e.shape);
  for (const c of t)
    if (!((s = (i = (o = (r = e.shape) == null ? void 0 : r[c]) == null ? void 0 : o._zod) == null ? void 0 : i.traits) != null && s.has("$ZodType")))
      throw new Error(`Invalid element at key "${c}": expected a Zod schema`);
  const n = lo(e.shape);
  return {
    ...e,
    keys: t,
    keySet: new Set(t),
    numKeys: t.length,
    optionalKeys: new Set(n)
  };
}
function Jn(e, t, n, r, o, i) {
  const s = [], c = o.keySet, a = o.catchall._zod, u = a.def.type, l = a.optout === "optional";
  for (const d in t) {
    if (c.has(d))
      continue;
    if (u === "never") {
      s.push(d);
      continue;
    }
    const g = a.run({ value: t[d], issues: [] }, r);
    g instanceof Promise ? e.push(g.then((E) => ze(E, n, d, t, l))) : ze(g, n, d, t, l);
  }
  return s.length && n.issues.push({
    code: "unrecognized_keys",
    keys: s,
    input: t,
    inst: i
  }), e.length ? Promise.all(e).then(() => n) : n;
}
const Wi = /* @__PURE__ */ T("$ZodObject", (e, t) => {
  M.init(e, t);
  const n = Object.getOwnPropertyDescriptor(t, "shape");
  if (!(n != null && n.get)) {
    const c = t.shape;
    Object.defineProperty(t, "shape", {
      get: () => {
        const a = { ...c };
        return Object.defineProperty(t, "shape", {
          value: a
        }), a;
      }
    });
  }
  const r = Nt(() => Kn(t));
  z(e._zod, "propValues", () => {
    const c = t.shape, a = {};
    for (const u in c) {
      const l = c[u]._zod;
      if (l.values) {
        a[u] ?? (a[u] = /* @__PURE__ */ new Set());
        for (const d of l.values)
          a[u].add(d);
      }
    }
    return a;
  });
  const o = ke, i = t.catchall;
  let s;
  e._zod.parse = (c, a) => {
    s ?? (s = r.value);
    const u = c.value;
    if (!o(u))
      return c.issues.push({
        expected: "object",
        code: "invalid_type",
        input: u,
        inst: e
      }), c;
    c.value = {};
    const l = [], d = s.shape;
    for (const g of s.keys) {
      const E = d[g], N = E._zod.optout === "optional", L = E._zod.run({ value: u[g], issues: [] }, a);
      L instanceof Promise ? l.push(L.then((D) => ze(D, c, g, u, N))) : ze(L, c, g, u, N);
    }
    return i ? Jn(l, u, c, a, r.value, e) : l.length ? Promise.all(l).then(() => c) : c;
  };
}), Vi = /* @__PURE__ */ T("$ZodObjectJIT", (e, t) => {
  Wi.init(e, t);
  const n = e._zod.parse, r = Nt(() => Kn(t)), o = (g) => {
    var b;
    const E = new Ei(["shape", "payload", "ctx"]), N = r.value, L = (h) => {
      const f = qt(h);
      return `shape[${f}]._zod.run({ value: input[${f}], issues: [] }, ctx)`;
    };
    E.write("const input = payload.value;");
    const D = /* @__PURE__ */ Object.create(null);
    let O = 0;
    for (const h of N.keys)
      D[h] = `key_${O++}`;
    E.write("const newResult = {};");
    for (const h of N.keys) {
      const f = D[h], _ = qt(h), p = g[h], m = ((b = p == null ? void 0 : p._zod) == null ? void 0 : b.optout) === "optional";
      E.write(`const ${f} = ${L(h)};`), m ? E.write(`
        if (${f}.issues.length) {
          if (${_} in input) {
            payload.issues = payload.issues.concat(${f}.issues.map(iss => ({
              ...iss,
              path: iss.path ? [${_}, ...iss.path] : [${_}]
            })));
          }
        }
        
        if (${f}.value === undefined) {
          if (${_} in input) {
            newResult[${_}] = undefined;
          }
        } else {
          newResult[${_}] = ${f}.value;
        }
        
      `) : E.write(`
        if (${f}.issues.length) {
          payload.issues = payload.issues.concat(${f}.issues.map(iss => ({
            ...iss,
            path: iss.path ? [${_}, ...iss.path] : [${_}]
          })));
        }
        
        if (${f}.value === undefined) {
          if (${_} in input) {
            newResult[${_}] = undefined;
          }
        } else {
          newResult[${_}] = ${f}.value;
        }
        
      `);
    }
    E.write("payload.value = newResult;"), E.write("return payload;");
    const S = E.compile();
    return (h, f) => S(g, h, f);
  };
  let i;
  const s = ke, c = !kn.jitless, u = c && co.value, l = t.catchall;
  let d;
  e._zod.parse = (g, E) => {
    d ?? (d = r.value);
    const N = g.value;
    return s(N) ? c && u && (E == null ? void 0 : E.async) === !1 && E.jitless !== !0 ? (i || (i = o(t.shape)), g = i(g, E), l ? Jn([], N, g, E, d, e) : g) : n(g, E) : (g.issues.push({
      expected: "object",
      code: "invalid_type",
      input: N,
      inst: e
    }), g);
  };
});
function tn(e, t, n, r) {
  for (const i of e)
    if (i.issues.length === 0)
      return t.value = i.value, t;
  const o = e.filter((i) => !he(i));
  return o.length === 1 ? (t.value = o[0].value, o[0]) : (t.issues.push({
    code: "invalid_union",
    input: t.value,
    inst: n,
    errors: e.map((i) => i.issues.map((s) => ae(s, r, se())))
  }), t);
}
const Yi = /* @__PURE__ */ T("$ZodUnion", (e, t) => {
  M.init(e, t), z(e._zod, "optin", () => t.options.some((o) => o._zod.optin === "optional") ? "optional" : void 0), z(e._zod, "optout", () => t.options.some((o) => o._zod.optout === "optional") ? "optional" : void 0), z(e._zod, "values", () => {
    if (t.options.every((o) => o._zod.values))
      return new Set(t.options.flatMap((o) => Array.from(o._zod.values)));
  }), z(e._zod, "pattern", () => {
    if (t.options.every((o) => o._zod.pattern)) {
      const o = t.options.map((i) => i._zod.pattern);
      return new RegExp(`^(${o.map((i) => St(i.source)).join("|")})$`);
    }
  });
  const n = t.options.length === 1, r = t.options[0]._zod.run;
  e._zod.parse = (o, i) => {
    if (n)
      return r(o, i);
    let s = !1;
    const c = [];
    for (const a of t.options) {
      const u = a._zod.run({
        value: o.value,
        issues: []
      }, i);
      if (u instanceof Promise)
        c.push(u), s = !0;
      else {
        if (u.issues.length === 0)
          return u;
        c.push(u);
      }
    }
    return s ? Promise.all(c).then((a) => tn(a, o, e, i)) : tn(c, o, e, i);
  };
}), Ki = /* @__PURE__ */ T("$ZodIntersection", (e, t) => {
  M.init(e, t), e._zod.parse = (n, r) => {
    const o = n.value, i = t.left._zod.run({ value: o, issues: [] }, r), s = t.right._zod.run({ value: o, issues: [] }, r);
    return i instanceof Promise || s instanceof Promise ? Promise.all([i, s]).then(([a, u]) => nn(n, a, u)) : nn(n, i, s);
  };
});
function ht(e, t) {
  if (e === t)
    return { valid: !0, data: e };
  if (e instanceof Date && t instanceof Date && +e == +t)
    return { valid: !0, data: e };
  if (_e(e) && _e(t)) {
    const n = Object.keys(t), r = Object.keys(e).filter((i) => n.indexOf(i) !== -1), o = { ...e, ...t };
    for (const i of r) {
      const s = ht(e[i], t[i]);
      if (!s.valid)
        return {
          valid: !1,
          mergeErrorPath: [i, ...s.mergeErrorPath]
        };
      o[i] = s.data;
    }
    return { valid: !0, data: o };
  }
  if (Array.isArray(e) && Array.isArray(t)) {
    if (e.length !== t.length)
      return { valid: !1, mergeErrorPath: [] };
    const n = [];
    for (let r = 0; r < e.length; r++) {
      const o = e[r], i = t[r], s = ht(o, i);
      if (!s.valid)
        return {
          valid: !1,
          mergeErrorPath: [r, ...s.mergeErrorPath]
        };
      n.push(s.data);
    }
    return { valid: !0, data: n };
  }
  return { valid: !1, mergeErrorPath: [] };
}
function nn(e, t, n) {
  const r = /* @__PURE__ */ new Map();
  let o;
  for (const c of t.issues)
    if (c.code === "unrecognized_keys") {
      o ?? (o = c);
      for (const a of c.keys)
        r.has(a) || r.set(a, {}), r.get(a).l = !0;
    } else
      e.issues.push(c);
  for (const c of n.issues)
    if (c.code === "unrecognized_keys")
      for (const a of c.keys)
        r.has(a) || r.set(a, {}), r.get(a).r = !0;
    else
      e.issues.push(c);
  const i = [...r].filter(([, c]) => c.l && c.r).map(([c]) => c);
  if (i.length && o && e.issues.push({ ...o, keys: i }), he(e))
    return e;
  const s = ht(t.value, n.value);
  if (!s.valid)
    throw new Error(`Unmergable intersection. Error path: ${JSON.stringify(s.mergeErrorPath)}`);
  return e.value = s.data, e;
}
const Ji = /* @__PURE__ */ T("$ZodRecord", (e, t) => {
  M.init(e, t), e._zod.parse = (n, r) => {
    const o = n.value;
    if (!_e(o))
      return n.issues.push({
        expected: "record",
        code: "invalid_type",
        input: o,
        inst: e
      }), n;
    const i = [], s = t.keyType._zod.values;
    if (s) {
      n.value = {};
      const c = /* @__PURE__ */ new Set();
      for (const u of s)
        if (typeof u == "string" || typeof u == "number" || typeof u == "symbol") {
          c.add(typeof u == "number" ? u.toString() : u);
          const l = t.valueType._zod.run({ value: o[u], issues: [] }, r);
          l instanceof Promise ? i.push(l.then((d) => {
            d.issues.length && n.issues.push(...Ee(u, d.issues)), n.value[u] = d.value;
          })) : (l.issues.length && n.issues.push(...Ee(u, l.issues)), n.value[u] = l.value);
        }
      let a;
      for (const u in o)
        c.has(u) || (a = a ?? [], a.push(u));
      a && a.length > 0 && n.issues.push({
        code: "unrecognized_keys",
        input: o,
        inst: e,
        keys: a
      });
    } else {
      n.value = {};
      for (const c of Reflect.ownKeys(o)) {
        if (c === "__proto__")
          continue;
        let a = t.keyType._zod.run({ value: c, issues: [] }, r);
        if (a instanceof Promise)
          throw new Error("Async schemas not supported in object keys currently");
        if (typeof c == "string" && Xn.test(c) && a.issues.length) {
          const d = t.keyType._zod.run({ value: Number(c), issues: [] }, r);
          if (d instanceof Promise)
            throw new Error("Async schemas not supported in object keys currently");
          d.issues.length === 0 && (a = d);
        }
        if (a.issues.length) {
          t.mode === "loose" ? n.value[c] = o[c] : n.issues.push({
            code: "invalid_key",
            origin: "record",
            issues: a.issues.map((d) => ae(d, r, se())),
            input: c,
            path: [c],
            inst: e
          });
          continue;
        }
        const l = t.valueType._zod.run({ value: o[c], issues: [] }, r);
        l instanceof Promise ? i.push(l.then((d) => {
          d.issues.length && n.issues.push(...Ee(c, d.issues)), n.value[a.value] = d.value;
        })) : (l.issues.length && n.issues.push(...Ee(c, l.issues)), n.value[a.value] = l.value);
      }
    }
    return i.length ? Promise.all(i).then(() => n) : n;
  };
}), qi = /* @__PURE__ */ T("$ZodEnum", (e, t) => {
  M.init(e, t);
  const n = zn(t.entries), r = new Set(n);
  e._zod.values = r, e._zod.pattern = new RegExp(`^(${n.filter((o) => uo.has(typeof o)).map((o) => typeof o == "string" ? xe(o) : o.toString()).join("|")})$`), e._zod.parse = (o, i) => {
    const s = o.value;
    return r.has(s) || o.issues.push({
      code: "invalid_value",
      values: n,
      input: s,
      inst: e
    }), o;
  };
}), Qi = /* @__PURE__ */ T("$ZodTransform", (e, t) => {
  M.init(e, t), e._zod.parse = (n, r) => {
    if (r.direction === "backward")
      throw new Un(e.constructor.name);
    const o = t.transform(n.value, n);
    if (r.async)
      return (o instanceof Promise ? o : Promise.resolve(o)).then((s) => (n.value = s, n));
    if (o instanceof Promise)
      throw new me();
    return n.value = o, n;
  };
});
function rn(e, t) {
  return e.issues.length && t === void 0 ? { issues: [], value: void 0 } : e;
}
const qn = /* @__PURE__ */ T("$ZodOptional", (e, t) => {
  M.init(e, t), e._zod.optin = "optional", e._zod.optout = "optional", z(e._zod, "values", () => t.innerType._zod.values ? /* @__PURE__ */ new Set([...t.innerType._zod.values, void 0]) : void 0), z(e._zod, "pattern", () => {
    const n = t.innerType._zod.pattern;
    return n ? new RegExp(`^(${St(n.source)})?$`) : void 0;
  }), e._zod.parse = (n, r) => {
    if (t.innerType._zod.optin === "optional") {
      const o = t.innerType._zod.run(n, r);
      return o instanceof Promise ? o.then((i) => rn(i, n.value)) : rn(o, n.value);
    }
    return n.value === void 0 ? n : t.innerType._zod.run(n, r);
  };
}), es = /* @__PURE__ */ T("$ZodExactOptional", (e, t) => {
  qn.init(e, t), z(e._zod, "values", () => t.innerType._zod.values), z(e._zod, "pattern", () => t.innerType._zod.pattern), e._zod.parse = (n, r) => t.innerType._zod.run(n, r);
}), ts = /* @__PURE__ */ T("$ZodNullable", (e, t) => {
  M.init(e, t), z(e._zod, "optin", () => t.innerType._zod.optin), z(e._zod, "optout", () => t.innerType._zod.optout), z(e._zod, "pattern", () => {
    const n = t.innerType._zod.pattern;
    return n ? new RegExp(`^(${St(n.source)}|null)$`) : void 0;
  }), z(e._zod, "values", () => t.innerType._zod.values ? /* @__PURE__ */ new Set([...t.innerType._zod.values, null]) : void 0), e._zod.parse = (n, r) => n.value === null ? n : t.innerType._zod.run(n, r);
}), ns = /* @__PURE__ */ T("$ZodDefault", (e, t) => {
  M.init(e, t), e._zod.optin = "optional", z(e._zod, "values", () => t.innerType._zod.values), e._zod.parse = (n, r) => {
    if (r.direction === "backward")
      return t.innerType._zod.run(n, r);
    if (n.value === void 0)
      return n.value = t.defaultValue, n;
    const o = t.innerType._zod.run(n, r);
    return o instanceof Promise ? o.then((i) => on(i, t)) : on(o, t);
  };
});
function on(e, t) {
  return e.value === void 0 && (e.value = t.defaultValue), e;
}
const rs = /* @__PURE__ */ T("$ZodPrefault", (e, t) => {
  M.init(e, t), e._zod.optin = "optional", z(e._zod, "values", () => t.innerType._zod.values), e._zod.parse = (n, r) => (r.direction === "backward" || n.value === void 0 && (n.value = t.defaultValue), t.innerType._zod.run(n, r));
}), os = /* @__PURE__ */ T("$ZodNonOptional", (e, t) => {
  M.init(e, t), z(e._zod, "values", () => {
    const n = t.innerType._zod.values;
    return n ? new Set([...n].filter((r) => r !== void 0)) : void 0;
  }), e._zod.parse = (n, r) => {
    const o = t.innerType._zod.run(n, r);
    return o instanceof Promise ? o.then((i) => sn(i, e)) : sn(o, e);
  };
});
function sn(e, t) {
  return !e.issues.length && e.value === void 0 && e.issues.push({
    code: "invalid_type",
    expected: "nonoptional",
    input: e.value,
    inst: t
  }), e;
}
const is = /* @__PURE__ */ T("$ZodCatch", (e, t) => {
  M.init(e, t), z(e._zod, "optin", () => t.innerType._zod.optin), z(e._zod, "optout", () => t.innerType._zod.optout), z(e._zod, "values", () => t.innerType._zod.values), e._zod.parse = (n, r) => {
    if (r.direction === "backward")
      return t.innerType._zod.run(n, r);
    const o = t.innerType._zod.run(n, r);
    return o instanceof Promise ? o.then((i) => (n.value = i.value, i.issues.length && (n.value = t.catchValue({
      ...n,
      error: {
        issues: i.issues.map((s) => ae(s, r, se()))
      },
      input: n.value
    }), n.issues = []), n)) : (n.value = o.value, o.issues.length && (n.value = t.catchValue({
      ...n,
      error: {
        issues: o.issues.map((i) => ae(i, r, se()))
      },
      input: n.value
    }), n.issues = []), n);
  };
}), ss = /* @__PURE__ */ T("$ZodPipe", (e, t) => {
  M.init(e, t), z(e._zod, "values", () => t.in._zod.values), z(e._zod, "optin", () => t.in._zod.optin), z(e._zod, "optout", () => t.out._zod.optout), z(e._zod, "propValues", () => t.in._zod.propValues), e._zod.parse = (n, r) => {
    if (r.direction === "backward") {
      const i = t.out._zod.run(n, r);
      return i instanceof Promise ? i.then((s) => Ae(s, t.in, r)) : Ae(i, t.in, r);
    }
    const o = t.in._zod.run(n, r);
    return o instanceof Promise ? o.then((i) => Ae(i, t.out, r)) : Ae(o, t.out, r);
  };
});
function Ae(e, t, n) {
  return e.issues.length ? (e.aborted = !0, e) : t._zod.run({ value: e.value, issues: e.issues }, n);
}
const as = /* @__PURE__ */ T("$ZodReadonly", (e, t) => {
  M.init(e, t), z(e._zod, "propValues", () => t.innerType._zod.propValues), z(e._zod, "values", () => t.innerType._zod.values), z(e._zod, "optin", () => {
    var n, r;
    return (r = (n = t.innerType) == null ? void 0 : n._zod) == null ? void 0 : r.optin;
  }), z(e._zod, "optout", () => {
    var n, r;
    return (r = (n = t.innerType) == null ? void 0 : n._zod) == null ? void 0 : r.optout;
  }), e._zod.parse = (n, r) => {
    if (r.direction === "backward")
      return t.innerType._zod.run(n, r);
    const o = t.innerType._zod.run(n, r);
    return o instanceof Promise ? o.then(an) : an(o);
  };
});
function an(e) {
  return e.value = Object.freeze(e.value), e;
}
const cs = /* @__PURE__ */ T("$ZodCustom", (e, t) => {
  te.init(e, t), M.init(e, t), e._zod.parse = (n, r) => n, e._zod.check = (n) => {
    const r = n.value, o = t.fn(r);
    if (o instanceof Promise)
      return o.then((i) => cn(i, n, r, e));
    cn(o, n, r, e);
  };
});
function cn(e, t, n, r) {
  if (!e) {
    const o = {
      code: "custom",
      input: n,
      inst: r,
      // incorporates params.error into issue reporting
      path: [...r._zod.def.path ?? []],
      // incorporates params.error into issue reporting
      continue: !r._zod.def.abort
      // params: inst._zod.def.params,
    };
    r._zod.def.params && (o.params = r._zod.def.params), t.issues.push(Se(o));
  }
}
var un;
class us {
  constructor() {
    this._map = /* @__PURE__ */ new WeakMap(), this._idmap = /* @__PURE__ */ new Map();
  }
  add(t, ...n) {
    const r = n[0];
    return this._map.set(t, r), r && typeof r == "object" && "id" in r && this._idmap.set(r.id, t), this;
  }
  clear() {
    return this._map = /* @__PURE__ */ new WeakMap(), this._idmap = /* @__PURE__ */ new Map(), this;
  }
  remove(t) {
    const n = this._map.get(t);
    return n && typeof n == "object" && "id" in n && this._idmap.delete(n.id), this._map.delete(t), this;
  }
  get(t) {
    const n = t._zod.parent;
    if (n) {
      const r = { ...this.get(n) ?? {} };
      delete r.id;
      const o = { ...r, ...this._map.get(t) };
      return Object.keys(o).length ? o : void 0;
    }
    return this._map.get(t);
  }
  has(t) {
    return this._map.has(t);
  }
}
function ls() {
  return new us();
}
(un = globalThis).__zod_globalRegistry ?? (un.__zod_globalRegistry = ls());
const Ne = globalThis.__zod_globalRegistry;
// @__NO_SIDE_EFFECTS__
function fs(e, t) {
  return new e({
    type: "string",
    ...R(t)
  });
}
// @__NO_SIDE_EFFECTS__
function ds(e, t) {
  return new e({
    type: "string",
    format: "email",
    check: "string_format",
    abort: !1,
    ...R(t)
  });
}
// @__NO_SIDE_EFFECTS__
function ln(e, t) {
  return new e({
    type: "string",
    format: "guid",
    check: "string_format",
    abort: !1,
    ...R(t)
  });
}
// @__NO_SIDE_EFFECTS__
function ps(e, t) {
  return new e({
    type: "string",
    format: "uuid",
    check: "string_format",
    abort: !1,
    ...R(t)
  });
}
// @__NO_SIDE_EFFECTS__
function hs(e, t) {
  return new e({
    type: "string",
    format: "uuid",
    check: "string_format",
    abort: !1,
    version: "v4",
    ...R(t)
  });
}
// @__NO_SIDE_EFFECTS__
function Es(e, t) {
  return new e({
    type: "string",
    format: "uuid",
    check: "string_format",
    abort: !1,
    version: "v6",
    ...R(t)
  });
}
// @__NO_SIDE_EFFECTS__
function ms(e, t) {
  return new e({
    type: "string",
    format: "uuid",
    check: "string_format",
    abort: !1,
    version: "v7",
    ...R(t)
  });
}
// @__NO_SIDE_EFFECTS__
function _s(e, t) {
  return new e({
    type: "string",
    format: "url",
    check: "string_format",
    abort: !1,
    ...R(t)
  });
}
// @__NO_SIDE_EFFECTS__
function gs(e, t) {
  return new e({
    type: "string",
    format: "emoji",
    check: "string_format",
    abort: !1,
    ...R(t)
  });
}
// @__NO_SIDE_EFFECTS__
function Ts(e, t) {
  return new e({
    type: "string",
    format: "nanoid",
    check: "string_format",
    abort: !1,
    ...R(t)
  });
}
// @__NO_SIDE_EFFECTS__
function ys(e, t) {
  return new e({
    type: "string",
    format: "cuid",
    check: "string_format",
    abort: !1,
    ...R(t)
  });
}
// @__NO_SIDE_EFFECTS__
function Ns(e, t) {
  return new e({
    type: "string",
    format: "cuid2",
    check: "string_format",
    abort: !1,
    ...R(t)
  });
}
// @__NO_SIDE_EFFECTS__
function Ls(e, t) {
  return new e({
    type: "string",
    format: "ulid",
    check: "string_format",
    abort: !1,
    ...R(t)
  });
}
// @__NO_SIDE_EFFECTS__
function Ss(e, t) {
  return new e({
    type: "string",
    format: "xid",
    check: "string_format",
    abort: !1,
    ...R(t)
  });
}
// @__NO_SIDE_EFFECTS__
function Is(e, t) {
  return new e({
    type: "string",
    format: "ksuid",
    check: "string_format",
    abort: !1,
    ...R(t)
  });
}
// @__NO_SIDE_EFFECTS__
function vs(e, t) {
  return new e({
    type: "string",
    format: "ipv4",
    check: "string_format",
    abort: !1,
    ...R(t)
  });
}
// @__NO_SIDE_EFFECTS__
function Os(e, t) {
  return new e({
    type: "string",
    format: "ipv6",
    check: "string_format",
    abort: !1,
    ...R(t)
  });
}
// @__NO_SIDE_EFFECTS__
function bs(e, t) {
  return new e({
    type: "string",
    format: "cidrv4",
    check: "string_format",
    abort: !1,
    ...R(t)
  });
}
// @__NO_SIDE_EFFECTS__
function Ds(e, t) {
  return new e({
    type: "string",
    format: "cidrv6",
    check: "string_format",
    abort: !1,
    ...R(t)
  });
}
// @__NO_SIDE_EFFECTS__
function As(e, t) {
  return new e({
    type: "string",
    format: "base64",
    check: "string_format",
    abort: !1,
    ...R(t)
  });
}
// @__NO_SIDE_EFFECTS__
function Rs(e, t) {
  return new e({
    type: "string",
    format: "base64url",
    check: "string_format",
    abort: !1,
    ...R(t)
  });
}
// @__NO_SIDE_EFFECTS__
function Cs(e, t) {
  return new e({
    type: "string",
    format: "e164",
    check: "string_format",
    abort: !1,
    ...R(t)
  });
}
// @__NO_SIDE_EFFECTS__
function ws(e, t) {
  return new e({
    type: "string",
    format: "jwt",
    check: "string_format",
    abort: !1,
    ...R(t)
  });
}
// @__NO_SIDE_EFFECTS__
function Us(e, t) {
  return new e({
    type: "string",
    format: "datetime",
    check: "string_format",
    offset: !1,
    local: !1,
    precision: null,
    ...R(t)
  });
}
// @__NO_SIDE_EFFECTS__
function ks(e, t) {
  return new e({
    type: "string",
    format: "date",
    check: "string_format",
    ...R(t)
  });
}
// @__NO_SIDE_EFFECTS__
function zs(e, t) {
  return new e({
    type: "string",
    format: "time",
    check: "string_format",
    precision: null,
    ...R(t)
  });
}
// @__NO_SIDE_EFFECTS__
function Fs(e, t) {
  return new e({
    type: "string",
    format: "duration",
    check: "string_format",
    ...R(t)
  });
}
// @__NO_SIDE_EFFECTS__
function Ps(e, t) {
  return new e({
    type: "number",
    coerce: !0,
    checks: [],
    ...R(t)
  });
}
// @__NO_SIDE_EFFECTS__
function Zs(e, t) {
  return new e({
    type: "number",
    check: "number_format",
    abort: !1,
    format: "safeint",
    ...R(t)
  });
}
// @__NO_SIDE_EFFECTS__
function $s(e, t) {
  return new e({
    type: "boolean",
    ...R(t)
  });
}
// @__NO_SIDE_EFFECTS__
function xs(e) {
  return new e({
    type: "unknown"
  });
}
// @__NO_SIDE_EFFECTS__
function Ms(e, t) {
  return new e({
    type: "never",
    ...R(t)
  });
}
// @__NO_SIDE_EFFECTS__
function fn(e, t) {
  return new Gn({
    check: "less_than",
    ...R(t),
    value: e,
    inclusive: !1
  });
}
// @__NO_SIDE_EFFECTS__
function ut(e, t) {
  return new Gn({
    check: "less_than",
    ...R(t),
    value: e,
    inclusive: !0
  });
}
// @__NO_SIDE_EFFECTS__
function dn(e, t) {
  return new Wn({
    check: "greater_than",
    ...R(t),
    value: e,
    inclusive: !1
  });
}
// @__NO_SIDE_EFFECTS__
function lt(e, t) {
  return new Wn({
    check: "greater_than",
    ...R(t),
    value: e,
    inclusive: !0
  });
}
// @__NO_SIDE_EFFECTS__
function pn(e, t) {
  return new ri({
    check: "multiple_of",
    ...R(t),
    value: e
  });
}
// @__NO_SIDE_EFFECTS__
function Qn(e, t) {
  return new ii({
    check: "max_length",
    ...R(t),
    maximum: e
  });
}
// @__NO_SIDE_EFFECTS__
function Fe(e, t) {
  return new si({
    check: "min_length",
    ...R(t),
    minimum: e
  });
}
// @__NO_SIDE_EFFECTS__
function er(e, t) {
  return new ai({
    check: "length_equals",
    ...R(t),
    length: e
  });
}
// @__NO_SIDE_EFFECTS__
function Bs(e, t) {
  return new ci({
    check: "string_format",
    format: "regex",
    ...R(t),
    pattern: e
  });
}
// @__NO_SIDE_EFFECTS__
function js(e) {
  return new ui({
    check: "string_format",
    format: "lowercase",
    ...R(e)
  });
}
// @__NO_SIDE_EFFECTS__
function Xs(e) {
  return new li({
    check: "string_format",
    format: "uppercase",
    ...R(e)
  });
}
// @__NO_SIDE_EFFECTS__
function Hs(e, t) {
  return new fi({
    check: "string_format",
    format: "includes",
    ...R(t),
    includes: e
  });
}
// @__NO_SIDE_EFFECTS__
function Gs(e, t) {
  return new di({
    check: "string_format",
    format: "starts_with",
    ...R(t),
    prefix: e
  });
}
// @__NO_SIDE_EFFECTS__
function Ws(e, t) {
  return new pi({
    check: "string_format",
    format: "ends_with",
    ...R(t),
    suffix: e
  });
}
// @__NO_SIDE_EFFECTS__
function Te(e) {
  return new hi({
    check: "overwrite",
    tx: e
  });
}
// @__NO_SIDE_EFFECTS__
function Vs(e) {
  return /* @__PURE__ */ Te((t) => t.normalize(e));
}
// @__NO_SIDE_EFFECTS__
function Ys() {
  return /* @__PURE__ */ Te((e) => e.trim());
}
// @__NO_SIDE_EFFECTS__
function Ks() {
  return /* @__PURE__ */ Te((e) => e.toLowerCase());
}
// @__NO_SIDE_EFFECTS__
function Js() {
  return /* @__PURE__ */ Te((e) => e.toUpperCase());
}
// @__NO_SIDE_EFFECTS__
function qs() {
  return /* @__PURE__ */ Te((e) => ao(e));
}
// @__NO_SIDE_EFFECTS__
function Qs(e, t, n) {
  return new e({
    type: "array",
    element: t,
    // get element() {
    //   return element;
    // },
    ...R(n)
  });
}
// @__NO_SIDE_EFFECTS__
function ea(e, t, n) {
  return new e({
    type: "custom",
    check: "custom",
    fn: t,
    ...R(n)
  });
}
// @__NO_SIDE_EFFECTS__
function ta(e) {
  const t = /* @__PURE__ */ na((n) => (n.addIssue = (r) => {
    if (typeof r == "string")
      n.issues.push(Se(r, n.value, t._zod.def));
    else {
      const o = r;
      o.fatal && (o.continue = !1), o.code ?? (o.code = "custom"), o.input ?? (o.input = n.value), o.inst ?? (o.inst = t), o.continue ?? (o.continue = !t._zod.def.abort), n.issues.push(Se(o));
    }
  }, e(n.value, n)));
  return t;
}
// @__NO_SIDE_EFFECTS__
function na(e, t) {
  const n = new te({
    check: "custom",
    ...R(t)
  });
  return n._zod.check = e, n;
}
function tr(e) {
  let t = (e == null ? void 0 : e.target) ?? "draft-2020-12";
  return t === "draft-4" && (t = "draft-04"), t === "draft-7" && (t = "draft-07"), {
    processors: e.processors ?? {},
    metadataRegistry: (e == null ? void 0 : e.metadata) ?? Ne,
    target: t,
    unrepresentable: (e == null ? void 0 : e.unrepresentable) ?? "throw",
    override: (e == null ? void 0 : e.override) ?? (() => {
    }),
    io: (e == null ? void 0 : e.io) ?? "output",
    counter: 0,
    seen: /* @__PURE__ */ new Map(),
    cycles: (e == null ? void 0 : e.cycles) ?? "ref",
    reused: (e == null ? void 0 : e.reused) ?? "inline",
    external: (e == null ? void 0 : e.external) ?? void 0
  };
}
function W(e, t, n = { path: [], schemaPath: [] }) {
  var l, d;
  var r;
  const o = e._zod.def, i = t.seen.get(e);
  if (i)
    return i.count++, n.schemaPath.includes(e) && (i.cycle = n.path), i.schema;
  const s = { schema: {}, count: 1, cycle: void 0, path: n.path };
  t.seen.set(e, s);
  const c = (d = (l = e._zod).toJSONSchema) == null ? void 0 : d.call(l);
  if (c)
    s.schema = c;
  else {
    const g = {
      ...n,
      schemaPath: [...n.schemaPath, e],
      path: n.path
    };
    if (e._zod.processJSONSchema)
      e._zod.processJSONSchema(t, s.schema, g);
    else {
      const N = s.schema, L = t.processors[o.type];
      if (!L)
        throw new Error(`[toJSONSchema]: Non-representable type encountered: ${o.type}`);
      L(e, t, N, g);
    }
    const E = e._zod.parent;
    E && (s.ref || (s.ref = E), W(E, t, g), t.seen.get(E).isParent = !0);
  }
  const a = t.metadataRegistry.get(e);
  return a && Object.assign(s.schema, a), t.io === "input" && Q(e) && (delete s.schema.examples, delete s.schema.default), t.io === "input" && s.schema._prefault && ((r = s.schema).default ?? (r.default = s.schema._prefault)), delete s.schema._prefault, t.seen.get(e).schema;
}
function nr(e, t) {
  var s, c, a, u;
  const n = e.seen.get(t);
  if (!n)
    throw new Error("Unprocessed schema. This is a bug in Zod.");
  const r = /* @__PURE__ */ new Map();
  for (const l of e.seen.entries()) {
    const d = (s = e.metadataRegistry.get(l[0])) == null ? void 0 : s.id;
    if (d) {
      const g = r.get(d);
      if (g && g !== l[0])
        throw new Error(`Duplicate schema id "${d}" detected during JSON Schema conversion. Two different schemas cannot share the same id when converted together.`);
      r.set(d, l[0]);
    }
  }
  const o = (l) => {
    var L;
    const d = e.target === "draft-2020-12" ? "$defs" : "definitions";
    if (e.external) {
      const D = (L = e.external.registry.get(l[0])) == null ? void 0 : L.id, O = e.external.uri ?? ((b) => b);
      if (D)
        return { ref: O(D) };
      const S = l[1].defId ?? l[1].schema.id ?? `schema${e.counter++}`;
      return l[1].defId = S, { defId: S, ref: `${O("__shared")}#/${d}/${S}` };
    }
    if (l[1] === n)
      return { ref: "#" };
    const E = `#/${d}/`, N = l[1].schema.id ?? `__schema${e.counter++}`;
    return { defId: N, ref: E + N };
  }, i = (l) => {
    if (l[1].schema.$ref)
      return;
    const d = l[1], { ref: g, defId: E } = o(l);
    d.def = { ...d.schema }, E && (d.defId = E);
    const N = d.schema;
    for (const L in N)
      delete N[L];
    N.$ref = g;
  };
  if (e.cycles === "throw")
    for (const l of e.seen.entries()) {
      const d = l[1];
      if (d.cycle)
        throw new Error(`Cycle detected: #/${(c = d.cycle) == null ? void 0 : c.join("/")}/<root>

Set the \`cycles\` parameter to \`"ref"\` to resolve cyclical schemas with defs.`);
    }
  for (const l of e.seen.entries()) {
    const d = l[1];
    if (t === l[0]) {
      i(l);
      continue;
    }
    if (e.external) {
      const E = (a = e.external.registry.get(l[0])) == null ? void 0 : a.id;
      if (t !== l[0] && E) {
        i(l);
        continue;
      }
    }
    if ((u = e.metadataRegistry.get(l[0])) == null ? void 0 : u.id) {
      i(l);
      continue;
    }
    if (d.cycle) {
      i(l);
      continue;
    }
    if (d.count > 1 && e.reused === "ref") {
      i(l);
      continue;
    }
  }
}
function rr(e, t) {
  var s, c, a;
  const n = e.seen.get(t);
  if (!n)
    throw new Error("Unprocessed schema. This is a bug in Zod.");
  const r = (u) => {
    const l = e.seen.get(u);
    if (l.ref === null)
      return;
    const d = l.def ?? l.schema, g = { ...d }, E = l.ref;
    if (l.ref = null, E) {
      r(E);
      const L = e.seen.get(E), D = L.schema;
      if (D.$ref && (e.target === "draft-07" || e.target === "draft-04" || e.target === "openapi-3.0") ? (d.allOf = d.allOf ?? [], d.allOf.push(D)) : Object.assign(d, D), Object.assign(d, g), u._zod.parent === E)
        for (const S in d)
          S === "$ref" || S === "allOf" || S in g || delete d[S];
      if (D.$ref && L.def)
        for (const S in d)
          S === "$ref" || S === "allOf" || S in L.def && JSON.stringify(d[S]) === JSON.stringify(L.def[S]) && delete d[S];
    }
    const N = u._zod.parent;
    if (N && N !== E) {
      r(N);
      const L = e.seen.get(N);
      if (L != null && L.schema.$ref && (d.$ref = L.schema.$ref, L.def))
        for (const D in d)
          D === "$ref" || D === "allOf" || D in L.def && JSON.stringify(d[D]) === JSON.stringify(L.def[D]) && delete d[D];
    }
    e.override({
      zodSchema: u,
      jsonSchema: d,
      path: l.path ?? []
    });
  };
  for (const u of [...e.seen.entries()].reverse())
    r(u[0]);
  const o = {};
  if (e.target === "draft-2020-12" ? o.$schema = "https://json-schema.org/draft/2020-12/schema" : e.target === "draft-07" ? o.$schema = "http://json-schema.org/draft-07/schema#" : e.target === "draft-04" ? o.$schema = "http://json-schema.org/draft-04/schema#" : e.target, (s = e.external) != null && s.uri) {
    const u = (c = e.external.registry.get(t)) == null ? void 0 : c.id;
    if (!u)
      throw new Error("Schema is missing an `id` property");
    o.$id = e.external.uri(u);
  }
  Object.assign(o, n.def ?? n.schema);
  const i = ((a = e.external) == null ? void 0 : a.defs) ?? {};
  for (const u of e.seen.entries()) {
    const l = u[1];
    l.def && l.defId && (i[l.defId] = l.def);
  }
  e.external || Object.keys(i).length > 0 && (e.target === "draft-2020-12" ? o.$defs = i : o.definitions = i);
  try {
    const u = JSON.parse(JSON.stringify(o));
    return Object.defineProperty(u, "~standard", {
      value: {
        ...t["~standard"],
        jsonSchema: {
          input: Pe(t, "input", e.processors),
          output: Pe(t, "output", e.processors)
        }
      },
      enumerable: !1,
      writable: !1
    }), u;
  } catch {
    throw new Error("Error converting schema to JSON.");
  }
}
function Q(e, t) {
  const n = t ?? { seen: /* @__PURE__ */ new Set() };
  if (n.seen.has(e))
    return !1;
  n.seen.add(e);
  const r = e._zod.def;
  if (r.type === "transform")
    return !0;
  if (r.type === "array")
    return Q(r.element, n);
  if (r.type === "set")
    return Q(r.valueType, n);
  if (r.type === "lazy")
    return Q(r.getter(), n);
  if (r.type === "promise" || r.type === "optional" || r.type === "nonoptional" || r.type === "nullable" || r.type === "readonly" || r.type === "default" || r.type === "prefault")
    return Q(r.innerType, n);
  if (r.type === "intersection")
    return Q(r.left, n) || Q(r.right, n);
  if (r.type === "record" || r.type === "map")
    return Q(r.keyType, n) || Q(r.valueType, n);
  if (r.type === "pipe")
    return Q(r.in, n) || Q(r.out, n);
  if (r.type === "object") {
    for (const o in r.shape)
      if (Q(r.shape[o], n))
        return !0;
    return !1;
  }
  if (r.type === "union") {
    for (const o of r.options)
      if (Q(o, n))
        return !0;
    return !1;
  }
  if (r.type === "tuple") {
    for (const o of r.items)
      if (Q(o, n))
        return !0;
    return !!(r.rest && Q(r.rest, n));
  }
  return !1;
}
const ra = (e, t = {}) => (n) => {
  const r = tr({ ...n, processors: t });
  return W(e, r), nr(r, e), rr(r, e);
}, Pe = (e, t, n = {}) => (r) => {
  const { libraryOptions: o, target: i } = r ?? {}, s = tr({ ...o ?? {}, target: i, io: t, processors: n });
  return W(e, s), nr(s, e), rr(s, e);
}, oa = {
  guid: "uuid",
  url: "uri",
  datetime: "date-time",
  json_string: "json-string",
  regex: ""
  // do not set
}, ia = (e, t, n, r) => {
  const o = n;
  o.type = "string";
  const { minimum: i, maximum: s, format: c, patterns: a, contentEncoding: u } = e._zod.bag;
  if (typeof i == "number" && (o.minLength = i), typeof s == "number" && (o.maxLength = s), c && (o.format = oa[c] ?? c, o.format === "" && delete o.format, c === "time" && delete o.format), u && (o.contentEncoding = u), a && a.size > 0) {
    const l = [...a];
    l.length === 1 ? o.pattern = l[0].source : l.length > 1 && (o.allOf = [
      ...l.map((d) => ({
        ...t.target === "draft-07" || t.target === "draft-04" || t.target === "openapi-3.0" ? { type: "string" } : {},
        pattern: d.source
      }))
    ]);
  }
}, sa = (e, t, n, r) => {
  const o = n, { minimum: i, maximum: s, format: c, multipleOf: a, exclusiveMaximum: u, exclusiveMinimum: l } = e._zod.bag;
  typeof c == "string" && c.includes("int") ? o.type = "integer" : o.type = "number", typeof l == "number" && (t.target === "draft-04" || t.target === "openapi-3.0" ? (o.minimum = l, o.exclusiveMinimum = !0) : o.exclusiveMinimum = l), typeof i == "number" && (o.minimum = i, typeof l == "number" && t.target !== "draft-04" && (l >= i ? delete o.minimum : delete o.exclusiveMinimum)), typeof u == "number" && (t.target === "draft-04" || t.target === "openapi-3.0" ? (o.maximum = u, o.exclusiveMaximum = !0) : o.exclusiveMaximum = u), typeof s == "number" && (o.maximum = s, typeof u == "number" && t.target !== "draft-04" && (u <= s ? delete o.maximum : delete o.exclusiveMaximum)), typeof a == "number" && (o.multipleOf = a);
}, aa = (e, t, n, r) => {
  n.type = "boolean";
}, ca = (e, t, n, r) => {
  n.not = {};
}, ua = (e, t, n, r) => {
}, la = (e, t, n, r) => {
  const o = e._zod.def, i = zn(o.entries);
  i.every((s) => typeof s == "number") && (n.type = "number"), i.every((s) => typeof s == "string") && (n.type = "string"), n.enum = i;
}, fa = (e, t, n, r) => {
  if (t.unrepresentable === "throw")
    throw new Error("Custom types cannot be represented in JSON Schema");
}, da = (e, t, n, r) => {
  if (t.unrepresentable === "throw")
    throw new Error("Transforms cannot be represented in JSON Schema");
}, pa = (e, t, n, r) => {
  const o = n, i = e._zod.def, { minimum: s, maximum: c } = e._zod.bag;
  typeof s == "number" && (o.minItems = s), typeof c == "number" && (o.maxItems = c), o.type = "array", o.items = W(i.element, t, { ...r, path: [...r.path, "items"] });
}, ha = (e, t, n, r) => {
  var u;
  const o = n, i = e._zod.def;
  o.type = "object", o.properties = {};
  const s = i.shape;
  for (const l in s)
    o.properties[l] = W(s[l], t, {
      ...r,
      path: [...r.path, "properties", l]
    });
  const c = new Set(Object.keys(s)), a = new Set([...c].filter((l) => {
    const d = i.shape[l]._zod;
    return t.io === "input" ? d.optin === void 0 : d.optout === void 0;
  }));
  a.size > 0 && (o.required = Array.from(a)), ((u = i.catchall) == null ? void 0 : u._zod.def.type) === "never" ? o.additionalProperties = !1 : i.catchall ? i.catchall && (o.additionalProperties = W(i.catchall, t, {
    ...r,
    path: [...r.path, "additionalProperties"]
  })) : t.io === "output" && (o.additionalProperties = !1);
}, Ea = (e, t, n, r) => {
  const o = e._zod.def, i = o.inclusive === !1, s = o.options.map((c, a) => W(c, t, {
    ...r,
    path: [...r.path, i ? "oneOf" : "anyOf", a]
  }));
  i ? n.oneOf = s : n.anyOf = s;
}, ma = (e, t, n, r) => {
  const o = e._zod.def, i = W(o.left, t, {
    ...r,
    path: [...r.path, "allOf", 0]
  }), s = W(o.right, t, {
    ...r,
    path: [...r.path, "allOf", 1]
  }), c = (u) => "allOf" in u && Object.keys(u).length === 1, a = [
    ...c(i) ? i.allOf : [i],
    ...c(s) ? s.allOf : [s]
  ];
  n.allOf = a;
}, _a = (e, t, n, r) => {
  const o = n, i = e._zod.def;
  o.type = "object";
  const s = i.keyType, c = s._zod.bag, a = c == null ? void 0 : c.patterns;
  if (i.mode === "loose" && a && a.size > 0) {
    const l = W(i.valueType, t, {
      ...r,
      path: [...r.path, "patternProperties", "*"]
    });
    o.patternProperties = {};
    for (const d of a)
      o.patternProperties[d.source] = l;
  } else
    (t.target === "draft-07" || t.target === "draft-2020-12") && (o.propertyNames = W(i.keyType, t, {
      ...r,
      path: [...r.path, "propertyNames"]
    })), o.additionalProperties = W(i.valueType, t, {
      ...r,
      path: [...r.path, "additionalProperties"]
    });
  const u = s._zod.values;
  if (u) {
    const l = [...u].filter((d) => typeof d == "string" || typeof d == "number");
    l.length > 0 && (o.required = l);
  }
}, ga = (e, t, n, r) => {
  const o = e._zod.def, i = W(o.innerType, t, r), s = t.seen.get(e);
  t.target === "openapi-3.0" ? (s.ref = o.innerType, n.nullable = !0) : n.anyOf = [i, { type: "null" }];
}, Ta = (e, t, n, r) => {
  const o = e._zod.def;
  W(o.innerType, t, r);
  const i = t.seen.get(e);
  i.ref = o.innerType;
}, ya = (e, t, n, r) => {
  const o = e._zod.def;
  W(o.innerType, t, r);
  const i = t.seen.get(e);
  i.ref = o.innerType, n.default = JSON.parse(JSON.stringify(o.defaultValue));
}, Na = (e, t, n, r) => {
  const o = e._zod.def;
  W(o.innerType, t, r);
  const i = t.seen.get(e);
  i.ref = o.innerType, t.io === "input" && (n._prefault = JSON.parse(JSON.stringify(o.defaultValue)));
}, La = (e, t, n, r) => {
  const o = e._zod.def;
  W(o.innerType, t, r);
  const i = t.seen.get(e);
  i.ref = o.innerType;
  let s;
  try {
    s = o.catchValue(void 0);
  } catch {
    throw new Error("Dynamic catch values are not supported in JSON Schema");
  }
  n.default = s;
}, Sa = (e, t, n, r) => {
  const o = e._zod.def, i = t.io === "input" ? o.in._zod.def.type === "transform" ? o.out : o.in : o.out;
  W(i, t, r);
  const s = t.seen.get(e);
  s.ref = i;
}, Ia = (e, t, n, r) => {
  const o = e._zod.def;
  W(o.innerType, t, r);
  const i = t.seen.get(e);
  i.ref = o.innerType, n.readOnly = !0;
}, or = (e, t, n, r) => {
  const o = e._zod.def;
  W(o.innerType, t, r);
  const i = t.seen.get(e);
  i.ref = o.innerType;
}, va = /* @__PURE__ */ T("ZodISODateTime", (e, t) => {
  Di.init(e, t), x.init(e, t);
});
function Oa(e) {
  return /* @__PURE__ */ Us(va, e);
}
const ba = /* @__PURE__ */ T("ZodISODate", (e, t) => {
  Ai.init(e, t), x.init(e, t);
});
function Da(e) {
  return /* @__PURE__ */ ks(ba, e);
}
const Aa = /* @__PURE__ */ T("ZodISOTime", (e, t) => {
  Ri.init(e, t), x.init(e, t);
});
function Ra(e) {
  return /* @__PURE__ */ zs(Aa, e);
}
const Ca = /* @__PURE__ */ T("ZodISODuration", (e, t) => {
  Ci.init(e, t), x.init(e, t);
});
function wa(e) {
  return /* @__PURE__ */ Fs(Ca, e);
}
const Ua = (e, t) => {
  $n.init(e, t), e.name = "ZodError", Object.defineProperties(e, {
    format: {
      value: (n) => No(e, n)
      // enumerable: false,
    },
    flatten: {
      value: (n) => yo(e, n)
      // enumerable: false,
    },
    addIssue: {
      value: (n) => {
        e.issues.push(n), e.message = JSON.stringify(e.issues, pt, 2);
      }
      // enumerable: false,
    },
    addIssues: {
      value: (n) => {
        e.issues.push(...n), e.message = JSON.stringify(e.issues, pt, 2);
      }
      // enumerable: false,
    },
    isEmpty: {
      get() {
        return e.issues.length === 0;
      }
      // enumerable: false,
    }
  });
}, ne = T("ZodError", Ua, {
  Parent: Error
}), ka = /* @__PURE__ */ vt(ne), za = /* @__PURE__ */ Ot(ne), Fa = /* @__PURE__ */ Me(ne), Pa = /* @__PURE__ */ Be(ne), Za = /* @__PURE__ */ Io(ne), $a = /* @__PURE__ */ vo(ne), xa = /* @__PURE__ */ Oo(ne), Ma = /* @__PURE__ */ bo(ne), Ba = /* @__PURE__ */ Do(ne), ja = /* @__PURE__ */ Ao(ne), Xa = /* @__PURE__ */ Ro(ne), Ha = /* @__PURE__ */ Co(ne), B = /* @__PURE__ */ T("ZodType", (e, t) => (M.init(e, t), Object.assign(e["~standard"], {
  jsonSchema: {
    input: Pe(e, "input"),
    output: Pe(e, "output")
  }
}), e.toJSONSchema = ra(e, {}), e.def = t, e.type = t.type, Object.defineProperty(e, "_def", { value: t }), e.check = (...n) => e.clone(ce(t, {
  checks: [
    ...t.checks ?? [],
    ...n.map((r) => typeof r == "function" ? { _zod: { check: r, def: { check: "custom" }, onattach: [] } } : r)
  ]
}), {
  parent: !0
}), e.with = e.check, e.clone = (n, r) => ue(e, n, r), e.brand = () => e, e.register = (n, r) => (n.add(e, r), e), e.parse = (n, r) => ka(e, n, r, { callee: e.parse }), e.safeParse = (n, r) => Fa(e, n, r), e.parseAsync = async (n, r) => za(e, n, r, { callee: e.parseAsync }), e.safeParseAsync = async (n, r) => Pa(e, n, r), e.spa = e.safeParseAsync, e.encode = (n, r) => Za(e, n, r), e.decode = (n, r) => $a(e, n, r), e.encodeAsync = async (n, r) => xa(e, n, r), e.decodeAsync = async (n, r) => Ma(e, n, r), e.safeEncode = (n, r) => Ba(e, n, r), e.safeDecode = (n, r) => ja(e, n, r), e.safeEncodeAsync = async (n, r) => Xa(e, n, r), e.safeDecodeAsync = async (n, r) => Ha(e, n, r), e.refine = (n, r) => e.check(Zc(n, r)), e.superRefine = (n) => e.check($c(n)), e.overwrite = (n) => e.check(/* @__PURE__ */ Te(n)), e.optional = () => mn(e), e.exactOptional = () => vc(e), e.nullable = () => _n(e), e.nullish = () => mn(_n(e)), e.nonoptional = (n) => Cc(e, n), e.array = () => At(e), e.or = (n) => gc([e, n]), e.and = (n) => yc(e, n), e.transform = (n) => gn(e, Sc(n)), e.default = (n) => Dc(e, n), e.prefault = (n) => Rc(e, n), e.catch = (n) => Uc(e, n), e.pipe = (n) => gn(e, n), e.readonly = () => Fc(e), e.describe = (n) => {
  const r = e.clone();
  return Ne.add(r, { description: n }), r;
}, Object.defineProperty(e, "description", {
  get() {
    var n;
    return (n = Ne.get(e)) == null ? void 0 : n.description;
  },
  configurable: !0
}), e.meta = (...n) => {
  if (n.length === 0)
    return Ne.get(e);
  const r = e.clone();
  return Ne.add(r, n[0]), r;
}, e.isOptional = () => e.safeParse(void 0).success, e.isNullable = () => e.safeParse(null).success, e.apply = (n) => n(e), e)), ir = /* @__PURE__ */ T("_ZodString", (e, t) => {
  bt.init(e, t), B.init(e, t), e._zod.processJSONSchema = (r, o, i) => ia(e, r, o);
  const n = e._zod.bag;
  e.format = n.format ?? null, e.minLength = n.minimum ?? null, e.maxLength = n.maximum ?? null, e.regex = (...r) => e.check(/* @__PURE__ */ Bs(...r)), e.includes = (...r) => e.check(/* @__PURE__ */ Hs(...r)), e.startsWith = (...r) => e.check(/* @__PURE__ */ Gs(...r)), e.endsWith = (...r) => e.check(/* @__PURE__ */ Ws(...r)), e.min = (...r) => e.check(/* @__PURE__ */ Fe(...r)), e.max = (...r) => e.check(/* @__PURE__ */ Qn(...r)), e.length = (...r) => e.check(/* @__PURE__ */ er(...r)), e.nonempty = (...r) => e.check(/* @__PURE__ */ Fe(1, ...r)), e.lowercase = (r) => e.check(/* @__PURE__ */ js(r)), e.uppercase = (r) => e.check(/* @__PURE__ */ Xs(r)), e.trim = () => e.check(/* @__PURE__ */ Ys()), e.normalize = (...r) => e.check(/* @__PURE__ */ Vs(...r)), e.toLowerCase = () => e.check(/* @__PURE__ */ Ks()), e.toUpperCase = () => e.check(/* @__PURE__ */ Js()), e.slugify = () => e.check(/* @__PURE__ */ qs());
}), Ga = /* @__PURE__ */ T("ZodString", (e, t) => {
  bt.init(e, t), ir.init(e, t), e.email = (n) => e.check(/* @__PURE__ */ ds(Wa, n)), e.url = (n) => e.check(/* @__PURE__ */ _s(Va, n)), e.jwt = (n) => e.check(/* @__PURE__ */ ws(uc, n)), e.emoji = (n) => e.check(/* @__PURE__ */ gs(Ya, n)), e.guid = (n) => e.check(/* @__PURE__ */ ln(hn, n)), e.uuid = (n) => e.check(/* @__PURE__ */ ps(Re, n)), e.uuidv4 = (n) => e.check(/* @__PURE__ */ hs(Re, n)), e.uuidv6 = (n) => e.check(/* @__PURE__ */ Es(Re, n)), e.uuidv7 = (n) => e.check(/* @__PURE__ */ ms(Re, n)), e.nanoid = (n) => e.check(/* @__PURE__ */ Ts(Ka, n)), e.guid = (n) => e.check(/* @__PURE__ */ ln(hn, n)), e.cuid = (n) => e.check(/* @__PURE__ */ ys(Ja, n)), e.cuid2 = (n) => e.check(/* @__PURE__ */ Ns(qa, n)), e.ulid = (n) => e.check(/* @__PURE__ */ Ls(Qa, n)), e.base64 = (n) => e.check(/* @__PURE__ */ As(sc, n)), e.base64url = (n) => e.check(/* @__PURE__ */ Rs(ac, n)), e.xid = (n) => e.check(/* @__PURE__ */ Ss(ec, n)), e.ksuid = (n) => e.check(/* @__PURE__ */ Is(tc, n)), e.ipv4 = (n) => e.check(/* @__PURE__ */ vs(nc, n)), e.ipv6 = (n) => e.check(/* @__PURE__ */ Os(rc, n)), e.cidrv4 = (n) => e.check(/* @__PURE__ */ bs(oc, n)), e.cidrv6 = (n) => e.check(/* @__PURE__ */ Ds(ic, n)), e.e164 = (n) => e.check(/* @__PURE__ */ Cs(cc, n)), e.datetime = (n) => e.check(Oa(n)), e.date = (n) => e.check(Da(n)), e.time = (n) => e.check(Ra(n)), e.duration = (n) => e.check(wa(n));
});
function C(e) {
  return /* @__PURE__ */ fs(Ga, e);
}
const x = /* @__PURE__ */ T("ZodStringFormat", (e, t) => {
  Z.init(e, t), ir.init(e, t);
}), Wa = /* @__PURE__ */ T("ZodEmail", (e, t) => {
  Ti.init(e, t), x.init(e, t);
}), hn = /* @__PURE__ */ T("ZodGUID", (e, t) => {
  _i.init(e, t), x.init(e, t);
}), Re = /* @__PURE__ */ T("ZodUUID", (e, t) => {
  gi.init(e, t), x.init(e, t);
}), Va = /* @__PURE__ */ T("ZodURL", (e, t) => {
  yi.init(e, t), x.init(e, t);
}), Ya = /* @__PURE__ */ T("ZodEmoji", (e, t) => {
  Ni.init(e, t), x.init(e, t);
}), Ka = /* @__PURE__ */ T("ZodNanoID", (e, t) => {
  Li.init(e, t), x.init(e, t);
}), Ja = /* @__PURE__ */ T("ZodCUID", (e, t) => {
  Si.init(e, t), x.init(e, t);
}), qa = /* @__PURE__ */ T("ZodCUID2", (e, t) => {
  Ii.init(e, t), x.init(e, t);
}), Qa = /* @__PURE__ */ T("ZodULID", (e, t) => {
  vi.init(e, t), x.init(e, t);
}), ec = /* @__PURE__ */ T("ZodXID", (e, t) => {
  Oi.init(e, t), x.init(e, t);
}), tc = /* @__PURE__ */ T("ZodKSUID", (e, t) => {
  bi.init(e, t), x.init(e, t);
}), nc = /* @__PURE__ */ T("ZodIPv4", (e, t) => {
  wi.init(e, t), x.init(e, t);
}), rc = /* @__PURE__ */ T("ZodIPv6", (e, t) => {
  Ui.init(e, t), x.init(e, t);
}), oc = /* @__PURE__ */ T("ZodCIDRv4", (e, t) => {
  ki.init(e, t), x.init(e, t);
}), ic = /* @__PURE__ */ T("ZodCIDRv6", (e, t) => {
  zi.init(e, t), x.init(e, t);
}), sc = /* @__PURE__ */ T("ZodBase64", (e, t) => {
  Fi.init(e, t), x.init(e, t);
}), ac = /* @__PURE__ */ T("ZodBase64URL", (e, t) => {
  Zi.init(e, t), x.init(e, t);
}), cc = /* @__PURE__ */ T("ZodE164", (e, t) => {
  $i.init(e, t), x.init(e, t);
}), uc = /* @__PURE__ */ T("ZodJWT", (e, t) => {
  Mi.init(e, t), x.init(e, t);
}), sr = /* @__PURE__ */ T("ZodNumber", (e, t) => {
  Yn.init(e, t), B.init(e, t), e._zod.processJSONSchema = (r, o, i) => sa(e, r, o), e.gt = (r, o) => e.check(/* @__PURE__ */ dn(r, o)), e.gte = (r, o) => e.check(/* @__PURE__ */ lt(r, o)), e.min = (r, o) => e.check(/* @__PURE__ */ lt(r, o)), e.lt = (r, o) => e.check(/* @__PURE__ */ fn(r, o)), e.lte = (r, o) => e.check(/* @__PURE__ */ ut(r, o)), e.max = (r, o) => e.check(/* @__PURE__ */ ut(r, o)), e.int = (r) => e.check(En(r)), e.safe = (r) => e.check(En(r)), e.positive = (r) => e.check(/* @__PURE__ */ dn(0, r)), e.nonnegative = (r) => e.check(/* @__PURE__ */ lt(0, r)), e.negative = (r) => e.check(/* @__PURE__ */ fn(0, r)), e.nonpositive = (r) => e.check(/* @__PURE__ */ ut(0, r)), e.multipleOf = (r, o) => e.check(/* @__PURE__ */ pn(r, o)), e.step = (r, o) => e.check(/* @__PURE__ */ pn(r, o)), e.finite = () => e;
  const n = e._zod.bag;
  e.minValue = Math.max(n.minimum ?? Number.NEGATIVE_INFINITY, n.exclusiveMinimum ?? Number.NEGATIVE_INFINITY) ?? null, e.maxValue = Math.min(n.maximum ?? Number.POSITIVE_INFINITY, n.exclusiveMaximum ?? Number.POSITIVE_INFINITY) ?? null, e.isInt = (n.format ?? "").includes("int") || Number.isSafeInteger(n.multipleOf ?? 0.5), e.isFinite = !0, e.format = n.format ?? null;
}), lc = /* @__PURE__ */ T("ZodNumberFormat", (e, t) => {
  Bi.init(e, t), sr.init(e, t);
});
function En(e) {
  return /* @__PURE__ */ Zs(lc, e);
}
const fc = /* @__PURE__ */ T("ZodBoolean", (e, t) => {
  ji.init(e, t), B.init(e, t), e._zod.processJSONSchema = (n, r, o) => aa(e, n, r);
});
function Dt(e) {
  return /* @__PURE__ */ $s(fc, e);
}
const dc = /* @__PURE__ */ T("ZodUnknown", (e, t) => {
  Xi.init(e, t), B.init(e, t), e._zod.processJSONSchema = (n, r, o) => ua();
});
function Ze() {
  return /* @__PURE__ */ xs(dc);
}
const pc = /* @__PURE__ */ T("ZodNever", (e, t) => {
  Hi.init(e, t), B.init(e, t), e._zod.processJSONSchema = (n, r, o) => ca(e, n, r);
});
function hc(e) {
  return /* @__PURE__ */ Ms(pc, e);
}
const Ec = /* @__PURE__ */ T("ZodArray", (e, t) => {
  Gi.init(e, t), B.init(e, t), e._zod.processJSONSchema = (n, r, o) => pa(e, n, r, o), e.element = t.element, e.min = (n, r) => e.check(/* @__PURE__ */ Fe(n, r)), e.nonempty = (n) => e.check(/* @__PURE__ */ Fe(1, n)), e.max = (n, r) => e.check(/* @__PURE__ */ Qn(n, r)), e.length = (n, r) => e.check(/* @__PURE__ */ er(n, r)), e.unwrap = () => e.element;
});
function At(e, t) {
  return /* @__PURE__ */ Qs(Ec, e, t);
}
const mc = /* @__PURE__ */ T("ZodObject", (e, t) => {
  Vi.init(e, t), B.init(e, t), e._zod.processJSONSchema = (n, r, o) => ha(e, n, r, o), z(e, "shape", () => t.shape), e.keyof = () => mt(Object.keys(e._zod.def.shape)), e.catchall = (n) => e.clone({ ...e._zod.def, catchall: n }), e.passthrough = () => e.clone({ ...e._zod.def, catchall: Ze() }), e.loose = () => e.clone({ ...e._zod.def, catchall: Ze() }), e.strict = () => e.clone({ ...e._zod.def, catchall: hc() }), e.strip = () => e.clone({ ...e._zod.def, catchall: void 0 }), e.extend = (n) => Eo(e, n), e.safeExtend = (n) => mo(e, n), e.merge = (n) => _o(e, n), e.pick = (n) => po(e, n), e.omit = (n) => ho(e, n), e.partial = (...n) => go(cr, e, n[0]), e.required = (...n) => To(ur, e, n[0]);
});
function G(e, t) {
  const n = {
    type: "object",
    shape: e ?? {},
    ...R(t)
  };
  return new mc(n);
}
const _c = /* @__PURE__ */ T("ZodUnion", (e, t) => {
  Yi.init(e, t), B.init(e, t), e._zod.processJSONSchema = (n, r, o) => Ea(e, n, r, o), e.options = t.options;
});
function gc(e, t) {
  return new _c({
    type: "union",
    options: e,
    ...R(t)
  });
}
const Tc = /* @__PURE__ */ T("ZodIntersection", (e, t) => {
  Ki.init(e, t), B.init(e, t), e._zod.processJSONSchema = (n, r, o) => ma(e, n, r, o);
});
function yc(e, t) {
  return new Tc({
    type: "intersection",
    left: e,
    right: t
  });
}
const Nc = /* @__PURE__ */ T("ZodRecord", (e, t) => {
  Ji.init(e, t), B.init(e, t), e._zod.processJSONSchema = (n, r, o) => _a(e, n, r, o), e.keyType = t.keyType, e.valueType = t.valueType;
});
function ar(e, t, n) {
  return new Nc({
    type: "record",
    keyType: e,
    valueType: t,
    ...R(n)
  });
}
const Et = /* @__PURE__ */ T("ZodEnum", (e, t) => {
  qi.init(e, t), B.init(e, t), e._zod.processJSONSchema = (r, o, i) => la(e, r, o), e.enum = t.entries, e.options = Object.values(t.entries);
  const n = new Set(Object.keys(t.entries));
  e.extract = (r, o) => {
    const i = {};
    for (const s of r)
      if (n.has(s))
        i[s] = t.entries[s];
      else
        throw new Error(`Key ${s} not found in enum`);
    return new Et({
      ...t,
      checks: [],
      ...R(o),
      entries: i
    });
  }, e.exclude = (r, o) => {
    const i = { ...t.entries };
    for (const s of r)
      if (n.has(s))
        delete i[s];
      else
        throw new Error(`Key ${s} not found in enum`);
    return new Et({
      ...t,
      checks: [],
      ...R(o),
      entries: i
    });
  };
});
function mt(e, t) {
  const n = Array.isArray(e) ? Object.fromEntries(e.map((r) => [r, r])) : e;
  return new Et({
    type: "enum",
    entries: n,
    ...R(t)
  });
}
const Lc = /* @__PURE__ */ T("ZodTransform", (e, t) => {
  Qi.init(e, t), B.init(e, t), e._zod.processJSONSchema = (n, r, o) => da(e, n), e._zod.parse = (n, r) => {
    if (r.direction === "backward")
      throw new Un(e.constructor.name);
    n.addIssue = (i) => {
      if (typeof i == "string")
        n.issues.push(Se(i, n.value, t));
      else {
        const s = i;
        s.fatal && (s.continue = !1), s.code ?? (s.code = "custom"), s.input ?? (s.input = n.value), s.inst ?? (s.inst = e), n.issues.push(Se(s));
      }
    };
    const o = t.transform(n.value, n);
    return o instanceof Promise ? o.then((i) => (n.value = i, n)) : (n.value = o, n);
  };
});
function Sc(e) {
  return new Lc({
    type: "transform",
    transform: e
  });
}
const cr = /* @__PURE__ */ T("ZodOptional", (e, t) => {
  qn.init(e, t), B.init(e, t), e._zod.processJSONSchema = (n, r, o) => or(e, n, r, o), e.unwrap = () => e._zod.def.innerType;
});
function mn(e) {
  return new cr({
    type: "optional",
    innerType: e
  });
}
const Ic = /* @__PURE__ */ T("ZodExactOptional", (e, t) => {
  es.init(e, t), B.init(e, t), e._zod.processJSONSchema = (n, r, o) => or(e, n, r, o), e.unwrap = () => e._zod.def.innerType;
});
function vc(e) {
  return new Ic({
    type: "optional",
    innerType: e
  });
}
const Oc = /* @__PURE__ */ T("ZodNullable", (e, t) => {
  ts.init(e, t), B.init(e, t), e._zod.processJSONSchema = (n, r, o) => ga(e, n, r, o), e.unwrap = () => e._zod.def.innerType;
});
function _n(e) {
  return new Oc({
    type: "nullable",
    innerType: e
  });
}
const bc = /* @__PURE__ */ T("ZodDefault", (e, t) => {
  ns.init(e, t), B.init(e, t), e._zod.processJSONSchema = (n, r, o) => ya(e, n, r, o), e.unwrap = () => e._zod.def.innerType, e.removeDefault = e.unwrap;
});
function Dc(e, t) {
  return new bc({
    type: "default",
    innerType: e,
    get defaultValue() {
      return typeof t == "function" ? t() : Pn(t);
    }
  });
}
const Ac = /* @__PURE__ */ T("ZodPrefault", (e, t) => {
  rs.init(e, t), B.init(e, t), e._zod.processJSONSchema = (n, r, o) => Na(e, n, r, o), e.unwrap = () => e._zod.def.innerType;
});
function Rc(e, t) {
  return new Ac({
    type: "prefault",
    innerType: e,
    get defaultValue() {
      return typeof t == "function" ? t() : Pn(t);
    }
  });
}
const ur = /* @__PURE__ */ T("ZodNonOptional", (e, t) => {
  os.init(e, t), B.init(e, t), e._zod.processJSONSchema = (n, r, o) => Ta(e, n, r, o), e.unwrap = () => e._zod.def.innerType;
});
function Cc(e, t) {
  return new ur({
    type: "nonoptional",
    innerType: e,
    ...R(t)
  });
}
const wc = /* @__PURE__ */ T("ZodCatch", (e, t) => {
  is.init(e, t), B.init(e, t), e._zod.processJSONSchema = (n, r, o) => La(e, n, r, o), e.unwrap = () => e._zod.def.innerType, e.removeCatch = e.unwrap;
});
function Uc(e, t) {
  return new wc({
    type: "catch",
    innerType: e,
    catchValue: typeof t == "function" ? t : () => t
  });
}
const kc = /* @__PURE__ */ T("ZodPipe", (e, t) => {
  ss.init(e, t), B.init(e, t), e._zod.processJSONSchema = (n, r, o) => Sa(e, n, r, o), e.in = t.in, e.out = t.out;
});
function gn(e, t) {
  return new kc({
    type: "pipe",
    in: e,
    out: t
    // ...util.normalizeParams(params),
  });
}
const zc = /* @__PURE__ */ T("ZodReadonly", (e, t) => {
  as.init(e, t), B.init(e, t), e._zod.processJSONSchema = (n, r, o) => Ia(e, n, r, o), e.unwrap = () => e._zod.def.innerType;
});
function Fc(e) {
  return new zc({
    type: "readonly",
    innerType: e
  });
}
const Pc = /* @__PURE__ */ T("ZodCustom", (e, t) => {
  cs.init(e, t), B.init(e, t), e._zod.processJSONSchema = (n, r, o) => fa(e, n);
});
function Zc(e, t = {}) {
  return /* @__PURE__ */ ea(Pc, e, t);
}
function $c(e) {
  return /* @__PURE__ */ ta(e);
}
function Y(e) {
  return /* @__PURE__ */ Ps(sr, e);
}
const V = C().trim().min(1), xc = C().trim().min(1), lr = G({
  id: C().trim().optional(),
  name: C().trim().min(1),
  generic: C().optional().default(""),
  type: C().optional().default("tablet"),
  category: C().optional().default(""),
  unitType: C().optional().default("tablet"),
  unit: C().optional().default("Tablet"),
  tabletsPerPack: Y().int().min(1).optional().default(1),
  volumeMl: Y().min(0).optional().default(0),
  supplierId: C().nullable().optional(),
  supplierName: C().optional().default(""),
  manufacturerId: C().nullable().optional(),
  manufacturerName: C().optional().default(""),
  lowStockThreshold: Y().min(0).optional().default(0),
  purchasePerPack: Y().min(0).optional().default(0),
  salePerPack: Y().min(0).optional().default(0)
}), Mc = lr.partial(), Bc = G({
  id: C().trim().optional(),
  batchNo: C().trim().min(1),
  expiryDate: xc,
  quantityTablets: Y().int().min(0).default(0),
  costPricePerTablet: Y().min(0).default(0),
  salePricePerTablet: Y().min(0).default(0),
  salePricePerPack: Y().min(0).default(0)
}), Ce = G({
  id: C().trim().optional(),
  name: C().trim().min(1),
  phone: C().optional().default(""),
  company: C().optional().default(""),
  address: C().optional().default("")
}), Tn = G({
  id: C().trim().optional(),
  name: C().trim().min(1),
  phone: C().optional().default(""),
  address: C().optional().default(""),
  creditLimit: Y().min(0).optional().default(0),
  balanceDue: Y().min(0).optional().default(0)
}), jc = G({
  customerId: C().trim().optional(),
  customerName: C().optional(),
  paymentMethod: mt(["cash", "card", "credit"]).default("cash"),
  discount: Y().min(0).optional().default(0),
  items: At(
    G({
      medicineId: C().trim().min(1),
      quantityMode: mt(["tablet", "packet"]).default("tablet"),
      quantity: Y().int().positive()
    })
  ).min(1)
}), Xc = G({
  supplierId: C().trim().min(1),
  supplierName: C().optional(),
  purchaseDate: C().optional(),
  grnNo: C().optional(),
  notes: C().optional(),
  tax: Y().min(0).optional().default(0),
  discount: Y().min(0).optional().default(0),
  items: At(
    G({
      medicineId: C().trim().min(1),
      quantityPacks: Y().int().positive(),
      tabletsPerPack: Y().int().positive().optional(),
      unitCostPerTablet: Y().min(0).optional().default(0),
      batchNo: C().optional().default(""),
      expiryDate: C().optional().default("")
    })
  ).min(1)
});
function Hc(e) {
  return {
    "batches:list": (t) => {
      const n = G({ medicineId: C().trim().optional() }).parse(t ?? {});
      return n.medicineId ? e.db.prepare("SELECT * FROM batches WHERE medicine_id = ? ORDER BY date(expiry_date) ASC").all(n.medicineId) : e.db.prepare("SELECT * FROM batches ORDER BY date(expiry_date) ASC").all();
    },
    "batches:update": (t) => {
      const n = G({ id: V, body: ar(C(), Ze()) }).parse(t ?? {});
      return j("batches:update", { id: n.id }), e.updateBatch(n.id, n.body);
    },
    "batches:remove": (t) => {
      const n = V.parse(t);
      return ie("pre-delete-batch-"), j("batches:remove", { id: n }), e.deleteBatch(n);
    }
  };
}
class Gc {
  constructor(t) {
    Ge(this, "db");
    this.db = t;
  }
  listActive() {
    return this.db.prepare("SELECT * FROM medicines WHERE is_active = 1 ORDER BY name COLLATE NOCASE").all();
  }
  listBatches() {
    return this.db.prepare("SELECT * FROM batches ORDER BY date(expiry_date) ASC").all();
  }
  byId(t) {
    return this.db.prepare("SELECT * FROM medicines WHERE id = ?").get(t);
  }
}
function Wc(e) {
  const { db: t, nowIso: n, generateId: r } = e, o = new Gc(t);
  return {
    "medicines:list": () => {
      const i = o.listActive(), s = o.listBatches(), c = /* @__PURE__ */ new Map();
      for (const a of s) {
        const u = c.get(a.medicine_id) ?? [];
        u.push(a), c.set(a.medicine_id, u);
      }
      return i.map((a) => ({ ...a, batches: c.get(a.id) ?? [] }));
    },
    "medicines:create": (i) => {
      const s = lr.parse(i ?? {}), c = s.id ?? r("med");
      return j("medicines:create", { id: c, name: s.name }), t.prepare(
        `INSERT INTO medicines
        (id, name, generic, type, category, unit_type, unit, tablets_per_pack, volume_ml, supplier_id, supplier_name, manufacturer_id, manufacturer_name, low_stock_threshold, purchase_per_pack, sale_per_pack, total_stock_tablets, is_active, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 1, ?, ?)`
      ).run(
        c,
        s.name,
        s.generic,
        s.type,
        s.category,
        s.unitType,
        s.unit,
        s.tabletsPerPack,
        s.volumeMl,
        s.supplierId ?? null,
        s.supplierName,
        s.manufacturerId ?? null,
        s.manufacturerName,
        s.lowStockThreshold,
        s.purchasePerPack,
        s.salePerPack,
        n(),
        n()
      ), o.byId(c);
    },
    "medicines:update": (i) => {
      const s = G({ id: V, body: Mc }).parse(i ?? {});
      if (j("medicines:update", { id: s.id }), !t.prepare(
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
        s.body.name ?? null,
        s.body.generic ?? null,
        s.body.category ?? null,
        s.body.unit ?? null,
        s.body.tabletsPerPack ?? null,
        s.body.lowStockThreshold ?? null,
        s.body.purchasePerPack ?? null,
        s.body.salePerPack ?? null,
        n(),
        s.id
      ).changes) throw new Error("Medicine not found.");
      return o.byId(s.id);
    },
    "medicines:remove": (i) => {
      const s = V.parse(i);
      return ie("pre-delete-medicine-"), j("medicines:remove", { id: s }), t.prepare("UPDATE medicines SET is_active = 0, updated_at = ? WHERE id = ?").run(n(), s), K.info("Medicine soft-deleted", { id: s }), { deleted: !0 };
    },
    "medicines:addBatch": (i) => {
      const s = G({ medicineId: V, body: Bc }).parse(i ?? {}), c = s.body.id ?? r("bat");
      return j("medicines:addBatch", { medicineId: s.medicineId, batchId: c }), t.prepare(
        `INSERT INTO batches
        (id, medicine_id, batch_no, expiry_date, quantity_tablets, cost_price_per_tablet, sale_price_per_tablet, sale_price_per_pack, received_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        c,
        s.medicineId,
        s.body.batchNo,
        s.body.expiryDate,
        s.body.quantityTablets,
        s.body.costPricePerTablet,
        s.body.salePricePerTablet,
        s.body.salePricePerPack,
        n()
      ), t.prepare("SELECT * FROM batches WHERE id = ?").get(c);
    }
  };
}
function Rt(e, t) {
  return e.transaction(t)();
}
function Vc(e) {
  return {
    "purchases:list": (t) => G({ includeItems: Dt().optional().default(!1) }).parse(t ?? {}).includeItems ? e.db.prepare("SELECT * FROM purchases ORDER BY created_at DESC").all().map((o) => e.getPurchaseById(o.id)) : e.db.prepare("SELECT * FROM purchases ORDER BY created_at DESC").all(),
    "purchases:get": (t) => e.getPurchaseById(V.parse(t)),
    "purchases:create": (t) => {
      const n = Xc.parse(t ?? {});
      return j("purchases:create", { supplierId: n.supplierId }), Rt(e.db, () => e.createPendingPurchase(n));
    },
    "purchases:update": (t) => {
      const n = G({ id: V, body: ar(C(), Ze()) }).parse(t ?? {});
      return n.body, e.getPurchaseById(n.id);
    },
    "purchases:receive": (t) => e.receivePurchase(V.parse(t)),
    "purchases:remove": (t) => {
      const n = V.parse(t);
      return ie("pre-delete-purchase-"), j("purchases:remove", { id: n }), e.db.prepare("DELETE FROM purchases WHERE id = ?").run(n), { deleted: !0 };
    }
  };
}
function Yc(e) {
  return {
    "returns:list": (t) => G({ includeItems: Dt().optional().default(!1) }).parse(t ?? {}).includeItems ? e.db.prepare("SELECT * FROM returns ORDER BY created_at DESC").all().map((o) => ({
      ...o,
      items: e.db.prepare("SELECT * FROM return_items WHERE return_id = ? ORDER BY created_at ASC").all(o.id)
    })) : e.db.prepare("SELECT * FROM returns ORDER BY created_at DESC").all(),
    "returns:get": (t) => {
      const n = V.parse(t), r = e.db.prepare("SELECT * FROM returns WHERE id = ?").get(n);
      if (!r) throw new Error("Return not found.");
      return { ...r, items: e.db.prepare("SELECT * FROM return_items WHERE return_id = ? ORDER BY created_at ASC").all(n) };
    },
    "returns:create": (t) => {
      const n = t ?? {};
      return j("returns:create"), Rt(e.db, () => e.createReturn(n));
    }
  };
}
class Kc {
  constructor(t) {
    Ge(this, "db");
    this.db = t;
  }
  listSales() {
    return this.db.prepare("SELECT * FROM sales ORDER BY created_at DESC").all();
  }
  saleById(t) {
    return this.db.prepare("SELECT * FROM sales WHERE id = ?").get(t);
  }
  saleItems(t) {
    return this.db.prepare("SELECT * FROM sale_items WHERE sale_id = ? ORDER BY created_at ASC").all(t);
  }
}
function Jc(e) {
  const t = new Kc(e.db);
  return {
    "sales:list": (n) => G({ includeItems: Dt().optional().default(!1) }).parse(n ?? {}).includeItems ? t.listSales().map((i) => ({
      ...i,
      items: t.saleItems(i.id)
    })) : t.listSales(),
    "sales:get": (n) => {
      const r = V.parse(n), o = t.saleById(r);
      if (!o) throw new Error("Sale not found.");
      return { ...o, items: t.saleItems(r) };
    },
    "sales:create": (n) => {
      const r = jc.parse(n ?? {});
      return j("sales:create", { itemCount: r.items.length }), Rt(e.db, () => e.createSale(r));
    },
    "sales:remove": (n) => {
      const r = V.parse(n);
      return ie("pre-delete-sale-"), j("sales:remove", { id: r }), e.reverseSale(r);
    }
  };
}
function qc(e) {
  const { db: t, nowIso: n, generateId: r } = e;
  return {
    "suppliers:list": () => t.prepare("SELECT * FROM suppliers ORDER BY name COLLATE NOCASE").all(),
    "suppliers:create": (o) => {
      const i = Ce.parse(o ?? {}), s = i.id ?? r("sup");
      return j("suppliers:create", { id: s, name: i.name }), t.prepare(
        `INSERT INTO suppliers (id, name, phone, company, address, balance_payable, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 0, ?, ?)`
      ).run(s, i.name, i.phone, i.company, i.address, n(), n()), t.prepare("SELECT * FROM suppliers WHERE id = ?").get(s);
    },
    "suppliers:update": (o) => {
      const i = G({ id: V, body: Ce.partial() }).parse(o ?? {});
      if (j("suppliers:update", { id: i.id }), !t.prepare(
        `UPDATE suppliers SET
         name = COALESCE(?, name),
         phone = COALESCE(?, phone),
         company = COALESCE(?, company),
         address = COALESCE(?, address),
         updated_at = ?
         WHERE id = ?`
      ).run(i.body.name ?? null, i.body.phone ?? null, i.body.company ?? null, i.body.address ?? null, n(), i.id).changes) throw new Error("Supplier not found.");
      return t.prepare("SELECT * FROM suppliers WHERE id = ?").get(i.id);
    },
    "suppliers:remove": (o) => {
      const i = V.parse(o);
      return ie("pre-delete-supplier-"), j("suppliers:remove", { id: i }), t.prepare("DELETE FROM suppliers WHERE id = ?").run(i), { deleted: !0 };
    },
    "manufacturers:list": () => t.prepare("SELECT * FROM manufacturers ORDER BY name COLLATE NOCASE").all(),
    "manufacturers:create": (o) => {
      const i = Ce.parse(o ?? {}), s = i.id ?? r("man");
      return j("manufacturers:create", { id: s, name: i.name }), t.prepare(
        `INSERT INTO manufacturers (id, name, phone, company, address, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(s, i.name, i.phone, i.company, i.address, n(), n()), t.prepare("SELECT * FROM manufacturers WHERE id = ?").get(s);
    },
    "manufacturers:update": (o) => {
      const i = G({ id: V, body: Ce.partial() }).parse(o ?? {});
      if (j("manufacturers:update", { id: i.id }), !t.prepare(
        `UPDATE manufacturers SET
         name = COALESCE(?, name),
         phone = COALESCE(?, phone),
         company = COALESCE(?, company),
         address = COALESCE(?, address),
         updated_at = ?
         WHERE id = ?`
      ).run(i.body.name ?? null, i.body.phone ?? null, i.body.company ?? null, i.body.address ?? null, n(), i.id).changes) throw new Error("Manufacturer not found.");
      return t.prepare("SELECT * FROM manufacturers WHERE id = ?").get(i.id);
    },
    "manufacturers:remove": (o) => {
      const i = V.parse(o);
      return ie("pre-delete-manufacturer-"), j("manufacturers:remove", { id: i }), t.prepare("DELETE FROM manufacturers WHERE id = ?").run(i), { deleted: !0 };
    },
    "customers:list": () => t.prepare("SELECT * FROM customers ORDER BY name COLLATE NOCASE").all(),
    "customers:create": (o) => {
      const i = Tn.parse(o ?? {}), s = i.id ?? r("cus");
      return j("customers:create", { id: s, name: i.name }), t.prepare(
        `INSERT INTO customers (id, name, phone, address, credit_limit, balance_due, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(s, i.name, i.phone, i.address, i.creditLimit, i.balanceDue, n(), n()), t.prepare("SELECT * FROM customers WHERE id = ?").get(s);
    },
    "customers:update": (o) => {
      const i = G({ id: V, body: Tn.partial() }).parse(o ?? {});
      if (j("customers:update", { id: i.id }), !t.prepare(
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
        n(),
        i.id
      ).changes) throw new Error("Customer not found.");
      return t.prepare("SELECT * FROM customers WHERE id = ?").get(i.id);
    },
    "customers:remove": (o) => {
      const i = V.parse(o);
      return ie("pre-delete-customer-"), j("customers:remove", { id: i }), t.prepare("DELETE FROM customers WHERE id = ?").run(i), { deleted: !0 };
    },
    "customers:payBalance": (o) => {
      const i = G({ id: V, amount: Y().min(0) }).parse(o ?? {});
      return j("customers:payBalance", { id: i.id, amount: i.amount }), t.prepare("UPDATE customers SET balance_due = MAX(0, balance_due - ?), updated_at = ? WHERE id = ?").run(i.amount, n(), i.id), t.prepare("SELECT * FROM customers WHERE id = ?").get(i.id);
    }
  };
}
const Qc = 50, yn = /* @__PURE__ */ new Map();
function eu(e) {
  const t = Math.floor(Date.now() / 1e3), n = `global:${e}`, r = yn.get(n);
  if (!r || r.sec !== t) {
    yn.set(n, { sec: t, count: 1 });
    return;
  }
  if (r.count += 1, r.count > Qc)
    throw new Error(`Rate limit exceeded for ${e}`);
}
function Nn(e, t) {
  return async (n) => {
    try {
      return eu(e), await t(n);
    } catch (r) {
      throw K.error("IPC handler failed", { channel: e, payload: n, error: String(r) }), r instanceof Error ? r : new Error(String(r));
    }
  };
}
function tu(...e) {
  return e.reduce((t, n) => ({ ...t, ...n }), {});
}
function nu(e) {
  return { ok: !0, success: !0, data: e };
}
function ru(e) {
  var r;
  const t = e.method, n = e.path;
  if (t === "GET" && n === "/health") return { channel: "app:health" };
  if (t === "GET" && n === "/medicines") return { channel: "medicines:list" };
  if (t === "POST" && n === "/medicines") return { channel: "medicines:create", payload: e.body };
  if (t === "PUT" && /^\/medicines\/[^/]+$/.test(n)) return { channel: "medicines:update", payload: { id: n.split("/")[2], body: e.body } };
  if (t === "DELETE" && /^\/medicines\/[^/]+$/.test(n)) return { channel: "medicines:remove", payload: n.split("/")[2] };
  if (t === "POST" && /^\/medicines\/[^/]+\/batches$/.test(n)) return { channel: "medicines:addBatch", payload: { medicineId: n.split("/")[2], body: e.body } };
  if (t === "GET" && n === "/suppliers") return { channel: "suppliers:list" };
  if (t === "POST" && n === "/suppliers") return { channel: "suppliers:create", payload: e.body };
  if (t === "PUT" && /^\/suppliers\/[^/]+$/.test(n)) return { channel: "suppliers:update", payload: { id: n.split("/")[2], body: e.body } };
  if (t === "DELETE" && /^\/suppliers\/[^/]+$/.test(n)) return { channel: "suppliers:remove", payload: n.split("/")[2] };
  if (t === "GET" && n === "/manufacturers") return { channel: "manufacturers:list" };
  if (t === "POST" && n === "/manufacturers") return { channel: "manufacturers:create", payload: e.body };
  if (t === "PUT" && /^\/manufacturers\/[^/]+$/.test(n)) return { channel: "manufacturers:update", payload: { id: n.split("/")[2], body: e.body } };
  if (t === "DELETE" && /^\/manufacturers\/[^/]+$/.test(n)) return { channel: "manufacturers:remove", payload: n.split("/")[2] };
  if (t === "GET" && n === "/customers") return { channel: "customers:list" };
  if (t === "POST" && n === "/customers") return { channel: "customers:create", payload: e.body };
  if (t === "PUT" && /^\/customers\/[^/]+$/.test(n)) return { channel: "customers:update", payload: { id: n.split("/")[2], body: e.body } };
  if (t === "DELETE" && /^\/customers\/[^/]+$/.test(n)) return { channel: "customers:remove", payload: n.split("/")[2] };
  if (t === "POST" && /^\/customers\/[^/]+\/payments$/.test(n)) return { channel: "customers:payBalance", payload: { id: n.split("/")[2], amount: (r = e.body) == null ? void 0 : r.amount } };
  if (t === "GET" && n.startsWith("/sales")) {
    const o = n.match(/^\/sales\/([^/?]+)$/);
    return o ? { channel: "sales:get", payload: o[1] } : { channel: "sales:list", payload: { includeItems: n.includes("includeItems=1") } };
  }
  if (t === "POST" && n === "/sales") return { channel: "sales:create", payload: e.body };
  if (t === "DELETE" && /^\/sales\/[^/]+$/.test(n)) return { channel: "sales:remove", payload: n.split("/")[2] };
  if (t === "GET" && n.startsWith("/purchases")) {
    const o = n.match(/^\/purchases\/([^/?]+)$/);
    return o ? { channel: "purchases:get", payload: o[1] } : { channel: "purchases:list", payload: { includeItems: n.includes("includeItems=1") } };
  }
  if (t === "POST" && n === "/purchases") return { channel: "purchases:create", payload: e.body };
  if (t === "PUT" && /^\/purchases\/[^/]+$/.test(n)) return { channel: "purchases:update", payload: { id: n.split("/")[2], body: e.body } };
  if (t === "DELETE" && /^\/purchases\/[^/]+$/.test(n)) return { channel: "purchases:remove", payload: n.split("/")[2] };
  if (t === "POST" && /^\/purchases\/[^/]+\/receive$/.test(n)) return { channel: "purchases:receive", payload: n.split("/")[2] };
  if (t === "GET" && n.startsWith("/returns")) {
    const o = n.match(/^\/returns\/([^/?]+)$/);
    return o ? { channel: "returns:get", payload: o[1] } : { channel: "returns:list", payload: { includeItems: n.includes("includeItems=1") } };
  }
  if (t === "POST" && n === "/returns") return { channel: "returns:create", payload: e.body };
  if (t === "GET" && n.startsWith("/batches"))
    return { channel: "batches:list", payload: { medicineId: new URL(`ipc://local${n}`).searchParams.get("medicineId") ?? void 0 } };
  if (t === "PUT" && /^\/batches\/[^/]+$/.test(n)) return { channel: "batches:update", payload: { id: n.split("/")[2], body: e.body } };
  if (t === "DELETE" && /^\/batches\/[^/]+$/.test(n)) return { channel: "batches:remove", payload: n.split("/")[2] };
  throw new Error(`Unsupported legacy request: ${t} ${n}`);
}
function ou(e) {
  const t = tu(
    Wc(e),
    qc(e),
    Jc(e),
    Vc(e),
    Yc(e),
    Hc(e),
    {
      "app:health": () => ({
        status: "up",
        time: e.nowIso(),
        features: {
          cloudSync: yt("cloud-sync")
        }
      })
    }
  );
  for (const [n, r] of Object.entries(t))
    ee.handle(n, (o, i) => Nn(n, r)(i));
  ee.handle("pos:request", async (n, r) => {
    const o = ru(r), i = t[o.channel];
    if (!i)
      throw new Error(`No IPC handler found for channel: ${o.channel}`);
    const s = await Nn(o.channel, i)(o.payload);
    return nu(s);
  });
}
const fr = _r(import.meta.url), { db: iu, generateId: su, nowIso: au } = fr("../backend/db.js"), {
  createPendingPurchase: cu,
  createReturn: uu,
  createSale: lu,
  deleteBatch: fu,
  getPurchaseById: du,
  receivePurchase: pu,
  reverseSale: hu,
  updateBatch: Eu
} = fr("../backend/services.js"), { autoUpdater: oe } = yr, mu = gr(import.meta.url), dr = F.dirname(mu);
process.env.DIST = F.join(dr, "../dist");
process.env.VITE_PUBLIC = P.isPackaged ? process.env.DIST : F.join(process.env.DIST, "../public");
process.env.PHARMACY_USER_DATA_DIR = P.getPath("userData");
let H = null;
function we(e, t) {
  const n = F.resolve(e), r = F.resolve(t);
  return n === r ? !0 : n.startsWith(`${r}${F.sep}`);
}
function _u(e) {
  const t = F.resolve(String(e ?? "").trim());
  if (!t) throw new Error("Path is required.");
  const n = P.getPath("userData"), r = P.getPath("desktop"), o = P.getPath("downloads"), i = P.getPath("documents");
  if (!we(t, n) && !we(t, r) && !we(t, o) && !we(t, i))
    throw new Error("Path is outside allowed directories.");
  return t;
}
function fe(e) {
  for (const t of Le.getAllWindows())
    t.isDestroyed() || t.webContents.send("auto-update", e);
}
function pr() {
  H = new Le({
    icon: F.join(process.env.VITE_PUBLIC ?? "", "electron-vite.svg"),
    width: 1280,
    height: 800,
    frame: !1,
    backgroundColor: "#f4f7fb",
    webPreferences: {
      preload: F.join(dr, "preload.mjs"),
      contextIsolation: !0,
      nodeIntegration: !1,
      sandbox: !0
    }
  });
  const e = process.env.VITE_DEV_SERVER_URL;
  e ? H.loadURL(e) : P.isPackaged ? H.loadFile(F.join(process.env.DIST ?? "", "index.html")) : H.loadURL("http://127.0.0.1:5173/");
}
function gu() {
  fe({ phase: "checking", message: "Checking for updates..." }), oe.autoDownload = !0, oe.on(
    "checking-for-update",
    () => fe({ phase: "checking", message: "Checking for updates..." })
  ), oe.on(
    "update-not-available",
    () => fe({ phase: "not-available", message: "You are on the latest version." })
  ), oe.on(
    "download-progress",
    (e) => fe({
      phase: "downloading",
      message: `Downloading update... ${Math.round(e.percent)}%`
    })
  ), oe.on(
    "update-available",
    () => fe({ phase: "available", message: "Update found. Downloading..." })
  ), oe.on("update-downloaded", async () => {
    fe({ phase: "downloaded", message: "Update downloaded." }), (await Ue.showMessageBox({
      type: "info",
      title: "Update ready",
      message: "An update was downloaded. Restart now?",
      buttons: ["Restart now", "Later"],
      defaultId: 0,
      cancelId: 1
    })).response === 0 && oe.quitAndInstall(!1, !0);
  }), oe.on("error", (e) => {
    K.error("Auto updater error", { message: e.message }), fe({ phase: "error", message: e.message });
  }), P.isPackaged && oe.checkForUpdates().catch((e) => K.warn("Update check failed", e));
}
function Tu() {
  ee.handle("window:minimize", () => H == null ? void 0 : H.minimize()), ee.handle("window:maximize", () => H != null && H.isMaximized() ? H.unmaximize() : H == null ? void 0 : H.maximize()), ee.handle("window:close", () => H == null ? void 0 : H.close()), ee.handle("window:set-theme", (e, t) => H == null ? void 0 : H.setBackgroundColor(t ? "#0f172a" : "#f4f7fb")), ee.handle("app:reload", () => Le.getAllWindows().forEach((e) => !e.isDestroyed() && e.reload())), ou({
    db: io(iu),
    nowIso: au,
    generateId: su,
    createPendingPurchase: cu,
    createReturn: uu,
    createSale: lu,
    deleteBatch: fu,
    getPurchaseById: du,
    receivePurchase: pu,
    reverseSale: hu,
    updateBatch: Eu
  }), ee.handle("backup:create", () => ve("manual-")), ee.handle("backup:list", () => dt()), ee.handle("backup:restore", (e, t) => (ft(String(t ?? "")), Le.getAllWindows().forEach((n) => !n.isDestroyed() && n.reload()), !0)), ee.handle("logs:export", (e, t) => Ar(String(t ?? "").trim())), ee.handle(
    "diagnostics:export",
    (e, t) => oo(String(t ?? "").trim())
  ), ee.handle("system:openPath", async (e, t) => {
    const n = _u(t), r = await Tr.openPath(n);
    if (r) throw new Error(r);
  }), ee.handle("app:diagnostics", () => ({ dbPath: ge(), dbVersion: gt(), backups: dt() }));
}
P.on("window-all-closed", () => {
  process.platform !== "darwin" && P.quit();
});
P.on("activate", () => {
  Le.getAllWindows().length === 0 && pr();
});
P.on("before-quit", () => {
  try {
    ve("shutdown-");
  } catch (e) {
    K.warn("Shutdown backup failed", e);
  }
});
P.on("will-quit", () => On());
P.whenReady().then(() => {
  try {
    Ie();
    const e = Ut();
    if (!e.ok) {
      K.error("Database integrity check failed", e);
      const t = kt(), n = Ue.showMessageBoxSync({
        type: "error",
        title: "Database Recovery",
        message: "Database integrity checks failed. You can attempt restoring the latest backup, or exit the application.",
        detail: `integrity_check=${e.integrity}; foreign_key_violations=${e.foreignKeyViolations.length}`,
        buttons: t ? ["Restore latest backup", "Exit"] : ["Exit"],
        defaultId: 0,
        cancelId: t ? 1 : 0
      });
      if (!t || n !== 0) {
        P.quit();
        return;
      }
      ft(t);
      const r = Ut();
      if (!r.ok) {
        K.error("Database integrity still failing after restore", r), Ue.showErrorBox(
          "Database Recovery Failed",
          "Restore did not repair database integrity. Please contact support and export diagnostics."
        ), P.quit();
        return;
      }
    }
    xr(), $r(), K.info("Application started", { dbPath: ge() });
  } catch (e) {
    const t = e instanceof Error ? e.message : String(e);
    K.error("Startup failed", { message: t });
    const n = kt(), r = Ue.showMessageBoxSync({
      type: "error",
      title: "Pharmacy POS Startup Failed",
      message: `Startup failed: ${t}`,
      detail: n ? "You can attempt Safe Mode recovery by restoring latest backup, or exit." : "No backup detected. Please export diagnostics and contact support.",
      buttons: n ? ["Restore latest backup", "Exit"] : ["Exit"],
      defaultId: 0,
      cancelId: n ? 1 : 0
    });
    if (n && r === 0)
      try {
        ft(n);
      } catch (o) {
        K.error("Safe mode restore failed", { error: String(o) });
      }
    P.quit();
    return;
  }
  Tu(), pr(), gu();
});

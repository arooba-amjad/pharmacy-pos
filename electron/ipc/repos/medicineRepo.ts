type DbLike = {
  prepare: (sql: string) => {
    all: (...args: unknown[]) => any[];
    get: (...args: unknown[]) => any;
  };
};

export class MedicineRepo {
  private readonly db: DbLike;

  constructor(db: DbLike) {
    this.db = db;
  }

  listActive() {
    return this.db.prepare('SELECT * FROM medicines WHERE is_active = 1 ORDER BY name COLLATE NOCASE').all();
  }

  listBatches() {
    return this.db.prepare('SELECT * FROM batches ORDER BY date(expiry_date) ASC').all();
  }

  byId(id: string) {
    return this.db.prepare('SELECT * FROM medicines WHERE id = ?').get(id);
  }
}

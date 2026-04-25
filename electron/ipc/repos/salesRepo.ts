type DbLike = {
  prepare: (sql: string) => {
    all: (...args: unknown[]) => any[];
    get: (...args: unknown[]) => any;
  };
};

export class SalesRepo {
  private readonly db: DbLike;

  constructor(db: DbLike) {
    this.db = db;
  }

  listSales() {
    return this.db.prepare('SELECT * FROM sales ORDER BY created_at DESC').all();
  }

  saleById(id: string) {
    return this.db.prepare('SELECT * FROM sales WHERE id = ?').get(id);
  }

  saleItems(saleId: string) {
    return this.db.prepare('SELECT * FROM sale_items WHERE sale_id = ? ORDER BY created_at ASC').all(saleId);
  }
}

type TxDb = {
  transaction: <T extends (...args: never[]) => unknown>(fn: T) => T;
};

export function runInTransaction<T>(db: TxDb, operation: () => T): T {
  const tx = db.transaction(operation);
  return tx();
}

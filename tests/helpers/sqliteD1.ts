import type { DatabaseSync } from "node:sqlite";
export function sqliteD1(db: DatabaseSync): D1Database {
  function prepare(sql: string) {
    const entry = {
      sql,
      values: [] as (string | number | null)[],
      bind(...values: (string | number | null)[]) {
        if (values.length > 100) throw new Error("D1 parameter limit");
        entry.values = values;
        return entry;
      },
      async first() {
        return db.prepare(sql).get(...entry.values) ?? null;
      },
      async all() {
        return { success: true, results: db.prepare(sql).all(...entry.values) };
      },
      execute() {
        return { success: true, meta: db.prepare(sql).run(...entry.values) };
      },
      async run() { return entry.execute(); },
    };
    return entry;
  }
  return {
    prepare,
    async batch(entries: ReturnType<typeof prepare>[]) {
      if (entries.length > 50) throw new Error("D1 query limit");
      db.exec("BEGIN");
      try {
        const results = [];
        // D1 serializes transactions; do not yield mid-transaction on this connection.
        for (const entry of entries) results.push(entry.execute());
        db.exec("COMMIT");
        return results;
      } catch (e) {
        db.exec("ROLLBACK");
        throw e;
      }
    },
  } as unknown as D1Database;
}

import Database from "better-sqlite3";
import type { Db } from "../../src/data/db";
import { runMigrations } from "../../src/data/migrations";

/** Adapter `Db` sobre better-sqlite3 em memória, com foreign_keys ligado (como no app). */
export function sqliteDb(): Db & { raw: Database.Database } {
  const raw = new Database(":memory:");
  raw.pragma("foreign_keys = ON");
  return {
    raw,
    async execute(sql, params = []) {
      const r = raw.prepare(sql).run(...(params as never[]));
      return { lastInsertId: Number(r.lastInsertRowid) };
    },
    async select<T>(sql: string, params: unknown[] = []) {
      return raw.prepare(sql).all(...(params as never[])) as T[];
    },
  };
}

export async function migratedDb() {
  const db = sqliteDb();
  await runMigrations(db);
  return db;
}

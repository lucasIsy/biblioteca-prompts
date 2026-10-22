import Database from "@tauri-apps/plugin-sql";
import { browserSql, isTauri } from "./browser";
import { runMigrations } from "./migrations";

/** Interface mínima de acesso ao SQLite; implementada pelo plugin Tauri (app) e por better-sqlite3 (testes). */
export interface Db {
  /** Devolve o rowid do INSERT (vem da mesma conexão; `last_insert_rowid()` em outra chamada pode cair em outra conexão do pool). */
  execute(sql: string, params?: unknown[]): Promise<{ lastInsertId: number }>;
  select<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
}

const DB_URL = "sqlite:library.db";

let instance: Promise<Db> | null = null;

/** Abre o banco do app (uma vez), liga foreign keys e aplica as migrations pendentes. */
export function getDb(): Promise<Db> {
  instance ??= isTauri ? openTauriDb() : openBrowserDb();
  return instance;
}

/** Navegador sem Tauri (`npm run dev`): SQL passa pelo plugin do Vite (better-sqlite3 em `.dev-data/`). */
async function openBrowserDb(): Promise<Db> {
  const db: Db = {
    async execute(sql, params = []) {
      return (await browserSql("execute", sql, params)) as { lastInsertId: number };
    },
    async select<T>(sql: string, params: unknown[] = []) {
      return (await browserSql("select", sql, params)) as T[];
    },
  };
  await runMigrations(db);
  return db;
}

async function openTauriDb(): Promise<Db> {
  const conn = await Database.load(DB_URL);
  const db: Db = {
    async execute(sql, params = []) {
      const r = await conn.execute(sql, params);
      return { lastInsertId: r.lastInsertId ?? 0 };
    },
    select: (sql, params = []) => conn.select(sql, params),
  };
  await db.execute("PRAGMA foreign_keys = ON");
  await runMigrations(db);
  return db;
}

import type { Db } from "./db";

/** Lista ordenada; nunca editar uma migration publicada, só acrescentar. Cada item é uma lista de statements. */
export const MIGRATIONS: string[][] = [
  [
    `CREATE TABLE categories (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       name TEXT NOT NULL UNIQUE COLLATE NOCASE,
       slug TEXT NOT NULL,
       layout TEXT NOT NULL CHECK (layout IN ('gallery','grid')),
       media_kind TEXT CHECK (media_kind IN ('image','video')),
       is_system INTEGER NOT NULL DEFAULT 0,
       position INTEGER NOT NULL DEFAULT 0
     )`,
    `CREATE TABLE subcategories (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
       name TEXT NOT NULL COLLATE NOCASE,
       UNIQUE (category_id, name)
     )`,
    `CREATE TABLE prompts (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       category_id INTEGER REFERENCES categories(id),
       title TEXT NOT NULL,
       markdown TEXT NOT NULL DEFAULT '',
       created_at TEXT NOT NULL,
       updated_at TEXT NOT NULL
     )`,
    `CREATE INDEX idx_prompts_category ON prompts(category_id)`,
    `CREATE TABLE prompt_subcategories (
       prompt_id INTEGER NOT NULL REFERENCES prompts(id) ON DELETE CASCADE,
       subcategory_id INTEGER NOT NULL REFERENCES subcategories(id) ON DELETE CASCADE,
       PRIMARY KEY (prompt_id, subcategory_id)
     )`,
    `CREATE TABLE media (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       prompt_id INTEGER NOT NULL REFERENCES prompts(id) ON DELETE CASCADE,
       kind TEXT NOT NULL CHECK (kind IN ('image','video')),
       thumb_path TEXT NOT NULL,
       display_path TEXT NOT NULL,
       poster_path TEXT,
       mime TEXT NOT NULL,
       width INTEGER,
       height INTEGER,
       bytes INTEGER
     )`,
    `CREATE INDEX idx_media_prompt ON media(prompt_id)`,
    `INSERT INTO categories (name, slug, layout, media_kind, is_system, position) VALUES
       ('Imagens', 'imagens', 'gallery', 'image', 1, 0),
       ('Vídeos', 'videos', 'gallery', 'video', 1, 1),
       ('Sites', 'sites', 'grid', NULL, 0, 2),
       ('Apps', 'apps', 'grid', NULL, 0, 3),
       ('Outros', 'outros', 'grid', NULL, 0, 4)`,
  ],
  [
    `ALTER TABLE media ADD COLUMN fit_zoom REAL NOT NULL DEFAULT 1`,
    `ALTER TABLE media ADD COLUMN fit_x REAL NOT NULL DEFAULT 0.5`,
    `ALTER TABLE media ADD COLUMN fit_y REAL NOT NULL DEFAULT 0.5`,
  ],
];

/**
 * Aplica as migrations pendentes conforme `PRAGMA user_version`.
 * Sem transação explícita: o pool do tauri-plugin-sql não garante a mesma conexão entre chamadas;
 * `user_version` só avança depois que todos os statements da migration rodaram.
 */
export async function runMigrations(db: Db): Promise<void> {
  const [row] = await db.select<{ user_version: number }>("PRAGMA user_version");
  const current = row?.user_version ?? 0;
  for (let v = current; v < MIGRATIONS.length; v++) {
    for (const sql of MIGRATIONS[v]) await db.execute(sql);
    await db.execute(`PRAGMA user_version = ${v + 1}`);
  }
}

import { describe, it, expect } from "vitest";
import { MIGRATIONS, runMigrations } from "../src/data/migrations";
import { migratedDb, sqliteDb } from "./helpers/sqliteDb";
import { createRepository } from "../src/data/repository";

describe("migrations", () => {
  it("aplicam do zero e definem user_version", async () => {
    const db = await migratedDb();
    const [row] = await db.select<{ user_version: number }>("PRAGMA user_version");
    expect(row.user_version).toBe(MIGRATIONS.length);
  });

  it("são idempotentes", async () => {
    const db = await migratedDb();
    await runMigrations(db);
    const [{ n }] = await db.select<{ n: number }>("SELECT COUNT(*) AS n FROM categories");
    expect(n).toBe(5);
  });

  it("fazem seed das 5 categorias", async () => {
    const cats = await createRepository(await migratedDb()).listCategories();
    expect(cats.map((c) => [c.name, c.layout, c.mediaKind, c.isSystem])).toEqual([
      ["Imagens", "gallery", "image", true],
      ["Vídeos", "gallery", "video", true],
      ["Sites", "grid", null, false],
      ["Apps", "grid", null, false],
      ["Outros", "grid", null, false],
    ]);
  });

  it("mantêm foreign_keys ligado", async () => {
    const [row] = await sqliteDb().select<{ foreign_keys: number }>("PRAGMA foreign_keys");
    expect(row.foreign_keys).toBe(1);
  });
});

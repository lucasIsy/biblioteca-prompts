import { describe, it, expect } from "vitest";
import { migratedDb } from "./helpers/sqliteDb";
import { createRepository } from "../src/data/repository";

const setup = async () => {
  const db = await migratedDb();
  return { db, repo: createRepository(db) };
};
const media = { kind: "image" as const, thumbPath: "media/1/thumb.webp", displayPath: "media/1/display.webp", posterPath: null, mime: "image/webp", width: 10, height: 10, bytes: 100 };

describe("repository: prompts e mídia", () => {
  it("cria prompt com subcategorias e lista", async () => {
    const { repo } = await setup();
    const sites = (await repo.listCategories()).find((c) => c.name === "Sites")!;
    const sub = await repo.createSubcategory(sites.id, "Landing");
    const id = await repo.createPrompt({ categoryId: sites.id, title: "T", markdown: "# oi\r\n", subcategoryIds: [sub.id] });
    const [p] = await repo.listPrompts();
    expect(p).toMatchObject({ id, categoryId: sites.id, title: "T", markdown: "# oi\r\n", subcategoryIds: [sub.id] });
  });

  it("anexa e lista mídia só com caminhos", async () => {
    const { repo } = await setup();
    const id = await repo.createPrompt({ categoryId: null, title: "T", markdown: "" });
    await repo.attachMedia(id, media);
    expect(await repo.listMedia(id)).toMatchObject([{ promptId: id, thumbPath: media.thumbPath }]);
  });

  it("deletar prompt apaga mídia por cascade e devolve ids", async () => {
    const { repo, db } = await setup();
    const id = await repo.createPrompt({ categoryId: null, title: "T", markdown: "" });
    await repo.attachMedia(id, media);
    const ids = await repo.deletePrompt(id);
    expect(ids).toHaveLength(1);
    expect(await db.select("SELECT * FROM media")).toEqual([]);
  });

  it("cascades: subcategoria some junto da categoria e vínculos caem", async () => {
    const { repo, db } = await setup();
    const cat = await repo.createCategory("Nova");
    const sub = await repo.createSubcategory(cat.id, "x");
    const id = await repo.createPrompt({ categoryId: cat.id, title: "T", markdown: "", subcategoryIds: [sub.id] });
    await repo.deleteCategory(cat.id, "move");
    expect(await db.select("SELECT * FROM subcategories")).toEqual([]);
    expect(await db.select("SELECT * FROM prompt_subcategories")).toEqual([]);
    expect((await repo.listPrompts()).find((p) => p.id === id)?.categoryId).toBeNull();
  });
});

describe("repository: edição (F6)", () => {
  it("updatePrompt troca dados e substitui subcategorias", async () => {
    const { repo } = await setup();
    const sites = (await repo.listCategories()).find((c) => c.name === "Sites")!;
    const a = await repo.createSubcategory(sites.id, "A");
    const b = await repo.createSubcategory(sites.id, "B");
    const id = await repo.createPrompt({ categoryId: sites.id, title: "T", markdown: "x", subcategoryIds: [a.id] });
    await repo.updatePrompt(id, { categoryId: null, title: "Novo", markdown: "y", subcategoryIds: [b.id, b.id] });
    const [p] = await repo.listPrompts();
    expect(p).toMatchObject({ categoryId: null, title: "Novo", markdown: "y", subcategoryIds: [b.id] });
  });

  it("removeMedia apaga só a linha; listMediaOfCategory lê antes do delete-items", async () => {
    const { repo } = await setup();
    const sites = (await repo.listCategories()).find((c) => c.name === "Sites")!;
    const cat = await repo.createCategory("Minha");
    const id = await repo.createPrompt({ categoryId: cat.id, title: "T", markdown: "" });
    await repo.attachMedia(id, media);
    await repo.attachMedia(id, { ...media, thumbPath: "media/2/thumb.webp" });
    const other = await repo.createPrompt({ categoryId: sites.id, title: "O", markdown: "" });
    await repo.attachMedia(other, media);
    const mine = await repo.listMediaOfCategory(cat.id);
    expect(mine.map((m) => m.thumbPath)).toEqual([media.thumbPath, "media/2/thumb.webp"]);
    await repo.removeMedia(mine[0].id);
    expect(await repo.listMedia(id)).toHaveLength(1);
    expect(await repo.listMedia(other)).toHaveLength(1);
  });
});


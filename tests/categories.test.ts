import { describe, it, expect } from "vitest";
import { migratedDb } from "./helpers/sqliteDb";
import { CategoryNotEmptyError, DuplicateNameError, SystemCategoryError, createRepository } from "../src/data/repository";

const setup = async () => {
  const db = await migratedDb();
  return { db, repo: createRepository(db) };
};
const media = { kind: "image" as const, thumbPath: "t", displayPath: "d", posterPath: null, mime: "image/webp", width: 1, height: 1, bytes: 1 };

describe("categorias", () => {
  it("cria categoria nova como grade sem media_kind", async () => {
    const { repo } = await setup();
    expect(await repo.createCategory("  Música ")).toMatchObject({ name: "Música", layout: "grid", mediaKind: null, isSystem: false, slug: "musica" });
  });

  it("rejeita nome duplicado (caixa e acento)", async () => {
    const { repo } = await setup();
    await repo.createCategory("Música");
    await expect(repo.createCategory("musica")).rejects.toBeInstanceOf(DuplicateNameError);
    await expect(repo.createCategory("MÚSICA")).rejects.toBeInstanceOf(DuplicateNameError);
    await expect(repo.createCategory("videos")).rejects.toBeInstanceOf(DuplicateNameError);
  });

  it("renomeia, inclusive só trocando a caixa, e rejeita nome existente", async () => {
    const { repo } = await setup();
    const c = await repo.createCategory("Música");
    await repo.renameCategory(c.id, "MÚSICA");
    await expect(repo.renameCategory(c.id, "Sites")).rejects.toBeInstanceOf(DuplicateNameError);
    expect((await repo.listCategories()).find((x) => x.id === c.id)?.name).toBe("MÚSICA");
  });

  it("renomear Imagens mantém media_kind e is_system", async () => {
    const { repo } = await setup();
    const img = (await repo.listCategories())[0];
    await repo.renameCategory(img.id, "Fotos");
    expect((await repo.listCategories())[0]).toMatchObject({ name: "Fotos", mediaKind: "image", isSystem: true });
  });

  it("categoria de sistema não pode ser deletada", async () => {
    const { repo } = await setup();
    const img = (await repo.listCategories())[0];
    await expect(repo.deleteCategory(img.id, "delete-items")).rejects.toBeInstanceOf(SystemCategoryError);
  });

  describe("deletar com itens", () => {
    const withItems = async () => {
      const ctx = await setup();
      const cat = await ctx.repo.createCategory("Nova");
      await ctx.repo.createSubcategory(cat.id, "s");
      const pid = await ctx.repo.createPrompt({ categoryId: cat.id, title: "T", markdown: "" });
      await ctx.repo.attachMedia(pid, media);
      return { ...ctx, cat, pid };
    };

    it("block lança CategoryNotEmptyError e nada muda", async () => {
      const { repo, cat } = await withItems();
      await expect(repo.deleteCategory(cat.id, "block")).rejects.toBeInstanceOf(CategoryNotEmptyError);
      await expect(repo.deleteCategory(cat.id)).rejects.toBeInstanceOf(CategoryNotEmptyError);
      expect(await repo.listPrompts()).toHaveLength(1);
    });

    it("delete-items apaga prompts e devolve ids de mídia", async () => {
      const { repo, cat, db } = await withItems();
      const ids = await repo.deleteCategory(cat.id, "delete-items");
      expect(ids).toHaveLength(1);
      expect(await repo.listPrompts()).toEqual([]);
      expect(await db.select("SELECT * FROM media")).toEqual([]);
    });

    it("move deixa prompts sem categoria e mantém a mídia", async () => {
      const { repo, cat, pid } = await withItems();
      expect(await repo.deleteCategory(cat.id, "move")).toEqual([]);
      expect(await repo.listPrompts()).toMatchObject([{ id: pid, categoryId: null }]);
      expect(await repo.listMedia(pid)).toHaveLength(1);
    });

    it("categoria vazia é deletada em qualquer estratégia", async () => {
      const { repo } = await setup();
      const c = await repo.createCategory("Vazia");
      await repo.deleteCategory(c.id, "block");
      expect((await repo.listCategories()).some((x) => x.id === c.id)).toBe(false);
    });
  });
});

describe("subcategorias", () => {
  it("CRUD por categoria, duplicata só dentro da mesma categoria", async () => {
    const { repo } = await setup();
    const [img, vid] = await repo.listCategories();
    const a = await repo.createSubcategory(img.id, "Retrato");
    await expect(repo.createSubcategory(img.id, "retrato")).rejects.toBeInstanceOf(DuplicateNameError);
    await repo.createSubcategory(vid.id, "Retrato");
    const b = await repo.createSubcategory(img.id, "Paisagem");
    await repo.renameSubcategory(a.id, "RETRATO");
    await expect(repo.renameSubcategory(a.id, "paisagem")).rejects.toBeInstanceOf(DuplicateNameError);
    expect((await repo.listSubcategories(img.id)).map((s) => s.name)).toEqual(["Paisagem", "RETRATO"]);
    await repo.deleteSubcategory(b.id);
    expect(await repo.listSubcategories(img.id)).toHaveLength(1);
  });

  it("deletar subcategoria só desvincula o prompt", async () => {
    const { repo } = await setup();
    const [img] = await repo.listCategories();
    const s = await repo.createSubcategory(img.id, "x");
    const pid = await repo.createPrompt({ categoryId: img.id, title: "T", markdown: "", subcategoryIds: [s.id] });
    await repo.deleteSubcategory(s.id);
    expect(await repo.listPrompts()).toMatchObject([{ id: pid, subcategoryIds: [] }]);
  });
});

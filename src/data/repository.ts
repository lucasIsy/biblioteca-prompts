import type { Db } from "./db";
import { normalize } from "../domain/text";
import { slugify } from "../domain/categories";
import { clampFraming } from "../domain/media";
import type { Framing } from "../domain/media";

export type Layout = "gallery" | "grid";
export type MediaKind = "image" | "video";
export type DeleteStrategy = "delete-items" | "move" | "block";

export interface Category {
  id: number;
  name: string;
  slug: string;
  layout: Layout;
  mediaKind: MediaKind | null;
  isSystem: boolean;
  position: number;
}

export interface Subcategory {
  id: number;
  categoryId: number;
  name: string;
}

export interface Prompt {
  id: number;
  categoryId: number | null;
  title: string;
  markdown: string;
  createdAt: string;
  updatedAt: string;
  subcategoryIds: number[];
}

export interface Media {
  id: number;
  promptId: number;
  kind: MediaKind;
  thumbPath: string;
  displayPath: string;
  posterPath: string | null;
  mime: string;
  width: number | null;
  height: number | null;
  bytes: number | null;
  fitZoom: number;
  fitX: number;
  fitY: number;
}

export type NewMedia = Omit<Media, "id" | "promptId" | keyof Framing> & Partial<Framing>;

export class DuplicateNameError extends Error {
  constructor(name: string) {
    super(`Já existe um item com o nome "${name}".`);
    this.name = "DuplicateNameError";
  }
}
export class SystemCategoryError extends Error {
  constructor() {
    super("Categorias de sistema não podem ser deletadas.");
    this.name = "SystemCategoryError";
  }
}
export class CategoryNotEmptyError extends Error {
  constructor(public readonly promptCount: number) {
    super(`A categoria tem ${promptCount} prompt(s).`);
    this.name = "CategoryNotEmptyError";
  }
}

interface CategoryRow { id: number; name: string; slug: string; layout: Layout; media_kind: MediaKind | null; is_system: number; position: number }
interface SubRow { id: number; category_id: number; name: string }
interface PromptRow { id: number; category_id: number | null; title: string; markdown: string; created_at: string; updated_at: string }
interface MediaRow { id: number; prompt_id: number; kind: MediaKind; thumb_path: string; display_path: string; poster_path: string | null; mime: string; width: number | null; height: number | null; bytes: number | null; fit_zoom: number; fit_x: number; fit_y: number }

const toCategory = (r: CategoryRow): Category => ({
  id: r.id, name: r.name, slug: r.slug, layout: r.layout, mediaKind: r.media_kind, isSystem: r.is_system === 1, position: r.position,
});
const toSub = (r: SubRow): Subcategory => ({ id: r.id, categoryId: r.category_id, name: r.name });
const toMedia = (r: MediaRow): Media => ({
  id: r.id, promptId: r.prompt_id, kind: r.kind, thumbPath: r.thumb_path, displayPath: r.display_path,
  posterPath: r.poster_path, mime: r.mime, width: r.width, height: r.height, bytes: r.bytes,
  fitZoom: r.fit_zoom, fitX: r.fit_x, fitY: r.fit_y,
});

export function createRepository(db: Db) {
  async function assertUniqueCategory(name: string, exceptId?: number) {
    const rows = await db.select<{ id: number; name: string }>("SELECT id, name FROM categories");
    const n = normalize(name);
    if (rows.some((r) => r.id !== exceptId && normalize(r.name) === n)) throw new DuplicateNameError(name);
  }

  async function assertUniqueSub(categoryId: number, name: string, exceptId?: number) {
    const rows = await db.select<{ id: number; name: string }>(
      "SELECT id, name FROM subcategories WHERE category_id = ?", [categoryId]);
    const n = normalize(name);
    if (rows.some((r) => r.id !== exceptId && normalize(r.name) === n)) throw new DuplicateNameError(name);
  }

  async function mediaIdsOfCategory(categoryId: number): Promise<number[]> {
    const rows = await db.select<{ id: number }>(
      "SELECT m.id FROM media m JOIN prompts p ON p.id = m.prompt_id WHERE p.category_id = ?", [categoryId]);
    return rows.map((r) => r.id);
  }

  async function setPromptSubcategories(promptId: number, subcategoryIds: number[]): Promise<void> {
    await db.execute("DELETE FROM prompt_subcategories WHERE prompt_id = ?", [promptId]);
    for (const sid of new Set(subcategoryIds)) {
      await db.execute("INSERT INTO prompt_subcategories (prompt_id, subcategory_id) VALUES (?, ?)", [promptId, sid]);
    }
  }

  return {
    // ---- categorias ----
    async listCategories(): Promise<Category[]> {
      const rows = await db.select<CategoryRow>("SELECT * FROM categories ORDER BY position, id");
      return rows.map(toCategory);
    },

    /** Categoria nova sempre nasce grade, sem media_kind. */
    async createCategory(name: string): Promise<Category> {
      const clean = name.trim();
      await assertUniqueCategory(clean);
      const [{ next }] = await db.select<{ next: number }>("SELECT COALESCE(MAX(position), -1) + 1 AS next FROM categories");
      await db.execute(
        "INSERT INTO categories (name, slug, layout, media_kind, is_system, position) VALUES (?, ?, 'grid', NULL, 0, ?)",
        [clean, slugify(clean), next]);
      const [row] = await db.select<CategoryRow>("SELECT * FROM categories WHERE name = ?", [clean]);
      return toCategory(row);
    },

    /** Renomear não muda media_kind nem is_system. */
    async renameCategory(id: number, name: string): Promise<void> {
      const clean = name.trim();
      await assertUniqueCategory(clean, id);
      await db.execute("UPDATE categories SET name = ?, slug = ? WHERE id = ?", [clean, slugify(clean), id]);
    },

    /** Devolve ids de mídia dos prompts apagados (para `media.deleteFiles`); vazio nas demais estratégias. */
    async deleteCategory(id: number, strategy: DeleteStrategy = "block"): Promise<number[]> {
      const [cat] = await db.select<CategoryRow>("SELECT * FROM categories WHERE id = ?", [id]);
      if (!cat) return [];
      if (cat.is_system === 1) throw new SystemCategoryError();
      const [{ n }] = await db.select<{ n: number }>("SELECT COUNT(*) AS n FROM prompts WHERE category_id = ?", [id]);
      let mediaIds: number[] = [];
      if (n > 0) {
        if (strategy === "block") throw new CategoryNotEmptyError(n);
        if (strategy === "move") {
          await db.execute("UPDATE prompts SET category_id = NULL WHERE category_id = ?", [id]);
        } else {
          mediaIds = await mediaIdsOfCategory(id);
          await db.execute("DELETE FROM prompts WHERE category_id = ?", [id]);
        }
      }
      await db.execute("DELETE FROM categories WHERE id = ?", [id]);
      return mediaIds;
    },

    // ---- subcategorias ----
    async listSubcategories(categoryId: number): Promise<Subcategory[]> {
      const rows = await db.select<SubRow>("SELECT * FROM subcategories WHERE category_id = ? ORDER BY name", [categoryId]);
      return rows.map(toSub);
    },

    async createSubcategory(categoryId: number, name: string): Promise<Subcategory> {
      const clean = name.trim();
      await assertUniqueSub(categoryId, clean);
      await db.execute("INSERT INTO subcategories (category_id, name) VALUES (?, ?)", [categoryId, clean]);
      const [row] = await db.select<SubRow>("SELECT * FROM subcategories WHERE category_id = ? AND name = ?", [categoryId, clean]);
      return toSub(row);
    },

    async renameSubcategory(id: number, name: string): Promise<void> {
      const clean = name.trim();
      const [sub] = await db.select<SubRow>("SELECT * FROM subcategories WHERE id = ?", [id]);
      if (!sub) return;
      await assertUniqueSub(sub.category_id, clean, id);
      await db.execute("UPDATE subcategories SET name = ? WHERE id = ?", [clean, id]);
    },

    /** Só desvincula (cascade em prompt_subcategories); os prompts permanecem. */
    async deleteSubcategory(id: number): Promise<void> {
      await db.execute("DELETE FROM subcategories WHERE id = ?", [id]);
    },

    // ---- prompts ----
    /** `createdAt`/`updatedAt` só são informados ao importar um backup (preserva as datas originais). */
    async createPrompt(input: {
      categoryId: number | null; title: string; markdown: string; subcategoryIds?: number[];
      createdAt?: string; updatedAt?: string;
    }): Promise<number> {
      const now = new Date().toISOString();
      const { lastInsertId: id } = await db.execute(
        "INSERT INTO prompts (category_id, title, markdown, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
        [input.categoryId, input.title, input.markdown, input.createdAt ?? now, input.updatedAt ?? input.createdAt ?? now]);
      for (const sid of input.subcategoryIds ?? []) {
        await db.execute("INSERT INTO prompt_subcategories (prompt_id, subcategory_id) VALUES (?, ?)", [id, sid]);
      }
      return id;
    },

    async listPrompts(): Promise<Prompt[]> {
      const rows = await db.select<PromptRow>("SELECT * FROM prompts ORDER BY created_at DESC, id DESC");
      const links = await db.select<{ prompt_id: number; subcategory_id: number }>("SELECT * FROM prompt_subcategories");
      return rows.map((r) => ({
        id: r.id, categoryId: r.category_id, title: r.title, markdown: r.markdown,
        createdAt: r.created_at, updatedAt: r.updated_at,
        subcategoryIds: links.filter((l) => l.prompt_id === r.id).map((l) => l.subcategory_id),
      }));
    },

    async updatePrompt(id: number, input: { categoryId: number | null; title: string; markdown: string; subcategoryIds: number[] }): Promise<void> {
      await db.execute(
        "UPDATE prompts SET category_id = ?, title = ?, markdown = ?, updated_at = ? WHERE id = ?",
        [input.categoryId, input.title, input.markdown, new Date().toISOString(), id]);
      await setPromptSubcategories(id, input.subcategoryIds);
    },

    setPromptSubcategories,

    async deletePrompt(id: number): Promise<number[]> {
      const ids = (await db.select<{ id: number }>("SELECT id FROM media WHERE prompt_id = ?", [id])).map((r) => r.id);
      await db.execute("DELETE FROM prompts WHERE id = ?", [id]);
      return ids;
    },

    // ---- mídia (só caminhos relativos e metadados) ----
    async attachMedia(promptId: number, m: NewMedia): Promise<void> {
      const f = clampFraming(m);
      await db.execute(
        `INSERT INTO media (prompt_id, kind, thumb_path, display_path, poster_path, mime, width, height, bytes, fit_zoom, fit_x, fit_y)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [promptId, m.kind, m.thumbPath, m.displayPath, m.posterPath, m.mime, m.width, m.height, m.bytes, f.fitZoom, f.fitX, f.fitY]);
    },

    async updateMediaFraming(id: number, framing: Partial<Framing>): Promise<void> {
      const f = clampFraming(framing);
      await db.execute("UPDATE media SET fit_zoom = ?, fit_x = ?, fit_y = ? WHERE id = ?", [f.fitZoom, f.fitX, f.fitY, id]);
    },

    /** Primeira mídia de cada prompt (capa da grade), indexada por prompt. */
    async listCovers(): Promise<Map<number, Media>> {
      const rows = await db.select<MediaRow>(
        "SELECT m.* FROM media m WHERE m.id = (SELECT MIN(id) FROM media WHERE prompt_id = m.prompt_id)");
      return new Map(rows.map((r) => [r.prompt_id, toMedia(r)]));
    },

    /** Remove só a linha; quem chama apaga os arquivos (`media.deleteFiles`). */
    async removeMedia(id: number): Promise<void> {
      await db.execute("DELETE FROM media WHERE id = ?", [id]);
    },

    /** Mídia dos prompts da categoria; ler ANTES de `deleteCategory(…, "delete-items")` para apagar os arquivos. */
    async listMediaOfCategory(categoryId: number): Promise<Media[]> {
      const rows = await db.select<MediaRow>(
        "SELECT m.* FROM media m JOIN prompts p ON p.id = m.prompt_id WHERE p.category_id = ? ORDER BY m.id", [categoryId]);
      return rows.map(toMedia);
    },

    async listMedia(promptId: number): Promise<Media[]> {
      const rows = await db.select<MediaRow>("SELECT * FROM media WHERE prompt_id = ? ORDER BY id", [promptId]);
      return rows.map(toMedia);
    },
  };
}

export type Repository = ReturnType<typeof createRepository>;

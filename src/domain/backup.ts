import { normalize } from "./text";

export const BACKUP_FORMAT = "biblioteca-prompts";
export const BACKUP_VERSION = 1;

export interface ManifestMedia {
  kind: "image" | "video";
  thumb: string;
  display: string;
  poster: string | null;
  mime: string;
  width: number | null;
  height: number | null;
  bytes: number | null;
  /** enquadramento da capa; ausente em backups antigos */
  fitZoom?: number;
  fitX?: number;
  fitY?: number;
}

export interface ManifestPrompt {
  title: string;
  markdown: string;
  category: string | null;
  subcategories: string[];
  createdAt: string;
  updatedAt: string;
  media: ManifestMedia[];
}

export interface Manifest {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: string;
  categories: { name: string; subcategories: string[] }[];
  prompts: ManifestPrompt[];
}

export class BackupFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BackupFormatError";
  }
}

// ---- exportar ----

interface CatIn { id: number; name: string }
interface SubIn { id: number; categoryId: number; name: string }
interface MediaIn {
  kind: "image" | "video"; thumbPath: string; displayPath: string; posterPath: string | null;
  mime: string; width: number | null; height: number | null; bytes: number | null;
  fitZoom: number; fitX: number; fitY: number;
}
interface PromptIn {
  id: number; categoryId: number | null; title: string; markdown: string;
  createdAt: string; updatedAt: string; subcategoryIds: number[];
}

export interface ExportSelection {
  categoryIds: number[];
  includeUncategorized: boolean;
}

/** Monta o manifest só com as categorias escolhidas; `mediaPaths` lista os arquivos a empacotar. */
export function buildManifest(
  input: { categories: CatIn[]; subcategories: SubIn[]; prompts: PromptIn[]; mediaByPrompt: Map<number, MediaIn[]> },
  selection: ExportSelection,
  exportedAt: string,
): { manifest: Manifest; mediaPaths: string[] } {
  const chosen = new Set(selection.categoryIds);
  const catName = new Map(input.categories.map((c) => [c.id, c.name]));
  const subName = new Map(input.subcategories.map((s) => [s.id, s.name]));
  const mediaPaths = new Set<string>();

  const prompts: ManifestPrompt[] = input.prompts
    .filter((p) => (p.categoryId === null ? selection.includeUncategorized : chosen.has(p.categoryId)))
    .map((p) => {
      const media = (input.mediaByPrompt.get(p.id) ?? []).map((m): ManifestMedia => {
        for (const path of [m.thumbPath, m.displayPath, m.posterPath]) if (path) mediaPaths.add(path);
        return {
          kind: m.kind, thumb: m.thumbPath, display: m.displayPath, poster: m.posterPath,
          mime: m.mime, width: m.width, height: m.height, bytes: m.bytes,
          fitZoom: m.fitZoom, fitX: m.fitX, fitY: m.fitY,
        };
      });
      return {
        title: p.title, markdown: p.markdown,
        category: p.categoryId === null ? null : catName.get(p.categoryId) ?? null,
        subcategories: p.subcategoryIds.map((id) => subName.get(id)).filter((n): n is string => !!n),
        createdAt: p.createdAt, updatedAt: p.updatedAt, media,
      };
    });

  const categories = input.categories
    .filter((c) => chosen.has(c.id))
    .map((c) => ({
      name: c.name,
      subcategories: input.subcategories.filter((s) => s.categoryId === c.id).map((s) => s.name),
    }));

  return {
    manifest: { format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt, categories, prompts },
    mediaPaths: [...mediaPaths],
  };
}

// ---- importar ----

/** Só `media/<pasta>/<arquivo>.webp|mp4|webm`, sem `..`, barra invertida ou caminho absoluto. */
export function isSafeMediaPath(p: unknown): p is string {
  return typeof p === "string" && /^media\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+\.(webp|mp4|webm)$/.test(p);
}

const isStr = (v: unknown): v is string => typeof v === "string";
const isNumOrNull = (v: unknown) => v === null || (typeof v === "number" && Number.isFinite(v));

/** Valida o JSON do manifest; lança `BackupFormatError` com mensagem em PT. */
export function parseManifest(text: string): Manifest {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new BackupFormatError("O manifest do arquivo não é um JSON válido.");
  }
  const m = raw as Partial<Manifest> | null;
  if (!m || typeof m !== "object" || m.format !== BACKUP_FORMAT) {
    throw new BackupFormatError("Este .zip não é um backup da Biblioteca de Prompts.");
  }
  if (typeof m.version !== "number" || m.version > BACKUP_VERSION) {
    throw new BackupFormatError("Backup de uma versão mais nova do app. Atualize o programa para importar.");
  }
  if (!Array.isArray(m.prompts) || !Array.isArray(m.categories)) {
    throw new BackupFormatError("Backup incompleto: faltam prompts ou categorias.");
  }
  for (const c of m.categories) {
    if (!c || !isStr(c.name) || !c.name.trim() || !Array.isArray(c.subcategories) || !c.subcategories.every(isStr)) {
      throw new BackupFormatError("Backup com categoria inválida.");
    }
  }
  for (const p of m.prompts) {
    const ok = p && isStr(p.title) && isStr(p.markdown) && (p.category === null || isStr(p.category))
      && Array.isArray(p.subcategories) && p.subcategories.every(isStr)
      && isStr(p.createdAt) && isStr(p.updatedAt) && Array.isArray(p.media);
    if (!ok) throw new BackupFormatError("Backup com prompt inválido.");
    for (const md of p.media) {
      const good = md && (md.kind === "image" || md.kind === "video") && isStr(md.mime)
        && isSafeMediaPath(md.thumb) && isSafeMediaPath(md.display) && (md.poster === null || isSafeMediaPath(md.poster))
        && isNumOrNull(md.width) && isNumOrNull(md.height) && isNumOrNull(md.bytes);
      if (!good) throw new BackupFormatError(`Mídia inválida ou caminho inseguro no prompt "${p.title}".`);
    }
  }
  return m as Manifest;
}

export interface ExistingLibrary {
  categories: { id: number; name: string }[];
  subcategories: { categoryId: number; name: string }[];
  prompts: { categoryId: number | null; title: string; markdown: string }[];
}

export interface ImportPlan {
  /** Categorias do backup que não existem aqui (nome original). */
  newCategories: string[];
  /** Subcategorias a criar, por nome de categoria (null não tem subcategoria). */
  newSubcategories: { category: string; name: string }[];
  /** Prompts a criar e quantos já existiam. */
  toImport: ManifestPrompt[];
  skipped: number;
}

const dupKey = (category: string | null, title: string, markdown: string) =>
  `${category === null ? "" : normalize(category)}\u0000${normalize(title)}\u0000${markdown.trim()}`;

/** Casa nomes sem acento/caixa; pula prompt idêntico (mesma categoria, título e markdown). */
export function planImport(manifest: Manifest, existing: ExistingLibrary): ImportPlan {
  const catById = new Map(existing.categories.map((c) => [c.id, c.name]));
  const known = new Set(existing.categories.map((c) => normalize(c.name)));
  const subKeys = new Set(existing.subcategories.map((s) => `${normalize(catById.get(s.categoryId) ?? "")}\u0000${normalize(s.name)}`));
  const seen = new Set(existing.prompts.map((p) =>
    dupKey(p.categoryId === null ? null : catById.get(p.categoryId) ?? null, p.title, p.markdown)));

  const newCategories: string[] = [];
  const newSubcategories: { category: string; name: string }[] = [];
  const noteCategory = (name: string) => {
    const n = normalize(name);
    if (!known.has(n)) { known.add(n); newCategories.push(name); }
  };
  const noteSub = (category: string, name: string) => {
    const key = `${normalize(category)}\u0000${normalize(name)}`;
    if (!subKeys.has(key)) { subKeys.add(key); newSubcategories.push({ category, name }); }
  };

  for (const c of manifest.categories) {
    noteCategory(c.name);
    for (const s of c.subcategories) noteSub(c.name, s);
  }

  const toImport: ManifestPrompt[] = [];
  let skipped = 0;
  for (const p of manifest.prompts) {
    const key = dupKey(p.category, p.title, p.markdown);
    if (seen.has(key)) { skipped++; continue; }
    seen.add(key);
    if (p.category !== null) {
      noteCategory(p.category);
      for (const s of p.subcategories) noteSub(p.category, s);
    }
    toImport.push(p);
  }
  return { newCategories, newSubcategories, toImport, skipped };
}

/** Nome sugerido do arquivo de backup, ex.: `biblioteca-2026-10-22.zip`. */
export function backupFileName(date: Date): string {
  return `biblioteca-${date.toISOString().slice(0, 10)}.zip`;
}

import {
  backupFileName, buildManifest, parseManifest, planImport,
  type ExportSelection, type ManifestPrompt,
} from "../domain/backup";
import { normalize } from "../domain/text";
import type { BackupFiles } from "./media";
import type { Media, Repository } from "./repository";

export type { ExportSelection };
export { backupFileName };

const enc = new TextEncoder();
const dec = new TextDecoder();
const baseName = (p: string) => p.slice(p.lastIndexOf("/") + 1);

/** Conteúdo do .zip: `manifest.json` + `media/<pasta>/<arquivo>`. Quem chama grava o arquivo. */
export async function exportLibrary(
  repo: Repository, files: BackupFiles, selection: ExportSelection, now = new Date(),
): Promise<{ files: Record<string, Uint8Array>; promptCount: number }> {
  const [categories, prompts] = await Promise.all([repo.listCategories(), repo.listPrompts()]);
  const subcategories = (await Promise.all(categories.map((c) => repo.listSubcategories(c.id)))).flat();
  const mediaByPrompt = new Map<number, Media[]>();
  for (const p of prompts) mediaByPrompt.set(p.id, await repo.listMedia(p.id));

  const { manifest, mediaPaths } = buildManifest(
    { categories, subcategories, prompts, mediaByPrompt }, selection, now.toISOString());

  const out: Record<string, Uint8Array> = { "manifest.json": enc.encode(JSON.stringify(manifest, null, 2)) };
  for (const path of mediaPaths) out[path] = await files.readMedia(path);
  return { files: out, promptCount: manifest.prompts.length };
}

export interface ImportResult {
  imported: number;
  skipped: number;
  createdCategories: number;
  errors: string[];
}

/** Mescla o backup na biblioteca: cria o que falta, pula prompts idênticos, nunca apaga nada. */
export async function importLibrary(
  repo: Repository, files: BackupFiles, archive: Record<string, Uint8Array>,
): Promise<ImportResult> {
  const manifestBytes = archive["manifest.json"];
  if (!manifestBytes) throw new Error("Este .zip não é um backup da Biblioteca de Prompts (sem manifest.json).");
  const manifest = parseManifest(dec.decode(manifestBytes));

  const [categories, prompts] = await Promise.all([repo.listCategories(), repo.listPrompts()]);
  const subcategories = (await Promise.all(categories.map((c) => repo.listSubcategories(c.id)))).flat();
  const plan = planImport(manifest, { categories, subcategories, prompts });

  const catIds = new Map(categories.map((c) => [normalize(c.name), c.id]));
  for (const name of plan.newCategories) catIds.set(normalize(name), (await repo.createCategory(name)).id);

  const subIds = new Map(subcategories.map((s) => {
    const cat = categories.find((c) => c.id === s.categoryId)!;
    return [`${normalize(cat.name)}\u0000${normalize(s.name)}`, s.id] as const;
  }));
  for (const { category, name } of plan.newSubcategories) {
    const categoryId = catIds.get(normalize(category))!;
    subIds.set(`${normalize(category)}\u0000${normalize(name)}`, (await repo.createSubcategory(categoryId, name)).id);
  }

  const result: ImportResult = { imported: 0, skipped: plan.skipped, createdCategories: plan.newCategories.length, errors: [] };
  for (const p of plan.toImport) {
    try {
      await importPrompt(repo, files, archive, p, catIds, subIds);
      result.imported++;
    } catch (e) {
      result.errors.push(`"${p.title}": ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return result;
}

async function importPrompt(
  repo: Repository, files: BackupFiles, archive: Record<string, Uint8Array>, p: ManifestPrompt,
  catIds: Map<string, number>, subIds: Map<string, number>,
) {
  // Confere os arquivos antes de criar qualquer coisa.
  for (const m of p.media) {
    for (const path of [m.thumb, m.display, m.poster]) {
      if (path && !archive[path]) throw new Error(`arquivo ausente no .zip (${path})`);
    }
  }
  const catKey = p.category === null ? null : normalize(p.category);
  const subcategoryIds = catKey === null ? [] : p.subcategories
    .map((s) => subIds.get(`${catKey}\u0000${normalize(s)}`))
    .filter((id): id is number => id !== undefined);

  const saved: { m: ManifestPrompt["media"][number]; thumb: string; display: string; poster: string | null }[] = [];
  try {
    for (const m of p.media) {
      const group: Record<string, Uint8Array> = {};
      for (const path of [m.thumb, m.display, m.poster]) if (path) group[baseName(path)] = archive[path];
      const rel = await files.saveMedia(group);
      saved.push({ m, thumb: rel[baseName(m.thumb)], display: rel[baseName(m.display)], poster: m.poster ? rel[baseName(m.poster)] : null });
    }
    const id = await repo.createPrompt({
      categoryId: catKey === null ? null : catIds.get(catKey) ?? null,
      title: p.title, markdown: p.markdown, subcategoryIds,
      createdAt: p.createdAt, updatedAt: p.updatedAt,
    });
    for (const s of saved) {
      await repo.attachMedia(id, {
        kind: s.m.kind, thumbPath: s.thumb, displayPath: s.display, posterPath: s.poster,
        mime: s.m.mime, width: s.m.width, height: s.m.height, bytes: s.m.bytes,
      });
    }
  } catch (e) {
    await files.deleteFiles(saved.flatMap((s) => [s.thumb, s.display, s.poster].filter((x): x is string => !!x)));
    throw e;
  }
}

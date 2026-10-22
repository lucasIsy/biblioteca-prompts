import { describe, expect, it } from "vitest";
import { exportLibrary, importLibrary } from "../src/data/backup";
import type { BackupFiles } from "../src/data/media";
import { createRepository } from "../src/data/repository";
import { BackupFormatError, isSafeMediaPath, parseManifest } from "../src/domain/backup";
import { migratedDb } from "./helpers/sqliteDb";

/** Disco em memória: caminho relativo → bytes. */
function memFiles(disk = new Map<string, Uint8Array>()): BackupFiles & { disk: Map<string, Uint8Array> } {
  let n = 0;
  return {
    disk,
    async readMedia(rel) {
      const b = disk.get(rel);
      if (!b) throw new Error("ausente " + rel);
      return b;
    },
    async saveMedia(files) {
      const folder = `media/novo${++n}`;
      const out: Record<string, string> = {};
      for (const [name, bytes] of Object.entries(files)) { out[name] = `${folder}/${name}`; disk.set(out[name], bytes); }
      return out;
    },
    async deleteFiles(paths) {
      for (const p of paths) for (const k of [...disk.keys()]) if (k === p || k.startsWith(p + "/")) disk.delete(k);
    },
  };
}

async function seededSource() {
  const repo = createRepository(await migratedDb());
  const files = memFiles();
  const cats = await repo.listCategories();
  const imagens = cats.find((c) => c.name === "Imagens")!;
  const sites = cats.find((c) => c.name === "Sites")!;
  const sub = await repo.createSubcategory(sites.id, "Landing");
  const custom = await repo.createCategory("Músicas");

  const pImg = await repo.createPrompt({ categoryId: imagens.id, title: "Gato", markdown: "# gato\n`x`", createdAt: "2026-01-01T00:00:00.000Z" });
  files.disk.set("media/aaa/thumb.webp", new Uint8Array([1]));
  files.disk.set("media/aaa/display.webp", new Uint8Array([2, 2]));
  await repo.attachMedia(pImg, { kind: "image", thumbPath: "media/aaa/thumb.webp", displayPath: "media/aaa/display.webp", posterPath: null, mime: "image/webp", width: 10, height: 5, bytes: 2 });

  await repo.createPrompt({ categoryId: sites.id, title: "Landing", markdown: "texto", subcategoryIds: [sub.id] });
  await repo.createPrompt({ categoryId: custom.id, title: "Música", markdown: "m" });
  await repo.createPrompt({ categoryId: null, title: "Solto", markdown: "s" });
  return { repo, files, imagens, sites, custom };
}

describe("backup: exportar e importar", () => {
  it("exporta só as categorias escolhidas", async () => {
    const { repo, files, imagens, sites } = await seededSource();
    const out = await exportLibrary(repo, files, { categoryIds: [imagens.id, sites.id], includeUncategorized: false });
    expect(out.promptCount).toBe(2);
    expect(Object.keys(out.files).sort()).toEqual(["manifest.json", "media/aaa/display.webp", "media/aaa/thumb.webp"]);
  });

  it("restaura numa biblioteca nova e não duplica ao importar de novo", async () => {
    const src = await seededSource();
    const all = (await src.repo.listCategories()).map((c) => c.id);
    const { files: archive } = await exportLibrary(src.repo, src.files, { categoryIds: all, includeUncategorized: true });

    const dest = createRepository(await migratedDb());
    const destFiles = memFiles();
    const r1 = await importLibrary(dest, destFiles, archive);
    expect(r1).toMatchObject({ imported: 4, skipped: 0, createdCategories: 1, errors: [] });

    const cats = await dest.listCategories();
    const prompts = await dest.listPrompts();
    expect(prompts.map((p) => p.title).sort()).toEqual(["Gato", "Landing", "Música", "Solto"]);
    const gato = prompts.find((p) => p.title === "Gato")!;
    expect(gato.markdown).toBe("# gato\n`x`");
    expect(gato.createdAt).toBe("2026-01-01T00:00:00.000Z");
    expect(gato.categoryId).toBe(cats.find((c) => c.name === "Imagens")!.id);
    const [media] = await dest.listMedia(gato.id);
    expect(media.displayPath).toMatch(/^media\/novo\d+\/display\.webp$/);
    expect([...destFiles.disk.get(media.displayPath)!]).toEqual([2, 2]);
    const landing = prompts.find((p) => p.title === "Landing")!;
    const sites = cats.find((c) => c.name === "Sites")!;
    expect((await dest.listSubcategories(sites.id)).map((s) => s.name)).toEqual(["Landing"]);
    expect(landing.subcategoryIds).toHaveLength(1);
    expect(prompts.find((p) => p.title === "Solto")!.categoryId).toBeNull();

    const r2 = await importLibrary(dest, destFiles, archive);
    expect(r2).toMatchObject({ imported: 0, skipped: 4, createdCategories: 0 });
    expect(await dest.listPrompts()).toHaveLength(4);
  });

  it("um prompt com mídia ausente não derruba os outros", async () => {
    const src = await seededSource();
    const all = (await src.repo.listCategories()).map((c) => c.id);
    const { files: archive } = await exportLibrary(src.repo, src.files, { categoryIds: all, includeUncategorized: true });
    delete archive["media/aaa/thumb.webp"];
    const dest = createRepository(await migratedDb());
    const r = await importLibrary(dest, memFiles(), archive);
    expect(r.imported).toBe(3);
    expect(r.errors).toHaveLength(1);
  });

  it("rejeita .zip sem manifest", async () => {
    const dest = createRepository(await migratedDb());
    await expect(importLibrary(dest, memFiles(), {})).rejects.toThrow(/manifest/);
  });
});

describe("backup: validação do manifest", () => {
  const base = { format: "biblioteca-prompts", version: 1, exportedAt: "x", categories: [], prompts: [] };
  const withMedia = (thumb: string) => JSON.stringify({
    ...base,
    prompts: [{ title: "a", markdown: "b", category: null, subcategories: [], createdAt: "x", updatedAt: "x",
      media: [{ kind: "image", thumb, display: "media/a/display.webp", poster: null, mime: "image/webp", width: 1, height: 1, bytes: 1 }] }],
  });

  it("aceita manifest válido", () => {
    expect(parseManifest(withMedia("media/a/thumb.webp")).prompts).toHaveLength(1);
  });
  it("rejeita formato, versão futura e JSON ruim", () => {
    expect(() => parseManifest("{")).toThrow(BackupFormatError);
    expect(() => parseManifest(JSON.stringify({ ...base, format: "outro" }))).toThrow(BackupFormatError);
    expect(() => parseManifest(JSON.stringify({ ...base, version: 99 }))).toThrow(/mais nova/);
  });
  it("rejeita caminhos inseguros", () => {
    for (const bad of ["../x/thumb.webp", "media/../thumb.webp", "/media/a/thumb.webp", "media\\a\\thumb.webp", "media/a/thumb.exe", "C:/x.webp"]) {
      expect(isSafeMediaPath(bad)).toBe(false);
      expect(() => parseManifest(withMedia(bad))).toThrow(BackupFormatError);
    }
  });
});

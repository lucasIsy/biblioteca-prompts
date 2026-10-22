// Modo navegador (`npm run dev` aberto em http://localhost:1420, sem Tauri): banco e arquivos vêm do
// plugin `scripts/dev-backend.mjs` do Vite (`.dev-data/`). Só `db.ts` e `media.ts` importam este módulo.

export const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

const fsUrl = (rel: string) => `/__dev/fs/${rel.split("/").map(encodeURIComponent).join("/")}`;

async function ok(r: Response): Promise<Response> {
  if (!r.ok) throw new Error(`Backend de desenvolvimento: ${r.status} ${await r.text()}`);
  return r;
}

export async function browserSql(kind: "select" | "execute", sql: string, params: unknown[]): Promise<unknown> {
  const r = await ok(await fetch("/__dev/db", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, sql, params }),
  }));
  return r.json();
}

export const browserFs = {
  url: fsUrl,
  async write(rel: string, bytes: Uint8Array) {
    await ok(await fetch(fsUrl(rel), { method: "PUT", body: new Blob([bytes as BlobPart]) }));
  },
  async read(rel: string): Promise<Uint8Array> {
    return new Uint8Array(await (await ok(await fetch(fsUrl(rel)))).arrayBuffer());
  },
  async remove(rel: string) {
    await ok(await fetch(fsUrl(rel), { method: "DELETE" }));
  },
};

/** Seletor de arquivos do navegador; vazio se cancelar. */
export function pickBrowserFiles(accept: string, multiple: boolean): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.multiple = multiple;
    input.onchange = () => resolve(Array.from(input.files ?? []));
    input.oncancel = () => resolve([]);
    input.click();
  });
}

/** Arrastar e soltar arquivos na página. */
export function onBrowserDrop(cb: (files: File[]) => void): () => void {
  const over = (e: DragEvent) => { if (e.dataTransfer?.types.includes("Files")) e.preventDefault(); };
  const drop = (e: DragEvent) => {
    const files = Array.from(e.dataTransfer?.files ?? []);
    if (!files.length) return;
    e.preventDefault();
    cb(files);
  };
  window.addEventListener("dragover", over);
  window.addEventListener("drop", drop);
  return () => { window.removeEventListener("dragover", over); window.removeEventListener("drop", drop); };
}

/** Backup no navegador: "caminho" é `browser:<nome>`; o .zip escolhido fica aqui até ser lido. */
const archives = new Map<string, File>();
export const BROWSER_PREFIX = "browser:";

export async function pickBrowserArchive(): Promise<string | null> {
  const [file] = await pickBrowserFiles(".zip", false);
  if (!file) return null;
  const key = BROWSER_PREFIX + file.name;
  archives.set(key, file);
  return key;
}

export async function readBrowserArchive(key: string): Promise<Uint8Array> {
  const file = archives.get(key);
  if (!file) throw new Error("arquivo não escolhido");
  return new Uint8Array(await file.arrayBuffer());
}

export function downloadBrowserFile(key: string, bytes: Uint8Array) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/zip" }));
  a.download = key.slice(BROWSER_PREFIX.length);
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
}

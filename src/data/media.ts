import { appDataDir, join } from "@tauri-apps/api/path";
import { convertFileSrc } from "@tauri-apps/api/core";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { open, save as saveDialog } from "@tauri-apps/plugin-dialog";
import { unzipSync, zipSync } from "fflate";
import { BaseDirectory, copyFile, mkdir, readFile, remove, writeFile } from "@tauri-apps/plugin-fs";
import {
  DISPLAY_MAX, DISPLAY_QUALITY, THUMB_MAX, THUMB_QUALITY,
  fitWithin, folderOfPath, isImageName, mediaFolder, posterTime, videoMimeFor,
} from "../domain/media";
import type { NewMedia } from "./repository";
import {
  BROWSER_PREFIX, browserFs, downloadBrowserFile, isTauri, onBrowserDrop, pickBrowserArchive, pickBrowserFiles, readBrowserArchive,
} from "./browser";

/** Imagem vem de `File` (colar/arrastar na web) ou de caminho absoluto (drag-drop Tauri / dialog). */
export type MediaSource = File | string;

const baseName = (p: string) => p.split(/[\\/]/).pop() ?? p;

async function encode(bitmap: ImageBitmap, max: number, quality: number) {
  const size = fitWithin(bitmap.width, bitmap.height, max);
  const canvas = new OffscreenCanvas(size.width, size.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Não foi possível processar a imagem.");
  ctx.drawImage(bitmap, 0, 0, size.width, size.height);
  const blob = await canvas.convertToBlob({ type: "image/webp", quality });
  return { ...size, bytes: new Uint8Array(await blob.arrayBuffer()) };
}

async function newFolder(): Promise<string> {
  const folder = mediaFolder(crypto.randomUUID());
  if (isTauri) await mkdir(folder, { baseDir: BaseDirectory.AppData, recursive: true });
  return folder; // no navegador a pasta nasce na primeira gravação
}

async function save(rel: string, bytes: Uint8Array) {
  if (isTauri) await writeFile(rel, bytes, { baseDir: BaseDirectory.AppData });
  else await browserFs.write(rel, bytes);
}

/** Gera thumb (≈400 px) e display (≤2560 px) em WebP; o original não é guardado. */
export async function importImage(source: MediaSource): Promise<NewMedia> {
  let blob: Blob;
  try {
    blob = typeof source === "string" ? new Blob([await readFile(source)]) : source;
  } catch {
    throw new Error("Não foi possível ler o arquivo de imagem.");
  }
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(blob, { imageOrientation: "from-image" });
  } catch {
    throw new Error("Formato de imagem não suportado.");
  }
  try {
    const thumb = await encode(bitmap, THUMB_MAX, THUMB_QUALITY);
    const display = await encode(bitmap, DISPLAY_MAX, DISPLAY_QUALITY);
    const folder = await newFolder();
    const thumbPath = `${folder}/thumb.webp`;
    const displayPath = `${folder}/display.webp`;
    try {
      await save(thumbPath, thumb.bytes);
      await save(displayPath, display.bytes);
    } catch (e) {
      await deleteFiles([folder]);
      throw e;
    }
    return {
      kind: "image", thumbPath, displayPath, posterPath: null, mime: "image/webp",
      width: display.width, height: display.height, bytes: display.bytes.byteLength,
    };
  } finally {
    bitmap.close();
  }
}

function loadVideo(url: string): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const v = document.createElement("video");
    v.preload = "auto";
    v.muted = true;
    v.onloadeddata = () => (v.videoWidth > 0 ? resolve(v) : reject(new Error("vídeo sem imagem")));
    v.onerror = () => reject(new Error("vídeo inválido"));
    v.src = url;
  });
}

function seek(v: HTMLVideoElement, t: number): Promise<void> {
  return new Promise((resolve, reject) => {
    v.onseeked = () => resolve();
    v.onerror = () => reject(new Error("vídeo inválido"));
    v.currentTime = t;
  });
}

/** Só MP4 (H.264) e WebM, a partir de caminho absoluto (ou `File` no navegador). Gera poster e thumb. */
export async function importVideo(source: MediaSource): Promise<NewMedia> {
  const path = typeof source === "string" ? source : source.name;
  const mime = videoMimeFor(path);
  if (!mime) throw new Error("Formato de vídeo não suportado: use MP4 (H.264) ou WebM.");
  const probe = document.createElement("video");
  if (!probe.canPlayType(mime)) throw new Error("Este sistema não reproduz esse formato de vídeo.");

  const url = typeof source === "string" ? convertFileSrc(source) : URL.createObjectURL(source);
  let video: HTMLVideoElement;
  try {
    video = await loadVideo(url);
  } catch {
    throw new Error("Não foi possível reproduzir o vídeo. Use MP4 em H.264 ou WebM (H.265 não é suportado).");
  }
  try {
    await seek(video, posterTime(video.duration));
    const bitmap = await createImageBitmap(video);
    let poster, thumb;
    try {
      poster = await encode(bitmap, DISPLAY_MAX, DISPLAY_QUALITY);
      thumb = await encode(bitmap, THUMB_MAX, THUMB_QUALITY);
    } finally {
      bitmap.close();
    }
    const folder = await newFolder();
    const ext = mime === "video/mp4" ? "mp4" : "webm";
    const displayPath = `${folder}/video.${ext}`;
    const posterPath = `${folder}/poster.webp`;
    const thumbPath = `${folder}/thumb.webp`;
    try {
      if (typeof source === "string") await copyFile(source, displayPath, { toPathBaseDir: BaseDirectory.AppData });
      else await save(displayPath, new Uint8Array(await source.arrayBuffer()));
      await save(posterPath, poster.bytes);
      await save(thumbPath, thumb.bytes);
    } catch (e) {
      await deleteFiles([folder]);
      throw e;
    }
    return {
      kind: "video", thumbPath, displayPath, posterPath, mime,
      width: video.videoWidth, height: video.videoHeight, bytes: null,
    };
  } finally {
    video.removeAttribute("src");
    video.load();
    if (typeof source !== "string") URL.revokeObjectURL(url);
  }
}

/** Caminho relativo a AppData → URL do asset protocol (sem base64). */
export async function urlFor(rel: string): Promise<string> {
  if (!isTauri) return browserFs.url(rel);
  return convertFileSrc(await join(await appDataDir(), rel));
}

/** Remove as pastas `media/<id>` dadas por caminhos de pasta ou de arquivo. */
export async function deleteFiles(pathsOrFolders: string[]): Promise<void> {
  const folders = new Set(pathsOrFolders.map((p) => (/\.[a-z0-9]+$/i.test(baseName(p)) ? folderOfPath(p) : p)));
  for (const folder of folders) {
    try {
      if (isTauri) await remove(folder, { baseDir: BaseDirectory.AppData, recursive: true });
      else await browserFs.remove(folder);
    } catch {
      // pasta já ausente: nada a apagar
    }
  }
}

/** Importa por tipo: `File` (colar) é imagem; caminho com .mp4/.webm é vídeo; o resto, imagem. */
export async function importMedia(source: MediaSource): Promise<NewMedia> {
  const name = typeof source === "string" ? source : source.name;
  if (videoMimeFor(name)) return importVideo(source);
  if (typeof source === "string" && !isImageName(source)) throw new Error("Formato não suportado: use imagem (PNG, JPG, WEBP), MP4 (H.264) ou WebM.");
  return importImage(source);
}

/** Abre o seletor de arquivos do sistema; devolve caminhos absolutos, ou `File` no navegador (vazio se cancelar). */
export async function pickMediaPaths(): Promise<MediaSource[]> {
  if (!isTauri) return pickBrowserFiles("image/*,.png,.jpg,.jpeg,.webp,.gif,.bmp,.avif,.mp4,.webm", true);
  const picked = await open({
    multiple: true,
    filters: [{ name: "Imagem ou vídeo", extensions: ["png", "jpg", "jpeg", "webp", "gif", "bmp", "avif", "mp4", "webm"] }],
  });
  if (!picked) return [];
  return Array.isArray(picked) ? picked : [picked];
}

/** Escuta arquivos soltos na janela (drag-drop do Tauri entrega caminhos). Devolve a função que cancela. */
export async function onFilesDropped(cb: (sources: MediaSource[]) => void): Promise<() => void> {
  if (!isTauri) return onBrowserDrop(cb);
  return getCurrentWebview().onDragDropEvent((e) => {
    if (e.payload.type === "drop") cb(e.payload.paths);
  });
}

// ---- backup (.zip) ----

/** Porta de arquivos usada por `data/backup.ts`; em testes entra uma implementação em memória. */
export interface BackupFiles {
  readMedia(rel: string): Promise<Uint8Array>;
  /** Grava os arquivos numa pasta nova `media/<uuid>/`; devolve o caminho relativo de cada nome. */
  saveMedia(files: Record<string, Uint8Array>): Promise<Record<string, string>>;
  deleteFiles(pathsOrFolders: string[]): Promise<void>;
}

export const backupFiles: BackupFiles = {
  readMedia: (rel) => (isTauri ? readFile(rel, { baseDir: BaseDirectory.AppData }) : browserFs.read(rel)),
  async saveMedia(files) {
    const folder = await newFolder();
    const out: Record<string, string> = {};
    try {
      for (const [name, bytes] of Object.entries(files)) {
        out[name] = `${folder}/${name}`;
        await save(out[name], bytes);
      }
    } catch (e) {
      await deleteFiles([folder]);
      throw e;
    }
    return out;
  },
  deleteFiles,
};

/** Diálogo "salvar como" do .zip; null se cancelar. */
export async function pickExportPath(defaultName: string): Promise<string | null> {
  if (!isTauri) return BROWSER_PREFIX + defaultName; // o navegador baixa o arquivo
  return saveDialog({ defaultPath: defaultName, filters: [{ name: "Backup (.zip)", extensions: ["zip"] }] });
}

/** Diálogo "abrir" do .zip; null se cancelar. */
export async function pickArchivePath(): Promise<string | null> {
  if (!isTauri) return pickBrowserArchive();
  const picked = await open({ multiple: false, filters: [{ name: "Backup (.zip)", extensions: ["zip"] }] });
  return typeof picked === "string" ? picked : null;
}

/** Arquivos já comprimidos (webp/mp4/webm) vão sem compressão; o resto (manifest) com deflate. */
export async function writeArchive(absPath: string, files: Record<string, Uint8Array>): Promise<void> {
  const entries: Record<string, [Uint8Array, { level: 0 | 6 }]> = {};
  for (const [name, bytes] of Object.entries(files)) entries[name] = [bytes, { level: name.endsWith(".json") ? 6 : 0 }];
  const zip = zipSync(entries);
  if (isTauri) await writeFile(absPath, zip);
  else downloadBrowserFile(absPath, zip);
}

export async function readArchive(absPath: string): Promise<Record<string, Uint8Array>> {
  try {
    return unzipSync(isTauri ? await readFile(absPath) : await readBrowserArchive(absPath));
  } catch {
    throw new Error("Não foi possível abrir o .zip (arquivo inválido ou corrompido).");
  }
}

/** Pasta da biblioteca (AppData) para mostrar nas configurações. */
export async function libraryPath(): Promise<string> {
  if (!isTauri) return ".dev-data (modo navegador)";
  return appDataDir();
}

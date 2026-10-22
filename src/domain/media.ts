export const THUMB_MAX = 400;
export const DISPLAY_MAX = 2560;
export const THUMB_QUALITY = 0.8;
export const DISPLAY_QUALITY = 0.85;

/** Reduz mantendo proporção para que o lado maior seja ≤ max; nunca amplia. */
export function fitWithin(width: number, height: number, max: number): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= max) return { width, height };
  const scale = max / longest;
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

const VIDEO_MIME: Record<string, string> = { mp4: "video/mp4", webm: "video/webm" };

export function extensionOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i < 0 ? "" : name.slice(i + 1).toLowerCase();
}

/** Só MP4 e WebM; devolve null para qualquer outro formato. */
export function videoMimeFor(name: string): string | null {
  return VIDEO_MIME[extensionOf(name)] ?? null;
}

export function isImageName(name: string): boolean {
  return ["png", "jpg", "jpeg", "webp", "gif", "bmp", "avif"].includes(extensionOf(name));
}

/** Instante do poster: min(1 s, 10% da duração). */
export function posterTime(duration: number): number {
  if (!Number.isFinite(duration) || duration <= 0) return 0;
  return Math.min(1, duration * 0.1);
}

export function mediaFolder(folderId: string): string {
  return `media/${folderId}`;
}

/** Pastas únicas (`media/<uuid>`) de uma lista de mídias, para `deleteFiles`. */
export function foldersOfMedia(medias: { thumbPath: string; displayPath: string; posterPath: string | null }[]): string[] {
  const set = new Set<string>();
  for (const m of medias) {
    for (const p of [m.thumbPath, m.displayPath, m.posterPath]) if (p) set.add(folderOfPath(p));
  }
  return [...set];
}

/** Pasta (`media/<id>`) de um caminho relativo como `media/<id>/thumb.webp`. */
export function folderOfPath(rel: string): string {
  return rel.slice(0, rel.lastIndexOf("/"));
}

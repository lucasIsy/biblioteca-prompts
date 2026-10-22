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

/** Enquadramento da capa na carta: zoom sobre o "preencher" (1) e ponto focal (0–1). */
export interface Framing { fitZoom: number; fitX: number; fitY: number }
export const DEFAULT_FRAMING: Framing = { fitZoom: 1, fitX: 0.5, fitY: 0.5 };
export const MIN_ZOOM = 0.3;
export const MAX_ZOOM = 3;
export const CARD_RATIO = 0.72;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function clampFraming(f: Partial<Framing>): Framing {
  const num = (v: number | undefined, d: number) => (typeof v === "number" && Number.isFinite(v) ? v : d);
  return {
    fitZoom: clamp(num(f.fitZoom, 1), MIN_ZOOM, MAX_ZOOM),
    fitX: clamp(num(f.fitX, 0.5), 0, 1),
    fitY: clamp(num(f.fitY, 0.5), 0, 1),
  };
}

const pct = (n: number) => `${+n.toFixed(2)}%`;

/**
 * CSS da imagem dentro da carta. Zoom 1 = "preencher" (como `object-fit: cover`); a caixa da imagem tem o
 * tamanho real do preenchimento, então zoom < 1 revela a imagem inteira em vez de encolher o recorte.
 */
export function framingStyle(f: Partial<Framing>, width: number | null, height: number | null, cardRatio = CARD_RATIO) {
  const { fitZoom, fitX, fitY } = clampFraming(f);
  const r = width && height ? width / height : cardRatio;
  const w = r > cardRatio ? (r / cardRatio) * 100 : 100;
  const h = r > cardRatio ? 100 : (cardRatio / r) * 100;
  return {
    position: "absolute" as const, objectFit: "fill" as const,
    width: pct(w), height: pct(h), left: pct((100 - w) * fitX), top: pct((100 - h) * fitY),
    transform: `scale(${+fitZoom.toFixed(3)})`, transformOrigin: `${pct(fitX * 100)} ${pct(fitY * 100)}`,
  };
}

/** Zoom que mostra a imagem inteira na carta (relativo ao "preencher"). */
export function containZoom(width: number | null, height: number | null, cardRatio = CARD_RATIO): number {
  if (!width || !height) return 1;
  const r = width / height;
  const z = r > cardRatio ? cardRatio / r : r / cardRatio;
  return clamp(z, MIN_ZOOM, 1);
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

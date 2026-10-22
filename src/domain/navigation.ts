export type NavMode = "wrap" | "clamp";

// Próximo índice; lista vazia → -1.
export function step(index: number, length: number, delta: number, mode: NavMode): number {
  if (length <= 0) return -1;
  const next = index + delta;
  if (mode === "clamp") return Math.min(length - 1, Math.max(0, next));
  return ((next % length) + length) % length;
}

// Índices (com volta) das cartas a montar ao redor de `index`, sem repetir.
export function visibleWindow(index: number, length: number, radius: number): number[] {
  if (length <= 0) return [];
  const out: number[] = [];
  const seen = new Set<number>();
  for (let d = -radius; d <= radius; d++) {
    const i = step(index, length, d, "wrap");
    if (!seen.has(i)) { seen.add(i); out.push(i); }
  }
  return out;
}

// Cartas do anel ao redor de `idx` (posição absoluta `k`, índice `i`), uma por prompt, sempre na posição mais próxima da frente.
export function ringSlots(idx: number, length: number, radius: number): { k: number; i: number }[] {
  if (length <= 0) return [];
  const out: { k: number; i: number }[] = [];
  const seen = new Set<number>();
  for (let a = 0; a <= radius; a++) {
    for (const d of a === 0 ? [0] : [-a, a]) {
      const k = idx + d;
      const i = ((k % length) + length) % length;
      if (!seen.has(i)) { seen.add(i); out.push({ k, i }); }
    }
  }
  return out;
}

// Geometria do carrossel 3D (docs/DESIGN.md › Carrossel 3D).
export function carouselStep(length: number): number {
  return 360 / Math.max(length, 11);
}

// Raio para cartas de `cardWidth` px (a geometria original foi desenhada para 250 px e escala junto).
export function carouselRadius(length: number, cardWidth = BASE_CARD_WIDTH): number {
  const half = (carouselStep(length) / 2) * (Math.PI / 180);
  return (140 / Math.tan(half) + 40) * (cardWidth / BASE_CARD_WIDTH);
}

export const BASE_CARD_WIDTH = 250;

// Folga vertical do palco em volta da carta (sombra e perspectiva).
export const STAGE_SLACK = 40;

// Tamanho da carta pela altura medida do palco (o que sobra abaixo de header, título e filtros), para nada rolar.
export function cardSize(stageHeight: number): { width: number; height: number } {
  const height = Math.round(Math.min(520, Math.max(220, stageHeight - STAGE_SLACK)));
  return { width: Math.round(height * 0.72), height };
}

// Ângulo da carta `i` relativo à frente (`idx` cresce sem limite), normalizado em (−180, 180]; só para opacidade/brilho.
export function relativeAngle(i: number, idx: number, length: number): number {
  const s = carouselStep(length);
  let a = (((i - idx) * s) % 360 + 360) % 360;
  if (a > 180) a -= 360;
  return a;
}

export function cardOpacity(angle: number): number {
  const a = Math.abs(angle);
  return a > 105 ? 0 : Math.max(0, 1 - a / 125);
}

export function cardBrightness(angle: number): number {
  return Math.max(0.3, 1 - Math.abs(angle) / 110);
}

// Menor deslocamento (em cartas) de `idx` até a carta de posição `target` no anel de `length`.
export function shortestDelta(idx: number, target: number, length: number): number {
  if (length <= 0) return 0;
  let d = (((target - idx) % length) + length) % length;
  if (d > length / 2) d -= length;
  return d;
}

// Giro do carrossel: mola criticamente amortecida medida no vídeo de referência (pico de velocidade ~0,32 s, para em ~1,9 s).
export const SPRING_OMEGA = 3.2;

// Avança a mola `dt` segundos rumo a `target` (solução exata, estável com qualquer dt).
export function springStep(pos: number, vel: number, target: number, dt: number, omega = SPRING_OMEGA): { pos: number; vel: number } {
  const x = pos - target;
  const c = vel + omega * x;
  const e = Math.exp(-omega * dt);
  const nx = (x + c * dt) * e;
  return { pos: target + nx, vel: (c - omega * (x + c * dt)) * e };
}

export function springSettled(pos: number, vel: number, target: number): boolean {
  return Math.abs(pos - target) < 0.0005 && Math.abs(vel) < 0.0005;
}

// Pixels de wheel que valem uma carta (um dente de mouse ≈ 100 px; touchpad soma deltas pequenos).
export const WHEEL_PX_PER_CARD = 100;

// Acumula deltas de wheel; cada WHEEL_PX_PER_CARD vira um passo. `deltaMode` 1 = linhas, 2 = páginas.
export function wheelSteps(accum: number, delta: number, deltaMode = 0): { steps: number; accum: number } {
  const px = delta * (deltaMode === 1 ? 33 : deltaMode === 2 ? 400 : 1);
  const total = accum + px;
  const steps = Math.trunc(total / WHEEL_PX_PER_CARD);
  return { steps, accum: total - steps * WHEEL_PX_PER_CARD };
}

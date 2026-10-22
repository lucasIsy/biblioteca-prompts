// Passa da galeria para o visualizador a posição da carta clicada, para a mídia "voar" dela até a metade esquerda.
interface Flight { promptId: number; rect: DOMRect }

let pending: Flight | null = null;

export function setFlight(promptId: number, rect: DOMRect) {
  pending = { promptId, rect };
}

/** Consome o voo pendente se for deste prompt (navegação direta ou de outra tela → `null`). */
export function takeFlight(promptId: number): DOMRect | null {
  const f = pending;
  pending = null;
  return f && f.promptId === promptId ? f.rect : null;
}

export const reducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

import { normalize } from "./text";

export const slugify = (s: string): string =>
  normalize(s).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// Nomes iguais ignorando caixa, acento e espaços repetidos.
export const sameName = (a: string, b: string): boolean => normalize(a) === normalize(b);

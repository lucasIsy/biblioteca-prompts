// Sem acento, sem caixa, espaços colapsados.
export const normalize = (s: string): string =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim().toLowerCase();

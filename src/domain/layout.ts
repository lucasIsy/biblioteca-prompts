import type { Category, Layout } from "../data/repository";

// Só as categorias de sistema com mídia (Imagens e Vídeos) usam galeria; o resto é grade.
export function layoutFor(category: Pick<Category, "isSystem" | "mediaKind"> | null | undefined): Layout {
  return category && category.isSystem && category.mediaKind !== null ? "gallery" : "grid";
}

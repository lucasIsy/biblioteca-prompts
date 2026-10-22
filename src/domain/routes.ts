export type Route =
  | { name: "category"; slug: string }
  | { name: "uncategorized" }
  | { name: "prompt"; id: number }
  | { name: "new"; categorySlug: string | null }
  | { name: "edit"; id: number }
  | { name: "settings" };

export const UNCATEGORIZED_SLUG = "sem-categoria";

/** `#/c/<slug>`, `#/p/<id>`; qualquer outra coisa (inclusive vazio) → `null` (a tela inicial escolhe a 1ª categoria). */
export function parseHash(hash: string): Route | null {
  const parts = hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  if (parts[0] === "c" && parts[1]) {
    const slug = decodeURIComponent(parts[1]);
    return slug === UNCATEGORIZED_SLUG ? { name: "uncategorized" } : { name: "category", slug };
  }
  if (parts[0] === "p" && /^\d+$/.test(parts[1] ?? "")) return { name: "prompt", id: Number(parts[1]) };
  if (parts[0] === "edit" && /^\d+$/.test(parts[1] ?? "")) return { name: "edit", id: Number(parts[1]) };
  if (parts[0] === "new") return { name: "new", categorySlug: parts[1] ? decodeURIComponent(parts[1]) : null };
  if (parts[0] === "settings") return { name: "settings" };
  return null;
}

export const newPromptHref = (categorySlug?: string | null) =>
  categorySlug ? `#/new/${encodeURIComponent(categorySlug)}` : "#/new";
export const editHref = (id: number) => `#/edit/${id}`;
export const SETTINGS_HREF = "#/settings";
export const categoryHref = (slug: string) => `#/c/${encodeURIComponent(slug)}`;
export const promptHref = (id: number) => `#/p/${id}`;

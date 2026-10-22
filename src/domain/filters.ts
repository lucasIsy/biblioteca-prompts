import type { Prompt } from "../data/repository";
import { normalize } from "./text";

export interface PromptFilter {
  query?: string;
  /** undefined = todas; null = Sem categoria */
  categoryId?: number | null;
  /** vazio/ausente = todas; OU entre as selecionadas */
  subcategoryIds?: number[];
}

export function filterPrompts(prompts: Prompt[], f: PromptFilter = {}): Prompt[] {
  const q = normalize(f.query ?? "");
  const subs = f.subcategoryIds ?? [];
  return prompts.filter((p) => {
    if (f.categoryId !== undefined && p.categoryId !== f.categoryId) return false;
    if (subs.length > 0 && !p.subcategoryIds.some((id) => subs.includes(id))) return false;
    if (q && !normalize(p.title).includes(q)) return false;
    return true;
  });
}

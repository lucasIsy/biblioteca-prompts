import { useCallback, useEffect, useState } from "react";
import { getDb } from "../data/db";
import { createRepository } from "../data/repository";
import type { Category, Media, Prompt, Repository, Subcategory } from "../data/repository";

export interface Library {
  categories: Category[];
  prompts: Prompt[];
  subcategories: Subcategory[];
  covers: Map<number, Media>;
}

let repoPromise: Promise<Repository> | null = null;
export const getRepository = () => (repoPromise ??= getDb().then(createRepository));

/** Carrega categorias, prompts, subcategorias e capas (só metadados). */
export function useLibrary() {
  const [data, setData] = useState<Library | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const repo = await getRepository();
      const categories = await repo.listCategories();
      const [prompts, covers, subs] = await Promise.all([
        repo.listPrompts(),
        repo.listCovers(),
        Promise.all(categories.map((c) => repo.listSubcategories(c.id))),
      ]);
      setData({ categories, prompts, covers, subcategories: subs.flat() });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  return { data, error, reload };
}

import { useEffect, useMemo, useState } from "react";
import type { Category } from "../data/repository";
import { filterPrompts } from "../domain/filters";
import { SearchFilters } from "../ui/SearchFilters";
import { MediaGrid } from "../ui/MediaGrid";
import { Carousel3D } from "../ui/Carousel3D";
import { layoutFor } from "../domain/layout";
import type { Library } from "../hooks/useLibrary";

interface Props {
  library: Library;
  /** `null` = Sem categoria */
  category: Category | null;
  /** prompt aberto no visualizador por cima; o carrossel começa nele */
  focusId?: number;
  /** visualizador cobrindo a página: desliga teclado/roda do carrossel */
  covered?: boolean;
}

export function CategoryPage({ library, category, focusId, covered = false }: Props) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<number[]>([]);
  const id = category?.id ?? null;

  useEffect(() => { setQuery(""); setSelected([]); }, [id]);

  const subs = useMemo(() => library.subcategories.filter((s) => s.categoryId === id), [library, id]);
  const prompts = useMemo(
    () => filterPrompts(library.prompts, { query, categoryId: id, subcategoryIds: selected }),
    [library, query, id, selected],
  );

  const toggle = (sid: number) =>
    setSelected((cur) => (cur.includes(sid) ? cur.filter((x) => x !== sid) : [...cur, sid]));

  return (
    <>
      <h1 className="title">{category?.name ?? "Sem categoria"}</h1>
      <SearchFilters
        query={query} onQuery={setQuery} subcategories={subs}
        selected={selected} onToggle={toggle} onClear={() => setSelected([])}
        categorySlug={category?.slug ?? null}
      />
      {prompts.length === 0 ? (
        <div className="grid-wrap">
          <p className="empty">{query || selected.length ? "Nada por aqui com esse filtro." : "Nenhum prompt ainda."}</p>
        </div>
      ) : layoutFor(category) === "gallery" ? (
        <Carousel3D prompts={prompts} covers={library.covers} subcategories={library.subcategories} focusId={focusId} navEnabled={!covered} />
      ) : (
        <div className="grid-wrap">
          <MediaGrid prompts={prompts} covers={library.covers} subcategories={library.subcategories} />
        </div>
      )}
    </>
  );
}

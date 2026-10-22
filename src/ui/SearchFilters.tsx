import type { Subcategory } from "../data/repository";

interface Props {
  query: string;
  onQuery: (q: string) => void;
  subcategories: Subcategory[];
  selected: number[];
  onToggle: (id: number) => void;
  onClear: () => void;
}

export function SearchFilters({ query, onQuery, subcategories, selected, onToggle, onClear }: Props) {
  return (
    <div className="filters">
      <label className="search">
        <span className="sr-only" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>
          Buscar por nome
        </span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8a8a8a" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" />
        </svg>
        <input className="q" type="search" placeholder="Buscar" value={query} onChange={(e) => onQuery(e.target.value)} />
      </label>
      {subcategories.length > 0 && <span className="sep" aria-hidden="true" />}
      {subcategories.length > 0 && (
        <button type="button" className="sub" aria-pressed={selected.length === 0} onClick={onClear}>Todas</button>
      )}
      {subcategories.map((s) => (
        <button key={s.id} type="button" className="sub" aria-pressed={selected.includes(s.id)} onClick={() => onToggle(s.id)}>
          {s.name}
        </button>
      ))}
    </div>
  );
}

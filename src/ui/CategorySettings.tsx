import { useState } from "react";

export interface EditableItem {
  id: number;
  name: string;
  count: number;
  /** categoria de sistema: pode renomear, não excluir */
  locked?: boolean;
}

interface Props {
  items: EditableItem[];
  addLabel: string;
  onAdd: (name: string) => Promise<void>;
  onRename: (id: number, name: string) => Promise<void>;
  onDelete: (id: number) => void;
}

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Lista com renomear inline, excluir e campo de adição (usada para categorias e subcategorias). */
export function CategorySettings({ items, addLabel, onAdd, onRename, onDelete }: Props) {
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const [fresh, setFresh] = useState("");
  const [error, setError] = useState<string | null>(null);

  const run = async (fn: () => Promise<void>, done: () => void) => {
    setError(null);
    try { await fn(); done(); } catch (e) { setError(message(e)); }
  };

  const commitRename = (id: number) => {
    const name = draft.trim();
    const current = items.find((i) => i.id === id)?.name;
    if (!name || name === current) { setEditing(null); return; }
    void run(() => onRename(id, name), () => setEditing(null));
  };
  const commitAdd = () => {
    const name = fresh.trim();
    if (!name) return;
    void run(() => onAdd(name), () => setFresh(""));
  };

  return (
    <div className="settings-list">
      <ul>
        {items.map((i) => (
          <li key={i.id}>
            {editing === i.id ? (
              <input className="line" value={draft} autoFocus aria-label={`Novo nome de ${i.name}`}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={() => commitRename(i.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitRename(i.id);
                  if (e.key === "Escape") { setEditing(null); setError(null); }
                }} />
            ) : (
              <span className="li-name">{i.name}</span>
            )}
            <span className="li-count">{i.count} {i.count === 1 ? "prompt" : "prompts"}</span>
            <button type="button" className="ico" aria-label={`Renomear ${i.name}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { setEditing(i.id); setDraft(i.name); setError(null); }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>
            </button>
            {i.locked ? <span className="ico-spacer" aria-hidden="true" /> : (
              <button type="button" className="ico" aria-label={`Excluir ${i.name}`} onClick={() => onDelete(i.id)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
              </button>
            )}
          </li>
        ))}
      </ul>
      <form className="settings-add" onSubmit={(e) => { e.preventDefault(); commitAdd(); }}>
        <input className="line" type="text" value={fresh} placeholder={addLabel} aria-label={addLabel}
          onChange={(e) => setFresh(e.target.value)} />
        <button type="submit" className="btn-primary" disabled={!fresh.trim()}>Adicionar</button>
      </form>
      {error && <p className="form-error" role="alert">{error}</p>}
    </div>
  );
}

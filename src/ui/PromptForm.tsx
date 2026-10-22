import { useCallback, useEffect, useRef, useState } from "react";
import type { Media, NewMedia, Prompt } from "../data/repository";
import { deleteFiles, importMedia, onFilesDropped, pickMediaPaths } from "../data/media";
import { foldersOfMedia } from "../domain/media";
import { categoryHref, promptHref, UNCATEGORIZED_SLUG } from "../domain/routes";
import { getRepository } from "../hooks/useLibrary";
import type { Library } from "../hooks/useLibrary";
import { useMediaUrl } from "../hooks/useMediaUrl";
import { CategoryNav, Logo } from "./Header";
import { MarkdownView } from "./MarkdownView";

interface Props {
  library: Library;
  /** `null` = novo prompt */
  prompt: Prompt | null;
  /** categoria pré-selecionada ao criar */
  initialCategoryId: number | null;
  onSaved: () => Promise<void>;
}

function MediaItem({ thumbPath, label, onRemove }: { thumbPath: string; label: string; onRemove: () => void }) {
  const url = useMediaUrl(thumbPath);
  return (
    <div className="form-media">
      {url && <img src={url} alt="" />}
      <button type="button" onClick={onRemove} aria-label={`Remover ${label}`}>×</button>
    </div>
  );
}

/** Criar/editar prompt: nome, categoria, subcategorias, markdown (Editar/Visualizar) e mídia. */
export function PromptForm({ library, prompt, initialCategoryId, onSaved }: Props) {
  const { categories, subcategories, prompts } = library;
  const [title, setTitle] = useState(prompt?.title ?? "");
  const [categoryId, setCategoryId] = useState<number | null>(prompt ? prompt.categoryId : initialCategoryId);
  const [subIds, setSubIds] = useState<number[]>(prompt?.subcategoryIds ?? []);
  const [markdown, setMarkdown] = useState(prompt?.markdown ?? "");
  const [preview, setPreview] = useState(false);
  const [existing, setExisting] = useState<Media[]>([]);
  const [removed, setRemoved] = useState<Media[]>([]);
  const [added, setAdded] = useState<NewMedia[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Arquivos já gravados e ainda não salvos: se o formulário sair sem salvar, são apagados.
  const addedRef = useRef<NewMedia[]>([]);
  const savedRef = useRef(false);
  addedRef.current = added;

  const showUncategorized = prompts.some((p) => p.categoryId === null);
  const category = categories.find((c) => c.id === categoryId) ?? null;
  const subs = subcategories.filter((s) => s.categoryId === categoryId);

  const promptId = prompt?.id;
  useEffect(() => {
    if (promptId === undefined) return;
    let alive = true;
    void getRepository().then((r) => r.listMedia(promptId)).then((m) => { if (alive) setExisting(m); });
    return () => { alive = false; };
  }, [promptId]);

  useEffect(() => () => {
    if (!savedRef.current && addedRef.current.length) void deleteFiles(foldersOfMedia(addedRef.current));
  }, []);

  const importAll = useCallback(async (sources: (File | string)[]) => {
    setBusy(true);
    setError(null);
    try {
      for (const src of sources) {
        const media = await importMedia(src);
        setAdded((cur) => [...cur, media]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const file = Array.from(e.clipboardData?.files ?? []).find((f) => f.type.startsWith("image/"));
      if (file) { e.preventDefault(); void importAll([file]); }
    };
    window.addEventListener("paste", onPaste);
    let off: (() => void) | undefined;
    let alive = true;
    void onFilesDropped((paths) => void importAll(paths)).then((fn) => { if (alive) off = fn; else fn(); });
    return () => { alive = false; window.removeEventListener("paste", onPaste); off?.(); };
  }, [importAll]);

  const pick = async () => {
    try {
      const paths = await pickMediaPaths();
      if (paths.length) await importAll(paths);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const chooseCategory = (id: number | null) => {
    setCategoryId(id);
    setSubIds((cur) => cur.filter((sid) => subcategories.some((s) => s.id === sid && s.categoryId === id)));
  };
  const toggleSub = (sid: number) =>
    setSubIds((cur) => (cur.includes(sid) ? cur.filter((x) => x !== sid) : [...cur, sid]));

  const backHref = prompt ? promptHref(prompt.id) : categoryHref(category?.slug ?? UNCATEGORIZED_SLUG);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTitle = title.trim();
    if (!cleanTitle) { setError("Dê um nome ao prompt."); return; }
    setBusy(true);
    setError(null);
    try {
      const repo = await getRepository();
      const input = { categoryId, title: cleanTitle, markdown, subcategoryIds: subIds };
      let id: number;
      if (prompt) {
        id = prompt.id;
        await repo.updatePrompt(id, input);
      } else {
        id = await repo.createPrompt(input);
      }
      for (const m of added) await repo.attachMedia(id, m);
      savedRef.current = true;
      for (const m of removed) await repo.removeMedia(m.id);
      await deleteFiles(foldersOfMedia(removed));
      await onSaved();
      window.location.hash = promptHref(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  };

  return (
    <div className="viewer form-page">
      <div className="form-left">
        <Logo />
        <button type="button" className="dropzone" onClick={pick} disabled={busy}>
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#8a8a8a" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="4" /><circle cx="9" cy="9" r="2" /><path d="M21 15l-5-5L5 21" /></svg>
          <span className="dz-title">{busy ? "Processando…" : "Solte a mídia de preview aqui"}</span>
          <span className="dz-hint">ou clique para escolher · PNG, JPG, WEBP, MP4, WebM · também aceita Ctrl+V</span>
        </button>
        {(existing.length > 0 || added.length > 0) && (
          <div className="form-medias">
            {existing.map((m) => (
              <MediaItem key={`e${m.id}`} thumbPath={m.thumbPath} label="mídia"
                onRemove={() => { setExisting((c) => c.filter((x) => x.id !== m.id)); setRemoved((c) => [...c, m]); }} />
            ))}
            {added.map((m, i) => (
              <MediaItem key={m.thumbPath} thumbPath={m.thumbPath} label="mídia nova"
                onRemove={() => { setAdded((c) => c.filter((_, j) => j !== i)); void deleteFiles(foldersOfMedia([m])); }} />
            ))}
          </div>
        )}
        <p className="form-note">A mídia é guardada na biblioteca e volta quando você reabrir o app.</p>
      </div>

      <div className="viewer-side">
        <CategoryNav categories={categories} activeSlug={category?.slug ?? null} showUncategorized={showUncategorized} />
        <form className="form" onSubmit={save}>
          <h1>{prompt ? "Editar prompt" : "Novo prompt"}</h1>

          <label className="field">
            <span className="lbl">Nome</span>
            <input className="line" type="text" value={title} placeholder="Dê um nome ao prompt"
              onChange={(e) => setTitle(e.target.value)} autoFocus />
          </label>

          <div className="field">
            <span className="lbl">Categoria</span>
            <div role="radiogroup" aria-label="Categoria" className="opts">
              {categories.map((c) => (
                <button key={c.id} type="button" role="radio" aria-checked={c.id === categoryId} className="opt"
                  onClick={() => chooseCategory(c.id)}>{c.name}</button>
              ))}
              <button type="button" role="radio" aria-checked={categoryId === null} className="opt"
                onClick={() => chooseCategory(null)}>Sem categoria</button>
            </div>
          </div>

          {subs.length > 0 && (
            <div className="field">
              <span className="lbl">Subcategorias</span>
              <div className="pills">
                {subs.map((s) => (
                  <button key={s.id} type="button" className="pill" aria-pressed={subIds.includes(s.id)}
                    onClick={() => toggleSub(s.id)}>{s.name}</button>
                ))}
              </div>
            </div>
          )}

          <div className="field">
            <div className="lbl-row">
              <span className="lbl">Prompt em Markdown</span>
              <div className="seg" role="tablist" aria-label="Modo do editor">
                <button type="button" role="tab" aria-selected={!preview} onClick={() => setPreview(false)}>Editar</button>
                <button type="button" role="tab" aria-selected={preview} onClick={() => setPreview(true)}>Visualizar</button>
              </div>
            </div>
            {preview ? (
              <div className="md-preview"><MarkdownView markdown={markdown} /></div>
            ) : (
              <textarea className="md-input" value={markdown} spellCheck={false}
                placeholder={"## Prompt\nescreva aqui…"} onChange={(e) => setMarkdown(e.target.value)} />
            )}
          </div>

          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="form-actions">
            <button type="submit" className="btn-primary" disabled={busy}>{busy ? "Salvando…" : "Salvar prompt"}</button>
            <a href={backHref} className="cancel">Cancelar</a>
          </div>
        </form>
      </div>
    </div>
  );
}

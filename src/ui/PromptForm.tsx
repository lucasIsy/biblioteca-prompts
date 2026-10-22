import { useCallback, useEffect, useRef, useState } from "react";
import type { Media, NewMedia, Prompt } from "../data/repository";
import { deleteFiles, importMedia, onFilesDropped, pickMediaPaths } from "../data/media";
import { clampFraming, containZoom, DEFAULT_FRAMING, foldersOfMedia, framingStyle, MAX_ZOOM, MIN_ZOOM } from "../domain/media";
import type { Framing } from "../domain/media";
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

/** Prévia da carta (0,72): arrastar reposiciona, o controle ajusta o zoom. */
function FramingEditor({ thumbPath, width, height, value, onChange }: {
  thumbPath: string; width: number | null; height: number | null; value: Framing; onChange: (f: Framing) => void;
}) {
  const url = useMediaUrl(thumbPath);
  const drag = useRef<{ x: number; y: number; box: DOMRect } | null>(null);
  const set = (f: Partial<Framing>) => onChange(clampFraming({ ...value, ...f }));
  return (
    <div className="field framing">
      <span className="lbl">Enquadramento do preview</span>
      <div className="framing-row">
        <div className="framing-box"
          onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); drag.current = { x: e.clientX, y: e.clientY, box: e.currentTarget.getBoundingClientRect() }; }}
          onPointerMove={(e) => {
            const d = drag.current;
            if (!d) return;
            set({ fitX: value.fitX - (e.clientX - d.x) / d.box.width, fitY: value.fitY - (e.clientY - d.y) / d.box.height });
            drag.current = { ...d, x: e.clientX, y: e.clientY };
          }}
          onPointerUp={() => { drag.current = null; }}
          onPointerCancel={() => { drag.current = null; }}>
          {url && <img src={url} alt="" draggable={false} style={framingStyle(value, width, height)} />}
        </div>
        <div className="framing-ctl">
          <input type="range" min={MIN_ZOOM} max={MAX_ZOOM} step={0.01} value={value.fitZoom}
            aria-label="Zoom" onChange={(e) => set({ fitZoom: Number(e.target.value) })} />
          <div className="opts">
            <button type="button" className="opt" onClick={() => set({ fitZoom: 1 })}>Preencher</button>
            <button type="button" className="opt" onClick={() => set({ fitZoom: containZoom(width, height), fitX: 0.5, fitY: 0.5 })}>Inteira</button>
            <button type="button" className="opt" onClick={() => onChange(DEFAULT_FRAMING)}>Redefinir</button>
          </div>
          <span className="form-note">Arraste a imagem para posicionar.</span>
        </div>
      </div>
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

  // Capa = primeira mídia que vai sobrar (as já gravadas vêm antes das novas).
  const coverExisting = existing[0];
  const coverAdded = coverExisting ? undefined : added[0];
  const cover = coverExisting ?? coverAdded;
  const coverKey = coverExisting ? `e${coverExisting.id}` : coverAdded?.thumbPath ?? "";
  const [framing, setFraming] = useState<Framing>(DEFAULT_FRAMING);
  const [framingDirty, setFramingDirty] = useState(false);
  useEffect(() => {
    setFraming(coverExisting ? clampFraming(coverExisting) : DEFAULT_FRAMING);
    setFramingDirty(false);
  }, [coverKey]); // só quando a capa troca
  const changeFraming = (f: Framing) => { setFraming(f); setFramingDirty(true); };

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
      if (coverExisting && framingDirty) await repo.updateMediaFraming(coverExisting.id, framing);
      for (const m of added) await repo.attachMedia(id, m === coverAdded ? { ...m, ...framing } : m);
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
        {cover && (
          <FramingEditor key={coverKey} thumbPath={cover.thumbPath} width={cover.width} height={cover.height}
            value={framing} onChange={changeFraming} />
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

          {category && (
            <div className="field">
              <span className="lbl">Subcategorias</span>
              {subs.length > 0 ? (
                <div className="pills">
                  {subs.map((s) => (
                    <button key={s.id} type="button" className="pill" aria-pressed={subIds.includes(s.id)}
                      onClick={() => toggleSub(s.id)}>{s.name}</button>
                  ))}
                </div>
              ) : (
                <p className="form-note">Nenhuma subcategoria em {category.name}. Crie em Configurações.</p>
              )}
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

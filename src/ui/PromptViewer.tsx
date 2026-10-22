import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { Category, Media, Prompt, Subcategory } from "../data/repository";
import { getCopyText } from "../domain/clipboard";
import { foldersOfMedia } from "../domain/media";
import { categoryHref, editHref, UNCATEGORIZED_SLUG } from "../domain/routes";
import { deleteFiles } from "../data/media";
import { getRepository } from "../hooks/useLibrary";
import { useMediaUrl } from "../hooks/useMediaUrl";
import { CategoryNav, Logo } from "./Header";
import { MarkdownView } from "./MarkdownView";
import { reducedMotion, takeFlight } from "./cardFlight";

interface Props {
  prompt: Prompt;
  category: Category | null;
  categories: Category[];
  subcategories: Subcategory[];
  showUncategorized: boolean;
  onDeleted: () => Promise<void>;
  /** fechar: devolve a galeria por baixo (HUD e cartas vizinhas) antes da carta pousar */
  onUncover: () => void;
}

const OUT = "cubic-bezier(.16,1,.3,1)";
const FLY = "cubic-bezier(.45,0,.15,1)";

type Box = { left: number; top: number; width: number; height: number };
const frame = (b: Box, radius: number) => ({
  left: `${b.left}px`, top: `${b.top}px`, width: `${b.width}px`, height: `${b.height}px`, borderRadius: `${radius}px`,
});

function Thumb({ media, index, onPick }: { media: Media; index: number; onPick: () => void }) {
  const url = useMediaUrl(media.thumbPath);
  return (
    <button type="button" onClick={onPick} aria-label="Ver mídia" style={{ "--i": index } as CSSProperties}>
      {url && <img src={url} alt="" />}
    </button>
  );
}

/**
 * Visualizador, em camada sobre a galeria: mídia (versão display) à esquerda, markdown renderizado + copiar à direita.
 * Aberto pela carta da galeria, a mídia voa do retângulo da carta até a metade esquerda; ao fechar, encolhe até o
 * centro, espera e pousa na carta da frente enquanto o anel volta (tempos medidos no vídeo de referência).
 */
export function PromptViewer({ prompt, category, categories, subcategories, showUncategorized, onDeleted, onUncover }: Props) {
  const [from] = useState(() => takeFlight(prompt.id));
  const [phase, setPhase] = useState<"flight" | "open" | "leaving">(from ? "flight" : "open");
  const mediaRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const closeTimers = useRef<number[]>([]);
  const closeRef = useRef<() => void>(() => {});
  const [medias, setMedias] = useState<Media[]>([]);
  const [active, setActive] = useState(0);
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const timer = useRef<number>(0);

  useEffect(() => {
    let alive = true;
    setActive(0);
    void getRepository().then((r) => r.listMedia(prompt.id)).then((m) => { if (alive) setMedias(m); });
    return () => { alive = false; };
  }, [prompt.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      closeRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("keydown", onKey); window.clearTimeout(timer.current); };
  }, []);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    const timers = closeTimers.current;
    return () => { document.body.style.overflow = ""; timers.forEach((t) => window.clearTimeout(t)); };
  }, []);

  // Abrir: a moldura da mídia sai do retângulo da carta e cresce até a metade esquerda.
  useLayoutEffect(() => {
    if (!from || !mediaRef.current || !frameRef.current) return;
    const m = mediaRef.current.getBoundingClientRect();
    const start = { left: from.left - m.left, top: from.top - m.top, width: from.width, height: from.height };
    const a = frameRef.current.animate(
      [frame(start, 22), { offset: 0.7, borderRadius: "22px" }, frame({ left: 0, top: 0, width: m.width, height: m.height }, 0)],
      { duration: 1050, easing: FLY },
    );
    a.onfinish = () => setPhase("open");
    return () => a.cancel();
  }, [from]);

  const media = medias[active];
  const thumbUrl = useMediaUrl(media?.thumbPath);
  const displayUrl = useMediaUrl(media?.kind === "image" ? media.displayPath : null);
  const videoUrl = useMediaUrl(media?.kind === "video" ? media.displayPath : null);
  const posterUrl = useMediaUrl(media?.kind === "video" ? media.posterPath : null);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(getCopyText(prompt));
      setCopied(true);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  const remove = async () => {
    try {
      const repo = await getRepository();
      // Ler a mídia antes: o delete em cascata apaga as linhas e só então sobram as pastas.
      const files = await repo.listMedia(prompt.id);
      await repo.deletePrompt(prompt.id);
      await deleteFiles(foldersOfMedia(files));
      window.location.hash = categoryHref(category?.slug ?? UNCATEGORIZED_SLUG);
      await onDeleted();
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : String(e));
      setConfirming(false);
    }
  };

  const subs = subcategories.filter((s) => prompt.subcategoryIds.includes(s.id)).map((s) => s.name).join(", ");
  const backHref = categoryHref(category?.slug ?? UNCATEGORIZED_SLUG);

  // Fechar: encolhe até o centro (1 s), pausa, e aos 1,15 s pousa na carta da frente enquanto o anel volta.
  const close = () => {
    if (phase === "leaving") return;
    const back = () => { window.location.hash = backHref; };
    const card = document.querySelector<HTMLElement>(".carousel .slot.is-front .card-media");
    const f = frameRef.current, mediaEl = mediaRef.current;
    if (reducedMotion() || !card || !f || !mediaEl) { onUncover(); back(); return; }
    f.getAnimations().forEach((a) => a.cancel());
    setPhase("leaving");
    const m = mediaEl.getBoundingClientRect(), t = card.getBoundingClientRect();
    const land = { left: t.left - m.left, top: t.top - m.top, width: t.width, height: t.height };
    const alone = { ...land, top: land.top - 56 };
    f.animate(
      [frame({ left: 0, top: 0, width: m.width, height: m.height }, 0), { offset: 0.15, borderRadius: "22px" }, frame(alone, 22)],
      { duration: 1000, easing: OUT, fill: "forwards" },
    );
    closeTimers.current.push(
      window.setTimeout(() => {
        onUncover();
        f.animate([frame(alone, 22), frame(land, 22)], { duration: 900, easing: OUT, fill: "forwards" });
      }, 1150),
      window.setTimeout(back, 2050),
    );
  };
  closeRef.current = close;

  return (
    <div className={`viewer-layer${from ? " from-card" : ""}${phase !== "open" ? " is-flight" : ""}${phase === "leaving" ? " is-leaving" : ""}`}>
    <div className="viewer">
      <div className="viewer-media" ref={mediaRef}>
        <div className="viewer-frame" ref={frameRef}>
          {thumbUrl && <img src={thumbUrl} alt="" />}
          {displayUrl && <img src={displayUrl} alt={prompt.title} />}
          {videoUrl && <video src={videoUrl} poster={posterUrl ?? undefined} controls loop muted playsInline />}
          <div className="card-cap" aria-hidden="true"><span className="card-name">{prompt.title}</span></div>
        </div>
        <Logo />
      </div>
      <div className="viewer-side">
        <CategoryNav categories={categories} activeSlug={category?.slug ?? UNCATEGORIZED_SLUG} showUncategorized={showUncategorized} />
        <article className="viewer-article">
          <h1><span>{prompt.title}</span></h1>
          <div className="copy-box">
            <MarkdownView markdown={prompt.markdown} />
            <button type="button" className="copy-btn" onClick={copy} aria-label={copied ? "Copiado" : "Copiar prompt"}>
              {copied ? (
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5L20 7" /></svg>
              ) : (
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" /></svg>
              )}
            </button>
          </div>
          {medias.length > 1 && (
            <div className="thumbs">
              {medias.map((m, i) => i !== active && <Thumb key={m.id} media={m} index={i} onPick={() => setActive(i)} />)}
            </div>
          )}
          <dl className="meta">
            {category && <div><dt>Categoria</dt><dd>{category.name}</dd></div>}
            {subs && <div><dt>Subcategorias</dt><dd>{subs}</dd></div>}
          </dl>
        </article>
        <div className="actions">
          <button type="button" className="act" onClick={copy}>{copied ? "Copiado" : "Copiar prompt"}</button>
          <a href={editHref(prompt.id)} className="act">Editar</a>
          {confirming ? (
            <>
              <button type="button" className="act danger" onClick={remove}>Confirmar exclusão</button>
              <button type="button" className="act" onClick={() => setConfirming(false)}>Cancelar</button>
            </>
          ) : (
            <button type="button" className="act" onClick={() => setConfirming(true)}>Excluir</button>
          )}
          <button type="button" className="act" onClick={close}>Voltar</button>
          {deleteError && <span className="form-error" role="alert">{deleteError}</span>}
        </div>
      </div>
    </div>
    </div>
  );
}

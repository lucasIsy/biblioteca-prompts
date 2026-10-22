import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { Media, Prompt, Subcategory } from "../data/repository";
import { cardBrightness, cardOpacity, cardSize, carouselRadius, carouselStep, ringSlots, shortestDelta, springSettled, springStep } from "../domain/navigation";
import { promptHref } from "../domain/routes";
import { useGalleryNav } from "../hooks/useGalleryNav";
import { PromptCard } from "./PromptCard";
import { reducedMotion, setFlight } from "./cardFlight";

const WINDOW = 6;

interface Props {
  prompts: Prompt[];
  covers: Map<number, Media>;
  subcategories: Subcategory[];
  /** prompt que começa na frente (ex.: aberto no visualizador por cima) */
  focusId?: number;
  /** teclado/roda desligados enquanto o visualizador cobre a galeria */
  navEnabled?: boolean;
}

const arrow = (d: string) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
);

/**
 * Carrossel 3D cilíndrico. `target` é o índice alvo (cresce sem limite; frente = target mod N) e a posição
 * contínua segue o alvo por uma mola (`springStep`), aplicada direto no DOM a cada quadro.
 * Carta que entra na vista ganha `.is-in`: a mídia volta de 1,12× para 1× e o título sobe com fade (CSS).
 * Só ±6 cartas ao redor da posição atual são montadas. A carta é dimensionada pela altura medida do palco (`cardSize`).
 */
export function Carousel3D({ prompts, covers, subcategories, focusId, navEnabled = true }: Props) {
  const n = prompts.length;
  const start = () => Math.max(0, prompts.findIndex((p) => p.id === focusId));
  const [target, setTarget] = useState(start);
  const [center, setCenter] = useState(start);
  const [stageH, setStageH] = useState(() => window.innerHeight - 330);
  const stageEl = useRef<HTMLDivElement>(null);
  const pos = useRef(target);
  const vel = useRef(0);
  const goal = useRef(target);
  const raf = useRef(0);
  const last = useRef(0);
  const ringEl = useRef<HTMLDivElement>(null);
  const slotEls = useRef(new Map<number, HTMLDivElement>());

  const card = cardSize(stageH);
  const s = carouselStep(n);
  const r = carouselRadius(n, card.width);

  const paint = useCallback(() => {
    if (ringEl.current) ringEl.current.style.transform = `translateZ(${-r}px) rotateY(${-pos.current * s}deg)`;
    for (const el of slotEls.current.values()) {
      const a = ((((Number(el.dataset.k) - pos.current) * s) % 360) + 540) % 360 - 180;
      const op = cardOpacity(a);
      el.style.opacity = String(op);
      el.style.filter = `brightness(${cardBrightness(a)})`;
      el.style.pointerEvents = op === 0 ? "none" : "auto";
      el.classList.toggle("is-front", Number(el.dataset.k) === goal.current);
      const visible = op > 0;
      if (visible !== el.classList.contains("is-in")) {
        if (visible) void el.offsetWidth; // aplica o estado escondido antes, para a transição de entrada rodar
        el.classList.toggle("is-in", visible);
      }
    }
  }, [r, s]);

  const tick = useCallback((t: number) => {
    // springStep é exato com qualquer dt; o teto só evita um salto ao voltar de uma aba em segundo plano.
    const dt = Math.min(0.25, (t - last.current) / 1000);
    last.current = t;
    const next = springStep(pos.current, vel.current, goal.current, dt);
    const done = springSettled(next.pos, next.vel, goal.current);
    pos.current = done ? goal.current : next.pos;
    vel.current = done ? 0 : next.vel;
    paint();
    const c = Math.round(pos.current);
    setCenter((p) => (p === c ? p : c));
    raf.current = done ? 0 : requestAnimationFrame(tick);
  }, [paint]);

  const move = useCallback((d: number) => {
    if (d === 0) return;
    goal.current += d;
    setTarget(goal.current);
    if (reducedMotion()) {
      pos.current = goal.current;
      vel.current = 0;
      setCenter(goal.current);
      paint();
      return;
    }
    if (!raf.current) {
      last.current = performance.now();
      raf.current = requestAnimationFrame(tick);
    }
  }, [paint, tick]);

  useEffect(() => {
    cancelAnimationFrame(raf.current);
    raf.current = 0;
    const i = start();
    pos.current = goal.current = i;
    vel.current = 0;
    setTarget(i);
    setCenter(i);
  }, [n]); // só quando a lista muda; `focusId` vale para a montagem

  // Prompt aberto por fora da galeria (link direto, depois de salvar): leva a frente até ele sem animar.
  useEffect(() => {
    const i = prompts.findIndex((p) => p.id === focusId);
    if (i < 0 || n === 0 || ((goal.current % n) + n) % n === i) return;
    cancelAnimationFrame(raf.current);
    raf.current = 0;
    pos.current = goal.current = i;
    vel.current = 0;
    setTarget(i);
    setCenter(i);
  }, [focusId]); // `prompts`/`n` lidos no momento da troca

  // O palco ocupa o que sobra da janela (CSS `.app.is-gallery`); se título ou filtros quebram linha, a carta encolhe.
  useLayoutEffect(() => {
    const el = stageEl.current;
    if (!el) return;
    const measure = () => setStageH(Math.round(el.clientHeight));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => { ro.disconnect(); cancelAnimationFrame(raf.current); };
  }, []);

  // Cartas recém-montadas recebem transform/opacidade/`.is-in` antes do primeiro paint.
  useLayoutEffect(paint);

  const front = ((target % n) + n) % n;
  const open = (i: number) => {
    const el = [...slotEls.current.values()].find((e) => e.classList.contains("is-front"));
    const media = el?.querySelector(".card-media");
    if (media && !reducedMotion()) setFlight(prompts[i].id, media.getBoundingClientRect());
    window.location.hash = promptHref(prompts[i].id);
  };
  useGalleryNav({ enabled: n > 0 && navEnabled, onMove: move, onOpen: () => open(front) });

  // `k` é a posição absoluta no anel; cada prompt aparece uma vez, na posição mais próxima da frente.
  const cards = ringSlots(center, n, WINDOW);

  const click = (i: number) => {
    if (i === front) open(i);
    else move(shortestDelta(goal.current, i, n));
  };

  return (
    <div className="carousel" style={{ "--card-w": `${card.width}px`, "--card-h": `${card.height}px` } as CSSProperties}>
      <div className="stage" ref={stageEl}>
        <div className="ring" ref={ringEl}>
          {cards.map(({ k, i }) => {
            const id = prompts[i].id;
            return (
              <div
                key={id} className="slot" role="button" tabIndex={-1} data-k={k}
                aria-label={prompts[i].title}
                ref={(el) => { if (el) slotEls.current.set(id, el); else slotEls.current.delete(id); }}
                style={{ transform: `rotateY(${k * s}deg) translateZ(${r}px)` }}
                onClick={() => click(i)}
              >
                <PromptCard prompt={prompts[i]} cover={covers.get(id)} subcategories={subcategories} />
              </div>
            );
          })}
        </div>
      </div>
      <div className="carousel-foot">
        <button type="button" onClick={() => move(-1)} aria-label="Anterior">{arrow("M19 12H5M11 6l-6 6 6 6")}</button>
        <span className="counter">{String(front + 1).padStart(2, "0")} — {String(n).padStart(2, "0")}</span>
        <button type="button" onClick={() => move(1)} aria-label="Próximo">{arrow("M5 12h14M13 6l6 6-6 6")}</button>
      </div>
    </div>
  );
}

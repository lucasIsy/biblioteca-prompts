import { useEffect, useRef } from "react";
import { wheelSteps } from "../domain/navigation";

interface Options {
  /** Move `delta` cartas; o chamador decide o limite. */
  onMove: (delta: number) => void;
  onOpen: () => void;
  enabled: boolean;
}

/** ←/→/Enter e wheel (deltas acumulados: cada ~100 px = 1 carta, sem throttle). Ignora teclas com o foco num campo de texto. */
export function useGalleryNav({ onMove, onOpen, enabled }: Options) {
  const accum = useRef(0);
  const cb = useRef({ onMove, onOpen });
  cb.current = { onMove, onOpen };

  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (e.key === "ArrowRight") cb.current.onMove(1);
      else if (e.key === "ArrowLeft") cb.current.onMove(-1);
      else if (e.key === "Enter" && !(t && (t.tagName === "BUTTON" || t.tagName === "A"))) cb.current.onOpen();
      else return;
      e.preventDefault();
    };
    const onWheel = (e: WheelEvent) => {
      const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (d === 0) return;
      e.preventDefault();
      const r = wheelSteps(accum.current, d, e.deltaMode);
      accum.current = r.accum;
      if (r.steps !== 0) cb.current.onMove(r.steps);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("wheel", onWheel);
    };
  }, [enabled]);
}

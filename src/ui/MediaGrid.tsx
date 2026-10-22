import { useLayoutEffect, useRef, useState } from "react";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import type { Media, Prompt, Subcategory } from "../data/repository";
import { PromptTile } from "./PromptTile";

const MIN_COL = 240;
const GAP = 32;

interface Props {
  prompts: Prompt[];
  covers: Map<number, Media>;
  subcategories: Subcategory[];
}

/** Grade virtualizada por linhas; colunas seguem `repeat(auto-fill, minmax(240px, 1fr))`. */
export function MediaGrid({ prompts, covers, subcategories }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [offset, setOffset] = useState(0);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      setWidth(el.clientWidth);
      setOffset(el.getBoundingClientRect().top + window.scrollY);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const cols = Math.max(1, Math.floor((width + GAP) / (MIN_COL + GAP)));
  const tileW = width > 0 ? (width - GAP * (cols - 1)) / cols : MIN_COL;
  const rowCount = Math.ceil(prompts.length / cols);

  const virtual = useWindowVirtualizer({
    count: rowCount,
    estimateSize: () => tileW * 1.25 + 16 + 50 + 48,
    overscan: 3,
    scrollMargin: offset,
  });

  return (
    <div ref={ref} style={{ position: "relative", height: virtual.getTotalSize() }}>
      {virtual.getVirtualItems().map((row) => (
        <div
          key={row.key}
          data-index={row.index}
          ref={virtual.measureElement}
          className="grid-row"
          style={{
            position: "absolute", top: 0, left: 0, width: "100%",
            gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
            transform: `translateY(${row.start - virtual.options.scrollMargin}px)`,
          }}
        >
          {prompts.slice(row.index * cols, row.index * cols + cols).map((p) => (
            <PromptTile key={p.id} prompt={p} cover={covers.get(p.id)} subcategories={subcategories} />
          ))}
        </div>
      ))}
    </div>
  );
}

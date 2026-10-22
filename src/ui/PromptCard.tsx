import { useState } from "react";
import type { Media, Prompt, Subcategory } from "../data/repository";
import { framingStyle } from "../domain/media";
import { useMediaUrl } from "../hooks/useMediaUrl";

interface Props {
  prompt: Prompt;
  cover: Media | undefined;
  subcategories: Subcategory[];
}

/** Carta da galeria: imagem usa `thumb`; vídeo mostra o thumb e só carrega o `<video>` no hover. Nome e subcategorias ficam sobre a mídia, no rodapé. */
export function PromptCard({ prompt, cover, subcategories }: Props) {
  const [hover, setHover] = useState(false);
  const thumb = useMediaUrl(cover?.thumbPath);
  const video = useMediaUrl(hover && cover?.kind === "video" ? cover.displayPath : null);
  const fit = cover ? framingStyle(cover, cover.width, cover.height) : undefined;
  const tag = subcategories.filter((s) => prompt.subcategoryIds.includes(s.id)).map((s) => s.name).join(" · ");
  return (
    <div className="card" onPointerEnter={() => setHover(true)} onPointerLeave={() => setHover(false)}>
      <div className="card-media">
        <div className="card-zoom">
          {thumb && <img src={thumb} alt="" decoding="async" draggable={false} style={fit} />}
          {video && <video src={video} style={fit} autoPlay muted loop playsInline preload="none" />}
        </div>
        <div className="card-cap">
          <span className="card-name">{prompt.title}</span>
          {tag && <span className="card-tag">{tag}</span>}
        </div>
      </div>
    </div>
  );
}

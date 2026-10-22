import type { Media, Prompt, Subcategory } from "../data/repository";
import { useMediaUrl } from "../hooks/useMediaUrl";
import { promptHref } from "../domain/routes";

interface Props {
  prompt: Prompt;
  cover: Media | undefined;
  subcategories: Subcategory[];
}

export function PromptTile({ prompt, cover, subcategories }: Props) {
  const url = useMediaUrl(cover?.thumbPath);
  const tag = subcategories.filter((s) => prompt.subcategoryIds.includes(s.id)).map((s) => s.name).join(" · ");
  return (
    <a href={promptHref(prompt.id)} className="tile">
      <span className="tile-media" aria-hidden="true">
        {url && <img src={url} alt="" loading="lazy" decoding="async" />}
      </span>
      <span className="tile-info">
        <span className="tile-name">{prompt.title}</span>
        {tag && <span className="tile-tag">{tag}</span>}
      </span>
    </a>
  );
}

import { useEffect, useState } from "react";
import { urlFor } from "../data/media";

/** Resolve um caminho relativo de mídia em URL do asset protocol; `null` enquanto carrega ou sem caminho. */
export function useMediaUrl(rel: string | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    setUrl(null);
    if (rel) void urlFor(rel).then((u) => { if (alive) setUrl(u); }).catch(() => {});
    return () => { alive = false; };
  }, [rel]);
  return url;
}

import { useEffect, useState } from "react";
import { parseHash } from "../domain/routes";
import type { Route } from "../domain/routes";

export function useHashRoute(): Route | null {
  const [route, setRoute] = useState(() => parseHash(window.location.hash));
  useEffect(() => {
    const on = () => setRoute(parseHash(window.location.hash));
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return route;
}

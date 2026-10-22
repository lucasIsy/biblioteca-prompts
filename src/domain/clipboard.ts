import type { Prompt } from "../data/repository";

// Copiar = markdown original, nunca o HTML renderizado.
export const getCopyText = (prompt: Pick<Prompt, "markdown">): string => prompt.markdown;

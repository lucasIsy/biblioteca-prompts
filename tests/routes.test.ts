import { describe, expect, it } from "vitest";
import { categoryHref, editHref, newPromptHref, parseHash, promptHref, SETTINGS_HREF, settingsHref } from "../src/domain/routes";

describe("routes", () => {
  it("lê categoria, prompt e sem categoria", () => {
    expect(parseHash("#/c/sites")).toEqual({ name: "category", slug: "sites" });
    expect(parseHash("#/p/12")).toEqual({ name: "prompt", id: 12 });
    expect(parseHash("#/c/sem-categoria")).toEqual({ name: "uncategorized" });
  });
  it("vazio ou inválido → null", () => {
    expect(parseHash("")).toBeNull();
    expect(parseHash("#/p/abc")).toBeNull();
    expect(parseHash("#/x")).toBeNull();
  });
  it("href faz round-trip", () => {
    expect(parseHash(categoryHref("minha cat"))).toEqual({ name: "category", slug: "minha cat" });
    expect(parseHash(promptHref(3))).toEqual({ name: "prompt", id: 3 });
  });
  it("rotas de formulário e configurações", () => {
    expect(parseHash(newPromptHref())).toEqual({ name: "new", categorySlug: null });
    expect(parseHash(newPromptHref("sites"))).toEqual({ name: "new", categorySlug: "sites" });
    expect(parseHash(editHref(4))).toEqual({ name: "edit", id: 4 });
    expect(parseHash(SETTINGS_HREF)).toEqual({ name: "settings", categorySlug: null });
    expect(parseHash(settingsHref("imagens"))).toEqual({ name: "settings", categorySlug: "imagens" });
    expect(parseHash("#/edit/x")).toBeNull();
  });
});

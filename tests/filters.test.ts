import { describe, it, expect } from "vitest";
import { filterPrompts } from "../src/domain/filters";
import type { Prompt } from "../src/data/repository";

const p = (id: number, title: string, categoryId: number | null, subcategoryIds: number[] = []): Prompt =>
  ({ id, title, categoryId, subcategoryIds, markdown: "", createdAt: "", updatedAt: "" });
const list = [
  p(1, "Café na Praça", 1, [10]),
  p(2, "Cidade  Noturna", 1, [11]),
  p(3, "Landing page", 3, [10, 12]),
  p(4, "Solto", null),
];
const ids = (r: Prompt[]) => r.map((x) => x.id);

describe("filterPrompts", () => {
  it("filtro vazio é neutro", () => {
    expect(ids(filterPrompts(list))).toEqual([1, 2, 3, 4]);
    expect(ids(filterPrompts(list, { query: "  ", subcategoryIds: [] }))).toEqual([1, 2, 3, 4]);
  });
  it("busca ignora acento, caixa e espaços", () => {
    expect(ids(filterPrompts(list, { query: "CAFE" }))).toEqual([1]);
    expect(ids(filterPrompts(list, { query: "cidade noturna" }))).toEqual([2]);
    expect(ids(filterPrompts(list, { query: "  pra" }))).toEqual([1]);
  });
  it("categoria: id, null = Sem categoria, undefined = todas", () => {
    expect(ids(filterPrompts(list, { categoryId: 1 }))).toEqual([1, 2]);
    expect(ids(filterPrompts(list, { categoryId: null }))).toEqual([4]);
  });
  it("subcategorias: OU entre as selecionadas", () => {
    expect(ids(filterPrompts(list, { subcategoryIds: [10] }))).toEqual([1, 3]);
    expect(ids(filterPrompts(list, { subcategoryIds: [11, 12] }))).toEqual([2, 3]);
  });
  it("combinados", () => {
    expect(ids(filterPrompts(list, { categoryId: 1, subcategoryIds: [10], query: "praca" }))).toEqual([1]);
    expect(ids(filterPrompts(list, { categoryId: 3, query: "cafe" }))).toEqual([]);
  });
  it("lista vazia", () => {
    expect(filterPrompts([], { query: "x" })).toEqual([]);
  });
});

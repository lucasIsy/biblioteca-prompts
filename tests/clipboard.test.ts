import { describe, it, expect } from "vitest";
import { getCopyText } from "../src/domain/clipboard";

describe("getCopyText", () => {
  it.each([
    ["código", "# T\n\n```ts\nconst a = `x`;\n```\n"],
    ["tabela", "| a | b |\n|---|---|\n| 1 | 2 |"],
    ["CRLF", "linha1\r\nlinha2\r\n"],
    ["unicode", "Ação — 日本語 😀 é"],
    ["vazio", ""],
  ])("%s idêntico", (_n, md) => {
    expect(getCopyText({ markdown: md })).toBe(md);
  });
});

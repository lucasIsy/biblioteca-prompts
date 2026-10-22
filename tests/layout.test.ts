import { describe, it, expect } from "vitest";
import { layoutFor } from "../src/domain/layout";

const cat = (isSystem: boolean, mediaKind: "image" | "video" | null) => ({ isSystem, mediaKind });

describe("layoutFor", () => {
  it("Imagens e Vídeos → gallery", () => {
    expect(layoutFor(cat(true, "image"))).toBe("gallery");
    expect(layoutFor(cat(true, "video"))).toBe("gallery");
  });
  it("Sites/Apps/Outros e categoria nova → grid", () => {
    expect(layoutFor(cat(false, null))).toBe("grid");
    expect(layoutFor(cat(false, "image"))).toBe("grid");
  });
  it("Sem categoria → grid", () => {
    expect(layoutFor(null)).toBe("grid");
  });
});

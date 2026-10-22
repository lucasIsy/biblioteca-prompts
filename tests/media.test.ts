import { describe, expect, it } from "vitest";
import { clampFraming, containZoom, framingStyle, fitWithin, folderOfPath, foldersOfMedia, posterTime, videoMimeFor } from "../src/domain/media";

describe("domain/media", () => {
  it("fitWithin reduz pelo lado maior e nunca amplia", () => {
    expect(fitWithin(4000, 2000, 2560)).toEqual({ width: 2560, height: 1280 });
    expect(fitWithin(1000, 3000, 400)).toEqual({ width: 133, height: 400 });
    expect(fitWithin(300, 200, 400)).toEqual({ width: 300, height: 200 });
  });
  it("videoMimeFor aceita só mp4/webm", () => {
    expect(videoMimeFor("a.MP4")).toBe("video/mp4");
    expect(videoMimeFor("C:\\x\\a.webm")).toBe("video/webm");
    expect(videoMimeFor("a.mkv")).toBeNull();
    expect(videoMimeFor("semext")).toBeNull();
  });
  it("posterTime = min(1 s, 10%)", () => {
    expect(posterTime(5)).toBe(0.5);
    expect(posterTime(60)).toBe(1);
    expect(posterTime(NaN)).toBe(0);
  });
  it("folderOfPath", () => {
    expect(folderOfPath("media/abc/thumb.webp")).toBe("media/abc");
  });
  it("foldersOfMedia junta pastas únicas", () => {
    const m = (id: string, poster: string | null = null) =>
      ({ thumbPath: `media/${id}/thumb.webp`, displayPath: `media/${id}/video.mp4`, posterPath: poster });
    expect(foldersOfMedia([m("a", "media/a/poster.webp"), m("b"), m("a")])).toEqual(["media/a", "media/b"]);
  });
  it("clampFraming limita e usa o padrão", () => {
    expect(clampFraming({})).toEqual({ fitZoom: 1, fitX: 0.5, fitY: 0.5 });
    expect(clampFraming({ fitZoom: 9, fitX: -1, fitY: 2 })).toEqual({ fitZoom: 3, fitX: 0, fitY: 1 });
    expect(clampFraming({ fitZoom: NaN }).fitZoom).toBe(1);
  });
  it("framingStyle monta posição, escala e origem", () => {
    // 2:1 numa carta 0,72: preenchimento = altura 100% e largura 277,78%, deslocado pelo ponto focal
    expect(framingStyle({ fitZoom: 0.5, fitX: 0.25, fitY: 1 }, 200, 100)).toMatchObject({
      width: "277.78%", height: "100%", left: "-44.44%", top: "0%", transform: "scale(0.5)", transformOrigin: "25% 100%",
    });
    // sem tamanho conhecido, cai no formato da carta (= preencher)
    expect(framingStyle({}, null, null)).toMatchObject({ width: "100%", height: "100%", left: "0%" });
  });
  it("containZoom mostra a imagem inteira", () => {
    expect(containZoom(1440, 720)).toBeCloseTo(0.36);
    expect(containZoom(720, 1000)).toBeCloseTo(1);
    expect(containZoom(null, null)).toBe(1);
  });
});

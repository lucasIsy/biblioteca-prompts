import { describe, expect, it } from "vitest";
import { fitWithin, folderOfPath, foldersOfMedia, posterTime, videoMimeFor } from "../src/domain/media";

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
});

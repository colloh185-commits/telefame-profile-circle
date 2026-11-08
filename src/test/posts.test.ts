import { describe, expect, it } from "vitest";
import jpeg from "jpeg-js";
import {
  extractHashtags,
  mergeHashtags,
  normalizeHashtag,
  prepareUploadsSchema,
  publishSchema,
  toSong,
  videoOutputSize,
} from "@/lib/post-rules";
import { stripJpegMetadata } from "@/lib/jpeg-strip";
import { cropFor } from "@/lib/video-edit";

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const base = { people: [], hashtags: [], songId: null };

describe("photo posts", () => {
  it("allow up to 10 photos", () => {
    const photos = Array.from({ length: 10 }, (_, i) => uuid(i));
    expect(publishSchema.safeParse({ kind: "photo", body: "", photos, ...base }).success).toBe(true);
  });
  it("reject 11 photos", () => {
    const photos = Array.from({ length: 11 }, (_, i) => uuid(i));
    expect(publishSchema.safeParse({ kind: "photo", body: "", photos, ...base }).success).toBe(false);
  });
  it("reject a caption over 2200 characters", () => {
    const r = publishSchema.safeParse({ kind: "photo", body: "a".repeat(2201), photos: [uuid(1)], ...base });
    expect(r.success).toBe(false);
  });
});

describe("text posts", () => {
  const ok = { kind: "text", background: "ocean", font: "serif", ...base };
  it("need some text and allow up to 280 characters", () => {
    expect(publishSchema.safeParse({ ...ok, body: "   " }).success).toBe(false);
    expect(publishSchema.safeParse({ ...ok, body: "a".repeat(280) }).success).toBe(true);
    expect(publishSchema.safeParse({ ...ok, body: "a".repeat(281) }).success).toBe(false);
  });
  it("reject unknown backgrounds and fonts", () => {
    expect(publishSchema.safeParse({ ...ok, body: "hi", background: "neon" }).success).toBe(false);
    expect(publishSchema.safeParse({ ...ok, body: "hi", font: "comic" }).success).toBe(false);
  });
});

describe("tags", () => {
  it("normalise hashtags", () => {
    expect(normalizeHashtag("#Book_Club")).toBe("book_club");
    expect(normalizeHashtag("#has space")).toBeNull();
    expect(normalizeHashtag("#" + "a".repeat(31))).toBeNull();
  });
  it("find hashtags written in text", () => {
    expect(extractHashtags("Reading #Fantasy and #books #fantasy")).toEqual(["fantasy", "books"]);
  });
  it("allow at most 10 hashtags counting the ones in the caption", () => {
    const chosen = Array.from({ length: 8 }, (_, i) => `tag${i}`);
    expect(mergeHashtags(chosen, "#x #y")).toHaveLength(10);
    const r = publishSchema.safeParse({
      kind: "text", background: "brand", font: "sans", body: "#x #y #z", people: [], hashtags: chosen, songId: null,
    });
    expect(r.success).toBe(false);
  });
  it("allow at most 20 tagged people", () => {
    const people = Array.from({ length: 21 }, (_, i) => uuid(i));
    const r = publishSchema.safeParse({ kind: "text", background: "brand", font: "sans", body: "hi", people, hashtags: [], songId: null });
    expect(r.success).toBe(false);
  });
});

describe("upload slots", () => {
  it("are either photos or one video", () => {
    expect(prepareUploadsSchema.safeParse({ photos: 3, video: false }).success).toBe(true);
    expect(prepareUploadsSchema.safeParse({ photos: 0, video: true }).success).toBe(true);
    expect(prepareUploadsSchema.safeParse({ photos: 2, video: true }).success).toBe(false);
    expect(prepareUploadsSchema.safeParse({ photos: 11, video: false }).success).toBe(false);
  });
});

describe("video sizing", () => {
  it("fits landscape into 1280x720 and portrait into 720x1280", () => {
    expect(videoOutputSize(1920, 1080)).toEqual({ width: 1280, height: 720 });
    expect(videoOutputSize(1080, 1920)).toEqual({ width: 720, height: 1280 });
  });
  it("never upscales and keeps sizes even", () => {
    expect(videoOutputSize(641, 361)).toEqual({ width: 642, height: 362 });
  });
  it("crops a centred square", () => {
    expect(cropFor(1920, 1080, 1, 0.5, 0.5)).toEqual({ left: 420, top: 0, width: 1080, height: 1080 });
  });
});

describe("song links", () => {
  it("only accept previews from the music catalogue", () => {
    const t = { trackId: 1, trackName: "Song", artistName: "Artist", previewUrl: "https://audio-ssl.itunes.apple.com/x.m4a" };
    expect(toSong(t)).not.toBeNull();
    expect(toSong({ ...t, previewUrl: "https://evil.example.com/x.m4a" })).toBeNull();
    expect(toSong({ ...t, previewUrl: "http://audio-ssl.itunes.apple.com/x.m4a" })).toBeNull();
  });
});

describe("photo metadata stripping", () => {
  const w = 16;
  const h = 16;
  const pixels = new Uint8Array(w * h * 4).fill(200);
  const clean = new Uint8Array(jpeg.encode({ data: pixels, width: w, height: h }, 80).data);

  // Insert an APP1 "Exif" segment with a fake GPS payload right after SOI, plus junk after EOI.
  const payload = new TextEncoder().encode("Exif\0\0GPS:-1.28,36.82");
  const app1 = new Uint8Array([0xff, 0xe1, 0, payload.length + 2, ...payload]);
  const junk = new TextEncoder().encode("<script>alert(1)</script>");
  const dirty = new Uint8Array([...clean.subarray(0, 2), ...app1, ...clean.subarray(2), ...junk]);

  it("removes metadata segments and anything after the image ends", () => {
    const out = stripJpegMetadata(dirty)!;
    const text = new TextDecoder("latin1").decode(out);
    expect(text).not.toContain("GPS");
    expect(text).not.toContain("<script>");
    expect(out[out.length - 2]).toBe(0xff);
    expect(out[out.length - 1]).toBe(0xd9);
    expect(jpeg.decode(out, { useTArray: true }).width).toBe(w);
  });
  it("rejects bytes that aren't a JPEG", () => {
    expect(stripJpegMetadata(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]))).toBeNull();
    expect(stripJpegMetadata(clean.subarray(0, clean.length - 2))).toBeNull();
  });
});

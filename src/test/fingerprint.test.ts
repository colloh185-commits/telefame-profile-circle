import { describe, expect, it } from "vitest";
import jpeg from "jpeg-js";
import { dHash, hammingDistance } from "@/lib/fingerprint";
import { sanitizeAvatarJpeg } from "@/lib/image-sanitize.server";

function makeImage(size: number, invert = false) {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const v = Math.round(((x + y) / (2 * size)) * 255 + 40 * Math.sin(x / 9));
      const c = invert ? 255 - v : v;
      data[i] = c;
      data[i + 1] = (c * 0.7) | 0;
      data[i + 2] = 255 - c;
      data[i + 3] = 255;
    }
  }
  return data;
}

function jpegOf(size: number, quality: number, invert = false) {
  const enc = jpeg.encode({ data: makeImage(size, invert), width: size, height: size }, quality);
  return new Uint8Array(enc.data);
}

describe("upload fingerprints", () => {
  it("stores a 64-char sha256 and 16-char perceptual hash for a valid photo", async () => {
    const res = await sanitizeAvatarJpeg(jpegOf(128, 90));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(res.phash).toMatch(/^[0-9a-f]{16}$/);
  });

  it("gives near-identical perceptual hashes to the same photo at different compression", async () => {
    const a = await sanitizeAvatarJpeg(jpegOf(128, 95));
    const b = await sanitizeAvatarJpeg(jpegOf(128, 40));
    if (!a.ok || !b.ok) throw new Error("decode failed");
    expect(hammingDistance(a.phash, b.phash)).toBeLessThanOrEqual(6);
  });

  it("gives clearly different perceptual hashes to different photos", () => {
    const a = dHash(makeImage(64), 64, 64);
    const b = dHash(makeImage(64, true), 64, 64);
    expect(hammingDistance(a, b)).toBeGreaterThan(20);
  });

  it("rejects photos smaller than 64 pixels", async () => {
    const res = await sanitizeAvatarJpeg(jpegOf(32, 90));
    expect(res.ok).toBe(false);
  });

  it("rejects bytes that are not a decodable JPEG", async () => {
    const bad = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4, 5, 6, 7, 8]);
    const res = await sanitizeAvatarJpeg(bad);
    expect(res.ok).toBe(false);
  });
});

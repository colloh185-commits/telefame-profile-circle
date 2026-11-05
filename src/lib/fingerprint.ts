/** Exact fingerprint: SHA-256 of the stored file bytes, hex encoded. */
export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Perceptual fingerprint (64-bit difference hash). Visually similar images —
 * resized, re-compressed, slightly recoloured — get hashes a few bits apart.
 * `rgba` is width*height*4 bytes.
 */
export function dHash(rgba: Uint8Array, width: number, height: number): string {
  const W = 9;
  const H = 8;
  const gray = new Float64Array(W * H);
  for (let y = 0; y < H; y++) {
    const y0 = Math.floor((y * height) / H);
    const y1 = Math.max(y0 + 1, Math.floor(((y + 1) * height) / H));
    for (let x = 0; x < W; x++) {
      const x0 = Math.floor((x * width) / W);
      const x1 = Math.max(x0 + 1, Math.floor(((x + 1) * width) / W));
      let sum = 0;
      let n = 0;
      for (let yy = y0; yy < y1; yy++) {
        for (let xx = x0; xx < x1; xx++) {
          const i = (yy * width + xx) * 4;
          sum += 0.299 * (rgba[i] ?? 0) + 0.587 * (rgba[i + 1] ?? 0) + 0.114 * (rgba[i + 2] ?? 0);
          n++;
        }
      }
      gray[y * W + x] = sum / n;
    }
  }
  let hex = "";
  for (let y = 0; y < H; y++) {
    let byte = 0;
    for (let x = 0; x < 8; x++) {
      byte = (byte << 1) | ((gray[y * W + x] ?? 0) > (gray[y * W + x + 1] ?? 0) ? 1 : 0);
    }
    hex += byte.toString(16).padStart(2, "0");
  }
  return hex;
}

/** Number of differing bits between two hex hashes of equal length. */
export function hammingDistance(a: string, b: string): number {
  if (a.length !== b.length) throw new Error("Hash lengths differ");
  let d = 0;
  for (let i = 0; i < a.length; i += 2) {
    let x = parseInt(a.slice(i, i + 2), 16) ^ parseInt(b.slice(i, i + 2), 16);
    while (x) {
      d += x & 1;
      x >>= 1;
    }
  }
  return d;
}

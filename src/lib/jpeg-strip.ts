/**
 * Rewrites a JPEG keeping only what's needed to draw it: drops every APPn
 * segment (EXIF, GPS, XMP, ICC, thumbnails) and comments, and anything after
 * the end-of-image marker. Pure byte surgery, so it's fast even on the server.
 * Returns null when the bytes aren't a well-formed JPEG.
 */
export function stripJpegMetadata(b: Uint8Array): Uint8Array | null {
  const n = b.length;
  if (n < 4 || b[0] !== 0xff || b[1] !== 0xd8) return null;
  const parts: Uint8Array[] = [b.subarray(0, 2)];
  let size = 2;
  const push = (p: Uint8Array) => {
    parts.push(p);
    size += p.length;
  };
  let i = 2;
  let sawScan = false;

  while (i < n) {
    if (b[i] !== 0xff) return null;
    while (i + 1 < n && b[i + 1] === 0xff) i++; // fill bytes
    if (i + 1 >= n) return null;
    const marker = b[i + 1]!;

    if (marker === 0xd9) {
      if (!sawScan) return null;
      push(b.subarray(i, i + 2));
      const out = new Uint8Array(size);
      let o = 0;
      for (const p of parts) {
        out.set(p, o);
        o += p.length;
      }
      return out;
    }
    if ((marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
      push(b.subarray(i, i + 2));
      i += 2;
      continue;
    }
    if (i + 4 > n) return null;
    const len = (b[i + 2]! << 8) | b[i + 3]!;
    if (len < 2 || i + 2 + len > n) return null;
    const end = i + 2 + len;

    if (marker === 0xda) {
      sawScan = true;
      // Entropy-coded data runs until the next real marker.
      let j = end;
      while (j < n) {
        if (b[j] === 0xff) {
          const next = b[j + 1];
          if (next !== undefined && next !== 0x00 && !(next >= 0xd0 && next <= 0xd7)) break;
        }
        j++;
      }
      push(b.subarray(i, j));
      i = j;
      continue;
    }

    const isApp = marker >= 0xe0 && marker <= 0xef;
    const isComment = marker === 0xfe;
    if (!isApp && !isComment) push(b.subarray(i, end));
    i = end;
  }
  return null;
}

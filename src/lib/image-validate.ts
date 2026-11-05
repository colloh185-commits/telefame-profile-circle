export type ImageKind = "webp" | "jpg" | "png";

export const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
export const MIN_AVATAR_BYTES = 100;

export const CONTENT_TYPES: Record<ImageKind, string> = {
  webp: "image/webp",
  jpg: "image/jpeg",
  png: "image/png",
};

/** Identify an image purely by its file signature (magic bytes), never by name. */
export function detectImageKind(b: Uint8Array): ImageKind | null {
  if (b.length < 12) return null;
  // RIFF....WEBP
  if (
    b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
    b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50
  ) {
    return "webp";
  }
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpg";
  if (
    b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 &&
    b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a
  ) {
    return "png";
  }
  return null;
}

/** Rejects polyglot files that smuggle markup or script inside image bytes. */
export function containsMarkup(b: Uint8Array): boolean {
  let text = "";
  for (let i = 0; i < b.length; i++) text += String.fromCharCode(b[i] ?? 0);
  return /<script|<svg|<\?php|<html|<iframe|<body|javascript:/i.test(text);
}

export function decodeBase64(input: string): Uint8Array | null {
  const cleaned = input.replace(/^data:[^;]+;base64,/, "");
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(cleaned)) return null;
  try {
    const bin = atob(cleaned);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

export type AvatarCheck =
  | { ok: true; kind: ImageKind; bytes: Uint8Array }
  | { ok: false; error: string };

export function validateAvatarBytes(base64: string): AvatarCheck {
  const bytes = decodeBase64(base64);
  if (!bytes) return { ok: false, error: "The photo could not be read" };
  if (bytes.length < MIN_AVATAR_BYTES) return { ok: false, error: "The photo is empty or damaged" };
  if (bytes.length > MAX_AVATAR_BYTES) return { ok: false, error: "The photo must be 2 MB or smaller" };
  const kind = detectImageKind(bytes);
  if (!kind) return { ok: false, error: "Only JPG, PNG or WebP photos are allowed" };
  if (containsMarkup(bytes)) return { ok: false, error: "This file is not a safe image" };
  return { ok: true, kind, bytes };
}

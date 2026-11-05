import jpeg from "jpeg-js";
import { dHash, sha256Hex } from "./fingerprint";

export const AVATAR_MIN_SIDE = 64;
export const AVATAR_MAX_SIDE = 1024;
export const AVATAR_JPEG_QUALITY = 80;

export type SanitizedAvatar =
  | {
      ok: true;
      bytes: Uint8Array;
      width: number;
      height: number;
      sha256: string;
      phash: string;
    }
  | { ok: false; error: string };

/**
 * Fully decodes the JPEG and re-encodes the raw pixels on the server, so the
 * stored file contains nothing but image data (no metadata, no hidden payload).
 * Also computes exact + perceptual fingerprints for moderation.
 */
export async function sanitizeAvatarJpeg(input: Uint8Array): Promise<SanitizedAvatar> {
  let decoded: { width: number; height: number; data: Uint8Array };
  try {
    decoded = jpeg.decode(input, {
      useTArray: true,
      formatAsRGBA: true,
      tolerantDecoding: false,
      maxResolutionInMP: 2,
      maxMemoryUsageInMB: 64,
    });
  } catch {
    return { ok: false, error: "The photo could not be read. Please choose another one." };
  }

  const { width, height, data } = decoded;
  if (width < AVATAR_MIN_SIDE || height < AVATAR_MIN_SIDE) {
    return { ok: false, error: "Photo is too small" };
  }
  if (width > AVATAR_MAX_SIDE || height > AVATAR_MAX_SIDE) {
    return { ok: false, error: "Photo is too large" };
  }

  const encoded = jpeg.encode({ data, width, height }, AVATAR_JPEG_QUALITY);
  const bytes = new Uint8Array(encoded.data.buffer, encoded.data.byteOffset, encoded.data.byteLength);

  return {
    ok: true,
    bytes,
    width,
    height,
    sha256: await sha256Hex(bytes),
    phash: dHash(data, width, height),
  };
}

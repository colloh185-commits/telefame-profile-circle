import jpeg from "jpeg-js";
import { EncodedPacketSink, Input, MP4, UrlSource } from "mediabunny";
import { sha256 as nobleSha256 } from "@noble/hashes/sha2.js";
import { dHash, sha256Hex } from "./fingerprint";
import { stripJpegMetadata } from "./jpeg-strip";
import { decodeBase64, detectImageKind } from "./image-validate";
import {
  FRAME_FP_WIDTH,
  MAX_KEYFRAMES,
  MAX_VIDEO_SECONDS,
  MAX_VIDEO_STORED_BYTES,
  VIDEO_MAX_LONG,
  VIDEO_MAX_SHORT,
} from "./post-rules";

export type CheckedImage =
  | { ok: true; bytes: Uint8Array; width: number; height: number; sha256: string; phash: string }
  | { ok: false; error: string };

/**
 * Accepts only JPEGs, removes all metadata segments, then fully decodes the
 * pixels to prove it's a real image and to compute exact + perceptual fingerprints.
 */
export async function checkJpeg(input: Uint8Array, maxSide: number, minSide = 16): Promise<CheckedImage> {
  if (detectImageKind(input) !== "jpg") return { ok: false, error: "A photo isn't in a supported format." };
  const bytes = stripJpegMetadata(input);
  if (!bytes) return { ok: false, error: "A photo is damaged. Choose another one." };

  let decoded: { width: number; height: number; data: Uint8Array };
  try {
    decoded = jpeg.decode(bytes, {
      useTArray: true,
      formatAsRGBA: true,
      tolerantDecoding: false,
      maxResolutionInMP: (maxSide * maxSide) / 1_000_000 + 0.1,
      maxMemoryUsageInMB: 96,
    });
  } catch {
    return { ok: false, error: "A photo couldn't be read. Choose another one." };
  }
  const { width, height, data } = decoded;
  if (width < minSide || height < minSide) return { ok: false, error: "A photo is too small." };
  if (width > maxSide || height > maxSide) return { ok: false, error: "A photo is too large." };

  return { ok: true, bytes, width, height, sha256: await sha256Hex(bytes), phash: dHash(data, width, height) };
}

/** A keyframe still sent by the app, as base64 JPEG. */
export async function checkFrame(base64: string): Promise<CheckedImage> {
  const bytes = decodeBase64(base64);
  if (!bytes) return { ok: false, error: "bad frame" };
  return checkJpeg(bytes, FRAME_FP_WIDTH * 2, 8);
}

type Hasher = { update(chunk: Uint8Array): Promise<void> | void; done(): Promise<string> };

const toHex = (buf: ArrayBuffer | Uint8Array) =>
  Array.from(buf instanceof Uint8Array ? buf : new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");

/** Streaming SHA-256: native digest stream when the runtime has one, pure JS otherwise. */
function createHasher(): Hasher {
  type DigestStreamCtor = new (alg: string) => WritableStream<Uint8Array> & { digest: Promise<ArrayBuffer> };
  const DS = (globalThis.crypto as unknown as { DigestStream?: DigestStreamCtor }).DigestStream;
  if (DS) {
    const ds = new DS("SHA-256");
    const w = ds.getWriter();
    return {
      update: (c) => w.write(c),
      done: async () => {
        await w.close();
        return toHex(await ds.digest);
      },
    };
  }
  const h = nobleSha256.create();
  return {
    update: (c) => {
      h.update(c);
    },
    done: async () => toHex(h.digest()),
  };
}

export type VideoReport =
  | {
      ok: true;
      sha256: string;
      byteSize: number;
      width: number;
      height: number;
      durationMs: number;
      hasAudio: boolean;
      keyframes: number[];
    }
  | { ok: false; error: string };

const bad = (error = "The video couldn't be verified. Try again.") => ({ ok: false as const, error });

/**
 * Checks an uploaded video without trusting the client: stored type, size and
 * MP4 signature, a SHA-256 of every byte, then reads the container to confirm
 * codec, dimensions, duration, audio and the exact list of keyframes.
 */
export async function inspectVideo(url: string): Promise<VideoReport> {
  const res = await fetch(url);
  if (!res.ok || !res.body) return bad("The video didn't finish uploading. Try again.");
  const type = res.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase();
  if (type !== "video/mp4") {
    await res.body.cancel();
    return bad();
  }
  const declared = Number(res.headers.get("content-length") ?? 0);
  if (declared > MAX_VIDEO_STORED_BYTES) {
    await res.body.cancel();
    return bad("The video is too large.");
  }

  const hasher = createHasher();
  const reader = res.body.getReader();
  let total = 0;
  let head: Uint8Array | null = null;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!head) head = value.subarray(0, 12);
    total += value.byteLength;
    if (total > MAX_VIDEO_STORED_BYTES) {
      await reader.cancel();
      return bad("The video is too large.");
    }
    await hasher.update(value);
  }
  // ISO-BMFF: bytes 4..7 spell "ftyp".
  if (!head || head.length < 12 || head[4] !== 0x66 || head[5] !== 0x74 || head[6] !== 0x79 || head[7] !== 0x70) {
    return bad();
  }
  const sha256 = await hasher.done();

  const input = new Input({ source: new UrlSource(url), formats: [MP4] });
  try {
    const tracks = await input.getTracks();
    if (tracks.length > 2) return bad();
    const video = await input.getPrimaryVideoTrack();
    if (!video || (await video.getCodec()) !== "avc") return bad();
    const width = await video.getDisplayWidth();
    const height = await video.getDisplayHeight();
    if (Math.max(width, height) > VIDEO_MAX_LONG || Math.min(width, height) > VIDEO_MAX_SHORT) return bad();

    const audio = await input.getPrimaryAudioTrack();
    if (audio) {
      const codec = await audio.getCodec();
      if (codec !== "aac" && codec !== "opus") return bad();
    }
    if (tracks.length !== 1 + (audio ? 1 : 0)) return bad();

    const duration = await input.computeDuration();
    if (!(duration > 0.3) || duration > MAX_VIDEO_SECONDS + 1) return bad("The video is too long.");

    const sink = new EncodedPacketSink(video);
    const keyframes: number[] = [];
    let p = await sink.getFirstPacket({ metadataOnly: true });
    while (p) {
      if (p.type === "key") keyframes.push(p.timestamp);
      if (keyframes.length > MAX_KEYFRAMES) return bad();
      p = await sink.getNextKeyPacket(p, { metadataOnly: true });
    }
    if (!keyframes.length) return bad();

    return {
      ok: true,
      sha256,
      byteSize: total,
      width,
      height,
      durationMs: Math.round(duration * 1000),
      hasAudio: !!audio,
      keyframes,
    };
  } catch (err) {
    console.error("inspectVideo failed", err);
    return bad();
  } finally {
    input.dispose?.();
  }
}

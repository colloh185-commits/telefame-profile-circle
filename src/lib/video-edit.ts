import {
  ALL_FORMATS,
  BlobSource,
  BufferTarget,
  CanvasSink,
  Conversion,
  ConversionCanceledError,
  EncodedPacketSink,
  Input,
  Mp4OutputFormat,
  Output,
  QUALITY_MEDIUM,
  canEncodeAudio,
  canEncodeVideo,
  type InputVideoTrack,
} from "mediabunny";
import { FRAME_FP_WIDTH, MAX_KEYFRAMES, MAX_VIDEO_INPUT_BYTES, videoOutputSize } from "./post-rules";
import { MediaError, blobToBase64, canvasToJpeg } from "./media-canvas";

export type Crop = { left: number; top: number; width: number; height: number };

export function videoEditingSupported(): boolean {
  return typeof window !== "undefined" && "VideoEncoder" in window && "VideoDecoder" in window;
}

export type VideoHandle = {
  file: File;
  duration: number;
  width: number;
  height: number;
  hasAudio: boolean;
  /** False when this browser can't re-encode the original sound. */
  canKeepAudio: boolean;
  strip(count: number, height: number): Promise<string[]>;
  frame(time: number, crop: Crop, maxSide: number): Promise<Blob>;
  dispose(): void;
};

async function pickAudioCodec() {
  if (await canEncodeAudio("aac")) return "aac" as const;
  if (await canEncodeAudio("opus")) return "opus" as const;
  return null;
}

async function canvasOf(sink: CanvasSink, t: number) {
  const wrapped = await sink.getCanvas(t);
  if (!wrapped) throw new MediaError("Could not read the video");
  return wrapped.canvas;
}

export async function openVideo(file: File): Promise<VideoHandle> {
  if (!file.type.startsWith("video/")) throw new MediaError("Please choose a video file");
  if (file.size > MAX_VIDEO_INPUT_BYTES) throw new MediaError("Video must be 100 MB or smaller");
  if (!videoEditingSupported()) {
    throw new MediaError("This browser can't edit videos. Try Chrome or update Safari.");
  }

  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
  let track: InputVideoTrack | null;
  try {
    track = await input.getPrimaryVideoTrack();
  } catch {
    throw new MediaError("This video format isn't supported");
  }
  if (!track || !(await track.canDecode())) throw new MediaError("This video format isn't supported");
  const vt = track;
  const duration = await input.computeDuration();
  const width = await vt.getDisplayWidth();
  const height = await vt.getDisplayHeight();
  const audio = await input.getPrimaryAudioTrack();
  const hasAudio = !!audio && (await audio.canDecode());
  const canKeepAudio = hasAudio && !!(await pickAudioCodec());

  return {
    file,
    duration,
    width,
    height,
    hasAudio,
    canKeepAudio,
    async strip(count, h) {
      const sink = new CanvasSink(vt, { height: h, poolSize: 0 });
      const times = Array.from({ length: count }, (_, i) => ((i + 0.5) * duration) / count);
      const urls: string[] = [];
      for await (const wrapped of sink.canvasesAtTimestamps(times)) {
        if (!wrapped) continue;
        urls.push(URL.createObjectURL(await canvasToJpeg(wrapped.canvas, 0.7)));
      }
      return urls;
    },
    async frame(time, crop, maxSide) {
      const scale = Math.min(1, maxSide / Math.max(crop.width, crop.height));
      const sink = new CanvasSink(vt, {
        crop,
        width: Math.round(crop.width * scale),
        height: Math.round(crop.height * scale),
        fit: "fill",
        poolSize: 0,
      });
      return canvasToJpeg(await canvasOf(sink, time), 0.86);
    },
    dispose() {
      input.dispose();
    },
  };
}

export type CompressOptions = {
  start: number;
  end: number;
  crop: Crop;
  mute: boolean;
  onProgress?: (p: number) => void;
  signal?: AbortSignal;
};

/**
 * Trims, crops, scales and re-encodes to H.264 MP4 with a keyframe every
 * second. Metadata tags (incl. location) are dropped.
 */
export async function compressVideo(file: File, opts: CompressOptions): Promise<Blob> {
  const out = videoOutputSize(opts.crop.width, opts.crop.height);
  if (!(await canEncodeVideo("avc", { width: out.width, height: out.height }))) {
    throw new MediaError("This browser can't compress videos. Try Chrome or update Safari.");
  }
  const audioCodec = opts.mute ? null : await pickAudioCodec();
  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
  const output = new Output({
    format: new Mp4OutputFormat({ fastStart: "in-memory" }),
    target: new BufferTarget(),
  });
  try {
    const conversion = await Conversion.init({
      input,
      output,
      tracks: "primary",
      trim: { start: opts.start, end: opts.end },
      video: {
        crop: opts.crop,
        width: out.width,
        height: out.height,
        fit: "fill",
        codec: "avc",
        quality: QUALITY_MEDIUM,
        keyFrameInterval: 1,
        forceTranscode: true,
        allowTransformationMetadata: false,
      },
      audio: audioCodec ? { codec: audioCodec, quality: QUALITY_MEDIUM } : { discard: true },
      tags: {},
      showWarnings: false,
    });
    if (!conversion.isValid) throw new MediaError("This video can't be processed");
    conversion.onProgress = (p) => opts.onProgress?.(p);
    const onAbort = () => void conversion.cancel();
    opts.signal?.addEventListener("abort", onAbort, { once: true });
    try {
      await conversion.execute();
    } finally {
      opts.signal?.removeEventListener("abort", onAbort);
    }
    const buffer = (output.target as BufferTarget).buffer;
    if (!buffer) throw new MediaError("This video can't be processed");
    return new Blob([buffer], { type: "video/mp4" });
  } catch (err) {
    if (err instanceof ConversionCanceledError) throw new DOMException("Canceled", "AbortError");
    throw err;
  } finally {
    input.dispose();
  }
}

export type KeyframeStill = { t: number; data: string };

/** One small JPEG per keyframe of the compressed file, for server-side fingerprints. */
export async function keyframeStills(blob: Blob): Promise<KeyframeStill[]> {
  const input = new Input({ source: new BlobSource(blob), formats: ALL_FORMATS });
  try {
    const track = await input.getPrimaryVideoTrack();
    if (!track) throw new MediaError("This video can't be processed");
    const packets = new EncodedPacketSink(track);
    const times: number[] = [];
    let p = await packets.getFirstPacket({ metadataOnly: true });
    while (p) {
      if (p.type === "key") times.push(p.timestamp);
      if (times.length > MAX_KEYFRAMES) throw new MediaError("This video is too long");
      p = await packets.getNextKeyPacket(p, { metadataOnly: true });
    }
    const sink = new CanvasSink(track, { width: FRAME_FP_WIDTH, poolSize: 0 });
    const out: KeyframeStill[] = [];
    let i = 0;
    for await (const wrapped of sink.canvasesAtTimestamps(times)) {
      if (!wrapped) throw new MediaError("This video can't be processed");
      out.push({ t: times[i]!, data: await blobToBase64(await canvasToJpeg(wrapped.canvas, 0.8)) });
      i++;
    }
    return out;
  } finally {
    input.dispose();
  }
}

/** Crop rectangle (even pixels) for an aspect ratio, centred at (cx, cy) in 0..1. */
export function cropFor(
  width: number,
  height: number,
  ratio: number | null,
  cx: number,
  cy: number,
): Crop {
  if (!ratio) return { left: 0, top: 0, width: width - (width % 2), height: height - (height % 2) };
  let cw = width;
  let ch = width / ratio;
  if (ch > height) {
    ch = height;
    cw = height * ratio;
  }
  const even = (n: number) => Math.max(2, Math.floor(n / 2) * 2);
  cw = even(cw);
  ch = even(ch);
  const left = Math.round(Math.min(Math.max(cx * width - cw / 2, 0), width - cw));
  const top = Math.round(Math.min(Math.max(cy * height - ch / 2, 0), height - ch));
  return { left, top, width: cw, height: ch };
}

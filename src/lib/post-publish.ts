import type { prepareUploads, publishPost } from "./posts.functions";
import type { PostBackground, PostFont, PublishInput } from "./post-rules";
import type { CompressedPhoto } from "./photo-compress";
import { compressVideo, keyframeStills, type Crop, type VideoHandle } from "./video-edit";
import { putSigned, runPool } from "./upload";
import { AppError, toAppError } from "./offline";

export type PublishStage = "compressing" | "uploading" | "checking";
export type ProgressFn = (stage: PublishStage, value: number) => void;

type Extras = { body: string; people: string[]; hashtags: string[]; songId: number | null };

export type Draft =
  | (Extras & { kind: "text"; background: PostBackground; font: PostFont })
  | (Extras & { kind: "photo"; photos: Promise<CompressedPhoto>[] })
  | (Extras & {
      kind: "video";
      video: VideoHandle;
      start: number;
      end: number;
      crop: Crop;
      mute: boolean;
      cover: { kind: "frame"; time: number } | { kind: "image"; photo: Promise<CompressedPhoto> };
    });

type PrepareFn = (o: {
  data: { photos: number; video: boolean };
}) => Promise<Awaited<ReturnType<typeof prepareUploads>>>;
type PublishFn = (o: { data: PublishInput }) => Promise<Awaited<ReturnType<typeof publishPost>>>;

const COVER_MAX_SIDE = 1080;

async function call<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    throw toAppError(err);
  }
}

/** Upload blobs to their slots in parallel; progress is bytes sent / total. */
async function uploadAll(
  items: { url: string; blob: Blob }[],
  onProgress: (fraction: number) => void,
  signal: AbortSignal,
) {
  const total = items.reduce((s, i) => s + i.blob.size, 0) || 1;
  const sent = items.map(() => 0);
  const report = () => onProgress(sent.reduce((a, b) => a + b, 0) / total);
  await runPool(
    items.map((item, i) => async () => {
      try {
        await putSigned(item.url, item.blob, (n) => {
          sent[i] = n;
          report();
        }, signal);
      } catch (err) {
        if (signal.aborted) throw err;
        sent[i] = 0; // one retry for flaky connections
        await putSigned(item.url, item.blob, (n) => {
          sent[i] = n;
          report();
        }, signal);
      }
    }),
    4,
  );
}

export async function publishDraft(
  draft: Draft,
  fns: { prepare: PrepareFn; publish: PublishFn },
  onProgress: ProgressFn,
  signal: AbortSignal,
): Promise<string> {
  const extras = { body: draft.body, people: draft.people, hashtags: draft.hashtags, songId: draft.songId };
  let input: PublishInput;

  if (draft.kind === "text") {
    onProgress("checking", 0.5);
    input = { kind: "text", background: draft.background, font: draft.font, ...extras };
  } else if (draft.kind === "photo") {
    let done = 0;
    onProgress("compressing", 0);
    const photos = await Promise.all(
      draft.photos.map((p) =>
        p.then((r) => {
          onProgress("compressing", (++done / draft.photos.length) * 0.15);
          return r;
        }),
      ),
    );
    const prep = await call(() => fns.prepare({ data: { photos: photos.length, video: false } }));
    if (!prep.ok) throw new AppError("server", prep.error);
    await uploadAll(
      prep.slots.map((s, i) => ({ url: s.url, blob: photos[i]!.blob })),
      (f) => onProgress("uploading", 0.15 + f * 0.75),
      signal,
    );
    onProgress("checking", 0.92);
    input = { kind: "photo", photos: prep.slots.map((s) => s.id), ...extras };
  } else {
    onProgress("compressing", 0);
    const video = await compressVideo(draft.video.file, {
      start: draft.start,
      end: draft.end,
      crop: draft.crop,
      mute: draft.mute,
      onProgress: (p) => onProgress("compressing", p * 0.55),
      signal,
    });
    const frames = await keyframeStills(video);
    const cover =
      draft.cover.kind === "image"
        ? (await draft.cover.photo).blob
        : await draft.video.frame(draft.cover.time, draft.crop, COVER_MAX_SIDE);
    onProgress("compressing", 0.6);
    if (signal.aborted) throw new DOMException("Canceled", "AbortError");

    const prep = await call(() => fns.prepare({ data: { photos: 0, video: true } }));
    if (!prep.ok) throw new AppError("server", prep.error);
    const videoSlot = prep.slots.find((s) => s.kind === "video")!;
    const coverSlot = prep.slots.find((s) => s.kind === "cover")!;
    await uploadAll(
      [
        { url: videoSlot.url, blob: video },
        { url: coverSlot.url, blob: cover },
      ],
      (f) => onProgress("uploading", 0.6 + f * 0.33),
      signal,
    );
    onProgress("checking", 0.95);
    input = {
      kind: "video",
      video: videoSlot.id,
      cover: coverSlot.id,
      muteOriginal: draft.mute || !draft.video.hasAudio,
      frames,
      ...extras,
    };
  }

  if (signal.aborted) throw new DOMException("Canceled", "AbortError");
  const res = await call(() => fns.publish({ data: input }));
  if (!res.ok) throw new AppError("server", res.error);
  onProgress("checking", 1);
  return res.postId;
}

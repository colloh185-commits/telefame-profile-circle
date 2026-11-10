import { z } from "zod";

/* Limits shared by the composer and the server. */
export const MAX_PHOTOS = 10;
export const MAX_VIDEO_INPUT_BYTES = 100 * 1024 * 1024;
export const MAX_VIDEO_STORED_BYTES = 100 * 1024 * 1024;
export const MAX_VIDEO_SECONDS = 180;
export const MIN_VIDEO_SECONDS = 1;
export const MAX_PHOTO_INPUT_BYTES = 40 * 1024 * 1024;
export const MAX_PHOTO_STORED_BYTES = 4 * 1024 * 1024;
/** Longest side of a compressed photo / cover. */
export const PHOTO_MAX_SIDE = 1440;
/** Server accepts a little more than the composer produces. */
export const PHOTO_SERVER_MAX_SIDE = 2048;
/** Video is scaled to fit inside this box (landscape) or its transpose (portrait). */
export const VIDEO_MAX_LONG = 1280;
export const VIDEO_MAX_SHORT = 720;
export const MAX_KEYFRAMES = MAX_VIDEO_SECONDS + 5;
export const FRAME_FP_WIDTH = 128;
export const TEXT_POST_MAX = 280;
export const CAPTION_MAX = 2200;
export const MAX_PEOPLE_TAGS = 20;
export const MAX_HASHTAGS = 10;
export const POSTS_PER_HOUR = 20;
export const UPLOAD_SLOTS_PER_HOUR = 80;
/** Unused upload slots expire after this long. */
export const UPLOAD_SLOT_TTL_MS = 60 * 60 * 1000;

export const POST_BACKGROUNDS = ["brand", "sunset", "ocean", "forest", "grape", "night", "paper", "rose"] as const;
export type PostBackground = (typeof POST_BACKGROUNDS)[number];

export const POST_FONTS = ["sans", "serif", "hand", "mono", "display"] as const;
export type PostFont = (typeof POST_FONTS)[number];

export const FONT_CLASS: Record<PostFont, string> = {
  sans: "font-sans font-bold",
  serif: "font-serif font-semibold",
  hand: "font-hand font-bold",
  mono: "font-mono font-bold",
  display: "font-display tracking-wide",
};

export const HASHTAG_REGEX = /^[a-z0-9_]{1,30}$/;

/** "#Book_Club" -> "book_club"; null when it can't be a valid tag. */
export function normalizeHashtag(raw: string): string | null {
  const tag = raw.normalize("NFKC").trim().replace(/^#+/, "").toLowerCase();
  return HASHTAG_REGEX.test(tag) ? tag : null;
}

/** Hashtags written inside text, normalised and de-duplicated in order. */
export function extractHashtags(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(/#([A-Za-z0-9_]{1,30})(?![A-Za-z0-9_])/g)) {
    const tag = normalizeHashtag(m[1] ?? "");
    if (tag && !out.includes(tag)) out.push(tag);
  }
  return out;
}

/** Chosen tags plus tags typed in the text, unique, in order. */
export function mergeHashtags(chosen: string[], text: string): string[] {
  const out: string[] = [];
  for (const t of [...chosen, ...extractHashtags(text)]) {
    const tag = normalizeHashtag(t);
    if (tag && !out.includes(tag)) out.push(tag);
  }
  return out;
}

/**
 * Like sanitizeText but keeps line breaks: strips control / zero-width / bidi
 * characters and angle brackets, trims line ends and caps blank lines at one.
 */
export function sanitizeMultiline(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/\r\n?/g, "\n")
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0009\u000B-\u001F\u007F-\u009F\u200B-\u200F\u2028-\u202E\u2060-\u206F\uFEFF]/g, " ")
    .replace(/[<>]/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Fits a crop region inside the output box, keeping aspect and even sizes (H.264). */
export function videoOutputSize(width: number, height: number): { width: number; height: number } {
  const landscape = width >= height;
  const maxW = landscape ? VIDEO_MAX_LONG : VIDEO_MAX_SHORT;
  const maxH = landscape ? VIDEO_MAX_SHORT : VIDEO_MAX_LONG;
  const scale = Math.min(1, maxW / width, maxH / height);
  const even = (n: number) => Math.max(2, Math.round((n * scale) / 2) * 2);
  return { width: even(width), height: even(height) };
}

/* ------------------------------- Publish input ------------------------------ */

const multiline = (max: number, min = 0) =>
  z.preprocess(
    (v) => (typeof v === "string" ? sanitizeMultiline(v) : v),
    z
      .string()
      .min(min, "Write something first")
      .max(max, `Keep it under ${max} characters`),
  );

const common = {
  people: z.array(z.string().uuid()).max(MAX_PEOPLE_TAGS, `Tag up to ${MAX_PEOPLE_TAGS} people`),
  hashtags: z.array(z.string().max(31)).max(MAX_HASHTAGS, `Use up to ${MAX_HASHTAGS} hashtags`),
  songId: z.number().int().positive().nullable(),
};

export const frameInput = z.object({
  t: z.number().min(0).max(MAX_VIDEO_SECONDS + 5),
  data: z.string().min(100).max(60_000),
});

export const publishSchema = z
  .discriminatedUnion("kind", [
    z.object({
      kind: z.literal("text"),
      body: multiline(TEXT_POST_MAX, 1),
      background: z.enum(POST_BACKGROUNDS),
      font: z.enum(POST_FONTS),
      ...common,
    }),
    z.object({
      kind: z.literal("photo"),
      body: multiline(CAPTION_MAX),
      photos: z.array(z.string().uuid()).min(1, "Add a photo").max(MAX_PHOTOS, `Up to ${MAX_PHOTOS} photos`),
      ...common,
    }),
    z.object({
      kind: z.literal("video"),
      body: multiline(CAPTION_MAX),
      video: z.string().uuid(),
      cover: z.string().uuid(),
      muteOriginal: z.boolean(),
      frames: z.array(frameInput).min(1).max(MAX_KEYFRAMES),
      ...common,
    }),
  ])
  .superRefine((d, ctx) => {
    if (mergeHashtags(d.hashtags, d.body).length > MAX_HASHTAGS) {
      ctx.addIssue({ code: "custom", path: ["hashtags"], message: `Use up to ${MAX_HASHTAGS} hashtags` });
    }
    if (new Set(d.people).size !== d.people.length) {
      ctx.addIssue({ code: "custom", path: ["people"], message: "Each person can be tagged once" });
    }
  });

export type PublishInput = z.input<typeof publishSchema>;

export const prepareUploadsSchema = z
  .object({
    photos: z.number().int().min(0).max(MAX_PHOTOS),
    video: z.boolean(),
  })
  .refine((d) => (d.video ? d.photos === 0 : d.photos >= 1), "Choose photos or one video");

/* ---------------------------------- Songs ---------------------------------- */

export type Song = {
  id: number;
  title: string;
  artist: string;
  artwork: string | null;
  previewUrl: string;
  durationMs: number | null;
};

export const SONG_SEARCH_MAX = 60;

const SONG_HOSTS = [/\.apple\.com$/, /\.mzstatic\.com$/];

/** Only accept https links from the music catalogue's own hosts. */
export function isCatalogUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const u = new URL(value);
    return u.protocol === "https:" && SONG_HOSTS.some((re) => re.test(u.hostname));
  } catch {
    return false;
  }
}

type CatalogTrack = {
  trackId?: unknown;
  trackName?: unknown;
  artistName?: unknown;
  artworkUrl100?: unknown;
  previewUrl?: unknown;
  trackTimeMillis?: unknown;
  kind?: unknown;
};

/** Maps one catalogue result to a Song, or null if it lacks a playable preview. */
export function toSong(t: CatalogTrack): Song | null {
  if (typeof t.trackId !== "number" || !isCatalogUrl(t.previewUrl)) return null;
  if (typeof t.trackName !== "string" || typeof t.artistName !== "string") return null;
  const art = isCatalogUrl(t.artworkUrl100) ? t.artworkUrl100.replace("100x100bb", "200x200bb") : null;
  return {
    id: t.trackId,
    title: t.trackName.slice(0, 200),
    artist: t.artistName.slice(0, 200),
    artwork: art,
    previewUrl: t.previewUrl,
    durationMs: typeof t.trackTimeMillis === "number" ? t.trackTimeMillis : null,
  };
}

/* ------------------------------ Edit / delete ------------------------------ */

export const updatePostSchema = z.object({
  id: z.string().uuid(),
  body: z.preprocess((v) => (typeof v === "string" ? sanitizeMultiline(v) : v), z.string().max(CAPTION_MAX)),
  background: z.enum(POST_BACKGROUNDS).optional(),
  font: z.enum(POST_FONTS).optional(),
  ...common,
}).superRefine((d, ctx) => {
  if (mergeHashtags(d.hashtags, d.body).length > MAX_HASHTAGS) {
    ctx.addIssue({ code: "custom", path: ["hashtags"], message: `Use up to ${MAX_HASHTAGS} hashtags` });
  }
  if (new Set(d.people).size !== d.people.length) {
    ctx.addIssue({ code: "custom", path: ["people"], message: "Each person can be tagged once" });
  }
});

export type UpdatePostInput = z.input<typeof updatePostSchema>;

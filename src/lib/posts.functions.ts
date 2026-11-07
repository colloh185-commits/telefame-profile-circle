import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";
import { sanitizeText } from "./validation";
import {
  MAX_PHOTO_STORED_BYTES,
  PHOTO_SERVER_MAX_SIDE,
  POSTS_PER_HOUR,
  SONG_SEARCH_MAX,
  UPLOAD_SLOTS_PER_HOUR,
  UPLOAD_SLOT_TTL_MS,
  mergeHashtags,
  prepareUploadsSchema,
  publishSchema,
  toSong,
  type Song,
} from "./post-rules";

const BUCKET = "post-media";
const GENERIC = "Couldn't post right now. Try again.";

class UserFacing extends Error {}

async function catalogFetch(params: Record<string, string>, path: "search" | "lookup") {
  const res = await fetch(`https://itunes.apple.com/${path}?${new URLSearchParams(params)}`, {
    headers: { accept: "application/json" },
  });
  if (!res.ok) throw new Error(`catalog ${res.status}`);
  const json = (await res.json()) as { results?: unknown[] };
  return (json.results ?? []).map((r) => toSong(r as never)).filter((s): s is Song => !!s);
}

export const searchSongs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ q: z.string().max(SONG_SEARCH_MAX) }).parse(input))
  .handler(async ({ data }) => {
    const q = sanitizeText(data.q);
    if (!q) return { items: [] as Song[], error: null };
    try {
      const items = await catalogFetch({ term: q, media: "music", entity: "song", limit: "25" }, "search");
      return { items, error: null };
    } catch (err) {
      console.error("song search failed", err);
      return { items: [] as Song[], error: "Songs are unavailable right now" };
    }
  });

async function lookupSong(id: number): Promise<Song | null> {
  try {
    const items = await catalogFetch({ id: String(id), entity: "song" }, "lookup");
    return items.find((s) => s.id === id) ?? null;
  } catch (err) {
    console.error("song lookup failed", err);
    return null;
  }
}

async function requireOnboarded(supabase: SupabaseClient<Database>, userId: string): Promise<boolean> {
  const { data } = await supabase.from("profiles").select("onboarded").eq("id", userId).maybeSingle();
  return !!data?.onboarded;
}

/** Hands out server-named upload slots (signed upload links) for one post. */
export const prepareUploads = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => prepareUploadsSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!(await requireOnboarded(supabase, userId))) {
      return { ok: false as const, error: "Finish setting up your profile first" };
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const bucket = supabaseAdmin.storage.from(BUCKET);
    const since = new Date(Date.now() - UPLOAD_SLOT_TTL_MS).toISOString();

    // Clear this user's expired, never-used uploads.
    const { data: stale } = await supabaseAdmin
      .from("media_uploads")
      .select("id, staging_path")
      .eq("user_id", userId)
      .is("used_at", null)
      .lt("created_at", since)
      .limit(100);
    if (stale?.length) {
      await bucket.remove(stale.map((s) => s.staging_path));
      await supabaseAdmin.from("media_uploads").delete().in("id", stale.map((s) => s.id));
    }

    const kinds: ("photo" | "video" | "cover")[] = data.video
      ? ["video", "cover"]
      : Array.from({ length: data.photos }, () => "photo" as const);

    const { count, error: countErr } = await supabaseAdmin
      .from("media_uploads")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", since);
    if (countErr) {
      console.error(countErr);
      return { ok: false as const, error: GENERIC };
    }
    if ((count ?? 0) + kinds.length > UPLOAD_SLOTS_PER_HOUR) {
      return { ok: false as const, error: "You've uploaded a lot recently. Try again later." };
    }

    const rows = kinds.map((kind) => ({
      id: crypto.randomUUID(),
      user_id: userId,
      kind,
      staging_path: `staging/${userId}/${crypto.randomUUID()}`,
    }));
    const { error: insErr } = await supabaseAdmin.from("media_uploads").insert(rows);
    if (insErr) {
      console.error(insErr);
      return { ok: false as const, error: GENERIC };
    }

    try {
      const slots = await Promise.all(
        rows.map(async (r) => {
          const { data: signed, error } = await bucket.createSignedUploadUrl(r.staging_path);
          if (error || !signed) throw error ?? new Error("no signed url");
          return { id: r.id, kind: r.kind, url: signed.signedUrl };
        }),
      );
      return { ok: true as const, slots };
    } catch (err) {
      console.error("signed upload url failed", err);
      return { ok: false as const, error: GENERIC };
    }
  });

type MediaRow = {
  post_id: string;
  position: number;
  kind: "photo" | "video" | "cover";
  storage_path: string;
  width: number;
  height: number;
  byte_size: number;
  duration_ms?: number;
};

type FingerprintRow = {
  user_id: string;
  purpose: "post_photo" | "post_video" | "post_cover";
  storage_path: string;
  sha256: string;
  phash: string;
  byte_size: number;
  width: number;
  height: number;
};

/** Verifies every uploaded file, moves it to its final name and creates the post. */
export const publishPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => publishSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const fail = (error: string) => ({ ok: false as const, error });

    if (!(await requireOnboarded(supabase, userId))) return fail("Finish setting up your profile first");

    const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count: recent, error: recentErr } = await supabase
      .from("posts")
      .select("id", { count: "exact", head: true })
      .eq("author_id", userId)
      .gte("created_at", hourAgo);
    if (recentErr) {
      console.error(recentErr);
      return fail(GENERIC);
    }
    if ((recent ?? 0) >= POSTS_PER_HOUR) return fail("You're posting a lot. Try again in a little while.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { checkFrame, checkJpeg, inspectVideo } = await import("./post-media.server");
    const bucket = supabaseAdmin.storage.from(BUCKET);

    // Upload slots must belong to this user, be unused, fresh and of the right kind.
    const expected: [string, "photo" | "video" | "cover"][] =
      data.kind === "photo"
        ? data.photos.map((id) => [id, "photo"])
        : data.kind === "video"
          ? [
              [data.video, "video"],
              [data.cover, "cover"],
            ]
          : [];
    const slotIds = expected.map(([id]) => id);
    if (new Set(slotIds).size !== slotIds.length) return fail(GENERIC);
    const slots = new Map<string, string>();
    if (slotIds.length) {
      const { data: rows, error } = await supabaseAdmin
        .from("media_uploads")
        .select("id, kind, staging_path")
        .in("id", slotIds)
        .eq("user_id", userId)
        .is("used_at", null)
        .gte("created_at", new Date(Date.now() - UPLOAD_SLOT_TTL_MS).toISOString());
      if (error) {
        console.error(error);
        return fail(GENERIC);
      }
      for (const r of rows ?? []) slots.set(`${r.id}:${r.kind}`, r.staging_path);
      if (expected.some(([id, kind]) => !slots.has(`${id}:${kind}`))) {
        return fail("Upload expired. Please try again.");
      }
    }
    const staging = (id: string, kind: string) => slots.get(`${id}:${kind}`)!;

    let song: Song | null = null;
    if (data.songId) {
      song = await lookupSong(data.songId);
      if (!song) return fail("That song isn't available. Pick another one.");
    }

    let people: string[] = [];
    const wanted = data.people.filter((id) => id !== userId);
    if (wanted.length) {
      const { data: rows, error } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .in("id", wanted)
        .eq("onboarded", true);
      if (error) {
        console.error(error);
        return fail(GENERIC);
      }
      const valid = new Set((rows ?? []).map((r) => r.id));
      people = wanted.filter((id) => valid.has(id));
    }

    const hashtags = mergeHashtags(data.hashtags, data.body);
    const postId = crypto.randomUUID();
    const dir = `${userId}/${postId}`;
    const written: string[] = [];
    const media: MediaRow[] = [];
    const fingerprints: FingerprintRow[] = [];
    const frameRows: {
      user_id: string;
      storage_path: string;
      frame_index: number;
      time_ms: number;
      sha256: string;
      phash: string;
      width: number;
      height: number;
    }[] = [];
    let postInserted = false;

    const download = async (path: string) => {
      const { data: blob, error } = await bucket.download(path);
      if (error || !blob) throw new UserFacing("An upload didn't finish. Try again.");
      if (blob.size > MAX_PHOTO_STORED_BYTES) throw new UserFacing("A photo is too large.");
      return new Uint8Array(await blob.arrayBuffer());
    };
    const store = async (path: string, bytes: Uint8Array, contentType: string) => {
      const { error } = await bucket.upload(path, bytes, { contentType, cacheControl: "31536000", upsert: false });
      if (error) throw error;
      written.push(path);
    };
    const storeImage = async (
      stagingPath: string,
      position: number,
      kind: "photo" | "cover",
    ) => {
      const img = await checkJpeg(await download(stagingPath), PHOTO_SERVER_MAX_SIDE);
      if (!img.ok) throw new UserFacing(img.error);
      const path = `${dir}/${crypto.randomUUID()}.jpg`;
      await store(path, img.bytes, "image/jpeg");
      media.push({ post_id: postId, position, kind, storage_path: path, width: img.width, height: img.height, byte_size: img.bytes.byteLength });
      fingerprints.push({
        user_id: userId,
        purpose: kind === "photo" ? "post_photo" : "post_cover",
        storage_path: path,
        sha256: img.sha256,
        phash: img.phash,
        byte_size: img.bytes.byteLength,
        width: img.width,
        height: img.height,
      });
    };

    try {
      if (data.kind === "photo") {
        await Promise.all(data.photos.map((id, i) => storeImage(staging(id, "photo"), i, "photo")));
      }

      if (data.kind === "video") {
        const videoStaging = staging(data.video, "video");
        const { data: signed, error: signErr } = await bucket.createSignedUrl(videoStaging, 600);
        if (signErr || !signed) throw new UserFacing("The video didn't finish uploading. Try again.");
        const report = await inspectVideo(signed.signedUrl);
        if (!report.ok) throw new UserFacing(report.error);
        if (data.muteOriginal && report.hasAudio) throw new UserFacing("The video couldn't be verified. Try again.");

        // The frames sent must be exactly this file's keyframes.
        const matches =
          data.frames.length === report.keyframes.length &&
          data.frames.every((f, i) => Math.abs(f.t - report.keyframes[i]!) < 0.002);
        if (!matches) throw new UserFacing("The video couldn't be verified. Try again.");
        const frames = await Promise.all(data.frames.map((f) => checkFrame(f.data)));

        const videoPath = `${dir}/${crypto.randomUUID()}.mp4`;
        for (const [i, f] of frames.entries()) {
          if (!f.ok) throw new UserFacing("The video couldn't be verified. Try again.");
          frameRows.push({
            user_id: userId,
            storage_path: videoPath,
            frame_index: i,
            time_ms: Math.round(data.frames[i]!.t * 1000),
            sha256: f.sha256,
            phash: f.phash,
            width: f.width,
            height: f.height,
          });
        }

        await storeImage(staging(data.cover, "cover"), 1, "cover");

        const { error: moveErr } = await bucket.move(videoStaging, videoPath);
        if (moveErr) throw moveErr;
        written.push(videoPath);
        media.push({
          post_id: postId,
          position: 0,
          kind: "video",
          storage_path: videoPath,
          width: report.width,
          height: report.height,
          byte_size: report.byteSize,
          duration_ms: report.durationMs,
        });
        fingerprints.push({
          user_id: userId,
          purpose: "post_video",
          storage_path: videoPath,
          sha256: report.sha256,
          phash: frameRows[0]!.phash,
          byte_size: report.byteSize,
          width: report.width,
          height: report.height,
        });
      }

      const { error: postErr } = await supabaseAdmin.from("posts").insert({
        id: postId,
        author_id: userId,
        kind: data.kind,
        body: data.body,
        text_style: data.kind === "text" ? { background: data.background, font: data.font } : null,
        song: song as unknown as Json,
        mute_original: data.kind === "video" ? data.muteOriginal : false,
      });
      if (postErr) throw postErr;
      postInserted = true;

      if (media.length) {
        const { error } = await supabaseAdmin.from("post_media").insert(media);
        if (error) throw error;
      }
      if (people.length) {
        const { error } = await supabaseAdmin
          .from("post_people_tags")
          .insert(people.map((user_id) => ({ post_id: postId, user_id })));
        if (error) throw error;
      }
      if (hashtags.length) {
        const { error: tagErr } = await supabaseAdmin.rpc("register_hashtags", { _tags: hashtags });
        if (tagErr) throw tagErr;
        const { error } = await supabaseAdmin
          .from("post_hashtags")
          .insert(hashtags.map((tag) => ({ post_id: postId, tag })));
        if (error) throw error;
      }
      if (fingerprints.length) {
        const { error } = await supabaseAdmin.from("upload_fingerprints").insert(fingerprints);
        if (error) throw error;
      }
      if (frameRows.length) {
        const { error } = await supabaseAdmin.from("video_frame_fingerprints").insert(frameRows);
        if (error) throw error;
      }
    } catch (err) {
      if (postInserted) await supabaseAdmin.from("posts").delete().eq("id", postId);
      if (written.length) await bucket.remove(written);
      if (err instanceof UserFacing) return fail(err.message);
      console.error("publishPost failed", err);
      return fail(GENERIC);
    }

    if (slotIds.length) {
      await supabaseAdmin.from("media_uploads").update({ used_at: new Date().toISOString() }).in("id", slotIds);
      // The video was moved; photo and cover staging copies are no longer needed.
      const leftovers = expected.filter(([, kind]) => kind !== "video").map(([id, kind]) => staging(id, kind));
      if (leftovers.length) await bucket.remove(leftovers);
    }

    return { ok: true as const, postId };
  });

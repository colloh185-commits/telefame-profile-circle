import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { profileSchema, usernameSchema } from "./validation";
import { CONTENT_TYPES, MAX_AVATAR_BYTES, validateAvatarBytes } from "./image-validate";
import { sanitizeAvatarJpeg } from "./image-sanitize.server";

const saveInput = profileSchema.extend({
  // base64 of the re-encoded avatar; ~4/3 of the max byte size
  avatar: z.string().max(Math.ceil((MAX_AVATAR_BYTES * 4) / 3) + 16).optional(),
});

export const checkUsername = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ username: usernameSchema }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: available, error } = await context.supabase.rpc("is_username_available", {
      _username: data.username,
    });
    if (error) {
      console.error("is_username_available failed", error);
      throw new Error("Could not check the username right now");
    }
    return { username: data.username, available: Boolean(available) };
  });

export const saveProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => saveInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: available, error: availErr } = await supabase.rpc("is_username_available", {
      _username: data.username,
    });
    if (availErr) {
      console.error(availErr);
      return { ok: false as const, field: "form", error: "Could not save right now. Try again." };
    }
    if (!available) {
      return { ok: false as const, field: "username", error: "This username is already taken" };
    }

    const { data: current } = await supabase
      .from("profiles")
      .select("avatar_path")
      .eq("id", userId)
      .maybeSingle();

    let avatarPath = current?.avatar_path ?? null;
    let oldPath: string | null = null;

    if (data.avatar) {
      const check = validateAvatarBytes(data.avatar);
      if (!check.ok) return { ok: false as const, field: "avatar", error: check.error };
      if (check.kind !== "jpg") {
        return { ok: false as const, field: "avatar", error: "Please re-select your photo and try again." };
      }

      // Decode + re-encode on the server and fingerprint the result.
      const clean = await sanitizeAvatarJpeg(check.bytes);
      if (!clean.ok) return { ok: false as const, field: "avatar", error: clean.error };

      // Never trust the client's filename: store under a random server-chosen name.
      const newPath = `${userId}/${crypto.randomUUID()}.jpg`;
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { error: upErr } = await supabaseAdmin.storage
        .from("avatars")
        .upload(newPath, clean.bytes, {
          contentType: CONTENT_TYPES.jpg,
          cacheControl: "3600",
          upsert: false,
        });
      if (upErr) {
        console.error("avatar upload failed", upErr);
        return { ok: false as const, field: "avatar", error: "Photo upload failed. Try again." };
      }

      // Every accepted upload gets a moderation fingerprint record.
      const { error: fpErr } = await supabaseAdmin.from("upload_fingerprints").insert({
        user_id: userId,
        purpose: "avatar",
        storage_path: newPath,
        sha256: clean.sha256,
        phash: clean.phash,
        byte_size: clean.bytes.byteLength,
        width: clean.width,
        height: clean.height,
      });
      if (fpErr) {
        console.error("fingerprint insert failed", fpErr);
        await supabaseAdmin.storage.from("avatars").remove([newPath]);
        return { ok: false as const, field: "avatar", error: "Photo upload failed. Try again." };
      }
      oldPath = avatarPath;
      avatarPath = newPath;
    }

    const { error: updErr } = await supabase
      .from("profiles")
      .update({
        full_name: data.fullName,
        username: data.username,
        country: data.country,
        location: data.location,
        bio: data.bio || null,
        avatar_path: avatarPath,
        onboarded: true,
      })
      .eq("id", userId);

    if (updErr) {
      console.error("profile update failed", updErr);
      if (updErr.code === "23505") {
        return { ok: false as const, field: "username", error: "This username is already taken" };
      }
      return { ok: false as const, field: "form", error: "Could not save your profile" };
    }

    if (oldPath && oldPath !== avatarPath) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.storage.from("avatars").remove([oldPath]);
    }

    return { ok: true as const };
  });

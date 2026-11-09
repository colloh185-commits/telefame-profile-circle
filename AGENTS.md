<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- Profile writes (incl. avatar upload) go only through `saveProfile` server fn in `src/lib/profile.functions.ts`; storage has no user insert policy, so uploads can't bypass validation/renaming.
- Avatars are compressed to JPEG in the browser, then decoded + re-encoded on the server (`image-sanitize.server.ts`, pure-JS jpeg-js because the Worker has no native image libs); every accepted upload writes sha256 + dHash to the service-role-only `upload_fingerprints` table for moderation.
- Shared validation lives in `src/lib/validation.ts` and is used by both client forms and server fns, so rules can't drift.
- Avatars bucket is private; the browser signs URLs for the owner's own files (workspace blocks public buckets).
- Sign-in cooldown is device-side (`src/lib/auth-throttle.ts`) on top of the auth service's built-in rate limits; there is no server rate-limit primitive.
- Theme (light/dark/system) lives in `src/lib/theme.ts`; an inline head script applies the `.dark` class before paint to avoid a flash.
- Home renders separate mobile (`md:hidden`) and desktop layouts in one route; Contacts uses one responsive tree. Unfinished actions call `comingSoon()` from `src/lib/coming-soon.ts`.
- Contacts read through the security-definer `list_contacts` / `contact_counts` RPCs (profiles stay owner-only under RLS); follows are written directly to `follows` with self-only insert/delete policies.
- Signed-in users can view only *current* avatars (`is_current_avatar` storage policy); avatar blobs are cached in IndexedDB keyed by their immutable storage path (`src/lib/image-cache.ts`).
- Offline: the query cache is persisted to IndexedDB (`src/lib/query-persist.ts`, allow-listed keys only); backend errors are mapped to `AppError` (`src/lib/offline.ts`) so the UI shows "No internet" or a generic message, never raw server text; the `_authenticated` gate falls back to the saved session when the auth service is unreachable.
- App nav (mobile bottom bar + desktop rail) is shared in `src/components/telefam/shell/AppNav.tsx`.
- Posts are written only by server fns in `src/lib/posts.functions.ts`: the browser uploads to server-issued signed staging slots in the private `post-media` bucket, then publish re-checks every file server-side (photos decoded/re-encoded, MP4 parsed with mediabunny), moves it to a random final name and records fingerprints; limits live in `src/lib/post-rules.ts` shared by client and server.
- Video compression/trim/crop runs in the browser (mediabunny + WebCodecs) because the Worker can't transcode; the server hashes the whole file and checks keyframe timestamps, but per-keyframe dHashes come from client-extracted stills (server can't decode video pixels).
- Song search is proxied through an authenticated server fn and only catalog preview URLs from trusted Apple hosts are accepted.

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
- Home renders separate mobile (`md:hidden`) and desktop (rail + list + conversation grid) layouts in one route; unfinished actions call `comingSoon()` from `src/lib/coming-soon.ts`.

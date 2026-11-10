import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { setFollow } from "@/lib/contacts";
import { patchPosts, type FeedPost, type ShareChannel } from "@/lib/feed";
import { AppError, isNetworkError, toAppError } from "@/lib/offline";
import { deletePost } from "@/lib/posts.functions";

export const REPORT_REASONS = [
  { key: "spam", label: "Spam" },
  { key: "nudity", label: "Nudity or sexual content" },
  { key: "violence", label: "Violence" },
  { key: "harassment", label: "Bullying or harassment" },
  { key: "hate", label: "Hate speech" },
  { key: "false_info", label: "False information" },
  { key: "scam", label: "Scam or fraud" },
  { key: "other", label: "Something else" },
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number]["key"];

async function myId(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const id = data.session?.user.id;
  if (!id) throw new AppError("server", "Please sign in again.");
  return id;
}

const oops = (err: unknown) =>
  toast.error(isNetworkError(err) ? "No internet connection" : "Couldn't update. Try again.", { id: "feed-action" });

type Toggle = "post_likes" | "post_favorites" | "post_reposts";

async function setRow(table: Toggle, postId: string, on: boolean) {
  const me = await myId();
  if (on) {
    const { error } = await supabase.from(table).insert({ post_id: postId, user_id: me });
    if (error && error.code !== "23505") throw error;
  } else {
    const { error } = await supabase.from(table).delete().eq("post_id", postId).eq("user_id", me);
    if (error) throw error;
  }
}

/** All feed actions with instant feedback and rollback on failure. */
export function useFeedActions() {
  const qc = useQueryClient();
  const removePost = useServerFn(deletePost);

  const one = (id: string) => (p: FeedPost) => p.id === id;

  async function optimistic(undo: () => void, run: () => Promise<unknown>) {
    try {
      await run();
    } catch (err) {
      undo();
      oops(toAppError(err));
      return false;
    }
    return true;
  }

  return {
    setLiked(post: FeedPost, liked: boolean) {
      if (post.liked === liked) return;
      const undo = patchPosts(qc, one(post.id), (p) => ({ ...p, liked, likes: Math.max(0, p.likes + (liked ? 1 : -1)) }));
      void optimistic(undo, () => setRow("post_likes", post.id, liked));
    },

    setFavorite(post: FeedPost, favorited: boolean) {
      const undo = patchPosts(qc, one(post.id), (p) => ({
        ...p,
        favorited,
        favorites: Math.max(0, p.favorites + (favorited ? 1 : -1)),
      }));
      void optimistic(undo, () => setRow("post_favorites", post.id, favorited)).then(
        (ok) => ok && toast(favorited ? "Added to favourites" : "Removed from favourites", { id: "fav" }),
      );
    },

    setRepost(post: FeedPost, reposted: boolean) {
      const undo = patchPosts(qc, one(post.id), (p) => ({
        ...p,
        reposted,
        reposts: Math.max(0, p.reposts + (reposted ? 1 : -1)),
      }));
      void optimistic(undo, () => setRow("post_reposts", post.id, reposted)).then(
        (ok) => ok && toast(reposted ? "Reposted" : "Repost removed", { id: "repost" }),
      );
    },

    follow(post: FeedPost) {
      const author = post.author.id;
      const undo = patchPosts(qc, (p) => p.author.id === author, (p) => ({ ...p, iFollow: true }));
      void optimistic(undo, () => setFollow(author, true)).then((ok) => {
        if (!ok) return;
        void qc.invalidateQueries({ queryKey: ["contacts"], refetchType: "none" });
        void qc.invalidateQueries({ queryKey: ["contact-counts"] });
      });
    },

    recordShare(post: FeedPost, channel: ShareChannel | "copy" | "native") {
      if (!post.shared) patchPosts(qc, one(post.id), (p) => ({ ...p, shared: true, shares: p.shares + 1 }));
      void (async () => {
        try {
          const me = await myId();
          await supabase.from("post_shares").insert({ post_id: post.id, user_id: me, channel });
        } catch {
          /* counting a share is best-effort */
        }
      })();
    },

    notInterested(post: FeedPost) {
      // Hide from lists; a directly opened post stays on screen.
      const undo = patchPosts(qc, one(post.id), () => null);
      void optimistic(undo, async () => {
        const me = await myId();
        const { error } = await supabase.from("post_not_interested").insert({ user_id: me, post_id: post.id });
        if (error && error.code !== "23505") throw error;
      }).then((ok) => {
        if (!ok) return;
        toast("You'll see less like this", {
          id: "hide",
          action: {
            label: "Undo",
            onClick: async () => {
              const me = await myId().catch(() => null);
              if (me) await supabase.from("post_not_interested").delete().eq("user_id", me).eq("post_id", post.id);
              undo();
            },
          },
        });
      });
    },

    async report(post: FeedPost, reason: ReportReason) {
      try {
        const me = await myId();
        const { error } = await supabase.from("post_reports").insert({ post_id: post.id, reporter_id: me, reason });
        if (error && error.code !== "23505") throw error;
        toast.success("Reported. Thanks for letting us know.", { id: "report" });
        return true;
      } catch (err) {
        oops(toAppError(err));
        return false;
      }
    },

    block(post: FeedPost) {
      const author = post.author;
      const undo = patchPosts(qc, (p) => p.author.id === author.id, () => null);
      void optimistic(undo, async () => {
        const { error } = await supabase.rpc("block_user", { _id: author.id });
        if (error) throw error;
      }).then((ok) => {
        if (!ok) return;
        void qc.invalidateQueries({ queryKey: ["contacts"] });
        void qc.invalidateQueries({ queryKey: ["contact-counts"] });
        toast(`Blocked @${author.username}`, {
          id: "block",
          action: {
            label: "Undo",
            onClick: async () => {
              const me = await myId().catch(() => null);
              if (me) await supabase.from("user_blocks").delete().eq("blocker_id", me).eq("blocked_id", author.id);
              void qc.invalidateQueries({ queryKey: ["feed"] });
              void qc.invalidateQueries({ queryKey: ["contacts"] });
            },
          },
        });
      });
    },

    async remove(post: FeedPost) {
      try {
        const res = await removePost({ data: { id: post.id } });
        if (!res.ok) {
          toast.error(res.error, { id: "delete" });
          return false;
        }
        patchPosts(qc, one(post.id), () => null);
        qc.setQueryData(["feed", "post", post.id], null);
        toast.success("Deleted", { id: "delete" });
        return true;
      } catch (err) {
        oops(toAppError(err));
        return false;
      }
    },
  };
}

/** Saves the post's files to the device under a Telefam name. */
export async function downloadPost(post: FeedPost) {
  const files = post.media.filter((m) => (post.kind === "video" ? m.kind === "video" : m.kind === "photo"));
  if (!files.length) return;
  toast("Downloading…", { id: "download" });
  try {
    for (const [i, m] of files.entries()) {
      const ext = m.kind === "video" ? "mp4" : "jpg";
      const name = `telefam-${post.id.slice(0, 8)}${files.length > 1 ? `-${i + 1}` : ""}.${ext}`;
      const { data, error } = await supabase.storage.from("post-media").createSignedUrl(m.path, 120, { download: name });
      if (error || !data) throw error ?? new Error("no url");
      const a = document.createElement("a");
      a.href = data.signedUrl;
      a.download = name;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      if (files.length > 1) await new Promise((r) => setTimeout(r, 400));
    }
    toast.success("Saved", { id: "download" });
  } catch (err) {
    oops(toAppError(err));
  }
}

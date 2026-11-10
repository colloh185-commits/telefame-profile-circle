import { infiniteQueryOptions, queryOptions, type InfiniteData, type QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { shouldRetry, toAppError } from "@/lib/offline";
import { POST_BACKGROUNDS, POST_FONTS, type PostBackground, type PostFont, type Song } from "@/lib/post-rules";

/* ----------------------------------- Types ---------------------------------- */

export const FEED_TABS = ["following", "for_you"] as const;
export type FeedTab = (typeof FEED_TABS)[number];
export const FEED_TAB_LABEL: Record<FeedTab, string> = { following: "Following", for_you: "For You" };

export const SEARCH_KINDS = ["top", "videos", "photos", "people", "hashtags"] as const;
export type SearchKind = (typeof SEARCH_KINDS)[number];
export const SEARCH_KIND_LABEL: Record<SearchKind, string> = {
  top: "Top",
  videos: "Videos",
  photos: "Photos",
  people: "People",
  hashtags: "Hashtags",
};

export type FeedMedia = {
  kind: "photo" | "video" | "cover";
  path: string;
  url: string | null;
  width: number;
  height: number;
  durationMs: number | null;
};

export type FeedPerson = { id: string; name: string; username: string; avatarPath: string | null; avatarUrl: string | null };

export type FeedPost = {
  id: string;
  kind: "text" | "photo" | "video";
  body: string;
  background: PostBackground;
  font: PostFont;
  song: Song | null;
  muteOriginal: boolean;
  createdAt: string;
  author: FeedPerson;
  mine: boolean;
  iFollow: boolean;
  likes: number;
  favorites: number;
  reposts: number;
  shares: number;
  liked: boolean;
  favorited: boolean;
  reposted: boolean;
  shared: boolean;
  media: FeedMedia[];
  hashtags: string[];
  people: FeedPerson[];
  repostedBy: { id: string; name: string; username: string } | null;
};

export type FeedPage = { items: FeedPost[]; next: { at: string; id: string } | null };
export type SearchPage = { items: FeedPost[]; nextOffset: number | null };

export const FEED_PAGE = 8;
export const SEARCH_PAGE = 18;
const URL_TTL = 60 * 60 * 24 * 7; // matches the offline cache lifetime

/* ---------------------------------- Parsing --------------------------------- */

type Raw = Record<string, unknown>;
const str = (v: unknown, d = "") => (typeof v === "string" ? v : d);
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : Number(v) || 0);
const obj = (v: unknown): Raw => (v && typeof v === "object" && !Array.isArray(v) ? (v as Raw) : {});
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

function person(v: unknown): FeedPerson {
  const p = obj(v);
  const username = str(p.username);
  return {
    id: str(p.id),
    name: str(p.name) || username || "Telefam reader",
    username,
    avatarPath: str(p.avatarPath) || null,
    avatarUrl: null,
  };
}

function song(v: unknown): Song | null {
  const s = obj(v);
  if (typeof s.id !== "number" || typeof s.previewUrl !== "string") return null;
  return {
    id: s.id,
    title: str(s.title),
    artist: str(s.artist),
    artwork: str(s.artwork) || null,
    previewUrl: s.previewUrl,
    durationMs: typeof s.durationMs === "number" ? s.durationMs : null,
  };
}

/** Turns one database card into a typed post (urls are filled in later). */
export function parseCard(raw: unknown): FeedPost | null {
  const c = obj(raw);
  const kind = str(c.kind);
  if (!c.id || (kind !== "text" && kind !== "photo" && kind !== "video")) return null;
  const style = obj(c.textStyle);
  const bg = str(style.background) as PostBackground;
  const font = str(style.font) as PostFont;
  const via = c.repostedBy ? obj(c.repostedBy) : null;
  return {
    id: str(c.id),
    kind,
    body: str(c.body),
    background: POST_BACKGROUNDS.includes(bg) ? bg : "brand",
    font: POST_FONTS.includes(font) ? font : "sans",
    song: song(c.song),
    muteOriginal: c.muteOriginal === true,
    createdAt: str(c.createdAt),
    author: person(c.author),
    mine: c.mine === true,
    iFollow: c.iFollow === true,
    likes: num(c.likes),
    favorites: num(c.favorites),
    reposts: num(c.reposts),
    shares: num(c.shares),
    liked: c.liked === true,
    favorited: c.favorited === true,
    reposted: c.reposted === true,
    shared: c.shared === true,
    media: arr(c.media).map((m) => {
      const x = obj(m);
      const k = str(x.kind);
      return {
        kind: k === "video" || k === "cover" ? k : "photo",
        path: str(x.path),
        url: null,
        width: num(x.width) || 1,
        height: num(x.height) || 1,
        durationMs: x.durationMs == null ? null : num(x.durationMs),
      };
    }),
    hashtags: arr(c.hashtags).filter((t): t is string => typeof t === "string"),
    people: arr(c.people).map(person),
    repostedBy: via ? { id: str(via.id), name: str(via.name) || str(via.username), username: str(via.username) } : null,
  };
}

/** Signs every file the posts need in two batched calls. */
async function withUrls(posts: FeedPost[]): Promise<FeedPost[]> {
  const mediaPaths = [...new Set(posts.flatMap((p) => p.media.map((m) => m.path)))];
  const avatarPaths = [
    ...new Set(posts.flatMap((p) => [p.author.avatarPath, ...p.people.map((x) => x.avatarPath)]).filter((x): x is string => !!x)),
  ];
  const sign = async (bucket: string, paths: string[]) => {
    const out = new Map<string, string>();
    if (!paths.length) return out;
    const { data } = await supabase.storage.from(bucket).createSignedUrls(paths, URL_TTL);
    for (const s of data ?? []) if (s.path && s.signedUrl) out.set(s.path, s.signedUrl);
    return out;
  };
  const [media, avatars] = await Promise.all([sign("post-media", mediaPaths), sign("avatars", avatarPaths)]);
  const withAvatar = (p: FeedPerson) => ({ ...p, avatarUrl: p.avatarPath ? (avatars.get(p.avatarPath) ?? null) : null });
  return posts.map((p) => ({
    ...p,
    author: withAvatar(p.author),
    people: p.people.map(withAvatar),
    media: p.media.map((m) => ({ ...m, url: media.get(m.path) ?? null })),
  }));
}

const cards = (rows: { card: unknown }[] | null) =>
  (rows ?? []).map((r) => parseCard(r.card)).filter((p): p is FeedPost => !!p);

/* --------------------------------- Fetchers --------------------------------- */

export async function fetchFeedPage(tab: FeedTab, cursor: FeedPage["next"]): Promise<FeedPage> {
  try {
    const { data, error } = await supabase.rpc("feed_posts", {
      _tab: tab,
      _limit: FEED_PAGE,
      ...(cursor ? { _before_at: cursor.at, _before_id: cursor.id } : {}),
    });
    if (error) throw error;
    const rows = data ?? [];
    const last = rows[rows.length - 1];
    return {
      items: await withUrls(cards(rows)),
      next: rows.length === FEED_PAGE && last ? { at: last.sort_at, id: last.post_id } : null,
    };
  } catch (err) {
    throw toAppError(err);
  }
}

const KIND_FILTER: Record<"top" | "videos" | "photos", "all" | "video" | "photo"> = {
  top: "all",
  videos: "video",
  photos: "photo",
};

export async function fetchSearchPage(q: string, kind: "top" | "videos" | "photos", offset: number): Promise<SearchPage> {
  try {
    const { data, error } = await supabase.rpc("search_posts", {
      _q: q,
      _kind: KIND_FILTER[kind],
      _limit: SEARCH_PAGE,
      _offset: offset,
    });
    if (error) throw error;
    const rows = data ?? [];
    return {
      items: await withUrls(cards(rows)),
      nextOffset: rows.length === SEARCH_PAGE ? offset + SEARCH_PAGE : null,
    };
  } catch (err) {
    throw toAppError(err);
  }
}

export async function fetchPost(id: string): Promise<FeedPost | null> {
  try {
    const { data, error } = await supabase.rpc("get_post", { _id: id });
    if (error) throw error;
    const post = parseCard(data);
    return post ? ((await withUrls([post]))[0] ?? null) : null;
  } catch (err) {
    throw toAppError(err);
  }
}

/* ------------------------------- Query options ------------------------------ */

export const feedQuery = (tab: FeedTab) =>
  infiniteQueryOptions({
    queryKey: ["feed", "list", tab] as const,
    queryFn: ({ pageParam }) => fetchFeedPage(tab, pageParam),
    initialPageParam: null as FeedPage["next"],
    getNextPageParam: (last: FeedPage) => last.next ?? undefined,
    staleTime: 60_000,
    retry: shouldRetry,
  });

export const searchPostsQuery = (q: string, kind: "top" | "videos" | "photos") =>
  infiniteQueryOptions({
    queryKey: ["feed", "search", kind, q] as const,
    queryFn: ({ pageParam }) => fetchSearchPage(q, kind, pageParam),
    initialPageParam: 0,
    getNextPageParam: (last: SearchPage) => last.nextOffset ?? undefined,
    staleTime: 60_000,
    retry: shouldRetry,
  });

export const postQuery = (id: string) =>
  queryOptions({
    queryKey: ["feed", "post", id] as const,
    queryFn: () => fetchPost(id),
    staleTime: 60_000,
    retry: shouldRetry,
  });

/* ------------------------------- Cache helpers ------------------------------ */

type Cached = InfiniteData<FeedPage | SearchPage, unknown> | FeedPost | null | undefined;

/** Applies `fn` to every cached copy of matching posts (feeds, search, single). Returns undo. */
export function patchPosts(
  qc: QueryClient,
  match: (p: FeedPost) => boolean,
  fn: (p: FeedPost) => FeedPost | null,
): () => void {
  const snapshot = qc.getQueriesData<Cached>({ queryKey: ["feed"] });
  qc.setQueriesData<Cached>({ queryKey: ["feed"] }, (d) => {
    if (!d) return d;
    if ("pages" in d) {
      return {
        ...d,
        pages: d.pages.map((page) => ({
          ...page,
          items: page.items.flatMap((p) => {
            if (!match(p)) return [p];
            const next = fn(p);
            return next ? [next] : [];
          }),
        })),
      };
    }
    // Single posts stay visible (the user opened it directly) unless deleted.
    return match(d) ? (fn(d) ?? null) : d;
  });
  return () => snapshot.forEach(([key, data]) => qc.setQueryData(key, data));
}

/* ----------------------------------- Rules ---------------------------------- */

/** 1234 -> "1,234", 128400 -> "128.4K", 2_500_000 -> "2.5M". */
export function formatCount(n: number): string {
  if (n < 10_000) return n.toLocaleString("en-US");
  if (n < 1_000_000) return `${trim1(n / 1000)}K`;
  if (n < 1_000_000_000) return `${trim1(n / 1_000_000)}M`;
  return `${trim1(n / 1_000_000_000)}B`;
}
const trim1 = (v: number) => (Math.floor(v * 10) / 10).toFixed(1).replace(/\.0$/, "");

/** Like state after a gesture: double tap only ever likes, the button toggles. */
export function nextLiked(current: boolean, via: "double_tap" | "button"): boolean {
  return via === "double_tap" ? true : !current;
}

export type MenuAction =
  | "edit"
  | "delete"
  | "download"
  | "repost"
  | "not_interested"
  | "report"
  | "block";

/** Owners manage their post; everyone else can react to it. */
export function menuActions(post: Pick<FeedPost, "mine" | "kind">): MenuAction[] {
  const download: MenuAction[] = post.kind === "text" ? [] : ["download"];
  if (post.mine) return ["edit", ...download, "delete"];
  return ["repost", ...download, "not_interested", "report", "block"];
}

/** Display ratio for a post's stage: any media ratio, kept within phone-to-cinema bounds for the frame. */
export function mediaAspect(post: Pick<FeedPost, "kind" | "media">): number {
  const m = post.media.find((x) => x.kind === "video") ?? post.media.find((x) => x.kind === "photo");
  if (!m) return 9 / 16;
  return m.width / m.height;
}
export function stageAspect(ratio: number): number {
  return Math.min(Math.max(ratio, 9 / 16), 16 / 9);
}

export function postLink(origin: string, id: string): string {
  return `${origin}/watch/${id}`;
}

export const SHARE_CHANNELS = ["whatsapp", "telegram", "x", "facebook", "messenger", "reddit", "email", "sms"] as const;
export type ShareChannel = (typeof SHARE_CHANNELS)[number];

/** Where each share app opens, with the link (and short text) filled in. */
export function shareUrl(channel: ShareChannel, link: string, text: string): string {
  const u = encodeURIComponent(link);
  const t = encodeURIComponent(text);
  const both = encodeURIComponent(text ? `${text} ${link}` : link);
  switch (channel) {
    case "whatsapp":
      return `https://wa.me/?text=${both}`;
    case "telegram":
      return `https://t.me/share/url?url=${u}&text=${t}`;
    case "x":
      return `https://twitter.com/intent/tweet?url=${u}&text=${t}`;
    case "facebook":
      return `https://www.facebook.com/sharer/sharer.php?u=${u}`;
    case "messenger":
      return `fb-messenger://share/?link=${u}`;
    case "reddit":
      return `https://www.reddit.com/submit?url=${u}&title=${t}`;
    case "email":
      return `mailto:?subject=${t}&body=${both}`;
    case "sms":
      return `sms:?&body=${both}`;
  }
}

/** Splits a caption into text and #hashtag pieces for rendering. */
export function captionParts(body: string): { text: string; tag: string | null }[] {
  const out: { text: string; tag: string | null }[] = [];
  let last = 0;
  for (const m of body.matchAll(/#([A-Za-z0-9_]{1,30})(?![A-Za-z0-9_])/g)) {
    if (m.index! > last) out.push({ text: body.slice(last, m.index), tag: null });
    out.push({ text: m[0], tag: m[1]!.toLowerCase() });
    last = m.index! + m[0].length;
  }
  if (last < body.length) out.push({ text: body.slice(last), tag: null });
  return out;
}

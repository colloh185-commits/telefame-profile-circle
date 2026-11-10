import {
  infiniteQueryOptions,
  queryOptions,
  useMutation,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppError, isNetworkError, shouldRetry, toAppError } from "@/lib/offline";

export const CONTACT_TABS = ["all", "suggestions", "followers", "following", "friends"] as const;
export type ContactTab = (typeof CONTACT_TABS)[number];

export const TAB_LABELS: Record<ContactTab, string> = {
  all: "All",
  suggestions: "Suggestions",
  followers: "Followers",
  following: "Following",
  friends: "Friends",
};

export const PAGE_SIZE = 20;
export const SEARCH_MAX = 40;
const SIGNED_URL_TTL = 60 * 60 * 24 * 7; // matches the offline cache lifetime

export function toContactTab(value: string | undefined): ContactTab {
  return (CONTACT_TABS as readonly string[]).includes(value ?? "") ? (value as ContactTab) : "all";
}

export function cleanSearch(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, SEARCH_MAX);
}

export type Contact = {
  id: string;
  fullName: string;
  username: string;
  country: string;
  avatarPath: string | null;
  avatarUrl: string | null;
  iFollow: boolean;
  followsMe: boolean;
};

export type ContactsPage = { items: Contact[]; nextOffset: number | null };
export type ContactCounts = { followers: number; following: number; friends: number };

export type FollowState = "follow" | "follow_back" | "following" | "friends";

/** Button state: following each other = friends; they follow you only = follow back. */
export function followState(iFollow: boolean, followsMe: boolean): FollowState {
  if (iFollow && followsMe) return "friends";
  if (iFollow) return "following";
  if (followsMe) return "follow_back";
  return "follow";
}

/** Returns a copy of cached pages with one person's follow flag changed. */
export function applyFollowChange(
  data: InfiniteData<ContactsPage, number>,
  userId: string,
  follow: boolean,
): InfiniteData<ContactsPage, number> {
  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      items: page.items.map((c) => (c.id === userId ? { ...c, iFollow: follow } : c)),
    })),
  };
}

export async function fetchContactsPage(
  tab: ContactTab,
  search: string,
  offset: number,
): Promise<ContactsPage> {
  try {
    const { data, error } = await supabase.rpc("list_contacts", {
      _tab: tab,
      _search: search,
      _limit: PAGE_SIZE + 1,
      _offset: offset,
    });
    if (error) throw error;
    const rows = data ?? [];
    const pageRows = rows.slice(0, PAGE_SIZE);

    const paths = pageRows.map((r) => r.avatar_path).filter((p): p is string => !!p);
    const urls = new Map<string, string>();
    if (paths.length) {
      const signed = await supabase.storage.from("avatars").createSignedUrls(paths, SIGNED_URL_TTL);
      for (const s of signed.data ?? []) if (s.path && s.signedUrl) urls.set(s.path, s.signedUrl);
    }

    return {
      items: pageRows.map((r) => ({
        id: r.id,
        fullName: r.full_name ?? r.username ?? "Telefam reader",
        username: r.username ?? "",
        country: r.country ?? "",
        avatarPath: r.avatar_path ?? null,
        avatarUrl: r.avatar_path ? (urls.get(r.avatar_path) ?? null) : null,
        iFollow: !!r.i_follow,
        followsMe: !!r.follows_me,
      })),
      nextOffset: rows.length > PAGE_SIZE ? offset + PAGE_SIZE : null,
    };
  } catch (err) {
    throw toAppError(err);
  }
}

export const contactsQuery = (tab: ContactTab, search: string) =>
  infiniteQueryOptions({
    queryKey: ["contacts", tab, search] as const,
    queryFn: ({ pageParam }) => fetchContactsPage(tab, search, pageParam),
    initialPageParam: 0,
    getNextPageParam: (last: ContactsPage) => last.nextOffset ?? undefined,
    staleTime: 60_000,
    retry: shouldRetry,
  });

export const contactCountsQuery = () =>
  queryOptions({
    queryKey: ["contact-counts"] as const,
    queryFn: async (): Promise<ContactCounts> => {
      try {
        const { data, error } = await supabase.rpc("contact_counts");
        if (error) throw error;
        const row = data?.[0];
        return {
          followers: Number(row?.followers ?? 0),
          following: Number(row?.following ?? 0),
          friends: Number(row?.friends ?? 0),
        };
      } catch (err) {
        throw toAppError(err);
      }
    },
    staleTime: 60_000,
    retry: shouldRetry,
  });

async function myId(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const id = data.session?.user.id;
  if (!id) throw new AppError("server", "Please sign in again.");
  return id;
}

export async function setFollow(userId: string, follow: boolean) {
  try {
    const me = await myId();
    if (follow) {
      const { error } = await supabase.from("follows").insert({ follower_id: me, following_id: userId });
      if (error && error.code !== "23505") throw error; // already following = fine
    } else {
      const { error } = await supabase
        .from("follows")
        .delete()
        .eq("follower_id", me)
        .eq("following_id", userId);
      if (error) throw error;
    }
  } catch (err) {
    throw toAppError(err);
  }
}

type FollowVars = { userId: string; follow: boolean };
type Snapshot = [readonly unknown[], InfiniteData<ContactsPage, number> | undefined][];

/** Follow / unfollow with instant button feedback; rolls back if it fails. */
export function useFollowToggle() {
  const qc = useQueryClient();
  return useMutation<void, AppError, FollowVars, { snapshot: Snapshot }>({
    networkMode: "always",
    mutationFn: ({ userId, follow }) => setFollow(userId, follow),
    onMutate: async ({ userId, follow }) => {
      const snapshot = qc.getQueriesData<InfiniteData<ContactsPage, number>>({ queryKey: ["contacts"] });
      qc.setQueriesData<InfiniteData<ContactsPage, number>>({ queryKey: ["contacts"] }, (d) =>
        d ? applyFollowChange(d, userId, follow) : d,
      );
      return { snapshot };
    },
    onError: (err, _vars, ctx) => {
      ctx?.snapshot.forEach(([key, data]) => qc.setQueryData(key, data));
      toast.error(isNetworkError(err) ? "No internet connection" : "Couldn't update. Try again.", {
        id: "follow-error",
      });
    },
    onSettled: () => {
      // Keep the visible list stable; other tabs refresh next time they're opened.
      void qc.invalidateQueries({ queryKey: ["contacts"], refetchType: "none" });
      void qc.invalidateQueries({ queryKey: ["contact-counts"] });
    },
  });
}

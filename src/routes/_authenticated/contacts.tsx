import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useInfiniteQuery, useQuery, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { useEffect, useMemo, useRef, useState } from "react";
import { EllipsisVertical, Loader2, Search, WifiOff, X } from "lucide-react";
import { HomeMenu } from "@/components/telefam/home/HomeMenu";
import { DesktopRail, MobileBottomNav } from "@/components/telefam/shell/AppNav";
import { ContactRow } from "@/components/telefam/contacts/ContactRow";
import {
  ContactSkeleton,
  EmptyContacts,
  LoadFailed,
  NoInternet,
} from "@/components/telefam/contacts/ContactStates";
import {
  CONTACT_TABS,
  SEARCH_MAX,
  TAB_LABELS,
  cleanSearch,
  contactCountsQuery,
  contactsQuery,
  toContactTab,
  type Contact,
  type ContactCounts,
  type ContactTab,
  type ContactsPage,
} from "@/lib/contacts";
import { myProfileQuery } from "@/lib/my-profile";
import { isNetworkError, useOnline } from "@/lib/offline";
import { cn } from "@/lib/utils";

const searchSchema = z.object({
  tab: fallback(z.string(), "all").default("all"),
  q: fallback(z.string(), "").default(""),
});

export const Route = createFileRoute("/_authenticated/contacts")({
  validateSearch: zodValidator(searchSchema),
  head: () => ({
    meta: [
      { title: "Contacts — Telefam" },
      { name: "description", content: "Find readers, follow friends and see who follows you on Telefam." },
      { property: "og:title", content: "Contacts — Telefam" },
      { property: "og:description", content: "Find readers, follow friends and see who follows you on Telefam." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ContactsPageView,
});

function ContactsPageView() {
  const search = Route.useSearch();
  const tab = toContactTab(search.tab);
  const q = cleanSearch(search.q);
  const navigate = useNavigate({ from: "/contacts" });
  const { data: profile } = useQuery(myProfileQuery());
  const { data: counts } = useQuery(contactCountsQuery());
  const me = { avatarUrl: profile?.avatarUrl, avatarPath: profile?.avatarPath, name: profile?.fullName };

  const setTab = (next: ContactTab) =>
    navigate({ search: (prev) => ({ ...prev, tab: next }), replace: true });
  const setQuery = (next: string) =>
    navigate({ search: (prev) => ({ ...prev, q: next || undefined }), replace: true });

  return (
    <div className="h-dvh bg-muted">
      <div className="mx-auto flex h-full max-w-[1680px] overflow-hidden bg-background md:shadow-soft 2xl:border-x">
        <DesktopRail active="contacts" me={me} className="hidden w-[68px] shrink-0 md:flex lg:w-[72px]" />

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="shrink-0 bg-brand-gradient pt-safe md:pt-0">
            <div className="mx-auto w-full max-w-5xl px-3 pb-5 pt-1.5 md:px-6 md:pb-6 md:pt-5">
              <div className="mb-2.5 flex items-center justify-between gap-2 text-primary-foreground md:mb-3.5">
                <div className="min-w-0 pl-1">
                  <h1 className="truncate text-lg font-extrabold tracking-tight md:text-2xl">Contacts</h1>
                  <p className="hidden text-xs font-medium opacity-85 md:block">
                    {counts
                      ? `${counts.followers} followers · ${counts.following} following · ${counts.friends} friends`
                      : "Find readers and grow your circle"}
                  </p>
                </div>
                <HomeMenu>
                  <button
                    type="button"
                    aria-label="More options"
                    className="flex size-9 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-primary-foreground/15"
                  >
                    <EllipsisVertical className="size-5" />
                  </button>
                </HomeMenu>
              </div>
              <SearchBox value={q} onChange={setQuery} />
              <TabStrip active={tab} counts={counts} onSelect={setTab} />
            </div>
          </header>

          <ContactsList key={`${tab}:${q}`} tab={tab} q={q} />

          <MobileBottomNav active="contacts" me={me} />
        </div>
      </div>
    </div>
  );
}

/* ----------------------------------- Search ---------------------------------- */

function SearchBox({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [text, setText] = useState(value);
  const changeRef = useRef(onChange);
  changeRef.current = onChange;

  useEffect(() => setText(value), [value]);

  useEffect(() => {
    const next = cleanSearch(text);
    if (next === value) return;
    const t = setTimeout(() => changeRef.current(next), 300);
    return () => clearTimeout(t);
  }, [text, value]);

  return (
    <label className="flex h-9 w-full items-center gap-2.5 rounded-full bg-background px-3.5 text-muted-foreground shadow-soft focus-within:ring-2 focus-within:ring-primary-foreground/60 md:h-10 md:max-w-xl">
      <Search className="size-4 shrink-0" />
      <input
        type="search"
        value={text}
        maxLength={SEARCH_MAX}
        onChange={(e) => setText(e.target.value)}
        placeholder="Search by name or username"
        aria-label="Search contacts"
        enterKeyHint="search"
        autoComplete="off"
        className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:hidden"
      />
      {text && (
        <button
          type="button"
          onClick={() => {
            setText("");
            changeRef.current("");
          }}
          aria-label="Clear search"
          className="flex size-5 items-center justify-center rounded-full bg-muted text-muted-foreground hover:text-foreground"
        >
          <X className="size-3" />
        </button>
      )}
    </label>
  );
}

/* ------------------------------------ Tabs ----------------------------------- */

function TabStrip({
  active,
  counts,
  onSelect,
}: {
  active: ContactTab;
  counts: ContactCounts | undefined;
  onSelect: (t: ContactTab) => void;
}) {
  const countFor = (t: ContactTab) =>
    t === "followers" || t === "following" || t === "friends" ? counts?.[t] : undefined;

  return (
    <div role="tablist" aria-label="Contact groups" className="scrollbar-none -mx-3 mt-3 flex gap-1.5 overflow-x-auto px-3 md:mx-0 md:px-0">
      {CONTACT_TABS.map((t) => {
        const selected = t === active;
        const n = countFor(t);
        return (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onSelect(t)}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold transition-colors md:px-3.5 md:py-1.5",
              selected
                ? "bg-primary-foreground text-primary shadow-soft"
                : "text-primary-foreground/90 hover:bg-primary-foreground/15",
            )}
          >
            {TAB_LABELS[t]}
            {n !== undefined && n > 0 && (
              <span
                className={cn(
                  "rounded-full px-1.5 text-[0.625rem] leading-4",
                  selected ? "bg-primary text-primary-foreground" : "bg-primary-foreground/20",
                )}
              >
                {n > 999 ? "999+" : n}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------ List ----------------------------------- */

/** While offline, search what's already saved on the device for this tab. */
function useOfflineMatches(tab: ContactTab, q: string, enabled: boolean): Contact[] | null {
  const qc = useQueryClient();
  return useMemo(() => {
    if (!enabled) return null;
    const saved = qc.getQueryData<InfiniteData<ContactsPage, number>>(["contacts", tab, ""]);
    if (!saved) return null;
    const needle = q.toLowerCase();
    return saved.pages
      .flatMap((p) => p.items)
      .filter((c) => c.fullName.toLowerCase().includes(needle) || c.username.toLowerCase().includes(needle));
  }, [qc, tab, q, enabled]);
}

function ContactsList({ tab, q }: { tab: ContactTab; q: string }) {
  const online = useOnline();
  const query = useInfiniteQuery(contactsQuery(tab, q));
  const { data, error, hasNextPage, isFetchingNextPage, fetchNextPage, refetch } = query;
  const items = useMemo(() => data?.pages.flatMap((p) => p.items) ?? [], [data]);
  const sentinel = useRef<HTMLDivElement>(null);

  const offlineMatches = useOfflineMatches(tab, q, !data && !!q && !online);
  const noConnection = !online || isNetworkError(error);

  // Infinite scroll: load the next page as the end of the list comes into view.
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasNextPage || !online) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !isFetchingNextPage) void fetchNextPage();
      },
      { rootMargin: "400px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, online]);

  const list = data ? items : offlineMatches;

  return (
    <main className="relative -mt-3 flex min-h-0 flex-1 flex-col overflow-y-auto rounded-t-3xl bg-background md:-mt-0 md:rounded-none md:bg-muted/40">
      {!online && list && (
        <div className="sticky top-0 z-10 flex items-center justify-center gap-2 bg-muted px-4 py-1.5 text-xs font-semibold text-muted-foreground">
          <WifiOff className="size-3.5" /> You're offline · showing saved contacts
        </div>
      )}

      <div className="mx-auto w-full max-w-5xl pb-4 pt-2 md:px-6 md:pt-6">
        {list ? (
          list.length === 0 ? (
            <EmptyContacts tab={tab} search={q} />
          ) : (
            <>
              <h2 className="px-4 pb-1 pt-2 text-[0.6875rem] font-bold uppercase tracking-wider text-muted-foreground md:px-1 md:pb-3 md:pt-0">
                {q ? `Results for "${q}"` : TAB_LABELS[tab]}
              </h2>
              <ul className="md:grid md:grid-cols-2 md:gap-3 xl:grid-cols-3">
                {list.map((c) => (
                  <ContactRow key={c.id} contact={c} />
                ))}
              </ul>
              <div ref={sentinel} className="flex h-14 items-center justify-center">
                {isFetchingNextPage && <Loader2 className="size-5 animate-spin text-primary" />}
                {!isFetchingNextPage && hasNextPage && !online && (
                  <span className="text-xs text-muted-foreground">Connect to the internet to see more</span>
                )}
                {!isFetchingNextPage && hasNextPage && online && error && (
                  <button
                    type="button"
                    onClick={() => void fetchNextPage()}
                    className="rounded-full bg-muted px-4 py-1.5 text-xs font-bold text-foreground hover:bg-muted/70"
                  >
                    Load more
                  </button>
                )}
              </div>
            </>
          )
        ) : noConnection ? (
          <NoInternet canRetry={online} onRetry={() => void refetch()} />
        ) : error ? (
          <LoadFailed onRetry={() => void refetch()} />
        ) : (
          <ul aria-busy="true" aria-label="Loading contacts" className="md:grid md:grid-cols-2 md:gap-3 xl:grid-cols-3">
            {Array.from({ length: 8 }, (_, i) => (
              <ContactSkeleton key={i} />
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}

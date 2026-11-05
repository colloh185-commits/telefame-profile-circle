import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, type ComponentType } from "react";
import {
  EllipsisVertical,
  GalleryVerticalEnd,
  MessageSquare,
  MessageSquarePlus,
  Moon,
  Plus,
  Sun,
  Users,
} from "lucide-react";
import { LogoMark } from "@/components/telefam/Logo";
import { BookDoodle } from "@/components/telefam/Decor";
import { HomeMenu } from "@/components/telefam/home/HomeMenu";
import { Avatar, EmptyConversation, SearchPill } from "@/components/telefam/home/parts";
import { comingSoon } from "@/lib/coming-soon";
import { myProfileQuery } from "@/lib/my-profile";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/home")({
  head: () => ({
    meta: [
      { title: "Chats — Telefam" },
      { name: "description", content: "Your Telefam chats: talk with friends, family and reading groups." },
      { property: "og:title", content: "Chats — Telefam" },
      { property: "og:description", content: "Talk with friends, family and reading groups on Telefam." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

type NavItem = { key: string; label: string; icon: ComponentType<{ className?: string }> };
const NAV: NavItem[] = [
  { key: "chats", label: "Chats", icon: MessageSquare },
  { key: "contacts", label: "Contacts", icon: Users },
  { key: "feeds", label: "Feeds", icon: GalleryVerticalEnd },
];

function Home() {
  const navigate = useNavigate();
  const { data: profile } = useQuery(myProfileQuery());

  useEffect(() => {
    if (profile && !profile.onboarded) navigate({ to: "/profile-setup", replace: true });
  }, [profile, navigate]);

  return (
    <>
      <MobileHome avatarUrl={profile?.avatarUrl} name={profile?.fullName} />
      <DesktopHome
        avatarUrl={profile?.avatarUrl}
        name={profile?.fullName}
        username={profile?.username}
      />
    </>
  );
}

/* ---------------------------------- Mobile --------------------------------- */

function MobileHome({ avatarUrl, name }: { avatarUrl: string | null | undefined; name: string | undefined }) {
  return (
    <div className="flex h-dvh flex-col bg-background md:hidden">
      <header className="shrink-0 bg-brand-gradient pt-safe">
        <div className="flex items-center gap-1.5 px-3 pb-6 pt-1.5">
          <SearchPill />
          <HomeMenu>
            <button
              type="button"
              aria-label="More options"
              className="flex size-9 shrink-0 items-center justify-center rounded-full text-primary-foreground transition-colors hover:bg-primary-foreground/15"
            >
              <EllipsisVertical className="size-5" />
            </button>
          </HomeMenu>
        </div>
      </header>

      <main className="relative -mt-4 flex min-h-0 flex-1 flex-col overflow-y-auto rounded-t-3xl bg-background">
        <div className="m-auto py-8">
          <EmptyConversation />
        </div>
      </main>

      <nav
        aria-label="Main"
        className="shrink-0 border-t bg-background pb-safe shadow-nav"
      >
        <div className="mx-auto grid max-w-md grid-cols-5 items-end px-1 pt-1">
          <BottomTab item={NAV[0]!} active />
          <BottomTab item={NAV[1]!} />
          <div className="flex flex-col items-center">
            <button
              type="button"
              onClick={() => comingSoon("Post")}
              aria-label="Post"
              className="-mt-5 flex size-11 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-brand ring-4 ring-background transition-transform active:scale-95"
            >
              <Plus className="size-5" strokeWidth={2.5} />
            </button>
            <span className="mt-0.5 pb-1 text-[0.6875rem] font-semibold text-muted-foreground">Post</span>
          </div>
          <BottomTab item={NAV[2]!} />
          <button
            type="button"
            onClick={() => comingSoon("Profile")}
            className="flex flex-col items-center gap-0.5 pb-1 pt-1"
          >
            <Avatar url={avatarUrl} name={name} className="size-[22px] ring-2 ring-border" />
            <span className="text-[0.6875rem] font-semibold text-muted-foreground">Profile</span>
          </button>
        </div>
      </nav>
    </div>
  );
}

function BottomTab({ item, active = false }: { item: NavItem; active?: boolean }) {
  const Icon = item.icon;
  return (
    <button
      type="button"
      onClick={() => (active ? undefined : comingSoon(item.label))}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex flex-col items-center gap-0.5 pb-1 pt-1 transition-colors",
        active ? "text-primary" : "text-muted-foreground hover:text-foreground",
      )}
    >
      <Icon className={cn("size-[22px]", active && "fill-current")} />
      <span className="text-[0.6875rem] font-semibold">{item.label}</span>
    </button>
  );
}

/* --------------------------------- Desktop --------------------------------- */

function DesktopHome({
  avatarUrl,
  name,
  username,
}: {
  avatarUrl: string | null | undefined;
  name: string | undefined;
  username: string | undefined;
}) {
  const { resolved, toggle } = useTheme();

  return (
    <div className="hidden h-dvh bg-muted md:block">
      <div className="mx-auto grid h-full max-w-[1680px] grid-cols-[68px_300px_minmax(0,1fr)] overflow-hidden bg-background shadow-soft lg:grid-cols-[72px_340px_minmax(0,1fr)] 2xl:border-x">
        {/* Rail */}
        <aside className="flex flex-col items-center gap-1.5 bg-brand-gradient py-4 text-primary-foreground">
          <LogoMark className="mb-3 size-10" />
          {NAV.map((item, i) => (
            <RailButton key={item.key} item={item} active={i === 0} />
          ))}
          <button
            type="button"
            onClick={() => comingSoon("Post")}
            aria-label="Post"
            className="mt-2 flex size-10 items-center justify-center rounded-xl bg-primary-foreground text-primary shadow-brand transition-transform hover:scale-105 active:scale-95"
          >
            <Plus className="size-5" strokeWidth={2.5} />
          </button>
          <div className="mt-auto flex flex-col items-center gap-3">
            <button
              type="button"
              onClick={toggle}
              aria-label={resolved === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              className="flex size-9 items-center justify-center rounded-xl text-primary-foreground/85 transition-colors hover:bg-primary-foreground/15 hover:text-primary-foreground"
            >
              {resolved === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </button>
            <HomeMenu align="start" side="right">
              <button type="button" aria-label="Account menu" className="rounded-full ring-2 ring-primary-foreground/70 transition hover:ring-primary-foreground">
                <Avatar url={avatarUrl} name={name} className="size-9" />
              </button>
            </HomeMenu>
          </div>
        </aside>

        {/* Chat list */}
        <section className="flex min-h-0 flex-col border-r bg-background">
          <header className="shrink-0 bg-brand-gradient px-4 pb-5 pt-4">
            <div className="mb-3 flex items-center justify-between gap-3 text-primary-foreground">
              <div className="min-w-0">
                <h1 className="truncate text-xl font-extrabold tracking-tight">Chats</h1>
                {username && <p className="truncate text-xs font-medium opacity-80">@{username}</p>}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => comingSoon("New chat")}
                  aria-label="New chat"
                  className="flex size-8 items-center justify-center rounded-full transition-colors hover:bg-primary-foreground/15"
                >
                  <MessageSquarePlus className="size-4" />
                </button>
                <HomeMenu>
                  <button
                    type="button"
                    aria-label="More options"
                    className="flex size-8 items-center justify-center rounded-full transition-colors hover:bg-primary-foreground/15"
                  >
                    <EllipsisVertical className="size-4" />
                  </button>
                </HomeMenu>
              </div>
            </div>
            <SearchPill />
          </header>

          <div className="-mt-3 flex min-h-0 flex-1 flex-col rounded-t-3xl bg-background">
            <div className="flex shrink-0 gap-1.5 overflow-x-auto px-4 pb-2 pt-4">
              {["All", "Unread", "Groups", "Book clubs"].map((f, i) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => (i === 0 ? undefined : comingSoon(`${f} filter`))}
                  className={cn(
                    "shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition-colors",
                    i === 0
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:text-foreground",
                  )}
                >
                  {f}
                </button>
              ))}
            </div>
            <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
              <MessageSquare className="size-8 text-muted-foreground/50" />
              <p className="mt-2.5 text-sm font-bold">No chats yet</p>
              <p className="mt-1 text-xs text-muted-foreground">Your conversations will appear here.</p>
            </div>
          </div>
        </section>

        {/* Conversation area */}
        <main className="relative flex min-h-0 items-center justify-center overflow-hidden bg-background">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 text-primary/[0.06]">
            <BookDoodle className="absolute left-[8%] top-[10%] w-24 rotate-[-12deg]" />
            <BookDoodle className="absolute right-[10%] top-[18%] w-20 rotate-[14deg]" />
            <BookDoodle className="absolute bottom-[14%] left-[16%] w-20 rotate-[8deg]" />
            <BookDoodle className="absolute bottom-[10%] right-[14%] w-28 rotate-[-8deg]" />
            <BookDoodle className="absolute left-[44%] top-[6%] w-14 rotate-[4deg]" />
          </div>
          <div className="relative">
            <EmptyConversation size="lg" />
            <p className="mt-8 text-center text-xs font-medium text-muted-foreground">
              Telefam · Read • Discover • Share
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}

function RailButton({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <button
      type="button"
      onClick={() => (active ? undefined : comingSoon(item.label))}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex w-14 flex-col items-center gap-1 rounded-xl py-2 text-[0.625rem] font-semibold transition-colors",
        active
          ? "bg-primary-foreground/20 text-primary-foreground"
          : "text-primary-foreground/75 hover:bg-primary-foreground/10 hover:text-primary-foreground",
      )}
    >
      <Icon className={cn("size-5", active && "fill-current")} />
      {item.label}
    </button>
  );
}

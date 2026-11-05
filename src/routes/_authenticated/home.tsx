import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { EllipsisVertical, MessageSquare, MessageSquarePlus } from "lucide-react";
import { BookDoodle } from "@/components/telefam/Decor";
import { HomeMenu } from "@/components/telefam/home/HomeMenu";
import { EmptyConversation, SearchPill } from "@/components/telefam/home/parts";
import { DesktopRail, MobileBottomNav } from "@/components/telefam/shell/AppNav";
import { comingSoon } from "@/lib/coming-soon";
import { myProfileQuery } from "@/lib/my-profile";
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

function Home() {
  const navigate = useNavigate();
  const { data: profile } = useQuery(myProfileQuery());

  useEffect(() => {
    if (profile && !profile.onboarded) navigate({ to: "/profile-setup", replace: true });
  }, [profile, navigate]);

  const me = { avatarUrl: profile?.avatarUrl, avatarPath: profile?.avatarPath, name: profile?.fullName };

  return (
    <>
      <MobileHome me={me} />
      <DesktopHome me={me} username={profile?.username} />
    </>
  );
}

/* ---------------------------------- Mobile --------------------------------- */

type Me = { avatarUrl: string | null | undefined; avatarPath?: string | null; name: string | undefined };

function MobileHome({ me }: { me: Me }) {
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

      <MobileBottomNav active="chats" me={me} />
    </div>
  );
}

/* --------------------------------- Desktop --------------------------------- */

function DesktopHome({ me, username }: { me: Me; username: string | undefined }) {

  return (
    <div className="hidden h-dvh bg-muted md:block">
      <div className="mx-auto grid h-full max-w-[1680px] grid-cols-[68px_300px_minmax(0,1fr)] overflow-hidden bg-background shadow-soft lg:grid-cols-[72px_340px_minmax(0,1fr)] 2xl:border-x">
        <DesktopRail active="chats" me={me} />

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

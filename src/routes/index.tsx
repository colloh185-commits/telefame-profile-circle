import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { LogoMark, Wordmark } from "@/components/telefam/Logo";
import { BookDoodle, LoadingDots } from "@/components/telefam/Decor";
import { nextPathForUser } from "@/lib/my-profile";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Telefam — Read • Discover • Share" },
      { name: "description", content: "Telefam: discover great reads, share what you love and connect with fellow readers." },
      { property: "og:title", content: "Telefam — Read • Discover • Share" },
      { property: "og:description", content: "Discover great reads, share what you love and connect with fellow readers." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Splash,
});

function Splash() {
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    const minDelay = new Promise((r) => setTimeout(r, 1800));
    Promise.all([nextPathForUser().catch(() => "/auth" as const), minDelay]).then(([to]) => {
      if (!cancelled) navigate({ to, replace: true });
    });
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return (
    <div className="min-h-dvh bg-muted">
      <div className="relative mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center overflow-hidden bg-splash-gradient px-6 text-center text-primary-foreground">
        <BookDoodle className="absolute -left-2 top-16 w-20 rotate-[-14deg] text-primary-foreground/15" />
        <BookDoodle className="absolute -right-2 top-40 w-16 rotate-[16deg] text-primary-foreground/10" />
        <BookDoodle className="absolute bottom-28 left-8 w-14 rotate-[8deg] text-primary-foreground/10" />
        <BookDoodle className="absolute bottom-44 right-6 w-20 rotate-[-10deg] text-primary-foreground/15" />

        <LogoMark animated className="size-40 animate-logo-rise" />
        <Wordmark
          className="mt-6 animate-fade-up text-6xl [animation-delay:250ms]"
          taglineClassName="mt-3 text-lg"
        />

        <div className="absolute bottom-16 flex flex-col items-center gap-4">
          <LoadingDots className="text-primary-foreground" />
          <p className="text-sm font-medium opacity-80">Your next great read awaits</p>
        </div>
      </div>
    </div>
  );
}

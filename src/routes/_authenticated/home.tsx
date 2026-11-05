import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { LogOut, MapPin, Pencil, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { LogoMark } from "@/components/telefam/Logo";
import { BookDoodle, LoadingDots, WaveBase } from "@/components/telefam/Decor";
import { Button } from "@/components/ui/button";
import { myProfileQuery } from "@/lib/my-profile";

export const Route = createFileRoute("/_authenticated/home")({
  head: () => ({
    meta: [
      { title: "Home — Telefam" },
      { name: "description", content: "Your Telefam home: your reader profile and what's next." },
      { property: "og:title", content: "Home — Telefam" },
      { property: "og:description", content: "Your Telefam home." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

function Home() {
  const navigate = useNavigate();
  const { data: profile, isLoading } = useQuery(myProfileQuery());

  useEffect(() => {
    if (profile && !profile.onboarded) navigate({ to: "/profile-setup", replace: true });
  }, [profile, navigate]);

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-dvh bg-muted">
      <div className="relative mx-auto flex min-h-dvh w-full max-w-md flex-col overflow-hidden bg-background">
        <header className="relative bg-brand-gradient header-arc px-5 pb-24 pt-8 text-primary-foreground">
          <BookDoodle className="absolute right-4 top-16 w-16 rotate-[12deg] text-primary-foreground/15" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <LogoMark className="size-10" />
              <span className="text-2xl font-extrabold tracking-tight">Telefam</span>
            </div>
            <button
              type="button"
              onClick={signOut}
              aria-label="Sign out"
              className="flex size-10 items-center justify-center rounded-full bg-primary-deep/70 hover:bg-primary-deep"
            >
              <LogOut className="size-5" />
            </button>
          </div>
        </header>

        <main className="relative z-10 -mt-20 flex-1 px-5">
          {isLoading || !profile ? (
            <div className="flex justify-center pt-24 text-primary">
              <LoadingDots />
            </div>
          ) : (
            <div className="animate-fade-up rounded-3xl border bg-card p-6 text-center shadow-soft">
              <div className="mx-auto size-28 overflow-hidden rounded-full border-[3px] border-primary bg-muted p-1">
                {profile.avatarUrl ? (
                  <img src={profile.avatarUrl} alt={profile.fullName} className="size-full rounded-full object-cover" />
                ) : (
                  <div className="flex size-full items-center justify-center rounded-full">
                    <User className="size-12 text-muted-foreground" />
                  </div>
                )}
              </div>
              <h1 className="mt-4 text-2xl font-extrabold">{profile.fullName}</h1>
              <p className="font-semibold text-primary">@{profile.username}</p>
              <p className="mt-2 flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
                <MapPin className="size-4" /> {profile.location}, {profile.country}
              </p>
              {profile.bio && <p className="mt-4 text-foreground/90">{profile.bio}</p>}
              <Button asChild variant="outline-pill" size="xl" className="mt-6">
                <Link to="/profile-setup">
                  <Pencil /> Edit Profile
                </Link>
              </Button>
            </div>
          )}

          <p className="mt-8 text-center text-sm font-medium text-muted-foreground">
            Welcome to Telefam — your library is coming soon.
          </p>
        </main>

        <WaveBase className="mt-8 h-16" />
      </div>
    </div>
  );
}

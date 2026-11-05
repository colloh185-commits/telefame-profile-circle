import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import {
  ArrowRight,
  AtSign,
  Camera,
  ChevronDown,
  ChevronLeft,
  CircleCheck,
  CircleX,
  Globe,
  Loader2,
  MapPin,
  Quote,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { LogoMark, Wordmark } from "@/components/telefam/Logo";
import { BookDoodle, WaveBase } from "@/components/telefam/Decor";
import { FieldShell, fieldInputClass } from "@/components/telefam/Field";
import { Button } from "@/components/ui/button";
import { COUNTRIES, CITY_SUGGESTIONS } from "@/lib/countries";
import { BIO_MAX, fieldErrors, profileSchema, usernameSchema } from "@/lib/validation";
import { checkUsername, saveProfile } from "@/lib/profile.functions";
import { prepareAvatar } from "@/lib/avatar-image";
import { myProfileQuery } from "@/lib/my-profile";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/profile-setup")({
  head: () => ({
    meta: [
      { title: "Profile setup — Telefam" },
      { name: "description", content: "Set up your Telefam reader profile: photo, name, username and more." },
      { property: "og:title", content: "Profile setup — Telefam" },
      { property: "og:description", content: "Set up your Telefam reader profile." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProfileSetup,
});

type Errs = Partial<Record<"fullName" | "username" | "country" | "location" | "bio" | "avatar" | "form", string>>;
type UsernameState = "idle" | "checking" | "available" | "taken" | "invalid";

function ProfileSetup() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: profile } = useQuery(myProfileQuery());
  const checkUsernameFn = useServerFn(checkUsername);
  const saveProfileFn = useServerFn(saveProfile);

  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [country, setCountry] = useState("");
  const [location, setLocation] = useState("");
  const [bio, setBio] = useState("");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarData, setAvatarData] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [errors, setErrors] = useState<Errs>({});
  const [unameState, setUnameState] = useState<UsernameState>("idle");
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const prefilled = useRef(false);

  useEffect(() => {
    if (!profile || prefilled.current) return;
    prefilled.current = true;
    setFullName(profile.fullName);
    setUsername(profile.username);
    setCountry(profile.country);
    setLocation(profile.location);
    setBio(profile.bio);
    if (profile.avatarUrl) setAvatarPreview(profile.avatarUrl);
  }, [profile]);

  // Debounced live username availability check.
  useEffect(() => {
    if (!username) return setUnameState("idle");
    const parsed = usernameSchema.safeParse(username);
    if (!parsed.success) return setUnameState("invalid");
    if (profile?.username && parsed.data === profile.username) return setUnameState("available");
    setUnameState("checking");
    const id = setTimeout(async () => {
      try {
        const res = await checkUsernameFn({ data: { username: parsed.data } });
        setUnameState(res.available ? "available" : "taken");
      } catch {
        setUnameState("idle");
      }
    }, 450);
    return () => clearTimeout(id);
  }, [username, profile?.username, checkUsernameFn]);

  async function onPickPhoto(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setProcessing(true);
    try {
      const { base64, previewUrl } = await prepareAvatar(file);
      setAvatarData(base64);
      setAvatarPreview(previewUrl);
      setErrors((x) => ({ ...x, avatar: "" }));
    } catch (err) {
      setErrors((x) => ({ ...x, avatar: err instanceof Error ? err.message : "Invalid photo" }));
    } finally {
      setProcessing(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    const parsed = profileSchema.safeParse({ fullName, username, country, location, bio });
    if (!parsed.success) return setErrors(fieldErrors<keyof Errs>(parsed.error));
    if (unameState === "taken") return setErrors({ username: "This username is already taken" });

    setErrors({});
    setSaving(true);
    try {
      const res = await saveProfileFn({
        data: { ...parsed.data, ...(avatarData ? { avatar: avatarData } : {}) },
      });
      if (!res.ok) {
        setErrors({ [res.field]: res.error } as Errs);
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ["my-profile"] });
      toast.success("Profile saved");
      navigate({ to: "/home", replace: true });
    } catch {
      setErrors({ form: "Something went wrong. Please check your details and try again." });
    } finally {
      setSaving(false);
    }
  }

  async function onBack() {
    if (profile?.onboarded) return navigate({ to: "/home" });
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const cities = CITY_SUGGESTIONS[country] ?? [];

  return (
    <div className="min-h-dvh bg-muted">
      <div className="relative mx-auto flex min-h-dvh w-full max-w-md flex-col overflow-hidden bg-background">
        <header className="relative bg-brand-gradient px-5 pb-12 pt-8">
          <BookDoodle className="absolute -left-3 top-20 w-20 rotate-[-10deg] text-primary-foreground/15" />
          <BookDoodle className="absolute -right-3 top-20 w-20 rotate-[10deg] text-primary-foreground/15" />
          <button
            type="button"
            onClick={onBack}
            aria-label="Go back"
            className="absolute left-4 top-8 flex size-11 items-center justify-center rounded-full bg-primary-deep/80 text-primary-foreground transition-colors hover:bg-primary-deep"
          >
            <ChevronLeft className="size-6" />
          </button>
          <div className="flex items-center justify-center gap-3 pl-8">
            <LogoMark className="size-20" />
            <Wordmark className="text-4xl" taglineClassName="text-xs" />
          </div>
          <svg viewBox="0 0 400 40" preserveAspectRatio="none" className="absolute inset-x-0 -bottom-px h-8 w-full" aria-hidden="true">
            <path d="M0 18 C 90 40, 170 2, 250 14 C 320 24, 360 30, 400 10 L400 40 L0 40 Z" className="fill-background" />
          </svg>
        </header>

        <main className="relative z-10 flex-1 px-5 pb-4 pt-2">
          <div className="animate-fade-up text-center">
            <h1 className="text-[2rem] font-extrabold tracking-tight">Profile Setup</h1>
            <p className="mt-1 text-base font-medium text-muted-foreground">
              Let's set up your profile to get started
            </p>
          </div>

          <div className="mt-6 flex flex-col items-center">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="group relative size-36 rounded-full border-[3px] border-primary p-1 transition-transform active:scale-95"
              aria-label="Upload profile photo"
            >
              <div className="flex size-full items-center justify-center overflow-hidden rounded-full bg-muted">
                {avatarPreview ? (
                  <img src={avatarPreview} alt="Profile photo preview" className="size-full object-cover" />
                ) : (
                  <User className="size-14 text-muted-foreground" />
                )}
                {processing && (
                  <div className="absolute inset-1 flex items-center justify-center rounded-full bg-foreground/40">
                    <Loader2 className="size-8 animate-spin text-primary-foreground" />
                  </div>
                )}
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 flex size-12 items-center justify-center rounded-full border-4 border-background bg-primary text-primary-foreground shadow-brand">
                <Camera className="size-5" />
              </span>
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
              className="hidden"
              onChange={onPickPhoto}
            />
            {errors.avatar ? (
              <p className="mt-2 text-xs font-medium text-destructive">{errors.avatar}</p>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">JPG, PNG or WebP · max 15 MB</p>
            )}
          </div>

          <form onSubmit={onSubmit} noValidate className="mt-6 space-y-3.5">
            <FieldShell icon={<User />} label="Full Name" htmlFor="fullName" error={errors.fullName}>
              <input
                id="fullName"
                autoComplete="name"
                maxLength={60}
                placeholder="Your full name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className={fieldInputClass}
              />
            </FieldShell>

            <FieldShell
              icon={<AtSign />}
              label="Username"
              htmlFor="username"
              error={errors.username ?? (unameState === "taken" ? "This username is already taken" : undefined)}
              trailing={<UsernameBadge state={unameState} />}
            >
              <input
                id="username"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                maxLength={21}
                placeholder="your_username"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s/g, ""))}
                className={fieldInputClass}
              />
            </FieldShell>

            <FieldShell
              icon={<Globe />}
              label="Country"
              htmlFor="country"
              error={errors.country}
              trailing={<ChevronDown className="size-6 text-foreground/70" />}
            >
              <select
                id="country"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className={cn(fieldInputClass, "cursor-pointer appearance-none", !country && "text-muted-foreground")}
              >
                <option value="" disabled>
                  Select your country
                </option>
                {COUNTRIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </FieldShell>

            <FieldShell
              icon={<MapPin />}
              label="Location"
              htmlFor="location"
              error={errors.location}
              trailing={cities.length ? <ChevronDown className="size-6 text-foreground/70" /> : undefined}
            >
              <input
                id="location"
                list="city-suggestions"
                autoComplete="address-level2"
                maxLength={80}
                placeholder="City or town"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className={fieldInputClass}
              />
              <datalist id="city-suggestions">
                {cities.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </FieldShell>

            <FieldShell
              icon={<Quote className="rotate-180 fill-current" />}
              label="Bio"
              htmlFor="bio"
              error={errors.bio}
              trailing={
                <span className={cn("text-xs", bio.length > BIO_MAX ? "text-destructive" : "text-muted-foreground")}>
                  {bio.length}/{BIO_MAX}
                </span>
              }
            >
              <input
                id="bio"
                maxLength={BIO_MAX}
                placeholder="Book lover | Reader | …"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className={cn(fieldInputClass, "caret-primary")}
              />
            </FieldShell>

            {errors.form && (
              <p role="alert" className="rounded-xl bg-accent px-4 py-2.5 text-center text-sm font-medium text-accent-foreground">
                {errors.form}
              </p>
            )}

            <div className="pt-3">
              <Button type="submit" variant="brand" size="xl" disabled={saving || processing}>
                {saving ? (
                  <>
                    <Loader2 className="animate-spin" /> Saving…
                  </>
                ) : (
                  <>
                    Continue <ArrowRight />
                  </>
                )}
              </Button>
            </div>
          </form>

          <p className="mt-5 text-center font-semibold text-muted-foreground">
            You can update this later in <span className="text-primary">Settings</span>
          </p>
        </main>

        <WaveBase className="h-16" />
      </div>
    </div>
  );
}

function UsernameBadge({ state }: { state: UsernameState }) {
  if (state === "checking") return <Loader2 className="size-6 animate-spin text-muted-foreground" />;
  if (state === "available")
    return <CircleCheck className="size-7 fill-success text-success-foreground" aria-label="Username available" />;
  if (state === "taken" || state === "invalid")
    return <CircleX className="size-7 fill-destructive text-destructive-foreground" aria-label="Username unavailable" />;
  return null;
}

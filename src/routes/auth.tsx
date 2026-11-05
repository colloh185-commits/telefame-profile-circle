import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Eye, EyeOff, Lock, Mail, MailCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { AuthLayout } from "@/components/telefam/AuthLayout";
import { FieldShell, fieldInputClass } from "@/components/telefam/Field";
import { GoogleIcon } from "@/components/telefam/Decor";
import { Button } from "@/components/ui/button";
import { fieldErrors, loginSchema, signupSchema } from "@/lib/validation";
import {
  clearFailures,
  getLockRemaining,
  isRateLimitError,
  recordFailure,
} from "@/lib/auth-throttle";
import { setRememberMe } from "@/lib/remember-me";
import { nextPathForUser } from "@/lib/my-profile";
import { cn } from "@/lib/utils";

type Search = { mode?: "signup" };
type Errs = Partial<Record<"email" | "password" | "confirmPassword" | "form", string>>;

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>): Search =>
    s["mode"] === "signup" ? { mode: "signup" } : {},
  head: () => ({
    meta: [
      { title: "Sign in — Telefam" },
      { name: "description", content: "Sign in or create your Telefam account to keep reading and sharing." },
      { property: "og:title", content: "Sign in — Telefam" },
      { property: "og:description", content: "Sign in or create your Telefam account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function formatWait(ms: number) {
  const s = Math.ceil(ms / 1000);
  return s >= 60 ? `${Math.ceil(s / 60)} min` : `${s}s`;
}

function AuthPage() {
  const { mode } = Route.useSearch();
  const isSignup = mode === "signup";
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(true);
  const [errors, setErrors] = useState<Errs>({});
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [lockMs, setLockMs] = useState(0);

  useEffect(() => {
    setErrors({});
    setSentTo(null);
  }, [mode]);

  // Tick the cooldown countdown.
  useEffect(() => {
    setLockMs(getLockRemaining());
    const id = setInterval(() => setLockMs(getLockRemaining()), 1000);
    return () => clearInterval(id);
  }, []);

  async function goNext() {
    const to = await nextPathForUser();
    navigate({ to, replace: true });
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;

    if (isSignup) {
      const parsed = signupSchema.safeParse({ email, password, confirmPassword: confirm });
      if (!parsed.success) return setErrors(fieldErrors<keyof Errs>(parsed.error));
      setErrors({});
      setBusy(true);
      const { data, error } = await supabase.auth.signUp({
        email: parsed.data.email,
        password: parsed.data.password,
        options: { emailRedirectTo: window.location.origin },
      });
      setBusy(false);
      if (error) {
        if (isRateLimitError(error)) {
          return setErrors({ form: "Too many attempts. Please wait a few minutes and try again." });
        }
        return setErrors({ form: error.message });
      }
      if (data.session) {
        setRememberMe(true);
        return goNext();
      }
      setSentTo(parsed.data.email);
      return;
    }

    const wait = getLockRemaining();
    if (wait > 0) {
      setLockMs(wait);
      return;
    }
    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) return setErrors(fieldErrors<keyof Errs>(parsed.error));
    setErrors({});
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword(parsed.data);
    setBusy(false);
    if (error) {
      if (isRateLimitError(error)) {
        return setErrors({ form: "Too many sign-in attempts. Please wait a few minutes." });
      }
      const lock = recordFailure();
      setLockMs(lock);
      const msg = /confirm/i.test(error.message)
        ? "Please confirm your email first — check your inbox."
        : "Incorrect email or password";
      return setErrors({ form: msg });
    }
    clearFailures();
    setRememberMe(remember);
    await goNext();
  }

  async function onGoogle() {
    setGoogleBusy(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setGoogleBusy(false);
      toast.error("Google sign-in failed. Please try again.");
      return;
    }
    if (result.redirected) return;
    setRememberMe(true);
    await goNext();
  }

  if (sentTo) {
    return (
      <AuthLayout>
        <div className="animate-fade-up text-center">
          <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-accent text-primary">
            <MailCheck className="size-8" />
          </div>
          <h1 className="mt-5 text-3xl font-extrabold">Check your email</h1>
          <p className="mt-3 text-muted-foreground">
            We sent a confirmation link to <span className="font-semibold text-foreground">{sentTo}</span>.
            Open it to activate your account.
          </p>
          <Button asChild variant="brand" size="xl" className="mt-8">
            <Link to="/auth">Back to Sign In</Link>
          </Button>
        </div>
      </AuthLayout>
    );
  }

  const locked = !isSignup && lockMs > 0;

  return (
    <AuthLayout>
      <div className="animate-fade-up text-center">
        <h1 className="text-[2rem] font-extrabold tracking-tight">
          {isSignup ? "Create Account" : "Welcome Back!"}
        </h1>
        <p className="mt-1 text-lg font-medium text-muted-foreground">
          {isSignup ? "Join the Telefam reading community" : "Sign in to continue reading"}
        </p>
      </div>

      <form onSubmit={onSubmit} noValidate className="mt-7 space-y-4">
        <FieldShell icon={<Mail className="text-primary" />} error={errors.email}>
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="Email Address"
            aria-label="Email Address"
            maxLength={254}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={cn(fieldInputClass, "text-lg")}
          />
        </FieldShell>

        <FieldShell
          icon={<Lock />}
          error={errors.password}
          trailing={
            <button
              type="button"
              onClick={() => setShowPw((v) => !v)}
              className="text-foreground/70 hover:text-foreground"
              aria-label={showPw ? "Hide password" : "Show password"}
            >
              {showPw ? <Eye className="size-6" /> : <EyeOff className="size-6" />}
            </button>
          }
        >
          <input
            type={showPw ? "text" : "password"}
            autoComplete={isSignup ? "new-password" : "current-password"}
            placeholder="Password"
            aria-label="Password"
            maxLength={72}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={cn(fieldInputClass, "text-lg")}
          />
        </FieldShell>

        {isSignup && (
          <>
            <FieldShell icon={<Lock />} error={errors.confirmPassword}>
              <input
                type={showPw ? "text" : "password"}
                autoComplete="new-password"
                placeholder="Confirm Password"
                aria-label="Confirm Password"
                maxLength={72}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className={cn(fieldInputClass, "text-lg")}
              />
            </FieldShell>
            <p className="px-2 text-xs text-muted-foreground">
              At least 8 characters, including a letter and a number.
            </p>
          </>
        )}

        {!isSignup && (
          <div className="flex items-center justify-between px-1">
            <label className="flex cursor-pointer items-center gap-2.5 text-sm font-semibold">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="size-5 cursor-pointer rounded accent-primary"
              />
              Remember me
            </label>
            <Link to="/forgot-password" className="text-sm font-semibold text-primary hover:underline">
              Forgot Password?
            </Link>
          </div>
        )}

        {errors.form && (
          <p role="alert" className="rounded-xl bg-accent px-4 py-2.5 text-center text-sm font-medium text-accent-foreground">
            {errors.form}
          </p>
        )}
        {locked && (
          <p role="status" className="text-center text-sm font-medium text-muted-foreground">
            Too many failed attempts. Try again in {formatWait(lockMs)}.
          </p>
        )}

        <Button type="submit" variant="brand" size="xl" disabled={busy || locked}>
          {busy ? "Please wait…" : isSignup ? "Sign Up" : "Sign In"}
        </Button>
      </form>

      <div className="my-6 flex items-center gap-4">
        <span className="h-px flex-1 bg-border" />
        <span className="text-sm font-semibold text-foreground/70">or continue with</span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <Button type="button" variant="outline-pill" size="xl" onClick={onGoogle} disabled={googleBusy}>
        <GoogleIcon className="!size-7" />
        {googleBusy ? "Connecting…" : "Continue with Google"}
      </Button>

      <p className="mt-6 text-center font-semibold text-muted-foreground">
        {isSignup ? "Already have an account? " : "Don't have an account? "}
        <Link
          to="/auth"
          search={isSignup ? {} : { mode: "signup" }}
          className="font-bold text-primary hover:underline"
        >
          {isSignup ? "Sign In" : "Sign Up"}
        </Link>
      </p>
    </AuthLayout>
  );
}

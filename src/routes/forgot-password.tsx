import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { ArrowLeft, Mail, MailCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AuthLayout } from "@/components/telefam/AuthLayout";
import { FieldShell, fieldInputClass } from "@/components/telefam/Field";
import { Button } from "@/components/ui/button";
import { emailSchema } from "@/lib/validation";
import { isRateLimitError } from "@/lib/auth-throttle";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "Forgot password — Telefam" },
      { name: "description", content: "Reset your Telefam password with a secure email link." },
      { property: "og:title", content: "Forgot password — Telefam" },
      { property: "og:description", content: "Reset your Telefam password with a secure email link." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ForgotPassword,
});

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? "Enter a valid email address");
    setError(null);
    setBusy(true);
    const { error: err } = await supabase.auth.resetPasswordForEmail(parsed.data, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(false);
    if (err && isRateLimitError(err)) {
      return setError("Too many requests. Please wait a few minutes and try again.");
    }
    // Always show the same message so emails can't be probed.
    setSent(true);
  }

  return (
    <AuthLayout>
      {sent ? (
        <div className="animate-fade-up text-center">
          <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-accent text-primary">
            <MailCheck className="size-8" />
          </div>
          <h1 className="mt-5 text-3xl font-extrabold">Check your inbox</h1>
          <p className="mt-3 text-muted-foreground">
            If an account exists for that email, a password reset link is on its way.
          </p>
          <Button asChild variant="brand" size="xl" className="mt-8">
            <Link to="/auth">Back to Sign In</Link>
          </Button>
        </div>
      ) : (
        <>
          <div className="animate-fade-up text-center">
            <h1 className="text-[2rem] font-extrabold tracking-tight">Forgot Password?</h1>
            <p className="mt-1 text-lg font-medium text-muted-foreground">
              Enter your email and we'll send a reset link
            </p>
          </div>
          <form onSubmit={onSubmit} noValidate className="mt-7 space-y-4">
            <FieldShell icon={<Mail className="text-primary" />} error={error ?? undefined}>
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
            <Button type="submit" variant="brand" size="xl" disabled={busy}>
              {busy ? "Sending…" : "Send Reset Link"}
            </Button>
          </form>
          <Link
            to="/auth"
            className="mt-6 flex items-center justify-center gap-2 font-semibold text-primary hover:underline"
          >
            <ArrowLeft className="size-4" /> Back to Sign In
          </Link>
        </>
      )}
    </AuthLayout>
  );
}

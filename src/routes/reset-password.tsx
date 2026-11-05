import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Lock } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AuthLayout } from "@/components/telefam/AuthLayout";
import { FieldShell, fieldInputClass } from "@/components/telefam/Field";
import { Button } from "@/components/ui/button";
import { fieldErrors, resetPasswordSchema } from "@/lib/validation";
import { nextPathForUser } from "@/lib/my-profile";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Set a new password — Telefam" },
      { name: "description", content: "Choose a new password for your Telefam account." },
      { property: "og:title", content: "Set a new password — Telefam" },
      { property: "og:description", content: "Choose a new password for your Telefam account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ResetPassword,
});

type Errs = Partial<Record<"password" | "confirmPassword" | "form", string>>;

function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<Errs>({});
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const isRecovery = window.location.hash.includes("type=recovery");
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });
    supabase.auth.getSession().then(({ data: s }) => {
      if (s.session || isRecovery) setReady(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const parsed = resetPasswordSchema.safeParse({ password, confirmPassword: confirm });
    if (!parsed.success) return setErrors(fieldErrors<keyof Errs>(parsed.error));
    setErrors({});
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
    setBusy(false);
    if (error) return setErrors({ form: error.message });
    toast.success("Password updated");
    navigate({ to: await nextPathForUser(), replace: true });
  }

  return (
    <AuthLayout>
      <div className="animate-fade-up text-center">
        <h1 className="text-[2rem] font-extrabold tracking-tight">New Password</h1>
        <p className="mt-1 text-lg font-medium text-muted-foreground">
          {ready ? "Choose a strong new password" : "Open this page from your reset email link"}
        </p>
      </div>
      <form onSubmit={onSubmit} noValidate className="mt-7 space-y-4">
        <FieldShell icon={<Lock />} error={errors.password}>
          <input
            type="password"
            autoComplete="new-password"
            placeholder="New Password"
            aria-label="New Password"
            maxLength={72}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={cn(fieldInputClass, "text-lg")}
          />
        </FieldShell>
        <FieldShell icon={<Lock />} error={errors.confirmPassword}>
          <input
            type="password"
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
        {errors.form && (
          <p role="alert" className="rounded-xl bg-accent px-4 py-2.5 text-center text-sm font-medium text-accent-foreground">
            {errors.form}
          </p>
        )}
        <Button type="submit" variant="brand" size="xl" disabled={busy || !ready}>
          {busy ? "Saving…" : "Update Password"}
        </Button>
      </form>
    </AuthLayout>
  );
}

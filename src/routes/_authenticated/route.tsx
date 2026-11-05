import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { isNetworkError } from "@/lib/offline";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (data.user) return { user: data.user };
    // Offline the auth service can't be reached: keep using the session saved on
    // this device instead of signing the reader out. Server calls still verify it.
    if (error && isNetworkError(error)) {
      const { data: saved } = await supabase.auth.getSession();
      if (saved.session?.user) return { user: saved.session.user };
    }
    throw redirect({ to: "/auth" });
  },
  component: () => <Outlet />,
});

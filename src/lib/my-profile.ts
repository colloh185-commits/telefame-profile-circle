import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type MyProfile = {
  email: string | null;
  fullName: string;
  username: string;
  country: string;
  location: string;
  bio: string;
  avatarUrl: string | null;
  avatarPath: string | null;
  onboarded: boolean;
};

export async function fetchMyProfile(): Promise<MyProfile | null> {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("full_name, username, country, location, bio, avatar_path, onboarded")
    .eq("id", user.id)
    .maybeSingle();
  if (error) throw error;

  let avatarUrl: string | null = null;
  if (data?.avatar_path) {
    const signed = await supabase.storage.from("avatars").createSignedUrl(data.avatar_path, 3600);
    avatarUrl = signed.data?.signedUrl ?? null;
  }

  const meta = user.user_metadata as { full_name?: string; name?: string } | undefined;
  return {
    email: user.email ?? null,
    fullName: data?.full_name ?? meta?.full_name ?? meta?.name ?? "",
    username: data?.username ?? "",
    country: data?.country ?? "",
    location: data?.location ?? "",
    bio: data?.bio ?? "",
    avatarUrl,
    avatarPath: data?.avatar_path ?? null,
    onboarded: data?.onboarded ?? false,
  };
}

export const myProfileQuery = () =>
  queryOptions({ queryKey: ["my-profile"], queryFn: fetchMyProfile, staleTime: 30_000 });

/** Where a signed-in user should land next. */
export async function nextPathForUser(): Promise<"/auth" | "/profile-setup" | "/home"> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) return "/auth";
  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarded")
    .eq("id", data.user.id)
    .maybeSingle();
  return profile?.onboarded ? "/home" : "/profile-setup";
}

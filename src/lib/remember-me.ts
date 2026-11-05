import { supabase } from "@/integrations/supabase/client";

const REMEMBER_KEY = "telefam:remember";
const ALIVE_KEY = "telefam:tab-alive";

/** Call right after a successful sign-in. */
export function setRememberMe(remember: boolean) {
  window.localStorage.setItem(REMEMBER_KEY, remember ? "1" : "0");
  window.sessionStorage.setItem(ALIVE_KEY, "1");
}

/** Signs out sessions that weren't "remembered" once the browser was closed. */
export async function enforceRememberMe() {
  if (typeof window === "undefined") return;
  const remember = window.localStorage.getItem(REMEMBER_KEY);
  const alive = window.sessionStorage.getItem(ALIVE_KEY);
  if (remember === "0" && !alive) {
    window.localStorage.removeItem(REMEMBER_KEY);
    await supabase.auth.signOut();
  }
  window.sessionStorage.setItem(ALIVE_KEY, "1");
}

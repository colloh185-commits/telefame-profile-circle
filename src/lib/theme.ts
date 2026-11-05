import { useSyncExternalStore } from "react";

export type ThemePref = "light" | "dark" | "system";
const KEY = "telefam:theme";
const COLORS = { light: "#d7141f", dark: "#14161c" } as const;

/** Runs before paint (inlined in <head>) so the page never flashes the wrong theme. */
export const themeInitScript = `(function(){try{var p=localStorage.getItem('${KEY}')||'system';var d=p==='dark'||(p==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);var r=document.documentElement;r.classList.toggle('dark',d);r.style.colorScheme=d?'dark':'light';}catch(e){}})();`;

const listeners = new Set<() => void>();

function readPref(): ThemePref {
  if (typeof window === "undefined") return "system";
  const v = window.localStorage.getItem(KEY);
  return v === "light" || v === "dark" ? v : "system";
}

function systemDark() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function resolveTheme(pref: ThemePref): "light" | "dark" {
  return pref === "dark" || (pref === "system" && systemDark()) ? "dark" : "light";
}

function apply() {
  const resolved = resolveTheme(readPref());
  const root = document.documentElement;
  root.classList.toggle("dark", resolved === "dark");
  root.style.colorScheme = resolved;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", COLORS[resolved]);
}

export function setTheme(pref: ThemePref) {
  if (pref === "system") window.localStorage.removeItem(KEY);
  else window.localStorage.setItem(KEY, pref);
  apply();
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const onSystem = () => {
    apply();
    cb();
  };
  mq.addEventListener("change", onSystem);
  return () => {
    listeners.delete(cb);
    mq.removeEventListener("change", onSystem);
  };
}

export function useTheme() {
  const pref = useSyncExternalStore(subscribe, readPref, () => "system" as ThemePref);
  const resolved = typeof window === "undefined" ? "light" : resolveTheme(pref);
  return {
    pref,
    resolved,
    setTheme,
    toggle: () => setTheme(resolved === "dark" ? "light" : "dark"),
  };
}

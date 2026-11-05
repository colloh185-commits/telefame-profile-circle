/**
 * Device-side sign-in cooldown. Complements the backend's built-in auth rate
 * limits by slowing down repeated failed attempts from this browser.
 */
export const FREE_ATTEMPTS = 5;
export const WINDOW_MS = 15 * 60 * 1000;
export const BASE_LOCK_MS = 30 * 1000;
export const MAX_LOCK_MS = 15 * 60 * 1000;

const KEY = "telefam:auth-failures";

export function recentFailures(failures: number[], now: number): number[] {
  return failures.filter((t) => now - t < WINDOW_MS).sort((a, b) => a - b);
}

/** ms the user must still wait; 0 when sign-in is allowed. */
export function lockRemainingMs(failures: number[], now: number): number {
  const recent = recentFailures(failures, now);
  if (recent.length < FREE_ATTEMPTS) return 0;
  const extra = recent.length - FREE_ATTEMPTS;
  const lock = Math.min(BASE_LOCK_MS * 2 ** extra, MAX_LOCK_MS);
  const until = (recent[recent.length - 1] ?? now) + lock;
  return Math.max(0, until - now);
}

function read(): number[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((n) => typeof n === "number") : [];
  } catch {
    return [];
  }
}

export function getLockRemaining(): number {
  return lockRemainingMs(read(), Date.now());
}

export function recordFailure(): number {
  const now = Date.now();
  const next = [...recentFailures(read(), now), now].slice(-20);
  window.localStorage.setItem(KEY, JSON.stringify(next));
  return lockRemainingMs(next, now);
}

export function clearFailures() {
  if (typeof window !== "undefined") window.localStorage.removeItem(KEY);
}

export function isRateLimitError(err: { status?: number | undefined; code?: string | undefined; message?: string | undefined } | null) {
  if (!err) return false;
  return (
    err.status === 429 ||
    err.code === "over_request_rate_limit" ||
    err.code === "over_email_send_rate_limit" ||
    /rate limit|too many/i.test(err.message ?? "")
  );
}

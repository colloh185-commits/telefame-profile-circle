import { onlineManager } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";

/** True while the device reports a connection (shared with TanStack Query). */
export function useOnline(): boolean {
  return useSyncExternalStore(
    (cb) => onlineManager.subscribe(cb),
    () => onlineManager.isOnline(),
    () => true,
  );
}

const NETWORK_PATTERNS = [
  /failed to fetch/i,
  /networkerror/i,
  /network request failed/i,
  /load failed/i,
  /fetch failed/i,
  /network error/i,
  /internet connection/i,
  /err_internet_disconnected/i,
  /err_network/i,
];

/** Recognises "no connection" failures from fetch / the backend client. */
export function isNetworkError(err: unknown): boolean {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  if (!err) return false;
  if (err instanceof AppError) return err.kind === "network";
  const msg =
    typeof err === "string"
      ? err
      : typeof err === "object" && err !== null && "message" in err
        ? String((err as { message: unknown }).message)
        : "";
  return NETWORK_PATTERNS.some((re) => re.test(msg));
}

/** Error type the UI can show safely: never carries raw server text. */
export class AppError extends Error {
  constructor(
    public kind: "network" | "server",
    message: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function toAppError(err: unknown): AppError {
  if (err instanceof AppError) return err;
  if (isNetworkError(err)) return new AppError("network", "No internet connection");
  return new AppError("server", "Something went wrong. Please try again.");
}

/** Retry server hiccups once, connection drops a couple of times, nothing else. */
export function shouldRetry(failureCount: number, err: unknown): boolean {
  return isNetworkError(err) ? failureCount < 2 : failureCount < 1;
}

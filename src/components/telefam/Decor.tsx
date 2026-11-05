import { cn } from "@/lib/utils";

export function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

/** Thin outline book used as faint background decoration. */
export function BookDoodle({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 48" className={cn("pointer-events-none", className)} aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round">
        <path d="M32 10 C 24 5, 12 5, 4 8 L4 40 C 12 37, 24 37, 32 42 C 40 37, 52 37, 60 40 L60 8 C 52 5, 40 5, 32 10 Z" />
        <path d="M32 10 L32 42" />
        <path d="M10 15 L26 15 M10 21 L26 21 M10 27 L22 27" />
        <path d="M38 15 L54 15 M38 21 L54 21 M38 27 L50 27" />
      </g>
    </svg>
  );
}

/** Red base with an open-book silhouette, used at the bottom of the login screen. */
export function BookBase({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 400 110" preserveAspectRatio="none" className={cn("pointer-events-none w-full", className)} aria-hidden="true">
      <path d="M0 50 C 120 10, 280 10, 400 50 L400 110 L0 110 Z" className="fill-primary-soft" />
      <path d="M0 78 C 120 52, 280 52, 400 78 L400 110 L0 110 Z" className="fill-primary" />
      <g fill="none" className="stroke-primary" strokeOpacity="0.35" strokeWidth="1.6">
        <path d="M200 80 C 170 52, 120 46, 70 56" />
        <path d="M200 80 C 230 52, 280 46, 330 56" />
        <path d="M200 76 C 172 56, 128 50, 86 58" />
        <path d="M200 76 C 228 56, 272 50, 314 58" />
        <path d="M200 72 C 176 58, 140 54, 104 60" />
        <path d="M200 72 C 224 58, 260 54, 296 60" />
      </g>
    </svg>
  );
}

/** Soft double wave used at the bottom of the profile screen. */
export function WaveBase({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 400 80" preserveAspectRatio="none" className={cn("pointer-events-none w-full", className)} aria-hidden="true">
      <path d="M0 30 C 80 0, 160 10, 220 34 C 290 60, 350 40, 400 22 L400 80 L0 80 Z" className="fill-primary-soft" />
      <path d="M0 50 C 90 28, 170 40, 230 56 C 300 72, 360 56, 400 44 L400 80 L0 80 Z" className="fill-primary" />
    </svg>
  );
}

export function LoadingDots({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2", className)} aria-label="Loading">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="size-2.5 rounded-full bg-current animate-loader-dot"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </div>
  );
}

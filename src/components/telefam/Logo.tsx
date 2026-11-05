import { cn } from "@/lib/utils";

/** Telefam mark: a paper plane taking flight from an open book, in a white ring. */
export function LogoMark({ className, animated = false }: { className?: string; animated?: boolean }) {
  return (
    <svg
      viewBox="0 0 120 120"
      className={cn("text-primary-foreground", className)}
      role="img"
      aria-label="Telefam logo"
    >
      <circle cx="60" cy="60" r="56" fill="none" stroke="currentColor" strokeWidth="3.5" />
      <g className={animated ? "animate-plane-float" : undefined}>
        {/* trail */}
        <path
          d="M54 84 C 50 76, 52 72, 56 68"
          fill="none"
          stroke="currentColor"
          strokeOpacity="0.55"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray="2 4"
        />
        {/* plane — top wing */}
        <path d="M24 52 L94 20 L56 62 Z" fill="currentColor" />
        {/* plane — lower body */}
        <path d="M56 62 L94 20 L72 82 Z" fill="currentColor" fillOpacity="0.82" />
        {/* plane — fold */}
        <path d="M56 62 L63 75 L51 68 Z" fill="currentColor" fillOpacity="0.55" />
        <path d="M56 62 L94 20 L61 67 Z" fill="currentColor" fillOpacity="0.35" />
      </g>
      {/* open book */}
      <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <path d="M60 96 C 50 88, 36 86, 22 89 L22 83 C 36 80, 50 82, 60 90" strokeWidth="3" />
        <path d="M60 96 C 70 88, 84 86, 98 89 L98 83 C 84 80, 70 82, 60 90" strokeWidth="3" />
        <path d="M27 82 C 38 78, 50 79, 59 86" strokeWidth="1.6" strokeOpacity="0.75" />
        <path d="M93 82 C 82 78, 70 79, 61 86" strokeWidth="1.6" strokeOpacity="0.75" />
        <path d="M32 79 C 41 76, 51 77, 58 82" strokeWidth="1.2" strokeOpacity="0.55" />
        <path d="M88 79 C 79 76, 69 77, 62 82" strokeWidth="1.2" strokeOpacity="0.55" />
        <path d="M60 90 L60 97" strokeWidth="2.2" />
      </g>
    </svg>
  );
}

export function Wordmark({ className, taglineClassName }: { className?: string; taglineClassName?: string }) {
  return (
    <div className={cn("text-primary-foreground", className)}>
      <div className="font-extrabold leading-none tracking-tight">Telefam</div>
      <div className={cn("mt-1.5 font-semibold opacity-90", taglineClassName)}>
        Read • Discover • Share
      </div>
    </div>
  );
}

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Rounded input shell with a leading icon, optional floating label and trailing slot. */
export function FieldShell({
  icon,
  label,
  htmlFor,
  trailing,
  error,
  children,
  className,
}: {
  icon: ReactNode;
  label?: string | undefined;
  htmlFor?: string | undefined;
  trailing?: ReactNode | undefined;
  error?: string | undefined;
  children: ReactNode;
  className?: string | undefined;
}) {
  return (
    <div className={className}>
      <div
        className={cn(
          "flex items-center gap-4 rounded-2xl border bg-card px-4 transition-colors",
          "focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15",
          label ? "min-h-16 py-2.5" : "h-14",
          error && "border-destructive",
        )}
      >
        <span className="flex size-7 shrink-0 items-center justify-center text-foreground/80 [&_svg]:size-6">
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          {label && (
            <label htmlFor={htmlFor} className="block text-xs font-medium text-muted-foreground">
              {label}
            </label>
          )}
          {children}
        </div>
        {trailing && <span className="flex shrink-0 items-center">{trailing}</span>}
      </div>
      {error && <p className="mt-1.5 px-2 text-xs font-medium text-destructive">{error}</p>}
    </div>
  );
}

export const fieldInputClass =
  "w-full bg-transparent text-base text-foreground placeholder:text-muted-foreground focus:outline-none";

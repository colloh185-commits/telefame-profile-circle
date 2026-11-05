import { MessageSquarePlus, MessagesSquare, Search, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { comingSoon } from "@/lib/coming-soon";
import { cn } from "@/lib/utils";
import { useCachedImage } from "@/lib/image-cache";
import { useEffect, useState } from "react";

export function SearchPill({ className }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={() => comingSoon("Search")}
      className={cn(
        "flex h-9 w-full min-w-0 flex-1 items-center gap-2.5 rounded-full bg-background px-3.5 text-left text-muted-foreground shadow-soft transition-colors hover:bg-card",
        className,
      )}
    >
      <Search className="size-4 shrink-0" />
      <span className="truncate text-sm">Search chats, people, groups</span>
    </button>
  );
}

export function EmptyConversation({ size = "md" }: { size?: "md" | "lg" }) {
  const lg = size === "lg";
  return (
    <div className="flex animate-fade-up flex-col items-center px-6 text-center">
      <div
        className={cn(
          "flex items-center justify-center rounded-full bg-primary-soft text-primary",
          lg ? "size-24" : "size-[4.5rem]",
        )}
      >
        <MessagesSquare className={lg ? "size-11" : "size-8"} strokeWidth={1.8} />
      </div>
      <h2 className={cn("mt-5 font-extrabold tracking-tight", lg ? "text-2xl" : "text-lg")}>
        Start a conversation
      </h2>
      <p className={cn("mt-1.5 max-w-[16rem] text-sm text-muted-foreground", lg && "max-w-xs text-base")}>
        Tap the button below to chat with your friends, family or groups
      </p>
      <Button
        variant="brand"
        onClick={() => comingSoon("Start chat")}
        className={cn("mt-5 h-10 px-5 text-sm", lg && "h-11 px-7 text-base")}
      >
        <MessageSquarePlus className="!size-4" /> Start chat
      </Button>
    </div>
  );
}

function initials(name: string | undefined) {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  return parts
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

/**
 * Profile photo. When `path` is given the image is cached on the device, so it
 * still shows offline; otherwise falls back to initials / a person icon.
 */
export function Avatar({
  url,
  path,
  name,
  className,
}: {
  url: string | null | undefined;
  path?: string | null | undefined;
  name?: string | undefined;
  className?: string;
}) {
  const cached = useCachedImage(path, url);
  const [broken, setBroken] = useState(false);
  const src = path ? cached : url;
  const letters = initials(name);

  useEffect(() => setBroken(false), [src]);

  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted",
        !src && letters && "bg-primary-soft text-primary",
        className,
      )}
    >
      {src && !broken ? (
        <img
          src={src}
          alt={name ?? "Profile"}
          loading="lazy"
          decoding="async"
          onError={() => setBroken(true)}
          className="size-full object-cover"
        />
      ) : letters ? (
        <span className="text-[0.8em] font-bold leading-none">{letters}</span>
      ) : (
        <User className="size-1/2 text-muted-foreground" />
      )}
    </span>
  );
}

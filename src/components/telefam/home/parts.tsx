import { MessageSquarePlus, MessagesSquare, Search, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { comingSoon } from "@/lib/coming-soon";
import { cn } from "@/lib/utils";

export function SearchPill({ className }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={() => comingSoon("Search")}
      className={cn(
        "flex h-11 w-full min-w-0 flex-1 items-center gap-3 rounded-full bg-background px-4 text-left text-muted-foreground shadow-soft transition-colors hover:bg-card",
        className,
      )}
    >
      <Search className="size-5 shrink-0" />
      <span className="truncate text-[0.95rem]">Search chats, people, groups</span>
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
          lg ? "size-32" : "size-24",
        )}
      >
        <MessagesSquare className={lg ? "size-14" : "size-11"} strokeWidth={1.8} />
      </div>
      <h2 className={cn("mt-6 font-extrabold tracking-tight", lg ? "text-3xl" : "text-2xl")}>
        Start a conversation
      </h2>
      <p className={cn("mt-2 max-w-xs text-muted-foreground", lg && "max-w-sm text-lg")}>
        Tap the button below to chat with your friends, family or groups
      </p>
      <Button
        variant="brand"
        onClick={() => comingSoon("Start chat")}
        className={cn("mt-6 h-12 px-7 text-base", lg && "h-14 px-9 text-lg")}
      >
        <MessageSquarePlus className="!size-5" /> Start chat
      </Button>
    </div>
  );
}

export function Avatar({
  url,
  name,
  className,
}: {
  url: string | null | undefined;
  name?: string | undefined;
  className?: string;
}) {
  return (
    <span className={cn("flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted", className)}>
      {url ? (
        <img src={url} alt={name ?? "Profile"} className="size-full object-cover" />
      ) : (
        <User className="size-1/2 text-muted-foreground" />
      )}
    </span>
  );
}

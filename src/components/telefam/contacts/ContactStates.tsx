import type { ComponentType } from "react";
import { RefreshCw, SearchX, UserPlus, Users, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ContactTab } from "@/lib/contacts";
import { cn } from "@/lib/utils";

function StateBox({
  icon: Icon,
  title,
  body,
  action,
  tone = "brand",
}: {
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  title: string;
  body: string;
  action?: React.ReactNode;
  tone?: "brand" | "muted";
}) {
  return (
    <div className="flex animate-fade-up flex-col items-center px-8 py-14 text-center">
      <div
        className={cn(
          "flex size-16 items-center justify-center rounded-full",
          tone === "brand" ? "bg-primary-soft text-primary" : "bg-muted text-muted-foreground",
        )}
      >
        <Icon className="size-7" strokeWidth={1.8} />
      </div>
      <h2 className="mt-4 text-base font-extrabold tracking-tight">{title}</h2>
      <p className="mt-1 max-w-[17rem] text-sm text-muted-foreground">{body}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function NoInternet({ onRetry, canRetry }: { onRetry: () => void; canRetry: boolean }) {
  return (
    <StateBox
      icon={WifiOff}
      tone="muted"
      title="No internet connection"
      body="Check your Wi‑Fi or mobile data. Contacts you've already seen will appear here when saved."
      action={
        <Button variant="brand" onClick={onRetry} disabled={!canRetry} className="h-10 px-5 text-sm">
          <RefreshCw className="!size-4" /> Try again
        </Button>
      }
    />
  );
}

export function LoadFailed({ onRetry }: { onRetry: () => void }) {
  return (
    <StateBox
      icon={RefreshCw}
      title="Couldn't load contacts"
      body="Something went wrong on our side. Please try again in a moment."
      action={
        <Button variant="brand" onClick={onRetry} className="h-10 px-5 text-sm">
          <RefreshCw className="!size-4" /> Try again
        </Button>
      }
    />
  );
}

const EMPTY: Record<ContactTab, { title: string; body: string }> = {
  all: { title: "No readers yet", body: "When people join Telefam they'll show up here." },
  suggestions: { title: "You're all caught up", body: "You already follow everyone we can suggest right now." },
  followers: { title: "No followers yet", body: "When someone follows you, they'll appear here." },
  following: { title: "Not following anyone", body: "Follow readers from Suggestions to see them here." },
  friends: { title: "No friends yet", body: "Friends are people who follow you back. Follow someone to get started." },
};

export function EmptyContacts({ tab, search }: { tab: ContactTab; search: string }) {
  if (search) {
    return (
      <StateBox
        icon={SearchX}
        tone="muted"
        title="No matches"
        body={`Nobody here matches "${search}". Try a different name or username.`}
      />
    );
  }
  const copy = EMPTY[tab];
  return <StateBox icon={tab === "suggestions" ? UserPlus : Users} title={copy.title} body={copy.body} />;
}

export function ContactSkeleton() {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 md:rounded-2xl md:border md:bg-card md:p-3.5">
      <div className="size-11 shrink-0 animate-pulse rounded-full bg-muted" />
      <div className="flex-1 space-y-2">
        <div className="h-3 w-2/5 animate-pulse rounded-full bg-muted" />
        <div className="h-2.5 w-1/4 animate-pulse rounded-full bg-muted" />
      </div>
      <div className="h-8 w-[5.75rem] animate-pulse rounded-full bg-muted" />
    </div>
  );
}

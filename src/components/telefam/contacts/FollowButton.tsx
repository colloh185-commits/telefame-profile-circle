import { useState } from "react";
import { Check, UserCheck, UserPlus } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { followState, useFollowToggle, type Contact } from "@/lib/contacts";
import { useOnline } from "@/lib/offline";
import { cn } from "@/lib/utils";

const LABEL = {
  follow: "Follow",
  follow_back: "Follow back",
  following: "Following",
  friends: "Friends",
} as const;

export function FollowButton({ contact, className }: { contact: Contact; className?: string }) {
  const online = useOnline();
  const toggle = useFollowToggle();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const state = followState(contact.iFollow, contact.followsMe);
  const isFollowing = state === "following" || state === "friends";

  function run(follow: boolean) {
    if (!online) {
      toast.error("No internet connection", {
        id: "follow-offline",
        description: "Connect to the internet to follow or unfollow.",
      });
      return;
    }
    toggle.mutate({ userId: contact.id, follow });
  }

  const Icon = state === "friends" ? UserCheck : isFollowing ? Check : UserPlus;

  return (
    <>
      <button
        type="button"
        disabled={toggle.isPending}
        aria-pressed={isFollowing}
        aria-label={`${LABEL[state]} ${contact.fullName}`}
        onClick={() => (isFollowing ? setConfirmOpen(true) : run(true))}
        className={cn(
          "inline-flex h-8 min-w-[5.75rem] shrink-0 items-center justify-center gap-1 rounded-full px-3 text-xs font-bold transition-all active:scale-95 disabled:opacity-70",
          state === "follow" || state === "follow_back"
            ? "bg-primary text-primary-foreground shadow-brand hover:bg-primary-deep"
            : state === "friends"
              ? "bg-primary-soft text-primary hover:bg-primary-soft/70"
              : "border border-border bg-background text-foreground hover:bg-muted",
          className,
        )}
      >
        <Icon className="size-3.5" strokeWidth={2.5} />
        {LABEL[state]}
      </button>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="max-w-sm rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Unfollow {contact.fullName}?</AlertDialogTitle>
            <AlertDialogDescription>
              {state === "friends"
                ? "You'll stop being friends, but they'll still follow you."
                : "Their updates will no longer show up for you."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => run(false)}
            >
              Unfollow
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

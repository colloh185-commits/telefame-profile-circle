import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Hash, Loader2, Plus, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { searchHashtags } from "@/lib/hashtags";
import { MAX_HASHTAGS, normalizeHashtag } from "@/lib/post-rules";
import { isNetworkError, useOnline } from "@/lib/offline";
import { cn } from "@/lib/utils";
import { PickerSheet, SheetMessage, SheetSearch } from "./PickerSheet";

export function HashtagSheet({
  open,
  onOpenChange,
  selected,
  onToggle,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  selected: string[];
  onToggle: (tag: string) => void;
}) {
  const [q, setQ] = useState("");
  const online = useOnline();
  const { data, isLoading, error } = useQuery({
    queryKey: ["hashtag-search", q],
    queryFn: () => searchHashtags(q),
    enabled: open,
    staleTime: 60_000,
  });
  const typed = normalizeHashtag(q);
  const full = selected.length >= MAX_HASHTAGS;
  const showAdd = !!typed && !data?.some((h) => h.tag === typed);

  const row = (tag: string, sub: string, isNew = false) => {
    const on = selected.includes(tag);
    return (
      <li key={`${isNew ? "new:" : ""}${tag}`}>
        <button
          type="button"
          disabled={!on && full}
          onClick={() => onToggle(tag)}
          aria-pressed={on}
          className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-muted/60 disabled:opacity-50"
        >
          <span className="flex size-9 items-center justify-center rounded-full bg-primary-soft text-primary">
            {isNew ? <Plus className="size-4" /> : <Hash className="size-4" />}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-bold">#{tag}</span>
            <span className="block text-xs text-muted-foreground">{sub}</span>
          </span>
          {on && <Check className={cn("size-4 text-primary")} strokeWidth={3} />}
        </button>
      </li>
    );
  };

  return (
    <PickerSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Hashtags"
      footer={
        <Button variant="brand" className="h-11 w-full" onClick={() => onOpenChange(false)}>
          Done{selected.length ? ` · ${selected.length}` : ""}
        </Button>
      }
    >
      <SheetSearch placeholder="Search hashtags" onSearch={setQ} maxLength={31} prefix="#" />
      <div className="min-h-0 flex-1 overflow-y-auto pb-2">
        {isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="size-5 animate-spin text-primary" />
          </div>
        ) : !data && (!online || isNetworkError(error)) ? (
          <SheetMessage icon={<WifiOff />} text="No internet connection" />
        ) : (
          <ul>
            {showAdd && row(typed!, "New hashtag", true)}
            {data?.map((h) => row(h.tag, `${h.postCount} ${h.postCount === 1 ? "post" : "posts"}`))}
            {!showAdd && !data?.length && <SheetMessage icon={<Hash />} text="Type a hashtag to add it" />}
          </ul>
        )}
      </div>
    </PickerSheet>
  );
}

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Loader2, UserPlus, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/telefam/home/parts";
import { fetchContactsPage, SEARCH_MAX, type Contact } from "@/lib/contacts";
import { MAX_PEOPLE_TAGS } from "@/lib/post-rules";
import { isNetworkError, useOnline } from "@/lib/offline";
import { cn } from "@/lib/utils";
import { PickerSheet, SheetMessage, SheetSearch } from "./PickerSheet";

export function PeopleSheet({
  open,
  onOpenChange,
  selected,
  onToggle,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  selected: Contact[];
  onToggle: (c: Contact) => void;
}) {
  const [q, setQ] = useState("");
  const online = useOnline();
  const { data, isLoading, error } = useQuery({
    queryKey: ["tag-people", q],
    queryFn: () => fetchContactsPage("all", q, 0),
    enabled: open,
    staleTime: 60_000,
  });
  const ids = new Set(selected.map((c) => c.id));
  const full = selected.length >= MAX_PEOPLE_TAGS;

  return (
    <PickerSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Tag people"
      footer={
        <Button variant="brand" className="h-11 w-full" onClick={() => onOpenChange(false)}>
          Done{selected.length ? ` · ${selected.length}` : ""}
        </Button>
      }
    >
      <SheetSearch placeholder="Search people" onSearch={setQ} maxLength={SEARCH_MAX} />
      <div className="min-h-0 flex-1 overflow-y-auto pb-2">
        {isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="size-5 animate-spin text-primary" />
          </div>
        ) : !data && (!online || isNetworkError(error)) ? (
          <SheetMessage icon={<WifiOff />} text="No internet connection" />
        ) : !data?.items.length ? (
          <SheetMessage icon={<UserPlus />} text={q ? `No one found for "${q}"` : "No people yet"} />
        ) : (
          <ul>
            {data.items.map((c) => {
              const on = ids.has(c.id);
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    disabled={!on && full}
                    onClick={() => onToggle(c)}
                    aria-pressed={on}
                    className="flex w-full items-center gap-3 px-4 py-2 text-left transition-colors hover:bg-muted/60 disabled:opacity-50"
                  >
                    <Avatar url={c.avatarUrl} path={c.avatarPath} name={c.fullName} className="size-10 text-xs" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold">{c.fullName}</span>
                      <span className="block truncate text-xs text-muted-foreground">@{c.username}</span>
                    </span>
                    <span
                      className={cn(
                        "flex size-6 items-center justify-center rounded-full border-2",
                        on ? "border-primary bg-primary text-primary-foreground" : "border-border",
                      )}
                    >
                      {on && <Check className="size-3.5" strokeWidth={3} />}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </PickerSheet>
  );
}

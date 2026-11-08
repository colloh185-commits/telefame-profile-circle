import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Loader2, Music, Pause, Play, WifiOff } from "lucide-react";
import { searchSongs } from "@/lib/posts.functions";
import { SONG_SEARCH_MAX, type Song } from "@/lib/post-rules";
import { toggleSong, usePlayingSong } from "@/lib/song-preview";
import { isNetworkError, toAppError, useOnline } from "@/lib/offline";
import { cn } from "@/lib/utils";
import { PickerSheet, SheetMessage, SheetSearch } from "./PickerSheet";

export function SongSheet({
  open,
  onOpenChange,
  selected,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  selected: Song | null;
  onSelect: (s: Song) => void;
}) {
  const [q, setQ] = useState("");
  const search = useServerFn(searchSongs);
  const online = useOnline();
  const { data, isFetching, error } = useQuery({
    queryKey: ["song-search", q],
    queryFn: async () => {
      try {
        return await search({ data: { q } });
      } catch (err) {
        throw toAppError(err);
      }
    },
    enabled: open && q.length > 0,
    staleTime: 5 * 60_000,
  });

  return (
    <PickerSheet open={open} onOpenChange={onOpenChange} title="Add a song">
      <SheetSearch placeholder="Search songs or artists" onSearch={setQ} maxLength={SONG_SEARCH_MAX} />
      <div className="min-h-0 flex-1 overflow-y-auto pb-4">
        {!q ? (
          <SheetMessage icon={<Music />} text="Search songs or artists" />
        ) : !online || isNetworkError(error) ? (
          <SheetMessage icon={<WifiOff />} text="No internet connection" />
        ) : isFetching && !data ? (
          <div className="flex justify-center py-10">
            <Loader2 className="size-5 animate-spin text-primary" />
          </div>
        ) : error || data?.error ? (
          <SheetMessage icon={<Music />} text="Songs are unavailable right now" />
        ) : !data?.items.length ? (
          <SheetMessage icon={<Music />} text={`No songs for "${q}"`} />
        ) : (
          <ul>
            {data.items.map((s) => (
              <SongRow
                key={s.id}
                song={s}
                selected={selected?.id === s.id}
                onSelect={() => {
                  onSelect(s);
                  onOpenChange(false);
                }}
              />
            ))}
          </ul>
        )}
      </div>
    </PickerSheet>
  );
}

function SongRow({ song, selected, onSelect }: { song: Song; selected: boolean; onSelect: () => void }) {
  return (
    <li className="flex items-center gap-3 px-4 py-2">
      <PlayToggle song={song} />
      <button type="button" onClick={onSelect} className="flex min-w-0 flex-1 items-center gap-2 text-left">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-bold">{song.title}</span>
          <span className="block truncate text-xs text-muted-foreground">{song.artist}</span>
        </span>
        {selected && <Check className="size-4 shrink-0 text-primary" strokeWidth={3} />}
      </button>
    </li>
  );
}

/** Artwork that doubles as a play / pause button for the 30-second preview. */
export function PlayToggle({ song, className }: { song: Song; className?: string }) {
  const playing = usePlayingSong() === song.id;
  return (
    <button
      type="button"
      onClick={() => toggleSong(song.id, song.previewUrl)}
      aria-label={playing ? `Pause ${song.title}` : `Play ${song.title}`}
      className={cn("relative size-11 shrink-0 overflow-hidden rounded-lg bg-muted", className)}
    >
      {song.artwork && <img src={song.artwork} alt="" className="size-full object-cover" loading="lazy" />}
      <span
        className={cn(
          "absolute inset-0 flex items-center justify-center bg-foreground/35 text-background transition-opacity",
          playing ? "opacity-100" : "opacity-80 hover:opacity-100",
        )}
      >
        {playing ? <Pause className="size-4 fill-current" /> : <Play className="size-4 fill-current" />}
      </span>
    </button>
  );
}

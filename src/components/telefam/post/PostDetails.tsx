import type { ReactNode } from "react";
import { ChevronRight, Hash, Music, UserPlus, X } from "lucide-react";
import { Avatar } from "@/components/telefam/home/parts";
import type { Contact } from "@/lib/contacts";
import { CAPTION_MAX, MAX_HASHTAGS, type Song } from "@/lib/post-rules";
import { PlayToggle } from "./SongSheet";

export function PostDetails({
  showCaption,
  caption,
  onCaption,
  song,
  onSong,
  onClearSong,
  people,
  onPeople,
  onRemovePerson,
  hashtags,
  onHashtags,
  onRemoveHashtag,
  captionTags,
}: {
  showCaption: boolean;
  caption: string;
  onCaption: (v: string) => void;
  song: Song | null;
  onSong: () => void;
  onClearSong: () => void;
  people: Contact[];
  onPeople: () => void;
  onRemovePerson: (id: string) => void;
  hashtags: string[];
  onHashtags: () => void;
  onRemoveHashtag: (t: string) => void;
  /** Tags typed in the text, shown so the limit makes sense. */
  captionTags: string[];
}) {
  const extraTags = captionTags.filter((t) => !hashtags.includes(t));
  return (
    <div className="space-y-3 px-4 md:px-0">
      {showCaption && (
        <div className="rounded-2xl border bg-card px-3.5 pb-2 pt-3 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15">
          <textarea
            value={caption}
            onChange={(e) => onCaption(e.target.value.slice(0, CAPTION_MAX))}
            maxLength={CAPTION_MAX}
            rows={3}
            placeholder="Write a caption…"
            aria-label="Caption"
            className="w-full resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <div className="text-right text-[0.6875rem] font-semibold text-muted-foreground">
            {caption.length}/{CAPTION_MAX}
          </div>
        </div>
      )}

      <div className="divide-y overflow-hidden rounded-2xl border bg-card">
        <Row icon={<Music />} label="Song" onClick={onSong} value={song ? undefined : "Add"}>
          {song && (
            <div className="flex items-center gap-2.5 pb-1 pt-2">
              <PlayToggle song={song} className="size-10" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold">{song.title}</span>
                <span className="block truncate text-xs text-muted-foreground">{song.artist}</span>
              </span>
              <RemoveButton label="Remove song" onClick={onClearSong} />
            </div>
          )}
        </Row>

        <Row icon={<UserPlus />} label="Tag people" onClick={onPeople} value={people.length ? `${people.length}` : "Add"}>
          {people.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pb-1 pt-2">
              {people.map((p) => (
                <span key={p.id} className="flex items-center gap-1.5 rounded-full bg-muted py-0.5 pl-0.5 pr-1">
                  <Avatar url={p.avatarUrl} path={p.avatarPath} name={p.fullName} className="size-6 text-[0.5rem]" />
                  <span className="max-w-[8rem] truncate text-xs font-semibold">@{p.username}</span>
                  <RemoveButton label={`Remove ${p.fullName}`} onClick={() => onRemovePerson(p.id)} small />
                </span>
              ))}
            </div>
          )}
        </Row>

        <Row
          icon={<Hash />}
          label="Hashtags"
          onClick={onHashtags}
          value={hashtags.length + extraTags.length ? `${hashtags.length + extraTags.length}/${MAX_HASHTAGS}` : "Add"}
        >
          {hashtags.length + extraTags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pb-1 pt-2">
              {hashtags.map((t) => (
                <span key={t} className="flex items-center gap-1 rounded-full bg-primary-soft py-1 pl-2.5 pr-1 text-xs font-bold text-primary">
                  #{t}
                  <RemoveButton label={`Remove #${t}`} onClick={() => onRemoveHashtag(t)} small />
                </span>
              ))}
              {extraTags.map((t) => (
                <span key={t} className="rounded-full bg-muted px-2.5 py-1 text-xs font-bold text-muted-foreground">
                  #{t}
                </span>
              ))}
            </div>
          )}
        </Row>
      </div>
    </div>
  );
}

function Row({
  icon,
  label,
  value,
  onClick,
  children,
}: {
  icon: ReactNode;
  label: string;
  value?: string | undefined;
  onClick: () => void;
  children?: ReactNode;
}) {
  return (
    <div className="px-3.5 py-2.5">
      <button type="button" onClick={onClick} className="flex w-full items-center gap-3 text-left">
        <span className="flex size-8 items-center justify-center rounded-full bg-primary-soft text-primary [&_svg]:size-4">
          {icon}
        </span>
        <span className="flex-1 text-sm font-bold">{label}</span>
        {value && <span className="text-xs font-semibold text-muted-foreground">{value}</span>}
        <ChevronRight className="size-4 text-muted-foreground" />
      </button>
      {children}
    </div>
  );
}

function RemoveButton({ label, onClick, small }: { label: string; onClick: () => void; small?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={
        small
          ? "flex size-4 items-center justify-center rounded-full text-current opacity-70 hover:opacity-100"
          : "flex size-7 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
      }
    >
      <X className={small ? "size-3" : "size-4"} strokeWidth={small ? 3 : 2} />
    </button>
  );
}

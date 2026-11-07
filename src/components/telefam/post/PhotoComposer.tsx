import { useRef, useState } from "react";
import { AlertCircle, ChevronLeft, ChevronRight, ImagePlus, Loader2, Plus, X } from "lucide-react";
import { MAX_PHOTOS } from "@/lib/post-rules";
import { cn } from "@/lib/utils";

export type PhotoItem = {
  id: string;
  /** Instant local preview while compression runs. */
  localUrl: string;
  status: "working" | "ready" | "error";
  error?: string;
};

export function PhotoComposer({
  photos,
  onAdd,
  onRemove,
}: {
  photos: PhotoItem[];
  onAdd: (files: File[]) => void;
  onRemove: (id: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [index, setIndex] = useState(0);
  const current = photos[Math.min(index, photos.length - 1)];
  const canAdd = photos.length < MAX_PHOTOS;

  const picker = (
    <input
      ref={input}
      type="file"
      accept="image/*"
      multiple
      hidden
      onChange={(e) => {
        const files = Array.from(e.target.files ?? []);
        e.target.value = "";
        if (files.length) onAdd(files);
      }}
    />
  );

  if (!photos.length) {
    return (
      <div className="px-4 pt-4 md:px-0 md:pt-0">
        {picker}
        <button
          type="button"
          onClick={() => input.current?.click()}
          className="flex aspect-[4/5] w-full max-w-md flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed bg-muted/50 text-muted-foreground transition-colors hover:border-primary hover:text-primary md:mx-auto"
        >
          <span className="flex size-16 items-center justify-center rounded-full bg-primary-soft text-primary">
            <ImagePlus className="size-7" />
          </span>
          <span className="text-base font-bold text-foreground">Add photos</span>
          <span className="text-xs">Up to {MAX_PHOTOS}</span>
        </button>
      </div>
    );
  }

  const go = (d: number) => setIndex((i) => Math.min(Math.max(i + d, 0), photos.length - 1));

  return (
    <div className="space-y-3 px-4 pt-4 md:px-0 md:pt-0">
      {picker}
      <div className="relative mx-auto aspect-[4/5] w-full max-w-md overflow-hidden rounded-3xl bg-muted shadow-soft">
        {current && <img src={current.localUrl} alt="" className="size-full object-contain" />}
        {current?.status === "error" && (
          <div className="absolute inset-x-3 bottom-3 flex items-center gap-2 rounded-xl bg-destructive px-3 py-2 text-xs font-semibold text-destructive-foreground">
            <AlertCircle className="size-4 shrink-0" /> {current.error}
          </div>
        )}
        {photos.length > 1 && (
          <>
            <span className="absolute right-3 top-3 rounded-full bg-background/85 px-2 py-0.5 text-[0.6875rem] font-bold text-foreground">
              {Math.min(index, photos.length - 1) + 1}/{photos.length}
            </span>
            <NavArrow side="left" disabled={index === 0} onClick={() => go(-1)} />
            <NavArrow side="right" disabled={index >= photos.length - 1} onClick={() => go(1)} />
          </>
        )}
      </div>

      <ul className="scrollbar-none mx-auto flex max-w-md gap-2 overflow-x-auto py-1">
        {photos.map((p, i) => (
          <li key={p.id} className="relative shrink-0">
            <button
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Photo ${i + 1}`}
              className={cn(
                "block size-16 overflow-hidden rounded-xl ring-offset-2 ring-offset-background",
                i === index ? "ring-2 ring-primary" : "ring-1 ring-border",
              )}
            >
              <img src={p.localUrl} alt="" className="size-full object-cover" />
              {p.status === "working" && (
                <span className="absolute inset-0 flex items-center justify-center rounded-xl bg-background/60">
                  <Loader2 className="size-4 animate-spin text-primary" />
                </span>
              )}
              {p.status === "error" && (
                <span className="absolute inset-0 flex items-center justify-center rounded-xl bg-destructive/70">
                  <AlertCircle className="size-5 text-destructive-foreground" />
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                onRemove(p.id);
                setIndex((x) => Math.max(0, Math.min(x, photos.length - 2)));
              }}
              aria-label={`Remove photo ${i + 1}`}
              className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-foreground text-background shadow-soft"
            >
              <X className="size-3" strokeWidth={3} />
            </button>
          </li>
        ))}
        {canAdd && (
          <li className="shrink-0">
            <button
              type="button"
              onClick={() => input.current?.click()}
              className="flex size-16 flex-col items-center justify-center rounded-xl border-2 border-dashed text-muted-foreground transition-colors hover:border-primary hover:text-primary"
            >
              <Plus className="size-5" />
              <span className="text-[0.625rem] font-bold">
                {photos.length}/{MAX_PHOTOS}
              </span>
            </button>
          </li>
        )}
      </ul>
    </div>
  );
}

function NavArrow({ side, disabled, onClick }: { side: "left" | "right"; disabled: boolean; onClick: () => void }) {
  const Icon = side === "left" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={side === "left" ? "Previous photo" : "Next photo"}
      className={cn(
        "absolute top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full bg-background/85 text-foreground shadow-soft transition-opacity disabled:opacity-0",
        side === "left" ? "left-3" : "right-3",
      )}
    >
      <Icon className="size-4" />
    </button>
  );
}

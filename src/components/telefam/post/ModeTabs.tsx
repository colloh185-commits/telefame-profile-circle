import { Clapperboard, Images, Type } from "lucide-react";
import { cn } from "@/lib/utils";

export type PostMode = "text" | "photo" | "video";

const MODES: { key: PostMode; label: string; icon: typeof Type }[] = [
  { key: "text", label: "Text", icon: Type },
  { key: "photo", label: "Photos", icon: Images },
  { key: "video", label: "Video", icon: Clapperboard },
];

export function ModeTabs({ value, onChange }: { value: PostMode; onChange: (m: PostMode) => void }) {
  return (
    <div role="tablist" aria-label="Post type" className="mt-3 flex gap-1.5">
      {MODES.map(({ key, label, icon: Icon }) => {
        const selected = key === value;
        return (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(key)}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors",
              selected
                ? "bg-primary-foreground text-primary shadow-soft"
                : "text-primary-foreground/90 hover:bg-primary-foreground/15",
            )}
          >
            <Icon className="size-3.5" />
            {label}
          </button>
        );
      })}
    </div>
  );
}

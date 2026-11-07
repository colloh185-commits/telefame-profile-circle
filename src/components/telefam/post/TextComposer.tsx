import { useLayoutEffect, useRef } from "react";
import { Check } from "lucide-react";
import {
  FONT_CLASS,
  POST_BACKGROUNDS,
  POST_FONTS,
  TEXT_POST_MAX,
  type PostBackground,
  type PostFont,
} from "@/lib/post-rules";
import { cn } from "@/lib/utils";
import { BG_CLASS, BG_LABEL, FONT_LABEL } from "./styles";

export function TextComposer({
  text,
  background,
  font,
  onText,
  onBackground,
  onFont,
}: {
  text: string;
  background: PostBackground;
  font: PostFont;
  onText: (v: string) => void;
  onBackground: (v: PostBackground) => void;
  onFont: (v: PostFont) => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const size = text.length < 60 ? "text-3xl" : text.length < 150 ? "text-2xl" : "text-xl";

  // Grow with the text so it stays vertically centred.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [text, font, size]);

  return (
    <div className="space-y-4 px-4 pt-4 md:px-0 md:pt-0">
      <div
        className={cn(
          "relative mx-auto flex aspect-[4/5] w-full max-w-md items-center justify-center overflow-hidden rounded-3xl p-7 shadow-soft transition-[background-image]",
          BG_CLASS[background],
        )}
        onClick={() => ref.current?.focus()}
      >
        <textarea
          ref={ref}
          value={text}
          onChange={(e) => onText(e.target.value.slice(0, TEXT_POST_MAX))}
          maxLength={TEXT_POST_MAX}
          rows={1}
          placeholder="What's on your mind?"
          aria-label="Post text"
          className={cn(
            "max-h-full w-full resize-none overflow-hidden bg-transparent text-center leading-snug text-inherit outline-none placeholder:text-current placeholder:opacity-60",
            size,
            FONT_CLASS[font],
            font === "display" && "text-4xl",
          )}
        />
        <span className="absolute bottom-3 right-4 text-[0.6875rem] font-semibold opacity-70">
          {text.length}/{TEXT_POST_MAX}
        </span>
      </div>

      <div className="mx-auto max-w-md">
        <div className="scrollbar-none -mx-1 flex gap-2.5 overflow-x-auto px-1 py-1.5" role="radiogroup" aria-label="Background">
          {POST_BACKGROUNDS.map((bg) => (
            <button
              key={bg}
              type="button"
              role="radio"
              aria-checked={bg === background}
              aria-label={BG_LABEL[bg]}
              onClick={() => onBackground(bg)}
              className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-full ring-offset-2 ring-offset-background transition-transform active:scale-95",
                BG_CLASS[bg],
                bg === background ? "ring-2 ring-primary" : "ring-1 ring-border",
              )}
            >
              {bg === background && <Check className="size-4" strokeWidth={3} />}
            </button>
          ))}
        </div>

        <div className="scrollbar-none -mx-1 mt-2 flex gap-2 overflow-x-auto px-1 pb-1" role="radiogroup" aria-label="Font">
          {POST_FONTS.map((f) => (
            <button
              key={f}
              type="button"
              role="radio"
              aria-checked={f === font}
              onClick={() => onFont(f)}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors",
                f === font ? "border-primary bg-primary-soft text-primary" : "bg-card text-foreground hover:bg-muted",
              )}
            >
              <span className={cn("text-base leading-none", FONT_CLASS[f])}>Aa</span>
              <span className="text-xs font-semibold">{FONT_LABEL[f]}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

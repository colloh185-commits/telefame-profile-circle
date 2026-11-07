import type { PostBackground, PostFont } from "@/lib/post-rules";

/** Literal class names so the stylesheet build can see them. */
export const BG_CLASS: Record<PostBackground, string> = {
  brand: "post-bg-brand",
  sunset: "post-bg-sunset",
  ocean: "post-bg-ocean",
  forest: "post-bg-forest",
  grape: "post-bg-grape",
  night: "post-bg-night",
  paper: "post-bg-paper",
  rose: "post-bg-rose",
};

export const BG_LABEL: Record<PostBackground, string> = {
  brand: "Telefam red",
  sunset: "Sunset",
  ocean: "Ocean",
  forest: "Forest",
  grape: "Grape",
  night: "Night",
  paper: "Paper",
  rose: "Rose",
};

export const FONT_LABEL: Record<PostFont, string> = {
  sans: "Classic",
  serif: "Serif",
  hand: "Hand",
  mono: "Typewriter",
  display: "Bold",
};

export const ASPECTS = [
  { key: "original", label: "Original", ratio: null },
  { key: "1:1", label: "1:1", ratio: 1 },
  { key: "4:5", label: "4:5", ratio: 4 / 5 },
  { key: "9:16", label: "9:16", ratio: 9 / 16 },
  { key: "16:9", label: "16:9", ratio: 16 / 9 },
] as const;
export type AspectKey = (typeof ASPECTS)[number]["key"];

export function formatTime(s: number): string {
  const total = Math.max(0, Math.round(s));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

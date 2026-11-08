import { Button } from "@/components/ui/button";
import type { PublishStage } from "@/lib/post-publish";

const LABEL: Record<PublishStage, string> = {
  compressing: "Compressing",
  uploading: "Uploading",
  checking: "Checking",
};

export function PublishOverlay({
  stage,
  value,
  onCancel,
}: {
  stage: PublishStage;
  value: number;
  onCancel: () => void;
}) {
  const pct = Math.round(Math.min(Math.max(value, 0), 1) * 100);
  const r = 44;
  const c = 2 * Math.PI * r;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Posting"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 bg-background/95 backdrop-blur-sm"
    >
      <div className="relative size-28">
        <svg viewBox="0 0 100 100" className="size-full -rotate-90">
          <circle cx="50" cy="50" r={r} fill="none" strokeWidth="8" className="stroke-muted" />
          <circle
            cx="50"
            cy="50"
            r={r}
            fill="none"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - pct / 100)}
            className="stroke-primary transition-[stroke-dashoffset] duration-300"
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-2xl font-extrabold tabular-nums">
          {pct}%
        </span>
      </div>
      <p className="text-sm font-bold" aria-live="polite">
        {LABEL[stage]}
      </p>
      <Button variant="outline" className="rounded-full px-6" onClick={onCancel} disabled={stage === "checking"}>
        Cancel
      </Button>
    </div>
  );
}

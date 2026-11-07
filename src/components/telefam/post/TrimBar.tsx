import { useRef, type KeyboardEvent, type PointerEvent } from "react";
import { cn } from "@/lib/utils";
import { formatTime } from "./styles";

type Drag = { kind: "start" | "end" | "move"; x0: number; s0: number; e0: number };

/** Frame strip with draggable start/end handles; drag the middle to slide the window. */
export function TrimBar({
  duration,
  start,
  end,
  current,
  frames,
  minLen,
  maxLen,
  onChange,
}: {
  duration: number;
  start: number;
  end: number;
  current: number;
  frames: string[];
  minLen: number;
  maxLen: number;
  onChange: (start: number, end: number, edge: "start" | "end") => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const pct = (t: number) => `${(t / duration) * 100}%`;

  const apply = (kind: Drag["kind"], s: number, e: number) => {
    if (kind === "start") {
      const ns = Math.min(Math.max(s, 0, e - maxLen), e - minLen);
      onChange(ns, e, "start");
    } else if (kind === "end") {
      const ne = Math.max(Math.min(e, duration, s + maxLen), s + minLen);
      onChange(s, ne, "end");
    } else {
      const len = e - s;
      const ns = Math.min(Math.max(s, 0), duration - len);
      onChange(ns, ns + len, "start");
    }
  };

  const down = (kind: Drag["kind"]) => (ev: PointerEvent) => {
    ev.stopPropagation();
    (ev.currentTarget as HTMLElement).setPointerCapture(ev.pointerId);
    drag.current = { kind, x0: ev.clientX, s0: start, e0: end };
  };
  const move = (ev: PointerEvent) => {
    const d = drag.current;
    const el = box.current;
    if (!d || !el) return;
    const dt = ((ev.clientX - d.x0) / el.clientWidth) * duration;
    if (d.kind === "start") apply("start", d.s0 + dt, d.e0);
    else if (d.kind === "end") apply("end", d.s0, d.e0 + dt);
    else apply("move", d.s0 + dt, d.e0 + dt);
  };
  const up = () => {
    drag.current = null;
  };
  const keys = (kind: "start" | "end") => (ev: KeyboardEvent) => {
    const step = ev.shiftKey ? 2 : 0.25;
    const d = ev.key === "ArrowLeft" ? -step : ev.key === "ArrowRight" ? step : 0;
    if (!d) return;
    ev.preventDefault();
    if (kind === "start") apply("start", start + d, end);
    else apply("end", start, end + d);
  };

  const handle = "absolute inset-y-0 z-10 flex w-4 cursor-ew-resize touch-none items-center justify-center bg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <div className="select-none">
      <div ref={box} className="relative h-14 overflow-hidden rounded-xl bg-muted" onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
        <div className="flex h-full">
          {frames.map((src, i) => (
            <img key={i} src={src} alt="" draggable={false} className="h-full min-w-0 flex-1 object-cover" />
          ))}
        </div>
        <div className="absolute inset-y-0 left-0 bg-background/70" style={{ width: pct(start) }} />
        <div className="absolute inset-y-0 right-0 bg-background/70" style={{ left: pct(end) }} />
        <div
          className="absolute inset-y-0 cursor-grab touch-none border-y-[3px] border-primary active:cursor-grabbing"
          style={{ left: pct(start), width: `calc(${pct(end - start)})` }}
          onPointerDown={down("move")}
        />
        <div
          className="pointer-events-none absolute inset-y-0 z-10 w-0.5 bg-primary-foreground shadow-soft"
          style={{ left: pct(Math.min(Math.max(current, start), end)) }}
        />
        <div
          role="slider"
          tabIndex={0}
          aria-label="Trim start"
          aria-valuemin={0}
          aria-valuemax={duration}
          aria-valuenow={Math.round(start * 10) / 10}
          aria-valuetext={formatTime(start)}
          className={cn(handle, "rounded-l-xl")}
          style={{ left: `calc(${pct(start)} - 0.5rem)` }}
          onPointerDown={down("start")}
          onKeyDown={keys("start")}
        >
          <span className="h-5 w-0.5 rounded-full bg-primary-foreground" />
        </div>
        <div
          role="slider"
          tabIndex={0}
          aria-label="Trim end"
          aria-valuemin={0}
          aria-valuemax={duration}
          aria-valuenow={Math.round(end * 10) / 10}
          aria-valuetext={formatTime(end)}
          className={cn(handle, "rounded-r-xl")}
          style={{ left: `calc(${pct(end)} - 0.5rem)` }}
          onPointerDown={down("end")}
          onKeyDown={keys("end")}
        >
          <span className="h-5 w-0.5 rounded-full bg-primary-foreground" />
        </div>
      </div>
      <div className="mt-1.5 flex justify-between text-[0.6875rem] font-semibold text-muted-foreground">
        <span>{formatTime(start)}</span>
        <span className="text-foreground">{(end - start).toFixed(1)}s</span>
        <span>{formatTime(end)}</span>
      </div>
    </div>
  );
}

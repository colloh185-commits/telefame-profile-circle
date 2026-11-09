import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { Clapperboard, ImagePlus, Loader2, Pause, Play, RefreshCw, Trash2, Volume2, VolumeX } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { MAX_VIDEO_SECONDS, MIN_VIDEO_SECONDS, type Song } from "@/lib/post-rules";
import { playSong, stopSong } from "@/lib/song-preview";
import { cropFor, type VideoHandle } from "@/lib/video-edit";
import { cn } from "@/lib/utils";
import { TrimBar } from "./TrimBar";
import { ASPECTS, formatTime, type AspectKey } from "./styles";

export type VideoState = {
  handle: VideoHandle;
  start: number;
  end: number;
  aspect: AspectKey;
  cx: number;
  cy: number;
  mute: boolean;
  coverTime: number;
  coverImage: { url: string; id: string } | null;
};

export function videoCrop(v: VideoState) {
  const ratio = ASPECTS.find((a) => a.key === v.aspect)?.ratio ?? null;
  return cropFor(v.handle.width, v.handle.height, ratio, v.cx, v.cy);
}

export function VideoComposer({
  state,
  loading,
  song,
  onPick,
  onChange,
  onClear,
  onCoverUpload,
}: {
  state: VideoState | null;
  loading: boolean;
  song: Song | null;
  onPick: (file: File) => void;
  onChange: (patch: Partial<VideoState>) => void;
  onClear: () => void;
  onCoverUpload: (file: File) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const picker = (
    <input
      ref={input}
      type="file"
      accept="video/*"
      hidden
      onChange={(e) => {
        const f = e.target.files?.[0];
        e.target.value = "";
        if (f) onPick(f);
      }}
    />
  );

  if (!state) {
    return (
      <div className="px-4 pt-4 md:px-0 md:pt-0">
        {picker}
        <button
          type="button"
          disabled={loading}
          onClick={() => input.current?.click()}
          className="flex aspect-[4/5] w-full max-w-md flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed bg-muted/50 text-muted-foreground transition-colors hover:border-primary hover:text-primary disabled:pointer-events-none md:mx-auto"
        >
          <span className="flex size-16 items-center justify-center rounded-full bg-primary-soft text-primary">
            {loading ? <Loader2 className="size-7 animate-spin" /> : <Clapperboard className="size-7" />}
          </span>
          <span className="text-base font-bold text-foreground">{loading ? "Opening video" : "Choose video"}</span>
          {!loading && <span className="text-xs">Up to 100 MB · {MAX_VIDEO_SECONDS / 60} min</span>}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4 px-4 pt-4 md:px-0 md:pt-0">
      {picker}
      <Editor
        state={state}
        song={song}
        onChange={onChange}
        onReplace={() => input.current?.click()}
        onClear={onClear}
        onCoverUpload={onCoverUpload}
      />
    </div>
  );
}

function Editor({
  state,
  song,
  onChange,
  onReplace,
  onClear,
  onCoverUpload,
}: {
  state: VideoState;
  song: Song | null;
  onChange: (patch: Partial<VideoState>) => void;
  onReplace: () => void;
  onClear: () => void;
  onCoverUpload: (file: File) => void;
}) {
  const { handle, start, end, mute, coverTime } = state;
  const { width: W, height: H, duration } = handle;
  const crop = videoCrop(state);
  const [src, setSrc] = useState<string>();
  useEffect(() => {
    const url = URL.createObjectURL(handle.file);
    setSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [handle]);

  const video = useRef<HTMLVideoElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [now, setNow] = useState(start);
  const [frames, setFrames] = useState<string[]>([]);
  const coverInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    let urls: string[] = [];
    handle
      .strip(10, 64)
      .then((u) => {
        urls = u;
        if (alive) setFrames(u);
        else u.forEach(URL.revokeObjectURL);
      })
      .catch(() => {});
    return () => {
      alive = false;
      urls.forEach(URL.revokeObjectURL);
    };
  }, [handle]);

  useEffect(() => () => stopSong(), []);

  // Cover preview follows the chosen frame and crop.
  const [framePreview, setFramePreview] = useState<string | null>(null);
  const cropKey = `${crop.left},${crop.top},${crop.width},${crop.height}`;
  useEffect(() => {
    if (state.coverImage) return;
    let url: string | null = null;
    let alive = true;
    const t = setTimeout(() => {
      handle
        .frame(coverTime, crop, 320)
        .then((blob) => {
          if (!alive) return;
          url = URL.createObjectURL(blob);
          setFramePreview(url);
        })
        .catch(() => {});
    }, 200);
    return () => {
      alive = false;
      clearTimeout(t);
      if (url) setTimeout(() => URL.revokeObjectURL(url!), 1000);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handle, coverTime, cropKey, state.coverImage]);

  const toggle = () => {
    const v = video.current;
    if (!v) return;
    if (v.paused) {
      if (v.currentTime < start || v.currentTime >= end - 0.05) v.currentTime = start;
      void v.play();
      if (song) playSong(song.id, song.previewUrl, true);
    } else {
      v.pause();
    }
  };

  const onTime = () => {
    const v = video.current;
    if (!v) return;
    setNow(v.currentTime);
    if (v.currentTime >= end) v.currentTime = start;
  };

  // Drag the crop box.
  const drag = useRef<{ x: number; y: number; cx: number; cy: number } | null>(null);
  const cropDown = (e: PointerEvent) => {
    if (state.aspect === "original") return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, cx: state.cx, cy: state.cy };
  };
  const cropMove = (e: PointerEvent) => {
    const d = drag.current;
    const el = box.current;
    if (!d || !el) return;
    const hw = crop.width / W / 2;
    const hh = crop.height / H / 2;
    const clamp = (v: number, h: number) => Math.min(Math.max(v, h), 1 - h);
    onChange({
      cx: clamp(d.cx + (e.clientX - d.x) / el.clientWidth, hw),
      cy: clamp(d.cy + (e.clientY - d.y) / el.clientHeight, hh),
    });
  };
  const cropUp = () => {
    drag.current = null;
  };

  const ratio = W / H;

  return (
    <>
      <div className="flex justify-center">
        <div
          ref={box}
          className="relative w-full overflow-hidden rounded-3xl bg-foreground shadow-soft"
          style={{ aspectRatio: `${W} / ${H}`, maxHeight: "56dvh", maxWidth: `calc(56dvh * ${ratio})` }}
        >
          <video
            ref={video}
            src={src}
            playsInline
            preload="auto"
            muted={mute}
            onTimeUpdate={onTime}
            onPlay={() => setPlaying(true)}
            onPause={() => {
              setPlaying(false);
              stopSong();
            }}
            onLoadedMetadata={(e) => (e.currentTarget.currentTime = start)}
            className="absolute inset-0 size-full object-fill"
          />
          <div
            className={cn(
              "crop-mask absolute touch-none border-2 border-primary-foreground",
              state.aspect !== "original" && "cursor-move",
            )}
            style={{
              left: `${(crop.left / W) * 100}%`,
              top: `${(crop.top / H) * 100}%`,
              width: `${(crop.width / W) * 100}%`,
              height: `${(crop.height / H) * 100}%`,
            }}
            onPointerDown={cropDown}
            onPointerMove={cropMove}
            onPointerUp={cropUp}
            onPointerCancel={cropUp}
            onClick={toggle}
          >
            {state.aspect !== "original" && (
              <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3">
                {Array.from({ length: 9 }, (_, i) => (
                  <span key={i} className="border-[0.5px] border-primary-foreground/30" />
                ))}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={toggle}
            aria-label={playing ? "Pause" : "Play"}
            className="absolute bottom-3 left-3 flex h-8 items-center gap-1.5 rounded-full bg-background/90 px-3 text-xs font-bold text-foreground shadow-soft"
          >
            {playing ? <Pause className="size-3.5 fill-current" /> : <Play className="size-3.5 fill-current" />}
            {formatTime(now - start)} / {formatTime(end - start)}
          </button>
          <div className="absolute right-3 top-3 flex gap-1.5">
            <IconButton label="Change video" onClick={onReplace}>
              <RefreshCw className="size-4" />
            </IconButton>
            <IconButton label="Remove video" onClick={onClear}>
              <Trash2 className="size-4" />
            </IconButton>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-xl space-y-4">
        <div className="scrollbar-none flex gap-1.5 overflow-x-auto" role="radiogroup" aria-label="Crop">
          {ASPECTS.map((a) => (
            <button
              key={a.key}
              type="button"
              role="radio"
              aria-checked={state.aspect === a.key}
              onClick={() => onChange({ aspect: a.key, cx: 0.5, cy: 0.5 })}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1 text-xs font-bold transition-colors",
                state.aspect === a.key ? "border-primary bg-primary-soft text-primary" : "bg-card hover:bg-muted",
              )}
            >
              {a.label}
            </button>
          ))}
        </div>

        <TrimBar
          duration={duration}
          start={start}
          end={end}
          current={now}
          frames={frames}
          minLen={Math.min(MIN_VIDEO_SECONDS, duration)}
          maxLen={MAX_VIDEO_SECONDS}
          onChange={(s, e, edge) => {
            const v = video.current;
            if (v) {
              v.pause();
              v.currentTime = edge === "start" ? s : Math.max(s, e - 0.05);
            }
            onChange({ start: s, end: e, coverTime: Math.min(Math.max(coverTime, s), e) });
          }}
        />

        <div className="flex items-center gap-3 rounded-2xl border bg-card p-2.5">
          <div
            className="h-16 shrink-0 overflow-hidden rounded-xl bg-muted"
            style={{ aspectRatio: `${crop.width} / ${crop.height}`, maxWidth: "6rem" }}
          >
            {(state.coverImage?.url ?? framePreview) && (
              <img src={state.coverImage?.url ?? framePreview!} alt="Cover" className="size-full object-cover" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-bold">Cover</span>
              <input
                ref={coverInput}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (f) onCoverUpload(f);
                }}
              />
              {state.coverImage ? (
                <button
                  type="button"
                  onClick={() => onChange({ coverImage: null })}
                  className="text-xs font-bold text-primary"
                >
                  Use a frame
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => coverInput.current?.click()}
                  className="flex items-center gap-1 text-xs font-bold text-primary"
                >
                  <ImagePlus className="size-3.5" /> Upload
                </button>
              )}
            </div>
            <Slider
              min={start}
              max={end}
              step={0.1}
              value={[Math.min(Math.max(coverTime, start), end)]}
              disabled={!!state.coverImage}
              onValueChange={([t]) => {
                if (t === undefined) return;
                onChange({ coverTime: t });
                const v = video.current;
                if (v && v.paused) v.currentTime = t;
              }}
              aria-label="Cover frame"
            />
          </div>
        </div>

        <label className="flex items-center gap-3 rounded-2xl border bg-card px-3.5 py-3">
          {mute ? <VolumeX className="size-5 text-muted-foreground" /> : <Volume2 className="size-5 text-primary" />}
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold">Original sound</span>
            {!handle.hasAudio ? (
              <span className="block text-xs text-muted-foreground">No sound in this video</span>
            ) : !handle.canKeepAudio ? (
              <span className="block text-xs text-muted-foreground">This browser can't keep the sound</span>
            ) : null}
          </span>
          <Switch
            checked={!mute}
            disabled={!handle.canKeepAudio}
            onCheckedChange={(on) => onChange({ mute: !on })}
            aria-label="Original sound"
          />
        </label>
      </div>
    </>
  );
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex size-8 items-center justify-center rounded-full bg-background/90 text-foreground shadow-soft transition-transform active:scale-95"
    >
      {children}
    </button>
  );
}

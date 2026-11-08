import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { X } from "lucide-react";
import { DesktopRail } from "@/components/telefam/shell/AppNav";
import { ModeTabs, type PostMode } from "@/components/telefam/post/ModeTabs";
import { TextComposer } from "@/components/telefam/post/TextComposer";
import { PhotoComposer, type PhotoItem } from "@/components/telefam/post/PhotoComposer";
import { VideoComposer, videoCrop, type VideoState } from "@/components/telefam/post/VideoComposer";
import { PostDetails } from "@/components/telefam/post/PostDetails";
import { SongSheet } from "@/components/telefam/post/SongSheet";
import { PeopleSheet } from "@/components/telefam/post/PeopleSheet";
import { HashtagSheet } from "@/components/telefam/post/HashtagSheet";
import { PublishOverlay } from "@/components/telefam/post/PublishOverlay";
import { myProfileQuery } from "@/lib/my-profile";
import { prepareUploads, publishPost } from "@/lib/posts.functions";
import {
  MAX_HASHTAGS,
  MAX_PEOPLE_TAGS,
  MAX_PHOTOS,
  MAX_VIDEO_SECONDS,
  extractHashtags,
  mergeHashtags,
  type PostBackground,
  type PostFont,
  type Song,
} from "@/lib/post-rules";
import { compressPhoto, type CompressedPhoto } from "@/lib/photo-compress";
import { openVideo } from "@/lib/video-edit";
import { MediaError } from "@/lib/media-canvas";
import { publishDraft, type Draft, type PublishStage } from "@/lib/post-publish";
import { AppError } from "@/lib/offline";
import { stopSong } from "@/lib/song-preview";
import type { Contact } from "@/lib/contacts";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/post")({
  head: () => ({
    meta: [
      { title: "New post — Telefam" },
      { name: "description", content: "Share text, photos or a video with your Telefam circle." },
      { property: "og:title", content: "New post — Telefam" },
      { property: "og:description", content: "Share text, photos or a video with your Telefam circle." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PostPage,
});

/** Keeps at most two photos decoding at once so phones don't run out of memory. */
function makeLimiter(max: number) {
  let active = 0;
  const queue: (() => void)[] = [];
  return <T,>(job: () => Promise<T>): Promise<T> =>
    new Promise<T>((resolve, reject) => {
      const run = () => {
        active++;
        job()
          .then(resolve, reject)
          .finally(() => {
            active--;
            queue.shift()?.();
          });
      };
      if (active < max) run();
      else queue.push(run);
    });
}
const photoLimit = makeLimiter(2);

const friendly = (err: unknown) =>
  err instanceof AppError || err instanceof MediaError ? err.message : "Something went wrong. Please try again.";

function PostPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: profile } = useQuery(myProfileQuery());
  const me = { avatarUrl: profile?.avatarUrl, avatarPath: profile?.avatarPath, name: profile?.fullName };
  const prepare = useServerFn(prepareUploads);
  const publish = useServerFn(publishPost);

  const [mode, setMode] = useState<PostMode>("text");

  // Text
  const [text, setText] = useState("");
  const [background, setBackground] = useState<PostBackground>("brand");
  const [font, setFont] = useState<PostFont>("sans");

  // Photos: compression starts the moment they're picked.
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const jobs = useRef(new Map<string, Promise<CompressedPhoto>>());

  // Video
  const [video, setVideo] = useState<VideoState | null>(null);
  const [videoLoading, setVideoLoading] = useState(false);

  // Shared extras
  const [caption, setCaption] = useState("");
  const [song, setSong] = useState<Song | null>(null);
  const [people, setPeople] = useState<Contact[]>([]);
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [sheet, setSheet] = useState<"song" | "people" | "hashtags" | null>(null);

  const [progress, setProgress] = useState<{ stage: PublishStage; value: number } | null>(null);
  const abort = useRef<AbortController | null>(null);

  const body = mode === "text" ? text : caption;
  const bodyTags = useMemo(() => extractHashtags(body), [body]);

  // Free video decoders and object URLs when leaving.
  const videoRef = useRef(video);
  videoRef.current = video;
  const photosRef = useRef(photos);
  photosRef.current = photos;
  useEffect(
    () => () => {
      videoRef.current?.handle.dispose();
      photosRef.current.forEach((p) => URL.revokeObjectURL(p.localUrl));
      stopSong();
    },
    [],
  );

  const addPhotos = (files: File[]) => {
    const room = MAX_PHOTOS - photos.length;
    if (files.length > room) toast(`Up to ${MAX_PHOTOS} photos per post`, { id: "photo-limit" });
    const picked = files.slice(0, Math.max(room, 0));
    const items: PhotoItem[] = picked.map((file) => {
      const id = crypto.randomUUID();
      const job = photoLimit(() => compressPhoto(file));
      jobs.current.set(id, job);
      job.then(
        (r) =>
          setPhotos((list) =>
            list.map((p) => {
              if (p.id !== id) return p;
              URL.revokeObjectURL(p.localUrl);
              return { ...p, localUrl: r.url, status: "ready" };
            }),
          ),
        (err) =>
          setPhotos((list) => list.map((p) => (p.id === id ? { ...p, status: "error", error: friendly(err) } : p))),
      );
      return { id, localUrl: URL.createObjectURL(file), status: "working" };
    });
    setPhotos((list) => [...list, ...items]);
  };

  const removePhoto = (id: string) => {
    jobs.current.delete(id);
    setPhotos((list) => {
      const gone = list.find((p) => p.id === id);
      if (gone) URL.revokeObjectURL(gone.localUrl);
      return list.filter((p) => p.id !== id);
    });
  };

  const pickVideo = async (file: File) => {
    setVideoLoading(true);
    try {
      const handle = await openVideo(file);
      video?.handle.dispose();
      setVideo({
        handle,
        start: 0,
        end: Math.min(handle.duration, MAX_VIDEO_SECONDS),
        aspect: "original",
        cx: 0.5,
        cy: 0.5,
        mute: !handle.canKeepAudio,
        coverTime: 0,
        coverImage: null,
      });
      if (handle.duration > MAX_VIDEO_SECONDS) {
        toast(`Videos can be up to ${MAX_VIDEO_SECONDS / 60} minutes — trim to the part you want`, { id: "video-long" });
      }
    } catch (err) {
      toast.error(friendly(err), { id: "video-error" });
    } finally {
      setVideoLoading(false);
    }
  };

  const clearVideo = () => {
    video?.handle.dispose();
    stopSong();
    setVideo(null);
  };

  const uploadCover = (file: File) => {
    const id = crypto.randomUUID();
    const job = compressPhoto(file, 1080);
    jobs.current.set(id, job);
    job.catch((err) => {
      toast.error(friendly(err), { id: "cover-error" });
      setVideo((v) => (v?.coverImage?.id === id ? { ...v, coverImage: null } : v));
    });
    setVideo((v) => (v ? { ...v, coverImage: { id, url: URL.createObjectURL(file) } } : v));
  };

  const togglePerson = (c: Contact) =>
    setPeople((list) =>
      list.some((p) => p.id === c.id)
        ? list.filter((p) => p.id !== c.id)
        : list.length >= MAX_PEOPLE_TAGS
          ? list
          : [...list, c],
    );
  const toggleHashtag = (t: string) =>
    setHashtags((list) =>
      list.includes(t) ? list.filter((x) => x !== t) : mergeHashtags([...list, t], body).length > MAX_HASHTAGS ? list : [...list, t],
    );

  const ready =
    mode === "text"
      ? text.trim().length > 0
      : mode === "photo"
        ? photos.length > 0 && photos.every((p) => p.status !== "error")
        : !!video;

  const share = async () => {
    if (!ready || progress) return;
    if (mergeHashtags(hashtags, body).length > MAX_HASHTAGS) {
      toast.error(`Use up to ${MAX_HASHTAGS} hashtags`);
      return;
    }
    const extras = { body, people: people.map((p) => p.id), hashtags, songId: song?.id ?? null };
    let draft: Draft;
    if (mode === "text") draft = { kind: "text", background, font, ...extras };
    else if (mode === "photo") draft = { kind: "photo", photos: photos.map((p) => jobs.current.get(p.id)!), ...extras };
    else {
      const v = video!;
      draft = {
        kind: "video",
        video: v.handle,
        start: v.start,
        end: v.end,
        crop: videoCrop(v),
        mute: v.mute,
        cover: v.coverImage
          ? { kind: "image", photo: jobs.current.get(v.coverImage.id)! }
          : { kind: "frame", time: Math.min(Math.max(v.coverTime, v.start), v.end) },
        ...extras,
      };
    }

    stopSong();
    const ctrl = new AbortController();
    abort.current = ctrl;
    setProgress({ stage: "compressing", value: 0 });
    try {
      await publishDraft(draft, { prepare, publish }, (stage, value) => setProgress({ stage, value }), ctrl.signal);
      toast.success("Posted");
      void qc.invalidateQueries({ queryKey: ["posts"] });
      void navigate({ to: "/home" });
    } catch (err) {
      if (!(err instanceof DOMException && err.name === "AbortError")) toast.error(friendly(err), { id: "post-error" });
    } finally {
      abort.current = null;
      setProgress(null);
    }
  };

  return (
    <div className="h-dvh bg-muted">
      <div className="mx-auto flex h-full max-w-[1680px] overflow-hidden bg-background md:shadow-soft 2xl:border-x">
        <DesktopRail active="post" me={me} className="hidden w-[68px] shrink-0 md:flex lg:w-[72px]" />

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="shrink-0 bg-brand-gradient pt-safe md:pt-0">
            <div className="mx-auto w-full max-w-6xl px-3 pb-5 pt-1.5 md:px-6 md:pt-5">
              <div className="flex items-center gap-2 text-primary-foreground">
                <Link
                  to="/home"
                  aria-label="Close"
                  className="flex size-9 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-primary-foreground/15"
                >
                  <X className="size-5" />
                </Link>
                <h1 className="min-w-0 flex-1 truncate text-lg font-extrabold tracking-tight md:text-2xl">New post</h1>
                <button
                  type="button"
                  onClick={() => void share()}
                  disabled={!ready || !!progress}
                  className="h-9 rounded-full bg-primary-foreground px-5 text-sm font-extrabold text-primary shadow-soft transition-opacity disabled:opacity-60"
                >
                  Share
                </button>
              </div>
              <ModeTabs value={mode} onChange={setMode} />
            </div>
          </header>

          <main className="relative -mt-3 flex-1 overflow-y-auto rounded-t-3xl bg-background md:mt-0 md:rounded-none md:bg-muted/40">
            <div className="mx-auto grid w-full max-w-6xl gap-4 pb-10 md:grid-cols-[minmax(0,1fr)_340px] md:gap-6 md:p-6 lg:grid-cols-[minmax(0,1fr)_380px]">
              <section className={cn("md:rounded-3xl md:border md:bg-card md:p-6")}>
                {mode === "text" && (
                  <TextComposer
                    text={text}
                    background={background}
                    font={font}
                    onText={setText}
                    onBackground={setBackground}
                    onFont={setFont}
                  />
                )}
                {mode === "photo" && <PhotoComposer photos={photos} onAdd={addPhotos} onRemove={removePhoto} />}
                {mode === "video" && (
                  <VideoComposer
                    state={video}
                    loading={videoLoading}
                    song={song}
                    onPick={(f) => void pickVideo(f)}
                    onChange={(patch) => setVideo((v) => (v ? { ...v, ...patch } : v))}
                    onClear={clearVideo}
                    onCoverUpload={uploadCover}
                  />
                )}
              </section>
              <aside className="md:self-start md:rounded-3xl md:border md:bg-card md:p-5">
                <PostDetails
                  showCaption={mode !== "text"}
                  caption={caption}
                  onCaption={setCaption}
                  song={song}
                  onSong={() => setSheet("song")}
                  onClearSong={() => {
                    stopSong();
                    setSong(null);
                  }}
                  people={people}
                  onPeople={() => setSheet("people")}
                  onRemovePerson={(id) => setPeople((l) => l.filter((p) => p.id !== id))}
                  hashtags={hashtags}
                  onHashtags={() => setSheet("hashtags")}
                  onRemoveHashtag={(t) => setHashtags((l) => l.filter((x) => x !== t))}
                  captionTags={bodyTags}
                />
              </aside>
            </div>
          </main>
        </div>
      </div>

      <SongSheet
        open={sheet === "song"}
        onOpenChange={(o) => {
          if (!o) stopSong();
          setSheet(o ? "song" : null);
        }}
        selected={song}
        onSelect={setSong}
      />
      <PeopleSheet
        open={sheet === "people"}
        onOpenChange={(o) => setSheet(o ? "people" : null)}
        selected={people}
        onToggle={togglePerson}
      />
      <HashtagSheet
        open={sheet === "hashtags"}
        onOpenChange={(o) => setSheet(o ? "hashtags" : null)}
        selected={hashtags}
        onToggle={toggleHashtag}
      />

      {progress && (
        <PublishOverlay stage={progress.stage} value={progress.value} onCancel={() => abort.current?.abort()} />
      )}
    </div>
  );
}

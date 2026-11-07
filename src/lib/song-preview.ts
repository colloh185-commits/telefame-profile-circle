import { useSyncExternalStore } from "react";

let audio: HTMLAudioElement | null = null;
let playingId: number | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function el(): HTMLAudioElement {
  if (!audio) {
    audio = new Audio();
    audio.preload = "none";
    audio.addEventListener("ended", () => {
      playingId = null;
      emit();
    });
    audio.addEventListener("pause", () => {
      playingId = null;
      emit();
    });
  }
  return audio;
}

export function playSong(id: number, url: string, loop = false) {
  const a = el();
  if (a.src !== url) a.src = url;
  a.loop = loop;
  playingId = id;
  emit();
  void a.play().catch(() => {
    playingId = null;
    emit();
  });
}

export function stopSong() {
  if (audio && !audio.paused) audio.pause();
  playingId = null;
  emit();
}

export function toggleSong(id: number, url: string) {
  if (playingId === id) stopSong();
  else playSong(id, url);
}

/** Id of the song preview currently playing, if any. */
export function usePlayingSong(): number | null {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => playingId,
    () => null,
  );
}

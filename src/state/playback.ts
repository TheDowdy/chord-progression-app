import { useEffect } from 'react';
import { startPlayback, stopPlayback, updatePlayback, type PlayEvent } from '../audio/engine';
import { pianoVoicing } from '../theory/voicings';
import type { Song } from '../types';
import { flattenSong } from './song';
import { useStore } from './store';

export function toPlayEvents(song: Song): PlayEvent[] {
  return flattenSong(song).map((e) => ({ id: e.id, midi: pianoVoicing(e.chord), beats: e.beats }));
}

/** Start playing the song. Call from a click/tap handler so the browser allows audio. */
export async function play(): Promise<void> {
  const { song, loop, setPlaying, setPlayingEvent } = useStore.getState();
  const events = toPlayEvents(song);
  if (events.length === 0) return;
  setPlaying(true);
  await startPlayback(events, {
    bpm: song.bpm,
    loop,
    onEvent: (id) => (id === null ? setPlaying(false) : setPlayingEvent(id)),
  });
}

export function stop(): void {
  stopPlayback();
  useStore.getState().setPlaying(false);
}

export function togglePlay(): void {
  if (useStore.getState().isPlaying) stop();
  else void play();
}

/** While playing, push edits, tempo and loop changes into the running transport. */
export function useLivePlaybackSync(): void {
  useEffect(
    () =>
      useStore.subscribe((s, prev) => {
        if (!s.isPlaying) return;
        if (s.song.sections === prev.song.sections && s.song.bpm === prev.song.bpm && s.loop === prev.loop) return;
        updatePlayback(toPlayEvents(s.song), s.song.bpm, s.loop);
      }),
    [],
  );
}

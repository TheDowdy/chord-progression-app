import { Interval } from 'tonal';
import { create } from 'zustand';
import { relabel, transposeChord } from '../theory/chords';
import type { ChordRef, Key } from '../theory/types';
import type { Song } from '../types';
import { flattenSong, newEvent, newSong } from './song';

export type KeyChangeMode = 'transpose' | 'relabel';

export const BPM_MIN = 30;
export const BPM_MAX = 300;

interface AppState {
  song: Song;
  /** The chord slot whose chord is the map's centre; new chords insert after it. */
  selectedEventId: string | null;
  /** The chord slot currently sounding during playback. */
  playingEventId: string | null;
  isPlaying: boolean;
  loop: boolean;

  addChord: (chord: ChordRef) => void;
  removeEvent: (id: string) => void;
  clearSection: () => void;
  selectEvent: (id: string | null) => void;
  changeKey: (key: Key, how: KeyChangeMode) => void;
  setBpm: (bpm: number) => void;
  setLoop: (loop: boolean) => void;
  setPlaying: (isPlaying: boolean) => void;
  setPlayingEvent: (id: string | null) => void;
}

const touch = (song: Song): Song => ({ ...song, updatedAt: Date.now() });

export const useStore = create<AppState>((set) => ({
  song: newSong(),
  selectedEventId: null,
  playingEventId: null,
  isPlaying: false,
  loop: true,

  addChord: (chord) =>
    set((s) => {
      const event = newEvent(chord);
      const section = s.song.sections[0];
      // While playing, the map follows the audio, so new chords continue from what you hear.
      const base = s.isPlaying && s.playingEventId ? s.playingEventId : s.selectedEventId;
      const at = section.events.findIndex((e) => e.id === base);
      const events = [...section.events];
      events.splice(at < 0 ? events.length : at + 1, 0, event);
      const sections = [{ ...section, events }, ...s.song.sections.slice(1)];
      return { song: touch({ ...s.song, sections }), selectedEventId: event.id };
    }),

  removeEvent: (id) =>
    set((s) => {
      const section = s.song.sections[0];
      const at = section.events.findIndex((e) => e.id === id);
      if (at < 0) return s;
      const events = section.events.filter((e) => e.id !== id);
      const selected =
        s.selectedEventId === id ? (events[Math.min(at, events.length - 1)]?.id ?? null) : s.selectedEventId;
      const sections = [{ ...section, events }, ...s.song.sections.slice(1)];
      return { song: touch({ ...s.song, sections }), selectedEventId: selected };
    }),

  clearSection: () =>
    set((s) => {
      const sections = [{ ...s.song.sections[0], events: [] }, ...s.song.sections.slice(1)];
      return { song: touch({ ...s.song, sections }), selectedEventId: null };
    }),

  selectEvent: (id) => set({ selectedEventId: id }),

  changeKey: (key, how) =>
    set((s) => {
      const shift = how === 'transpose' ? Interval.distance(s.song.key.tonic, key.tonic) : null;
      const sections = s.song.sections.map((section) => ({
        ...section,
        events: section.events.map((e) => ({
          ...e,
          chord: shift ? transposeChord(e.chord, shift, key) : relabel(e.chord, key),
        })),
      }));
      return { song: touch({ ...s.song, key, sections }) };
    }),

  setBpm: (bpm) =>
    set((s) => ({ song: touch({ ...s.song, bpm: Math.max(BPM_MIN, Math.min(BPM_MAX, Math.round(bpm) || s.song.bpm)) }) })),
  setLoop: (loop) => set({ loop }),
  setPlaying: (isPlaying) => set(isPlaying ? { isPlaying } : { isPlaying, playingEventId: null }),
  setPlayingEvent: (id) => set({ playingEventId: id }),
}));

/**
 * The chord at the centre of the map (the sounding chord during playback, otherwise the selected
 * slot), with the chords before it. `chord` is null when nothing is selected: show the start ring.
 */
export function selectCenter(
  s: Pick<AppState, 'song' | 'selectedEventId' | 'playingEventId' | 'isPlaying'>,
): { chord: ChordRef | null; previous: ChordRef[] } {
  const events = flattenSong(s.song);
  const id = s.isPlaying && s.playingEventId ? s.playingEventId : s.selectedEventId;
  const at = events.findIndex((e) => e.id === id);
  if (at < 0) return { chord: null, previous: [] };
  return { chord: events[at].chord, previous: events.slice(0, at).map((e) => e.chord) };
}

import type { ChordRef, Key } from '../theory/types';
import type { ChordEvent, Section, Song } from '../types';

export const DEFAULT_KEY: Key = { tonic: 'C', mode: 'major' };
export const DEFAULT_BEATS = 4;

export const newId = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export function newSection(name = 'Verse'): Section {
  return { id: newId(), name, events: [], repeat: 1 };
}

export function newSong(key: Key = DEFAULT_KEY): Song {
  const section = newSection('Verse');
  return {
    id: newId(),
    title: 'Untitled song',
    key,
    timeSig: { beats: 4, unit: 4 },
    bpm: 100,
    instrument: 'piano',
    pattern: 'block',
    sections: [section],
    arrangement: [section.id],
    updatedAt: Date.now(),
  };
}

export function newEvent(chord: ChordRef, beats = DEFAULT_BEATS): ChordEvent {
  return { id: newId(), chord, beats };
}

/** The song as one flat, ordered list of chord events, following the arrangement and repeats. */
export function flattenSong(song: Song): ChordEvent[] {
  const out: ChordEvent[] = [];
  for (const sectionId of song.arrangement) {
    const section = song.sections.find((s) => s.id === sectionId);
    if (!section) continue;
    for (let i = 0; i < Math.max(1, section.repeat); i++) out.push(...section.events);
  }
  return out;
}

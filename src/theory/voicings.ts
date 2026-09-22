import { chordStack, inversionOf } from './chords';
import { chroma } from './scales';
import type { ChordRef } from './types';

/** Lowest MIDI note of the upper voicing (C3), and of the bass register (C2). */
const UPPER_FLOOR = 48;
const BASS_FLOOR = 36;

/** Lowest MIDI note ≥ `floor` with the given pitch class. */
function atOrAbove(floor: number, pitchClass: number): number {
  return floor + ((pitchClass - floor) % 12 + 12) % 12;
}

/**
 * A simple piano voicing as MIDI numbers, lowest first: a bass note in the C2 octave, then the
 * chord in close position from C3 upward. The bass note of an inversion is respected (chord
 * tone `bass` is the lowest upper note and the bass register plays it too).
 */
export function pianoVoicing(chord: ChordRef): number[] {
  const stack = chordStack(chord);
  const inv = inversionOf(chord);
  const ordered = [...stack.slice(inv), ...stack.slice(0, inv)];

  const upper: number[] = [];
  let floor = UPPER_FLOOR;
  for (const note of ordered) {
    const midi = atOrAbove(floor, chroma(note));
    upper.push(midi);
    floor = midi + 1;
  }
  const bass = atOrAbove(BASS_FLOOR, chroma(ordered[0]));
  return [bass, ...upper];
}

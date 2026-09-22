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

/** The MIDI note with the given pitch class closest to `target`. */
function nearestTo(pitchClass: number, target: number): number {
  const pc = ((pitchClass % 12) + 12) % 12;
  let best = pc;
  let bestDist = Infinity;
  for (let octave = -1; octave <= 9; octave++) {
    const note = pc + octave * 12;
    const dist = Math.abs(note - target);
    if (dist < bestDist) {
      bestDist = dist;
      best = note;
    }
  }
  return best;
}

/** The chord's stack, starting from its inversion's bass tone (root position if not inverted). */
function orderedStack(chord: ChordRef): string[] {
  const stack = chordStack(chord);
  const inv = inversionOf(chord);
  return [...stack.slice(inv), ...stack.slice(0, inv)];
}

/**
 * A simple piano voicing as MIDI numbers, lowest first: a bass note in the C2 octave, then the
 * chord in close position from C3 upward. The bass note of an inversion is respected (chord
 * tone `bass` is the lowest upper note and the bass register plays it too).
 */
export function pianoVoicing(chord: ChordRef): number[] {
  const ordered = orderedStack(chord);
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

/**
 * Voice `chord` to move as little as possible from the chord before it (section 8.4). `prev` is
 * the previous call's return value, or null for the first chord in a song (falls back to
 * `pianoVoicing`'s close position). Each voice tracks its own position from the previous chord's
 * same slot, so a held common tone truly stays put; the chosen inversion's bass tone always stays
 * the lowest upper note, and the bass register doubles it below.
 */
export function voiceLeadChord(chord: ChordRef, prev: number[] | null): number[] {
  const ordered = orderedStack(chord);
  const pitchClasses = ordered.map((n) => chroma(n));

  if (!prev || prev.length < 2) return pianoVoicing(chord);

  const prevUpper = prev.slice(1);
  const raw = pitchClasses.map((pc, i) => nearestTo(pc, prevUpper[Math.min(i, prevUpper.length - 1)]));

  // Each voice tracks toward its previous position, but never below the bass tone (a voice
  // crossing there would muddy the chord); the rest stay ascending above it.
  const bassNote = raw[0];
  const rest = raw
    .slice(1)
    .map((n) => {
      while (n <= bassNote) n += 12;
      return n;
    })
    .sort((a, b) => a - b);

  const bass = atOrAbove(BASS_FLOOR, pitchClasses[0]);
  return [bass, bassNote, ...rest];
}

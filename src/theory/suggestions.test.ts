import { describe, expect, it } from 'vitest';
import { chordName, diatonicChord, diatonicChords, withFlavor } from './chords';
import { MODES } from './scales';
import { keyNote, startChords, suggestNext } from './suggestions';
import type { Key, Mode } from './types';

const key = (tonic: string, mode: Mode): Key => ({ tonic, mode });

/** For each diatonic chord: [top suggestion name, top suggestion numeral]. */
function tops(k: Key) {
  return diatonicChords(k).map((c) => {
    const top = suggestNext(c, k)[0];
    return [chordName(top.chord), top.chord.numeral];
  });
}

describe('top suggestions', () => {
  it('C major', () => {
    expect(tops(key('C', 'major'))).toEqual([
      ['F', 'IV'], // I
      ['G', 'V'], // ii
      ['Am', 'vi'], // iii
      ['G', 'V'], // IV
      ['C', 'I'], // V
      ['F', 'IV'], // vi
      ['C', 'I'], // vii°
    ]);
  });
  it('A minor (V is major, from harmonic minor)', () => {
    expect(tops(key('A', 'minor'))).toEqual([
      ['Dm', 'iv'], // i
      ['E', 'V'], // ii°
      ['F', '♭VI'], // ♭III
      ['E', 'V'], // iv
      ['Am', 'i'], // v
      ['G', '♭VII'], // ♭VI
      ['C', '♭III'], // ♭VII
    ]);
  });
  it('D Dorian: i ↔ IV is the signature', () => {
    expect(tops(key('D', 'dorian'))).toEqual([
      ['G', 'IV'], // i
      ['Dm', 'i'], // ii
      ['C', '♭VII'], // ♭III
      ['Dm', 'i'], // IV
      ['Dm', 'i'], // v
      ['C', '♭VII'], // vi°
      ['Dm', 'i'], // ♭VII
    ]);
  });
  it('F# major keeps correct spelling', () => {
    expect(tops(key('F#', 'major'))).toEqual([
      ['B', 'IV'],
      ['C♯', 'V'],
      ['D♯m', 'vi'],
      ['C♯', 'V'],
      ['F♯', 'I'],
      ['B', 'IV'],
      ['F♯', 'I'],
    ]);
  });
  it('Mixolydian: I goes to ♭VII or IV, and ♭VII goes to IV', () => {
    const k = key('C', 'mixolydian');
    const fromI = suggestNext(diatonicChord(k, 0), k).slice(0, 2).map((s) => s.chord.numeral);
    expect(fromI.sort()).toEqual(['IV', '♭VII']);
    expect(suggestNext(diatonicChord(k, 6), k)[0].chord.numeral).toBe('IV');
  });
  it('Phrygian: i ↔ ♭II', () => {
    const k = key('E', 'phrygian');
    expect(chordName(suggestNext(diatonicChord(k, 0), k)[0].chord)).toBe('F');
    expect(suggestNext(diatonicChord(k, 1), k)[0].chord.numeral).toBe('i');
  });
  it('Lydian: I ↔ II', () => {
    const k = key('F', 'lydian');
    expect(chordName(suggestNext(diatonicChord(k, 0), k)[0].chord)).toBe('G');
    expect(suggestNext(diatonicChord(k, 1), k)[0].chord.numeral).toBe('I');
  });
});

describe('specific rules', () => {
  const c = key('C', 'major');
  it('ii can go to I in second inversion (I⁶₄)', () => {
    const s = suggestNext(diatonicChord(c, 1), c).find((x) => x.chord.numeral === 'I⁶₄');
    expect(s && chordName(s.chord)).toBe('C/G');
  });
  it('V → vi is labelled as a fake-out', () => {
    const s = suggestNext(diatonicChord(c, 4), c).find((x) => x.chord.numeral === 'vi');
    expect(s?.reason).toContain('fake-out');
  });
  it('in minor, major V scores above natural v when heading home', () => {
    const k = key('A', 'minor');
    for (const from of [0, 1, 3, 5]) {
      const list = suggestNext(diatonicChord(k, from), k);
      const V = list.find((s) => s.chord.numeral === 'V');
      const v = list.find((s) => s.chord.numeral === 'v');
      expect(V, `V from degree ${from}`).toBeDefined();
      if (v) expect(V!.score).toBeGreaterThan(v.score);
    }
    const s = suggestNext(diatonicChord(k, 1), k)[0];
    expect(s.reason).toContain('harmonic minor');
    expect(s.origin).toBe('borrowed');
  });
  it('from the harmonic-minor V, i is the top suggestion', () => {
    const k = key('A', 'minor');
    const V = suggestNext(diatonicChord(k, 1), k)[0].chord;
    const next = suggestNext(V, k);
    expect(next[0].chord.numeral).toBe('i');
    expect(next[0].reason).toContain('V → i');
  });
  it('a sus chord suggests settling onto its triad, and otherwise matches the plain chord', () => {
    const g = diatonicChord(c, 4);
    const sus = withFlavor(g, 'sus4', c);
    const plain = suggestNext(g, c);
    const list = suggestNext(sus, c);
    expect(chordName(list[0].chord)).toBe('C'); // V → I still tops (1.0 vs 0.85 settle)
    expect(list.find((s) => chordName(s.chord) === 'G')?.reason).toContain('settles');
    const norm = (l: typeof plain) =>
      l.filter((s) => !s.reason.includes('settles') && !s.reason.startsWith('Repeat')).map((s) => chordName(s.chord));
    expect(norm(list).filter((n) => norm(plain).includes(n))).toEqual(
      norm(plain).filter((n) => norm(list).includes(n)),
    );
  });
  it('Locrian tonic targets mention instability, and the mode has a warning note', () => {
    const k = key('B', 'locrian');
    const toTonic = suggestNext(diatonicChord(k, 1), k).find((s) => s.chord.numeral === 'i°');
    expect(toTonic?.reason).toContain('unstable');
    expect(keyNote(k)).toContain('diminished');
    expect(keyNote(c)).toBeNull();
  });
});

describe('adjustments and shape', () => {
  it('repeating the current chord is offered only as a low sustain option', () => {
    const c = key('C', 'major');
    const cur = diatonicChord(c, 4);
    const list = suggestNext(cur, c);
    const rep = list.find((s) => s.reason.startsWith('Repeat'));
    expect(rep).toBeDefined();
    expect(rep!.score).toBeLessThanOrEqual(0.15);
    expect(list.filter((s) => chordName(s.chord) === chordName(cur))).toHaveLength(1);
  });
  it('breaks a repeated loop by boosting chords not in it', () => {
    const c = key('C', 'major');
    const [I, , , IV, V, vi] = diatonicChords(c);
    const loop = [I, V, vi, IV, I, V, vi];
    const plain = suggestNext(IV, c);
    const looped = suggestNext(IV, c, loop);
    const ii = (l: typeof plain) => l.find((s) => s.chord.numeral === 'ii')!;
    expect(ii(looped).score).toBeGreaterThan(ii(plain).score);
    expect(ii(looped).reason).toContain('Break the loop');
    expect(looped.find((s) => s.chord.numeral === 'V')!.score).toBe(plain.find((s) => s.chord.numeral === 'V')!.score);
  });
  it('is deterministic', () => {
    const c = key('C', 'major');
    const cur = diatonicChord(c, 5);
    expect(suggestNext(cur, c)).toEqual(suggestNext(cur, c));
  });
  it('the start ring is the seven diatonic chords, tonic first', () => {
    const ring = startChords(key('D', 'dorian'));
    expect(ring).toHaveLength(7);
    expect(chordName(ring[0])).toBe('Dm');
  });
});

describe('every key and chord', () => {
  const tonics = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
  it('gives 6–10 sorted, unique suggestions in 0–1 with short, non-empty reasons', () => {
    for (const t of tonics)
      for (const m of MODES) {
        const k = key(t, m);
        for (const cur of diatonicChords(k)) {
          const list = suggestNext(cur, k);
          const label = `${t} ${m} from ${cur.numeral}`;
          expect(list.length, label).toBeGreaterThanOrEqual(6);
          expect(list.length, label).toBeLessThanOrEqual(10);
          const ids = list.map((s) => `${s.chord.root}${s.chord.quality}${s.chord.bass ?? ''}`);
          expect(new Set(ids).size, label).toBe(ids.length);
          for (let i = 0; i < list.length; i++) {
            const s = list[i];
            expect(s.score, label).toBeGreaterThanOrEqual(0);
            expect(s.score, label).toBeLessThanOrEqual(1);
            expect(s.reason.length, `${label}: "${s.reason}"`).toBeLessThanOrEqual(60);
            expect(s.reason.length, label).toBeGreaterThan(0);
            expect(s.reason, label).not.toContain('{');
            if (i > 0) expect(s.score, label).toBeLessThanOrEqual(list[i - 1].score);
          }
        }
      }
  });
  it('every chord in every suggestion is spelled from its key (no stray enharmonics)', () => {
    for (const t of tonics)
      for (const m of MODES) {
        const k = key(t, m);
        for (const cur of diatonicChords(k))
          for (const s of suggestNext(cur, k)) {
            if (s.origin === 'diatonic') {
              const fromScale = diatonicChords(k).some((d) => d.root === s.chord.root);
              expect(fromScale, `${t} ${m}: ${chordName(s.chord)}`).toBe(true);
            }
          }
      }
  });
});

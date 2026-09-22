import { beforeEach, describe, expect, it } from 'vitest';
import { chordName, diatonicChord, diatonicChords, withInversion } from '../theory/chords';
import { pianoVoicing } from '../theory/voicings';
import { flattenSong, newSong } from './song';
import { selectCenter, useStore } from './store';

const c = { tonic: 'C', mode: 'major' } as const;

describe('pianoVoicing', () => {
  it('C major: bass C2 then C3 E3 G3', () => {
    expect(pianoVoicing(diatonicChord(c, 0))).toEqual([36, 48, 52, 55]);
  });
  it('respects inversions: C/E has E in the bass', () => {
    const v = pianoVoicing(withInversion(diatonicChord(c, 0), 1, c));
    expect(v).toEqual([40, 52, 55, 60]);
  });
  it('is ascending and stays in a sensible range for every chord in every key', () => {
    for (const tonic of ['C', 'Db', 'F#', 'B', 'Eb'])
      for (const chord of diatonicChords({ tonic, mode: 'major' }, '7')) {
        const v = pianoVoicing(chord);
        expect([...v].sort((a, b) => a - b)).toEqual(v);
        expect(v[0]).toBeGreaterThanOrEqual(36);
        expect(v[v.length - 1]).toBeLessThanOrEqual(72);
      }
  });
});

describe('song helpers', () => {
  it('flattenSong follows the arrangement and repeat counts', () => {
    const song = newSong();
    const [a, b] = diatonicChords(c);
    const sec = song.sections[0];
    sec.events = [
      { id: 'e1', chord: a, beats: 4 },
      { id: 'e2', chord: b, beats: 4 },
    ];
    sec.repeat = 2;
    expect(flattenSong(song).map((e) => e.id)).toEqual(['e1', 'e2', 'e1', 'e2']);
  });
});

describe('store', () => {
  beforeEach(() => {
    useStore.setState({ song: newSong(c), selectedEventId: null, playingEventId: null, isPlaying: false });
  });
  const chords = () => flattenSong(useStore.getState().song).map((e) => chordName(e.chord));
  const [I, ii, , IV, V] = diatonicChords(c);

  it('starts with no centre chord', () => {
    expect(selectCenter(useStore.getState()).chord).toBeNull();
  });
  it('adds chords in order and re-centres on the newest', () => {
    const { addChord } = useStore.getState();
    addChord(I);
    addChord(IV);
    addChord(V);
    expect(chords()).toEqual(['C', 'F', 'G']);
    expect(chordName(selectCenter(useStore.getState()).chord!)).toBe('G');
    expect(selectCenter(useStore.getState()).previous.map(chordName)).toEqual(['C', 'F']);
  });
  it('inserts after the selected slot', () => {
    const s = useStore.getState();
    s.addChord(I);
    s.addChord(V);
    const first = flattenSong(useStore.getState().song)[0].id;
    useStore.getState().selectEvent(first);
    useStore.getState().addChord(ii);
    expect(chords()).toEqual(['C', 'Dm', 'G']);
  });
  it('removing the selected chord selects a neighbour; removing the last clears selection', () => {
    const s = useStore.getState();
    s.addChord(I);
    s.addChord(V);
    const [first, second] = flattenSong(useStore.getState().song);
    useStore.getState().removeEvent(second.id);
    expect(useStore.getState().selectedEventId).toBe(first.id);
    useStore.getState().removeEvent(first.id);
    expect(useStore.getState().selectedEventId).toBeNull();
  });
  it('the map follows playback while playing', () => {
    const s = useStore.getState();
    s.addChord(I);
    s.addChord(V);
    const [first] = flattenSong(useStore.getState().song);
    useStore.setState({ isPlaying: true, playingEventId: first.id });
    expect(chordName(selectCenter(useStore.getState()).chord!)).toBe('C');
  });
  it('changing key can transpose or relabel existing chords', () => {
    const s = useStore.getState();
    s.addChord(I);
    s.addChord(V);
    useStore.getState().changeKey({ tonic: 'D', mode: 'major' }, 'transpose');
    expect(chords()).toEqual(['D', 'A']);
    expect(flattenSong(useStore.getState().song).map((e) => e.chord.numeral)).toEqual(['I', 'V']);
    useStore.getState().changeKey({ tonic: 'A', mode: 'major' }, 'relabel');
    expect(chords()).toEqual(['D', 'A']);
    expect(flattenSong(useStore.getState().song).map((e) => e.chord.numeral)).toEqual(['IV', 'I']);
  });
  it('clamps tempo to 30–300', () => {
    useStore.getState().setBpm(999);
    expect(useStore.getState().song.bpm).toBe(300);
    useStore.getState().setBpm(5);
    expect(useStore.getState().song.bpm).toBe(30);
  });
});

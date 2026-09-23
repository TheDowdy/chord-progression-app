import * as Tone from 'tone';
import type { InstrumentId } from '../types';

/** Piano samples (Salamander Grand, subset) live in public/samples so the app works offline. */
const SAMPLE_NOTES: Record<string, string> = {
  A1: 'A1.mp3', C2: 'C2.mp3', 'D#2': 'Ds2.mp3', 'F#2': 'Fs2.mp3',
  A2: 'A2.mp3', C3: 'C3.mp3', 'D#3': 'Ds3.mp3', 'F#3': 'Fs3.mp3',
  A3: 'A3.mp3', C4: 'C4.mp3', 'D#4': 'Ds4.mp3', 'F#4': 'Fs4.mp3',
  A4: 'A4.mp3', C5: 'C5.mp3', 'D#5': 'Ds5.mp3', 'F#5': 'Fs5.mp3',
  A5: 'A5.mp3', C6: 'C6.mp3',
};

/** One strike within the whole song: `midi` notes sounded together (or staggered by `strumSeconds`). */
export interface NoteStrike {
  /** The chord event this strike belongs to, so playback can highlight it. */
  eventId: string;
  /** Only the first strike of a chord fires the highlight callback. */
  isChordStart: boolean;
  offsetBeats: number;
  durationBeats: number;
  midi: number[];
  strumSeconds?: number;
}

export interface PlaybackOptions {
  bpm: number;
  loop: boolean;
  /** Loop bounds in beats from the song start; omit to loop the whole song. */
  loopStartBeats?: number;
  loopEndBeats?: number;
  instrument: InstrumentId;
  metronome: boolean;
  /** Bar length in beats, for the metronome's accented beat 1. */
  barBeats: number;
  /** 0–1. */
  volume: number;
  /** Called (in sync with the audio) when a chord starts; null when playback ends. */
  onEvent: (id: string | null) => void;
}

/**
 * Every instrument connects here instead of straight to the speakers: a shared gain trim (several
 * independent voices summing — a full chord, or several PluckSynth "strings" — can otherwise add
 * up past 0dBFS and hard-clip) followed by a limiter as a safety net for anything that still peaks.
 */
let masterBus: Tone.Gain | null = null;
function getBus(): Tone.Gain {
  if (!masterBus) {
    const limiter = new Tone.Limiter(-1).toDestination();
    masterBus = new Tone.Gain(0.7).connect(limiter);
  }
  return masterBus;
}

/** Guitar's lowest open string (E2); a plucked string modelled below this tends to buzz. */
const PLUCK_FLOOR = 40;

/** Raise `note` by octaves until it's at or above `PLUCK_FLOOR`, for the pluck voice only. */
function liftForPluck(note: string): string {
  let midi = Tone.Frequency(note).toMidi();
  while (midi < PLUCK_FLOOR) midi += 12;
  return Tone.Frequency(midi, 'midi').toNote();
}

/**
 * A small pool of individual `Tone.PluckSynth` voices (Karplus-Strong, one "string" each), since
 * PluckSynth isn't a `Monophonic` voice and so can't be wrapped in `Tone.PolySynth`. Notes are
 * assigned to strings round-robin; a pluck decays on its own, so there is no explicit release.
 * Its own gain is trimmed down further than other instruments: six strings ringing together are
 * louder than they look, since nothing here shapes them into a single chord envelope the way a
 * sampler or PolySynth voice does.
 */
class PluckVoice {
  private strings: Tone.PluckSynth[];
  private next = 0;

  constructor(count = 6) {
    const trim = new Tone.Gain(0.6).connect(getBus());
    this.strings = Array.from({ length: count }, () =>
      new Tone.PluckSynth({ attackNoise: 0.9, dampening: 4500, resonance: 0.97 }).connect(trim),
    );
  }

  triggerAttackRelease(notes: string | string[], _duration: Tone.Unit.Time, time?: Tone.Unit.Time): void {
    for (const note of Array.isArray(notes) ? notes : [notes]) {
      this.strings[this.next].triggerAttack(liftForPluck(note), time);
      this.next = (this.next + 1) % this.strings.length;
    }
  }

  /** No-op: a pluck can't be cut short, it just rings out. */
  releaseAll(): void {}
}

type Voice = Tone.Sampler | Tone.PolySynth | PluckVoice;

const voices = new Map<InstrumentId, Voice>();
let loadingPiano: Promise<void> | null = null;
let metronomeSynth: Tone.MembraneSynth | null = null;
let onEvent: PlaybackOptions['onEvent'] = () => {};

const noteNames = (midi: number[]) => midi.map((m) => Tone.Frequency(m, 'midi').toNote());

function makeFallbackPiano(): Tone.PolySynth {
  return new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.01, decay: 0.3, sustain: 0.3, release: 1 },
  }).connect(getBus());
}

function loadPiano(): Promise<void> {
  return new Promise((resolve) => {
    const fallBack = () => {
      voices.set('piano', makeFallbackPiano());
      resolve();
    };
    try {
      const sampler = new Tone.Sampler({
        urls: SAMPLE_NOTES,
        baseUrl: `${import.meta.env.BASE_URL}samples/salamander/`,
        release: 1.2,
        onload: () => {
          voices.set('piano', sampler);
          resolve();
        },
        onerror: fallBack,
      }).connect(getBus());
    } catch {
      fallBack();
    }
  });
}

function makeInstrument(id: InstrumentId): Voice {
  switch (id) {
    case 'epiano':
      return new Tone.PolySynth(Tone.FMSynth, {
        harmonicity: 3,
        modulationIndex: 6,
        envelope: { attack: 0.005, decay: 1.2, sustain: 0.15, release: 1.4 },
        modulationEnvelope: { attack: 0.01, decay: 0.4, sustain: 0.05, release: 0.8 },
      }).connect(getBus());
    case 'pad':
      return new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'sawtooth' },
        envelope: { attack: 0.8, decay: 0.6, sustain: 0.8, release: 2.2 },
      }).connect(getBus());
    case 'guitar':
      return new PluckVoice();
    case 'piano':
      return makeFallbackPiano(); // replaced once samples load
  }
}

/**
 * Start the audio context and load the instruments. Browsers only allow audio to start from a
 * user gesture, so call this synchronously from a tap/click handler.
 */
export function unlockAudio(): Promise<void> {
  const started = Tone.start();
  loadingPiano ??= loadPiano();
  if (!voices.has('piano')) voices.set('piano', makeFallbackPiano());
  for (const id of ['epiano', 'pad', 'guitar'] as InstrumentId[]) if (!voices.has(id)) voices.set(id, makeInstrument(id));
  return Promise.all([started, loadingPiano]).then(() => undefined);
}

function voiceFor(id: InstrumentId): Voice | null {
  return voices.get(id) ?? null;
}

/** Play a chord once on the given instrument, e.g. when the user taps a node. */
export async function previewChord(midi: number[], instrument: InstrumentId = 'piano', seconds = 1.6): Promise<void> {
  await unlockAudio();
  voiceFor(instrument)?.triggerAttackRelease(noteNames(midi), seconds, Tone.now());
}

function ensureMetronome(): Tone.MembraneSynth {
  metronomeSynth ??= new Tone.MembraneSynth({ pitchDecay: 0.008, envelope: { attack: 0.001, decay: 0.06, sustain: 0 } }).connect(getBus());
  return metronomeSynth;
}

function scheduleEvents(strikes: NoteStrike[], options: PlaybackOptions): number {
  const transport = Tone.getTransport();
  transport.cancel(0);
  const ppq = transport.PPQ;
  const voice = voiceFor(options.instrument);
  const beatTicks = (beats: number) => Math.round(beats * ppq);

  let totalBeats = 0;
  for (const s of strikes) totalBeats = Math.max(totalBeats, s.offsetBeats + s.durationBeats);

  for (const strike of strikes) {
    const startTick = beatTicks(strike.offsetBeats);
    const durTicks = beatTicks(strike.durationBeats);
    const names = noteNames(strike.midi);
    transport.schedule((time) => {
      const seconds = Tone.Ticks(durTicks).toSeconds();
      if (strike.strumSeconds && names.length > 1) {
        names.forEach((n, i) => voice?.triggerAttackRelease(n, seconds * 0.97, time + i * (strike.strumSeconds ?? 0)));
      } else {
        voice?.triggerAttackRelease(names, seconds * 0.97, time);
      }
      if (strike.isChordStart) Tone.getDraw().schedule(() => onEvent(strike.eventId), time);
    }, `${startTick}i`);
  }

  if (options.metronome) {
    const click = ensureMetronome();
    for (let b = 0; b < Math.ceil(totalBeats); b++) {
      const tick = beatTicks(b);
      const accent = b % Math.max(1, options.barBeats) === 0;
      transport.schedule((time) => {
        click.triggerAttackRelease(accent ? 'C3' : 'C2', 0.03, time, accent ? 0.9 : 0.5);
      }, `${tick}i`);
    }
  }

  return totalBeats;
}

export async function startPlayback(strikes: NoteStrike[], options: PlaybackOptions): Promise<void> {
  await unlockAudio();
  const transport = Tone.getTransport();
  transport.stop();
  onEvent = options.onEvent;
  Tone.getDestination().volume.value = options.volume <= 0 ? -Infinity : Tone.gainToDb(options.volume);
  transport.bpm.value = options.bpm;
  transport.timeSignature = options.barBeats;
  const totalBeats = scheduleEvents(strikes, options);
  const ppq = transport.PPQ;
  const loopStart = options.loopStartBeats ?? 0;
  const loopEnd = options.loopEndBeats ?? totalBeats;
  transport.loop = options.loop;
  transport.loopStart = `${Math.round(loopStart * ppq)}i`;
  transport.loopEnd = `${Math.round(loopEnd * ppq)}i`;
  if (!options.loop) {
    transport.schedule((time) => {
      Tone.getDraw().schedule(() => stopPlayback(), time);
    }, `${Math.round(totalBeats * ppq)}i`);
  }
  transport.start('+0.05', options.loop ? `${Math.round(loopStart * ppq)}i` : 0);
}

/** Change what is playing without stopping (edits, tempo, loop, instrument). Timing stays on the transport. */
export function updatePlayback(strikes: NoteStrike[], options: PlaybackOptions): void {
  const transport = Tone.getTransport();
  if (transport.state !== 'started') return;
  if (strikes.length === 0) {
    stopPlayback();
    return;
  }
  Tone.getDestination().volume.value = options.volume <= 0 ? -Infinity : Tone.gainToDb(options.volume);
  transport.bpm.value = options.bpm;
  transport.timeSignature = options.barBeats;
  const totalBeats = scheduleEvents(strikes, options);
  const ppq = transport.PPQ;
  const loopStart = options.loopStartBeats ?? 0;
  const loopEnd = options.loopEndBeats ?? totalBeats;
  transport.loop = options.loop;
  transport.loopStart = `${Math.round(loopStart * ppq)}i`;
  transport.loopEnd = `${Math.round(loopEnd * ppq)}i`;
}

export function stopPlayback(): void {
  const transport = Tone.getTransport();
  transport.stop();
  transport.cancel(0);
  for (const voice of voices.values()) voice.releaseAll();
  onEvent(null);
}

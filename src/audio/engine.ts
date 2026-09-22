import * as Tone from 'tone';

/** Piano samples (Salamander Grand, subset) live in public/samples so the app works offline. */
const SAMPLE_NOTES: Record<string, string> = {
  A1: 'A1.mp3', C2: 'C2.mp3', 'D#2': 'Ds2.mp3', 'F#2': 'Fs2.mp3',
  A2: 'A2.mp3', C3: 'C3.mp3', 'D#3': 'Ds3.mp3', 'F#3': 'Fs3.mp3',
  A3: 'A3.mp3', C4: 'C4.mp3', 'D#4': 'Ds4.mp3', 'F#4': 'Fs4.mp3',
  A4: 'A4.mp3', C5: 'C5.mp3', 'D#5': 'Ds5.mp3', 'F#5': 'Fs5.mp3',
  A5: 'A5.mp3', C6: 'C6.mp3',
};

/** A chord as heard: MIDI notes (all sounded together for now) held for `beats`. */
export interface PlayEvent {
  id: string;
  midi: number[];
  beats: number;
}

export interface PlaybackOptions {
  bpm: number;
  loop: boolean;
  /** Called (in sync with the audio) when a chord starts; null when playback ends. */
  onEvent: (id: string | null) => void;
}

type Voice = Tone.Sampler | Tone.PolySynth;

let voice: Voice | null = null;
let loading: Promise<void> | null = null;
let onEvent: PlaybackOptions['onEvent'] = () => {};

const noteNames = (midi: number[]) => midi.map((m) => Tone.Frequency(m, 'midi').toNote());

function makeFallbackSynth(): Tone.PolySynth {
  return new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.01, decay: 0.3, sustain: 0.3, release: 1 },
  }).toDestination();
}

function loadInstruments(): Promise<void> {
  return new Promise((resolve) => {
    const fallBack = () => {
      voice = makeFallbackSynth();
      resolve();
    };
    try {
      const sampler = new Tone.Sampler({
        urls: SAMPLE_NOTES,
        baseUrl: `${import.meta.env.BASE_URL}samples/salamander/`,
        release: 1.2,
        onload: () => {
          voice = sampler;
          resolve();
        },
        onerror: fallBack,
      }).toDestination();
    } catch {
      fallBack();
    }
  });
}

/**
 * Start the audio context and load the instruments. Browsers only allow audio to start from a
 * user gesture, so call this synchronously from a tap/click handler.
 */
export function unlockAudio(): Promise<void> {
  const started = Tone.start();
  loading ??= loadInstruments();
  return Promise.all([started, loading]).then(() => undefined);
}

/** Play a chord once, e.g. when the user taps a node. */
export async function previewChord(midi: number[], seconds = 1.6): Promise<void> {
  await unlockAudio();
  voice?.triggerAttackRelease(noteNames(midi), seconds, Tone.now());
}

function scheduleEvents(events: PlayEvent[], loop: boolean): void {
  const transport = Tone.getTransport();
  transport.cancel(0);
  const ppq = transport.PPQ;
  let tick = 0;
  for (const event of events) {
    const startTick = tick;
    const durTicks = Math.round(event.beats * ppq);
    const names = noteNames(event.midi);
    transport.schedule((time) => {
      const seconds = Tone.Ticks(durTicks).toSeconds();
      voice?.triggerAttackRelease(names, seconds * 0.97, time);
      Tone.getDraw().schedule(() => onEvent(event.id), time);
    }, `${startTick}i`);
    tick += durTicks;
  }
  transport.loop = loop;
  transport.loopStart = 0;
  transport.loopEnd = `${tick}i`;
  if (!loop) {
    transport.schedule((time) => {
      Tone.getDraw().schedule(() => stopPlayback(), time);
    }, `${tick}i`);
  }
}

export async function startPlayback(events: PlayEvent[], options: PlaybackOptions): Promise<void> {
  await unlockAudio();
  const transport = Tone.getTransport();
  transport.stop();
  onEvent = options.onEvent;
  transport.timeSignature = 4;
  transport.bpm.value = options.bpm;
  scheduleEvents(events, options.loop);
  transport.start('+0.05');
}

/** Change what is playing without stopping (edits, tempo, loop). Timing stays on the transport. */
export function updatePlayback(events: PlayEvent[], bpm: number, loop: boolean): void {
  const transport = Tone.getTransport();
  if (transport.state !== 'started') return;
  if (events.length === 0) {
    stopPlayback();
    return;
  }
  transport.bpm.value = bpm;
  scheduleEvents(events, loop);
}

export function stopPlayback(): void {
  const transport = Tone.getTransport();
  transport.stop();
  transport.cancel(0);
  voice?.releaseAll();
  onEvent(null);
}

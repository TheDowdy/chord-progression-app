import { useMemo } from 'react';
import KeyPicker from './components/KeyPicker';
import NodeMap from './components/NodeMap';
import Timeline from './components/Timeline';
import TransportBar from './components/TransportBar';
import { previewChord } from './audio/engine';
import { useLivePlaybackSync } from './state/playback';
import { selectCenter, useStore } from './state/store';
import { startChords, suggestNext } from './theory/suggestions';
import type { ChordRef } from './theory/types';
import { pianoVoicing } from './theory/voicings';

export default function App() {
  useLivePlaybackSync();

  const song = useStore((s) => s.song);
  const selectedEventId = useStore((s) => s.selectedEventId);
  const playingEventId = useStore((s) => s.playingEventId);
  const isPlaying = useStore((s) => s.isPlaying);
  const addChord = useStore((s) => s.addChord);

  const { chord: center, previous } = useMemo(
    () => selectCenter({ song, selectedEventId, playingEventId, isPlaying }),
    [song, selectedEventId, playingEventId, isPlaying],
  );
  const suggestions = useMemo(() => (center ? suggestNext(center, song.key, previous) : []), [center, previous, song.key]);
  const startRing = useMemo(() => startChords(song.key), [song.key]);

  const preview = (chord: ChordRef) => void previewChord(pianoVoicing(chord), song.instrument);

  return (
    <div className="min-h-dvh pb-44 lg:pb-10">
      <div className="mx-auto max-w-3xl space-y-4 px-4 pt-5">
        <header>
          <h1 className="text-2xl font-bold tracking-tight">Chord Builder</h1>
          <p className="text-sm text-muted">Pick a key, pick a chord, and see where you could go next.</p>
        </header>
        <KeyPicker />
        <TransportBar />
        <NodeMap
          musicKey={song.key}
          center={center}
          suggestions={suggestions}
          startRing={startRing}
          onPreview={preview}
          onAdd={addChord}
        />
        <Timeline />
      </div>
    </div>
  );
}

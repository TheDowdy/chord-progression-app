import { BPM_MAX, BPM_MIN, useStore } from '../state/store';
import { togglePlay } from '../state/playback';
import { flattenSong } from '../state/song';

export default function TransportBar() {
  const bpm = useStore((s) => s.song.bpm);
  const timeSig = useStore((s) => s.song.timeSig);
  const loop = useStore((s) => s.loop);
  const isPlaying = useStore((s) => s.isPlaying);
  const hasChords = useStore((s) => flattenSong(s.song).length > 0);
  const setBpm = useStore((s) => s.setBpm);
  const setLoop = useStore((s) => s.setLoop);

  return (
    <div
      role="toolbar"
      aria-label="Playback"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur lg:static lg:rounded-2xl lg:border lg:pb-3"
    >
      <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-x-4 gap-y-2 lg:max-w-none">
        <button
          onClick={togglePlay}
          disabled={!hasChords}
          aria-label={isPlaying ? 'Stop' : 'Play'}
          className="h-12 min-w-24 rounded-xl bg-accent px-5 text-base font-semibold text-accent-fg disabled:opacity-40"
        >
          {isPlaying ? '■ Stop' : '▶ Play'}
        </button>

        <button
          onClick={() => setLoop(!loop)}
          aria-pressed={loop}
          className={`h-12 rounded-xl border px-4 text-sm font-medium ${loop ? 'border-accent bg-surface-2 text-accent' : 'border-line text-muted'}`}
        >
          ⟳ Loop {loop ? 'on' : 'off'}
        </button>

        <div className="flex min-w-[12rem] flex-1 items-center gap-2">
          <label htmlFor="bpm" className="text-sm text-muted">
            Tempo
          </label>
          <input
            id="bpm-slider"
            aria-label="Tempo slider"
            type="range"
            min={BPM_MIN}
            max={BPM_MAX}
            value={bpm}
            onChange={(e) => setBpm(Number(e.target.value))}
            className="h-8 min-w-0 flex-1 accent-[var(--accent)]"
          />
          <input
            id="bpm"
            type="number"
            inputMode="numeric"
            min={BPM_MIN}
            max={BPM_MAX}
            value={bpm}
            onChange={(e) => setBpm(Number(e.target.value))}
            className="h-10 w-16 rounded-lg border border-line bg-surface px-2 text-center"
          />
          <span className="text-sm text-muted">BPM</span>
        </div>

        <span className="text-sm text-muted" title="Custom time signatures arrive in phase 2">
          {timeSig.beats}/{timeSig.unit}
        </span>
      </div>
    </div>
  );
}

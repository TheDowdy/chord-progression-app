import { useEffect, useRef } from 'react';
import { chordName } from '../theory/chords';
import { pianoVoicing } from '../theory/voicings';
import { previewChord } from '../audio/engine';
import { useStore } from '../state/store';

const ORIGIN_COLOR = {
  diatonic: 'var(--c-diatonic)',
  borrowed: 'var(--c-borrowed)',
  secondary: 'var(--c-secondary)',
};

export default function Timeline() {
  const song = useStore((s) => s.song);
  const selectedId = useStore((s) => s.selectedEventId);
  const playingId = useStore((s) => s.playingEventId);
  const isPlaying = useStore((s) => s.isPlaying);
  const selectEvent = useStore((s) => s.selectEvent);
  const removeEvent = useStore((s) => s.removeEvent);
  const clearSection = useStore((s) => s.clearSection);

  const section = song.sections[0];
  const activeId = isPlaying && playingId ? playingId : selectedId;
  const refs = useRef(new Map<string, HTMLElement>());

  // Keep the active chord in view as it changes or plays.
  useEffect(() => {
    if (activeId) refs.current.get(activeId)?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }, [activeId]);

  return (
    <section aria-label="Timeline" className="rounded-2xl border border-line bg-surface p-3">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-semibold">
          {section.name} <span className="text-sm font-normal text-muted">· {song.timeSig.beats}/{song.timeSig.unit}</span>
        </h2>
        {section.events.length > 0 && (
          <button onClick={clearSection} className="rounded-md px-2 py-1 text-sm text-muted hover:bg-surface-2">
            Clear
          </button>
        )}
      </div>

      {section.events.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line px-3 py-6 text-center text-sm text-muted">
          Your progression will appear here. Add chords from the map above.
        </p>
      ) : (
        <ol className="flex snap-x gap-2 overflow-x-auto pb-2">
          {section.events.map((event, i) => {
            const active = event.id === activeId;
            const playing = isPlaying && event.id === playingId;
            return (
              <li
                key={event.id}
                ref={(el) => {
                  if (el) refs.current.set(event.id, el);
                  else refs.current.delete(event.id);
                }}
                className="snap-start"
              >
                <div
                  className={`relative flex h-24 w-28 shrink-0 flex-col items-center justify-center rounded-xl border-2 text-center transition-colors ${
                    playing ? 'bg-accent text-accent-fg' : 'bg-surface-2'
                  }`}
                  style={{ borderColor: active ? 'var(--accent)' : ORIGIN_COLOR[event.chord.origin] }}
                >
                  <button
                    onClick={() => {
                      selectEvent(event.id);
                      if (!isPlaying) void previewChord(pianoVoicing(event.chord));
                    }}
                    aria-pressed={active}
                    aria-label={`Chord ${i + 1}: ${chordName(event.chord)}, ${event.chord.numeral}`}
                    className="absolute inset-0 rounded-xl"
                  />
                  <span className="pointer-events-none text-lg font-bold leading-tight">{chordName(event.chord)}</span>
                  <span className={`pointer-events-none text-sm ${playing ? '' : 'text-muted'}`}>{event.chord.numeral}</span>
                  <span className={`pointer-events-none mt-1 text-[11px] ${playing ? '' : 'text-muted'}`}>bar {i + 1} · {event.beats} beats</span>
                  <button
                    onClick={() => removeEvent(event.id)}
                    aria-label={`Remove ${chordName(event.chord)}`}
                    className="absolute right-0.5 top-0.5 grid size-8 place-items-center rounded-full text-lg leading-none opacity-70 hover:opacity-100"
                  >
                    ×
                  </button>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

import { useState } from 'react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { chordName } from '../theory/chords';
import { pianoVoicing } from '../theory/voicings';
import { previewChord } from '../audio/engine';
import { useStore } from '../state/store';
import type { ChordEvent, Section } from '../types';
import ChordDetail from './ChordDetail';
import FlavorPicker from './FlavorPicker';

const ORIGIN_COLOR = {
  diatonic: 'var(--c-diatonic)',
  borrowed: 'var(--c-borrowed)',
  secondary: 'var(--c-secondary)',
};

const QUICK_ADD = ['Verse', 'Chorus', 'Bridge'];

function ChordSlot({
  event,
  sectionId,
  barLength,
  cumulativeBeats,
  active,
  playing,
  editingFlavor,
  editingDetail,
  replacing,
  onOpenFlavor,
  onOpenDetail,
}: {
  event: ChordEvent;
  sectionId: string;
  barLength: number;
  cumulativeBeats: number;
  active: boolean;
  playing: boolean;
  editingFlavor: boolean;
  editingDetail: boolean;
  replacing: boolean;
  onOpenFlavor: (id: string | null) => void;
  onOpenDetail: (id: string | null) => void;
}) {
  const isPlaying = useStore((s) => s.isPlaying);
  const instrument = useStore((s) => s.song.instrument);
  const selectEvent = useStore((s) => s.selectEvent);
  const removeEvent = useStore((s) => s.removeEvent);
  const adjustEventBeats = useStore((s) => s.adjustEventBeats);
  const startReplace = useStore((s) => s.startReplace);
  const cancelReplace = useStore((s) => s.cancelReplace);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: event.id,
    data: { sectionId },
  });
  const isBarStart = cumulativeBeats % barLength === 0;

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      className={`snap-start shrink-0 ${isBarStart ? 'border-l-2 border-line pl-2' : ''}`}
    >
      <div
        className={`relative flex h-24 w-28 shrink-0 flex-col items-center justify-center rounded-xl border-2 text-center transition-colors ${
          playing ? 'bg-accent text-accent-fg' : 'bg-surface-2'
        } ${replacing ? 'ring-2 ring-offset-1 ring-[var(--accent)]' : ''}`}
        style={{ borderColor: active ? 'var(--accent)' : ORIGIN_COLOR[event.chord.origin] }}
        {...attributes}
        {...listeners}
      >
        <button
          onClick={() => {
            selectEvent(event.id);
            if (!isPlaying) void previewChord(pianoVoicing(event.chord), instrument);
          }}
          aria-pressed={active}
          aria-label={`Chord: ${chordName(event.chord)}, ${event.chord.numeral}`}
          className="absolute inset-0 rounded-xl"
        />
        <span className="pointer-events-none text-lg font-bold leading-tight">{chordName(event.chord)}</span>
        <span className={`pointer-events-none text-sm ${playing ? '' : 'text-muted'}`}>{event.chord.numeral}</span>

        <div className="pointer-events-auto mt-1 flex items-center gap-1">
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              adjustEventBeats(event.id, -1);
            }}
            aria-label="Fewer beats"
            className="grid size-7 place-items-center rounded-full text-sm leading-none opacity-70 hover:bg-surface hover:opacity-100"
          >
            –
          </button>
          <span className={`pointer-events-none text-[11px] ${playing ? '' : 'text-muted'}`}>{event.beats} beats</span>
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              adjustEventBeats(event.id, 1);
            }}
            aria-label="More beats"
            className="grid size-7 place-items-center rounded-full text-sm leading-none opacity-70 hover:bg-surface hover:opacity-100"
          >
            +
          </button>
        </div>

        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onOpenFlavor(editingFlavor ? null : event.id);
          }}
          aria-label={`Change flavor of ${chordName(event.chord)}`}
          aria-pressed={editingFlavor}
          className="absolute left-0.5 top-0.5 grid size-6 place-items-center rounded-full text-xs leading-none opacity-70 hover:opacity-100"
        >
          ⚙
        </button>
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onOpenDetail(editingDetail ? null : event.id);
          }}
          aria-label={`Expand ${chordName(event.chord)}: piano or guitar`}
          aria-pressed={editingDetail}
          className="absolute left-7 top-0.5 grid size-6 place-items-center rounded-full text-xs leading-none opacity-70 hover:opacity-100"
        >
          ⛶
        </button>
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            replacing ? cancelReplace() : startReplace(event.id);
          }}
          aria-label={replacing ? 'Cancel replace' : `Replace ${chordName(event.chord)}`}
          aria-pressed={replacing}
          className="absolute right-7 top-0.5 grid size-6 place-items-center rounded-full text-xs leading-none opacity-70 hover:opacity-100"
        >
          ⇄
        </button>
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            removeEvent(event.id);
          }}
          aria-label={`Remove ${chordName(event.chord)}`}
          className="absolute right-0.5 top-0.5 grid size-6 place-items-center rounded-full text-base leading-none opacity-70 hover:opacity-100"
        >
          ×
        </button>
      </div>
    </li>
  );
}

function EmptyDropZone({ sectionId }: { sectionId: string }) {
  const { setNodeRef, isOver } = useDroppable({ id: `empty:${sectionId}`, data: { sectionId } });
  return (
    <p
      ref={setNodeRef}
      className={`rounded-xl border border-dashed px-3 py-6 text-center text-sm text-muted ${isOver ? 'border-accent bg-surface-2' : 'border-line'}`}
    >
      Add chords from the map above, or drag one here.
    </p>
  );
}

function SectionBlock({ section, isOnly, index, total }: { section: Section; isOnly: boolean; index: number; total: number }) {
  const song = useStore((s) => s.song);
  const selectedId = useStore((s) => s.selectedEventId);
  const playingId = useStore((s) => s.playingEventId);
  const isPlaying = useStore((s) => s.isPlaying);
  const activeSectionId = useStore((s) => s.activeSectionId);
  const replaceTargetId = useStore((s) => s.replaceTargetId);
  const renameSection = useStore((s) => s.renameSection);
  const duplicateSection = useStore((s) => s.duplicateSection);
  const removeSection = useStore((s) => s.removeSection);
  const setSectionRepeat = useStore((s) => s.setSectionRepeat);
  const clearSection = useStore((s) => s.clearSection);
  const setActiveSection = useStore((s) => s.setActiveSection);
  const reorderSections = useStore((s) => s.reorderSections);
  const [flavorId, setFlavorId] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  const activeId = isPlaying && playingId ? playingId : selectedId;
  const barLength = song.timeSig.beats;
  let cumulative = 0;
  const withOffsets = section.events.map((event) => {
    const offset = cumulative;
    cumulative += event.beats;
    return { event, offset };
  });
  const flavorEvent = section.events.find((e) => e.id === flavorId);
  const detailEvent = section.events.find((e) => e.id === detailId);

  return (
    <section
      aria-label={`Section: ${section.name}`}
      onClick={() => setActiveSection(section.id)}
      className={`rounded-2xl border p-3 ${section.id === activeSectionId ? 'border-accent bg-surface' : 'border-line bg-surface'}`}
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <input
            value={section.name}
            onChange={(e) => renameSection(section.id, e.target.value)}
            aria-label="Section name"
            className="w-28 rounded-md border border-transparent bg-transparent px-1 font-semibold hover:border-line focus:border-line"
          />
          <div className="flex items-center gap-1 text-sm text-muted">
            <button
              onClick={() => setSectionRepeat(section.id, section.repeat - 1)}
              aria-label="Fewer repeats"
              className="grid size-6 place-items-center rounded-full hover:bg-surface-2"
            >
              –
            </button>
            <span aria-label="Repeat count">×{section.repeat}</span>
            <button
              onClick={() => setSectionRepeat(section.id, section.repeat + 1)}
              aria-label="More repeats"
              className="grid size-6 place-items-center rounded-full hover:bg-surface-2"
            >
              +
            </button>
          </div>
        </div>
        <div className="flex items-center gap-1 text-sm text-muted">
          <button
            onClick={() => reorderSections(index, index - 1)}
            disabled={index === 0}
            aria-label={`Move ${section.name} earlier`}
            className="grid size-7 place-items-center rounded-full hover:bg-surface-2 disabled:opacity-30"
          >
            ▲
          </button>
          <button
            onClick={() => reorderSections(index, index + 1)}
            disabled={index === total - 1}
            aria-label={`Move ${section.name} later`}
            className="grid size-7 place-items-center rounded-full hover:bg-surface-2 disabled:opacity-30"
          >
            ▼
          </button>
          <button onClick={() => duplicateSection(section.id)} className="rounded-md px-2 py-1 hover:bg-surface-2">
            Duplicate
          </button>
          {section.events.length > 0 && (
            <button onClick={() => clearSection(section.id)} className="rounded-md px-2 py-1 hover:bg-surface-2">
              Clear
            </button>
          )}
          {!isOnly && (
            <button onClick={() => removeSection(section.id)} aria-label={`Delete ${section.name}`} className="rounded-md px-2 py-1 hover:bg-surface-2">
              Delete
            </button>
          )}
        </div>
      </div>

      {section.events.length === 0 ? (
        <EmptyDropZone sectionId={section.id} />
      ) : (
        <SortableContext items={section.events.map((e) => e.id)} strategy={horizontalListSortingStrategy}>
          <ol className="flex snap-x gap-2 overflow-x-auto pb-2">
            {withOffsets.map(({ event, offset }) => (
              <ChordSlot
                key={event.id}
                event={event}
                sectionId={section.id}
                barLength={barLength}
                cumulativeBeats={offset}
                active={event.id === activeId}
                playing={isPlaying && event.id === playingId}
                editingFlavor={event.id === flavorId}
                editingDetail={event.id === detailId}
                replacing={event.id === replaceTargetId}
                onOpenFlavor={(id) => {
                  setDetailId(null);
                  setFlavorId(id);
                }}
                onOpenDetail={(id) => {
                  setFlavorId(null);
                  setDetailId(id);
                }}
              />
            ))}
          </ol>
        </SortableContext>
      )}

      {flavorEvent && (
        <div className="mt-2">
          <FlavorPicker
            chord={flavorEvent.chord}
            musicKey={song.key}
            onPreview={(c) => void previewChord(pianoVoicing(c), song.instrument)}
            onChoose={(c) => useStore.getState().setEventChord(flavorEvent.id, c)}
            onClose={() => setFlavorId(null)}
          />
        </div>
      )}
      {detailEvent && (
        <div className="mt-2">
          <ChordDetail chord={detailEvent.chord} onClose={() => setDetailId(null)} />
        </div>
      )}
    </section>
  );
}

function ArrangementRow() {
  const arrangement = useStore((s) => s.song.arrangement);
  const sections = useStore((s) => s.song.sections);
  const activeSectionId = useStore((s) => s.activeSectionId);
  const addArrangementSlot = useStore((s) => s.addArrangementSlot);
  const removeArrangementSlot = useStore((s) => s.removeArrangementSlot);
  const reorderArrangement = useStore((s) => s.reorderArrangement);
  const setActiveSection = useStore((s) => s.setActiveSection);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor));
  const ids = arrangement.map((sectionId, i) => `${sectionId}#${i}`);

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    reorderArrangement(from, to);
  };

  const nameFor = (id: string) => sections.find((s) => s.id === id)?.name ?? '?';

  return (
    <section aria-label="Arrangement" className="rounded-2xl border border-line bg-surface p-3">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Arrangement</h2>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={ids} strategy={horizontalListSortingStrategy}>
          <ol className="flex flex-wrap items-center gap-1.5">
            {arrangement.map((sectionId, i) => (
              <ArrangementChip key={ids[i]} id={ids[i]} name={nameFor(sectionId)} onRemove={() => removeArrangementSlot(i)} />
            ))}
          </ol>
        </SortableContext>
      </DndContext>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {sections.map((s) => (
          <button
            key={s.id}
            onClick={() => {
              addArrangementSlot(s.id);
              setActiveSection(s.id);
            }}
            className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
              s.id === activeSectionId ? 'border-accent text-accent' : 'border-line text-muted hover:bg-surface-2'
            }`}
          >
            + {s.name}
          </button>
        ))}
      </div>
    </section>
  );
}

function ArrangementChip({ id, name, onRemove }: { id: string; name: string; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      {...attributes}
      {...listeners}
      className="flex items-center gap-1 rounded-full border border-line bg-surface-2 py-1 pl-3 pr-1 text-sm"
    >
      {name}
      <button
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        aria-label={`Remove ${name} from arrangement`}
        className="grid size-6 place-items-center rounded-full text-sm opacity-70 hover:opacity-100"
      >
        ×
      </button>
    </li>
  );
}

export default function Timeline() {
  const song = useStore((s) => s.song);
  const addSection = useStore((s) => s.addSection);
  const reorderEvents = useStore((s) => s.reorderEvents);
  const moveEvent = useStore((s) => s.moveEvent);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  const sectionOf = (eventId: string) => song.sections.find((sec) => sec.events.some((e) => e.id === eventId));

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over) return;
    const fromSection = active.data.current?.sectionId as string | undefined;
    const toSection = (over.data.current?.sectionId as string | undefined) ?? sectionOf(String(over.id))?.id;
    if (!fromSection || !toSection) return;
    const toEvents = song.sections.find((s) => s.id === toSection)?.events ?? [];
    const overIndex = toEvents.findIndex((e) => e.id === over.id);
    const toIndex = overIndex >= 0 ? overIndex : toEvents.length;

    if (fromSection === toSection) {
      const events = song.sections.find((s) => s.id === fromSection)!.events;
      const fromIndex = events.findIndex((e) => e.id === active.id);
      if (fromIndex >= 0 && fromIndex !== toIndex) reorderEvents(fromSection, fromIndex, toIndex);
    } else {
      moveEvent(String(active.id), toSection, toIndex);
    }
  };

  return (
    <div className="space-y-3">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <div className="space-y-3">
          {song.sections.map((section, i) => (
            <SectionBlock key={section.id} section={section} isOnly={song.sections.length === 1} index={i} total={song.sections.length} />
          ))}
        </div>
      </DndContext>

      <div className="flex flex-wrap gap-1.5">
        {QUICK_ADD.map((name) => (
          <button key={name} onClick={() => addSection(name)} className="rounded-lg border border-line bg-surface px-3 py-1.5 text-sm font-medium hover:bg-surface-2">
            + {name}
          </button>
        ))}
        <button onClick={() => addSection('Custom')} className="rounded-lg border border-line bg-surface px-3 py-1.5 text-sm font-medium hover:bg-surface-2">
          + Custom section
        </button>
      </div>

      <ArrangementRow />
    </div>
  );
}

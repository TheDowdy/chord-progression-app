import { useRef, useState } from 'react';
import { downloadMidi } from '../export/midi';
import { downloadSongJson, parseSongJson } from '../export/json';
import {
  deleteSongFromStorage,
  getSongFromStorage,
  listSongs,
  saveSongToStorage,
  type SongMeta,
} from '../state/persistence';
import { flattenSong, newId } from '../state/song';
import { useStore } from '../state/store';

function formatDate(ms: number): string {
  return new Date(ms).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function SavedRow({ meta, currentId, onChanged }: { meta: SongMeta; currentId: string; onChanged: () => void }) {
  const loadSong = useStore((s) => s.loadSong);
  const [renaming, setRenaming] = useState(false);
  const [draftTitle, setDraftTitle] = useState(meta.title);

  const open = () => {
    const song = getSongFromStorage(meta.id);
    if (song) loadSong(song);
  };

  const commitRename = () => {
    const song = getSongFromStorage(meta.id);
    if (song) saveSongToStorage({ ...song, title: draftTitle.trim() || song.title, updatedAt: Date.now() });
    setRenaming(false);
    onChanged();
  };

  const duplicate = () => {
    const song = getSongFromStorage(meta.id);
    if (song) saveSongToStorage({ ...song, id: newId(), title: `${song.title} copy`, updatedAt: Date.now() });
    onChanged();
  };

  const remove = () => {
    if (!confirm(`Delete "${meta.title}"? This can't be undone.`)) return;
    deleteSongFromStorage(meta.id);
    onChanged();
  };

  return (
    <li className="flex items-center gap-2 rounded-lg border border-line px-2.5 py-2 text-sm">
      {renaming ? (
        <input
          autoFocus
          value={draftTitle}
          onChange={(e) => setDraftTitle(e.target.value)}
          onBlur={commitRename}
          onKeyDown={(e) => e.key === 'Enter' && commitRename()}
          aria-label="Song title"
          className="h-8 min-w-0 flex-1 rounded-md border border-line bg-surface px-2"
        />
      ) : (
        <div className="min-w-0 flex-1">
          <p className={`truncate font-medium ${meta.id === currentId ? 'text-accent' : ''}`}>{meta.title || 'Untitled song'}</p>
          <p className="text-xs text-muted">{formatDate(meta.updatedAt)}</p>
        </div>
      )}
      <div className="flex shrink-0 items-center gap-1 text-xs">
        <button onClick={open} className="rounded-md px-2 py-1 hover:bg-surface-2">
          Open
        </button>
        <button onClick={() => setRenaming((v) => !v)} className="rounded-md px-2 py-1 hover:bg-surface-2">
          Rename
        </button>
        <button onClick={duplicate} className="rounded-md px-2 py-1 hover:bg-surface-2">
          Duplicate
        </button>
        <button onClick={remove} className="rounded-md px-2 py-1 text-red-500 hover:bg-surface-2">
          Delete
        </button>
      </div>
    </li>
  );
}

/** Section 10: save/load (autosave already runs in the background via useAutosave), JSON
 *  import/export as a backup, and MIDI export. */
export default function SongPanel() {
  const [expanded, setExpanded] = useState(false);
  const [songs, setSongs] = useState<SongMeta[]>([]);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const song = useStore((s) => s.song);
  const setTitle = useStore((s) => s.setTitle);
  const loadSong = useStore((s) => s.loadSong);
  const newSongAction = useStore((s) => s.newSong);
  const hasChords = useStore((s) => flattenSong(s.song).length > 0);

  const refresh = () => setSongs(listSongs());

  const toggle = () => {
    setExpanded((v) => {
      if (!v) refresh();
      return !v;
    });
  };

  const saveAsNew = () => {
    saveSongToStorage({ ...song, id: newId(), updatedAt: Date.now() });
    refresh();
  };

  const startNewSong = () => {
    if (hasChords && !confirm('Start a new blank song? Your current song is already saved.')) return;
    newSongAction();
  };

  const importFile = async (file: File) => {
    setImportError(null);
    const text = await file.text();
    const imported = parseSongJson(text);
    if (!imported) {
      setImportError("That file doesn't look like a song export.");
      return;
    }
    loadSong(imported);
    saveSongToStorage(imported);
    refresh();
  };

  return (
    <div className="rounded-xl border border-line bg-surface p-3">
      <div className="flex items-center gap-2">
        <input
          value={song.title}
          onChange={(e) => setTitle(e.target.value)}
          aria-label="Song title"
          className="h-10 min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-2 font-semibold hover:border-line focus:border-line"
        />
        <button
          onClick={toggle}
          aria-pressed={expanded}
          aria-label="Save, load and export"
          className={`h-10 shrink-0 rounded-lg border px-3 text-sm font-medium ${expanded ? 'border-accent text-accent' : 'border-line text-muted hover:bg-surface-2'}`}
        >
          {expanded ? 'Songs ▴' : 'Songs ▾'}
        </button>
      </div>

      {expanded && (
        <div className="mt-3 space-y-3 border-t border-line pt-3">
          <div className="flex flex-wrap gap-1.5 text-sm">
            <button onClick={startNewSong} className="rounded-lg border border-line px-3 py-1.5 font-medium hover:bg-surface-2">
              New song
            </button>
            <button onClick={saveAsNew} className="rounded-lg border border-line px-3 py-1.5 font-medium hover:bg-surface-2">
              Save as new
            </button>
            <button onClick={() => downloadSongJson(song)} className="rounded-lg border border-line px-3 py-1.5 font-medium hover:bg-surface-2">
              Export JSON
            </button>
            <button onClick={() => fileInput.current?.click()} className="rounded-lg border border-line px-3 py-1.5 font-medium hover:bg-surface-2">
              Import JSON
            </button>
            <input
              ref={fileInput}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void importFile(file);
                e.target.value = '';
              }}
            />
            <button
              onClick={() => downloadMidi(song)}
              disabled={!hasChords}
              className="rounded-lg border border-line px-3 py-1.5 font-medium hover:bg-surface-2 disabled:opacity-40"
            >
              Export MIDI
            </button>
          </div>
          {importError && <p className="text-sm text-red-500">{importError}</p>}

          {songs.length > 0 ? (
            <ul className="space-y-1.5">
              {songs.map((meta) => (
                <SavedRow key={meta.id} meta={meta} currentId={song.id} onChanged={refresh} />
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">No saved songs yet — this one autosaves as you edit it.</p>
          )}
        </div>
      )}
    </div>
  );
}

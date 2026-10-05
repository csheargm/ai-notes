import {
  createNote,
  addReference,
  addSource,
  sortNotes,
  updateNote,
  updateNoteText,
  updateNoteInk,
  updateSource,
  updateCanvas,
  type CanvasItem,
  type SourceBlock,
  type InkStroke,
  type Note,
} from "@ai-notes/notes";
import { IndexedDbNoteRepository } from "@ai-notes/storage";
import type { SyncChange } from "@ai-notes/sync";
import { useCallback, useEffect, useRef, useState } from "react";

const repository = new IndexedDbNoteRepository();
const WELCOME_TEXT = `AI Notes keeps your writing on this device and available offline.

Start with a thought, add a few tags, or pin something important. Milestone 1 is intentionally focused: a fast notebook now, with handwriting, sync, research sources, and provider-neutral AI assistance on the roadmap.`;

export type SaveStatus = "idle" | "saving" | "saved" | "error";

export function useNotes() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [deletedIds, setDeletedIds] = useState<string[]>(
    () =>
      JSON.parse(
        localStorage.getItem("ai-notes-deleted-ids") ?? "[]",
      ) as string[],
  );
  const saveTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const initialLoad = useRef<Promise<Note[]> | null>(null);

  useEffect(() => {
    let active = true;
    initialLoad.current ??= (async () => {
      let initial = await repository.list();
      if (initial.length === 0) {
        const welcome = createNote({
          title: "Welcome to AI Notes",
          text: WELCOME_TEXT,
          tags: ["getting-started", "local-first"],
        });
        await repository.save(welcome);
        initial = [welcome];
      }
      return sortNotes(initial);
    })();
    void initialLoad.current
      .then((ordered) => {
        if (!active) return;
        setNotes(ordered);
        setSelectedId(ordered[0]?.id);
        setLoading(false);
      })
      .catch(() => {
        if (active) {
          setLoading(false);
          setSaveStatus("error");
        }
      });
    return () => {
      active = false;
      for (const timer of saveTimers.current.values()) clearTimeout(timer);
    };
  }, []);

  const persist = useCallback((note: Note, immediate = false) => {
    const existing = saveTimers.current.get(note.id);
    if (existing) clearTimeout(existing);
    setSaveStatus("saving");
    const save = () => {
      void repository
        .save(note)
        .then(() => setSaveStatus("saved"))
        .catch(() => setSaveStatus("error"));
      saveTimers.current.delete(note.id);
    };
    if (immediate) save();
    else saveTimers.current.set(note.id, setTimeout(save, 350));
  }, []);

  const replace = useCallback(
    (next: Note, immediate = false) => {
      setNotes((current) =>
        sortNotes(current.map((note) => (note.id === next.id ? next : note))),
      );
      persist(next, immediate);
    },
    [persist],
  );

  const addNote = useCallback(
    (title?: string, text?: string) => {
      const note = createNote({ title, text });
      setNotes((current) => sortNotes([note, ...current]));
      setSelectedId(note.id);
      persist(note, true);
      return note;
    },
    [persist],
  );

  const deleteNote = useCallback(async (id: string) => {
    const timer = saveTimers.current.get(id);
    if (timer) clearTimeout(timer);
    await repository.delete(id);
    setDeletedIds((current) => {
      const next = [...new Set([...current, id])];
      localStorage.setItem("ai-notes-deleted-ids", JSON.stringify(next));
      return next;
    });
    setNotes((current) => {
      const remaining = current.filter((note) => note.id !== id);
      setSelectedId((selected) =>
        selected === id ? remaining[0]?.id : selected,
      );
      return remaining;
    });
  }, []);

  const applySyncChanges = useCallback(async (changes: SyncChange[]) => {
    const current = new Map(
      (await repository.list()).map((note) => [note.id, note]),
    );
    for (const change of changes) {
      if (change.operation === "delete") {
        current.delete(change.noteId);
        await repository.delete(change.noteId);
      } else if (change.note) {
        current.set(change.note.id, change.note);
        await repository.save(change.note);
      }
    }
    const next = sortNotes([...current.values()]);
    setNotes(next);
    setSelectedId((selected) =>
      selected && current.has(selected) ? selected : next[0]?.id,
    );
  }, []);

  const markDeletionsSynced = useCallback((ids: string[]) => {
    setDeletedIds((current) => {
      const next = current.filter((id) => !ids.includes(id));
      localStorage.setItem("ai-notes-deleted-ids", JSON.stringify(next));
      return next;
    });
  }, []);

  const editTitle = useCallback(
    (note: Note, title: string) => replace(updateNote(note, { title })),
    [replace],
  );
  const editText = useCallback(
    (note: Note, text: string) => replace(updateNoteText(note, text)),
    [replace],
  );
  const setTags = useCallback(
    (note: Note, tags: string[]) => replace(updateNote(note, { tags }), true),
    [replace],
  );
  const togglePin = useCallback(
    (note: Note) => replace(updateNote(note, { pinned: !note.pinned }), true),
    [replace],
  );
  const setInk = useCallback(
    (
      note: Note,
      strokes: InkStroke[],
      size: { width: number; height: number },
    ) => replace(updateNoteInk(note, strokes, size)),
    [replace],
  );
  const createSource = useCallback(
    (note: Note, source: Omit<SourceBlock, "id" | "type" | "createdAt">) =>
      replace(addSource(note, source), true),
    [replace],
  );
  const editSource = useCallback(
    (
      note: Note,
      sourceId: string,
      changes: Partial<Omit<SourceBlock, "id" | "type">>,
    ) => replace(updateSource(note, sourceId, changes), true),
    [replace],
  );
  const linkNote = useCallback(
    (note: Note, targetId: string, label: string) =>
      replace(addReference(note, targetId, label), true),
    [replace],
  );
  const setCanvas = useCallback(
    (note: Note, items: CanvasItem[]) =>
      replace(updateCanvas(note, items), true),
    [replace],
  );

  return {
    notes,
    selectedId,
    setSelectedId,
    loading,
    saveStatus,
    addNote,
    deleteNote,
    editTitle,
    editText,
    setTags,
    togglePin,
    setInk,
    createSource,
    editSource,
    linkNote,
    setCanvas,
    deletedIds,
    applySyncChanges,
    markDeletionsSynced,
  };
}

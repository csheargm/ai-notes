import {
  createNote,
  sortNotes,
  updateNote,
  updateNoteText,
  type Note,
} from "@ai-notes/notes";
import { IndexedDbNoteRepository } from "@ai-notes/storage";
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
    setNotes((current) => {
      const remaining = current.filter((note) => note.id !== id);
      setSelectedId((selected) =>
        selected === id ? remaining[0]?.id : selected,
      );
      return remaining;
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
  };
}

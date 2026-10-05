import {
  inkBlock,
  matchesNote,
  noteText,
  type InkStroke,
  type Note,
} from "@ai-notes/notes";
import {
  Archive,
  ChevronLeft,
  FileText,
  Hash,
  Menu,
  MoreHorizontal,
  PanelLeftClose,
  PenLine,
  Pin,
  Plus,
  Search,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useNotes } from "./useNotes";
import { InkCanvas } from "./InkCanvas";
import { AIPanel } from "./AIPanel";

type Filter = "all" | "pinned";

function relativeTime(date: string): string {
  const elapsed = Date.now() - new Date(date).getTime();
  const minutes = Math.max(0, Math.floor(elapsed / 60_000));
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return days < 7
    ? `${days}d`
    : new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "numeric",
      }).format(new Date(date));
}

function excerpt(note: Note): string {
  return noteText(note).replace(/\s+/g, " ").trim() || "Empty note";
}

function NoteEditor({
  note,
  onTitle,
  onText,
  onTags,
  onPin,
  onDelete,
  onBack,
  onInk,
}: {
  note: Note;
  onTitle: (value: string) => void;
  onText: (value: string) => void;
  onTags: (tags: string[]) => void;
  onPin: () => void;
  onDelete: () => void;
  onBack: () => void;
  onInk: (
    strokes: InkStroke[],
    size: { width: number; height: number },
  ) => void;
}) {
  const [tagDraft, setTagDraft] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  const addTag = () => {
    if (!tagDraft.trim()) return;
    onTags([...note.tags, tagDraft]);
    setTagDraft("");
  };

  return (
    <main className="editor-shell">
      <header className="editor-toolbar">
        <button
          className="icon-button mobile-only"
          aria-label="Back to notes"
          onClick={onBack}
        >
          <ChevronLeft size={21} />
        </button>
        <div className="save-context">
          <span className="presence-dot" /> On this device
        </div>
        <div className="toolbar-actions">
          <button
            className={`icon-button ${note.pinned ? "is-active" : ""}`}
            aria-label={note.pinned ? "Unpin note" : "Pin note"}
            onClick={onPin}
          >
            <Pin size={18} />
          </button>
          <button
            className="ai-button"
            onClick={() => setAiOpen((open) => !open)}
          >
            <Sparkles size={16} /> Ask AI
          </button>
          <div className="menu-wrap">
            <button
              className="icon-button"
              aria-label="More note actions"
              onClick={() => setMenuOpen((open) => !open)}
            >
              <MoreHorizontal size={20} />
            </button>
            {menuOpen && (
              <div className="action-menu">
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    onDelete();
                  }}
                >
                  <Trash2 size={16} /> Delete note
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <article className="note-page">
        <div className="note-meta">
          <span>
            {new Intl.DateTimeFormat(undefined, {
              dateStyle: "medium",
              timeStyle: "short",
            }).format(new Date(note.updatedAt))}
          </span>
          <span>Revision {note.revision}</span>
        </div>
        <input
          ref={titleRef}
          className="title-input"
          value={note.title}
          onChange={(event) => onTitle(event.target.value)}
          onBlur={(event) => {
            if (!event.target.value.trim()) onTitle("Untitled note");
          }}
          aria-label="Note title"
          placeholder="Untitled note"
        />
        <div className="tag-row">
          {note.tags.map((tag) => (
            <button
              className="tag"
              key={tag}
              onClick={() => onTags(note.tags.filter((item) => item !== tag))}
              title="Remove tag"
            >
              <Hash size={12} />
              {tag}
              <X size={11} />
            </button>
          ))}
          <form
            onSubmit={(event) => {
              event.preventDefault();
              addTag();
            }}
          >
            <input
              value={tagDraft}
              onChange={(event) => setTagDraft(event.target.value)}
              aria-label="Add a tag"
              placeholder="+ Add tag"
            />
          </form>
        </div>
        <textarea
          className="body-input"
          value={noteText(note)}
          onChange={(event) => onText(event.target.value)}
          aria-label="Note body"
          placeholder="Start writing…"
          spellCheck
        />
        <InkCanvas strokes={inkBlock(note)?.strokes ?? []} onChange={onInk} />
      </article>
      {aiOpen && <AIPanel note={note} onClose={() => setAiOpen(false)} />}
    </main>
  );
}

export function App() {
  const notebook = useNotes();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileEditor, setMobileEditor] = useState(false);

  const visibleNotes = useMemo(
    () =>
      notebook.notes.filter(
        (note) => (filter === "all" || note.pinned) && matchesNote(note, query),
      ),
    [notebook.notes, filter, query],
  );
  const selected = notebook.notes.find(
    (note) => note.id === notebook.selectedId,
  );

  const selectNote = (id: string) => {
    notebook.setSelectedId(id);
    setMobileEditor(true);
  };

  const create = () => {
    notebook.addNote();
    setFilter("all");
    setQuery("");
    setMobileEditor(true);
  };

  const remove = () => {
    if (
      !selected ||
      !window.confirm(
        `Delete “${selected.title || "Untitled note"}”? This cannot be undone.`,
      )
    )
      return;
    void notebook.deleteNote(selected.id);
    setMobileEditor(false);
  };

  return (
    <div
      className={`app-frame ${sidebarOpen ? "" : "sidebar-collapsed"} ${mobileEditor ? "show-mobile-editor" : ""}`}
    >
      <aside className="sidebar">
        <div className="brand-row">
          <div className="brand-mark">
            <PenLine size={19} />
          </div>
          <span>AI Notes</span>
          <button
            className="icon-button collapse-button"
            aria-label="Collapse sidebar"
            onClick={() => setSidebarOpen(false)}
          >
            <PanelLeftClose size={18} />
          </button>
        </div>
        <button className="new-note" onClick={create}>
          <Plus size={18} /> New note <kbd>⌘ N</kbd>
        </button>
        <nav aria-label="Notebook">
          <button
            className={filter === "all" ? "active" : ""}
            onClick={() => setFilter("all")}
          >
            <FileText size={17} /> All notes{" "}
            <span>{notebook.notes.length}</span>
          </button>
          <button
            className={filter === "pinned" ? "active" : ""}
            onClick={() => setFilter("pinned")}
          >
            <Pin size={17} /> Pinned{" "}
            <span>{notebook.notes.filter((note) => note.pinned).length}</span>
          </button>
          <button disabled>
            <Archive size={17} /> Research <small>Soon</small>
          </button>
        </nav>
        <div className="sidebar-footer">
          <div className="storage-badge">
            <span /> Local-first
          </div>
          <p>Your notes stay on this device.</p>
        </div>
      </aside>

      {!sidebarOpen && (
        <button
          className="sidebar-reveal icon-button"
          aria-label="Open sidebar"
          onClick={() => setSidebarOpen(true)}
        >
          <Menu size={20} />
        </button>
      )}

      <section className="note-list-panel">
        <header className="list-header">
          <div>
            <p className="eyebrow">Notebook</p>
            <h1>{filter === "pinned" ? "Pinned" : "All notes"}</h1>
          </div>
          <button
            className="icon-button"
            aria-label="Create note"
            onClick={create}
          >
            <Plus size={20} />
          </button>
        </header>
        <label className="search-field">
          <Search size={17} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search notes"
            aria-label="Search notes"
          />
          {query && (
            <button aria-label="Clear search" onClick={() => setQuery("")}>
              <X size={15} />
            </button>
          )}
        </label>
        <div className="list-summary">
          <span>
            {visibleNotes.length} {visibleNotes.length === 1 ? "note" : "notes"}
          </span>
          <span>Updated recently</span>
        </div>
        <div className="note-list">
          {notebook.loading && (
            <div className="empty-state">
              <div className="loading-ring" />
              <p>Opening your notebook…</p>
            </div>
          )}
          {!notebook.loading &&
            visibleNotes.map((note) => (
              <button
                key={note.id}
                className={`note-card ${note.id === selected?.id ? "selected" : ""}`}
                onClick={() => selectNote(note.id)}
              >
                <div className="card-heading">
                  <strong>{note.title || "Untitled note"}</strong>
                  {note.pinned && <Pin size={13} fill="currentColor" />}
                </div>
                <p>{excerpt(note)}</p>
                <div className="card-meta">
                  <time>{relativeTime(note.updatedAt)}</time>
                  {note.tags.slice(0, 2).map((tag) => (
                    <span key={tag}>#{tag}</span>
                  ))}
                </div>
              </button>
            ))}
          {!notebook.loading && visibleNotes.length === 0 && (
            <div className="empty-state">
              <FileText size={28} />
              <h2>No notes found</h2>
              <p>
                {query ? "Try a different search." : "Create a note to begin."}
              </p>
              <button onClick={create}>Create note</button>
            </div>
          )}
        </div>
      </section>

      {selected ? (
        <NoteEditor
          key={selected.id}
          note={selected}
          onTitle={(value) => notebook.editTitle(selected, value)}
          onText={(value) => notebook.editText(selected, value)}
          onTags={(tags) => notebook.setTags(selected, tags)}
          onPin={() => notebook.togglePin(selected)}
          onDelete={remove}
          onBack={() => setMobileEditor(false)}
          onInk={(strokes, size) => notebook.setInk(selected, strokes, size)}
        />
      ) : (
        <main className="editor-shell editor-empty">
          <div className="empty-illustration">
            <PenLine size={32} />
          </div>
          <h2>Choose a note</h2>
          <p>Select a note from the notebook or capture a new thought.</p>
          <button onClick={create}>
            <Plus size={17} /> New note
          </button>
        </main>
      )}

      <div className={`save-toast status-${notebook.saveStatus}`} role="status">
        {notebook.saveStatus === "saving"
          ? "Saving…"
          : notebook.saveStatus === "error"
            ? "Couldn’t save"
            : "Saved locally"}
      </div>
    </div>
  );
}

# AI Notes Architecture

## System direction

```text
React PWA
  |-- notebook UI and editor
  |-- application services
  |-- note domain model
  |-- storage adapter --------> IndexedDB
  |-- AI router --------------> provider adapters
  |-- future sync engine -----> API / cloud database / object storage
```

Milestone 1 is entirely local. Boundaries introduced now allow cloud sync, additional editors, and AI providers to arrive as additive adapters.

## Workspace layout

```text
apps/
  web/          React/Vite PWA and composition root
packages/
  notes/        note entities and pure domain behavior
  storage/      repository contracts and IndexedDB adapter
  ai/           provider contracts and routing policy
  shared/       shared utilities and identifiers
docs/           product requirements, architecture, roadmap
```

Package dependencies point inward: the application may depend on packages, storage may depend on the note domain, and domain packages must not depend on React or browser UI code.

## Domain model

The note aggregate contains metadata and an ordered list of versioned content blocks. Text and ink blocks now coexist in the same note; later source and attachment blocks extend the same discriminated union.

```ts
type Note = {
  id: string;
  title: string;
  blocks: NoteBlock[];
  tags: string[];
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
  revision: number;
};
```

Domain functions normalize tags, create notes, update text, and apply metadata changes. They are pure and covered by unit tests.

### Ink input

The web editor captures Pointer Events into vector strokes containing coordinates, pressure, and timestamps. The SVG surface renders pen and highlighter strokes, supports stroke erasure, and maintains bounded undo/redo history. Large touch contacts are ignored as a best-effort palm rejection heuristic. IndexedDB stores the canonical vectors as an ink block alongside typed text.

## Persistence

`NoteRepository` is the application-facing boundary. `IndexedDbNoteRepository` implements it with a versioned IndexedDB database and a `notes` object store indexed by update time. The UI never performs IndexedDB operations directly.

IndexedDB writes are local and transactional. Milestone 1 uses last-write-wins within one browser profile. A future change log can wrap repository writes and feed a sync engine without changing editor components.

## UI state and persistence flow

```text
user input -> optimistic React state -> debounced repository save
                                     -> status indicator
initial load <- repository list <-----+
```

Deleting is explicit and immediately removes the item from UI after persistence succeeds. Search is computed locally from the loaded collection, with normalized matching across title, block text, and tags.

## PWA and offline behavior

Vite builds static assets. The PWA plugin generates a manifest and service worker that precaches the application shell. IndexedDB supplies user content. Once installed or visited successfully, the notebook can reopen and edit existing notes offline.

## AI boundary

`AIProvider` exposes identity, capabilities, availability, and completion. `AIRouter` selects an eligible provider based on task and routing profile. Profiles express intent instead of forcing a model choice for each action.

The local Node gateway implements OpenRouter and Ollama adapters. Browser code sends note actions to `/api/ai`; cloud keys remain in server environment variables and never enter the client bundle. Responses use newline-delimited JSON so the UI can render incremental output and display provider/model provenance. Browser code never invokes Codex CLI or Claude CLI; those remain behind the later trusted-agent boundary.

OpenRouter supports Default, Fast, and Deep routing profiles with configurable model IDs. Ollama supports the Local profile and reports available only when its configured model is installed. Agent routing remains intentionally unavailable until Milestone 6 adds explicit permissions and auditing.

## Sync direction

The sync system adds a local change log between repository operations and a remote adapter:

```text
IndexedDB -> change log -> sync engine -> authenticated API
                                      -> database / object storage
```

The browser tracks a per-device cursor, last-synced revisions, and pending deletions. The authenticated server maintains a bounded change feed and note history. Revision mismatches are surfaced as conflicts and resolved deterministically by update timestamp and revision while returning both versions for audit. This provides practical multi-device synchronization without prematurely adopting a CRDT.

## Attachments

Attachment metadata belongs in note blocks; binary data belongs in a separate blob/object store. The server exposes authenticated, size-limited attachment upload/download endpoints and stores binary data separately from notes. A deployed instance can replace the filesystem adapter with object storage without changing note records.

## Security boundaries

- Client bundle: UI, local database, routing policy, non-secret configuration.
- Backend: cloud credentials, authenticated provider requests, sync, auditing.
- Trusted local bridge: optional local models and approved CLI agents.
- Imported content: untrusted input that requires parsing and rendering controls.

## Architectural decision record

Significant changes should be captured as short ADRs under `docs/decisions/`. Each record should state context, decision, consequences, and status. Requirements, architecture, and roadmap must be updated when decisions materially alter them.

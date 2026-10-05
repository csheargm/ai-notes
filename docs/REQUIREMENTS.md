# AI Notes Product Requirements

## Product vision

AI Notes is a local-first notebook and knowledge workspace for writing, handwriting, research, and AI-assisted understanding. It should feel like a fast notebook before it feels like an AI product. Desktop browsers and iPad are first-class targets, with an installable progressive web application as the initial delivery surface.

The product is intended to become a dependable application rather than a demonstration. Its architecture must preserve user control, work offline, avoid provider lock-in, and leave room for sync, rich media, handwriting, and agent workflows.

## Product principles

1. **Local first.** Creating, opening, and editing a note must not depend on a server round trip.
2. **Writing first.** The note remains the dominant surface; AI is helpful but visually secondary.
3. **Portable by design.** Notes must remain understandable and exportable to common formats.
4. **Provider neutral.** Application behavior may not depend on one AI model or vendor.
5. **Touch friendly.** Controls and layouts must work well on iPad and with Apple Pencil.
6. **Progressive complexity.** Begin with a focused text notebook and evolve toward blocks, ink, sources, sync, and agents without rewriting the foundation.

## Primary navigation

- Recent notes
- Search
- Quick capture
- All notes
- Folders
- Tags
- Pinned notes
- Scratch notes
- Research

Milestone 1 implements recent/all notes, search, quick capture, tags, and pinned notes. Other destinations may be represented in the information architecture but must not claim functionality that is not implemented.

## Note model

A note is a durable container with identity, title, timestamps, tags, pinned state, and ordered content blocks. The initial editor may focus on text, but persistence and domain APIs must not assume a note is a single string.

Planned block/content types include:

- Rich text
- Handwriting and drawings
- Images and screenshots
- PDFs and annotations
- Audio
- Links and quotations
- Files
- AI-generated content with provenance

## Milestone 1 requirements

### Notebook experience

- Create a note from quick capture or the notebook.
- Edit title and text with immediate local persistence.
- Delete a note with an explicit confirmation.
- Pin or unpin a note.
- Add and remove tags.
- Browse notes ordered by most recently updated.
- Search titles, text, and tags locally.
- Present an empty state and useful first-run sample without requiring an account.
- Remain responsive across desktop, tablet, and narrow mobile layouts.

### Local persistence

- Use IndexedDB rather than `localStorage` as the system of record.
- Keep domain types independent from the storage adapter and UI.
- Seed a welcome note only when the database is genuinely empty.
- Make changes durable across reloads and available without a network connection.
- Expose repository operations suitable for future sync integration.

### Progressive web application

- Provide a web app manifest, icons, theme colors, and install metadata.
- Cache the application shell for offline use.
- Use a responsive, standalone-capable layout.

### AI foundation

- Define provider, request, response, capability, and availability contracts.
- Define routing profiles: `default`, `fast`, `deep`, `local`, and `agent`.
- Keep provider credentials out of the browser bundle.
- Do not present placeholder provider integrations as functional.
- Keep local CLI providers behind a future trusted bridge or server boundary.

### Quality requirements

- TypeScript strict mode must pass.
- Important domain and routing behavior must have automated tests.
- Production build must succeed.
- The application must start locally with documented commands.
- Accessibility basics must include semantic controls, labels, focus styles, and reduced-motion behavior.

## Future functional requirements

### Milestone 2: rich editor and Pencil

- Add block editing and mixed text/ink notes.
- Capture Pointer Events including pointer type, pressure, coordinates, and timestamps.
- Store ink as structured vector strokes.
- Support pen, highlighter, eraser, selection, and undo/redo.
- Validate offline behavior on iPad.

### Milestone 3: AI assistance

- Implement secure OpenRouter and configurable Ollama integrations.
- Add streaming and routing-profile selection.
- Add summarize, explain, rewrite, action-item extraction, tag generation, and note Q&A.
- Preserve input/source provenance where possible.

### Milestone 4: sync

- Add authentication, API, cloud database, attachment storage, change log, conflict handling, and multi-device synchronization.
- Evaluate operation logs or CRDTs based on demonstrated conflict requirements rather than introducing them prematurely.

### Milestone 5: research workspace

- Capture URLs, quotations, images, PDFs, audio, and source metadata.
- Add PDF annotation, backlinks, OCR/text extraction, unified search, semantic search, and spatial canvas tools.

### Milestone 6: agents

- Add explicit, auditable integrations for Codex and Claude CLI through a trusted execution boundary.
- Require clear permissions for agent actions.

## iPad and Apple Pencil direction

The PWA will use Pointer Events where browser support permits. Ink points contain `x`, `y`, `pressure`, and timestamp values; strokes also record an identifier and tool. Palm rejection is best effort within browser capabilities. Raw vector data is the canonical representation, with raster previews treated as derived assets.

## Search and organization direction

Search will expand from local title/text/tag matching to attachments, handwriting OCR, PDF text, and embeddings. Notes may belong to folders while also having multiple tags, links, backlinks, and pinned status. The system must not force every note into exactly one hierarchy.

## Security and privacy

- Never embed cloud-provider secrets in client code.
- Require explicit configuration for local Ollama connections.
- Execute local CLIs only through a trusted bridge, desktop companion, or server process.
- Make future agent operations permissioned and auditable.
- Treat imported files and external content as untrusted.

## Data portability

The internal representation must be versioned and migratable. Planned exports include Markdown, JSON, and PDF. Attachment metadata remains separate from binary storage so storage backends can change independently.

## Definition of done for Milestone 1

Milestone 1 is complete when the documented workspace installs with pnpm, type checking and automated tests pass, the production PWA build succeeds, the development server starts, and the browser app supports durable create/edit/delete, search, tags, and pinning without a network connection.

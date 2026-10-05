# AI Notes Roadmap

## Milestone 1 — Foundation

Status: complete (October 5, 2026)

- TypeScript/pnpm workspace
- Responsive React notebook shell
- Versioned block-based note domain
- IndexedDB persistence
- Create, edit, delete, search, tags, and pinning
- Provider-neutral AI and routing contracts
- Installable/offline PWA foundation
- Domain and routing tests
- Requirements, architecture, and contributor documentation

Exit criteria: install, typecheck, test, and build pass; the local app starts; core note workflows persist across reloads.

## Milestone 2 — Editor and Pencil

Status: complete (October 5, 2026)

- Rich block editor
- Ink canvas and Pointer Events
- Apple Pencil pressure-aware strokes
- Pen, highlighter, eraser, selection, and undo/redo
- Structured handwriting persistence
- Mixed text and ink notes
- iPad offline and install testing

## Milestone 3 — AI assistance

Status: in progress

- Backend/bridge credential boundary
- OpenRouter and Ollama adapters
- Streaming responses
- Default, Fast, Deep, Local, and Agent profiles
- Summarize, explain, rewrite, action items, tags, and note Q&A
- Provenance for generated content

## Milestone 4 — Synchronization

- API and authentication
- Cloud note database and object storage
- Change log and sync engine
- Conflict resolution
- Attachments and multi-device use
- Version history and recovery

## Milestone 5 — Research workspace

- URL and quotation capture
- PDF, image, audio, and document sources
- Extraction, highlights, and annotations
- Backlinks and related notes
- OCR and semantic search
- Spatial canvas

## Milestone 6 — Agent workflows

- Trusted Codex and Claude CLI bridges
- Explicit tool permissions
- Auditable operations
- Research and organization agents
- Human review for consequential changes

## Delivery practice

Each milestone should ship as small reviewable changes, keep the app runnable, add tests for domain behavior, document architectural decisions, and avoid claiming incomplete capabilities.

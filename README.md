# AI Notes

AI Notes is a local-first notebook and knowledge workspace designed for fast writing, iPad use, research, and provider-neutral AI assistance. Milestone 1 is a focused offline-capable text notebook with durable browser storage.

## What works

- Create, edit, and delete notes
- Search titles, note text, and tags
- Add tags and pin important notes
- Draw persistent vector ink with mouse, touch, or Apple Pencil
- Use pressure-aware pen, highlighter, eraser, and ink undo/redo
- IndexedDB persistence with optimistic editing
- Responsive, installable PWA shell
- Secure OpenRouter and Ollama note actions through a local server gateway
- Authenticated multi-device synchronization with change feeds, conflicts, and history
- Separate authenticated attachment storage

See [requirements](docs/REQUIREMENTS.md), [architecture](docs/ARCHITECTURE.md), and [roadmap](docs/ROADMAP.md) for the product direction and current scope.

## Development

Requirements: Node.js 22+ and pnpm 10+.

```bash
pnpm install
pnpm dev
```

The development server prints its local URL, normally `http://localhost:5173`.

`pnpm dev` starts both the web app and the local API gateway. For local AI, install an Ollama model and set `OLLAMA_MODEL` in `.env`. For cloud AI, copy `.env.example` to `.env` and set `OPENROUTER_API_KEY`. Secrets remain in the server process and are never bundled into the browser app.

Available note actions are summarize, explain, rewrite, action items, tag suggestions, and question answering. Routing profiles select Default, Fast, Deep, Local, or the future permissioned Agent path.

To enable synchronization, set a long random `AI_NOTES_SYNC_TOKEN` in `.env`, run the server, then open **Sync notebook** in the app and enter the server URL and token. The browser keeps the token only in session storage. The server persists notes, version history, and attachments below `AI_NOTES_DATA_DIR` (default `.data`). Deploy the server behind HTTPS for use across devices.

## Validation

```bash
pnpm typecheck
pnpm test
pnpm build
```

## Workspace

- `apps/web` — React application and PWA composition root
- `apps/server` — local credential boundary and AI gateway
- `packages/notes` — note domain model and pure behavior
- `packages/storage` — persistence contracts and IndexedDB adapter
- `packages/ai` — provider-neutral AI contracts and routing policy
- `packages/sync` — change-feed contracts, client, and conflict policy
- `packages/shared` — shared primitives

## Privacy and AI

AI actions send the current note to the provider selected by the user. Cloud credentials stay in the local gateway environment; they are never exposed to the browser bundle. Local CLIs such as Codex or Claude require the explicit trusted bridge and audit controls planned for Milestone 6.

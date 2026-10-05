# AI Notes

AI Notes is a local-first notebook and knowledge workspace designed for fast writing, iPad use, research, synchronization, and provider-neutral AI assistance.

## What works

- Create, edit, and delete notes
- Search titles, note text, and tags
- Add tags and pin important notes
- Draw persistent vector ink with mouse, touch, or Apple Pencil
- Use pressure-aware pen, highlighter, eraser, and ink undo/redo
- IndexedDB persistence with optimistic editing
- Responsive, installable PWA shell
- Secure OpenRouter, Ollama, and MLX note actions through a local server gateway
- Authenticated multi-device synchronization with change feeds, conflicts, and history
- Separate authenticated attachment storage
- URL, PDF, image, audio, and file research capture
- PDF text extraction, image OCR, annotations, links, backlinks, and related notes
- Draggable spatial research board
- Permission-reviewed Codex and Claude CLI workflows with audit history

See [requirements](docs/REQUIREMENTS.md), [architecture](docs/ARCHITECTURE.md), and [roadmap](docs/ROADMAP.md) for the product direction and current scope.

## Development

Requirements: Node.js 22+ and pnpm 10+.

```bash
pnpm install
pnpm dev
```

The development server prints its local URL, normally `http://localhost:5173`.

`pnpm dev` starts both the web app and the local API gateway. For local AI, install an Ollama model and set `OLLAMA_MODEL`, or run an OpenAI-compatible MLX server and set `MLX_BASE_URL` and `MLX_MODEL` in `.env`. Ollama is preferred when both local providers are available. For cloud AI, copy `.env.example` to `.env` and set `OPENROUTER_API_KEY`. Secrets remain in the server process and are never bundled into the browser app.

If the default ports are occupied, set matching values such as `AI_NOTES_SERVER_PORT=8791`, `AI_NOTES_WEB_PORT=5174`, and `AI_NOTES_API_URL=http://127.0.0.1:8791` in `.env`.

Available note actions are summarize, explain, rewrite, action items, tag suggestions, and question answering. Routing profiles select Default, Fast, Deep, Local, or the future permissioned Agent path.

To enable synchronization, set a long random `AI_NOTES_SYNC_TOKEN` in `.env`, run the server, then open **Sync notebook** in the app and enter the server URL and token. The browser keeps the token only in session storage. The server persists notes, version history, and attachments below `AI_NOTES_DATA_DIR` (default `.data`). Deploy the server behind HTTPS for use across devices.

Trusted agents are disabled by default. Set `AI_NOTES_ENABLE_CODEX=true` and/or `AI_NOTES_ENABLE_CLAUDE=true`, plus `AI_NOTES_AGENT_WORKSPACE`, only on a machine where those CLIs are already authenticated. The app always shows the prompt preview and requested permissions before the separate **Approve and run** action. Agent output is a proposal and never edits a note automatically; audit events are stored under `.data/audit`.

For private access from other devices, follow the [deployment guide](docs/DEPLOYMENT.md). The recommended personal setup uses Tailscale Serve and keeps Funnel disabled.

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
- `packages/research` — backlinks and offline related-note ranking
- `packages/agents` — agent workflow, permission, and execution contracts
- `packages/shared` — shared primitives

## Privacy and AI

AI actions send the current note to the provider selected by the user. Cloud credentials stay in the local gateway environment; they are never exposed to the browser bundle. Local CLIs such as Codex or Claude require the explicit trusted bridge and audit controls planned for Milestone 6.

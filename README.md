# AI Notes

AI Notes is a local-first notebook and knowledge workspace designed for fast writing, iPad use, research, and provider-neutral AI assistance. Milestone 1 is a focused offline-capable text notebook with durable browser storage.

## What works

- Create, edit, and delete notes
- Search titles, note text, and tags
- Add tags and pin important notes
- IndexedDB persistence with optimistic editing
- Responsive, installable PWA shell
- AI provider and routing contracts with no fake integrations

See [requirements](docs/REQUIREMENTS.md), [architecture](docs/ARCHITECTURE.md), and [roadmap](docs/ROADMAP.md) for the product direction and current scope.

## Development

Requirements: Node.js 22+ and pnpm 10+.

```bash
pnpm install
pnpm dev
```

The development server prints its local URL, normally `http://localhost:5173`.

## Validation

```bash
pnpm typecheck
pnpm test
pnpm build
```

## Workspace

- `apps/web` — React application and PWA composition root
- `packages/notes` — note domain model and pure behavior
- `packages/storage` — persistence contracts and IndexedDB adapter
- `packages/ai` — provider-neutral AI contracts and routing policy
- `packages/shared` — shared primitives

## Privacy and AI

Milestone 1 does not send note content to an AI service. Future cloud integrations will keep secrets outside the browser bundle. Local CLIs such as Codex or Claude must run behind an explicit trusted bridge and cannot be executed directly by browser code.

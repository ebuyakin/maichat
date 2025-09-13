# MaiChat

A keyboard-first, minimal, client-side app for organizing and running conversations with multiple LLMs in one unified interface.

## Highlights
- Topic tree: structure any message into a hierarchical topic system.
- Flexible context: filter/supplement what’s sent to the model.
- Command-line style filtering: fast, composable commands for context control.
- Keyboard-centric: operate without a mouse; distraction-free UI.
- Pure client: vanilla JS, built with Vite; no server required.

## Run in your browser (no install)
End users don’t need Node.js. Open the deployed site (e.g., GitHub Pages) and use MaiChat directly in the browser. If you self-host, serve the production build in `dist/` on any static web host.

## Local development
Prereqs: Node.js ≥ 18.

```bash
# install deps (uses package-lock if present)
npm ci

# start dev server (Vite)
npm run dev
# open http://localhost:5173
```

## Build & preview
```bash
# production build
npm run build

# local preview of built assets
npm run preview
```

## Tests
Vitest + jsdom.
```bash
# run once
npm test

# watch mode
npm run test:watch
```

## Project structure
- `public/` – static assets and HTML entry used by Vite
- `src/` – application source (core, features, runtime, UI, store, etc.)
- `docs/` – design docs, specs, and ADRs
- `tests/` – unit tests (Vitest)

## Documentation map

Core
- Project vision: `docs/project_vision.md`
- Architecture (current runtime/UI layers, data model): `docs/ARCHITECTURE.md`
- Tutorial (end‑user): `docs/tutorial.md`
- CLI filtering language (spec): `docs/cli_filtering_language.md`
- Keyboard reference (authoritative key map): `docs/keyboard_reference.md`
- Topic system (concepts and operations): `docs/topic_system.md`
- ADRs (decisions archive): `docs/ADRs/`

UI (scoped, non‑overlapping)
- UI layout (structure only: zones, tokens, alignment; no behavior): `docs/ui_layout.md`
- History reading behaviour (navigation semantics, fade rules, high‑level partitioning policy): `docs/ui_view_reading_behaviour.md`
- Scroll positioning spec (alignTo/ensureVisible math, one‑shot rules): `docs/scroll_positioning_spec.md`
- Focus management (modal isolation, traps, restore rules): `docs/focus_management.md`
- Plain‑text rendering policy (system instruction + sanitizer): `docs/plain_text_policy.md`
- New message workflow (send/reply lifecycle: focus targets and when to call alignTo): `docs/new_message_workflow.md`

Legacy (historical context; superseded)
- `docs/legacy_docs/` — older notes, drafts, and diagrams retained for reference.

## Notes
- Private prompts and internal assistant notes are ignored via `.gitignore` (`.github/prompts/`, `.github/copilot-instructions.md`).
- This repo is an active WIP; modules are being extracted into focused UI and runtime layers while keeping tests green.

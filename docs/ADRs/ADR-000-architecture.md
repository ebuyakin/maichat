# ADR-000: Architecture Overview

Date: 2025-08-22 (last reviewed 2025-09-05)
Status: Accepted
Decision: Keep a simple, vanilla JS architecture with a filterable history and keyboard-first UI; avoid heavy frameworks; isolate persistence behind an adapter.

## Context
MaiChat is a client-only (browser) application for managing multi-model AI chat histories with hierarchical topics and a powerful filtering CLI. Goals: keyboard-first UX, fast filtering, local-first storage, modular provider integration.

## Drivers
- Power-user speed (no heavy frameworks, minimal overhead)
- Local privacy (no server persistence initially)
- Extensibility (additional models, saved filters, future sync)
- Deterministic filtering (query language -> explicit AST -> evaluator)

## High-Level Architecture
Current layers in this repository:
1. Domain & Storage: In-memory canonical state (store) with derived indexes and a thin IndexedDB adapter.
2. Filtering Engine: Lexer → parser → evaluator pipeline, all pure functions.
3. UI: Minimal view helpers, a tiny mode FSM, and a mode-aware key router.
4. Persistence: Debounced content persistence coordinator that bridges store and the IndexedDB adapter.
5. Testing: Vitest with jsdom for unit tests.

## Key Entities
- **MessagePair**: atomic unit (user + assistant), metadata (topicId, star, colorFlag, model, timestamps).
- **Topic**: single parent tree; referenced by MessagePair.topicId.
- **Filter AST**: structured representation of CLI query.

## Rationale
- ES modules + no framework keeps bundle small and code transparent for learning goals.
- IndexedDB chosen for scalability beyond localStorage (binary size, indexing). Abstracted for future remote sync.
- Explicit AST allows future optimizations (index-based prefilter) without rewriting queries.

## Performance Principles
P1 Passive keys shouldn’t trigger expensive work; only explicit actions (apply filter, add message) may.
P2 Rendering should be incremental where possible; avoid full list rebuilds on small state changes.
P3 Keep data paths pure and testable to support future optimizations.

## Out of scope (for this repository snapshot)
Context assembly, provider adapters, and streaming are intentionally out of scope here. If/when added, they will live behind narrow boundaries to avoid coupling UI and network logic.

## Alternatives Considered
- React/Svelte: rejected (added complexity overhead & not aligned with pure JS learning goal).
- Direct string filtering w/o AST: rejected (hard to optimize & extend with dates/wildcards/saved filters).

## Risks
| Risk | Mitigation |
|------|------------|
| Parser complexity growth | Phase subset + unit tests + clear grammar surface |
| IndexedDB quirks/availability | Fallback to memory store; integrity checks |
| Performance w/ large histories | Incremental indexing + later virtualization |
| Token estimation accuracy | Start heuristic, swap pluggable tokenizer later |

## Decision
Accepted: vanilla JS + clear boundaries (store, indexes, filter, persistence, UI), no framework, test-first for parser and store.

## Consequences
- Need disciplined modular boundaries to avoid tight coupling.
- Slight upfront cost building parser but long-term extensibility gains.

## Follow-ups
- ADR-001 Filtering Engine Extensions (topics, dates)
- ADR-002 Storage Details (IndexedDB schema & migrations)
- ADR-004 Topic System Implementation Details (when the overlay ships)

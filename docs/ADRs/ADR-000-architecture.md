# ADR-000: Architecture Overview

Date: 2025-08-22
Status: Draft
Decision: Pending confirmation

## Context
MaiChat is a client-only (browser) application for managing multi-model AI chat histories with hierarchical topics and a powerful filtering CLI. Goals: keyboard-first UX, fast filtering, local-first storage, modular provider integration.

## Drivers
- Power-user speed (no heavy frameworks, minimal overhead)
- Local privacy (no server persistence initially)
- Extensibility (additional models, saved filters, future sync)
- Deterministic filtering (query language -> explicit AST -> evaluator)

## High-Level Architecture
Layers:
1. **Domain & Storage**: In-memory canonical state + IndexedDB persistence behind an adapter interface.
2. **Filtering Engine**: Lexer, parser, AST evaluator producing a set of message pair IDs.
3. **Context Assembly**: Derives ordered subset + token estimate for outbound requests.
4. **Provider Adapters**: Uniform interface to call different LLM APIs.
5. **UI Shell**: Vanilla JS rendering modules + mode state machine + keyboard router.
6. **Utilities**: ID gen, time helpers, escaping, event pub/sub.
7. **Testing & Tooling**: Vitest for unit/integration; performance micro-bench harness later.

## Key Entities
- **MessagePair**: atomic unit (user + assistant), metadata (topicId, star, includeInContext, model, timestamps).
- **Topic**: single parent tree; referenced by MessagePair.topicId.
- **Filter AST**: structured representation of CLI query.

## Rationale
- ES modules + no framework keeps bundle small and code transparent for learning goals.
- IndexedDB chosen for scalability beyond localStorage (binary size, indexing). Abstracted for future remote sync.
- Explicit AST allows future optimizations (index-based prefilter) without rewriting queries.

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
Pending (will mark Accepted after initial scaffolding stabilized).

## Consequences
- Need disciplined modular boundaries to avoid tight coupling.
- Slight upfront cost building parser but long-term extensibility gains.

## Follow-ups
- ADR-001 Filtering Engine Decisions
- ADR-002 Storage Choice Details
- ADR-003 Context Assembly Strategy

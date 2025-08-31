# ADR-000: Architecture Overview

Date: 2025-08-22
Status: Accepted
Decision: Adopt layered vanilla JS architecture with overlay-based topic system (no persistent side panels)

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
- **MessagePair**: atomic unit (user + assistant), metadata (topicId, star, colorFlag, model, timestamps).
- **Topic**: single parent tree; referenced by MessagePair.topicId.
- **Filter AST**: structured representation of CLI query.

## Rationale
- ES modules + no framework keeps bundle small and code transparent for learning goals.
- IndexedDB chosen for scalability beyond localStorage (binary size, indexing). Abstracted for future remote sync.
- Explicit AST allows future optimizations (index-based prefilter) without rewriting queries.

## Performance Principles (Added 2025-08-31)
**P1 Zero-Cost Passive Keystrokes**: Ordinary typing & navigation keystrokes MUST NOT trigger O(n) scans over history, token estimation passes, network calls, or full DOM rebuilds. Only explicit execution actions (filter submit, send, settings/model/topic change, new message arrival) may perform heavier work.

**P2 Bounded Rendering Work**: Passive key interactions update only localized DOM (input field, active highlight) without reconstructing the history list.

**P3 Predictable Latency**: Any operation on the passive typing path completes within ~1ms independent of history size (amortized); heavier tasks are deferred or shifted to explicit user actions.

Enforcement Examples:
- Context boundary does not re-evaluate per keystroke; instead, an allowance (default 256 tokens) is reserved.
- On send, boundary recalculated once with actual prompt size; if larger than allowance, oldest included pairs are trimmed silently (optional notice).
- Future tokenization upgrades must plug into the send-time pipeline, not the typing loop.

## Allowance-Based Context Strategy
The included/visible counter (X/Y) is computed with `assumedUserTokens` subtracted from the usable window so X already reflects what will fit alongside a typical prompt. Large prompts may cause a one-time additional trim at send. This replaces any earlier live inline token estimate concept, adhering to P1.

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
- ADR-001 Filtering Engine Decisions (Enhanced Filtering phase)
- ADR-002 Storage Choice Details (IndexedDB vs future sync backends)
- ADR-003 Context Assembly Strategy (Phase 6)
- ADR-004 Topic System Implementation Details (overlay modes, move semantics)

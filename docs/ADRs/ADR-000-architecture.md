# ADR-000: Architecture Overview

Date: 2025-08-22 (last reviewed 2025-09-01)
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
**P1 Zero-Cost Passive Keystrokes**: Ordinary typing & navigation keystrokes MUST NOT trigger O(n) history scans, token re-estimation passes, network calls, or full DOM rebuilds. Only explicit execution actions (filter submit, send, settings/model/topic change, message arrival) perform heavier work.

**P2 Bounded Rendering Work**: Passive key interactions update only localized DOM (input field, active highlight) without reconstructing the full history list.

**P3 Predictable Latency**: Passive typing path operations complete within ~1ms (amortized) independent of history size; heavier tasks are deferred to explicit user actions.

Enforcement (Current Option A Strategy):
- Prediction boundary not recomputed per keystroke; URA (default 100) reserve stabilizes inclusion despite prompt growth.
- On send we use the cached predicted set (or recompute once if boundary dirty). If actual prompt causes overflow the provider response triggers a runtime trimming loop (removing one oldest predicted pair per attempt) rather than preflight shrinking.
- Future Option B (deferred): preflight invisible trimming if `(predictedHistoryTokens + AUT) > ML` while keeping boundary visually stable.
- Tokenization upgrades must attach to explicit send or boundary recompute triggers—not passive typing.

## Allowance-Based Context Strategy (Prediction Boundary)
We select a newest-first suffix of the *visible* message pairs such that `(predictedHistoryTokens + URA) ≤ effectiveMaxContext`, where `effectiveMaxContext = min(model.contextWindow, model.tpm)` and URA (`userRequestAllowance`, default 100) is a stable planning reserve. The count of selected pairs is X (Predicted Message Count). Remaining visible pairs are Out-of-Context (OOC) but still rendered (dimming only).

At send time we append the new user message. If `AUT > ML` we raise `user_prompt_too_large`. Otherwise we attempt the provider call with the predicted set. If provider returns an overflow-classified error we enter a runtime overflow trimming loop: remove one oldest predicted pair, increment trimmed count T, retry (≤ maxTrimAttempts). We do not recompute X during trimming; predicted* fields remain constant; attempt* token fields shrink. This realizes P1 by eliminating per-keystroke or preflight recalculation.

Deferred Option (B): before first attempt, if `(predictedHistoryTokens + AUT) > ML`, perform invisible oldest-pair drops until fit (no UI boundary change) to reduce wasted overflow attempts.

Future enhancements: rpm/tdp quota integration, proactive advisory when AUT approaches URA, richer error taxonomy (auth, rate, network, overflow-exhausted, prompt-too-large).

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
Accepted (layered vanilla JS + allowance-based stable prediction boundary, runtime overflow trimming Option A).

## Consequences
- Need disciplined modular boundaries to avoid tight coupling.
- Slight upfront cost building parser but long-term extensibility gains.

## Follow-ups
- ADR-001 Filtering Engine Decisions (Enhanced Filtering phase)
- ADR-002 Storage Choice Details (IndexedDB vs future sync backends)
- ADR-003 Context Assembly Strategy (Phase 6)
- ADR-004 Topic System Implementation Details (overlay modes, move semantics)

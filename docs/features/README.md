# Features Layer Overview

This document explains the intent and allowed dependencies for each current *feature* slice. A feature groups code that delivers a user-facing capability (history viewing, interaction, sending, filtering, topic management, configuration). The goal is to keep vertical slices cohesive and minimize lateral coupling.

## Principles
- A feature may depend on `core/` (domain state, settings, context prediction) and *optionally* call into other features **only** through stable, narrow APIs.
- No feature imports instrumentation directly; instead emit events (later) or call provided callbacks.
- Rendering/presentation logic for message history stays inside the `history` feature; prediction logic stays in `core/context`.
- The send pipeline stays free of DOM dependencies (only callbacks + store updates).

## Dependency Matrix
Legend: ✔ allowed, ✖ avoid (design smell), (callback) indicates direction via callback or event rather than direct import.

| From \ To | core | history | interaction | command | topics | compose | config |
|-----------|------|---------|-------------|---------|--------|---------|--------|
| **core**        | —    | ✖ (callback) | ✖ | ✖ | ✖ | ✖ | ✖ |
| **history**     | ✔    | —           | ✖ | ✖ | (optional stats) | ✖ | ✖ |
| **interaction** | ✔    | ✔           | — | ✔ | ✔ | ✔ (trigger send) | ✔ |
| **command**     | ✔    | ✖           | ✖ | — | ✖ | ✖ | ✖ |
| **topics**      | ✔    | (optional read) | ✖ | ✖ | — | ✖ | ✖ |
| **compose**     | ✔    | (callback for render/update) | ✖ | ✖ | ✖ | — | ✖ |
| **config**      | ✔    | ✖           | ✖ | ✖ | ✖ | ✖ | — |

Notes:
- "(callback)" entries indicate the *feature* should expose a callback API or later an event, rather than directly import the target feature to perform side-effects.
- `interaction` acts as the coordinator that ties user input to history rendering, command filtering, topic selection, and send initiation.
- `command` is intentionally pure (no DOM) and should remain easy to test in isolation.
- `compose` (send pipeline) must not import UI code; all UI updates occur after store mutations or through callbacks.

## Feature Summaries

### history/
Renders message history: partitioning (segmentation), active part navigation, scroll anchoring, layout/fade styling, context inclusion marking, message count/status updates.
**Owns:** DOM of history pane, part computation, fade application.  
**Does NOT own:** Token prediction (core/context), send lifecycle state (compose), key handling (interaction).

### interaction/
Mode state machine (VIEW/COMMAND/INPUT), key routing, command line handling, star/flag/model/topic actions, send trigger orchestration.  
**Owns:** Keyboard semantics & mode transitions.  
**Does NOT own:** Filter language implementation, rendering algorithms, send trimming logic.

### command/
Filtering DSL (lexer, parser, evaluator). Produces filtered list of pairs for viewing and context prediction.  
**Pure:** No DOM access, no side-effects besides returning arrays or throwing errors.

### topics/
Topic tree editing (CRUD/move/rename) and topic selection for new messages.  
**Owns:** Tree traversal logic UI + keyboard navigation patterns specific to topics.

### compose/ (send pipeline)
Assembles request payload (user request + predicted history), performs trimming attempts, calls provider, updates store with responses/errors.  
**Owns:** Trimming loop, provider abstraction usage, error classification.  
**Does NOT own:** Display decisions (history rendering) or key events.

### config/
User-facing configuration & reference overlays: settings, model selection/editing, API keys, help.  
**Owns:** Persisting user-adjustable parameters via settings API & surfacing model catalog.

## Cross-Cutting Concerns (Planned)
- Events bus (`runtime/events.js`): will formalize (callback) relationships so features emit e.g. `send.attempt`, `context.predicted`, `ui.modeChanged` without direct imports.
- Streaming: `compose/` will emit token events; `history/` may subscribe to append parts.
- Context policy overrides: separate future module; will consume core/context API and inform compose.

## Enforcement Ideas
- ESLint rule (future): disallow forbidden import patterns (custom rule with regex on path).
- Unit tests for command/ and compose/ run in environment without DOM globals.

## When to Revisit Structure
- If any single feature folder exceeds ~800 LOC or spawns divergent subdomains (e.g., history/virtualization, config/models), introduce subfolders at that time.

---
Generated: 2025-09-05

# Runtime layer

Purpose: small orchestration shell that wires core services and performs a deterministic startup sequence. No view logic, no business rules.

## What it does
- initRuntime(): constructs the runtime container (ctx)
  - store + indexes + persistence boundary
  - history pane dependencies (active parts, scroll controller, history view)
  - boundary manager (context prediction)
  - lifecycle for new message handling
  - pending message metadata (topicId, model)
- bootstrap({ ctx, historyRuntime, interaction, loadingEl }): orders startup
  1) Register provider(s)
  2) Initialize persistence
  3) Ensure model catalog loaded
  4) Apply spacing styles from settings
  5) Optional demo seeding on empty store
  6) First render + status + active-part apply
  7) Restore pending topic; render pending meta; layout history pane
  8) Remove loading overlay; hook beforeunload flush

## Contracts
- ctx (returned from initRuntime):
  - store, persistence
  - activeParts, scrollController, historyView
  - boundaryMgr, lifecycle
  - pendingMessageMeta
  - getSettings, getActiveModel
- historyRuntime (consumed by bootstrap):
  - applySpacingStyles(settings)
  - renderCurrentView(options?)
  - applyActivePart()
  - renderStatus()
  - layoutHistoryPane()
- interaction: must provide renderPendingMeta()

Non-goals (by design):
- No DOM assembly of history/messages (belongs to features/history/*)
- No key handling or mode logic (belongs to features/interaction/*)
- No provider-specific logic beyond registration (implementation lives in infrastructure/provider/*)

## Dev & diagnostics
- Debug overlays (HUD / Request Debug) are enabled by the app’s own toggles (e.g., URL flags). This controls whether diagnostics render, not what runtime constructs.
- Runtime globals for local inspection are gated and only exposed in dev when explicitly enabled via URL: add `?debug=1` (or `?dbg=1`).
  - window.__store
  - window.__scrollController
  They’re omitted in production builds and when the flag isn’t set.

## Maintenance tips
- When adding a new service, wire it here and keep data passed between layers as plain objects/functions.
- Keep this layer tiny; prefer pushing logic down into features/* or core/*.
- After edits: run unit tests and do a quick smoke (load, j/k navigate, open/close overlays, send a prompt).
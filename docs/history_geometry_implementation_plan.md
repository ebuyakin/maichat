# History Geometry: Implementation Plan

Status: Proposed (execute after your OK)
Scope: History layout, scrolling anchors, activation thresholds, and user-facing spacing settings.
Note: Keep the temporary blue overlays for visibility until visual sign-off. Remove legacy variables immediately on migration (no backward-compat aliases).

## Goals
- Implement message-based layout per `docs/history_geometry` using a minimal, user-tunable parameter set.
- Make g/u/d/G alignment exact against fade overlays (top/bottom).
- Switch active message when its edge crosses the corresponding fade zone.
- Expose the parameters as user settings and persist them.

## User-facing settings (CSS vars + Settings UI)
- FadeZone → `--fade-zone` (px)
- MessageGap → `--message-gap` (px)
- AssistantGap → `--assistant-gap` (px)
- MessagePadding → `--message-padding` (px)
- MetaGap → `--meta-gap` (px)
- GutterL → `--gutter-l` (px)
- GutterR → `--gutter-r` (px)

Defaults mirror the values in `docs/history_geometry`.

## Equations (anchoring)
Container is `#history`:
- paneH = container.clientHeight
- padTop = padBottom = FadeZone (by CSS)
- fadeZone = FadeZone
- part.start = node.offsetTop − padTop (message border-top from inner top)
- part.h = node.offsetHeight
- Clamp: S ∈ [0, container.scrollHeight − paneH]

Anchors:
- Top (just below top overlay):
  S = padTop + part.start − fadeZone
- Bottom (just above bottom overlay):
  S = padTop + part.start + part.h − (paneH − padBottom) + fadeZone
- Center:
  S = padTop + part.start + part.h/2 − paneH/2

With padTop = padBottom = fadeZone, Top simplifies to S = part.start (and for the first message: S = MessageGap).

## Activation thresholds
- topThreshold = scrollTop + fadeZone
- bottomThreshold = scrollTop + paneH − fadeZone
- Scroll up: switch when active.bottom ≤ topThreshold
- Scroll down: switch when active.top ≥ bottomThreshold
- Use while loops to handle fast scroll; skip while programmatic scroll is active.

## Implementation steps
1) Variables (variables.css)
   - Add: `--fade-zone`, `--message-gap`, `--assistant-gap`, `--message-padding`, `--meta-gap`, `--gutter-l`, `--gutter-r`.
   - Remove legacy vars immediately: `--pane-gutter-l/r`, `--msg-gutter-l/r`, `--gap-between`, `--gap-meta`, `--gap-outer`, `--part-padding` (if present). No aliases.

2) Layout wiring (layout.css)
   - `#historyPane`: absolute; margin-left/right = `var(--gutter-l/r)`; padding-left/right = 0; padding-top/bottom = 0.
   - Overlays `.gradientOverlayTop/.gradientOverlayBottom`:
     - height: `var(--fade-zone)`; left/right: 0; keep TEMP blue gradients.
   - `#history`: absolute; top/bottom/left/right = 0; padding-top = `var(--fade-zone)`; padding-bottom = `var(--fade-zone)`; overflow-y: auto.

3) Messages (components/history.css)
   - `#history .message`: `margin-top: var(--message-gap)`; `margin-bottom: 0`.
   - `.message.assistant`: `margin-top: var(--assistant-gap)` (smaller intra-pair gap).
   - `.message.user`, `.message.assistant`: `padding: var(--message-padding)` (uniform).
   - Assistant meta: `margin-bottom: var(--meta-gap)`; unified font/size/color.
   - Active message: border only (no background).

4) Anchoring (scrollControllerV3.js)
   - Ensure `anchorScrollTop()` uses equations above; element path delegates to it.
   - Optional: special-case last-item + bottom anchor to `S = maxScroll` for true stick-to-bottom; otherwise allow the bottom fade layout behavior.

5) Activation switching (historyRuntime.js)
   - In the scroll handler, compute thresholds as above and switch active using while loops.
   - Respect `scrollController.isProgrammaticScroll()` to avoid jitter during animated scroll.

6) Settings plumbing
   - Surface settings in the UI (Config panel), bind to the CSS vars on `:root`.
   - Persist with existing settings system.
   - Remove any reads/writes of legacy variables in JS.

7) Tests & QA
   - Anchors: g/u/d/G land at fade edges (±1px).
   - Activation: active changes when the correct edge enters the corresponding fade zone.
   - Rhythm: user→assistant gap = AssistantGap; assistant→user gap = MessageGap.
   - Short last message: G aligns above bottom overlay (expected) unless stick-to-bottom is enabled.
   - Visual: overlays remain blue for verification.

8) Documentation
   - Update `history_navigation_redesign.md` with final equations, variable list, and behaviors.
   - Keep `history_geometry` as the source of truth for parameters/relationships.

## Risks / Notes
- CSS rounding can cause ±1px; tests should tolerate this.
- Always remeasure before anchoring after structural DOM changes.
- If variables become theme-dependent, ensure Settings updates recompute CSS vars before any programmatic scroll.

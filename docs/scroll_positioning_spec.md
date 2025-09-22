# Scroll Positioning Spec — One‑Shot Actions, Ensure‑Visible, Typewriter Regime

Date: 2025-09-15
Owner: History/Scrolling

## Purpose
Define precise rules for positioning the history viewport across open/reload, send/reply, and navigation. The model removes persistent reading regimes and replaces them with simple one‑shot actions plus a default Ensure‑Visible rule, with an optional opt‑in Typewriter Regime.

## Core definitions
- See ui_layout.md for definitions.
- See ui_view_reading_behaviour.md for definitions.

## Global edge rules (highest priority)
1) No blank band above the first rendered part.
2) No blank band below the last rendered part.

Notes:
 - When total content is shorter than the viewport (maxScroll=0), content is pinned to the top; we do not vertically center it. The outer gap is fixed (pane padding) and does not compress; content never touches the borders.

## Positioning vocabulary (precise)
Viewport: the scrollable area of `#historyPane`.
Outer gap: fixed pane padding (top/bottom) defined by `gapOuterPx`; never compresses.
Usable height: `viewportH − 2*outerGap` (excludes outer gap only, also referred to as _Usable Band_).
Ensure‑Visible: minimal‑movement rule – no scroll if fully visible; otherwise top‑align when coming from above, bottom‑align when coming from below.
AlignTo: one‑shot placement of a target at 'top' | 'bottom' | 'center', clamped to [0, maxScroll].

Reply height measurement (fit criterion):
- For a newly arrived reply composed of assistant parts, measure:
   - `firstRect = firstAssistantPart.getBoundingClientRect()`
   - `firstRect.top`: the y-position of the first assistant part of the new reply.
   - `lastRect = lastAssistantPart.getBoundingClientRect()`
   - `paneRect = historyPane.getBoundingClientRect()`
   - `paneRect.top`: the y-position of the pane's top edge in the view port
   - `replyHeight = lastRect.bottom − firstRect.top`
   - `clippedTop = max(0, paneRect.top − firstRect.top)` (accounts for any top overhang at measurement time)
- Fit test uses the Usable Band: `ReplyHeight ≤ usableHeight` (with a small tolerance, ~2 px).

## Positioning primitives
   - location ∈ {'top','bottom','center'}
   - Compute scrollTop to place target at location, respecting outer gap and clamping to [0, maxScroll]. Apply once; do not persist state.
   - If focused is fully visible: no scroll.
   - If it’s below the viewport: bottom‑align focused.
   - If it’s above the viewport: top‑align focused.
   

## Core flows

1. Open/reload:
   - If the last message has an assistant: alignTo(last assistant,'bottom').
   - If the last message has no assistant (only user): alignTo(meta,'bottom'). Meta is not focused; it is the position target to ensure it’s visible as the last row.

2. After send (new message request):
   - Mode: remain INPUT
   - Focus: last user part of the new pair
   - Position: one‑shot alignTo(meta,'bottom'); meta is a visual position target only, not focused
   

3. Reply arrival:
   - If user is still in INPUT and the reply does NOT fully fit the Usable Band (`ReplyHeight > usableHeight`):
       - Mode: switch to VIEW
       - Focus: first assistant part of the new reply
       - Position: one‑shot alignTo(first assistant,'top').
   - If user is still in INPUT and the reply fully fits (`ReplyHeight ≤ usableHeight`):
       - Mode: remain INPUT
       - Focus: first assistant part
       - Position: one‑shot alignTo(last assistant,'bottom') so the entire reply is visible (≤1 px tolerance).
    - If user left INPUT while waiting (currently in VIEW/COMMAND):
       - Mode and focus are preserved; no automatic changes are applied.

4. Filter (COMMAND mode): apply vs clear
    - Enter (apply): Pressing Enter in COMMAND applies the current filter value (including empty to clear any previously applied filter) and rebuilds the history. Mode switches to VIEW.
       - Focus after rebuild:
          - If the previously focused part still exists in the filtered set (including the equivalent part when partitioning changed within the same pair and role), keep that part focused.
          - Otherwise, focus the last part of the filtered set (if any). If the result is empty, there is no focused part.
       - Anchored position: After focus is chosen (preserved or last), perform a one‑shot bottom anchor: alignTo(focused,'bottom') with clamping to [0, maxScroll]. If the filtered set is empty, no anchor is applied.
    - Escape (clear input only): Pressing Escape in COMMAND clears the filter input but does NOT apply it. History is NOT rebuilt and the mode remains COMMAND. This is equivalent to Ctrl‑U or deleting the text with Backspace.
    - Consistency: The filter is applied — and the history is rebuilt — only on Enter in COMMAND.

5. Boundary jump (o / Shift+O):
   - Action: Jump to the first in‑context pair (boundary) and select its first part.
   - Position: one‑shot center on the focused part: alignTo(focused,'center').
   - Mode: unchanged.

6. Jump to newest (n):
   - Action: Jump to the FIRST part of the LAST message (assistant reply if present; otherwise the last user message). Clears the new‑message badge.
   - Focus: first part of the last message.
   - Position: one‑shot bottom anchor of the end‑of‑list visual target:
       - If the last message has assistant parts: alignTo(last assistant,'bottom').
       - Else (no assistant yet): alignTo(meta,'bottom').
     Focus remains on the first part (anchor target may differ from focused).
   - Mode: unchanged.

7. Regular VIEW navigation (j/k):
   - Default (Ensure‑Visible): after each j/k (and mouse click), make the focused part fully visible with the least movement.
       - Symbols: S = historyPane.scrollTop, H = historyPane.clientHeight, G = outerGap (pane padding, same top/bottom), T = offsetTop(focusedPart), h = offsetHeight(focusedPart). Tolerance tol = 1 px. Ignore |S' − S| ≤ 2 px. Clamp S' to [0, maxScroll].
       - Fully visible means: the focused part’s top edge (T) is not above the inner top edge (S + G), and its bottom edge (T + h) is not below the inner bottom edge (S + H − G), within tol.
          - Formal: S ≤ T − G + tol AND T + h ≤ S + H − G + tol.
       - If not fully visible, perform one minimal move:
          - If the top edge is above the inner top edge: S' = T − G (top‑align once).
          - Else if the bottom edge is below the inner bottom edge: S' = T + h − (H − G) (bottom‑align once).
       - No centering in default VIEW.
   
8. g / G (go to first / last):
   - Action: g focuses the first part; G focuses the last part.
   - Position: Apply Ensure‑Visible to the focused part (minimal movement). In practice:
       - g will top‑align the first part if it’s not fully visible; otherwise no scroll.
       - G will bottom‑align the last part if it’s not fully visible; otherwise no scroll.

9. Typewriter (Reading) Regime
   - Toggle: Press r to toggle ON/OFF. While ON, j/k center‑align the focused part (alignTo(...,'center')).
   - OFF triggers: Typewriter Regime turns OFF on g or G, sending a new message, reply arrival, or when a filter is applied (Enter in COMMAND).

10. Settings/Model-driven rebuild
   - Trigger: A settings or model overlay change classified by the selective re-render policy as requiring a history rebuild.
   - Focus: Preserve the previously focused part if it still exists; otherwise fall back to the last part (existing behavior in runtime).
   - Position: After the rebuild completes and measurements are up to date, perform a one-shot bottom anchor on the focused part: alignTo(focused,'bottom'). This ensures the focused item is visible and respects outer gaps.
   - Mode: Unchanged.
   - Scope isolation: This bottom-align is specific to settings/model rebuilds and does not alter other flows defined above (open/reload, send, reply, filter, navigation, typewriter).

11. Last user part special case (bottom alignment proxy):
   - When any core flow above requires bottom-aligning the focused part, AND the focused part is the last user part of its message pair, then bottom-align the meta part of that same pair instead of the user part itself.
   - This ensures consistent positioning at the "end" of a message pair, providing a stable visual anchor regardless of whether the message has an assistant reply or not.
   - Examples:
     - Single user part focused → bottom-align its meta part
     - Multiple user parts, last one focused → bottom-align the meta part  
     - Multiple user parts, non-last one focused → bottom-align the user part itself (normal behavior)
   - Applies to: open/reload, G key, jump to newest (n), filter apply, and any other flow that would bottom-align a focused last user part.

## Meta visibility and fade
   - Top‑align sets targetTop = outerGap.
   - Bottom‑align sets targetBottom = viewportBottom − outerGap.

## Tall parts
By construction, user/assistant parts are partitioned to fit within the usable viewport height:

- Partitioning guarantees text parts fit; tall text parts don’t occur.
- If a non‑partitioned content type is introduced (e.g., media), fall back to Ensure‑Visible: top‑align when revealed from above; bottom‑align when revealed from below. In Typewriter Regime, center‑align such parts.

Future‑proof note: If we introduce content types that bypass partitioning (e.g., media blocks), fall back to Ensure‑Visible semantics — top‑align when coming from above, bottom‑align when coming from below. In Typewriter Regime, center‑align such parts.

## Architecture

Single scroll owner:
`createScrollController(#historyPane)` is the sole writer of `scrollTop`. Callers request one‑shot actions; no persistent policies or background enforcement.

Stateless, imperative controller API:
`alignTo(id, 'top'|'bottom'|'center', animate=false)` and `ensureVisible(id, animate=false)`. Includes programmatic ownership guard and optional easing/duration settings.

Typewriter Regime (optional toggle):
Toggled by `r`. While ON, j/k center‑align; turns OFF on g/G, send, reply arrival, or filter change.

History/runtime sequencing:
Render builds parts → highlight active → remeasure → the initiator issues a single `alignTo` as needed (open/reload, send, reply). `applyActivePart()` is highlight‑only.

## Flicker‑free guarantee
On render: apply initial opacity states and edge overlays before first paint; remeasure, then perform at most one scroll. Per‑part fade uses ≤1 px tolerance near edges to avoid flicker. Aligned targets end outside the fade zone.

## Edge overlays (visual guard)
To make content visually vanish before the top/bottom borders without changing scroll math:
`#historyPane::before/::after` are gradient overlays inset by 1 px to preserve borders, with `pointer-events: none` so they never intercept input. Height = G (gapOuterPx). The gradient goes from var(--bg) at the pane border to transparent at the inner edge of the outer gap.

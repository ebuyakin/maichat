# Scroll Positioning Spec — One‑Shot Actions, Ensure‑Visible, Reading Mode

Date: 2025-09-09
Status: Design – approved for implementation
Owner: History/Scrolling

## Purpose
Define precise rules for positioning the history viewport across open/reload, send/reply, and navigation. The model removes persistent reading regimes and replaces them with simple one‑shot actions plus a default Ensure‑Visible rule, with an optional opt‑in Reading Mode.

## Core definitions
   - Partitioning uses usable height = viewportH − padTop − padBottom (pane paddings).
   - Inter‑message gaps (between/meta/intra) are not deducted from usable height; they’re visual spacing only.

## Global edge rules (highest priority)
1) No blank band above the first rendered part.
2) No blank band below the last rendered part.

Notes:
 - When total content is shorter than the viewport (maxScroll=0), content is pinned to the top; we do not vertically center it. The outer gap is fixed (pane padding) and does not compress; content never touches the borders.

## Positioning vocabulary (precise)
Viewport: the scrollable area of `#historyPane`.
Outer gap: fixed pane padding (top/bottom) defined by `gapOuterPx`; never compresses.
Usable height: `viewportH − padTop − padBottom` (excludes outer gap only).
Ensure‑Visible: minimal‑movement rule – no scroll if fully visible; otherwise top‑align when coming from above, bottom‑align when coming from below.
AlignTo: one‑shot placement of a target at 'top' | 'bottom' | 'center', clamped to [0, maxScroll].

## Positioning primitives
   - location ∈ {'top','bottom','center'}
   - Compute scrollTop to place target at location, respecting outer gap and clamping to [0, maxScroll]. Apply once; do not persist state.
   - If focused is fully visible: no scroll.
   - If it’s below the viewport: bottom‑align focused.
   - If it’s above the viewport: top‑align focused.
   - r toggles on/off.
   - While active: on j/k, center‑align the focused part (alignTo(...,'center')).
   - Ends automatically on g/G, new message sent/arrived, or filter change. Outside Reading Mode, navigation uses Ensure‑Visible only.

Notes:

## Core flows

Open/reload:
   - If the last message has an assistant: alignTo(last assistant,'bottom').
   - If the last message has no assistant (only user): alignTo(meta,'bottom'). Meta is not focused; it is the position target to ensure it’s visible as the last row.

After send:
   - Mode: remain INPUT
   - Focus: last user part of the new pair
   - Position: one‑shot alignTo(meta,'bottom'); meta is a visual position target only, not focused
   - Reading Mode: turns OFF

Reply arrival:
   - Mode: switch to VIEW
   - Focus: first assistant part
   - Position: one‑shot alignTo(first assistant,'top').
   - Mode: remain INPUT
   - Focus: first assistant part
   - Position: one‑shot alignTo(last assistant,'bottom') so the entire reply remains visible (uses ≤1 px tolerance).

VIEW navigation (j/k):
    - Default (Ensure‑Visible): after each j/k (and mouse click), make the focused part fully visible with the least movement.
       - Symbols: S = historyPane.scrollTop, H = historyPane.clientHeight, G = outerGap (pane padding, same top/bottom), T = offsetTop(focusedPart), h = offsetHeight(focusedPart). Tolerance tol = 1 px. Ignore |S' − S| ≤ 2 px. Clamp S' to [0, maxScroll].
       - Fully visible means: the focused part’s top edge (T) is not above the inner top edge (S + G), and its bottom edge (T + h) is not below the inner bottom edge (S + H − G), within tol.
          - Formal: S ≤ T − G + tol AND T + h ≤ S + H − G + tol.
       - If not fully visible, perform one minimal move:
          - If the top edge is above the inner top edge: S' = T − G (top‑align once).
          - Else if the bottom edge is below the inner bottom edge: S' = T + h − (H − G) (bottom‑align once).
       - No centering in default VIEW.
    
   - Reading Mode ON (toggled by r): center‑align on every j/k
   - g/G: jump to first/last via Ensure‑Visible and exit Reading Mode

## Meta visibility and fade
   - Top‑align sets targetTop = outerGap.
   - Bottom‑align sets targetBottom = viewportBottom − outerGap.

## Tall parts
By construction, user/assistant parts are partitioned to fit within the usable viewport height:

- Partitioning guarantees text parts fit; tall text parts don’t occur.
- If a non‑partitioned content type is introduced (e.g., media), fall back to Ensure‑Visible: top‑align when revealed from above; bottom‑align when revealed from below. In Reading Mode, center‑align such parts.

Future‑proof note: If we introduce content types that bypass partitioning (e.g., media blocks), fall back to Ensure‑Visible semantics — top‑align when coming from above, bottom‑align when coming from below. In Reading Mode, center‑align such parts.

## Architecture

Single scroll owner:
`createScrollController(#historyPane)` is the sole writer of `scrollTop`. Callers request one‑shot actions; no persistent policies or background enforcement.

Stateless, imperative controller API:
`alignTo(id, 'top'|'bottom'|'center', animate=false)` and `ensureVisible(id, animate=false)`. Includes programmatic ownership guard and optional easing/duration settings.

Reading Mode (optional toggle):
Toggled by `r`. While ON, j/k center‑align; turns OFF on g/G, send, reply arrival, or filter change.

History/runtime sequencing:
Render builds parts → highlight active → remeasure → the initiator issues a single `alignTo` as needed (open/reload, send, reply). `applyActivePart()` is highlight‑only.

## Flicker‑free guarantee
On render: apply initial opacity states and edge overlays before first paint; remeasure, then perform at most one scroll. Per‑part fade uses ≤1 px tolerance near edges to avoid flicker. Aligned targets end outside the fade zone.

## Edge overlays (visual guard)
To make content visually vanish before the top/bottom borders without changing scroll math:
`#historyPane::before/::after` are gradient overlays inset by 1 px to preserve borders, with `pointer-events: none` so they never intercept input. Height = G (gapOuterPx). The gradient goes from var(--bg) at the pane border to transparent at the inner edge of the outer gap.

## Step‑by‑step implementation plan
1) Controller API (stateless)
    - Implement alignTo(top/bottom/center) with clamping and outer gap.
    - Implement ensureVisible() minimal‑movement rule.
    - Keep programmatic scroll ownership guard and animation settings.

2) History/runtime sequencing
    - On events (open/reload, send, reply), remeasure then issue one alignTo.
    - Keep applyActivePart() highlight‑only.

3) Lifecycle wiring (send/reply)
    - After send: focus new user; alignTo(meta,'bottom').
    - Reply arrival: compute fits; S1 top‑align first assistant + switch to VIEW; S2 bottom‑align last assistant + remain INPUT.
    - If user left INPUT before reply, no action.

4) Interaction integration
    - VIEW j/k: Ensure‑Visible unless Reading Mode active; in Reading Mode, center‑align.
   - Reading Mode toggles on r (press r to toggle on/off); exits on g/G, send/reply, or filter change.
    - Scroll listeners use the ownership guard to ignore controller‑driven scrolls.

5) CSS edge overlays (visual guard)
   - Add `#historyPane::before` (top) and `::after` (bottom) gradient overlays.
   - Height = gapOuterPx; pointer‑events: none; positioned at the pane edges; fade from var(--bg) at the border to transparent at the inner edge of the outer gap.
   - Verify they do not obscure pane border lines and do not affect input.

6) Per‑part fade interaction
   - Keep ≤1 px tolerance to avoid boundary flicker.
   - Ensure aligned targets remain fully visible at the overlays’ transparent edge.

7) Settings/UI cleanup
   - Remove controller usage of legacy anchorMode; mark as deprecated in settings UI (or hide).
   - Confirm partFraction, padding and gaps, and fade settings remain effective.

8) Docs and instrumentation
   - Update ARCHITECTURE.md to reflect stateless controller, one‑shot actions, Reading Mode toggle, and CSS edge overlays.
   - (Optional) HUD: show Reading Mode ON/OFF and last scroll action.

9) Tests and quality gates
   - Add unit tests for ensureVisible and alignTo clamping.
   - Run full unit suite after steps 1–4; overlay is CSS‑only, so verify with manual QA checklist.

## Existing settings (unchanged) and their interaction
Layout & spacing:
- partPadding, gapOuterPx, gapMetaPx, gapIntraPx, gapBetweenPx — affect measurements and visual spacing only. Outer gap is pane padding and stays fixed.

Reading & anchoring:
- The controller no longer uses legacy anchorMode; behavior is driven by one‑shot actions and Ensure‑Visible. The UI option can be hidden or marked deprecated without affecting runtime.
- edgeAnchoringMode — unchanged; all one‑shots clamp to [0, maxScroll].

Fading & visibility:
- fadeMode, fadeHiddenOpacity, fadeInMs, fadeOutMs, fadeTransitionMs — control per‑part opacity transitions. Aligned targets are placed outside the fade zone; a ≤1 px tolerance avoids boundary flicker.

Scroll animation:
- scrollAnimMs, scrollAnimEasing, scrollAnimDynamic, scrollAnimMinMs, scrollAnimMaxMs — used when alignTo/ensureVisible is invoked with animate=true. Default one‑shots prefer animate=false for deterministic sequencing.

Partitioning:
- partFraction — influences partition size; partitioning ensures parts fit the usable height (no tall text parts). Actions use measured positions.

Edge overlays:
- Height = gapOuterPx; CSS‑only treatment on `#historyPane::before/::after` that fades content within the outer gap; pointer‑events: none.

Unrelated to scrolling:
- charsPerToken, userRequestAllowance, maxTrimAttempts, assumedUserTokens, showTrimNotice — compose/budgeting settings; unaffected by scroll logic.

## Files impacted (adds/changes)
- src/features/history/scrollControllerV3.js — stateless alignTo/ensureVisible; remove persistent policies/enforce.
- src/features/history/historyRuntime.js — remeasure on render; highlight‑only apply; callers issue one‑shots as needed.
- src/features/history/newMessageLifecycle.js — issue one‑shots for send/reply per flows; no manual scrollTop.
- src/features/interaction/interaction.js — j/k Ensure‑Visible; Reading Mode centers; send/post‑reply one‑shots; no policy management.
- src/runtime/runtimeSetup.js — wire alignTo to lifecycle; drop policy/enforce wiring.
- docs/ARCHITECTURE.md — describe stateless controller and CSS edge overlays.

## Open questions / follow‑ups
– Settings UI: hide or mark legacy `anchorMode` as deprecated (behavior is stateless).
– Tests: add unit coverage for startup open/reload alignment and ensureVisible clamping (optional).
– Performance: validate large histories maintain smooth scroll with overlays and fades.

## Acceptance criteria
- No blank bands above first or below last part (clamped to [0, maxScroll]).
- Content never appears to touch the pane borders; fades within outer gap.
- Open/reload: focus last non‑meta of last message. If last assistant exists, bottom‑align last assistant; otherwise bottom‑align meta. Meta is not focused.
- After send: remain in INPUT; focus last user part of the new pair; bottom‑align the new meta row (one‑shot, no follow‑up auto‑scrolls).
- Reply not fit: switch to VIEW; focus first assistant part; top‑align it (one‑shot).
- Reply fits: remain in INPUT; focus first assistant part; bottom‑align the last assistant part so the whole reply is visible (≤1 px tolerance).
- VIEW navigation j/k: minimal scrolling via Ensure‑Visible; only scroll when focused part is outside the viewport. If Reading Mode is ON, center on every j/k.
- g/G: jump to first/last; Ensure‑Visible; Reading Mode turns OFF.
- CSS edge overlays don’t intercept input (pointer‑events: none) and don’t obscure border lines (1 px inset maintained). Content fades within the outer gap.

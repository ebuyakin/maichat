# Scrolling & Fading System

Status: Active (M5 stabilized) – single authoritative reference for scrolling, anchoring and edge fading. Mathematical appendix retained in full.

## 1. Overview
The history pane presents a linear list of message parts. Scrolling behavior anchors the active part (user-selected) at a user-chosen reading position (top / center / bottom). Layout uses only structural padding + native scrolling (no spacer insertion). Edge fading (binary or gradient) visually deemphasizes any fragment of a part that intrudes into the outer gap zones.

Core components:
* scrollControllerV3 – measurement, target scrollTop computation, optional smooth animation, single deferred validation with dead‑band.
* ActivePartController – tracks active index (navigation j/k/g/G etc.).
* Fading logic (in main rendering layer) – computes opacity adjustments for intruding edges on scroll.

## 2. Key Invariants
1. Deterministic anchor: For a given active part index k and mode m, the target scrollTop is a pure function of current measured geometry + mode.
2. Constant outer gap (top mode): Visual gap above active part equals configured padding (gapOuterPx).
3. Center alignment tolerance: Active part midpoint aligns to viewport midpoint within ±2px (dead‑band suppresses micro corrections).
4. Bottom mode gap: Visual gap below active part remains within ±2px of configured bottom padding.
5. Flicker-free: No second-scroll corrections unless |drift| > 2px (ADJUST_THRESHOLD = 2).
6. Stable opacity transitions: Only opacity changes during fading; no layout mutating elements for masking.
7. Idempotent application: Re-applying anchor for same (mode, activeIndex) does not visibly move viewport (difference ≤ 1px or suppressed by dead‑band).

## 3. Implementation Details
Measurement collects each `.part` node’s offsetTop/height. start coordinate is `offsetTop - paddingTop`, eliminating dependency on variable leading gaps.

Anchor formulas (raw S before clamp):
* Top: `S = part.start`
* Bottom: `S = (part.start + part.h) - (paneH - padBottom) + padTop`
* Center: `S = part.start + padTop + part.h/2 - paneH/2`

Clamping: `S2 = clamp(round(S), 0, maxScroll)`.

Animation: Optional smooth interpolation (easeOutQuad default) honoring user settings for duration scaling; on completion a single `validate()` executes.

## 4. Dead‑band Drift Correction
After layout/animation settle, validation recomputes the target. If `|target - currentScrollTop| > 2px`, a single corrective set occurs; otherwise correction is skipped to avoid perceptible “micro second-scroll” flicker. Center mode midpoint fine-tune uses the same threshold.

Rationale: Typical drift (<1–2px) stems from subpixel font metrics & rounding; eliminating needless correction produces visual stability.

## 5. Edge Fading Logic
Let S = scrollTop, H = viewport height, G = gapOuterPx. Usable band: `[S+G, S+H-G]`.

For each part (top_i, bottom_i):
* Top intrusion height = `(S+G) - top_i` if `top_i < S+G < bottom_i` else 0
* Bottom intrusion height = `bottom_i - (S+H-G)` if `top_i < S+H-G < bottom_i` else 0

Binary mode: Intruding part opacity = hiddenOpacity (default 0) else 1.
Gradient mode: Opacity transitions from hiddenOpacity at intruding boundary to 1 inside usable band (linear for now; could adopt smoother curve later).

Active part is never faded.

## 6. Debug & Diagnostics
HUD fields (summary): mode, activeIndex, firstVisible, scrollTop, drift vs target (if any), gap consistency, animationEnabled.
Toggle commands:
* `:anim on|off` – enable/disable smooth animation.
* `:scrolllog on|off` – log validate corrections and center adjustments.

## 7. Future Work
1. Virtualization (windowed rendering) – optional for very large histories.
2. Adaptive blank-space suppression completion (refinement in strict vs adaptive interplay when near list end).
3. Scroll snapping for free-wheel inertial scroll (optional: snap to nearest anchor after user stops).
4. Non-linear gradient shaping (ease-in opacity for less perceptible boundary).
5. Performance batching for large numbers of parts (opacity updates via single CSS variable).

## 8. Historical Summary (Former Issues)
Legacy architecture suffered from: competing scroll actors (anchorManager vs windowScroller), margin-based gap ambiguity, double-validation causing flicker, lack of drift tolerance, and overlay mask complexity. Replaced by single controller + padding + fading.

## 9. Appendix: Mathematical Model (Full)
The following is preserved verbatim (with terminology adjusted slightly) from the earlier vertical positioning specification for rigorous reasoning and future test derivations.

### A. Data Model
Parts p_0 .. p_{M-1} with heights; outer gaps g_0 = g_M = G (top/bottom padding). Internal gaps g_1 .. g_{M-1} explicit (could be 0). Linear sequence:
`g_0, p_0, g_1, p_1, ..., g_{M-1}, p_{M-1}, g_M`.

Total height: `T = g_0 + Σ_{i=0}^{M-1}(p_i + g_{i+1})`.

Viewport height D; scroll position S selects [S, S + D).

### B. Prefix Sums
Let C[0] = 0; define block B_i = p_i + g_{i+1}. Then `C[k+1] = C[k] + B_i` and part k start coordinate (excluding top padding) is `C[k]`.

### C. Top Mode
Desired gap above active part k = G (outer padding). Required scrollTop `S = C[k]` (clamp to [0, T-D]).

### D. Bottom Mode
Let end of part k = `C[k] + p_k`. Required scrollTop `S = (C[k] + p_k) - (D - G)`.

### E. Center Mode
Midpoint of part k = `C[k] + p_k/2`. Required `S = (C[k] + p_k/2) - D/2`.

### F. Intrusion Fading (Mapping)
Top intrusion occurs if `C[i] < S+G < C[i] + p_i`.
Bottom intrusion occurs if `C[i] < S + D - G < C[i] + p_i`.

### G. Stability
Recomputations use absolute prefix sums (no cumulative error). Dead‑band addresses rounding noise.

### H. Verification Metrics
For active k: `target = formula(k)`, `drift = currentScrollTop - target`. Must satisfy `|drift| ≤ 2` without corrective scroll.

### I. Extension Hooks
Virtualization can redefine effective C via offset baseline while preserving the same formulas; fading calculations adapt by adding an offset to S and part coordinates.

---
End of document.

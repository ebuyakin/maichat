# Message History Vertical Positioning (Top Reading Mode Focus)

This document explains *precisely* how vertical placement of parts (message parts + gaps) inside `#historyPane` should work, separating the simple target model from the complications that crept in. It is meant to be the authoritative reference for redesign / refactor.

## 1. Vocabulary

Term | Meaning
---- | -------
part | A rendered user / assistant (or meta) content block
meta part | Non-content informational part (timestamp/topic etc.) – can be excluded from navigation if desired
preceding gap (g_i) | Explicit gap element immediately before part i (height may vary by type)
outer gap (G) | User setting `gapOuterPx`; constant visual space (also fade zone boundary) between pane top and the active part when in top mode
H_i | Height of part i (its DOM box height)
S_k | Cumulative height of all displayed items (gaps + parts) before part k
scrollTop | Standard scroll position of `#historyPane` content
padding-top | CSS padding on `#historyPane` (can be used to implement outer gap cleanly)

## 2. Structural Stack

Inside the scrollable area (content box of `#historyPane`) the vertical order is:

```
[ padding-top (G) ]
[ gap_0? ] [ part_0 ] [ gap_1? ] [ part_1 ] ... [ gap_{n-1}? ] [ part_{n-1} ]
[ padding-bottom (G) ]
```

Every element’s top position within the scroll content is the sum of heights of everything before it (standard block flow).

## 3. Coordinate Systems

Perspective | What it measures
----------- | -----------------
`scrollTop` | How far we have scrolled downward inside the pane’s content box
`offsetTop` | Distance from the element’s *offset parent* content box (ignores scrollTop, includes padding-top)
`getBoundingClientRect().top` | Screen (viewport) position; subtract container rect top to get a relative measure that *includes* padding
HUD `firstTopPx` (current implementation) | `partRect.top - containerRect.top` (thus includes padding-top)
Logical visual gap we want | Distance from inner edge of padding (content start) to the part’s top, i.e. `(partRect.top - (containerRect.top + paddingTop))`

## 4. Ideal Top Mode Model (Target Specification)

Goal: In top reading mode the active part k must appear with *exact* outer gap G above it, independent of preceding gap type or navigation direction. No relaxation.

Definitions:

```
S_k = Σ_{i=0}^{k-1} (g_i + H_i)   (sum of all gap+part heights before part k)
```

If we implement the outer gap solely as padding-top = G, then the correct scroll position is:

```
scrollTop_target(k) = S_k
```

Why it works:
- The top of part k inside the content box is `padding-top + S_k = G + S_k`.
- Visible gap above part k = `(offsetTop_k - scrollTop) = (G + S_k) - S_k = G`.
- No need to insert/remove spacer elements or subtract preceding gap.

## 5. Minimal Algorithm (Deterministic)

Input: active index k.

1. Ensure `#historyPane` has `padding-top = padding-bottom = G`.
2. Maintain (or compute on the fly) prefix sums `S_k` for all k (can be O(1) with an array rebuilt on remeasure).
3. Set `scrollTop = S_k` directly (optional smooth animation toward S_k). Suppress post-adjustments ≤2px (dead-band) to avoid flicker.
4. Deferred validate: recompute S_k; if `|scrollTop - S_k| > 2`, correct once.
5. HUD logical gap: compute `(partRect.top - containerRect.top - paddingTop)` to display and assert it equals G.

## 6. Where Prior Attempts Went Wrong

Problem Source | Effect
-------------- | ------
Subtracting `gBefore` | Shrinks or stretches the visual gap depending on gap type
Multiple outer gap mechanisms (offset positioning + spacer + padding) | Conflicting references create drift
Spacer insertion/removal | Changes DOM heights between measure & application → inconsistent S_k
Validation realigning via a different formula | Introduces tug-of-war; can overshoot
Using rect-based measurement for debugging but offset-based for scroll math | Constant offsets or negative artifact values
Smooth animation sampling mid-transition | HUD shows transient negative/partial gap positions
Including meta parts inconsistently in navigation vs measurement | Active index ≠ first index, breaking expectation that active is first in top mode

## 7. Debug Metrics (Recommended Set)

Name | Definition
---- | ----------
activeIndex | k (current active part index in the measurement array)
firstIndex | Should equal k in strict top mode
S_k | Prefix sum (report for transparency)
scrollTop | Current scrollTop
targetScrollTop | Computed S_k
paddingTop | Current pane padding-top
visualGap | `partRect.top - (paneRect.top + paddingTop)` (should equal G)
rawFirstTopPx | `partRect.top - paneRect.top` (equals `paddingTop + visualGap`)

## 8. Meta Parts Policy

Decision option:
- Treat meta parts exactly like any other part (simplest); navigation includes them; S_k honors their heights.
OR
- Exclude them entirely from navigation AND prefix sums if they are purely decorative (must then still add their heights to cumulative layout for other parts). Simpler for invariants is to include them uniformly.

## 9. Edge Cases & Guarantees

Edge Case | Handling
--------- | ---------
Very tall single part taller than viewport | It still gets `scrollTop = S_k`; user scrolls inside it with j/k moving between its internal *sub-parts* (if partitioned) else we may need internal paging
Dynamic content growth (assistant streaming) | After growth, recompute prefix sums and re-apply `scrollTop = new S_k`; this may cause a slight jump (acceptable in strict model) – can smooth if needed
Window resize | Re-measure heights, rebuild prefix sums, reapply active top rule
Gap height setting change | Same as resize: remeasure + reapply; deterministic top alignment preserved

## 10. Implementation Checklist (Refactor Plan)

1. Single source of outer gap: pane padding.
2. Rebuild measurement: produce arrays of `g[i]`, `h[i]`, prefix sums `S[i]`.
3. Top mode apply: `scrollTop = S[active]` (no subtractions).
4. Remove spacer / relaxed logic / gap hiding.
5. HUD adjust to show `visualGap` and `S_k` vs `scrollTop` diff.
6. Add assertion: `|visualGap - G| < 0.5px`. If fails, force `scrollTop = S_k` again next frame.
7. Unit test (logic only): synthetic list with varied gaps; iterate active index; confirm computed `visualGap` equals G.

## 11. Why This Cannot Drift

Because every top-mode application bases the target solely on the prefix sum of *actual* current DOM-measured heights before the active element, and the padding is constant. There is no accumulated error: each step is absolute, not incremental.

## 12. Optional Optimizations (Later)

- Cache prefix sums and invalidate only changed segments when inserting/removing pairs.
- Skip double reflow by using `getBoundingClientRect` once for all part nodes.
- Lazy remeasure on height mutation observer events instead of every navigation.

## 13. Visual Sanity Test Procedure

1. Set outer gap G = 20.
2. Navigate j repeatedly from first to, say, first 50 parts.
3. Record (visualGap, scrollTop - S_k). Both should stay (20, 0) within ±0.5px.
4. Change gapBetweenPx drastically (e.g., 4 → 40) and repeat. Still stable.
5. Resize window height by >20%. Re-run steps 2–3.

## 14. Status Summary

Top-mode logic integrated into unified `scrollControllerV3`; bottom & center use analogous absolute prefix computations. Single deferred validate with 2px dead-band implemented; no separate topModeController required.

---
Feedback invited: mark anything unclear or suggest additions; we’ll refine before coding the clean rewrite.

---

# (Appendix) Simplified Mathematical Core Model

This section restates the scrolling / positioning principle using only abstract math objects (no browser terms) to make the core invariant obvious.

## A. Data Model

We introduce a consistent indexing that avoids collisions and ambiguity.

- Let there be M parts with heights: p_0, p_1, ..., p_{M-1}.
- Let there be M+1 gaps: g_0 (outer top), g_1 .. g_{M-1} (internal), g_M (outer bottom; may be 0 if unused).
- Linear vertical sequence:
	g_0, p_0, g_1, p_1, g_2, p_2, ..., g_{M-1}, p_{M-1}, g_M
- Total height:
	T = g_0 + ( Σ_{i=0}^{M-1} (p_i + g_{i+1}) )   (treat g_M = 0 if no bottom outer gap)
- Viewport height (constant during navigation): D.
- Scroll position S (0 ≤ S ≤ T − D) selects visible interval [S, S + D).

## B. Start Coordinates (Prefix Sums)

Define the start (top) coordinate of each part k (0-based):

start_part_0 = g_0
start_part_k = g_0 + Σ_{i=0}^{k-1} (p_i + g_{i+1})   for k > 0

(Empty sum for k=0 is 0.)

Alternative with a prefix array for efficiency:
Let C[0] = 0 and define block B_i = p_i + g_{i+1} for 0 ≤ i < M.
Then C[k+1] = C[k] + B_i, and start_part_k = g_0 + C[k].

Part k occupies interval [ start_part_k , start_part_k + p_k ).

## C. Top Mode (Constant Outer Gap G)

Set outer gap G = g_0.
Desired invariant: gap above active part k equals G.

Required scroll position:
S = start_part_k − G = (g_0 + C[k]) − g_0 = C[k]

So in top mode S is simply the prefix sum of all (p_i + g_{i+1}) before k. For k = 0, S = 0.

Clamp: S_final = min( max(S, 0), T − D ). (Usually C[k] already satisfies this except near the end if the viewport extends beyond T.)

## D. Bottom Mode (Optional Definition)

If we also want a constant gap G below the active part k (mirroring top):
end_part_k = start_part_k + p_k
S = end_part_k − (D − G)
Clamp to [0, T − D].

## E. Center Mode (Optional Definition)

mid_part_k = start_part_k + p_k / 2
S = mid_part_k − D / 2
Clamp.

## F. Optional Full-or-Hidden Snapping

After computing S you may snap so that no element is partially visible (strict layout mode):
1. Determine first visible element a: its start < S + D and end > S.
2. If its start < S, set S = its start (align top).
3. Else compute last visible element b; if b end > S + D, set S = (start of element after b) − D.
4. Re-clamp.

## G. Stability Rationale

Each navigation computes S from absolute prefix sums C[k]; previous S is ignored. No cumulative rounding drift occurs because each C[k] is a single stored number derived from current measured heights.

## H. Debug / Verification Metrics

For active part k:
- targetScroll = C[k]
- observedScroll = current S
- gapObserved = start_part_k − observedScroll (should ≈ g_0)
- delta = observedScroll − targetScroll (should ≈ 0)

If |gapObserved − g_0| > ε (e.g. 0.5) reapply S = C[k].

## I. Meta Parts Inclusion Policy

If meta parts are navigable, treat them as normal parts (with their own p_k and adjacent gaps) and they fit into the same C[k]. If they should be skipped in navigation, you can still include their heights in C while mapping navigation indices to structural indices.

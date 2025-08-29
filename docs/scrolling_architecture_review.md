# Scrolling & Part Visibility Architecture Review

## 1. Problem Statement
Despite detailed behavioural specs, current implementation still shows:
- Inconsistent top edge gap in Top reading mode.
- Partially clipped parts above or below the active part.
- Variability after sequential j/k navigation.

The behaviour is conceptually simple (full-or-hidden parts, fixed edge gaps), so persistent failure indicates architectural mismatches rather than minor logic bugs.

## 2. Current Pipeline Overview
1. Partitioning: Splits messages into parts using `maxLines = floor(paneHeight * partFraction / lineHeight)`.
2. Rendering (`historyView.render`): Emits linear DOM of `.pair > .part` nodes; margins (vertical gaps) injected by runtime style sheet, not inline.
3. Active Part Controller: Tracks index; navigation mutates index.
4. Scrolling Layer(s):
   - Unified `scrollControllerV3` (single authority: computes target scrollTop, optional smooth animation, single post-animation validate with ≤2px dead-band).
5. Measurement: `windowScroller.measure()` gathers `offsetTop`, `height`, and `marginTop` per part after rendering.
6. Window Selection: Chooses slice to display based on anchor mode, packing successful parts within available pane height.
7. Snap: Scroll container to computed canonical `scrollTop`.

## 3. Root Causes of Current Failures
### 3.1 Mixed Responsibility / Competing Systems
`anchorManager` and `windowScroller` both manipulate scroll. Even if the new code *intends* to dominate, residual asynchronous animations or earlier RAF tasks from `anchorManager` can adjust scroll after `windowScroller` snaps, reintroducing partial visibility.

### 3.2 Post-Layout Margins vs Logical Model (Legacy Issue)
Margins are defined on *following* elements (top margins). When the first visible part is not the DOM's first part, its `margin-top` represents a semantic gap *between* hidden and visible content — but we want to ignore that hidden-side margin. The current approach subtracts `marginTop` from `offsetTop`, but that only works if the part's margin fully belongs to the hidden boundary. Edge cases:
- Consecutive user parts: combined stack of margins; selecting a later part can still inherit margin from an immediately hidden sibling.
- Browser may collapse margins under certain structures (not here often, but meta parts + varying padding can interact).

### 3.3 Timing and Single Measurement Pass
Measurement occurs in a single RAF after render. Font metrics, scrollbar appearance, or dynamic content (async assistant reply insertion) can shift heights the next frame, invalidating cached heights. Scroll snap then uses stale values; visible result: ~1–3px drift or partial clipping.

### 3.4 Lack of Canonical First-Index Derivation
Current window selection starts from *active index* and tries to expand. This couples slice selection to active index order rather than deriving the set of all feasible first indices and picking one by rule. Missing invariant: "If first visible index = f then scrollTop = canonical(f) regardless of active index within window (unless relaxation)."

### 3.5 Visibility Handling
Original concern about explicitly slicing visible partitions is deferred. Current approach keeps full DOM, relying on stable padding + dead-band correction and edge fading (no spacer or mask elements). Performance acceptable at present scale; virtualization remains future work.

### 3.6 Gaps Implemented via Margins not Structural Blocks
Edge gap uses container inset, but internal gaps use margins. Margins entangle measurement and packing (especially forward fill). A more reliable model is gap *elements* (spacers) or using CSS logical block padding on *window group wrapper* rather than per-part margins.

### 3.7 Post-Scroll Validation (Resolved)
We run exactly one deferred validation after animation; sub‑2px drift ignored to prevent perceptible flicker.

## 4. Architectural Constraints & Their Effects
| Constraint | Effect | Severity |
|-----------|--------|----------|
| Full DOM always rendered | Acceptable with edge fading; measurement stable | Low |
| Margins represent gaps | Replaced by explicit padding strategy | Resolved |
| Dual scroll controllers | Single controller eliminates races | Resolved |
| Single measurement pass | Single pass + deferred validate sufficient | Resolved |
| Packing anchored to active index | Window not canonical for same first index | Medium |
| No post-animation correction | Drift persists | Low-Med |

## 5. Proposed Refactor (V3 Scrolling)
### Core Principles
1. **Single Source of Truth:** Eliminate `anchorManager`; one module orchestrates all scroll positioning.
2. **Canonical First Index Table:** Pre-compute feasible first indices F = {f | window starting at f fits entirely}. Each f maps to canonical scrollTop = parts[f].offsetTop - effectiveTopAdjustment(f).
3. **Active-Index Projection:** Given active index a and mode m, derive candidate first index f(m,a) using rules, then adjust for relaxation (can we shift without hiding potential content?).
4. **Visibility Policy:** Keep all parts in DOM; apply fading (binary or gradient) to intruding edges to reduce distraction without layout churn. (Virtualization is future optimization.)
5. **Structural Gaps / Padding Strategy:** Simplify to consistent padding and per-part spacing without dynamic spacer insertion; fading handles perceptual edge tapering.
6. **Measurement:** Single measurement + one deferred validate; only adjustments >2px trigger a correction.
7. **Wheel & Key Unified Path:** Both call `setActive(a')` -> recompute f -> snap. No wheel-specific scrolling deltas.
8. **Idempotent Snap:** Repeated snaps to same target are no-ops; drift threshold prevents cosmetic corrections.

### Data Structures
```
partMeta: { id, rawHeight, role }
canonical: [{ firstIndex, lastIndex, scrollTop }]
state: { activeIndex, firstIndex, mode }
```

### Algorithms
1. Build `heights[]` and `prefix[]` after measurement (prefix[0]=0; prefix[i]=sum_{k<i}(heights[k]+gapAfter[k])).
2. Feasible first index f is valid if there exists a maximal last l >= f such that prefix[l+1]-prefix[f] ≤ paneHeight.
3. For each f compute its `lastIndex[f]` and canonical scrollTop = prefix[f] - G (edge gap). (Edge gap guaranteed because part heights constrained.)
4. Mode mapping:
   - Top: f = a (unless relaxation). If f invalid (because part bigger) — cannot happen due to partition invariant.
   - Bottom: choose f so that lastIndex[f] >= a and lastIndex[f] minimal under that condition.
   - Center: choose window covering a minimizing |(a - mid(f,l))|; relaxation when at boundaries.
5. Relaxation: If bottom-most window from chosen f already includes final part (l == N-1) and mode is top, allow shifting f upward (while preserving a inside slice) to maximize fill.

### Rendering Enforcement
- Maintain a content wrapper. Inside it, render only parts [firstIndex .. lastIndex]. Optionally keep placeholders (zero height) for others if we want stable scrollTop meaning (but canonical math sets scrollTop so placeholders not required). Simpler: keep full DOM but set `.hidden-part { display:none }` for out-of-window parts to eliminate their layout impact.

## 6. Migration Steps
1. Replace vertical margins with explicit gap/padding strategy. (Done)
2. Introduce unified `scrollControllerV3`. (Done)
3. Add deferred validate with dead-band threshold. (Done)
4. Edge fading replaces any need for overlay masks. (Done)
5. Add invariant test suite.

## 7. Risks & Mitigations
| Risk | Mitigation |
|------|------------|
| Performance cost of re-render on each navigation | Only toggle visibility classes; reuse nodes. |
| Complexity of gap nodes increasing DOM count | Keep O(N) nodes; acceptable for moderate history sizes; later virtualization. |
| Race with async content edits | Re-run measurement diff (observer) only for changed pairs. |
| Focus flicker during double RAF adjust | Hide adjustment by immediate jump first, short smooth only on user-initiated navigation. |

## 8. Test Plan
1. Unit: canonical window builder given synthetic heights & gaps (deterministic). 
2. Unit: top/bottom/center selection across boundaries.
3. Integration (jsdom approximation): simulate navigation j/k with mocked heights; assert no partial (via computed first/last boundaries fits within paneHeight - 2*G).
4. Visual manual: edge gap consistency, relaxation correctness.

## 9. Action Plan (Execution Order)
1. Strip legacy anchor code (anchorManager usage) & current windowScroller.
2. Refactor spacing: remove margin rules; generate gap divs in `historyView`.
3. Implement `scrollControllerV3` with canonical table build.
4. Integrate navigation paths (j/k, wheel) to call new controller.
5. Add test suite for window canonicalization.
6. Validate visually; tune center mode heuristics.
7. Cleanup: remove obsolete styles & modules.
8. Document final behaviour in `padding.md` (rename section to Layout & Scrolling V3).

## 10. Conclusion
Legacy failures stemmed from passive overflow + margins + multiple scroll actors. V3 introduces a single controller, padding-based gaps, and fade-based edge treatment—resolving root causes instead of papering over them.

---
Prepared: 2025-08-25


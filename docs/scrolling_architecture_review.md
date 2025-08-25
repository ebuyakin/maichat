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
   - Legacy `anchorManager.applyAnchor` (smooth scroll to align active part per anchor mode).
   - New `windowScroller` layering canonical window computation & wheel interception.
5. Measurement: `windowScroller.measure()` gathers `offsetTop`, `height`, and `marginTop` per part after rendering.
6. Window Selection: Chooses slice to display based on anchor mode, packing successful parts within available pane height.
7. Snap: Scroll container to computed canonical `scrollTop`.

## 3. Root Causes of Current Failures
### 3.1 Mixed Responsibility / Competing Systems
`anchorManager` and `windowScroller` both manipulate scroll. Even if the new code *intends* to dominate, residual asynchronous animations or earlier RAF tasks from `anchorManager` can adjust scroll after `windowScroller` snaps, reintroducing partial visibility.

### 3.2 Post-Layout Margins vs Logical Model
Margins are defined on *following* elements (top margins). When the first visible part is not the DOM's first part, its `margin-top` represents a semantic gap *between* hidden and visible content — but we want to ignore that hidden-side margin. The current approach subtracts `marginTop` from `offsetTop`, but that only works if the part's margin fully belongs to the hidden boundary. Edge cases:
- Consecutive user parts: combined stack of margins; selecting a later part can still inherit margin from an immediately hidden sibling.
- Browser may collapse margins under certain structures (not here often, but meta parts + varying padding can interact).

### 3.3 Timing and Single Measurement Pass
Measurement occurs in a single RAF after render. Font metrics, scrollbar appearance, or dynamic content (async assistant reply insertion) can shift heights the next frame, invalidating cached heights. Scroll snap then uses stale values; visible result: ~1–3px drift or partial clipping.

### 3.4 Lack of Canonical First-Index Derivation
Current window selection starts from *active index* and tries to expand. This couples slice selection to active index order rather than deriving the set of all feasible first indices and picking one by rule. Missing invariant: "If first visible index = f then scrollTop = canonical(f) regardless of active index within window (unless relaxation)."

### 3.5 Missing Explicit Hidden / Visible Partition
We rely on natural overflow (scrollTop) instead of explicitly deciding visible range and enforcing it. Without forcibly hiding (display:none) non-window parts, rendering + margins above the window still influence offset calculations, especially during re-measure.

### 3.6 Gaps Implemented via Margins not Structural Blocks
Edge gap uses container inset, but internal gaps use margins. Margins entangle measurement and packing (especially forward fill). A more reliable model is gap *elements* (spacers) or using CSS logical block padding on *window group wrapper* rather than per-part margins.

### 3.7 No Guard Against Partial After Scroll Event
We do not validate after smooth scroll completes that top & bottom parts are fully visible and snap again if needed. Small easing rounding or subpixel values can leave partial lines.

## 4. Architectural Constraints & Their Effects
| Constraint | Effect | Severity |
|-----------|--------|----------|
| Full DOM always rendered | Hidden content's margins & layout influence measurement | High |
| Margins represent gaps | Hard to treat gap above first visible as zero | High |
| Dual scroll controllers | Race conditions & overrides | Medium |
| Single measurement pass | Stale geometry leads to misalignment | Medium |
| Packing anchored to active index | Window not canonical for same first index | Medium |
| No post-animation correction | Drift persists | Low-Med |

## 5. Proposed Refactor (V3 Scrolling)
### Core Principles
1. **Single Source of Truth:** Eliminate `anchorManager`; one module orchestrates all scroll positioning.
2. **Canonical First Index Table:** Pre-compute feasible first indices F = {f | window starting at f fits entirely}. Each f maps to canonical scrollTop = parts[f].offsetTop - effectiveTopAdjustment(f).
3. **Active-Index Projection:** Given active index a and mode m, derive candidate first index f(m,a) using rules, then adjust for relaxation (can we shift without hiding potential content?).
4. **Visibility Enforcement:** Only render (or display:block) parts in window slice; others `visibility:hidden` or `display:none` (while keeping height for measurement if needed). Prefer virtualization lite: maintain a small buffer above/below for smooth future transitions.
5. **Structural Gaps Instead of Margins:** Replace vertical margins with explicit spacer divs inserted by renderer (e.g. `<div class="gap meta-gap" style="height:6px"></div>`). This decouples spacing from part offset inversion and eliminates marginTop arithmetic.
6. **Two-Phase Measurement:** (a) Render skeleton & spacers; (b) RAF measure heights; (c) Derive canonical positions; (d) Apply initial snap; (e) After fonts settle (second RAF) re-verify and adjust if drift > 1px.
7. **Wheel & Key Unified Path:** Both call `setActive(a')` -> recompute f -> snap. No wheel-specific scrolling deltas.
8. **Idempotent Snap:** Repeated snaps to same f are no-ops (avoid animation jitter).

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
1. Remove all vertical `margin-top` logic from runtime spacing; replace with explicit `.gap` nodes.
2. Implement new renderer: sequence = [gap, part, gap, part ...] (skip leading gap).
3. Introduce measurement pipeline and canonical table builder.
4. Replace windowScroller and anchorManager with `scrollControllerV3`.
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
Failures stem from architectural layering issues: relying on passive overflow + margins + multiple scroll actors. A deterministic model requires explicit derivation of feasible windows, structural gaps, and exclusive scroll control. Proposed V3 resolves root causes rather than masking symptoms.

---
Prepared: 2025-08-25


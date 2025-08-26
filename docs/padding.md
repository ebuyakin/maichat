# Layout mananagement and padding control

## 1. DOM structure of the message history (middle pane)

This is my understanding of the DOM tree:

body
    app
        topBar
        historyPane
            history
                pair
                    part user
                    part user // optional
                    ...
                    part meta
                    part assistant
                    part assistant // optional
        inputBar        

This documnent discusses the history pane padding (not topBar or inputBar formatting)

## 2.  What matters to Users. What padding/margins/gaps shall we be able to control.

A. all immediated content nodes (ie nodes containing the messages content - part user, part assistant) shall have some padding around the text. For the part assistant this padding is invisbile as the node has no visible border and its background color is equal to the background color of the history/historyPane (not sure where it's set). For part user the padding shall be visible as this node has dark blue background color. For consistency, I believe the padding shall be the same for both nodes (but visible, invisible depending on the typ) and the size of the padding shall be controlled via settings by the user
B. The gap between parts. There are several types of gaps between parts that in general might have different size:
1. gap between the topBar and the first part user of the first message - call it top gap.
2. gap between the inputBar and the last part of the last message (may be part user or part assistant depending wherther AI responded or thinking) - call it bottom gap.
3. gap between messages, ie gap betweeen the last part assistant of a given message and first part user of the next message - call it between-messages gap
4. gap between last part user of a given message and part meta - call top-meta gap
5. gap between part meta and the first part assistant - call it bottom-meta gap
6. gap between part user and part user (if the user request has several parts) - call in inter-user gap
7. gap between part assistant and part assistant (if the assistant response has several parts) - call it inter-assistant gap.

Generally speaking all gaps types can have different sizes (so they should be programmed to be managed independently?), but for simplicity let's set the following rules:

top gap = bottom gap = gap1
top-meta gap = bottom-meta gap = gap2
inter-user gap = inter-assitang gap = gap3
between-messages gap = gap4

So there are 4 different types of gaps that shall be controlled by the user via settings.

## 3. (Deprecated) Legacy Implementation

Older iterations attempted to control spacing using only:
* Container padding (outer gap) applied via adjusting `#historyPane` top/bottom offsets.
* CSS margins between parts for semantic gap types.
* Scroll alignment formula subtracting the preceding gap height of the active part.

Issues found:
1. Outer gap inconsistency (drift) when the preceding gap varied.
2. Occasional clipping of the active highlight border (top 1px lost) due to external shadows.
3. Visible sliver of previous part in top mode when outer gap > natural preceding gap.
4. Attempts to "fix" the sliver by mutating gap heights post‑render caused jitter and reflow churn.

This approach is retired; retained here only for historical rationale.

## 4. Current Implementation (Explicit Gap Elements + Overlay Mask)

Principles:
1. Explicit gap elements precede parts (e.g. `.gap-between`, `.gap-meta`, `.gap-intra`). Their heights are taken verbatim from user settings.
2. Outer gap (`gapOuterPx`) is structural padding on `#historyPane` (top & bottom). Scroll math never mutates these spacings.
3. A single scroll controller computes alignment. Top mode target = `activeElement.offsetTop - paddingTop` (no subtraction of preceding gap) guaranteeing constant visual outer gap.
4. A top overlay mask (`#historyTopMask`) hides any fragment of a previous part that may intrude into the outer gap region. The mask is purely visual: no DOM height adjustments.
5. Active part highlight uses an inset pseudo-element border so it remains fully visible within the padded area.

Planned additions:
* Bottom outer-gap mask (mirror for bottom reading position).
* Variable "clipped-part" masks (top/bottom) in center or free-scroll cases to hide partial tails without forcing immediate snapping.
* Optional snap pass after free scroll to reduce reliance on variable masks.

Why masks (instead of dynamic gap growth):
* Deterministic layout (prefix sums stable).
* No layout thrash or re-measure loops.
* Clear separation: semantic spacing vs edge visibility policy.

Mask roles summary:
| Mask | Mode | Purpose | Height |
|------|------|---------|--------|
| Top outer-gap-mask | Top mode | Hide predecessor fragment inside outer gap | = `gapOuterPx` |
| Bottom outer-gap-mask (planned) | Bottom mode | Hide successor fragment inside outer gap | = `gapOuterPx` |
| Top clipped-part-mask (planned) | Bottom/Center | Cover partial part at top edge | overlap (capped or uncapped) |
| Bottom clipped-part-mask (planned) | Top/Center | Cover partial part at bottom edge | overlap (capped or uncapped) |

Overlap calculation (planned):
Let `S = scrollTop`, `H = viewport height`, `G = gapOuterPx`, usable band = `[S+G, S+H-G]`.
Top fragment height = `(S+G) - top_i` if `top_i < S+G < bottom_i` else 0.
Bottom fragment height = `bottom_i - (S+H-G)` if `top_i < S+H-G < bottom_i` else 0.
Heights <= 0 → mask hidden.

Current invariants achieved:
* Constant outer gap in top mode.
* No predecessor sliver visible (top mask covers it).
* Active highlight border fully visible.

Pending invariants:
* Symmetric bottom masking.
* Center mode full-or-hidden enforcement.
* Free-scroll partial suppression via masks or snapping.


## 5. Left gutter / right gutter

The following nodes shall be vertically aligned (have the same horizontal position) to the left:
1. left edge of the commandInput (importantly commandInput shall have no padding, so first character is aligned, not the border on the node - it shall have no border, no padding, no background) of the topBar
2. left edge of the text inside part user and part assistant (not the border, but the text / first character)
3. left edge of the in/out node in the part meta
4. left edge of the inputField text (not the border, first character) in the inputBar
5. left edge of the modeIndicator (again first character, not the border)

Accordingly, certain elements shall be vertically aligned (have the same horizontal position) to the right:
1. right edge of the part user (border, not the text)
2. right edge of the timestamp
3. right edge of the Send button
4. right edge of the menu (hamburger, three dots) icon (not implemented yet, to be located in right edge of the topBar at the same vertical position as commandInput)


## 6. Scrolling behaviour

1. The historyPane always display only fully visible parts (no clipped, partially visible message parts)
2. Message part is either visible in full or not displayed at all (hidden)
3. Scrolling is discrete (not continuous). (but smooth motion is ensured)
4. Scrolling behaviour depends on the reading position mode
4.1. Top reading position: the active (focused) part is anchored to the top of the historyPane with preconfigured OuterGap. Then the screen displays as many following parts as the historyPane can accomodate in full. The rest of the history is hidden. On j/k the same pattern is reproduced counting from the new (post j/k) active (focused) part.
4.2. Bottom reading position: the active part is anchored to the bottom and then as many message before that are displayd as the screen can accomodate in full. The same principle applied on changing the active part.
4.3. Center reading position: the active part is positioned in the middle of the screen. Then as many parts before and after the active part are displayed as the screen can accomodate in full. The pattern repeats when the focus moves to a different active part.
5. Edge cases: 
5.1. Top reading position: if there are no parts hidden below the active parts (ie all following messages fit the historyPane), then the top reading position is disregarded and the focus (blue border) just moves along the screen (on j/k)
5.2. Similarily in Bottom reading position: if there are no parts hidden (not fitting the historyPane) above the active part, the bottom reading position is disregarded and the focus just move along the screen as well
5.3. Same for the center reading position.
Comment: to make sure this is clear. Say I focus on the last part of the last message in the history. and I am in the Top reading position. Following the standard rule, I would see that last part anchored to the top and the remaining part of the screen empty. This should not happen. As soon as there are no more messages to hide, the focus/cursor shall move to the next active part without scrolling.


## 7. Top and bottom mask in message history navigation (this turned out to be only working solution)

1. In top reading position mode: 
- if the outerGap is large enough there may be part of the message preceding the active (focused) part, that is visible in the historyPane (it sits in the space of outerGap), so the top mask shall hide it. It shall have the height equal to the outerGap and be position on the very top of the screen (so it covers exactly the gap between the edge of the historyPane and the active part). Let's call this 'outer-gap-mask'
- There may be clipped part displayed at the bottom of the historyPane. This is frequnt case when the full part is too large to fit the remaining space in the historyPane. The clipped part shall be covered by the bottom mask. So, it's size shall be calculated to cover the partially visible part (clipped bottom part) in full. Let's call this 'clipped-part-mask'.

2. In bottom reading position mode: (the reverse logic is applied)
- If the outer gap is large enough there may be parts of the messages following the active (focused) part, visible in the historyPane. That extra part shall be covered by the bottom mask. The height of the bottom mask shall be equal to the outerGap and it shall be position at the very bottom of the historyPane. - let's call this 'outer-gap-mask'
- There also can be some clipped part on top of the screen, that shall be covered by the top mask in this case. The size of the top mask shall be such that it covers the clipped part in full. - let's call this 'clipped-part-mask'

3. In center reading position mode: 
- There can be clipped parts both at the top and at the bottom, so the top and bottom masks shall cover them both. This is a combination of second scenarios for top/bottom reading position. Essentially both top and bottom mask in this case are 'clipped-part-mask'.

In summary, only the parts that fully fit the screen shall be displayed, and all clipped, cut-off, partially visible parts shall be covered by top and bottom masks.


# 8. (Appendix) Simplified Mathematical Core Model

This section restates the scrolling / positioning principle using only abstract math objects (no browser terms) to make the core invariant obvious.

## A. Data Model

We introduce a consistent indexing that avoids collisions and ambiguity.

- Let there be M parts with heights: p_0, p_1, ..., p_{M-1}.
- Let there be M+1 gaps: g_0 (outer top), g_1 .. g_{M-1} (internal), g_M (outer bottom). g_0 = g_M = G
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


## F. Masking logic:

viewportBottom = S + D
top = start_part_k 
bottom = end_part_k
Scan parts for one with top < viewportBottom && bottom > viewportBottom (actual clipped bottom).
If found: bottomMask.height = viewportBottom - top (covers from part’s top to bottom edge).
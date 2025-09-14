# UI View & Reading Behaviour — Unified Specification

Purpose: Single, authoritative specification for how the history view looks and behaves while reading and navigating. It defines terminology, configuration parameters, layout and alignment rules, partitioning, anchoring/scrolling, fading, and navigation semantics. It is designed to be directly implementable as a spec (no historical notes or implementation plans).

Scope: History pane (middle zone) visual layout and reading behaviour; includes keyboard navigation semantics relevant to reading. Out of scope: request composition, model limits, context budgeting, provider details.

## 1. Terminology and definitions

- _History Pane_: The middle zone of the main screen that displays the history of the conversations. The only scrollable area that renders the message history list.
- _Pane Viewport_: The visible region of the _History Pane_ (its scrollable view). Its height is __paneHeight__; its vertical position is determined by __scrollTop__. It displays the fragment of the _History Pane_ from __scrollTop__ to __scrollTop + paneHeight__ position.
- _Usable Band_: The vertical region inside the viewport excluding the outer gaps: [__scrollTop__ + __gapOuterPx__, __scrollTop__ + __paneHeight__ − __gapOuterPx__]. Also referred to as usable height.

- _Message Pair_ ("pair"): A user request and its assistant reply (when received) with a metadata row between them in the UI.
- _Message Part_ ("part"): An atomic, contiguous fragment of a message’s text sized by the partitioning algorithm (whole rendered lines). A long message splits into multiple parts; a short message is one part. Applicable to both _User Part_ and _Assistant Part_.
- _User Part_: A part belonging to the user's request. One user request renders as 1..N user parts depending on partitioning.
- _Assistant Part_: A part belonging to the assistant's response. One assistant response renders as 0..N assistant parts (0 when no reply yet), depending on partitioning.
- _Meta Row_ (or Meta part): A non-focusable row between user and assistant parts showing metadata (model, stars, topic, include/flag, timestamp). Every _Message Pair_ has a _Meta Row_, but it never becomes the focused part.
- _Pair composition_: A complete _Message Pair_ contains, at minimum, one _User Part_, the _Meta Row_, and one _Assistant Part_ (three UI elements). Before a reply arrives, a pair contains, at minimum, one _User Part_ and the _Meta Row_. Both roles may produce multiple parts.

- _Focused Part_: The part that gets focus at a given time. Navigation targets parts. Focused part is visually highlighted with the blue border. The _History Pane_ always has one and exactly one focused part (the only exception is when the message history is empty due to CLI filtering). Focused part is sometimes referred to as “active part” in the docs or in the code (be careful, don't confuse it with 'active mode').
- _Anchored part_: the part that is used to calculated the scrolling position (__scrollTop__). The desired scrolling position can be described as to anchor a part to the bottom, or to achror the part to the top, or to anchor the part at the center. _Anchored part_ is not necessarily the _focused part_. These are independent concepts. 

- _Typewriter Regime_ (reading regime): Optional, user‑toggled behaviour where each j/k step centers the focused part. It is not a UI Mode (distinct from VIEW/INPUT/COMMAND).
- _Outer Gap_ (__gapOuterPx__): Structural top and bottom padding of the _History Pane_; defines the fade zones and the visual quiet zone at edges. Related parameters: __gapOuterPx__.

- _Internal Gaps_: Structural gaps rendered as explicit elements (configurable parameters):
  - __gapBetweenPx__: between messages (assistant tail → next user head)
  - __gapMetaPx__: around meta (last user part → meta, meta → first assistant part)
  - __gapIntraPx__: between consecutive parts of the same role
- _Part Padding_ (__partPadding__): Inner padding for user and assistant parts (symmetric) ensuring left-edge text alignment. Related parameters: __partPadding__.

## 2. Configuration Parameters

Canonical, tunable knobs for the UI behaviour. Concepts are defined in Terminology; this section sets types, ranges, defaults, and usage. Defaults are copied from current code where available.

- __gapOuterPx__ (number, px)
  - Default: 6
  - Used in: _Usable Band_ height; Top/Bottom anchor invariants; edge fading zones
  - Constraints: ≥ 0

- __gapBetweenPx__ (number, px)
  - Default: 10
  - Used in: Structural gap between message pairs
  - Constraints: ≥ 0

- __gapMetaPx__ (number, px)
  - Default: 6
  - Used in: Gap above and below the meta row
  - Constraints: ≥ 0

- __gapIntraPx__ (number, px)
  - Default: 6
  - Used in: Gap between consecutive parts of the same role
  - Constraints: ≥ 0

- __partPadding__ (number, px)
  - Default: 15
  - Used in: Inner padding for user/assistant parts; affects __maxLines__ in partitioning
  - Constraints: ≥ 0

- __partFraction__ (number, [0.10..1.00], step 0.10)
  - Default: 0.20
  - Used in: Partitioning (__targetPartHeightPx__)
  - Constraints: Clamp to [0.10..1.00]

Legacy parameters removed:
- anchorMode, edgeAnchoringMode — removed in favour of stateless one‑shot AlignTo and Ensure‑Visible plus optional Typewriter Regime.

- __deadBandPx__ (number, px)
  - Default: 2
  - Used in: Anchoring dead-band tolerance for corrective scroll suppression
  - Constraints: ≥ 0

- __fadeMode__ (enum: binary | gradient)
  - Default: binary
  - Used in: Edge Fading opacity policy

- __fadeHiddenOpacity__ (number, [0..1])
  - Default: 0.30
  - Used in: Minimum opacity at the edge in fading calculations (when fadeMode = binary)
  - Constraints: 0 ≤ fadeHiddenOpacity ≤ 1

- __partitionRecomputeThreshold__ (number, [0..1])
  - Default: 0.10
  - Used in: Trigger to recompute partitions on viewport height change (fractional delta)
  - Constraints: 0 ≤ threshold ≤ 1

Notes:
- All gaps are structural (real space): they occupy actual layout space and are not mutated during scroll. Internal gaps are implemented as explicit elements; the Outer Gap is implemented as top/bottom padding of the history pane container.
- Changing gap parameters or __partFraction__ triggers re-measurement and re-anchoring but does not otherwise alter anchor formulas or logic.

## 3. DOM & Alignment Requirements

DOM sketch (history pane only):
```
historyPane
  history
    pair*
      part.user*
      part.meta
      part.assistant*
```

Left alignment baseline (first glyph) is shared by: command input text (top bar), user/assistant content text, meta in/out label, input field text (bottom bar), and mode indicator. Right-aligned group: user part outer border, timestamp, Send button, and future menu icon.

## 4. Partitioning (Whole-Lines Principle)

Goal: Parts contain whole rendered lines and are sized (ie their height set) as a fraction of the _Usable Band_.

Definitions:
- __paneHeight__ — viewport height of the _History Pane_ (includes top/bottom padding) defined by the window size and the command (top) and input (bottom) zones sizes;
- __gapOuterPx__ — outer gap at top and bottom (configured parameter);
- __partFraction__ — fraction of __usableHeight__ to target for part size (configured parameter);
- __partPadding__ — inner padding for a part (one side, vertical), configured parameter;
- __lineHeight__ — computed rendered line height for part content, based on window/font size;

- __usableHeight__ = __paneHeight__ − 2·__gapOuterPx__; Height of the _Usable Band_ (vertical space allocated to message parts);
- __partPaddingVertical__ = 2·__partPadding__;
- __targetPartHeightPx__ = __partFraction__ · __usableHeight__;
- __maxLines__ = floor((__targetPartHeightPx__ − __partPaddingVertical__) / __lineHeight__), clamped to ≥ 1;

Algorithm outline:

1) Normalize new lines; split into paragraph candidates on blank-line boundaries.
2) Measure rendered line counts (cache-sensitive to width/font metrics).
3) Greedy packing: add candidates until adding the next would exceed __maxLines__.
4) Oversized candidate (own __lineCount__ > __maxLines__): split at a fitting boundary (binary search or equivalent), emit fragment, continue with remainder.
5) If a candidate does not fit and the current part has content, close part and start a new one.
6) Continue until all text consumed. Non-final parts (except intentional oversized splits) have exactly __maxLines__ lines; the final part may have fewer.
7) Stable IDs: `${pairId}:${role}:p${index}`.

Partition cache invalidation triggers: __partFraction__ change; __partPadding__ change; significant viewport height change (≥ __partitionRecomputeThreshold__ of current height); font metrics change; width/gutter change affecting wrap width.

## 5. Anchoring & Scrolling

Measurement:
- For each part i, define:
  - __partTop[i]__ = __offsetTop[i]__ (distance from the content box top; content coordinates).
  - __partHeight[i]__ — measured height of the part (including its own padding).
  - __partBottom[i]__ = __partTop[i]__ + __partHeight[i]__.
  - __focusedIndex__ — index of the currently focused part.
  - __focusedPartStart__ — alias for __partTop[focusedIndex]__.

Anchoring primitives:
- Ensure‑Visible: minimal movement to keep the focused part fully within the usable band.
- AlignTo('top'|'bottom'|'center'): one‑shot placement used by lifecycle jumps and by the Typewriter Regime.

NB! Anchoring may be applied to any part, not only to the focused part. E.g. when the new user request sent the scrolling anchors meta part to the bottom, while user part retains focus.

Clamping:
- __scrollTopFinal__ = clamp(round(__targetScrollTop__), 0, __maxScroll__)
- __maxScroll__ — maximum __scrollTop__ value for the history pane.

- Deterministic anchor: when AlignTo is used, target is a pure function of measured geometry and target location.
- Dead-band tolerance: If |__targetScrollTop__ − __currentScrollTop__| ≤ __deadBandPx__ after a scroll/animation, do not perform a corrective scroll.
- Idempotence: Re-applying anchor for the same (mode, focused selection) does not visibly move the viewport (difference ≤ 1px or within dead-band).

Typewriter Regime invariant:
- While ON, each j/k centers the focused part within ±dead‑band; otherwise default navigation uses Ensure‑Visible only.

Edge constraints:
- When enforcing an anchor would exceed natural bounds (e.g., very short content), the viewport clamps to the nearest valid scroll position while preserving visual consistency.

## 6. Edge Fading

Goal: De-emphasize intruding fragments within outer gap zones; never fade the active part.

Usable band and intrusions:

- _Usable Band_ (content coordinates): [__scrollTop__ + __gapOuterPx__, __scrollTop__ + __paneHeight__ − __gapOuterPx__].
- For part i with bounds [__partTop[i]__, __partBottom[i]__):
  - Top intrusion height = (__scrollTop__ + __gapOuterPx__) − __partTop[i]__ if __partTop[i]__ < __scrollTop__ + __gapOuterPx__ < __partBottom[i]__, else 0.
  - Bottom intrusion height = __partBottom[i]__ − (__scrollTop__ + __paneHeight__ − __gapOuterPx__) if __partTop[i]__ < __scrollTop__ + __paneHeight__ − __gapOuterPx__ < __partBottom[i]__, else 0.

- Opacity policy (controlled by fadeMode):
- If fadeMode = binary: if intruding, opacity = __fadeHiddenOpacity__, else 1.
- If fadeMode = gradient: opacity rises linearly from __fadeHiddenOpacity__ at the boundary to 1 within the _Usable Band_.
- Active part is fully opaque regardless of intrusion calculations.

## 7. Navigation Semantics (VIEW Mode)

Core rules:
- Single focus: one focused part; attempts to move beyond list edges are no-ops.
- j / ArrowDown → next part; k / ArrowUp → previous part.
- g → first part; G → last part.
- _Meta Row_ (a.k.a. _Meta part_) is never focusable or part of navigation; mouse clicks on meta do not change selection.
- After any navigation action, the _Focused Part_ is positioned by default using Ensure‑Visible; when the Typewriter Regime is ON, j/k recenters the focused part.

Filtering, resizing, and list rebuilds:
- Filter (COMMAND mode):
  - Enter (apply): applies the current filter value (including empty to clear any previously applied filter) and rebuilds the history; switches to VIEW.
    - Focus: if the previously focused part still exists in the filtered set (including the equivalent part when partitioning changed within the same pair and role), keep it; otherwise focus the last part (if any).
    - Anchor: one-shot bottom-align the focused part (clamped). If the result is empty, no anchor is applied.
  - Escape (clear input only): clears the filter input but does NOT apply it; history is NOT rebuilt; remains in COMMAND. Equivalent to Ctrl-U or deleting the text.
  - Consistency: The filter is applied — and the history is rebuilt — only on Enter in COMMAND.
- Resize < partitionRecomputeThreshold of viewport height: retain partitions and focused part; maintain anchor within dead-band.
- Resize ≥ partitionRecomputeThreshold: recompute partitions; map the previous focused selection to the part covering the same text range (or nearest within its pair) and re-anchor.
  
See: scroll_positioning_spec.md (Core flows §4) for precise anchoring rules.

New reply and end-of-list jumps:
- ‘n’ jumps to the FIRST part of the LAST message (assistant reply if present; otherwise last user message). Focus remains on that first part; end-of-list is bottom-anchored (last assistant or meta) as a one-shot.
- ‘G’ focuses the LAST part; Ensure-Visible applies (bottom-align if not fully visible).

Boundary jump:
- ‘o’ / ‘Shift+O’ jumps to the first in-context pair (boundary), focuses its first part, and performs a one-shot center alignment. Does not change Typewriter Regime state.

## 8. Edge behaviour
Clamping & calm edges are handled by the scroll controller. No persistent edge anchoring policy remains; behaviour follows Ensure‑Visible or the specific AlignTo one‑shot with clamping.

## 9. Behavioural Acceptance Criteria

1) Deterministic anchoring: given the same inputs and mode, the same __targetScrollTop__ is computed.
2) Dead-band: micro-drift ≤ __deadBandPx__ does not trigger a corrective scroll.
3) Constant top outer gap in Top mode; Bottom mode gap within ±__deadBandPx__; Center midpoint within ±__deadBandPx__.
4) Meta row never becomes focused; navigation always targets parts.
5) Partitioning is stable and produces whole lines; IDs are deterministic for the same text/settings.
6) Filters: after applying, the last visible part is focused at the chosen anchor; clearing restores the full list and end alignment.
7) Resizing rules honoured: <10% keeps partitions; ≥10% recomputes and remaps the focused selection to the same text range.
8) ‘g’, ‘G’, ‘n’ jump logic honoured; edges are calm (no jitter when stepping past ends).

---
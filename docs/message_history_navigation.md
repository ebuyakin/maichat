## Message History Navigation & Partitioning (Spec)

Status: Finalized for M5 implementation baseline (updated new message & 'n' behavior).

This document defines the user‑observable behavior of conversation navigation in VIEW mode and the vocabulary used across code, docs, and tests.

### 1. Vocabulary
* History: The scrollable chronological surface of all message pairs (user + assistant). Only the middle zone scrolls.
* Message: A user request or assistant reply (the stored pair contains two texts; UI presents them as ordered parts with a metadata line in between).
* Message Part ("part"): A contiguous, readable fragment of a message’s text sized according to user preferences (viewport fraction mapped to whole rendered lines). Short messages ⇒ one part; long messages ⇒ multiple parts.
* Active (Focused) Part: Exactly one part at a time receives focus styling (thin blue border + padding). Navigation always refers to parts.
* Reading Position (Anchor): The vertical alignment target for the active part: Top | Center | Bottom (user preference; default Bottom). Alignment is achieved via scroll position + constant outer padding (no injected spacer elements).
* Edge Fading: Opacity reduction (binary or gradient) applied to parts that intrude into the outer gap zones at the top or bottom (replaces any earlier spacer / overlay concepts).
* Meta Row: A non-focusable row between user parts and assistant parts of a pair showing badges (model, stars, topic, include flag, timestamp). It is never part of navigation.

### 2. Core Principles
1. Single Page: No inner scroll containers; the history is one continuous scrollable surface.
2. Single Focus: Always exactly one active part; no wrap-around illusions; attempts to move beyond edges do nothing (calm edges).
3. Stable Anchoring: After any navigation action the active part is positioned at the chosen reading position (within edge constraints; no artificial spacers).
4. Deterministic Partitioning: Given the same text, settings, and viewport category (width/lineHeight) the part boundaries & IDs are stable.
5. Non-Intrusive Updates: New messages never yank the reader away from earlier content; the user opts-in to jump.

### 3. User Experience Flows
Opening History:
* The last part (end of conversation) becomes active and is aligned at the Bottom (default) or current saved reading position.

Stepping (j / k or ArrowDown / ArrowUp):
* Moves to next/previous part. If next would exceed list end, no movement (no scroll jitter). Anchoring reapplies for the new part.

Jumping:
* g jumps to first part; G jumps to last part; anchor enforced (no artificial spacers).

Filtering:
* Applying a filter rebuilds the list with only matching pairs → the last visible part becomes active at the anchor. Clearing filter restores full list and preserves bottom alignment of last part.

Resizing:
* Minor resize (<10% viewport height change): keep existing partition boundaries; maintain active part + anchor (dead-band suppresses ≤2px micro corrections).
* Major resize (≥10% change): recompute partitions (line limit may change), map prior active to the part covering the same text range (or nearest within its pair) and re-anchor.

New Messages (User Behavior Perspective):
* Single Pending Send: While an assistant reply is pending ("AI is thinking" state), pressing Enter again in INPUT mode is ignored (no second user message queued). The Send button shows a highlighted state and label changes to "AI is thinking" immediately after the user message appears.
* Immediate Echo: The user's request (possibly multi-part) is inserted instantly and its FIRST user part gains focus (reading position enforced). User remains in INPUT mode and may type a next draft or switch modes.
* Auto Focus Rule: If the user has NOT navigated away (no part navigation keys since sending) and the assistant reply arrives, focus automatically moves to the FIRST assistant part of that reply (not the last part) and anchors.
* Navigated Away: If the user moved to any other part (VIEW or COMMAND) before reply arrival, the reply does NOT steal focus. A dim badge (top-right of the top bar) appears showing `[n new]` (counter). Focus & scroll remain unchanged.
* 'n' Key (VIEW mode): Always jumps to the FIRST part of the LAST message (assistant reply if present; otherwise last user message). Clears badge if present. Works even if already at end (re-anchors first part).
* 'G' Key: Jumps to the LAST part of the LAST message (tail). Clears badge if present.
* Filtered-Out Reply: If a filter hides the new reply, show a dim `[new]` badge (count increments) but jumping with 'n' clears the filter (restores full history) then focuses first part of the last message. 'G' clears filter when badge present and jumps to last part.
* Badge Dismissal: Pressing 'n', 'G', or clicking the badge clears the indicator and unseen count.

### 4. Partitioning Model (Whole Lines Principle)
User Setting: Part Size Fraction (range 0.20–0.90 step 0.05) → lineLimit = floor( viewportHeight * fraction / lineHeight ). lineLimit ≥ 3 enforced.

Algorithm Outline:
1. Normalize newlines; split into paragraph candidates on blank line boundaries (\n{2,}).
2. Measure rendered line count of each candidate in an off-screen measurement container (cache by hash + width + font metrics).
3. Greedy packing: fill current part until adding next candidate would exceed lineLimit.
4. Oversized candidate (own lineCount > lineLimit): binary search a substring that fits remaining capacity (or whole part if empty), emit fragment, continue with remainder.
5. If candidate does not fit & current part already has content: close part, start new.
6. Continue until all text consumed; final part may have fewer than lineLimit lines (remainder). All non-final parts except intentional oversized splits have exactly lineLimit lines of content.
7. Generate IDs: `${pairId}:${role}:p${index}` ensuring stability across sessions when text + settings unchanged.

Meta Row Exclusion: Meta row never participates in the partition algorithm and is not focusable; navigation list excludes it.

### 5. Settings & Persistence
Accessible via Settings Overlay (Ctrl+,). Changes (fraction, reading position, padding, gap, top/bottom zone heights) apply only after selecting "Apply" (no live preview). Cancel reverts to persisted values.

Persisted Preferences:
* readingPosition (bottom|center|top)
* partFraction (0.20–0.90)
* partPaddingPx
* partGapPx
* topZoneMode (auto|custom)
* topZoneLines (if custom)
* bottomZoneMode (auto|custom)
* bottomZoneLines (if custom)
* edgeAnchoringMode (adaptive|strict) (default adaptive)

Edge Anchoring Mode:
* Adaptive (default): If enforcing the anchor would require large blank space (content smaller than viewport or anchor scroll would exceed natural bounds), clamp scroll and place content naturally (top when short list). Ensures efficient use of screen at conversation start/end.
* Strict: Always attempt to visually place the active part at the chosen anchor even if this yields large empty regions.

### 6. Anchoring Mechanics
Given activePartRect (top,height) & viewportHeight:
* Bottom: desiredTop = viewportHeight - activePartHeight
* Center: desiredTop = (viewportHeight - activePartHeight)/2
* Top: desiredTop = 0 (plus configured top padding gap)
We set scrollTop so the active part lands at desiredTop in one pass. A single deferred validation runs after any smooth animation; micro re-alignments ≤2px (dead-band) are suppressed to eliminate flicker.

### 7. Edge Behavior
* First part upward step → no-op.
* Last part downward step → no-op.
* Active part remains in stable alignment; layout uses only padding + scroll (no spacer elements); fading gently dims intruding neighbors.

### 8. Indicator & Jump Behavior (Detailed)
State is "at end" if (activePartIndex == lastIndex) AND |visualAlignedOffsetDelta| ≤ 4px AND no navigation key pressed since last user send while pending.
* Auto Focus (stationary at end): Assistant reply arrival focuses FIRST assistant part, anchor applied; unseenCount remains 0; no badge.
* Navigated or Filter Hiding Reply: unseenCount++ → badge `[n new]` shown (dim if filtered). No auto scroll.
* 'n': If badge present and reply filtered out, clear filter, then focus first part of last message; unseenCount reset. If no badge, still focus first part of last message (idempotent re-anchor).
* 'G': Similar logic but targets LAST part of last message.
* Badge click: Equivalent to 'n'.
* Multiple replies (future extension): counts aggregate; current MVP only allows one pending send at a time so typical value is 1.

### 9. Non-Goals (M5)
* Semantic (markdown heading / code fence) aware splitting.
* Virtualization for large histories.
* Live preview of setting changes before Apply.

### 10. Acceptance Criteria (M5 Navigation)
1. Deterministic partitioning given same inputs (hash + settings) → identical part IDs.
2. Navigation j/k/g/G respects edges (no jitter) and maintains anchor (tolerance: sub‑2px drift suppressed – dead‑band).
3. Meta row never becomes active; star/include toggles still affect its pair from any part.
4. Changing part size fraction triggers repartition; active part maps to same text range (or nearest within pair).
5. Resize <10% height keeps partitions; ≥10% triggers repartition & active mapping.
6. New message indicator appears only when user not at end; never auto-scrolls user away.
7. Filter application re-focuses last visible part with correct anchor.
8. All persisted settings restore on reload before first render.
9. Adaptive edge anchoring: With few parts (content height ≤ viewport height) or anchor beyond natural bounds, first/last part displayed naturally (no artificial blank spacer). Strict mode still enforces positional alignment within available space.
10. Switching edgeAnchoringMode re-anchors current active part without repartition.

### 11. Future Extensions
* Semantic splitting (headings, sentences)
* Live preview mode in Settings overlay
* Anchor-specific animation (optional subtle easing)
* Half-page navigation (Ctrl+u / Ctrl+d)

---
This spec is the authoritative reference for M5 implementation & test design.
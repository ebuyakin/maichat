# Layout & Spacing (User Adjustable)

Status: Active (supersedes former padding/mask doc). Focuses purely on user-controlled spacing parameters; scroll & fading algorithms live in `scrolling_and_fading.md`.

## 1. Purpose
Define the adjustable spacing primitives affecting readability and density without re-explaining scrolling internals.

## 2. Adjustable Parameters (candidate settings)
* partPaddingPx – inner padding for user & assistant parts (symmetric; meta row horizontal alignment preserved).
* gapOuterPx – outer vertical padding at top & bottom (defines fading zones).
* gapBetweenPx – gap between messages (user tail → next user head).
* gapMetaPx – vertical gap around meta row (user part → meta, meta → assistant part).
* gapIntraPx – gap between consecutive parts of the same role (multi-part user or assistant message).

All gaps are structural (real space); no spacer nodes inserted/removed dynamically beyond fixed gap elements produced in render.

## 3. Principles
1. Consistency: Same padding for user & assistant ensures vertical alignment of first characters.
2. Non-interference: Changing gaps never alters scroll anchoring logic beyond remeasurement.
3. Deterministic partition: Part splitting depends only on viewport height, line height, and part fraction – independent of gap sizes (after remeasure).
4. Edge clarity: Outer gap defines a clean quiet zone; faded intrusions maintain context without visual noise.

## 4. Alignment Requirements
Left alignment baseline (first glyph) shared by: commandInput text, user/assistant content text, meta in/out label, inputField text, modeIndicator.
Right alignment group: user part outer border, timestamp, Send button, (future) menu icon.

## 5. Current Implementation Summary
* Outer gap via container padding.
* Gaps via dedicated `.gap-*` elements (heights from settings).
* Active highlight uses inset pseudo-border to avoid clipping.
* Fading applied; no overlay masks remain.

## 6. Historical (Brief)
Earlier versions used overlay masks (top/bottom) to hide partial parts and spacer arithmetic for outer gap; replaced due to drift, duplicate corrections, and complexity. See appendix in `scrolling_and_fading.md` for historical rationale.

---
End of document.

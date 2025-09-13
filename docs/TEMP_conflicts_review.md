# TEMP — Documentation Conflicts & Overlaps Review

Purpose: temporary scratchpad to identify conflicts/overlaps across active documentation in docs/ (excluding legacy_docs). Use this to drive the cleanup edits; delete after consolidation.

Scope scanned (docs/ root, excluding docs/legacy_docs):
- ARCHITECTURE.md
- ADRs/ (ADR-000-architecture.md, ADR-004-topic-system.md)
- cli_filtering_language.md
- dev-notes.md
- focus_management.md
- keyboard_reference.md
- new_message_workflow.md
- plain_text_policy.md
- plan.md
- project_vision.md
- scroll_positioning_spec.md
- topic_system.md
- tutorial.md
- ui_layout.md
- ui_view_reading_behaviour.md

Legacy docs parked under docs/legacy_docs/ are excluded except where explicitly noted.

---

## 1) Navigation vs Scroll math
- Where:
  - ui_view_reading_behaviour.md (reading semantics + some terminology)
  - scroll_positioning_spec.md (formulas + one‑shots + acceptance)
- Issue:
  - Minor overlap: reading doc includes terms that hint at formulas; scroll spec sometimes repeats nav prose.
- Proposed resolution:
  - Keep navigation semantics (when to center vs ensure‑visible) only in ui_view_reading_behaviour.md.
  - Keep formulas, clamping, dead‑band, and one‑shot vs ensure‑visible only in scroll_positioning_spec.md.
  - In each, add a See also link to the other.

## 2) Meta row focusability
- Where:
  - ui_layout.md: meta is never focusable.
  - ui_view_reading_behaviour.md: refers to meta as non‑focusable and alignment target only.
  - scroll_positioning_spec.md: uses meta as a positioning target after send/open.
- Status: Consistent. No change needed. Ensure wording is identical: "Meta row is never focusable; may be used as a positioning target."

## 3) Anchor/Reading Mode terminology
- Where:
  - ui_view_reading_behaviour.md: defines Reading Mode and anchoring behaviour.
  - scroll_positioning_spec.md: replaces persistent regimes with one‑shot AlignTo + Ensure‑Visible; Reading Mode is an opt‑in that centers on j/k.
- Issue:
  - Older mentions of persistent anchorMode/edgeAnchoringMode might still appear.
- Proposed resolution:
  - Remove/avoid historical terms (anchorMode/edgeAnchoringMode) in all active docs; if needed, mention as legacy only.
  - Canonical terms: "Ensure‑Visible", "AlignTo('top'|'center'|'bottom')", "Reading Mode (centers on j/k)".

## 4) Partitioning ownership
- Where:
  - ui_view_reading_behaviour.md: high‑level partitioning policy.
  - scroll_positioning_spec.md: explicitly says partitioning ensures parts fit; does not own the algorithm.
  - Code/instrumentation mentions partFraction, maxLines, etc.
- Issue:
  - Risk of duplicating formulas across docs.
- Proposed resolution:
  - Keep partitioning math and algorithm details in ui_view_reading_behaviour.md only at a high level (policy and invariants). For numeric formulas, point to code comments and tests, not to scroll spec.

## 5) Mode transitions and lifecycle
- Where:
  - ui_layout.md: mode matrix summary.
  - new_message_workflow.md: detailed send/reply focus + one‑shot alignment sequence.
  - interaction code reflects the same.
- Status: Mostly consistent.
- Action:
  - Ensure ui_layout.md points to new_message_workflow.md for authoritative lifecycle rules.

## 6) Rendering policy vs UI spacing
- Where:
  - plain_text_policy.md: sanitizer and system instruction; mentions delegation of spacing to UI partitioning.
  - ui_view_reading_behaviour.md: owns spacing/partition policy high‑level.
- Issue: None; just ensure cross‑links exist.

## 7) Terminology consistency (glossary candidates)
- Canonical terms to standardize:
  - Pair, Part, Meta Row, Focused Part, Usable Band, Outer Gap, Ensure‑Visible, AlignTo, Reading Mode, Context Boundary, Included/Off (context), Trimming, URA, CPT.
- Action:
  - Add a shared Glossary section to ARCHITECTURE.md and link to it from the six UI docs.

## 8) Tutorial links and BASE_URL
- Where:
  - interaction.js now uses BASE_URL for tutorial.html; tutorial.html back link is relative.
- Status: Fixed; document this briefly in ARCHITECTURE (build/deploy notes) if needed.

## 9) Planning and notes overlap
- Where:
  - plan.md (planning roadmap and milestones)
  - dev-notes.md (implementation notes and WIP thoughts)
  - README (outside docs/, public summary of roadmap)
- Issue:
  - Potential duplication of roadmap content across plan.md and README; dev-notes sometimes acquires normative statements.
- Proposed resolution:
  - Make plan.md the canonical internal planning roadmap; README contains only a concise public summary and links to plan.md.
  - Keep dev-notes.md strictly as non-normative engineering notes; move any normative policy/spec content into the appropriate canonical docs and link from dev-notes.md.

## 10) Vision and positioning
- Where:
  - project_vision.md
  - README (outside docs/)
- Issue:
  - Overlap in high-level pitch and goals.
- Proposed resolution:
  - Treat project_vision.md as canonical for the product vision; README provides a short elevator pitch and links to project_vision.md for details.

## 11) Tutorial vs reference specs
- Where:
  - tutorial.md
  - keyboard_reference.md, cli_filtering_language.md, topic_system.md, ui_layout.md
- Issue:
  - Tutorial sometimes restates rules from reference docs.
- Proposed resolution:
  - Keep tutorial.md as an on-boarding guide that demonstrates flows and links to reference specs; avoid restating normative rules. Insert cross-links to keyboard_reference.md, cli_filtering_language.md, topic_system.md, and UI docs where each topic appears.

## 12) ADRs vs living docs
- Where:
  - ADR-000-architecture.md, ADR-004-topic-system.md
  - ARCHITECTURE.md, topic_system.md
- Issue:
  - Risk of drift between ADR decisions and current living docs.
- Proposed resolution:
  - ADRs remain immutable decision records with date context; ARCHITECTURE.md and topic_system.md are the living sources of truth. Add “See also: ADR-XXX” links from the living docs to relevant ADRs; add a forward link at the top of ADRs to the corresponding living doc section.

## 13) Coverage quick check
- Keyboard reference: stands alone and referenced by tutorial and ui_layout.
- Topic system: canonical and referenced by tutorial.
- CLI spec: canonical; referenced by tutorial and ui_view_reading_behaviour where filters intersect (boundary key).
- ADRs: present; add cross-links per item (12).
- Plan/vision/tutorial/dev-notes roles clarified above; add pointers accordingly.

---

## Summary of edits to perform during cleanup
- Insert "Status / Scope / Out of scope / See also" headers into: ui_layout.md, ui_view_reading_behaviour.md, scroll_positioning_spec.md, focus_management.md, plain_text_policy.md, new_message_workflow.md.
- Remove anchorMode/edgeAnchoringMode remnants; use Ensure‑Visible / AlignTo terminology.
- Trim any duplicated math or nav prose per items (1) and (4).
- Add Glossary to ARCHITECTURE.md and link from the six UI docs.
- Add explicit pointer in ui_layout.md to new_message_workflow.md for lifecycle rules.
 - Align plan.md vs README roles; ensure README links to plan.md, and plan.md links to roadmap sections in docs if needed.
 - Ensure project_vision.md is referenced from README and tutorial.md; avoid duplicating the pitch in multiple places.
 - Make tutorial.md link to keyboard_reference.md, cli_filtering_language.md, topic_system.md, and UI docs instead of restating rules.
 - Add cross-links between ADRs and living docs as per item (12).

Acceptance
- Each topic has one owner doc; cross-links in place; no conflicting terms remain.
- Glossary exists and is linked; legacy terms appear only as historical notes if needed.
 - Plan/vision/tutorial/dev-notes have clear, non-overlapping roles and links.

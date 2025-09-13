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

## 3) Anchor/Typewriter Regime terminology
- Where:
  - ui_view_reading_behaviour.md: defines Reading Mode and anchoring behaviour.
  - scroll_positioning_spec.md: replaces persistent regimes with one‑shot AlignTo + Ensure‑Visible; Reading Mode is an opt‑in that centers on j/k.
- Issue:
  - Older mentions of persistent anchorMode/edgeAnchoringMode might still appear.
- Proposed resolution:
  - Remove/avoid historical terms (anchorMode/edgeAnchoringMode) in all active docs; if needed, mention as legacy only.
  - Deprecate the old trio of "Top/Center/Bottom reading modes" entirely.
  - Canonical terms: "Ensure‑Visible", "AlignTo('top'|'center'|'bottom')", "Typewriter Regime" (opt‑in behavior: focused part is kept centered during j/k reading). Use "Typewriter Regime" (or "reading regime") and avoid "Reading Mode" to prevent confusion with Command/Input/View modes.

  __EB__: in previous versions we had a concept of 3 differente 'reading regimes/modes' - Top reading, Center reading, Bottom  reading. Correspondingly they meant that the focused part is anchored to the top, center, or bottom of the screen. We abandoned this idea completely. There are no _different_ reading regimes/mode anymore. There is, however, 'reading mode' (as opposed to free navigation). Reading mode in the current version means that the focused part is anchored to the center (Vertical) of the screen. In other words, when reading mode is enabled, the focused part is anchored to the center of the screen, when it's disabled, the focused part position is controlled by other rules (separate for new message, or regular j/k g/G navigation). The reading mode is actually 'typewriter' kind of mode. I think it's important to identify all the documents that describe/mention different reading modes (in the old sense) and clean it so they use the currently implemented approach. Let's avoid calliing it 'Reading Mode' at all, let's call it 'reading regime' or 'typewriter regime'? This is a constant source of confusion, so I think we need to clean it very carefully.

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
  - Preserve the global mode matrix (Command/Input/View) in ui_layout.md as the authoritative overview of mode transitions and interactions.
  - Keep specific send/reply/open sequences and one‑shot alignments in new_message_workflow.md. Link from ui_layout.md to new_message_workflow.md for those lifecycle sequences.

  __EB__: Mode matrix summary describes the general transitions between the modes (Command, Input, View), not just the transitions related to the new message life cycle (which is just one specific case of the transition, right?). We need to make sure that both are preserved.

## 6) Rendering policy vs UI spacing
- Where:
  - plain_text_policy.md: sanitizer and system instruction; mentions delegation of spacing to UI partitioning.
  - ui_view_reading_behaviour.md: owns spacing/partition policy high‑level.
- Issue: None; just ensure cross‑links exist.

## 7) Terminology consistency (glossary candidates)
- Canonical terms to standardize:
  - Pair, Part, Meta Row, Focused Part, Usable Band, Outer Gap, Ensure‑Visible, AlignTo, Typewriter Regime, Context Boundary, Included/Off (context), Trimming, URA, CPT.
- Action:
  - Add a shared Glossary section to ARCHITECTURE.md and link to it from the six UI docs.

__EB__: I suggest we don't use 'Reading Mode' as it's being confused with Command/Input/Vie Modes which is completely different concept. Let's call it 'Reading Regime' or 'Typewriter regime'

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

  __EB__ let's also clearly distinguish 2 parts/supersections in documents (where it's relevant): specs (how it should work) and plan (when it's going to be implemented). Ideally, keep most of the planning in plan.md, and keep only what strictly necessary or make sense in the specific documents describing particular components of the app. (Project vision.md is an exception, it should be a vision document, but we're not going to edit that one now, right?)

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
  - Keep tutorial.md as an on-boarding guide for end users. It should be self‑contained (no links to internal developer docs), written in user‑facing language, and may restate behavior as needed. Developer specs remain authoritative; duplication is acceptable across audiences. Internal docs should not assume user access to them from the tutorial.

__EB__: this is important. Tutorial is for users (so it should describe to the users how to use the app and what keys do). Other documents are for the development team, to communicate specs and plans. So the documents shall be overlapping in terms of the content (that's ok), but not in terms of the audience. Tutorial is for users (thus, the language and the structure shall be appropriate for the users), whereas other docs are for you and me and shall be structured accordingly. They should be authoritative sources of sepcs. Tutorial is self contained and should not refer to other documents!!!

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
- Plan/vision/tutorial/dev-notes roles clarified above; add pointers accordingly in internal docs. Tutorial remains standalone and does not link to developer docs.

## Summary of edits to perform during cleanup
- Insert "Status / Scope / Out of scope / See also" headers into: ui_layout.md, ui_view_reading_behaviour.md, scroll_positioning_spec.md, focus_management.md, plain_text_policy.md, new_message_workflow.md.
- Remove anchorMode/edgeAnchoringMode remnants; use Ensure‑Visible / AlignTo terminology.
- Trim any duplicated math or nav prose per items (1) and (4).
- Add Glossary to ARCHITECTURE.md and link from the six UI docs.
- Add explicit pointer in ui_layout.md to new_message_workflow.md for lifecycle rules.
 - Align plan.md vs README roles; ensure README links to plan.md, and plan.md links to roadmap sections in docs if needed.
 - Ensure project_vision.md is referenced from README (public pitch); do not link from tutorial to internal docs.
 - Keep tutorial.md self‑contained for users; allow duplication of content necessary for onboarding; avoid linking to developer docs.
 - Add cross-links between ADRs and living docs as per item (12).

Acceptance
- Each topic has one owner doc; cross-links in place; no conflicting terms remain.
- Glossary exists and is linked; legacy terms appear only as historical notes if needed.
 - Plan/vision/dev-notes have clear, non-overlapping roles and links; tutorial is self‑contained and user‑oriented.
 - "Typewriter Regime" (aka reading regime) replaces "Reading Mode" terminology across active docs; old Top/Center/Bottom modes are removed.

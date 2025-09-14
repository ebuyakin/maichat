## Project plan

Purpose: One hierarchical, authoritative view of what exists, what is in progress, and what is next. No duplicated sections. Use this file only when planning or reviewing scope.

Legend:
- [x] Done (merged & working)
- [~] Partial / behind acceptance criteria
- [ ] Not started

Currently active milestone is presented with detailed sub-tasks, past and future milestones are presented as one item for brevity of the general context / big picture and assistant orientation.

## App idea, purpose, and architecture

#project_vision.md # project purpose, idea, audience, philosophy
#ARCHITECTURE.md # current architecture
/src/dev-notes.md # for current/working notes and comments

## Milestones and status for version 1.0

M0. Foundation, scaffolding, testing infrastructure [x]
M1. Data models and infrastructure, core storage and indexing [x]
M2. General layout, modal zones, and modal navigation, keyboard shell [x]
M3. Message history (conversation history) presentation and navigation, metadata editing [x]
M4. Message partitioning, layout padding, scrolling of the history, reading regimes [x]
M4. Command line filtering language design and application [x][~] (not all operators)
M5. Topic management system [x]
M6. Basic settings overlays for general settings, topics, models, api keys, and help [x]
M7. New message workflow [x]
M8. Full filtering language implementation [x]
M9. Model store/list management (api keys, model cw, tpm, rpm etc.) [x]
M10. UX polish and Help [x]

- Release beta v0.4.1 [x]

## Roadmap. Milestones for version 2.0

M20-0 Documentation cleaning. [x]
    The purpose of the documentation cleaning is to identify discrepancies between different documents. There are documents describing overlapping requirements/specs. Those docs need to be identified, aligned or consolidated. Second purpose is to align terminology and notation, that evolved in the course of development and is not consistent in various documents.
    Acceptance:
    - All active docs use “Typewriter Regime” (no "Reading Mode" in non-legacy files)
    - Each core spec has Status, Scope, and See also blocks
    - ADR cross-links exist: `docs/ARCHITECTURE.md` ↔ `docs/ADRs/ADR-000-architecture.md`, `docs/topic_system.md` ↔ `docs/ADRs/ADR-004-topic-system.md`
    - `docs/TEMP_conflicts_review.md` closed or reduced to a short index of resolved items
    - Tutorial remains user-facing and self-contained (no dev-doc links)

M20-1 Architecture review, code health check. Highest priority! [x]
    The purpose is to assess the current architecture similar to past reviews (see `docs/legacy_docs/architecture_review_for_transition.md` for style). We need to assess if current architecture is suitable/optimum for the roadmap. The idea is to understand whether the roadmap 'fits' the architecture of the app.
    Acceptance:
    - Produce a short review doc (2–3 pages) under `docs/` summarizing: strengths, risks, and fit vs roadmap M21–M28
    - At least 3 actionable refactors with owners and acceptance tests identified (or explicitly deferred)
    - Green test suite on main; add CI job skeleton for tests (optional if local-only)
    - Update `docs/ARCHITECTURE.md` with any structural deltas discovered
    References: `docs/ARCHITECTURE.md`, `docs/ADRs/ADR-000-architecture.md`

M21. System message customization for different topics. Request parameters (system, length, temperature) [ ]
    The idea is relatively simple. We don't need per-message customization, we need per-topic customization of the API-calls. Ie. for each topic there can be an individual system message (that can be customized by the user) and the separate set of request parameters (like temperature or length of the response). All shall be managed via Topic Editor interface (which needs to be extended), not via main window interface.

M22. Filtering language extension.
    - o command - filtering by context boundary o3, o5 [ ]
    The idea is slightly different, but also simple. oN filters all in-context messages + N latest off-context messages. The user will be able to see what's in, what's out (without long history), plain o - just in-context.
    - commands introduction. So far CLI filter (filter input box, command zone) has been used for literally filtering the message history. It shall be extended to input commands (operations over message history). General format shall be colon commmand parameters (vim like). E.g. :export json - export the filtered message history as json file. Or :changetopic - command to bulk change of the assigned topic for all filtered message.

M23. History export in different formats [ ]
    Some simple export of the history as well-structured .json may be enough for this stage.

M24. Multiple providers (+Claude+Gemini) [ ]

M25. Message formatting (markdown parsing, LaTeX parsing, code snippets) [ ]
    This needs a separate discussion, what is possible and how difficult it is to implement. I suspect this is the biggest task as the ergonomic presentation of the content is one of the pillars of the app, so we need to make it really well and make sure all content (e.g. equations) is presented beautifully and reliably. Again, first task is to evaluate how this will be done architecturally and how will it affect other components of the app.

M26. Large history virtualization [ ]
    This feels importantm, but I have no clue how difficult it is and how may it affect other components. worth the separate discussion.

M27. Attachments and images [ ]
    Two side, sending attachments (higher priority) and generating images (low priority).

M28. Large history archiving and restoration [ ]
    Think, it's related to M26. Maybe we need to join them. In general, M26-M28 is mostly under-the-hood work, I'm relying on your opinion how to do it.

---


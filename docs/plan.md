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
M4. Message partitioning, layout padding, scrolling of the history, reading regimes, dimming of clipped messges [x]
M4. Command line filtering language design and application [x][~] (not all operators)
M5. Topic management system [x]
M6. Basic settings overlays for general settings, topics, models, api keys, and help [x]
M7. New message workflow [~]
    7.1. Extended WYSIWYG and context assembly [x]
    7.2. Token estimation and budgeting, visual signalling of the out-of-context history [x]
    7.3. Provider adapter (OpenAI chat completion) [x]
    7.4. Send pipeline and Edit-in-place resend (assembled request corrections) [x]
    7.5. New message arrival focusing and navigation scenarios [x]
    7.6. Error/No-response from LLM processing, message history editing and deletion [x]
M8. Full filtering language implementation [ ]
    8.1. Topic filtering (t): names, wildcards, paths, descendants, and bare t [x]
    8.2. Date filtering (d): relative (h/d/w/mo/y) and absolute YYYY-MM-DD, daily stat overlay [ ]
    8.3. Model filtering polish (m): wildcards and bare m (current model) [ ]
    8.4. Content search (c): wildcard * semantics (no regex) [ ]
    8.5. Quoted string escapes in lexer (\\, \' , \n, \t, \r) + tests [ ]
    8.6. Usability: ArrowUp/Down history and friendlier errors in Command mode [ ]
    8.7. Performance: simple indexes/short-circuiting (optional) [ ]
M9. Model store/list management (api keys, model cw, tpm, rpm etc.) [ ]
M10. UX polish (message formatting (.md), performance, flickering, smoothing, transitions) and Help, keyboard - touchpad - arrows correspondence - including mode switching [ ]
- Release.

## Milestones for version 2.0

M11. Attachments and images [ ]
M12. History export in different formats [ ]
M13. Large history virtualization [ ]
M14. Large history archiving and restoration [ ]

# Topic Management System

## 1. Purpose and Usage

### Information Organization
The MaiChat topic system transforms AI conversations from a linear chat history into a structured knowledge base. Users organize conversations into hierarchical topics like `Finance > Stock Market > TSLA` or `AI > Machine Learning > Neural Networks`, enabling:

- **Contextual Grouping**: Related conversations naturally cluster together
- **Scalable Organization**: Support hundreds of conversations across deep topic hierarchies
- **Flexible Categorization**: Topics can be reorganized as understanding evolves

### Search and Discovery
Topics serve as primary navigation and filtering mechanisms:

- **Hierarchical Browsing**: Navigate from general topics to specific subtopics
- **Contextual Search**: Filter conversations by topic with CLI commands like `t'Finance > Stock Market'`
- **Pattern Recognition**: Identify conversation patterns and knowledge gaps across topics

### Context Management
Topics enable intelligent context selection for AI interactions:

- **Focused Context**: Include only relevant conversations from specific topic branches
- **Cross-Topic Insights**: Discover connections between different knowledge domains
- **Historical Context**: Maintain conversation continuity within topic areas

## 2. Desired Architecture

### Core Design Principles

**Persistent User-Editable Tree
- User can create, rename, delete, and reorganize topics at any time
- Changes immediately reflected across all displays and filtering

**Stable Topic Identification**
- Each topic has immutable unique identifier (e.g., `T001`, `T002`, `T003`) assigned at creation
- Messages reference topics by stable ID, not by display path
- Topic tree reorganization never breaks message-topic associations
- Simple sequential IDs chosen for single-user personal knowledge system: clean, readable, and sufficient for hundreds of topics

**Dynamic Path Computation**
- Display paths (e.g., `"Finance > Stock Market > TSLA"`) computed on-demand from tree structure
- Single source of truth: only parent-child relationships stored
- No data duplication or synchronization issues

**Seamless Message Reassignment**
- Users can move messages between topics or move entire topic branches
- Topic path changes automatically update all message displays
- Historical context preserved through stable topic references

### CLI Integration Design
- **Intuitive Commands**: `t'Finance > Stock Market > TSLA'` filters to specific topic
- **Wildcard Support**: `t'Finance > Stock Market > *'` includes all child topics  
- **Hierarchical Matching**: `t'Finance...'` includes topic and all descendants
- **Auto-completion**: CLI suggests available topic paths as user types

### User Interface Design (Overlay Model)

MaiChat uses a transient **Topic Palette Overlay** to manage and select topics (aligns with the minimal, no-side-panel UI philosophy in `ui_layout.md`).

```
┌ Topic Palette (Select / Edit) ────────────┐
│ AI                                       │
│   Machine Learning                       │
│     Neural Networks                      │
│       Transformers                       │
│       CNNs                               │
│   Ethics                                 │
│ Programming                              │
│   JavaScript                             │
│   Python                                 │
└──────────────────────────────────────────┘
Hints: j/k move · Enter select · n new · r rename · d delete · m mark · p paste · Esc cancel
```

Two invocation intents share this surface:
- **Selection Mode**: choose a topic only (no structural edits). Trigger: `Ctrl+T`.
- **Edit Mode**: full CRUD + move. Trigger: `Ctrl+E`.

Editing shortcuts are disabled in Selection Mode to reduce accidental structural changes.

**Operations (MVP)**
- Create child (`n`): inline input (sibling name uniqueness enforced; Esc cancels).
- Rename (`r`): inline edit (empty or duplicate name rejected with inline warning).
- Delete (`d`): only if no children and no messages; root never deletable.
- Move / Re-parent: mark & paste
	- `m` mark current topic
	- `p` paste marked topic as child of highlighted (reject cycles / self)
	- Errors show as transient inline warning line.

**Counts & Metrics (MVP)**
- Each topic row shows direct and total (descendant-inclusive) message counts in the Topic Editor overlay: `Name  (direct / total)`.
- Direct count increments when a message is assigned to that exact topic.
- Total count maintained via O(depth) upward propagation on assign/reassign/move.

**Search / Filter (MVP)**
- Topic Editor & Quick Picker both have a search box.
- Behavior: filtering (hide non-matching branches) while always showing ancestor chain of any match (context preservation).
- Matching: case-insensitive substring across topic name and full path string.
- Future enhancement: fuzzy matching / scoring.

**Navigation (MVP)**
- `j` / `k`: move next / previous visible row.
- `h`: collapse current node (if expanded); if already collapsed, move focus to parent.
- `l`: expand current node (if collapsed) else move to first child.
- Arrow Left/Right: auxiliary equivalents to `h` / `l`.
- Home / End (future) can be added later; not in initial MVP.

**Visual Cues**
- Marked topic: prefixed symbol (e.g. `▶`) or distinct color.
- Inline warnings: single dim red line; disappear on next navigation or successful action.

**Deferred (Future)**
- Multi-select / batch move
- Cascade delete option
- Mouse drag & drop
- Quick jump by typing prefix / fuzzy incremental search
- Advanced analytics (growth trends, orphan detection)

**Performance & Scale**
- Virtualization threshold: if topic count ≥ 500, only render visible expanded rows + small overscan (Editor only).
- Path and search indexes may be cached; cache invalidated on rename or move.

### Topic System Integration Points

The topic system appears in three key locations within the MaiChat interface:

**1. Input Area Topic Selector** 
- **Location**: Input bar, below or adjacent to the message input.
- **Trigger**: `Ctrl+T` (Selection Mode overlay).
- **Purpose**: Set *pending* topic for the next message (does not retroactively change existing pairs).
- **Display**: Breadcrumb path (computed parent chain) of pending topic.
- **Search**: Same filter behavior (hide non-matching) to cope with large trees.
- **Creation**: NOT allowed here (no new topic creation from picker).
- **Editing**: For structural changes user presses `Ctrl+E` (Edit Mode). Selection Mode structural keys are inert.

**2. Message History Topic Selector (Active Message)**
- **Location**: Metadata (meta line) of each message pair.
- **Purpose**: Show & change assigned topic for that pair post-creation.
- **Invocation**: In VIEW mode, `Ctrl+T` opens Selection Mode with the pair's topic pre‑highlighted; Enter reassigns. (Mouse click to open palette – future enhancement.)
- **Search**: Filtering identical to Input selector to quickly jump in large trees.
- **Creation**: Not permitted here.
- **Dynamic Updates**: Breadcrumb updates after any rename or move.

**3. CLI Filtering Commands**
- **Basic Phase (current)**: `t'<substring>'` – case‑insensitive substring on topic *name only*. Bare `t` = pending topic.
- **Enhanced Phase (planned)**: Full path `t'Finance > Stock Market > TSLA'`; descendant suffix `...`; segment wildcards `*`; path wildcard child set `> *`; autocomplete suggestions.
- **Error Handling**: Advanced patterns produce clear error until phase implemented (prevents silent misassumptions).

### Cross-Integration Behavior
- Identical breadcrumb renderer used everywhere (single function; on-demand path build `topicId -> parent chain`).
- Rename / move operations re-render affected breadcrumbs instantly; no path caching layer required yet.
- Message reassignment triggers store update → filtering results update on next evaluation.
- Pending topic (input) is distinct from assigned topics of existing pairs.

### ID Strategy (MVP)
Internal UUIDs (current implementation) retained. Users never see raw IDs; only names/paths. Sequential display codes deferred until a concrete UX need emerges.

### Validation Rules (Summary)
| Operation | Allowed When | Blocked When |
|-----------|--------------|--------------|
| Create child | Name non-empty & unique among siblings | Duplicate name / empty |
| Rename | Non-root; new unique name | Empty / duplicate / root |
| Delete | Not root; no children; no messages | Has children OR messages OR is root |
| Move (re-parent) | Marked topic not root; target not descendant/self | Cycle/self/root violation |

### Filtering Roadmap
| Phase | Semantics |
|-------|-----------|
| Basic | `t'<substring>'`, bare `t` = pending topic |
| Enhanced | Paths, descendants (`...`), wildcards (`*`), autocomplete |

### Open Questions
1. Enforce sibling name uniqueness (current plan) vs allow duplicates + disambiguation?  
2. Display descendant message counts priority (which phase).  
3. Potential alternate shortcut if `Ctrl+E` conflicts in some browsers (fallback?).

---
End of spec (MVP + roadmap).


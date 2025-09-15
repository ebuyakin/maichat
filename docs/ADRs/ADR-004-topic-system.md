# ADR-004: Topic System Implementation Details

Date: 2025-08-23
Status: Proposed
Decision: Pending (will move to Accepted after Phase 5 implementation)

See also
- Topic system living spec: `../topic_system.md`
- Architecture map: `../ARCHITECTURE.md`

## Context
A hierarchical topic system is central to organizing conversation MessagePairs. We require keyboard-first management without introducing persistent side panels, consistent with minimalist UI principles.

## Decision (Proposed)
Implement a transient Topic Palette Overlay used in two modes:
- Selection Mode (Ctrl+T): choose topic for pending message or active pair reassignment.
- Edit Mode (Ctrl+E): structural modifications (create, rename, delete-if-empty, re-parent via mark & place).

Re-parent implemented with mark (`M`) and place (`P` / `Shift+P`) semantics to avoid complex drag/drop logic.

## Rationale
- Overlay maintains visual minimalism and avoids layout shifts.
- Mark & place is deterministic, fully keyboard-driven, and easy to validate for cycle prevention.
- Deferring descendant counts & search keeps MVP complexity low.

## Constraints
- Root topic immutable: cannot be renamed, moved, or deleted.
- Delete only allowed when topic has no children and no messages (no cascade in MVP).
- Sibling names must be unique (simplifies path display and reduces ambiguity for future path-based filtering).

## Alternatives Considered
1. Persistent side panel tree: rejected (violates minimal layout goal, cognitive overhead).
2. Cascade delete: deferred (risk of accidental data loss without undo system).
3. Allow duplicate sibling names: rejected for MVP (ambiguous future path filters).

## Implementation Notes
- Internal IDs remain UUID for now (no display IDs required yet).
- Path computation is on-demand; no caching layer required at current scale.
- Overlay state machine separated from rendering for testability.
- Future Enhancement: internal index for fast descendant retrieval when counts/search added.

### Ordering Modes and Aggregates (Accepted Direction)
- Provide two sibling ordering modes across Topic Editor and Topic Quick Picker:
	1) Manual: sortIndex asc, then createdAt asc, then name asc (ci). Editor supports explicit up/down reordering; Picker is read-only.
	2) Recent-by-activity: lastActiveAt desc, then createdAt asc, then name asc. No manual reordering here.

- Aggregates maintained in store:
	- directCount, totalCount (existing): recomputed upward on add/remove/reassign/move.
	- lastActiveAt (new): most recent pair.createdAt across the topic subtree; propagated upward O(depth) on changes and re-parent.

- Post-load rebuilds:
	- After initial import, invoke recalculateTopicCounts() and rebuildLastActiveAt() to ensure consistent aggregates (fixes counts appearing as zero until a new message is added after hard reload).

- Persistence & Back-compat:
	- Topics persist sortIndex and lastActiveAt, but absence is tolerated; defaults computed as needed. Underlying adapter stores whole objects; schema evolution is additive.

- Performance rationale:
	- Overlays sort only immediate children using already-maintained fields; no per-render subtree traversal. Cost per edit is O(depth) propagation; typical depths are shallow.

## Testing Strategy
- Unit: create, rename, delete (blocked + allowed), move (cycle prevention), path builder.
- Integration: overlay key sequences performing combined operations, persistence roundtrip.

## Future Work
- Add search filtering inside overlay.
- Descendant message counts and lazy aggregation.
- Optional cascade delete with confirmation & undo buffer.
- Autocomplete integration in CLI for full path filters.

## Status
Pending implementation (Phase 5). Will update to Accepted once feature passes tests and manual UX review.

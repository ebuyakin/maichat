# Folder Structure Migration Plan

Date: 2025-09-05
Status: Phase 6.5 (Compose) COMPLETE. Completed: Instrumentation (2.1), Core (5.1 subset), History (6.1), Interaction (6.2), Command (6.3), Topics (6.4), Compose (6.5). Next: start Phase 6.6 (Config overlays).
Scope: Safely transition from current ad-hoc `src/` layout to the proposed structure:

```
/runtime
/core
/features
  /history
  /interaction
  /command
  /topics
  /compose
  /config
/infrastructure
/instrumentation
/shared
/legacy   (temporary quarantine, then delete)
```

`main.js` remains at `src/main.js` initially (optionally moved to repo root in the final polish step – deferred unless explicitly approved).

---
## Guiding Principles
1. Zero behavioral change per step (only file moves + import path adjustments or temporary re‑exports).
2. Small, reviewable commits; each step ends with: tests green + manual smoke.
3. Use temporary re-export shims to decouple move ordering from global import edits.
4. Delete legacy only after verified unused via grep + runtime smoke.
5. Abort / rollback strategy documented for every step.

### Smoke Checklist (Run After Each Step)
(Keep this quick to maintain cadence; expand only if a failure occurs.)
- Page loads (no console errors).
- Existing messages (if any demo seed) render.
- Keyboard: `j`/`k` moves focus; `Ctrl+,` opens settings; `F1` opens help overlay; `Esc` closes overlay.
- Send: Type a short message and send (verify response or error placeholder appears, app recovers focus).
- Topic editor opens (Ctrl+E) and tree renders.
- HUD / Request Debug (if enabled) still open.

### Automated Check (Each Step)
- `npm test` (unit tests) – expecting all previous counts to pass.
- Optional: `grep -R "../.." src` to catch anomalous deep relative imports after moves.

---
## Phase & Step Overview
| Phase | Step | Goal | Risk Level | Commit Message Prefix |
|-------|------|------|------------|-----------------------|
| 0 Prep | 0.1 | Baseline commit + validation | Low | chore:migrate:baseline |
| 1 Scaffolding | 1.1 | Create new top-level folders + READMEs | Low | chore:migrate:scaffold |
| 2 Instrumentation | 2.1 | Move debug overlays to `/instrumentation` | Low | feat:structure:instrumentation |
| 3 Infrastructure | 3.1 | Move provider & api boundary | Low | feat:structure:infrastructure |
| 4 Shared Primitives | 4.1 | Move modal/focus/util to `/shared` | Low | feat:structure:shared |
| 5 Core Domain | 5.1 | Move models/store/settings/context/persistence to `/core` | Medium | feat:structure:core |
| 6 Features Part 1 | 6.1 | Create `/features/history` & move history + partitioner | Medium | feat:structure:features-history |
| 6 Features Part 2 | 6.2 | Move interaction (interaction,modes,keyRouter) | Medium | feat:structure:features-interaction |
| 6 Features Part 3 | 6.3 | Move command DSL (lexer/parser/evaluator) | Low | feat:structure:features-command |
| 6 Features Part 4 | 6.4 | Move topics (editor/picker) | Medium | feat:structure:features-topics |
| 6 Features Part 5 | 6.5 | Move compose pipeline (+ newMessageLifecycle? stays in history) | Low | feat:structure:features-compose |
| 6 Features Part 6 | 6.6 | Move config overlays (settings/model/api/help) | Medium | feat:structure:features-config |
| 7 Runtime Polishing | 7.1 | Review runtime folder borders | Low | chore:migrate:runtime-review |
| 8 Legacy | 8.1 | Quarantine legacy into `/legacy` | Low | chore:migrate:legacy-quarantine |
| 8 Legacy | 8.2 | Delete legacy after double check | Low | chore:migrate:legacy-remove |

---
## Detailed Steps
### Phase 0 – Preparation
**Step 0.1 Baseline**
- Ensure working tree clean: `git status`.
- Run tests & smoke. Commit: `chore:migrate:baseline snapshot before folder moves`.

Rollback: None needed (baseline reference).

### Phase 1 – Scaffolding
**Step 1.1 Create Directories**
- Make (empty) directories inside `src/`: `core/`, `features/`, `infrastructure/`, `instrumentation/`, `shared/`, `legacy/` (leave `/runtime` as-is).
- Add minimal README in each (purpose + “no code yet”).
- No file content changes.

Smoke: Nothing should change.
Rollback: Delete newly created empty folders & READMEs.

### Phase 2 – Instrumentation First
Reason: Lowest coupling; only referenced by overlays / entry; minimal imports.

**Step 2.1 Move (Executed)**
Files:
- `ui/debug/hudRuntime.js` → `instrumentation/hudRuntime.js`
- `ui/debug/requestDebugOverlay.js` → `instrumentation/requestDebugOverlay.js`

Approach (Actual Execution Outcome):
1. Implementations moved into `instrumentation/`.
2. Temporary re-export stubs added under `ui/debug/`.
3. Tests run (all passing) + manual browser smoke confirmed.
4. Imports in `main.js` updated to reference `instrumentation/` directly.
5. Stubs now removed (awaiting commit per user instruction to pause before commit).

Rollback: Restore original files from git; remove instrumentation copies.

### Phase 3 – Infrastructure
**Step 3.1 Move**
Files:
- `provider/adapter.js`, `provider/openaiAdapter.js` → `infrastructure/provider/`
- `api/keys.js` → `infrastructure/api/`

Use same shim technique (re-export stubs left in original locations until imports updated). Ensure relative paths inside pipeline still resolve after update.

Smoke focuses: sending pipeline still resolves provider; request debug overlay still works.

### Phase 4 – Shared Primitives
**Step 4.1 Move** `ui/openModal.js`, `ui/focusTrap.js`, `ui/util.js` → `shared/`

Shims:
- In original locations: `export * from '../shared/openModal.js'` etc.
Update imports in overlays & interaction after verifying stubs work, then delete stubs.

Extra Smoke: Open settings, help, model selector (ensures modal & focus trap functionality intact).

### Phase 5 – Core Domain
**Step 5.1 Move** – Do in two sub-batches to reduce blast radius.

Batch A:
- `models/` → `core/models/`
- `store/` → `core/store/`
- `settings/index.js` → `core/settings/index.js`

Batch B:
- `persistence/contentPersistence.js` → `core/persistence/contentPersistence.js`
- `context/boundaryManager.js`, `context/tokenEstimator.js` → `core/context/`

(Leave `context/gatherContext.js` legacy; move later.)

Shim Strategy:
- For each moved *directory*, create index re-export file at old path: e.g. `models/messagePair.js` stub that re-exports from new path.
- After imports updated, remove stubs.

Smoke Emphasis: 
- App loads (persistence still functioning – no console errors about schema).
- Sending a message (tests the store & context predictor path).

Rollback: Use git restore of moved directories; remove new copies.

### Phase 6 – Features (Segmented)
Move slices one at a time so import adjustments are localized.

**Step 6.1 History (DONE)**
Files moved & transplanted (no longer stubs): `ui/history/historyRuntime.js`, `ui/history/historyView.js`, `ui/scrollControllerV3.js`, `ui/parts.js`, `ui/newMessageLifecycle.js`, `partition/partitioner.js` → `features/history/`

Execution Notes:
1. Initial stub pass (re-exports / delegation) validated with all tests green.
2. Full implementations transplanted into `features/history/*` replacing stubs.
3. `runtime/runtimeSetup.js` imports updated to new feature paths; duplicate legacy imports removed.
4. Grep confirms no runtime imports reference old locations (only docs + legacy originals themselves).
5. Test suite remains 43/43 passing post‑transplant.

Result: Original history & partitioner source files are now detached (safe to delete – see Safe Deletion section below). Do NOT delete automatically; user will perform deletion once acknowledged.

**Step 6.2 Interaction**
Files: `ui/interaction/interaction.js`, `ui/modes.js`, `ui/keyRouter.js` → `features/interaction/`

Smoke: Mode switching (Ctrl+I/Ctrl+D), menu if any, command entry still works.

**Step 6.3 Command DSL**
Files: `filter/lexer.js`, `filter/parser.js`, `filter/evaluator.js` → `features/command/`

Smoke: Apply a basic filter; ensure rendering changes accordingly.

**Step 6.4 Topics (DONE)**
Files moved: `ui/topicEditor.js`, `ui/topicPicker.js` → `features/topics/`.
Stubs removed after import updates. Tests & smoke passed.

**Step 6.5 Compose (DONE)**
Files moved: `send/pipeline.js` → `features/compose/pipeline.js`.
Stub removed after successful tests (43 passing) and grep verification (no remaining `send/pipeline` imports).

**Step 6.6 Config Overlays**
Files: `ui/settingsOverlay.js`, `ui/modelSelector.js`, `ui/modelEditor.js`, `ui/apiKeysOverlay.js`, `ui/helpOverlay.js` → `features/config/`

Smoke: Open each overlay; modify a setting; model selection persists; help overlay appears.

For each 6.x step: same shim approach (stubs in original locations) → update imports → remove stubs.

### Phase 7 – Runtime Polishing
**Step 7.1 Review runtime**
- Confirm only orchestration files remain (`runtimeSetup.js`, `bootstrap.js`).
- If extraneous logic leaked in earlier (e.g., UI specific instantiation), plan subsequent refactor (not part of move).

### Phase 8 – Legacy Handling
**Step 8.1 Quarantine**
Move `context/gatherContext.js`, `ui/anchorManager.js`, `ui/windowScroller.js` → `legacy/`
Add header comment to each: `// LEGACY: pending deletion after verification`.

Smoke: Ensure no runtime import errors; grep for any leftover references.

**Step 8.2 Delete**
- Grep confirm zero imports: `grep -R "gatherContext" src || true` etc.
- Remove files; run tests + smoke.

Commit messages clearly note deletion.

### (Removed) Phase 9 – Entry Relocation
Decision: Keep `main.js` inside `src/` permanently. Rationale: Consistent path for bundlers & tooling, keeps all runtime source under one root, avoids extra top-level noise. Any newcomer expects an entry inside `src/`; we preserve that convention.

---
## Import Update Strategy Summary
1. Move file(s).
2. Add stub(s) in old location(s): `export * from 'NEW_PATH'` (and for default export if needed: `export { default } from 'NEW_PATH'`).
3. Run tests & smoke (should pass due to stubs).
4. Bulk replace imports referencing old path (scoped find/replace). Re-run tests.
5. Remove stubs. Final test + smoke.

Advantages: Allows incremental safety while avoiding multi-hundred line diff shocks.

---
## Risk & Mitigation Table
| Risk | Cause | Mitigation | Detection |
|------|-------|-----------|-----------|
| Broken relative import | Incorrect `../` depth after move | Use stubs + run tests before stub removal | Unit tests + console errors |
| Runtime failing early | Missed import path update in entry bootstrap | Instrument step-by-step; check console each step | Browser console |
| Overlapping uncommitted moves | Large batch move | Keep steps atomic; commit after each | `git status` clean after every step |
| Hidden legacy reference | Undetected import or dynamic require (none expected) | Grep before delete | Grep + tests |
| Accidental logic edit | Manual copy/paste instead of move | Use `git mv` only | Diff review |

---
## Tooling Aids (Optional Scripts)
Add a temporary npm script: `"migrate:test": "npm test && echo Smoke: open browser manually"` to standardize routine.

Consider a helper bash snippet to create stubs:
```
create_stub() {
  local old=$1; local new=$2; echo "export * from '${new}';" > "$old"; }
```

---
## Completion Criteria
- All directories reflect target structure (excluding removed optional entry relocation).
- Zero re-export stubs remain.
- Legacy directory either empty (deleted) or documented with removal date.
- `main.js` stays in `src/` (explicit decision recorded).
- Tests pass; manual smoke passes.
- Architecture document Section 3 & Appendix updated to actual state; proposal appendix either removed or marked historical.

---
## Post-Migration Follow-Ups (Non-blocking)
- Split `features/config/settingsOverlay.js` into sub-panels.
- Evaluate size of `features/interaction/interaction.js` (>600 LOC trigger split).
- Add `runtime/events.js` (sendAttempt, sendResult, contextPredicted) once instrumentation expansion begins.
- Consider moving partitioner helpers out if segmentation logic compounds (after block model design).

---
## Quick Reference Move Map
| From | To |
|------|----|
| (DONE) ui/debug/hudRuntime.js | instrumentation/hudRuntime.js |
| (DONE) ui/debug/requestDebugOverlay.js | instrumentation/requestDebugOverlay.js |
| provider/adapter.js | infrastructure/provider/adapter.js |
| provider/openaiAdapter.js | infrastructure/provider/openaiAdapter.js |
| api/keys.js | infrastructure/api/keys.js |
| ui/openModal.js | shared/openModal.js |
| ui/focusTrap.js | shared/focusTrap.js |
| ui/util.js | shared/util.js |
| models/* | core/models/* |
| store/* | core/store/* |
| settings/index.js | core/settings/index.js |
| persistence/contentPersistence.js | core/persistence/contentPersistence.js |
| context/boundaryManager.js | core/context/boundaryManager.js |
| context/tokenEstimator.js | core/context/tokenEstimator.js |
| partition/partitioner.js | features/history/partitioner.js (DONE) |
| ui/history/* (runtime, view) | features/history/* (DONE) |
| ui/scrollControllerV3.js | features/history/scrollControllerV3.js (DONE) |
| ui/parts.js | features/history/parts.js (DONE) |
| ui/newMessageLifecycle.js | features/history/newMessageLifecycle.js (DONE) |
| (DONE) ui/interaction/interaction.js | features/interaction/interaction.js |
| (DONE) ui/modes.js | features/interaction/modes.js |
| (DONE) ui/keyRouter.js | features/interaction/keyRouter.js |
| (DONE) filter/lexer.js | features/command/lexer.js |
| (DONE) filter/parser.js | features/command/parser.js |
| (DONE) filter/evaluator.js | features/command/evaluator.js |
| filter/lexer.js | features/command/lexer.js |
| filter/parser.js | features/command/parser.js |
| filter/evaluator.js | features/command/evaluator.js |
| ui/topicEditor.js | features/topics/topicEditor.js |
| ui/topicPicker.js | features/topics/topicPicker.js |
| send/pipeline.js | features/compose/pipeline.js (DONE) |
| ui/settingsOverlay.js | features/config/settingsOverlay.js |
| ui/modelSelector.js | features/config/modelSelector.js |
| ui/modelEditor.js | features/config/modelEditor.js |
| ui/apiKeysOverlay.js | features/config/apiKeysOverlay.js |
| ui/helpOverlay.js | features/config/helpOverlay.js |
| context/gatherContext.js | legacy/gatherContext.js |
| ui/anchorManager.js | legacy/anchorManager.js |
| ui/windowScroller.js | legacy/windowScroller.js |

**End of plan.**

## Safe Deletion (Current Status)
No pending stubs after Phase 6.5 completion. Next stubs will be produced during Phase 6.6.

## Phase 6.3 – Command DSL (Complete)
All filter stubs removed previously; no pending actions.

Interaction original stubs already removed earlier; no action needed there.

## Housekeeping / Cleanup Opportunities
- Remove now-unused placeholder helpers in `runtime/runtimeSetup.js` (`renderHistoryInternal`, `applyActivePart`) after Interaction move (they are obsolete post history transplant).
- Consider adding a tiny integration test for `createHistoryRuntime` to lock render + active part invariants.
- After Interaction & Command moves, run a global grep for any lingering `../ui/` imports to ensure complete feature isolation.

## Verification Snapshot (Post 6.1)
- Tests: 43/43 passing.
- Grep: no runtime imports to old history or partitioner paths.
- Behavior: Scroll anchoring, partitioning, fade visibility, new reply focus heuristics intact (manual smoke expected to match pre‑transplant).


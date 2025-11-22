## current tasks, notes and comments. scope for the next release.

Next release focus - accurate context assembly, performance optimization, debugging/tracking tools/infrastructure via localStorage.

### Work approach, constraints:
1. Adhere to the architectural principles of the app. Prior to any update make special in-depth analysis whether the suggested changes match / align with the existing architecture and do not violate separation of concerns, layered organization, code isolation, no-duplication, simplicity and transparency criteria.
2. Minimize code changes. The app has complex dependencies so any change can have potential side effects. Prior to making changes assess possible risks and impact on other components of the app.
3. Performance is the core benefit of the app. Avoid any recommendations that may impact routine operation of the app. Specifically DOM mutations, heavy computations, indexedDB transactions, Network operations. Pay special attention to message history rendering and dynamic updates of the history view - they should be designed to minimize latency, ensure smooth and visually pleasing user experience with minimum distractions. No interface flickeging, flashing or vibrating is acceptable.
4. Implement changes in small steps preferably with one file per edit changes. Coordinate steps with User and let User test intermediate step where appropriate and manage repository commits.

### Raw problems:
1. UI: context boundary rendering - via DOM mutation (performace impact). Marking of off-context messages (color dimming - to settings, badge)  
2. Attachments - only included from the current request. Not all history
3. Messages with variants marking
5. dbg_pipeline_presend - include: token coun (system, user, history), message_count, attachments count.
6. swapping messages - swapping budget counts.


### Assistant initiation message:
Project Next Phase. Can you use #codebase and #file:docs to review the project and give me a brief summary of its purpose, approah, and current state. Use #file:_docs-inventory.csv as your guide for the documentation. pay attention to documents marked Core. ignore legacy_docs completely.

### renminders:
- delete applyOutOfContextStyling() - it's replaced.


### Architectural analysis / remarks

const __core = initRuntimeCore()
const { store, persistence, activeParts, pendingMessageMeta } = __core

const __preloadedState = await preloadState(store, { loadHistoryCount: true })
const appEl = document.querySelector('#app')
appEl.innerHTML = buildAppHTML(__preloadedState)

const __runtime = attachDomBindings(__core)
const historyRuntime = createHistoryRuntime(__runtime)

const {
  layoutHistoryPane,
  applySpacingStyles,
  renderCurrentView,
  applyActiveMessage,
  renderStatus,
} = historyRuntime

renderCurrentView({ preserveActive: false })
requestAnimationFrame(layoutHistoryPane)

const interaction = createInteraction({
  ctx: __runtime,
  dom: { commandInput, commandErrEl, inputField, sendBtn, historyPaneEl },
  historyRuntime,
  requestDebug,
  hudRuntime,
})

bootstrap({ ctx: __runtime, historyRuntime, interaction, loadingEl, skipPersistenceInit: true, skipInitialRender: true })


{modeManager, __core, store, activeParts, __runtime, historyRuntime, renderCurrentView,interaction,__initialSettings,}



User: t general <Enter>
│
├─ commandKeys: setFilterQuery('t general')
│
├─ historyRuntime.renderCurrentView()
│  │
│  ├─ Filter pairs: [all 100 pairs] → [20 "general" topic pairs]
│  │
│  ├─ boundaryMgr.updateVisiblePairs([20 pairs])
│  ├─ boundaryMgr.setModel('gpt-4')
│  ├─ boundaryMgr.applySettings({charsPerToken:4, URA:5000})
│  │
│  ├─ boundaryMgr.getBoundary()
│  │  │
│  │  └─ computeContextBoundary([20 pairs], {model, URA, cpt})
│  │     │
│  │     ├─ For each pair (newest→oldest):
│  │     │  └─ estimatePairTokens(pair, 4, 'openai')
│  │     │     ├─ userChars/4 + assistantChars/4
│  │     │     └─ + imageBudgets[].tokenCost.openai
│  │     │
│  │     ├─ Sum until exceeds 123K budget
│  │     └─ Return { included: [15 pairs], excluded: [5 pairs] }
│  │
│  ├─ Extract includedPairIds = Set{'pair-1', 'pair-2', ...}
│  │
│  └─ historyView.renderMessages({ pairs, includedPairIds })
│     │
│     └─ For each pair:
│        ├─ Check includedPairIds.has(pair.id)
│        ├─ Add class="ooc" if excluded
│        ├─ Set data-included="0" if excluded
│        └─ Add <span class="off-badge">off</span> if excluded
│
User sees: 15 normal messages + 5 dimmed "off" messages


- dbg_local storage - add timestamp
- model overload error ----


# How the app operates:
main.js
const __core = initRuntimeCore() // __core is an object with 7 plain properties and 2 functions
__runtime = attachDomBindings(__core) // add one extra property historyView (so it's 8+2)
historyRuntime = createHistoryRuntime(__runtime)


Bugs:
AI is thinking to show [x]
update in case of reAsk error - preserve existing answer [x]
feature flag - instead of ctrl-G [x]
sendNewMessage() - returns the value, none taken in inputKeys.js [x]
clean pendingImages after send. [x]
context budget. MessagePair structure supplementation. totalTokens reported - store it to compare vs estimated. store both estimaterd total

context budget summary in activity stat
image icon - open overlay on click.
f1 view mode - Ctrl_Shift_O - view draft images - view attached images
gemini - citations in the assistant body
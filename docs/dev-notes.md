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
duplication of provider list - single source of truth

context budget summary in activity stat
image icon - open overlay on click.
f1 view mode - Ctrl_Shift_O - view draft images - view attached images
gemini - citations in the assistant body


# budgeting system.
- don't mix estimates and reports
- total token cost per provider




 * @typedef {Object} MessagePair
 * @property {string} id
 * 
 * 1. Core parameters. Meta line.
 * @property {number} createdAt - ms epoch. timestamp. messages ordered in history by createdAt
 * @property {string} topicId - from topic tree
 * @property {string} model - model Id. from model catalog
 * @property {number} star - 0..3 integer
 * @property {'b'|'g'} colorFlag - simple user flag (b=blue flagged, g=grey unflagged)
 * 
 * 2. User text (user request) data.
 * @property {string} userText
 * @property {string[]|undefined} attachments - image ids attached to the user message (attach order)
 * 
 * 3. Assistant response (current) data. NB: current and previous can be swapped by user
 * @property {string} assistantText - original (raw) content (always preserved for context)
 * @property {string[]|undefined} citations - list of source URLs from the assistant response (optional)
 * @property {{[url:string]: string}|undefined} citationsMeta - map of URL -> display title
 * @property {number|undefined} responseMs - provider-reported request processing time in milliseconds
 * 
 * 3.1. Assistant response extractions (stored, but can be calculated on-the-fly)
 * @property {string|undefined} processedContent - content with code block placeholders (optional)
 * @property {Array<CodeBlock>|undefined} codeBlocks - extracted code blocks (optional)
 * @property {Array<EquationBlock>|undefined} equationBlocks - extracted equation blocks (optional)
 * 
 * 3.2. Assistant response (previous) data. Second opinion. Optional (appears in case of re-ask)
 * @property {string|undefined} previousAssistantText - assistant answer after in-place re-ask (opt)
 * @property {string[]|undefined} previousCitations - citations from previous response (optional)
 * @property {{[url:string]: string}|undefined} previousCitationsMeta - prev. citations met (opt)
 * @property {number|undefined} previousResponseMs - response time for previous answer (optional)
 * 
 * 3.3. Replacement (re-Ask, second opintion) data paremeters
 * @property {string|undefined} previousModel - model used to produce the previous answer (optional)
 * @property {number|undefined} replacedAt - timestamp (ms) when in-place replacement occurred (optional)
 * @property {string|undefined} replacedBy - actor/model that initiated replacement (optional)
 * 
 * 4. Status/state data
 * @property {('idle'|'sending'|'error'|'complete')} lifecycleState
 * @property {string|undefined} errorMessage
 * 
 * 5. Budget (token counts, - tc)
 * @property {number|undefined} userTextTokens - calculated tokens in user text (NEW)
 * @property {number|undefined} assistantTextTokens - calculated tokens in assistant response (NEW)
 * @property {number|undefined} assistantProviderTokens - provider-reported tc for assistant resp.
 * @property {number|undefined} previousUserTextTokens - calculated user tokens (for previous model)
 * @property {number|undefined} previousAssistantTextTokens - calculated assistant tokens (prev.model)
 * @property {number|undefined} previousAssistantProviderTokens - provider-reported tc for previous resp
 * 
 * 5.1. token counts for images attached to pair calculated for each provider (tokenCost).
 * @property {Array<{id:string, w:number, h:number, tokenCost:Object}>|undefined} imageBudgets 
 * 
 * 5.2. total prompt (user+system+context) token count
 * @property {number|undefined} fullPromptEstimatedTokens - estimated prompt token count
 * @property {number|undefined} fullPromptReportedTokens - reported prompt token count
 * @property {number|undefined} previousFullPromptEstimatedTokens - estimated prompt token count
 * @property {number|undefined} previousFullPromptReportedTokens - reported prompt token count
 * 
 * 5.3. total interaction token count (prompt+response+tools+thoughts) as reported by provider
 * @property {number|undefined} rawProviderTokenUsage - reported total token count
 * @property {number|undefined} previousRawProviderTokenUsage - prev. reported total token count
 * 
 * 5.4. legacy, but still in use in older versions:
 * @property {number|undefined} tokenLength - legacy (seems unused)
 * @property {number|undefined} textTokens - precomputed total text tokens (userText + assistantText)
 * @property {number|undefined} attachmentTokens - precomputed total image tokens for all attachments
 * 
 * 5.5 chacarters count (legacy, still in use)
 * @property {number|undefined} userChars - length of userText in characters 
 * @property {number|undefined} assistantChars - length of assistantText in characters 
 * @property {number|undefined} previousAssistantChars - length of previousAssistantText in characters 
 * 
 * 6. Future (not currently used)
 * @property {Object|undefined} providerMeta - provider-specific metadata (optional; reserved for future use)
 */
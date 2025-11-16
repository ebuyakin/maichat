# Send Message Dependency Trace

**Date:** 2025-11-16  
**Purpose:** Trace where every input to executeSendWorkflow comes from

---

## The Call Chain (Backwards)

```
executeSendWorkflow(text, topicId, model, ...)
    ↑ called by
inputKeys.js: Enter handler
    ↑ receives
createInputKeyHandler({ inputField, store, lifecycle, ... })
    ↑ called by
main.js (app initialization)
    ↑ gets DOM elements and creates app state
HTML: <textarea id="inputField">
```

---

## Step 1: HTML Elements (DOM)

**File:** `index.html` or `app.html`

```html
<textarea id="inputField" placeholder="Type message..."></textarea>
<div id="historyPane"></div>
<select id="modelSelect"></select>
<div id="topicDropdown"></div>
```

**Variables created:**
- `inputField` = `document.getElementById('inputField')` (textarea element)
- `historyPane` = `document.getElementById('historyPane')` (div element)

---

## Step 2: App Initialization (main.js)

**File:** `src/main.js`

```javascript
// Get DOM elements
const inputField = document.getElementById('inputField')
const historyPane = document.getElementById('historyPane')

// Create app state
const store = createMemoryStore()
const lifecycle = createLifecycle()
const boundaryMgr = createBoundaryManager()
const historyRuntime = createHistoryRuntime({ store, ... })
const activeParts = createActiveParts({ store, ... })
const scrollController = createScrollController({ ... })
const requestDebug = createRequestDebug({ ... })

// Metadata object for pending message
const pendingMessageMeta = {
  topicId: null,           // Set when user selects topic
  model: null,             // Set when user selects model  
  attachments: [],         // Image IDs added by user
  webSearchOverride: undefined
}

// Create INPUT mode key handler
const inputKeyHandler = createInputKeyHandler({
  modeManager,
  inputField,              // ← DOM element passed in
  lifecycle,               // ← App state passed in
  store,                   // ← App state passed in
  boundaryMgr,             // ← App state passed in
  pendingMessageMeta,      // ← Mutable object passed in
  historyRuntime,
  activeParts,
  scrollController,
  requestDebug,
  updateSendDisabled,
  getCurrentTopicId,
  getReadingMode,
  setReadingMode,
  sanitizeDisplayPreservingTokens,
  escapeHtmlAttr,
  escapeHtml,
  renderPendingMeta,
  openChronoTopicPicker,
})

// Attach event listener
inputField.addEventListener('keydown', inputKeyHandler)
```

**Variables created/passed:**
- `inputField` ← DOM `<textarea>`
- `store` ← in-memory message storage
- `pendingMessageMeta` ← mutable object tracking draft state
- All other managers/controllers

---

## Step 3: Input Key Handler (inputKeys.js)

**File:** `src/features/interaction/inputKeys.js`

**Function:** `createInputKeyHandler()`

```javascript
export function createInputKeyHandler({
  inputField,           // ← Passed from main.js
  pendingMessageMeta,   // ← Passed from main.js
  store,                // ← Passed from main.js
  lifecycle,            // ← Passed from main.js
  // ... other dependencies
}) {
  // Returns event handler function
  return function handleKeyDown(e) {
    // ... handle various keys
    
    if (e.key === 'Enter') {
      const text = inputField.value.trim()  // ← READ from DOM element
      
      if (text) {
        const editingId = window.__editingPairId  // ← Global variable
        const topicId = pendingMessageMeta.topicId || getCurrentTopicId()  // ← From metadata object
        const model = pendingMessageMeta.model || getActiveModel()  // ← From metadata object
        const attachmentsCopy = Array.isArray(pendingMessageMeta.attachments)
          ? pendingMessageMeta.attachments.slice()  // ← From metadata object
          : []
        
        // Call sendWorkflow
        executeSendWorkflow({
          text,                  // ← From inputField.value
          topicId,               // ← From pendingMessageMeta or fallback
          model,                 // ← From pendingMessageMeta or fallback
          attachments: attachmentsCopy,  // ← From pendingMessageMeta
          editingId,             // ← From window global
          webSearchOverride: pendingMessageMeta.webSearchOverride,
          // ... dependencies
          store,                 // ← Passed in from main.js
          lifecycle,             // ← Passed in from main.js
          // ... other dependencies
        })
      }
    }
  }
}
```

---

## Dependency Map

### text
```
HTML: <textarea id="inputField">
  ↓ User types: "What is quantum physics?"
  ↓ Stored in: inputField.value
  ↓ Read by: inputField.value.trim()
  ↓ Passed to: executeSendWorkflow({ text })
```

**Variable chain:**
```
DOM textarea.value
  → inputField.value (in event handler)
    → text (local variable)
      → executeSendWorkflow({ text })
```

### topicId
```
User selects topic from dropdown
  ↓ Dropdown onChange: pendingMessageMeta.topicId = selectedTopicId
  ↓ Stored in: pendingMessageMeta.topicId (mutable object)
  ↓ Read by: pendingMessageMeta.topicId || getCurrentTopicId()
  ↓ Passed to: executeSendWorkflow({ topicId })
```

**Variable chain:**
```
Topic dropdown onChange
  → pendingMessageMeta.topicId = value
    → topicId (local variable in Enter handler)
      → executeSendWorkflow({ topicId })
```

### model
```
User selects model from dropdown
  ↓ Dropdown onChange: pendingMessageMeta.model = selectedModel
  ↓ Stored in: pendingMessageMeta.model (mutable object)
  ↓ Read by: pendingMessageMeta.model || getActiveModel()
  ↓ Passed to: executeSendWorkflow({ model })
```

**Variable chain:**
```
Model dropdown onChange
  → pendingMessageMeta.model = value
    → model (local variable in Enter handler)
      → executeSendWorkflow({ model })
```

### attachments
```
User drags/pastes image
  ↓ attachFromDataTransfer(dt) → returns imageId
  ↓ Push to: pendingMessageMeta.attachments.push(imageId)
  ↓ Stored in: pendingMessageMeta.attachments (array)
  ↓ Read by: pendingMessageMeta.attachments.slice()
  ↓ Passed to: executeSendWorkflow({ attachments })
```

**Variable chain:**
```
Drag/paste event
  → attachFromDataTransfer() returns imageId
    → pendingMessageMeta.attachments.push(imageId)
      → attachmentsCopy = pendingMessageMeta.attachments.slice()
        → executeSendWorkflow({ attachments: attachmentsCopy })
```

### editingId
```
User clicks "Re-ask" button
  ↓ Button onClick: window.__editingPairId = pairId
  ↓ Stored in: window.__editingPairId (global)
  ↓ Read by: window.__editingPairId
  ↓ Passed to: executeSendWorkflow({ editingId })
```

**Variable chain:**
```
Re-ask button onClick
  → window.__editingPairId = pairId
    → editingId (local variable in Enter handler)
      → executeSendWorkflow({ editingId })
```

### store
```
App initialization (main.js)
  ↓ createMemoryStore() → returns store instance
  ↓ Stored in: const store
  ↓ Passed to: createInputKeyHandler({ store })
  ↓ Closed over in: Enter handler function
  ↓ Passed to: executeSendWorkflow({ store })
```

**Variable chain:**
```
main.js initialization
  → const store = createMemoryStore()
    → createInputKeyHandler({ store })
      → closure captures store
        → executeSendWorkflow({ store })
```

### Other Dependencies (lifecycle, boundaryMgr, etc.)
Same pattern as store:
```
main.js initialization
  → const lifecycle = createLifecycle()
  → const boundaryMgr = createBoundaryManager()
  → etc.
    → createInputKeyHandler({ lifecycle, boundaryMgr, ... })
      → closure captures all dependencies
        → executeSendWorkflow({ lifecycle, boundaryMgr, ... })
```

---

## Key Objects: Where They Live

### pendingMessageMeta
**Created:** `main.js`
```javascript
const pendingMessageMeta = {
  topicId: null,
  model: null,
  attachments: [],
  webSearchOverride: undefined
}
```

**Modified by:**
- Topic dropdown onChange: `pendingMessageMeta.topicId = value`
- Model dropdown onChange: `pendingMessageMeta.model = value`
- Image paste/drop: `pendingMessageMeta.attachments.push(imageId)`
- Image remove: `pendingMessageMeta.attachments = pendingMessageMeta.attachments.filter(...)`
- Cleared on send: `pendingMessageMeta.attachments = []`

**Read by:**
- Enter handler: Gets values to pass to `executeSendWorkflow`

### window.__editingPairId
**Created:** Re-ask button onClick
```javascript
window.__editingPairId = pairId
```

**Cleared:**
- In `executeSendWorkflow` after creating new pair: `window.__editingPairId = null`

**Read by:**
- Enter handler: `const editingId = window.__editingPairId`

---

## Complete Data Flow Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                         USER ACTIONS                         │
└──────────────────────────────────────────────────────────────┘
     │
     ├─→ Types in <textarea id="inputField">
     │     └─→ inputField.value = "What is quantum physics?"
     │
     ├─→ Selects from topic dropdown
     │     └─→ pendingMessageMeta.topicId = "topic_001"
     │
     ├─→ Selects from model dropdown
     │     └─→ pendingMessageMeta.model = "gemini-2.0-flash-exp"
     │
     ├─→ Pastes image
     │     └─→ pendingMessageMeta.attachments.push("img_123")
     │
     └─→ Clicks Re-ask button (optional)
           └─→ window.__editingPairId = "pair_456"

┌──────────────────────────────────────────────────────────────┐
│                       USER PRESSES ENTER                     │
└──────────────────────────────────────────────────────────────┘
     │
     ├─→ inputKeys.js: handleKeyDown(e)
     │     │
     │     ├─→ READ: text = inputField.value.trim()
     │     ├─→ READ: topicId = pendingMessageMeta.topicId || getCurrentTopicId()
     │     ├─→ READ: model = pendingMessageMeta.model || getActiveModel()
     │     ├─→ READ: attachments = pendingMessageMeta.attachments.slice()
     │     ├─→ READ: editingId = window.__editingPairId
     │     │
     │     └─→ CALL: executeSendWorkflow({
     │           text,              // "What is quantum physics?"
     │           topicId,           // "topic_001"
     │           model,             // "gemini-2.0-flash-exp"
     │           attachments,       // ["img_123"]
     │           editingId,         // "pair_456" or null
     │           store,             // <MemoryStore>
     │           lifecycle,         // <Lifecycle>
     │           boundaryMgr,       // <BoundaryManager>
     │           // ... other deps
     │         })

┌──────────────────────────────────────────────────────────────┐
│                   executeSendWorkflow()                      │
└──────────────────────────────────────────────────────────────┘
     │
     └─→ Processes the request...
```

---

## Summary: Source of Truth

| Variable | Where It Lives | How It's Set | Who Reads It |
|----------|---------------|--------------|--------------|
| `text` | `inputField.value` (DOM) | User types | Enter handler |
| `topicId` | `pendingMessageMeta.topicId` | Dropdown onChange | Enter handler |
| `model` | `pendingMessageMeta.model` | Dropdown onChange | Enter handler |
| `attachments` | `pendingMessageMeta.attachments` | Image paste/drop | Enter handler |
| `editingId` | `window.__editingPairId` | Re-ask button onClick | Enter handler |
| `store` | `main.js` local variable | App initialization | Passed to handler via closure |
| `lifecycle` | `main.js` local variable | App initialization | Passed to handler via closure |
| All other deps | `main.js` local variables | App initialization | Passed to handler via closure |

---

## Key Insight: Mutable State vs Immutable Dependencies

**Mutable (changes during app usage):**
- `inputField.value` - changes as user types
- `pendingMessageMeta.*` - changes as user selects/attaches
- `window.__editingPairId` - changes when re-asking

**Immutable (created once at startup):**
- `store` - created in main.js, never replaced
- `lifecycle` - created in main.js, never replaced
- `boundaryMgr` - created in main.js, never replaced
- All other managers - created in main.js, never replaced

The Enter handler **reads** from mutable state and **uses** immutable dependencies.

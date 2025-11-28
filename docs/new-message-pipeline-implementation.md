# New Message Pipeline Implementation

**Status:** Implemented and Active (v1.2.5)  
**Date:** November 2025  
**Location:** `/src/features/newMessage/`

---

## 1. Motivation & Goals

The new message pipeline was implemented to address critical limitations in the legacy send flow and improve overall system reliability.

### Primary Objectives

**1. Accurate Token Counting**
- **Problem:** Legacy code used rough estimations that didn't account for provider-specific tokenization
- **Solution:** Implemented provider-specific tokenizers (OpenAI's tiktoken, Anthropic's, Google's)
- **Impact:** Token budgets now accurately reflect what providers actually charge, preventing context overflow and budget miscalculations

**2. Provider-Specific Image Tokenization**
- **Problem:** Image token costs varied wildly between providers (OpenAI vs Anthropic vs Google) but were estimated uniformly
- **Solution:** Each provider now has its own image tokenizer that matches their pricing model
- **Impact:** Accurate image token counting enables proper context budget management for multimodal messages

**3. Code Quality & Maintainability**
- **Problem:** Legacy flow was a 500+ line function with mixed concerns, unclear state, and difficult error handling
- **Solution:** Clean separation of concerns into 6 focused modules following single-responsibility principle
- **Impact:** Easier debugging, testing, and future enhancements

**4. Transparency & Debuggability**
- **Problem:** Complex nested logic made it hard to understand where failures occurred
- **Solution:** Each phase has clear inputs/outputs, explicit error handling, and traceable execution
- **Impact:** Faster bug fixes and easier onboarding for new developers

---

## 2. Architecture Overview

### Design Principles

1. **Phase-based Pipeline:** Six sequential phases, each with a single responsibility
2. **Provider-Agnostic Core:** Business logic separated from provider specifics
3. **Explicit Dependencies:** All dependencies injected, no hidden globals
4. **Immutable Data Flow:** Each phase returns new data, doesn't mutate inputs
5. **Centralized Orchestration:** Single orchestrator coordinates all phases

### Pipeline Phases

```
Phase 0: Initialize Pair          → Create pair, show user message, start spinner
Phase 1: Select Context Pairs      → Fit history into token budget (provider-aware)
Phase 2: Build System Message      → Construct system prompt from topic settings
Phase 3: Build Request Parts       → Flatten history + images into request format
Phase 4: Send with Retry           → Call provider API with retries & abort support
Phase 5: Parse Response            → Extract text, usage data, finish reason
Phase 6: Update Pair & UI          → Save response, stop spinner, extract code/equations
```

### Module Structure

| Module | Responsibility | Key Functions |
|--------|---------------|---------------|
| `sendNewMessageOrchestrator.js` | Coordinates entire flow | `sendNewMessage()` |
| `initializePair.js` | Create pair, show UI | `initializePair()` |
| `selectContextPairs.js` | Token budget fitting | `selectContextPairs()` |
| `buildRequestParts.js` | Prepare request payload | `buildRequestParts()` |
| `sendWithRetry.js` | API call with retries | `sendWithRetry()` |
| `parseResponse.js` | Extract response data | `parseResponse()` |
| `updatePairAndUI.js` | Save & display result | `updatePairAndUI()` |

### Key Dependencies

**Token Estimation:** `/src/infrastructure/provider/tokenEstimation/`
- `budgetEstimator.js` - Main token counting coordinator
- `openaiEstimator.js` - OpenAI-specific image token calculation (tile-based)
- `anthropicEstimator.js` - Anthropic-specific image token calculation
- `geminiEstimator.js` - Google Gemini-specific image token calculation
- `grokEstimator.js` - Grok-specific image token calculation
- `fallbackEstimator.js` - Generic estimator for unknown providers

**Note:** Text tokenization currently uses a generic `chars/CPT` formula for all providers. Provider-specific text tokenizers (tiktoken for OpenAI, etc.) are planned but not yet implemented. Image tokenization is provider-specific and accurate.

**Provider Adapters:** `/src/infrastructure/provider/adapters/`
- Each provider has its own adapter that handles API-specific formatting
- Adapters consume provider-agnostic request parts and return standardized responses

**Data Store:** `/src/core/store/memoryStore.js`
- `createStore()` - Factory function that creates the message store instance
- `MemoryStore` class - In-memory store with Map-based storage for pairs and topics
- Store is accessed via `getStore()` from `/src/runtime/runtimeServices.js`
- All pair CRUD operations go through centralized store methods
- Store handles persistence to localStorage via `/src/core/persistence/contentPersistence.js`

**Runtime Services Registry:** `/src/runtime/runtimeServices.js` ⭐ *New in v1.2.5*
- Centralized dependency injection mechanism for app-level singletons
- Eliminates "parameter drilling" (passing objects through multiple function layers)
- Provides controlled access to core services via getter functions
- Initialized once in `main.js` with all service instances
- Each getter throws error if services not initialized (fail-fast)

**Currently registered services:**
- `getStore()` - Message store (pairs, topics, CRUD operations)
- `getLifecycle()` - Lifecycle manager (pending state, abort control)
- `getHistoryRuntime()` - History runtime (rebuild, filtering, rendering)
- `getActiveParts()` - Active parts manager (focused message, navigation)
- `getScrollController()` - Scroll controller (alignment, typewriter mode)
- `getInteraction()` - Interaction controller (UI state updates)

**Design goals:**
- Replace ad-hoc global access patterns (`window.__maichat`, module-level globals)
- Make dependencies explicit and discoverable
- Enable easier testing (can mock individual services)
- Provide single initialization point for all app services
- Future: Expand to cover settings, models, UI state, etc.

---

## 3. Dual Implementation & Pipeline Selection

### Current State

Both pipelines are active and production-ready:
- **New Pipeline** (default): `/src/features/newMessage/sendNewMessageOrchestrator.js`
- **Legacy Pipeline**: `/src/features/compose/sendWorkflow.js`

The new pipeline is the default for all users as of v1.2.5.

### Pipeline Selection Mechanism

**Control:** localStorage flag `maichat_use_new_pipeline`

**Logic:**
```javascript
const USE_NEW_PIPELINE = localStorage.getItem('maichat_use_new_pipeline') !== 'false'
```

**Behavior:**
- `undefined` (not set) → **New pipeline** (default)
- `'true'` → **New pipeline**
- `'false'` → **Legacy pipeline** (explicit opt-out for testing/rollback)

**Implementation locations:**
- Send message: `/src/features/interaction/inputKeys.js` (line ~435)
- Re-ask: `/src/features/interaction/interaction.js` (line ~948)
- Abort (Ctrl+C): `/src/features/interaction/inputKeys.js` (line ~412)

### Migration to v1.2.5

**App versioning system** introduced in v1.2.5 (`/src/runtime/appMigrations.js`):
- Runs in early bootstrap (phase 2.5, before anything reads localStorage)
- Checks `maichat_app_version` key, runs migrations if needed
- Idempotent: early exits if version is current (~0.1ms overhead)
- New users: Version set to 1.2.5, no pipeline flag needed (defaults to new)
- Existing users (v1.2.0): Version set to 1.2.5, no pipeline flag needed (defaults to new)
- Future: Migration functions can update localStorage state for version upgrades

**No UI** for switching pipelines - developer/testing mechanism only.

### Legacy Pipeline Overview (For Reference)

The legacy pipeline is a monolithic implementation located in `/src/features/compose/`:

**Main orchestration:**
- `sendWorkflow.js` - `executeSendWorkflow()` function
  - Creates message pair in store
  - Computes image budgets
  - Calls `executeSend()` from pipeline.js
  - Processes response (sanitize, extract code/equations)
  - Updates store and UI
  - Manages lifecycle state

**Core send logic:**
- `pipeline.js` - `executeSend()` function
  - Token estimation and budget fitting
  - Calls `predictHistory()` and `finalizeHistory()` from `budgetMath.js`
  - Builds message array via `buildMessages()`
  - Calls provider adapter
  - Returns response data

**Key difference from new pipeline:**
- Monolithic: All logic in 2 large functions (~300-400 lines each)
- Token estimation mixed with send logic
- Less modular, harder to test individual steps
- Uses v1 adapters (`/src/infrastructure/provider/adapter.js`)
- Works correctly but less maintainable

**Note:** New pipeline uses v2 adapters (`/src/infrastructure/provider/adapterV2.js`) with improved error handling and standardized response format.

---

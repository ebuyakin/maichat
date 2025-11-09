# Context Boundary System Analysis

## Root Cause Identified (8 Nov 2025)

**The boundary calculation WORKS, but is INVISIBLE with modern models.**

### What Happened
1. **Old models** (GPT-3.5, etc.) had small context windows (4K-16K tokens)
   - Boundary was frequently visible with typical message histories
2. **Modern models** (GPT-4o, Claude 3.5, Gemini 2.0) have huge context windows (128K-2M tokens)
   - Model catalog was updated to only include modern models
   - User's message history fits completely within context window
   - No messages excluded → no visual boundary

### Verification
- Artificially reduced context window → boundary appeared correctly
- Architecture is working, just never triggered with modern models

## The Real Problem: TPM vs Context Window

**Critical oversight:** We calculate boundary using Context Window (CW), but the **actual constraint is TPM** (Tokens Per Minute).

### Current Behavior
```javascript
// In tokenEstimator.js getModelBudget()
const effective = Math.min(cw, tpm)  // ✓ Correct
return { maxContext: effective, ... }
```

Boundary calculation DOES use `min(CW, TPM)` ✓

**But:** Most modern models have:
- **CW:** 128K-2M tokens (huge)
- **TPM:** 30K-80K tokens (much smaller, the real limit)

**Example:**
- Claude 3.5 Sonnet: CW = 200K, but user's tier TPM = 40K
- Effective limit should be 40K, but if TPM is not set correctly in model catalog...

### Investigation Needed
1. Check model catalog: Are TPM values set correctly for all models?
2. Verify `getModelBudget()` is being called in boundary calculation
3. Confirm boundary uses effective limit, not raw CW

## Three Interconnected Problems to Fix

### Problem 1: TPM May Not Be Used Correctly in Boundary

**Issue:** Need to verify boundary calculation actually uses `min(CW, TPM)` as effective limit.

**Impact:** 
- Visual boundary may not appear when TPM is the limiting factor
- Send may fail even though boundary shows everything fits
- Users see no visual feedback about real token budget constraints

**Tasks:**
- [ ] Verify `boundaryMgr` calls `getModelBudget()` which returns `min(CW, TPM)`
- [ ] Check all models in catalog have correct TPM values for user's tier
- [ ] Test with model where TPM << CW (e.g., Claude 3.5 with 40K TPM, 200K CW)
- [ ] Add logging to show which limit is active (CW vs TPM)

**Files to investigate:**
- `src/core/context/tokenEstimator.js` - `getModelBudget()`, `computeContextBoundary()`
- `src/core/context/boundaryManager.js` - verify uses `getModelBudget()`
- `src/core/models/modelCatalog.js` - model TPM values

### Problem 2: Inefficient DOM Rendering (Secondary Mutation)

**Issue:** Boundary styling requires secondary DOM mutation after HTML injection.

**Current flow (INEFFICIENT):**
```
Section 2: Calculate boundary → includedIds Set
Section 3: Build HTML strings (all with data-offctx="0") → inject via innerHTML
Section 4: Query all .message elements → mutate each (toggle .ooc, update badge)
```

**Why this is bad:**
- Double DOM manipulation (innerHTML + N individual mutations)
- Causes reflow/repaint twice
- Timing-dependent (relies on synchronous execution)
- Wasteful (includes badge HTML then immediately changes it)
- Contradicts optimization work on single-pass innerHTML rendering

**Impact:**
- Performance degradation with large histories
- Fragile architecture (can break with async changes)
- Missed during renderMessages() refactoring

**Solution options:**

**Option A: Pass boundary to HTML builder**
```javascript
// In renderHistory()
historyView.renderMessages(messages, { includedIds })

// In historyView.renderMessages()
const included = includedIds.has(pair.id)
const offBadge = included 
  ? '<span class="badge offctx" data-offctx="0"></span>'
  : '<span class="badge offctx" data-offctx="1">off</span>'
const cssClass = included ? 'message' : 'message ooc'
```

**Option B: CSS data attributes (cleaner)**
```javascript
// In HTML
<div class="message" data-included="${included ? '1' : '0'}">

// In CSS
.message[data-included="0"] { color: #888; }
.message[data-included="0"] .badge.offctx { display: inline; }
.message[data-included="1"] .badge.offctx { display: none; }
```

**Tasks:**
- [ ] Decide on Option A vs B (discuss trade-offs)
- [ ] Update `historyView.renderMessages()` signature to accept `includedIds`
- [ ] Modify HTML template building to include correct attributes from start
- [ ] Remove `applyOutOfContextStyling()` function (no longer needed)
- [ ] Test with boundary visible (artificial small context window)
- [ ] Verify no performance regression

**Files to modify:**
- `src/features/history/historyView.js` - HTML builder
- `src/features/history/historyRuntime.js` - pass includedIds, remove styling call
- `src/styles/components/history.css` - if using Option B

### Problem 3: Send Fails with Long History Despite Boundary

**Issue:** API calls fail with context overflow even when boundary calculation suggests it should fit.

**Symptoms:**
- Boundary shows X messages included
- User sends request
- Error: context overflow or trimming exhausted

**Possible root causes:**

1. **Token estimation mismatch:**
   - Boundary uses heuristic (chars/token = 3.5-4)
   - Provider uses real tokenizer (more accurate)
   - Underestimation → payload too large

2. **Missing token components:**
   - System message tokens not included in boundary?
   - Image tokens underestimated (tile formula may be wrong)
   - User's typed message not accounted for in boundary display

3. **Stale boundary:**
   - Calculated before user typed current message
   - URA (User Request Allowance) reserve too small
   - Actual user message exceeds reserve

4. **Trimming loop failure:**
   - Provider retry hits max attempts (10)
   - Can't trim enough to fit
   - Need larger initial margin

**Tasks:**
- [ ] Reproduce error with specific long history
- [ ] Capture error message and debug payload (`localStorage.getItem('maichat_dbg_last_error')`)
- [ ] Compare predicted tokens vs actual request size
- [ ] Verify boundarySnapshot is passed to executeSend()
- [ ] Check trimming loop attempts count in error
- [ ] Verify URA setting is reasonable (default 100 tokens may be too small)
- [ ] Test image token estimation accuracy

**Files to investigate:**
- `src/features/compose/pipeline.js` - executeSend(), trimming loop
- `src/core/context/budgetMath.js` - predictHistory(), finalizeHistory()
- `src/core/context/tokenEstimator.js` - estimatePairTokens(), estimateImageTokens()
- `src/features/interaction/inputKeys.js` - where executeSend() is called

## Technical Implementation Details (Reference)

### Boundary Calculation Flow

```
renderHistory() 
  ↓
boundaryMgr.applySettings({ URA, charsPerToken })
  ↓
boundaryMgr.setModel(activeModel)
  ↓
boundaryMgr.updateVisiblePairs(pairs)
  ↓
boundary = boundaryMgr.getBoundary()
  ↓
applyOutOfContextStyling()  // ← INEFFICIENT, should be removed
```

**File:** `src/features/history/historyRuntime.js` (lines 234-241)

### Boundary Manager (Cached Calculation)

**File:** `src/core/context/boundaryManager.js`

**State:**
- `visiblePairs[]` - Current filtered/visible pairs
- `model` - Active model name
- `settings` - `{ userRequestAllowance, charsPerToken }`
- `dirty` flag - Triggers recalculation
- `cached` - Stores computed boundary

**Triggers for recalculation:**
- `updateVisiblePairs()` - Pairs changed
- `setModel()` - Model switched
- `applySettings()` - URA or CPT changed

**Output (`getBoundary()`):**
### Visual Display (Current - To Be Removed)

**Function:** `applyOutOfContextStyling()` (historyRuntime.js, line 482)

**What it does:**
1. Queries all `.message` elements
2. Checks if `pairId` is in `lastContextIncludedIds` Set
3. Toggles `.ooc` CSS class (dimmed styling)
4. Updates `.badge.offctx` text:
   - **In-context:** empty text, `data-offctx="0"` (hidden via CSS)
   - **Off-context:** text "off", `data-offctx="1"` (visible)

**CSS styling:**
- `.message.ooc` → `color: #888` (dimmed)
- `.badge.offctx` → pink text when visible
- `.badge.offctx[data-offctx="0"]` → `display:none`

**Problem:** This should be done during HTML construction, not as post-render mutation.

### Send Pipeline Integration
```javascript
{
  included: [...],      // Pairs that fit
  excluded: [...],      // Pairs that don't fit
  stats: {
    model,
    predictedMessageCount,
    predictedHistoryTokens,
    predictedTotalTokens,
    URA,
    charsPerToken,
    maxContext,
    maxUsable,
    ...
  }
}
```

### 3. **Visual Display**

**Function:** `applyOutOfContextStyling()` (historyRuntime.js, line 472)

**What it does:**
1. Queries all `.message` elements
2. Checks if `pairId` is in `lastContextIncludedIds` Set
3. Toggles `.ooc` CSS class (dimmed styling)
4. Updates `.badge.offctx` text:
   - **In-context:** empty text, `data-offctx="0"` (hidden via CSS)
   - **Off-context:** text "off", `data-offctx="1"` (visible)

**CSS styling:**
- `.message.ooc` → `color: #888` (dimmed)
- `.badge.offctx` → pink text when visible
- `.badge.offctx[data-offctx="0"]` → `display:none`

### 4. **Send Pipeline Integration**

**File:** `src/features/compose/pipeline.js`

**Stage 1: Prediction** (line 66-95)
```javascript
const pred = predictHistory({
  pairs: visiblePairs,
  model,
  systemText: topicSystem,
  provider: providerId,
  charsPerToken,
  URA,
  ARA,
})
```

Returns: `{ predicted[], C, HLP, systemTokens, PARA, predictedTokenSum }`

**Stage 2: Internal Trimming** (line 96-119)
- If `predictedTokenSum + systemTokens + userRequestAllowance > C`, trim oldest pairs
- Increments `T_internal` for each trimmed pair

**Stage 3: Finalization** (line 120-128)
```javascript
const finalResult = finalizeHistory({
  predicted: working,
  userText,
  systemTokens,
  C: pred.C,
  PARA: pred.PARA,
  URA,
  charsPerToken,
})
```

Returns: `{ included[], C, H0, H, HLA, userTokens, inputTokens, remainingContext, error? }`

**Stage 4: Provider Retry Loop** (line 204-342)
- Builds messages: `buildMessages({ includedPairs, newUserText })`
- Sends to provider
- If provider returns context overflow error, trim one more pair and retry
- Max 10 attempts

## Potential Problem Areas

### Issue 1: Boundary Not Calculated

**Symptom:** No visual dimming, all messages appear in-context

**Root causes:**
1. `boundaryMgr.getBoundary()` returns empty/wrong data
2. `applyOutOfContextStyling()` not called after render
3. `lastContextIncludedIds` not populated

**Check:**
- Is `renderHistory()` being called?
- Does `boundary` have `included` array?
- Is `lastContextIncludedIds` a Set with pair IDs?

### Issue 2: Send Error with Long History

**Symptom:** Error when sending with many filtered pairs

**Possible errors:**
1. **`user_prompt_too_large`** - User text + system > total context
2. **`context_overflow_after_trimming`** - Can't trim enough to fit
3. **`missing_api_key`** - No API key (unlikely if others work)
4. **Provider error** - Context length exceeded at provider

**Debug steps:**
1. Check console for error message
2. Look at `localStorage.getItem('maichat_dbg_pre_send')` - shows predicted pairs count
3. Look at `localStorage.getItem('maichat_dbg_last_error')` - shows error details

### Issue 3: Prediction vs Reality Mismatch

**Symptom:** Boundary shows X pairs fit, but send fails

**Causes:**
- Image tokens underestimated
- System message not accounted for in boundary
- Provider uses different tokenizer
- Model switched between boundary calc and send

### Issue 4: Empty Visible Pairs

**Symptom:** No messages shown, or filter excludes everything

**Check:**
- `visiblePairs` array passed to `boundaryMgr.updateVisiblePairs()`
- Filter query not too restrictive
- Messages exist in store

## Diagnostic Checklist

**When boundary disappears:**

1. Open DevTools Console
2. Run: `window.__ctx.boundaryMgr.getBoundary()`
3. Check:
   - `included` array has items?
   - `stats.predictedMessageCount` > 0?
4. Run: `window.__ctx.historyRuntime.getContextStats()`
5. Check DOM: `document.querySelectorAll('.message.ooc').length`
6. Check: `document.querySelectorAll('.badge.offctx[data-offctx="1"]').length`

**When send fails:**

1. Check error in UI
2. Console: `JSON.parse(localStorage.getItem('maichat_dbg_pre_send'))`
   - Look at `predictedMessageCount`
   - Look at `selection` array length
3. Console: `JSON.parse(localStorage.getItem('maichat_dbg_last_error'))`
   - Check `kind` or `message`
4. Check network tab for API response

## Code Locations Reference

| Component | File | Lines | Purpose |
|-----------|------|-------|---------|
| Boundary Manager | `src/core/context/boundaryManager.js` | 1-80 | Cached boundary calculation |
| Boundary Algorithm | `src/core/context/tokenEstimator.js` | 56-100 | Pure boundary computation |
| Budget Math | `src/core/context/budgetMath.js` | 20-115 | Prediction & finalization |
| Render Integration | `src/features/history/historyRuntime.js` | 221-265 | Calls boundary, renders, styles |
| Visual Styling | `src/features/history/historyRuntime.js` | 472-497 | Applies .ooc class & badges |
| Send Pipeline | `src/features/compose/pipeline.js` | 35-345 | Uses boundary for send |
| CSS Styling | `src/styles/components/history.css` | 89-101 | .ooc dimming styles |

## Next Steps for Debugging

Eugene, to pinpoint the issue, please:

1. **Test boundary visibility:**
   - Load app with some messages
   - Press `o` in View mode - does it jump anywhere?
   - Do you see "off" badges on any messages?
   - Are any messages dimmed (grayed out)?

2. **Check console:**
   - Open DevTools
   - Run: `window.__ctx.boundaryMgr.getBoundary()`
   - Share the output

3. **Test send error:**
   - Apply a filter that shows many messages (e.g., just `t` for current topic)
   - Try to send a request
   - Share the exact error message
   - Run: `JSON.parse(localStorage.getItem('maichat_dbg_last_error'))`
   - Share that output

This will help me identify exactly where the system is failing.

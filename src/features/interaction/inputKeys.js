// inputKeys.js
// Factory that creates the INPUT mode key handler. Mirrors previous inline behavior.
import { getSettings } from '../../core/settings/index.js'
import { getActiveModel } from '../../core/models/modelCatalog.js'
import { executeSend } from '../compose/pipeline.js'
import { sanitizeAssistantText } from './sanitizeAssistant.js'
import { extractCodeBlocks } from '../codeDisplay/codeExtractor.js'
import { extractEquations } from '../codeDisplay/equationExtractor.js'

export function createInputKeyHandler({
  modeManager,
  inputField,
  lifecycle,
  store,
  boundaryMgr,
  pendingMessageMeta,
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
}){
  return function inputHandler(e){
    if(window.modalIsActive && window.modalIsActive()) return false
    // Emacs-like editing shortcuts in input (new message) box
    if(e.ctrlKey && (e.key==='u' || e.key==='U')){ e.preventDefault(); const el = inputField; const end = el.selectionEnd; const start = 0; el.setRangeText('', start, end, 'end'); return true }
    if(e.ctrlKey && (e.key==='w' || e.key==='W')){ e.preventDefault(); const el = inputField; const pos = el.selectionStart; const left = el.value.slice(0, pos); const right = el.value.slice(el.selectionEnd); const newLeft = left.replace(/\s*[^\s]+\s*$/, ''); const delStart = newLeft.length; el.value = newLeft + right; el.setSelectionRange(delStart, delStart); return true }
    if(e.ctrlKey && (e.key==='a' || e.key==='A')){ e.preventDefault(); inputField.setSelectionRange(0, 0); return true }
    if(e.ctrlKey && (e.key==='e' || e.key==='E')){ e.preventDefault(); const len = inputField.value.length; inputField.setSelectionRange(len, len); return true }
    if(e.altKey && (e.key==='f' || e.key==='F')){ e.preventDefault(); const el = inputField; const pos = el.selectionStart; const text = el.value; const match = text.slice(pos).match(/\S+\s*/); if(match){ const newPos = pos + match[0].length; el.setSelectionRange(newPos, newPos); } return true }
    if(e.altKey && (e.key==='b' || e.key==='B')){ e.preventDefault(); const el = inputField; const pos = el.selectionStart; const text = el.value.slice(0, pos); const match = text.match(/\s*\S+\s*$/); if(match){ const newPos = pos - match[0].length; el.setSelectionRange(newPos, newPos); } else { el.setSelectionRange(0, 0); } return true }
    // Shift+Enter = new line (don't send)
    if(e.key==='Enter' && e.shiftKey){ return false }
    if(e.key==='Enter'){
      const text = inputField.value.trim();
      if(text){
        if(lifecycle.isPending()) return true;
        const editingId = window.__editingPairId;
        const topicId = pendingMessageMeta.topicId || getCurrentTopicId();
        const model = pendingMessageMeta.model || getActiveModel();
        boundaryMgr.updateVisiblePairs(store.getAllPairs().sort((a,b)=>a.createdAt-b.createdAt));
        boundaryMgr.setModel(pendingMessageMeta.model || getActiveModel());
        boundaryMgr.applySettings(getSettings());
        const preBoundary = boundaryMgr.getBoundary();
        const beforeIncludedIds = new Set(preBoundary.included.map(p=>p.id));
        lifecycle.beginSend(); setReadingMode(false); try{ (window.__hud && window.__hud.setReadingMode) && window.__hud.setReadingMode(false) }catch{}
        let id;
        if(editingId){
          const old = store.pairs.get(editingId);
          if(old){ store.removePair(editingId) }
          id = store.addMessagePair({ topicId, model, userText:text, assistantText:'' });
          window.__editingPairId = null;
        } else {
          id = store.addMessagePair({ topicId, model, userText:text, assistantText:'' })
        }

        ;(async()=>{
          try {
            const currentPairs = activeParts.parts.map(pt=> store.pairs.get(pt.pairId)).filter(Boolean);
            const chrono = [...new Set(currentPairs)].sort((a,b)=> a.createdAt - b.createdAt);
            boundaryMgr.updateVisiblePairs(chrono);
            boundaryMgr.setModel(model);
            boundaryMgr.applySettings(getSettings());
            const boundarySnapshot = boundaryMgr.getBoundary();
            const { content } = await executeSend({ store, model, topicId, userText:text, signal: undefined, visiblePairs: chrono, boundarySnapshot, onDebugPayload: (payload)=>{ historyRuntime.setSendDebug(payload.predictedMessageCount, payload.trimmedCount); requestDebug.setPayload(payload); historyRuntime.updateMessageCount(historyRuntime.getPredictedCount(), chrono.length) } });

            const rawText = content; // keep original for assistantText (context fidelity)
            // 1. Code extraction first
            const codeExtraction = extractCodeBlocks(rawText);
            const afterCode = codeExtraction.hasCode ? codeExtraction.displayText : rawText;
            // 2. Equation extraction (markers for simple inline)
            const eqResult = extractEquations(afterCode, { inlineMode:'markers' });
            const afterEq = eqResult.displayText; // contains [eq-n] placeholders + __EQINL_X__ markers
            // 3. Segmented sanitize (skip placeholders & markers)
            const sanitized = sanitizeDisplayPreservingTokens(afterEq);
            // 4. Expand inline markers to spans
            let finalDisplay = sanitized;
            if(eqResult.inlineSimple && eqResult.inlineSimple.length){
              for(const item of eqResult.inlineSimple){
                const span = `<span class="eq-inline" data-tex="${escapeHtmlAttr(item.raw)}">${escapeHtml(item.unicode)}</span>`;
                finalDisplay = finalDisplay.replaceAll(item.marker, span);
              }
            }
            // Normalize placeholder spacing
            finalDisplay = finalDisplay.replace(/\s*\[([a-z0-9_]+-\d+|eq-\d+)\]\s*/gi, ' [$1] ');
            finalDisplay = finalDisplay.replace(/ {2,}/g,' ');

            const updateData = { assistantText: rawText, lifecycleState:'complete', errorMessage:undefined };
            if(codeExtraction.hasCode){ updateData.codeBlocks = codeExtraction.codeBlocks; }
            if(eqResult.equationBlocks && eqResult.equationBlocks.length){ updateData.equationBlocks = eqResult.equationBlocks; }
            updateData.processedContent = (codeExtraction.hasCode || eqResult.hasEquations) ? finalDisplay : sanitizeAssistantText(rawText);

            store.updatePair(id, updateData);
            lifecycle.completeSend();
            updateSendDisabled();
            historyRuntime.renderCurrentView({ preserveActive:true });
            lifecycle.handleNewAssistantReply(id)
          } catch(ex){
            let errMsg = (ex && ex.message)? ex.message : 'error';
            if(errMsg==='missing_api_key') errMsg='API key missing (Ctrl+. → API Keys or Ctrl+K)';
            store.updatePair(id, { assistantText:'', lifecycleState:'error', errorMessage: errMsg });
            lifecycle.completeSend();
            updateSendDisabled();
            historyRuntime.renderCurrentView({ preserveActive:true })
            // Activate and anchor the error assistant message
            try {
              const pane = document.getElementById('historyPane')
              const assistantEls = pane ? pane.querySelectorAll(`.message[data-pair-id="${id}"][data-role="assistant"], .part[data-pair-id="${id}"][data-role="assistant"]`) : null
              const assistantEl = assistantEls && assistantEls.length ? assistantEls[0] : null
              if(assistantEl){
                const assistantId = assistantEl.getAttribute('data-part-id')
                if(assistantId){ 
                  activeParts.setActiveById(assistantId)
                  historyRuntime.applyActiveMessage()
                  // Anchor error message to bottom
                  if(scrollController && scrollController.alignTo){
                    requestAnimationFrame(()=>{
                      if(scrollController.remeasure) scrollController.remeasure()
                      scrollController.alignTo(assistantId, 'bottom', false)
                    })
                  }
                }
              }
            } catch {}
          } finally {
            if(getSettings().showTrimNotice){
              boundaryMgr.updateVisiblePairs(store.getAllPairs().sort((a,b)=>a.createdAt-b.createdAt));
              boundaryMgr.setModel(pendingMessageMeta.model || getActiveModel());
              boundaryMgr.applySettings(getSettings());
              const postBoundary = boundaryMgr.getBoundary();
              const afterIncludedIds = new Set(postBoundary.included.map(p=>p.id));
              let trimmed=0; beforeIncludedIds.forEach(pid=>{ if(!afterIncludedIds.has(pid)) trimmed++ });
              if(trimmed>0){ console.log(`[context] large prompt trimmed ${trimmed} older pair(s)`) }
            }
          }
        })();
        inputField.value='';
        historyRuntime.renderCurrentView({ preserveActive:true });
        // Focus the new pair's last user part explicitly (meta remains non-focusable)
        try {
          const pane = document.getElementById('historyPane')
            const userEls = pane ? pane.querySelectorAll(`.message[data-pair-id="${id}"][data-role="user"], .part[data-pair-id="${id}"][data-role="user"]`) : null
          const lastUserEl = userEls && userEls.length ? userEls[userEls.length-1] : null
          if(lastUserEl){
            const lastUserId = lastUserEl.getAttribute('data-part-id')
            if(lastUserId){ activeParts.setActiveById(lastUserId) }
          } else {
            activeParts.last()
          }
        } catch { activeParts.last() }
  historyRuntime.applyActiveMessage();
        // One-shot: bottom-align the new user message as visual cue
        if(id && scrollController && scrollController.alignTo){
          requestAnimationFrame(()=>{
            try { if(scrollController.remeasure) scrollController.remeasure() } catch {}
            // In message-based view, anchor to user message (id:u)
            scrollController.alignTo(`${id}:u`, 'bottom', false)
          })
        }
        updateSendDisabled()
      }
      return true
    }
    if(e.key==='Escape'){ modeManager.set('view'); return true }
    return false
  }
}

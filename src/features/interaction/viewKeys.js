// viewKeys.js
// Factory that creates the VIEW mode key handler. Behavior is identical to the previous inline handler.
export function createViewKeyHandler({
  modeManager,
  activeParts,
  historyRuntime,
  scrollController,
  hudRuntime,
  store,
  codeOverlay,
  equationOverlay,
  getReadingMode,
  setReadingMode,
  cycleStar,
  toggleFlag,
  setStarRating,
  handleEditIfErrorActive,
  handleDeleteIfErrorActive,
}){
  return function viewHandler(e){
    if(window.modalIsActive && window.modalIsActive()) return false
    window.__lastKey = e.key
    if(e.key==='Enter'){ modeManager.set('input'); return true }
    if(e.key==='Escape'){ modeManager.set('command'); return true }

    if(e.key==='r' && !e.ctrlKey && !e.metaKey && !e.altKey){
      const readingMode = !getReadingMode()
      setReadingMode(readingMode)
      hudRuntime && hudRuntime.setReadingMode && hudRuntime.setReadingMode(readingMode)
      // When turning ON, immediately center the currently focused part
      if(readingMode){
        try {
          const act = activeParts.active();
          if(act && scrollController && scrollController.alignTo){
            scrollController.alignTo(act.id, 'center', false)
          }
        } catch{}
      }
      return true
    }

    if(e.key==='j' || e.key==='ArrowDown'){
      activeParts.next();
      historyRuntime.applyActivePart();
      const act = activeParts.active(); if(act){
        if(getReadingMode() && scrollController && scrollController.alignTo){ scrollController.alignTo(act.id, 'center', false) }
        else if(scrollController && scrollController.ensureVisible){ scrollController.ensureVisible(act.id, false) }
      }
      return true
    }
    if(e.key==='k' || e.key==='ArrowUp'){
      activeParts.prev();
      historyRuntime.applyActivePart();
      const act = activeParts.active(); if(act){
        if(getReadingMode() && scrollController && scrollController.alignTo){ scrollController.alignTo(act.id, 'center', false) }
        else if(scrollController && scrollController.ensureVisible){ scrollController.ensureVisible(act.id, false) }
      }
      return true
    }
    if(e.key==='g'){
      activeParts.first();
      historyRuntime.applyActivePart();
      const act = activeParts.active(); if(act){ if(scrollController && scrollController.ensureVisible){ scrollController.ensureVisible(act.id, false) } }
      setReadingMode(false); hudRuntime && hudRuntime.setReadingMode && hudRuntime.setReadingMode(false);
      return true
    }
    if(e.key==='G'){
      activeParts.last();
      historyRuntime.applyActivePart();
      const act = activeParts.active(); if(act){ if(scrollController && scrollController.alignTo){ scrollController.alignTo(act.id, 'bottom', false) } }
      setReadingMode(false); hudRuntime && hudRuntime.setReadingMode && hudRuntime.setReadingMode(false);
      return true
    }
    // Jump to first in-context (included) pair and center it (one-shot, does not toggle Reading Mode)
    if((e.key==='O' && e.shiftKey) || e.key==='o'){
      historyRuntime.jumpToBoundary();
      try {
        const act = activeParts.active();
        if(act && scrollController && scrollController.alignTo){
          scrollController.alignTo(act.id, 'center', false)
        }
      } catch {}
      return true
    }
    // Pending code overlay digit selection must take precedence over star rating
    if(/^[1-9]$/.test(e.key) && window.__mcPendingCodeOpen){
      const act = activeParts.active();
      const pending = window.__mcPendingCodeOpen;
      if(!(act && act.role==='assistant')){ window.__mcPendingCodeOpen=null; return false }
      const pair = store.pairs.get(act.pairId);
      if(!pair || pair.id!==pending.pairId){ window.__mcPendingCodeOpen=null; return false }
      const blocks = pair.codeBlocks;
      if(!blocks || blocks.length<2){ window.__mcPendingCodeOpen=null; return false }
      const idx = parseInt(e.key,10)-1;
      if(idx>=0 && idx<blocks.length){ codeOverlay.show(blocks[idx], pair, { index: idx }); }
      window.__mcPendingCodeOpen=null;
      return true;
    }
    // Pending equation overlay digit selection (parallel to code overlay)
    if(/^[1-9]$/.test(e.key) && window.__mcPendingEqOpen){
      const act = activeParts.active();
      const pending = window.__mcPendingEqOpen;
      if(!(act && act.role==='assistant')){ window.__mcPendingEqOpen=null; return false }
      const pair = store.pairs.get(act.pairId);
      if(!pair || pair.id!==pending.pairId){ window.__mcPendingEqOpen=null; return false }
      const blocks = pair.equationBlocks;
      if(!blocks || blocks.length<2){ window.__mcPendingEqOpen=null; return false }
      const idx = parseInt(e.key,10)-1;
      if(idx>=0 && idx<blocks.length){ equationOverlay.show(blocks[idx], pair, { index: idx }); }
      window.__mcPendingEqOpen=null;
      return true;
    }
    // Passive expiry: if pending older than 3s, drop it before any further handling
    if(window.__mcPendingCodeOpen){
      if(Date.now() - window.__mcPendingCodeOpen.ts > 3000){ window.__mcPendingCodeOpen = null }
    }
    if(window.__mcPendingEqOpen){
      if(Date.now() - window.__mcPendingEqOpen.ts > 3000){ window.__mcPendingEqOpen = null }
    }
    if(e.key==='*'){ cycleStar(); return true }
    if(e.key==='a'){ toggleFlag(); return true }
    if(e.key==='1'){ setStarRating(1); return true }
    if(e.key==='2'){ setStarRating(2); return true }
    if(e.key==='3'){ setStarRating(3); return true }
    if(e.key===' '){ setStarRating(0); return true }
    // VIEW-only fast keys for error pairs
    if(e.key==='e'){ if(handleEditIfErrorActive()) return true }
    if(e.key==='d'){ if(handleDeleteIfErrorActive()) return true }
    
    // Code overlay trigger logic (smart):
    if(e.key==='v'){
      const act = activeParts.active();
      if(!(act && act.role==='assistant')) return false;
      const pair = store.pairs.get(act.pairId);
      const blocks = pair && pair.codeBlocks;
      if(!blocks || blocks.length===0) return false;
      if(blocks.length===1){
        codeOverlay.show(blocks[0], pair, { index:0 }); return true;
      }
      window.__mcPendingCodeOpen = { ts: Date.now(), pairId: pair.id };
      return true;
    }
    // Equation overlay trigger logic (smart, mirrors code overlay with 'm'):
    if(e.key==='m'){
      const act = activeParts.active();
      if(!(act && act.role==='assistant')) return false;
      const pair = store.pairs.get(act.pairId);
      const blocks = pair && pair.equationBlocks;
      if(!blocks || blocks.length===0) return false;
      if(blocks.length===1){ equationOverlay.show(blocks[0], pair, { index:0 }); return true; }
      window.__mcPendingEqOpen = { ts: Date.now(), pairId: pair.id };
      return true;
    }
    // Broad cancel: clear pending on unrelated keys
    if(window.__mcPendingCodeOpen){
      const isDigit = /^[1-9]$/.test(e.key);
      if(e.key!=='v' && !isDigit){ window.__mcPendingCodeOpen=null }
    }
    if(window.__mcPendingEqOpen){
      const isDigit = /^[1-9]$/.test(e.key);
      if(e.key!=='m' && !isDigit){ window.__mcPendingEqOpen=null }
    }
    return false
  }
}

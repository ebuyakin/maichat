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

    // Scrolling steps on messages
    if(e.key==='j' || e.key==='ArrowDown' || e.key==='J'){
      window.__lastKey = e.key
      const s = (window.getSettings ? window.getSettings() : null) || (historyRuntime && historyRuntime.getSettings && historyRuntime.getSettings()) || {}
      const step = (e.key==='J') ? (s.scrollBigStepPx||500) : (s.scrollStepPx||200)
      if(scrollController && scrollController.stepScroll){ scrollController.stepScroll(step) }
      return true
    }
    if(e.key==='k' || e.key==='ArrowUp' || e.key==='K'){
      window.__lastKey = e.key
      const s = (window.getSettings ? window.getSettings() : null) || (historyRuntime && historyRuntime.getSettings && historyRuntime.getSettings()) || {}
      const step = (e.key==='K') ? (s.scrollBigStepPx||500) : (s.scrollStepPx||200)
      if(scrollController && scrollController.stepScroll){ scrollController.stepScroll(-step) }
      return true
    }
    
    // g/G processing
    if(e.key==='g'){
      activeParts.first();
      historyRuntime.applyActiveMessage();
      const act = activeParts.active();
      if(act && scrollController && scrollController.alignToMessage){
        scrollController.alignToMessage(act.id, 'top', false)
      }
      //setReadingMode(false);
      //hudRuntime && hudRuntime.setReadingMode && hudRuntime.setReadingMode(false);
      return true
    }

    if(e.key==='G'){
      activeParts.last();
      historyRuntime.applyActiveMessage();
      const act = activeParts.active();
      if(act && scrollController && scrollController.alignToMessage){
        scrollController.alignToMessage(act.id, 'bottom', false)}
      //setReadingMode(false);
      //hudRuntime && hudRuntime.setReadingMode && hudRuntime.setReadingMode(false);
      return true
    }

    // Jump to first in-context (included) pair and center it (one-shot, does not toggle Reading Mode)
    if((e.key==='O' && e.shiftKey) || e.key==='o'){
      historyRuntime.jumpToBoundary();
      try {
        const act = activeParts.active();
        if(act && scrollController && scrollController.alignToMessage){
          scrollController.alignToMessage(act.id, 'center', false)
        }
      } catch {}
      return true
    }
    // d/u: jump to next/prev message and align to top (last message aligns bottom)
    if(e.key==='d'){
      const curIdx = activeParts.activeIndex || 0
      const nextIdx = Math.min(curIdx+1, activeParts.parts.length-1)
      const next = activeParts.parts[nextIdx]
      if(next){
  activeParts.setActiveById(next.id); historyRuntime.applyActiveMessage()
        const isLast = nextIdx === activeParts.parts.length-1
        if(scrollController && scrollController.jumpToMessage){ scrollController.jumpToMessage(next.id, isLast ? 'bottom' : 'top', true) }
        setReadingMode(false); hudRuntime && hudRuntime.setReadingMode && hudRuntime.setReadingMode(false)
        return true
      }
    }
    if(e.key==='u'){
      const curIdx = activeParts.activeIndex || 0
      const prevIdx = Math.max(0, curIdx-1)
      const prev = activeParts.parts[prevIdx]
      if(prev){
  activeParts.setActiveById(prev.id); historyRuntime.applyActiveMessage()
        if(scrollController && scrollController.jumpToMessage){ scrollController.jumpToMessage(prev.id, 'top', true) }
        setReadingMode(false); hudRuntime && hudRuntime.setReadingMode && hudRuntime.setReadingMode(false)
        return true
      }
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

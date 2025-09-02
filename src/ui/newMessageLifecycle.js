// New Message Lifecycle module
// Handles: pending send, auto-focus, filter adjustment (new reply badge removed)

import { escapeHtml } from './util.js'

export function createNewMessageLifecycle({ store, activeParts, commandInput, renderHistory, applyActivePart }){
  let pendingSend = false
  // new reply badge removed; retaining minimal variables for future extensibility
  let lastReplyPairId = null
  let activeFilterQuery = ''
  const hasDocument = typeof document !== 'undefined'

  // badge container setup removed

  function setFilterQuery(q){ activeFilterQuery = q }
  function getFilterQuery(){ return activeFilterQuery }
  function isPending(){ return pendingSend }

  function beginSend(){ pendingSend = true }
  function completeSend(){ pendingSend = false }

  // removed badge functions

  function userAtLogicalEnd(){
    const act = activeParts.active(); if(!act) return true
    const all = activeParts.parts
    const last = all[all.length-1]
    return act.id === last.id
  }

  function handleNewAssistantReply(pairId){
    lastReplyPairId = pairId
    if(!isPairVisibleInCurrentFilter(pairId)) return
    if(typeof window === 'undefined' || typeof document === 'undefined') return
    const raf = (typeof requestAnimationFrame === 'function') ? requestAnimationFrame : (fn)=> setTimeout(fn,0)
    raf(()=>{
      try {
        const pane = document.getElementById('historyPane'); if(!pane) return
        const input = document.getElementById('inputField')
        const inputEmpty = !input || input.value.trim().length === 0
        const replyParts = Array.from(pane.querySelectorAll(`.part[data-pair-id="${pairId}"][data-role="assistant"]`))
        if(!replyParts.length) return
        const first = replyParts[0]
        const last = replyParts[replyParts.length-1]
        const firstRect = first.getBoundingClientRect()
        const lastRect = last.getBoundingClientRect()
        const paneRect = pane.getBoundingClientRect()
        // Measure reply height relative to same viewport coordinate space
        const replyHeight = lastRect.bottom - firstRect.top
        const paneH = paneRect.height
        // Additional heuristic: if first part scrolled partially above pane, adjust by clipping amount so we evaluate total logical height
        const clippedTop = Math.max(0, paneRect.top - firstRect.top)
        const logicalReplyHeight = replyHeight + clippedTop
        // Fallback: count of parts as secondary signal of largeness
        const multiPart = replyParts.length > 1
        // Determine fit allowing a 2px slack
        const fits = logicalReplyHeight <= (paneH - 2)
        const modeMgr = window.__modeManager
        const MODES = window.__MODES
        const currentMode = modeMgr ? modeMgr.mode || modeMgr.current : null
        const shouldSwitch = (currentMode === 'input') && inputEmpty && (!fits || multiPart)
        if(window.__focusDebug){
          console.log('[focus-debug-reply]', { replyHeight, logicalReplyHeight, paneH, clippedTop, fits, multiPart, inputEmpty, mode: currentMode, shouldSwitch, parts: replyParts.length, paneScrollH: pane.scrollHeight, paneClientH: pane.clientHeight })
        }
        if(shouldSwitch && modeMgr && MODES){
          // Switch first, then set active assistant part.
          if(typeof modeMgr.set === 'function') modeMgr.set(MODES.VIEW)
          const firstAssistant = activeParts.parts.find(p=> p.pairId===pairId && p.role==='assistant')
          if(firstAssistant){ activeParts.setActiveById(firstAssistant.id); applyActivePart() }
        } else {
          // No mode change; if user stayed in INPUT we leave focus on user part per refined requirement.
        }
      } catch(err){ if(window.__focusDebug) console.log('[focus-debug-error]', err) }
    })
  }

  function isPairVisibleInCurrentFilter(pairId){
    if(!hasDocument) return true
    // If no active filter query, assume visible; otherwise check for any part element with that pair id
    if(!activeFilterQuery) return true
    return !!document.querySelector(`.part[data-pair-id="${pairId}"]`)
  }

  function jumpToNewReply(){ /* removed; noop for compatibility */ return false }
  function updateNewReplyBadgeVisibility(){ /* removed */ }
  function getBadgeState(){ return { visible:false, dim:false, targetPairId:null } }

  return {
    beginSend, completeSend, isPending,
  handleNewAssistantReply, updateNewReplyBadgeVisibility,
  jumpToNewReply, setFilterQuery, getFilterQuery,
  getBadgeState, userAtLogicalEnd
  }
}

// Pure helper for tests: returns true if mode INPUT and reply overflows viewport.
export function shouldAutoSwitchToView({ mode, replyHeight, paneHeight, inputEmpty }){
  return mode === 'input' && inputEmpty && replyHeight > paneHeight
}

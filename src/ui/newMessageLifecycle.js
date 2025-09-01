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
    const replyVisible = isPairVisibleInCurrentFilter(pairId)
    if(userAtLogicalEnd() && replyVisible){
      const firstAssistant = activeParts.parts.find(p=> p.pairId===pairId && p.role==='assistant')
      if(firstAssistant){ activeParts.setActiveById(firstAssistant.id); applyActivePart() }
    }
  }

  function isPairVisibleInCurrentFilter(pairId){
  if(!activeFilterQuery) return true
  if(!hasDocument) return true
  return !!document.querySelector(`.pair[data-pair-id="${pairId}"]`)
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

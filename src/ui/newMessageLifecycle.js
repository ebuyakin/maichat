// New Message Lifecycle module
// Handles: pending send, new reply badge, auto-focus, filter adjustment (B2)

import { escapeHtml } from './util.js'

export function createNewMessageLifecycle({ store, activeParts, commandInput, renderHistory, applyActivePart }){
  let pendingSend = false
  let newReplyBadgeState = { visible:false, dim:false, targetPairId:null }
  let lastReplyPairId = null
  let activeFilterQuery = ''
  const hasDocument = typeof document !== 'undefined'

  ensureTopBarBadgeContainer()

  function setFilterQuery(q){ activeFilterQuery = q }
  function getFilterQuery(){ return activeFilterQuery }
  function isPending(){ return pendingSend }

  function beginSend(){ pendingSend = true }
  function completeSend(){ pendingSend = false }

  function ensureTopBarBadgeContainer(){
    if(!hasDocument) return
    const statusRight = document.getElementById('statusRight')
    if(statusRight && !statusRight.querySelector('.badge.new-reply')){
      const span = document.createElement('span')
      span.className = 'badge new-reply'
      span.style.display = 'none'
      span.textContent = 'new reply'
      span.addEventListener('click', ()=> jumpToNewReply('first'))
      statusRight.appendChild(span)
    }
  }

  function setNewReplyBadge({ visible, dim, targetPairId }){
    newReplyBadgeState = { visible, dim, targetPairId }
  if(!hasDocument) return
  const el = document.querySelector('.badge.new-reply')
  if(!el) return
  el.style.display = visible ? 'inline-block' : 'none'
  el.classList.toggle('dim', dim)
  if(visible) el.textContent = dim ? 'new reply (filtered)' : 'new reply'
  }

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
      setNewReplyBadge({ visible:false, dim:false, targetPairId:null })
    } else {
      setNewReplyBadge({ visible:true, dim: !replyVisible, targetPairId: pairId })
    }
  }

  function isPairVisibleInCurrentFilter(pairId){
  if(!activeFilterQuery) return true
  if(!hasDocument) return true
  return !!document.querySelector(`.pair[data-pair-id="${pairId}"]`)
  }

  function jumpToNewReply(which){
    if(!lastReplyPairId) return false
    if(newReplyBadgeState.dim){
      if(activeFilterQuery){
        activeFilterQuery = ''
        if(commandInput){ commandInput.value = '' }
        renderHistory(store.getAllPairs())
      }
    }
    const candidates = activeParts.parts.filter(p=> p.pairId===lastReplyPairId && p.role==='assistant')
    if(!candidates.length) return false
    const target = which==='last' ? candidates[candidates.length-1] : candidates[0]
    activeParts.setActiveById(target.id); applyActivePart(); setNewReplyBadge({ visible:false, dim:false, targetPairId:null })
    return true
  }

  function updateNewReplyBadgeVisibility(){
    if(!lastReplyPairId) return
    if(!newReplyBadgeState.visible) return
    const replyVisible = isPairVisibleInCurrentFilter(lastReplyPairId)
    if(replyVisible && newReplyBadgeState.dim){
      setNewReplyBadge({ visible:true, dim:false, targetPairId:lastReplyPairId })
    }
  }

  function getBadgeState(){ return { ...newReplyBadgeState } }

  return {
    beginSend, completeSend, isPending,
    handleNewAssistantReply, updateNewReplyBadgeVisibility,
    jumpToNewReply, setFilterQuery, getFilterQuery,
    getBadgeState, userAtLogicalEnd
  }
}

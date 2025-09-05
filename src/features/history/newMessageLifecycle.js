// newMessageLifecycle moved from ui/newMessageLifecycle.js
import { escapeHtml } from '../../shared/util.js'
export function createNewMessageLifecycle({ store, activeParts, commandInput, renderHistory, applyActivePart }){
	let pendingSend = false
	let lastReplyPairId = null
	let activeFilterQuery = ''
	const hasDocument = typeof document !== 'undefined'
	function setFilterQuery(q){ activeFilterQuery = q }
	function getFilterQuery(){ return activeFilterQuery }
	function isPending(){ return pendingSend }
	function beginSend(){ pendingSend = true }
	function completeSend(){ pendingSend = false }
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
				const replyHeight = lastRect.bottom - firstRect.top
				const paneH = paneRect.height
				const clippedTop = Math.max(0, paneRect.top - firstRect.top)
				const logicalReplyHeight = replyHeight + clippedTop
				const multiPart = replyParts.length > 1
				const fits = logicalReplyHeight <= (paneH - 2)
				const modeMgr = window.__modeManager
				const MODES = window.__MODES
				const currentMode = modeMgr ? modeMgr.mode || modeMgr.current : null
				const shouldSwitch = (currentMode === 'input') && inputEmpty && (!fits || multiPart)
				if(window.__focusDebug){
					console.log('[focus-debug-reply]', { replyHeight, logicalReplyHeight, paneH, clippedTop, fits, multiPart, inputEmpty, mode: currentMode, shouldSwitch, parts: replyParts.length, paneScrollH: pane.scrollHeight, paneClientH: pane.clientHeight })
				}
				if(shouldSwitch && modeMgr && MODES){
					if(typeof modeMgr.set === 'function') modeMgr.set(MODES.VIEW)
					const firstAssistant = activeParts.parts.find(p=> p.pairId===pairId && p.role==='assistant')
					if(firstAssistant){ activeParts.setActiveById(firstAssistant.id); applyActivePart() }
				}
			} catch(err){ if(window.__focusDebug) console.log('[focus-debug-error]', err) }
		})
	}
	function isPairVisibleInCurrentFilter(pairId){
		if(!hasDocument) return true
		if(!activeFilterQuery) return true
		return !!document.querySelector(`.part[data-pair-id="${pairId}"]`)
	}
	function jumpToNewReply(){ return false }
	function updateNewReplyBadgeVisibility(){}
	function getBadgeState(){ return { visible:false, dim:false, targetPairId:null } }
	return { beginSend, completeSend, isPending, handleNewAssistantReply, updateNewReplyBadgeVisibility, jumpToNewReply, setFilterQuery, getFilterQuery, getBadgeState, userAtLogicalEnd }
}
export function shouldAutoSwitchToView({ mode, replyHeight, paneHeight, inputEmpty }){
	return mode === 'input' && inputEmpty && replyHeight > paneHeight
}

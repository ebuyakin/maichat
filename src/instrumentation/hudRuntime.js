// hudRuntime implementation moved here from ui/debug/hudRuntime.js (Phase 2)
// Original comment:
// hudRuntime.js (Step 5) Extracted HUD monitoring logic from main.js. No behavior changes intended.

import { getSettings } from '../core/settings/index.js'
import { registerModalExemptRoot } from '../shared/openModal.js'

export function createHudRuntime({ store, activeParts, scrollController, historyPaneEl, historyRuntime, modeManager }){
	const hudEl = document.getElementById('hud') || (()=>{ const el = document.createElement('div'); el.id='hud'; document.body.appendChild(el); return el })()
	try{ if(!hudEl.__exempt){ hudEl.__exempt = registerModalExemptRoot(hudEl) } }catch{}
	let hudEnabled = false
	const hudState = { layout:true, meta:true }
	let lastUpdateTime = 0
	const UPDATE_INTERVAL = 200 // Update HUD every 200ms instead of every frame (60fps)

	if(!hudEl.__hudClickBound){
		hudEl.addEventListener('click', (e)=>{
			const target = e.target.closest('[data-hud-section-header]')
			if(!target) return
			const key = target.getAttribute('data-section')
			if(key && hudState.hasOwnProperty(key)){ hudState[key] = !hudState[key] }
		})
		hudEl.__hudClickBound = true
	}

	function formatTimestamp(ts){
		const d = new Date(ts)
		const yy = String(d.getFullYear()).slice(-2)
		const dd = String(d.getDate()).padStart(2,'0')
		const mm = String(d.getMonth()+1).padStart(2,'0')
		const hh = String(d.getHours()).padStart(2,'0')
		const mi = String(d.getMinutes()).padStart(2,'0')
		const ss = String(d.getSeconds()).padStart(2,'0')
		return `${yy}-${mm}-${dd} ${hh}:${mi}:${ss}`
	}

	function sectionHTML(key, title, arr){
		const open = hudState[key]
		const indicator = open ? '-' : '+'
		const header = `<div data-hud-section-header data-section="${key}" style="cursor:pointer; font-weight:bold;">[${indicator}] ${title}</div>`
		if(!open) return header
		return header + `<pre style="margin:0; white-space:pre;">${arr.join('\n')}</pre>`
	}

	function update(){
		hudEl.style.display = hudEnabled ? 'block' : 'none'
		
		// Throttle updates to reduce CPU usage
		const now = performance.now()
		if(hudEnabled && now - lastUpdateTime < UPDATE_INTERVAL){
			requestAnimationFrame(update)
			return
		}
		lastUpdateTime = now
		
		if(!hudEnabled){ requestAnimationFrame(update); return }
		const act = activeParts.active()
		let pairInfo='(none)'
		if(act){
			const pair = store.pairs.get(act.pairId)
			if(pair){
				const topic = store.topics.get(pair.topicId)
				pairInfo = `${pair.id.slice(0,8)} t:${topic?topic.name:''}<br/>★:${pair.star} flag:${pair.colorFlag} model:${pair.model}<br/>@${formatTimestamp(pair.createdAt)}`
			}
		}
		const focusEl = document.activeElement
		const focusDesc = focusEl ? `${focusEl.tagName.toLowerCase()}${focusEl.id?('#'+focusEl.id):''}` : 'none'
		
		// Get the SCROLLABLE element (not the outer pane)
		const historyEl = document.getElementById('history')
		
		// Core scroll debugging parameters
		const layoutParams = []
		let n=1
		
		// 1. Mode
		layoutParams.push(`${n++}. Mode: ${modeManager.mode}`)
		
		// 2. Active message / total messages
		const totalMessages = activeParts.parts.length
		const activeIdx = act ? activeParts.parts.indexOf(act) + 1 : 0
		layoutParams.push(`${n++}. Active message / total messages: ${activeIdx}/${totalMessages}`)
		
		// 3. Active message ID
		const activeId = act ? act.id : '(none)'
		layoutParams.push(`${n++}. Active message ID: ${activeId}`)
		
		// Get active message element for geometry
		let activeOffsetTop = '?'
		let activeHeight = '?'
		let activeBottomOffset = '?'
		if(act){
			const el = document.querySelector(`[data-part-id="${act.id}"]`)
			if(el){
				activeOffsetTop = el.offsetTop
				activeHeight = el.offsetHeight
				activeBottomOffset = activeOffsetTop + activeHeight
			}
		}
		
		// 4. Active message offsetTop
		layoutParams.push(`${n++}. Active message offsetTop: ${activeOffsetTop}`)
		
		// 5. Active message height
		layoutParams.push(`${n++}. Active message height: ${activeHeight}`)
		
		// 6. Active message bottom offset
		layoutParams.push(`${n++}. Active message bottom offset: ${activeBottomOffset}`)
		
		// Get container geometry from the SCROLLABLE element
		const scrollTop = historyEl ? Math.round(historyEl.scrollTop) : '?'
		const scrollHeight = historyEl ? historyEl.scrollHeight : '?'
		const viewportHeight = historyEl ? historyEl.clientHeight : '?'
		const maxScroll = (scrollHeight !== '?' && viewportHeight !== '?') ? (scrollHeight - viewportHeight) : '?'
		
		// 7. Current scrollTop
		layoutParams.push(`${n++}. Current scrollTop: ${scrollTop}`)
		
		// 8. ScrollHeight (container total height)
		layoutParams.push(`${n++}. ScrollHeight (total content): ${scrollHeight}`)
		
		// 9. Viewport height (clientHeight)
		layoutParams.push(`${n++}. Viewport height: ${viewportHeight}`)
		
		// 10. MaxScroll (scrollHeight - clientHeight)
		layoutParams.push(`${n++}. MaxScroll (scrollHeight - viewport): ${maxScroll}`)
		
		// Additional helpful info
		layoutParams.push(`${n++}. Outer gap (paddingTop): ${historyEl ? (parseFloat(getComputedStyle(historyEl).paddingTop)||0) : '?'}`)
		
		const metaParams = []
		metaParams.push(`focus: ${focusDesc}`)
		try {
			const settings = getSettings()
			const ctxStats = historyRuntime.getContextStats()
			const ura = (ctxStats && (("URA" in ctxStats)? ctxStats.URA : ctxStats.assumedUserTokens)) ?? settings.userRequestAllowance
			const cpt = settings.charsPerToken
			const nta = settings.maxTrimAttempts
			const ml = ctxStats ? ctxStats.maxContext : null
			const predictedHistoryTokens = (ctxStats ? ctxStats.totalIncludedTokens : null)
			const predictedMessages = historyRuntime.getPredictedCount()
			
			// DISABLED: This was causing performance issues (iterating all pairs 60 times/sec)
			// let predictedChars = 0
			// const includedIds = historyRuntime.getIncludedIds()
			// if(includedIds && includedIds.size){
			//   for(const p of store.getAllPairs()){
			//     if(includedIds.has(p.id)) predictedChars += (p.userText?p.userText.length:0) + (p.assistantText?p.assistantText.length:0)
			//   }
			// }
			
			metaParams.push(`PARAMETERS:`)
			metaParams.push(`  URA: ${ura!=null?ura:'-'}`)
			metaParams.push(`  CPT: ${cpt!=null?cpt:'-'}`)
			metaParams.push(`  NTA: ${nta!=null?nta:'-'}`)
			metaParams.push(`  ML: ${ml!=null?ml:'-'}`)
			metaParams.push(`PREDICTED_HISTORY_CONTEXT:`)
			metaParams.push(`  Messages: ${predictedMessages}`)
			// metaParams.push(`  Characters: ${predictedChars}`)  // Disabled - performance issue
			metaParams.push(`  Tokens: ${predictedHistoryTokens!=null?predictedHistoryTokens:'-'}`)
		} catch{}

		hudEl.innerHTML = [
			sectionHTML('layout','Scroll & Layout', layoutParams),
			sectionHTML('meta','Context Meta', metaParams),
			`<div class='pairInfo'>${pairInfo}</div>`
		].join('\n')
		requestAnimationFrame(update)
	}
	requestAnimationFrame(update)

	function enable(v=true){ hudEnabled = !!v }
	function toggle(){ hudEnabled = !hudEnabled }
	return { enable, toggle, isEnabled: ()=> hudEnabled }
}


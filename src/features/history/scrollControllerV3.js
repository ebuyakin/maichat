// scrollControllerV3 moved from ui/scrollControllerV3.js
import { getSettings } from '../../core/settings/index.js'
export function createScrollController({ container, getParts }){
	let metrics = null
	let anim = null
	let animationEnabled = true
	let pendingValidate = false
	let suppressOnce = false
	// Owns-scroll flag: true while controller is driving scrollTop (animation or discrete)
	let programmaticScrollActive = false
	const ADJUST_THRESHOLD = 2
	let currentActiveIndex = 0
	let appliedScrollTop = 0
	let visibleWindow = { first:0, last:0 }
	// Stateless model: no persistent policy anchors; all actions are one-shot
	function findIndexById(partId){
		if(!metrics) return -1
		return metrics.parts.findIndex(p=> p.id === partId)
	}
	function measure(){
		const settings = getSettings()
		const edgeGap = settings.fadeZonePx || 0
		const paneH = container.clientHeight
		const nodeList = Array.from(container.querySelectorAll('.message, .part'))
		const parts = []
		const padTop = parseFloat(getComputedStyle(container).paddingTop)||0
		for(let i=0;i<nodeList.length;i++){
			const node = nodeList[i]
			if(!node.classList.contains('part') && !node.classList.contains('message')) continue
			const h = node.offsetHeight
			const start = node.offsetTop - padTop
			let gBefore = 0
			if(parts.length){
				const prev = parts[parts.length-1]
				const prevBottom = prev.start + prev.h
				const rawGap = start - prevBottom
				if(rawGap > 0) gBefore = rawGap
			} else { if(start > 0) gBefore = start }
			const id = node.getAttribute('data-part-id') || node.getAttribute('data-message-id')
			parts.push({ id, h, g: gBefore, start })
		}
		let totalContentH = 0
		if(parts.length){
			const last = parts[parts.length-1]
			totalContentH = last.start + last.h + edgeGap
		}
		metrics = { parts, paneH, edgeGap, totalContentH }
	}
	function anchorScrollTop(k, positionOverride){
		if(!metrics) return 0
		// anchorMode removed: callers must pass positionOverride explicitly; default fallback 'bottom'
		const mode = positionOverride || 'bottom'
		const { parts, paneH } = metrics
		if(k < 0 || k >= parts.length) return 0
		const padTop = parseFloat(getComputedStyle(container).paddingTop)||0
		const padBottom = parseFloat(getComputedStyle(container).paddingBottom)||0
		let fadeZone = 0
		try {
			const root = document.documentElement
			const v = getComputedStyle(root).getPropertyValue('--fade-zone')
			const n = parseFloat(v)
			if(Number.isFinite(n)) fadeZone = n
		} catch{}
		const part = parts[k]
		let S
		if(mode === 'top'){
			// Align top edge just below the top fade overlay, accounting for container top padding
			S = padTop + part.start - fadeZone
		} else if(mode === 'bottom'){
			// Align bottom edge of part to inner bottom (H - padBottom)
			// Using part.start measured from inner top, we must add padTop to convert to visual offsetTop
			// Then push it up by the bottom fade overlay height
			S = (part.start + padTop + part.h) - (paneH - padBottom) + fadeZone
		} else {
			// Center relative to the pane; convert to visual by adding padTop
			S = (part.start + padTop) + part.h/2 - (paneH/2)
		}
		const raw = Number.isFinite(S)? S : 0
		let S2 = Math.round(raw)
		const maxScroll = Math.max(0, container.scrollHeight - paneH)
		if(S2 < 0) S2 = 0
		if(S2 > maxScroll) S2 = maxScroll
		anchorScrollTop._last = { raw, clamped:S2, maxScroll }
		return S2
	}
	function computeVisibleWindow(){
		if(!metrics) return { first:0, last:0 }
		const { parts, paneH } = metrics
		if(parts.length === 0) return { first:0, last:0 }
		const S = container.scrollTop
		const viewBottom = S + paneH
		let first = 0
		for(let i=0;i<parts.length;i++){
			const top = parts[i].start
			const bottom = top + parts[i].h
			if(top >= S){ first = i; break }
			if(bottom > S){ first = i; break }
		}
		let last = first
		for(let i=first;i<parts.length;i++){
			const top = parts[i].start
			const bottom = top + parts[i].h
			if(bottom <= viewBottom) last = i
			else break
		}
		return { first, last }
	}
	function apply(activeIndex, animate=true){
		if(!metrics) measure()
		const k = Math.max(0, Math.min(activeIndex, metrics.parts.length-1))
		currentActiveIndex = k
		const target = anchorScrollTop(k)
		if(Math.abs(container.scrollTop - target) > 1){
			scrollTo(target, animate && animationEnabled)
		} else {
			appliedScrollTop = target
		}
		scheduleValidate()
	}
	function setActiveIndex(activeIndex){
		if(!metrics) measure()
		const k = Math.max(0, Math.min(activeIndex, metrics.parts.length-1))
		currentActiveIndex = k
	}
	function validate(){
		pendingValidate = false
		if(!metrics) return
		measure()
		// Stateless validate: remeasure and refresh visibility window only; do not move scroll
		appliedScrollTop = container.scrollTop
		if(suppressOnce){ suppressOnce = false }
		visibleWindow = computeVisibleWindow()
	}
	function scheduleValidate(){
		if(pendingValidate) return
		pendingValidate = true
		if(anim){
			const poll = ()=>{ if(anim){ requestAnimationFrame(poll); return } requestAnimationFrame(()=> validate()) }
			requestAnimationFrame(poll)
		} else { requestAnimationFrame(()=> validate()) }
	}
	function scrollTo(target, animate){
		cancelAnimation()
		target = Math.max(0, Math.round(target))
		if(!animate){ setScrollTopProgrammatic(target); return }
		const start = container.scrollTop
		const dist = target - start
		if(Math.abs(dist) < 2){ setScrollTopProgrammatic(target); return }
		const s = getSettings()
		let base = Math.max(0, s.scrollAnimMs || 0)
		if(s.scrollAnimDynamic){
			const paneH = metrics? metrics.paneH : container.clientHeight
			const rel = paneH>0 ? Math.min(2, Math.abs(dist)/paneH) : 1
			const scale = 0.4 + 0.6*Math.min(1, rel) + 0.6*Math.max(0, rel-1)
			base = base * scale
		}
		const dur = Math.min(Math.max(s.scrollAnimMinMs||50, base), s.scrollAnimMaxMs||800)
		const t0 = performance.now()
		function ease(t){
			const mode = s.scrollAnimEasing || 'easeOutQuad'
			if(mode==='linear') return t
			if(mode==='easeOutQuad') return 1 - (1-t)*(1-t)
			if(mode==='easeInOutCubic'){ return t<0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2,3)/2 }
			if(mode==='easeOutExpo') return t===1 ? 1 : 1 - Math.pow(2,-10*t)
			return 1 - (1-t)*(1-t)
		}
		function step(now){
			const p = Math.min(1, (now - t0)/dur)
			programmaticScrollActive = true
			container.scrollTop = start + dist * ease(p)
			if(p < 1){
				anim = requestAnimationFrame(step)
			} else {
				anim = null
				// Release ownership at the end of the animation frame
				requestAnimationFrame(()=>{ programmaticScrollActive = false })
			}
		}
		// Mark ownership before starting animation
		programmaticScrollActive = true
		anim = requestAnimationFrame(step)
	}
	function cancelAnimation(){ if(anim){ cancelAnimationFrame(anim); anim=null } }
	function setScrollTopProgrammatic(v){
		programmaticScrollActive = true
		container.scrollTop = Math.max(0, Math.round(v))
		// Release on next frame boundary to cover the async scroll event dispatch
		requestAnimationFrame(()=>{ programmaticScrollActive = false })
	}
	function debugInfo(){
		if(!metrics) return null
		const { parts, paneH } = metrics
		if(parts.length === 0) return { parts:0 }
		const containerRect = container.getBoundingClientRect()
		const vis = computeVisibleWindow()
		const visibleIndices = []
		const tops = []
		const heights = []
		for(let i=vis.first; i<=vis.last; i++){
			const id = parts[i].id
			const el = container.querySelector(`[data-part-id="${id}"]`)
			if(!el) continue
			const r = el.getBoundingClientRect()
			visibleIndices.push(i)
			tops.push(Math.round(r.top - containerRect.top))
			heights.push(r.height)
		}
		let firstTopPx = tops.length? tops[0] : null
		let visualGap = null
		// Compute visual gap from top padding
		if(firstTopPx != null){
			const padTop = parseFloat(getComputedStyle(container).paddingTop)||0
			visualGap = firstTopPx - padTop
		}
		const anchorMeta = anchorScrollTop._last || {}
		return { paneH, currentFirst:vis.first, activeIndex:currentActiveIndex, shouldVisibleCount:(vis.last-vis.first+1), firstTopPx, visualGap, visibleIndices, tops, heights, scrollTop: container.scrollTop, rawAnchor: anchorMeta.raw, maxScroll: anchorMeta.maxScroll, animationEnabled }
	}
	function setAnimationEnabled(v){ animationEnabled = !!v }
	function suppressNextValidate(){ suppressOnce = true }
	function isProgrammaticScroll(){ return !!programmaticScrollActive }

	// No persistent policy or periodic enforcement in stateless model

		// Stateless alignment API
		function alignTo(partId, position='bottom', animate=false){
			if(!metrics) measure()
			if(!metrics || metrics.parts.length===0) return
			
			let targetPartId = partId
			
			// Special case: if bottom-aligning a user part, check if we should align its meta instead
			/*if(position === 'bottom'){
				targetPartId = getBottomAlignTarget(partId)
			}*/
			
			const idx = typeof targetPartId === 'number' ? targetPartId : findIndexById(targetPartId)
			if(idx < 0 || idx >= metrics.parts.length) return
			const target = anchorScrollTop(idx, position)
			if(Math.abs(container.scrollTop - target) > ADJUST_THRESHOLD){
				scrollTo(target, !!animate && animationEnabled)
			}
			scheduleValidate()
		}
		
		function getBottomAlignTarget(partId){
			// Extract role from part ID
			const parts = String(partId).split(':')
			if(parts.length < 2) return partId // malformed ID, use as-is
			
			const role = parts[1]
			if(role !== 'user') return partId // only redirect user parts
			
			// Find current part index
			const currentIdx = findIndexById(partId)
			if(currentIdx < 0) return partId // part not found
			
			// Check next part
			if(currentIdx + 1 < metrics.parts.length){
				const nextPart = metrics.parts[currentIdx + 1]
				const nextParts = String(nextPart.id).split(':')
				if(nextParts.length >= 2 && nextParts[1] === 'meta'){
					return nextPart.id // redirect to meta
				}
			}
			
			return partId // fallback: align to original part
		}
		function ensureVisible(partId, animate=false){
			if(!metrics) measure()
			if(!metrics || metrics.parts.length===0) return
			const idx = typeof partId === 'number' ? partId : findIndexById(partId)
			if(idx < 0 || idx >= metrics.parts.length) return
			const S = container.scrollTop
			const paneH = metrics.paneH
			const padTop = parseFloat(getComputedStyle(container).paddingTop)||0
			const padBottom = parseFloat(getComputedStyle(container).paddingBottom)||0
			const part = metrics.parts[idx]
			const top = part.start
			const bottom = top + part.h
			// Usable viewport excludes outer gaps (top/bottom padding)
			const viewTop = S
			const viewBottom = S + paneH - padTop - padBottom
			let target = null
			if(top < viewTop - 1){
				target = anchorScrollTop(idx, 'top')
			} else if(bottom > viewBottom + 1){
				target = anchorScrollTop(idx, 'bottom')
			}
			if(target != null && Math.abs(container.scrollTop - target) > ADJUST_THRESHOLD){
				scrollTo(target, !!animate && animationEnabled)
			}
			scheduleValidate()
		}

	function stepScroll(deltaPx){ if(!Number.isFinite(deltaPx)) return; cancelAnimation(); setScrollTopProgrammatic(container.scrollTop + deltaPx); scheduleValidate() }
	function indexByMessageId(messageId){ return findIndexById(messageId) }
	function alignToMessage(messageId, anchor='top', animate=false){ alignTo(messageId, anchor, animate) }
	function jumpToMessage(messageId, anchor='top', animate=false){ alignTo(messageId, anchor, animate) }
	return { remeasure: measure, apply, setActiveIndex, debugInfo, setAnimationEnabled, suppressNextValidate, isProgrammaticScroll, alignTo, ensureVisible, stepScroll, indexByMessageId, alignToMessage, jumpToMessage }
}

// scrollControllerV3 moved from ui/scrollControllerV3.js
import { getSettings } from '../../core/settings/index.js'
export function createScrollController({ container, getParts }){
	let metrics = null
	let anim = null
	let animationEnabled = true
	let pendingValidate = false
	const ADJUST_THRESHOLD = 2
	let currentActiveIndex = 0
	let appliedScrollTop = 0
	let visibleWindow = { first:0, last:0 }
	function measure(){
		const settings = getSettings()
		const edgeGap = settings.gapOuterPx || 0
		const paneH = container.clientHeight
		const nodeList = Array.from(container.querySelectorAll('#history > *'))
		const parts = []
		const padTop = parseFloat(getComputedStyle(container).paddingTop)||0
		for(let i=0;i<nodeList.length;i++){
			const node = nodeList[i]
			if(!node.classList.contains('part')) continue
			const h = node.offsetHeight
			const start = node.offsetTop - padTop
			let gBefore = 0
			if(parts.length){
				const prev = parts[parts.length-1]
				const prevBottom = prev.start + prev.h
				const rawGap = start - prevBottom
				if(rawGap > 0) gBefore = rawGap
			} else { if(start > 0) gBefore = start }
			parts.push({ id: node.getAttribute('data-part-id'), h, g: gBefore, start })
		}
		let totalContentH = 0
		if(parts.length){
			const last = parts[parts.length-1]
			totalContentH = last.start + last.h + edgeGap
		}
		metrics = { parts, paneH, edgeGap, totalContentH }
	}
	function anchorScrollTop(k){
		if(!metrics) return 0
		const settings = getSettings()
		const mode = settings.anchorMode || 'bottom'
		const { parts, paneH } = metrics
		if(k < 0 || k >= parts.length) return 0
		const padTop = parseFloat(getComputedStyle(container).paddingTop)||0
		const padBottom = parseFloat(getComputedStyle(container).paddingBottom)||0
		const part = parts[k]
		let S
		if(mode === 'top'){
			S = part.start
		} else if(mode === 'bottom'){
			S = (part.start + part.h) - (paneH - padBottom) + padTop
		} else {
			S = part.start + padTop + part.h/2 - (paneH/2)
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
	function validate(){
		pendingValidate = false
		if(!metrics) return
		const prevActive = currentActiveIndex
		const before = container.scrollTop
		measure()
		const target = anchorScrollTop(prevActive)
		const diff = target - container.scrollTop
		if(Math.abs(diff) > ADJUST_THRESHOLD){ container.scrollTop = target }
		appliedScrollTop = container.scrollTop
		if(getSettings().anchorMode === 'center'){
			const part = metrics.parts[prevActive]
			if(part){
				const paneMid = metrics.paneH / 2
				const padTop = parseFloat(getComputedStyle(container).paddingTop)||0
				const currentOffset = part.start - container.scrollTop
				const visualTop = currentOffset + padTop
				const partMidVis = visualTop + part.h/2
				const delta = partMidVis - paneMid
				if(Math.abs(delta) > ADJUST_THRESHOLD){
					const corrected = Math.max(0, Math.round(container.scrollTop + delta))
					if(Math.abs(corrected - container.scrollTop) > ADJUST_THRESHOLD){
						container.scrollTop = corrected
						appliedScrollTop = container.scrollTop
					}
				}
			}
		}
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
		if(!animate){ container.scrollTop = target; return }
		const start = container.scrollTop
		const dist = target - start
		if(Math.abs(dist) < 2){ container.scrollTop = target; return }
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
			container.scrollTop = start + dist * ease(p)
			if(p < 1){ anim = requestAnimationFrame(step) } else { anim = null }
		}
		anim = requestAnimationFrame(step)
	}
	function cancelAnimation(){ if(anim){ cancelAnimationFrame(anim); anim=null } }
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
		const settings2 = getSettings()
		if(settings2.anchorMode === 'top' && firstTopPx != null){
			const padTop = parseFloat(getComputedStyle(container).paddingTop)||0
			visualGap = firstTopPx - padTop
		}
		const anchorMeta = anchorScrollTop._last || {}
		let gapBelow = null
		if(getSettings().anchorMode === 'bottom'){
			const padTop = parseFloat(getComputedStyle(container).paddingTop)||0
			const part = parts[currentActiveIndex]
			if(part){
				gapBelow = paneH - (part.start + part.h + padTop - container.scrollTop)
				gapBelow = Math.round(gapBelow)
			}
		}
		return { mode:(getSettings().anchorMode||'bottom'), paneH, currentFirst:vis.first, activeIndex:currentActiveIndex, shouldVisibleCount:(vis.last-vis.first+1), firstTopPx, visualGap, visibleIndices, tops, heights, scrollTop: container.scrollTop, rawAnchor: anchorMeta.raw, maxScroll: anchorMeta.maxScroll, gapBelow, animationEnabled }
	}
	function setAnimationEnabled(v){ animationEnabled = !!v }
	return { remeasure: measure, apply, debugInfo, setAnimationEnabled }
}

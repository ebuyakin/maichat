// parts.js moved from ui/parts.js
import { partitionMessage } from './partitioner.js'
import { getDisplayContent } from '../codeDisplay/codeExtractor.js'
export function splitText(text, role, pairId){
	return partitionMessage({ text, role, pairId })
}
export function buildParts(pairs){
	const parts = []
	for(const pair of pairs){
		const userParts = splitText(pair.userText, 'user', pair.id)
		userParts.forEach(p=> parts.push(p))
		parts.push({ id:`${pair.id}:meta`, pairId:pair.id, role:'meta', index:0, text:null })
		// Use display content (with placeholders) instead of raw assistantText
		const assistantText = getDisplayContent(pair)
		const assistantParts = splitText(assistantText, 'assistant', pair.id)
		assistantParts.forEach(p=> parts.push(p))
	}
	return parts
}
export class ActivePartController {
	constructor(){ this.parts=[]; this.activeIndex=0; this.lastActiveMeta=null }
	setParts(parts){
		const prev = this.active()
		this.parts = parts
		if(prev){
			let idx = this.parts.findIndex(p=>p.id===prev.id)
			if(idx === -1){
				const candidates = this.parts.filter(p=> p.pairId===prev.pairId && p.role===prev.role)
				if(candidates.length){
					const targetIdx = Math.min(prev.index, candidates.length-1)
					const chosen = candidates[targetIdx]
					idx = this.parts.findIndex(p=>p.id===chosen.id)
				}
			}
			if(idx !== -1) this.activeIndex = idx
		}
		if(this.activeIndex >= this.parts.length) this.activeIndex = this.parts.length? this.parts.length-1:0
		// Ensure we never leave selection on a meta part after reassigning parts
		if(this.parts[this.activeIndex]?.role==='meta'){
			const original = this.activeIndex
			this.prev()
			if(this.parts[this.activeIndex]?.role==='meta'){
				this.activeIndex = original
				this.next()
			}
		}
	}
	setActiveById(id){
		const idx = this.parts.findIndex(p=>p.id===id)
		if(idx===-1) return
		if(this.parts[idx]?.role !== 'meta'){ this.activeIndex = idx; return }
		// If target is meta, prefer nearest non-meta neighbor (backward, then forward)
		for(let i=idx-1; i>=0; i--){ if(this.parts[i].role !== 'meta'){ this.activeIndex=i; return } }
		for(let i=idx+1; i<this.parts.length; i++){ if(this.parts[i].role !== 'meta'){ this.activeIndex=i; return } }
		// Fallback: leave current active as-is when no non-meta exists
	}
	active(){ return this.parts[this.activeIndex] }
	first(){ if(this.parts.length){ this.activeIndex=0; if(this.parts[this.activeIndex]?.role==='meta') this.next() } }
	last(){ if(this.parts.length){ this.activeIndex=this.parts.length-1; if(this.parts[this.activeIndex]?.role==='meta') this.prev() } }
	next(){
		// Advance only if there is a subsequent non-meta part; otherwise keep position
		const cur = this.activeIndex
		for(let i=cur+1; i<this.parts.length; i++){
			if(this.parts[i].role !== 'meta'){ this.activeIndex = i; return }
		}
		// no-op if only meta remains ahead
	}
	prev(){
		while(this.activeIndex > 0){
			this.activeIndex--
			if(this.parts[this.activeIndex].role !== 'meta') break
		}
	}
}

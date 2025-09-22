// requestDebugOverlay implementation moved here from ui/debug/requestDebugOverlay.js (Phase 2)
// Original comment: Extracted from main.js. No behavior changes.

import { getSettings } from '../core/settings/index.js'
import { registerModalExemptRoot } from '../shared/openModal.js'

export function createRequestDebugOverlay({ historyRuntime }){
	let requestDebugEnabled = false
	let lastSentRequest = null

	function ensureOverlay(){
		if(document.getElementById('requestDebugOverlay')) return
		const pane = document.createElement('div')
		pane.id = 'requestDebugOverlay'
		pane.style.position='fixed'
		pane.style.bottom='110px'
		pane.style.right='16px'
		pane.style.width='480px'
		pane.style.maxHeight='40vh'
		pane.style.overflow='auto'
		pane.style.background='rgba(10,20,30,0.92)'
		pane.style.border='1px solid #244'
		pane.style.font='11px/1.4 var(--font-mono, monospace)'
		pane.style.padding='8px 10px'
		pane.style.borderRadius='6px'
		pane.style.boxShadow='0 4px 18px rgba(0,0,0,0.5)'
		pane.style.zIndex='1600'
		pane.style.whiteSpace='pre-wrap'
		pane.style.letterSpacing='.3px'
		pane.style.display='none'
		pane.setAttribute('aria-live','polite')
		document.body.appendChild(pane)
		// Exempt this overlay from modal blocking so it remains non-modal for debugging
		try{
			if(!pane.__exempt){ pane.__exempt = registerModalExemptRoot(pane) }
		}catch{}
	}

	function render(){
		ensureOverlay()
		const pane = document.getElementById('requestDebugOverlay')
		if(!pane) return
		if(!requestDebugEnabled){ pane.style.display='none'; return }
		pane.style.display='block'
		if(!lastSentRequest){ pane.textContent = '[request debug] No request sent yet.'; return }
		const { model, budget, selection, AUT, attemptTotalTokens, attemptHistoryTokens, predictedHistoryTokens, remainingReserve, attemptsUsed, trimmedCount, predictedMessageCount, messages, lastErrorMessage, overflowMatched, stage, timing, symbols } = lastSentRequest
		const settings = getSettings()
		const ctxStats = historyRuntime.getContextStats()
		const uraVal = (ctxStats && (("URA" in ctxStats)? ctxStats.URA : ctxStats.assumedUserTokens)) ?? settings.userRequestAllowance
		const cpt = settings.charsPerToken
		const nta = settings.maxTrimAttempts
		const ml = (budget.maxContext||budget.maxUsableRaw)
		const initialAttemptTotal = (predictedHistoryTokens!=null && AUT!=null) ? (predictedHistoryTokens + AUT) : null
		const finalAttemptTotal = (attemptHistoryTokens!=null && AUT!=null) ? (attemptHistoryTokens + AUT) : null
		const trimmedTok = (predictedHistoryTokens!=null && attemptHistoryTokens!=null) ? (predictedHistoryTokens - attemptHistoryTokens) : 0
		const lines = []
		lines.push(`MODEL: ${model}`)
		if(symbols){
			const { C, HLP, HLA, H0, H, URA, ARA, PARA, remainingContext, systemTokens, predictedTokenSum } = symbols
			lines.push('BUDGET_SYMBOLS:')
			lines.push(`  C=${C} URA=${URA} ARA=${ARA} PARA=${PARA} s=${systemTokens}`)
			lines.push(`  HLP=${HLP} HLA=${HLA} H0=${H0!=null?H0:'-'} H=${H!=null?H:'-'} R=${remainingContext!=null?remainingContext:'-'}`)
			lines.push(`  predictedTokenSum=${predictedTokenSum}`)
		}
		lines.push(`PARAMETERS: URA=${uraVal} CPT=${cpt} NTA=${nta} ML=${ml}`)
		// Try to surface provider-specific options (temperature, max_tokens) if available in captured JSON
		try {
			let parsed = null
			if (typeof window !== 'undefined' && window.__maichatLastRequest && window.__maichatLastRequest.json) {
				try { parsed = JSON.parse(window.__maichatLastRequest.json) } catch {}
			}
			if (parsed && typeof parsed === 'object') {
				const temp = parsed.temperature
				const maxTok = parsed.max_tokens
				if (temp != null || maxTok != null) {
					lines.push(`OPENAI OPTIONS:${temp!=null?` temperature=${temp}`:''}${maxTok!=null?` max_tokens=${maxTok}`:''}`)
				}
			}
		} catch {}
		lines.push(`PREDICTED_HISTORY_CONTEXT: n_of_messages=${predictedMessageCount} n_of_tokens=${predictedHistoryTokens!=null?predictedHistoryTokens:'-'}`)
		lines.push(`ACTUAL:`)
		lines.push(`  tokens_in_new_user_request=${AUT!=null?AUT:'-'}`)
		lines.push(`  tokens_in_initial_attempted_request=${initialAttemptTotal!=null?initialAttemptTotal:'-'}`)
		lines.push(`TRIMMING:`)
		lines.push(`  N_of_attempts=${attemptsUsed!=null?attemptsUsed:0}`)
		lines.push(`  N_of_tokens_trimmed=${trimmedTok}`)
		lines.push(`  tokens_in_final_attempted_request=${finalAttemptTotal!=null?finalAttemptTotal:'-'}`)
		lines.push(`  remaining_estimate=${remainingReserve!=null?remainingReserve:'-'}`)
		if(timing){
			const tPredict = timing.tAfterPrediction!=null ? (timing.tAfterPrediction - timing.t0).toFixed(1) : '-'
			lines.push(`TIMING:`)
			lines.push(`  prediction_ms=${tPredict}`)
			if(Array.isArray(timing.attempts)){
				timing.attempts.forEach(a=>{
					const dur = a.duration!=null? a.duration.toFixed(1):'-'
					let prov=''
					if(a.provider){
						prov = ` serialize=${a.provider.serialize_ms?.toFixed(1)||'-'} fetch=${a.provider.fetch_ms?.toFixed(1)||'-'} parse=${a.provider.parse_ms?.toFixed(1)||'-'}`
					}
					lines.push(`  attempt_${a.attempt}_ms=${dur} trimmedCountAtStart=${a.trimmedCount}${prov}`)
				})
			}
		}
		if(lastErrorMessage){
			lines.push(`ERROR: msg="${lastErrorMessage}" overflowMatched=${overflowMatched?'1':'0'} stage=${stage||'-'}`)
		}
		lines.push(`INCLUDED PAIRS (${selection.length}):`)
		selection.forEach(s=> lines.push(`  - ${s.id.slice(0,8)} m:${s.model} estTok:${s.tokens}`))
		lines.push('MESSAGES:')
		messages.forEach((m,i)=>{
			lines.push(`  [${i}] ${m.role}:`)
			const txt = (m.content||'').split(/\n/)
			txt.slice(0,20).forEach(l=> lines.push('      '+l))
			if(txt.length>20) lines.push('      ...')
		})
		// Highlight system message presence from captured JSON as a sanity check
		try {
			let sysPreview = null
			if (typeof window !== 'undefined' && window.__maichatLastRequest && window.__maichatLastRequest.json) {
				const parsed = JSON.parse(window.__maichatLastRequest.json)
				if (Array.isArray(parsed?.messages)){
					const sys = parsed.messages.find(m=> m && m.role === 'system')
					if (sys && typeof sys.content === 'string') {
						sysPreview = sys.content.split(/\n/).slice(0,5).join('\n')
					}
				}
			}
			if (sysPreview){
				lines.push('SYSTEM MESSAGE (preview):')
				lines.push('  '+sysPreview.split(/\n/).join('\n  '))
			}
		} catch {}
		try {
			// Prefer actual last sent JSON captured at adapter level (includes system message).
			let jsonStr = null
			if (typeof window !== 'undefined' && window.__maichatLastRequest && window.__maichatLastRequest.json) {
				jsonStr = window.__maichatLastRequest.json
			} else {
				// Fallback: reconstruct (may miss system if added later in pipeline).
				jsonStr = JSON.stringify({ model, messages }, null, 2)
			}
			lines.push('RAW REQUEST JSON:')
			// Pretty print if we have compact json; attempt parse.
			try { const parsed = JSON.parse(jsonStr); jsonStr = JSON.stringify(parsed, null, 2) } catch{}
			lines.push(jsonStr)
		} catch{}
		if(!pane.__hasCopy){
			const btn = document.createElement('button')
			btn.textContent = 'Copy JSON'
			btn.style.position='absolute'; btn.style.top='4px'; btn.style.right='6px'; btn.style.font='10px var(--font-ui)'; btn.style.padding='2px 6px'; btn.style.background='#123a55'; btn.style.border='1px solid #25506f'; btn.style.color='#cce'; btn.style.cursor='pointer'; btn.style.borderRadius='4px'
			btn.addEventListener('click', ()=>{
				try {
					let clip = null
					if (typeof window !== 'undefined' && window.__maichatLastRequest && window.__maichatLastRequest.json) {
						clip = window.__maichatLastRequest.json
					} else {
						clip = JSON.stringify({ model, messages }, null, 2)
					}
					navigator.clipboard.writeText(clip)
				} catch{}
				btn.textContent = 'Copied'
				setTimeout(()=>{ btn.textContent='Copy JSON' }, 1400)
			})
			pane.appendChild(btn)
			pane.__hasCopy = true
		}
		let pre = pane.querySelector('pre')
		if(!pre){ pre = document.createElement('pre'); pre.style.margin='0'; pre.style.padding='0 0 4px'; pre.style.font='11px/1.4 var(--font-mono, monospace)'; pane.appendChild(pre) }
		pre.textContent = lines.join('\n')
	}

	function toggle(){ requestDebugEnabled = !requestDebugEnabled; render() }
	function enable(v){ requestDebugEnabled = !!v; render() }
	function setPayload(p){ lastSentRequest = p; render() }

	return { render, toggle, enable, setPayload, isEnabled: ()=> requestDebugEnabled }
}


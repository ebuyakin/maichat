// historyView moved from ui/history/historyView.js
import { escapeHtml } from '../../shared/util.js'
import { flattenMessagesToParts } from './messageList.js'

// Regex to match code placeholders: [language-number] (language lowercase alphanum/underscore), e.g. [python-1], [code-2]
const CODE_PLACEHOLDER_REGEX = /(\[[a-zA-Z0-9_]+-\d+\])/g;
// Equation placeholders: [eq-n]
const EQ_PLACEHOLDER_REGEX = /(\[eq-\d+\])/g;

/**
 * Processes text content to style code placeholders
 * @param {string} text - The text content to process
 * @returns {string} HTML with styled placeholders
 */
function processCodePlaceholders(text) {
	if (!text) return '';
	
	// First escape HTML to prevent XSS
	let escapedText = escapeHtml(text);
	// Wrap code placeholders
	escapedText = escapedText.replace(CODE_PLACEHOLDER_REGEX, '<span class="code-placeholder">$1</span>');
	// Wrap equation placeholders
	escapedText = escapedText.replace(EQ_PLACEHOLDER_REGEX, '<span class="eq-placeholder">$1</span>');
	return escapedText;
}

export function createHistoryView({ store, onActivePartRendered }){
	const container = document.getElementById('history')
	if(!container) throw new Error('history container missing')

	function render(parts){
		const tokens = []
		for(let i=0;i<parts.length;i++){
			const cur = parts[i]
			if(i>0){
				const prev = parts[i-1]
				const gapType = classifyGap(prev, cur)
				if(gapType){
					tokens.push(`<div class="gap gap-${gapType}" data-gap-type="${gapType}"></div>`)
				}
			}
			tokens.push(partHtml(cur))
		}
		container.innerHTML = tokens.join('')
		if(onActivePartRendered) onActivePartRendered()
	}

	function renderMessages(messages){
		if(!Array.isArray(messages)) { container.innerHTML=''; if(onActivePartRendered) onActivePartRendered(); return }
		const tokens = []
		let prevPart = null
		for(const msg of messages){
			if(!msg || !Array.isArray(msg.parts)) continue
			for(const cur of msg.parts){
				if(prevPart){
					const gapType = classifyGap(prevPart, cur)
					if(gapType){ tokens.push(`<div class="gap gap-${gapType}" data-gap-type="${gapType}"></div>`) }
				}
				tokens.push(partHtml(cur))
				prevPart = cur
			}
		}
		container.innerHTML = tokens.join('')
		if(onActivePartRendered) onActivePartRendered()
	}
	function classifyGap(prev, cur){
		if(prev.pairId !== cur.pairId) return 'between'
		if(prev.role==='user' && cur.role==='meta') return 'meta'
		if(prev.role==='meta' && cur.role==='assistant') return 'meta'
		if(prev.role===cur.role && (cur.role==='user'||cur.role==='assistant')) return 'intra'
		return null
	}
	function partHtml(pt){
		if(pt.role === 'meta'){
			const pair = store.pairs.get(pt.pairId)
			const topic = store.topics.get(pair.topicId)
			const ts = formatTimestamp(pair.createdAt)
			const topicPath = topic ? formatTopicPath(store, topic.id) : '(no topic)'
			const modelName = pair.model || '(model)'
			let stateBadge = ''
			let errActions = ''
			if(pair.lifecycleState === 'sending') stateBadge = '<span class="badge state" data-state="sending">…</span>'
			else if(pair.lifecycleState === 'error') {
				const label = classifyErrLabel(pair)
				stateBadge = `<span class="badge state error" title="${escapeHtml(pair.errorMessage||'error')}">${label}</span>`
				errActions = `<span class="err-actions"><button class="btn btn-ghost resend" data-action="resend" title="Copy to input and send as a new message (uses current context) - E key">Re-ask</button><button class="btn btn-ghost del" data-action="delete" title="Delete pair - D key">Delete</button></span>`
			}
			return `<div class="part meta" data-part-id="${pt.id}" data-role="meta" data-pair-id="${pt.pairId}" data-meta="1" tabindex="-1" aria-hidden="true"><div class="part-inner">
					<div class="meta-left">
						<span class="badge flag" data-flag="${pair.colorFlag}" title="${pair.colorFlag==='b'?'Flagged (blue)':'Unflagged (grey)'}"></span>
						<span class="badge stars">${'★'.repeat(pair.star)}${'☆'.repeat(Math.max(0,3-pair.star))}</span>
						<span class="badge topic" title="${escapeHtml(topicPath)}">${escapeHtml(middleTruncate(topicPath, 72))}</span>
					</div>
					<div class="meta-right">
					${stateBadge}${errActions}
						<span class="badge offctx" data-offctx="0" title="off: excluded automatically by token budget" style="min-width:30px; text-align:center; display:inline-block;"></span>
						<span class="badge model">${escapeHtml(modelName)}</span>
						<span class="badge timestamp" data-ts="${pair.createdAt}">${ts}</span>
					</div>
				</div></div>`
		}
		// Process assistant content for code placeholders, regular escaping for user content
		const processedContent = pt.role === 'assistant' ? processCodePlaceholders(pt.text) : escapeHtml(pt.text);
		return `<div class="part ${pt.role}" data-part-id="${pt.id}" data-role="${pt.role}" data-pair-id="${pt.pairId}"><div class="part-inner">${processedContent}</div></div>`
	}
	function classifyErrLabel(pair){
		return classifyErrorCode(pair.errorMessage)
	}
	return { render, renderMessages }
}
// Exported for tests and reuse: classify an error message to compact label
export function classifyErrorCode(message){
	const msg = (message||'').toLowerCase()
	if(!msg) return 'error: unknown'
	// Model name issues: unknown/invalid/removed/deprecated/unsupported/404 mentioning model
	if(
		(msg.includes('model') && (
			msg.includes('not found') ||
			msg.includes('unknown') ||
			msg.includes('invalid') ||
			msg.includes('does not exist') ||
			msg.includes("doesn't exist") ||
			msg.includes('no such') ||
			msg.includes('unrecognized') ||
			msg.includes('unsupported') ||
			msg.includes('deprecated')
		)) ||
		(msg.includes('404') && msg.includes('model'))
	) return 'error: model'
	// Auth
	if(msg.includes('api key') || msg.includes('unauthorized') || msg.includes('401') || msg.includes('forbidden')) return 'error: auth'
	// Quota / rate / context
	if(
		msg.includes('429') || msg.includes('rate') || msg.includes('quota') || msg.includes('tpm') || msg.includes('rpm')
	) return 'error: quota'
	if(msg.includes('context') && (msg.includes('length') || msg.includes('window') || msg.includes('exceed'))) return 'error: quota'
	// Network
	if(msg.includes('network') || msg.includes('fetch') || msg.includes('failed')) return 'error: net'
	return 'error: unknown'
}
export function bindHistoryErrorActions(rootEl, { onResend, onDelete }) {
	if(!rootEl.__errActionsBound) {
		rootEl.addEventListener('click', e => {
			const btn = e.target.closest('button[data-action]')
			if(!btn) return
			const action = btn.dataset.action
			// Find nearest rendered part element and read pair id from data attribute
			const partEl = btn.closest('.part[data-pair-id]')
			if(!partEl) return
			const pairId = partEl.getAttribute('data-pair-id')
			if(action === 'resend' && onResend) onResend(pairId)
			else if(action === 'delete' && onDelete) onDelete(pairId)
		})
		rootEl.__errActionsBound = true
	}
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
function formatTopicPath(store, id){
	const parts = store.getTopicPath(id)
	if(parts[0] === 'Root') parts.shift()
	return parts.join(' > ')
}
function middleTruncate(str, max){
	if(str.length <= max) return str
	const keep = max - 3
	const head = Math.ceil(keep/2)
	const tail = Math.floor(keep/2)
	return str.slice(0, head) + '…' + str.slice(str.length - tail)
}

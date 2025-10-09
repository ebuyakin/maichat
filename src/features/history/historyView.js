// historyView moved from ui/history/historyView.js
import { escapeHtml } from '../../shared/util.js'
import { flattenMessagesToParts } from './messageList.js'
import { shouldUseMessageView } from './featureFlags.js'
import { renderMarkdownInline, enhanceRenderedMessage } from '../formatting/markdownRenderer.js'
import { getSettings } from '../../core/settings/index.js'

// Regex to match code placeholders: [language-number] (language lowercase alphanum/underscore), e.g. [python-1], [code-2]
const CODE_PLACEHOLDER_REGEX = /(\[[a-zA-Z0-9_]+-\d+\])/g
// Equation placeholders: [eq-n]
const EQ_PLACEHOLDER_REGEX = /(\[eq-\d+\])/g

/**
 * Processes text content to style code placeholders
 * @param {string} text - The text content to process
 * @returns {string} HTML with styled placeholders
 */
function processCodePlaceholders(text) {
  if (!text) return ''

  // First escape HTML to prevent XSS
  let escapedText = escapeHtml(text)
  // Wrap code placeholders
  escapedText = escapedText.replace(
    CODE_PLACEHOLDER_REGEX,
    '<span class="code-placeholder">$1</span>'
  )
  // Wrap equation placeholders
  escapedText = escapedText.replace(EQ_PLACEHOLDER_REGEX, '<span class="eq-placeholder">$1</span>')
  return escapedText
}

export function createHistoryView({ store, onActivePartRendered }) {
  const container = document.getElementById('history')
  if (!container) throw new Error('history container missing')

  function render(parts) {
    const tokens = []
    for (let i = 0; i < parts.length; i++) {
      const cur = parts[i]
      if (i > 0) {
        const prev = parts[i - 1]
        const gapType = classifyGap(prev, cur)
        if (gapType) {
          tokens.push(`<div class="gap gap-${gapType}" data-gap-type="${gapType}"></div>`)
        }
      }
      tokens.push(partHtml(cur))
    }
    container.innerHTML = tokens.join('')
    if (onActivePartRendered) onActivePartRendered()
  }

  function renderMessages(messages) {
    if (!Array.isArray(messages)) {
      container.innerHTML = ''
      if (onActivePartRendered) onActivePartRendered()
      return
    }
    const tokens = []
    // Get settings once for entire render
    const settings = getSettings()

    for (const msg of messages) {
      if (!msg || !Array.isArray(msg.parts)) continue
      const pairId = msg.id
      const user = msg.parts.find((p) => p.role === 'user')
      const assistant = msg.parts.find((p) => p.role === 'assistant')
      if (user) {
        // User message block
        tokens.push(
          `<div class="message user" data-message-id="${user.id}" data-part-id="${user.id}" data-pair-id="${user.pairId}" data-role="user">${escapeHtml(user.text || '')}</div>`
        )
      }
      if (assistant) {
        // Assistant message block with inline meta header
        const pair = store.pairs.get(assistant.pairId)
        const topic = pair ? store.topics.get(pair.topicId) : null
        const ts = pair ? formatTimestamp(pair.createdAt) : ''
        const topicPath = topic ? formatTopicPath(store, topic.id) : '(no topic)'
        const modelName = pair && pair.model ? pair.model : '(model)'
        let stateBadge = ''
        let errActions = ''
        if (pair && pair.lifecycleState === 'sending')
          stateBadge = '<span class="badge state" data-state="sending">…</span>'
        else if (pair && pair.lifecycleState === 'error') {
          const label = classifyErrLabel(pair)
          stateBadge = `<span class=\"badge state error\" title=\"${escapeHtml(pair.errorMessage || 'error')}\">${label}</span>`
          errActions = `<span class=\"err-actions\"><button class=\"btn btn-icon resend\" data-action=\"resend\" title=\"Re-ask: copy to input and resend (E key)\">↻</button><button class=\"btn btn-icon del\" data-action=\"delete\" title=\"Delete this error message (W key)\">✕</button></span>`
        }
        // Feature flag: use inline markdown rendering or legacy placeholder processing
        const bodyHtml = settings.useInlineFormatting
          ? renderMarkdownInline(assistant.text || '')
          : processCodePlaceholders(assistant.text || '')
        tokens.push(
          `<div class="message assistant" data-message-id="${assistant.id}" data-part-id="${assistant.id}" data-pair-id="${assistant.pairId}" data-role="assistant"><div class="assistant-meta"><div class="meta-left"><span class="badge flag" data-flag="${pair ? pair.colorFlag : 'g'}" title="${pair && pair.colorFlag === 'b' ? 'Flagged (blue)' : 'Unflagged (grey)'}"></span><span class="badge stars">${pair ? '★'.repeat(pair.star) + '☆'.repeat(Math.max(0, 3 - pair.star)) : '☆☆☆'}</span><span class="badge topic" title="${escapeHtml(topicPath)}">${escapeHtml(middleTruncate(topicPath, 72))}</span></div><div class="meta-right">${stateBadge}${errActions}<span class="badge offctx" data-offctx="0" title="off: excluded automatically by token budget" style="min-width:30px; text-align:center; display:inline-block;"></span><span class="badge model">${escapeHtml(modelName)}</span><span class="badge timestamp" data-ts="${pair ? pair.createdAt : ''}">${ts}</span></div></div><div class="assistant-body">${bodyHtml}</div></div>`
        )
      }
    }
    container.innerHTML = tokens.join('')

    // Enhance rendered messages with lazy-loaded features (syntax highlighting, math)
    if (settings.useInlineFormatting) {
      container.querySelectorAll('.message.assistant .assistant-body').forEach((body) => {
        enhanceRenderedMessage(body)
      })
    }

    if (onActivePartRendered) onActivePartRendered()
  }
  function classifyGap(prev, cur) {
    if (prev.pairId !== cur.pairId) return 'between'
    if (prev.role === 'user' && cur.role === 'meta') return 'meta'
    if (prev.role === 'meta' && cur.role === 'assistant') return 'meta'
    if (prev.role === cur.role && (cur.role === 'user' || cur.role === 'assistant')) return 'intra'
    return null
  }
  function partHtml(pt) {
    if (pt.role === 'meta') {
      const pair = store.pairs.get(pt.pairId)
      const topic = store.topics.get(pair.topicId)
      const ts = formatTimestamp(pair.createdAt)
      const topicPath = topic ? formatTopicPath(store, topic.id) : '(no topic)'
      const modelName = pair.model || '(model)'
      let stateBadge = ''
      let errActions = ''
      if (pair.lifecycleState === 'sending')
        stateBadge = '<span class="badge state" data-state="sending">…</span>'
      else if (pair.lifecycleState === 'error') {
        const label = classifyErrLabel(pair)
        stateBadge = `<span class="badge state error" title="${escapeHtml(pair.errorMessage || 'error')}">${label}</span>`
        errActions = `<span class="err-actions"><button class="btn btn-icon resend" data-action="resend" title="Re-ask: copy to input and resend (E key)">↻</button><button class="btn btn-icon del" data-action="delete" title="Delete this error message (W key)">✕</button></span>`
      }
      if (!shouldUseMessageView()) {
        return `<div class="part meta" data-part-id="${pt.id}" data-role="meta" data-pair-id="${pt.pairId}" data-meta="1" tabindex="-1" aria-hidden="true"><div class="part-inner">
					<div class="meta-left">
						<span class="badge flag" data-flag="${pair.colorFlag}" title="${pair.colorFlag === 'b' ? 'Flagged (blue)' : 'Unflagged (grey)'}"></span>
						<span class="badge stars">${'★'.repeat(pair.star)}${'☆'.repeat(Math.max(0, 3 - pair.star))}</span>
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
      // In message view, meta is rendered inside assistant block header; skip standalone meta part
      return ''
    }
    // Process assistant content for code placeholders, regular escaping for user content
    const processedContent =
      pt.role === 'assistant' ? processCodePlaceholders(pt.text) : escapeHtml(pt.text)
    if (pt.role === 'assistant' && shouldUseMessageView()) {
      const pair = store.pairs.get(pt.pairId)
      const topic = store.topics.get(pair.topicId)
      const ts = formatTimestamp(pair.createdAt)
      const topicPath = topic ? formatTopicPath(store, topic.id) : '(no topic)'
      const modelName = pair.model || '(model)'
      let stateBadge = ''
      let errActions = ''
      if (pair.lifecycleState === 'sending')
        stateBadge = '<span class="badge state" data-state="sending">…</span>'
      else if (pair.lifecycleState === 'error') {
        const label = classifyErrLabel(pair)
        stateBadge = `<span class="badge state error" title="${escapeHtml(pair.errorMessage || 'error')}">${label}</span>`
        errActions = `<span class="err-actions"><button class="btn btn-icon resend" data-action="resend" title="Re-ask: copy to input and resend (E key)">↻</button><button class="btn btn-icon del" data-action="delete" title="Delete this error message (W key)">✕</button></span>`
      }
      return `<div class="part assistant" data-part-id="${pt.id}" data-role="assistant" data-pair-id="${pt.pairId}"><div class="part-inner">
				<div class="assistant-meta">
					<div class="meta-left">
						<span class="badge flag" data-flag="${pair.colorFlag}" title="${pair.colorFlag === 'b' ? 'Flagged (blue)' : 'Unflagged (grey)'}"></span>
						<span class="badge stars">${'★'.repeat(pair.star)}${'☆'.repeat(Math.max(0, 3 - pair.star))}</span>
						<span class="badge topic" title="${escapeHtml(topicPath)}">${escapeHtml(middleTruncate(topicPath, 72))}</span>
					</div>
					<div class="meta-right">
						${stateBadge}${errActions}
						<span class="badge offctx" data-offctx="0" title="off: excluded automatically by token budget" style="min-width:30px; text-align:center; display:inline-block;"></span>
						<span class="badge model">${escapeHtml(modelName)}</span>
						<span class="badge timestamp" data-ts="${pair.createdAt}">${ts}</span>
					</div>
				</div>
				<div class="assistant-body">${processedContent}</div>
			</div></div>`
    }
    return `<div class="part ${pt.role}" data-part-id="${pt.id}" data-role="${pt.role}" data-pair-id="${pt.pairId}"><div class="part-inner">${processedContent}</div></div>`
  }
  function classifyErrLabel(pair) {
    return classifyErrorCode(pair.errorMessage)
  }
  return { render, renderMessages }
}
// Exported for tests and reuse: classify an error message to compact label
export function classifyErrorCode(message) {
  const msg = (message || '').toLowerCase()
  if (!msg) return 'error: unknown'
  // Model name issues: unknown/invalid/removed/deprecated/unsupported/404 mentioning model
  if (
    (msg.includes('model') &&
      (msg.includes('not found') ||
        msg.includes('unknown') ||
        msg.includes('invalid') ||
        msg.includes('does not exist') ||
        msg.includes("doesn't exist") ||
        msg.includes('no such') ||
        msg.includes('unrecognized') ||
        msg.includes('unsupported') ||
        msg.includes('deprecated'))) ||
    (msg.includes('404') && msg.includes('model'))
  )
    return 'error: model'
  // Auth
  if (
    msg.includes('api key') ||
    msg.includes('unauthorized') ||
    msg.includes('401') ||
    msg.includes('forbidden')
  )
    return 'error: auth'
  // Quota / rate / context
  if (
    msg.includes('429') ||
    msg.includes('rate') ||
    msg.includes('quota') ||
    msg.includes('tpm') ||
    msg.includes('rpm')
  )
    return 'error: quota'
  if (
    msg.includes('context') &&
    (msg.includes('length') || msg.includes('window') || msg.includes('exceed'))
  )
    return 'error: quota'
  // Network
  if (msg.includes('network') || msg.includes('fetch') || msg.includes('failed'))
    return 'error: net'
  return 'error: unknown'
}
export function bindHistoryErrorActions(rootEl, { onResend, onDelete }) {
  if (!rootEl.__errActionsBound) {
    rootEl.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-action]')
      if (!btn) return
      const action = btn.dataset.action
      // Find nearest message element and read pair id
      const host = btn.closest('.message.assistant[data-pair-id], .part[data-pair-id]')
      if (!host) return
      const pairId = host.getAttribute('data-pair-id')
      if (action === 'resend' && onResend) onResend(pairId)
      else if (action === 'delete' && onDelete) onDelete(pairId)
    })
    rootEl.__errActionsBound = true
  }
}
function formatTimestamp(ts) {
  const d = new Date(ts)
  const yy = String(d.getFullYear()).slice(-2)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  const ss = String(d.getSeconds()).padStart(2, '0')
  return `${yy}-${mm}-${dd} ${hh}:${mi}:${ss}`
}
function formatTopicPath(store, id) {
  const parts = store.getTopicPath(id)
  if (parts[0] === 'Root') parts.shift()
  return parts.join(' > ')
}
function middleTruncate(str, max) {
  if (str.length <= max) return str
  const keep = max - 3
  const head = Math.ceil(keep / 2)
  const tail = Math.floor(keep / 2)
  return str.slice(0, head) + '…' + str.slice(str.length - tail)
}

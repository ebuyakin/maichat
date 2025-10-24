import { openModal } from '../../shared/openModal.js'

function parseUrl(u, preferredDomainLabel) {
  try {
    const url = new URL(u)
    const domain = (preferredDomainLabel && String(preferredDomainLabel)) || url.hostname.replace(/^www\./, '')
    // Build a short path hint from last non-empty segment
    const parts = url.pathname.split('/').filter(Boolean)
    const last = parts.length ? parts[parts.length - 1] : ''
    const hintRaw = last || (parts.length > 1 ? parts[parts.length - 2] : '')
    const hint = hintRaw ? hintRaw.replace(/[-_]+/g, ' ') : ''
    return { domain, hint, href: u }
  } catch {
    return { domain: u, hint: '', href: u }
  }
}

function middleTruncate(s, max = 30) {
  try {
    if (!s || s.length <= max) return s || ''
    const keep = Math.max(0, max - 1) // leave room for ellipsis if max>0
    const head = Math.ceil(keep / 2)
    const tail = Math.floor(keep / 2)
    return s.slice(0, head) + '…' + s.slice(s.length - tail)
  } catch {
    return s
  }
}

export function openSourcesOverlay({ store, pairId, modeManager }) {
  const pair = store && pairId ? store.pairs.get(pairId) : null
  const list = Array.isArray(pair && pair.citations) ? pair.citations.filter(Boolean) : []
  const metaMap = (pair && pair.citationsMeta && typeof pair.citationsMeta === 'object') ? pair.citationsMeta : null
  // Deduplicate exact URLs and map to display
  const unique = Array.from(new Set(list))
  const items = unique.map((u) => parseUrl(u, metaMap && metaMap[u]))
  // Sort by domain then hint
  items.sort((a, b) => (a.domain < b.domain ? -1 : a.domain > b.domain ? 1 : a.hint.localeCompare(b.hint)))

  // Root element
  const root = document.createElement('div')
  root.className = 'overlay-backdrop centered'
  root.id = 'sourcesOverlayRoot'
  root.innerHTML = `
    <div class="overlay-panel compact sources-panel">
      <header>Sources (${items.length})</header>
      <div class="list" style="padding:6px 8px; max-height:60vh; overflow:auto;">
        ${items.length ? `<ul>${items
          .map(
            (it) => {
              const domainLabel = middleTruncate(it.domain || '', 40)
              const hintLabel = middleTruncate(it.hint || '', 30)
              return `<li>
              <a href="${it.href}" target="_blank" rel="noreferrer" class="source-link" title="${it.href}">
                <span class="src-domain">${domainLabel}</span>
                ${hintLabel ? `<span class="dim"> / ${hintLabel}</span>` : ''}
              </a>
            </li>`
            }
          )
          .join('')}</ul>` : '<div style="opacity:.7;font-size:12px; padding:4px 6px;">No sources available.</div>'}
      </div>
      <footer>
        <button class="btn" type="button" data-action="copy">Copy URLs</button>
        <button class="btn" type="button" data-action="close">Close</button>
      </footer>
    </div>`
  document.body.appendChild(root)

  const panel = root.querySelector('.overlay-panel')

  const { close } = openModal({
    modeManager,
    root,
    closeKeys: ['Escape'],
    restoreMode: true,
    preferredFocus: () => panel.querySelector('.source-link') || panel.querySelector('button[data-action="close"]'),
  })

  root.addEventListener('click', (e) => {
    if (e.target === root) close()
  })
  panel.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action]')
    if (!btn) return
    const action = btn.getAttribute('data-action')
    if (action === 'close') close()
    else if (action === 'copy') {
      const text = unique.join('\n')
      try {
        navigator.clipboard.writeText(text)
      } catch {}
    }
  })

  // Keyboard: Enter opens focused link (handled by browser on <a>), C copies, Esc closes
  panel.addEventListener('keydown', (e) => {
    if (e.key === 'c' || e.key === 'C') {
      e.preventDefault()
      const text = unique.join('\n')
      try { navigator.clipboard.writeText(text) } catch {}
    }
  })
}

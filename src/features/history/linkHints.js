// linkHints.js
// Ephemeral numbered link hints for the active assistant message (View mode only)

let state = {
  active: false,
  msgEl: null,
  overlay: null,
  links: [], // { index: 1-based, href, anchorEl }
}

function reset() {
  if (state.overlay && state.overlay.parentNode) {
    state.overlay.parentNode.removeChild(state.overlay)
  }
  if (state.msgEl) state.msgEl.classList.remove('has-link-hints')
  state.active = false
  state.msgEl = null
  state.overlay = null
  state.links = []
}

export function isActive() {
  return !!state.active
}

export function exit() {
  if (!state.active) return
  reset()
}

/**
 * Enter link hint mode for a given assistant message element.
 * - Finds http/https anchors within .assistant-body (ignores code/pre/kbd/samp)
 * - Renders numbered badges (1..9) as absolutely-positioned elements inside the message
 * @param {HTMLElement} messageEl - The .message.assistant or .part.assistant element
 * @returns {boolean} true if hints shown, false otherwise
 */
export function enterForMessage(messageEl) {
  if (!messageEl || !(messageEl instanceof HTMLElement)) return false
  exit() // ensure clean slate

  const body = messageEl.querySelector('.assistant-body') || messageEl
  if (!body) return false

  // Collect anchors, filter http(s), and exclude those inside forbidden containers
  const forbiddenSelector = 'pre, code, kbd, samp'
  const forbidden = new Set()
  body.querySelectorAll(forbiddenSelector).forEach((n) => forbidden.add(n))

  /** @type {HTMLAnchorElement[]} */
  const anchors = Array.from(body.querySelectorAll('a')).filter((a) => {
    const href = (a.getAttribute('href') || '').trim()
    if (!/^https?:\/\//i.test(href)) return false
    // Exclude if inside a forbidden container
    let p = a.parentElement
    while (p && p !== body) {
      if (forbidden.has(p)) return false
      p = p.parentElement
    }
    return true
  })

  if (anchors.length === 0) return false

  // Limit to first 9 for v1 (simple, fast)
  const limited = anchors.slice(0, 9)

  // Ensure message element becomes positioning context
  messageEl.classList.add('has-link-hints')

  const overlay = document.createElement('div')
  overlay.className = 'link-hints-overlay'
  // pointer-events:none so it doesn't block clicks or selection
  overlay.style.pointerEvents = 'none'
  messageEl.appendChild(overlay)

  const msgRect = messageEl.getBoundingClientRect()
  const badges = []
  limited.forEach((a, i) => {
    const n = i + 1
    const r = a.getBoundingClientRect()
    const top = r.top - msgRect.top
    const left = r.left - msgRect.left
    const b = document.createElement('div')
    b.className = 'link-hint-badge'
    b.textContent = String(n)
    // Position slightly to the left/top of the anchor
    b.style.top = Math.max(0, top - 8) + 'px'
    b.style.left = Math.max(0, left - 12) + 'px'
    overlay.appendChild(b)
    badges.push(b)
  })

  state.active = true
  state.msgEl = messageEl
  state.overlay = overlay
  state.links = limited.map((a, i) => ({ index: i + 1, href: a.getAttribute('href'), anchorEl: a }))

  return true
}

/**
 * Handle digit/Esc keys while hints are active
 * @param {KeyboardEvent} e 
 * @returns {boolean} true if handled
 */
export function handleKey(e) {
  if (!state.active) return false
  if (e.key === 'Escape') {
    exit()
    return true
  }
  if (/^[1-9]$/.test(e.key)) {
    const idx = parseInt(e.key, 10)
    const item = state.links.find((x) => x.index === idx)
    if (item && item.href) {
      try {
        window.open(item.href, '_blank', 'noopener,noreferrer')
      } catch {}
      exit()
      return true
    }
    // Not found: ignore; keep hints visible so user can choose a valid digit
    return true
  }
  // Any other key: exit and let normal handling proceed
  exit()
  return false
}

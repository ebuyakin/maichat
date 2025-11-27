import { openModal } from './openModal.js'

/**
 * Show informational message with single "Close" button
 * Used for success/error notifications where no decision is needed
 */
export function openAlertOverlay({ modeManager, message, title }) {
  return new Promise((resolve) => {
    const root = document.createElement('div')
    root.className = 'overlay-backdrop centered alert-overlay'
    const panel = document.createElement('div')
    panel.setAttribute('tabindex', '-1')
    panel.setAttribute('role', 'dialog')
    panel.setAttribute('aria-modal', 'true')
    panel.className = 'overlay-panel'
    const header = document.createElement('header')
    header.textContent = title || 'Info'
    header.id = 'alertDialogTitle'
    panel.setAttribute('aria-labelledby', 'alertDialogTitle')
    Object.assign(header.style, { padding: '10px 19px 1px' })
    const body = document.createElement('div')
    body.textContent = message || ''
    Object.assign(body.style, {
      padding: '17px 19px',
      whiteSpace: 'pre-wrap',
      color: 'var(--text)',
    })
    const hint = document.createElement('div')
    hint.textContent = 'Press Enter or Esc to close'
    Object.assign(hint.style, {
      fontSize: '12px',
      color: 'var(--text-dim)',
      padding: '7px 19px 15px',
    })

    // Footer with single Close button
    const footer = document.createElement('footer')
    Object.assign(footer.style, {
      display: 'flex',
      justifyContent: 'flex-end',
      padding: '15px 19px',
    })
    const btnClose = document.createElement('button')
    btnClose.className = 'btn btn-sm'
    btnClose.type = 'button'
    btnClose.textContent = 'Close'
    footer.appendChild(btnClose)

    panel.appendChild(header)
    panel.appendChild(body)
    panel.appendChild(hint)
    panel.appendChild(footer)
    root.appendChild(panel)

    const { close } = openModal({
      modeManager,
      root,
      preferredFocus: () => btnClose,
      closeKeys: [],
      restoreMode: true,
      modal: true,
    })

    function done() {
      try {
        root.removeEventListener('keydown', onKey, true)
      } catch {}
      try {
        panel.removeEventListener('keydown', onKey, true)
      } catch {}
      try {
        close('alert')
      } catch {}
      resolve()
    }
    function onKey(e) {
      const k = e.key
      if (k === 'Enter' || k === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        return done()
      }
    }
    root.addEventListener('keydown', onKey, true)
    panel.addEventListener('keydown', onKey, true)

    // Button handler
    btnClose.addEventListener('click', (e) => {
      e.preventDefault()
      done()
    })

    try {
      document.body.appendChild(root)
      setTimeout(() => {
        try {
          btnClose.focus()
        } catch {}
      }, 0)
    } catch {}
  })
}

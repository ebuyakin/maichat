import { openModal } from './openModal.js'

export function openConfirmModal({ modeManager, message, title }) {
  return new Promise((resolve) => {
    const root = document.createElement('div')
    Object.assign(root.style, {
      position: 'fixed',
      inset: '0',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: '9999',
      background: 'rgba(0,0,0,0.35)',
    })
    const panel = document.createElement('div')
    panel.setAttribute('tabindex', '-1')
    Object.assign(panel.style, {
      minWidth: '420px',
      maxWidth: '70vw',
      color: '#EEE',
      background: '#0B0B0B',
      border: '1px solid #333',
      borderRadius: '6px',
      boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
      padding: '16px 18px',
      fontFamily:
        'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
    })
    const header = document.createElement('div')
    header.textContent = title || 'Confirm'
    Object.assign(header.style, {
      fontSize: '13px',
      color: '#9AA0A6',
      marginBottom: '8px',
      letterSpacing: '0.02em',
    })
    const body = document.createElement('div')
    body.textContent = message || 'Are you sure?'
    Object.assign(body.style, { fontSize: '14px', marginBottom: '10px', whiteSpace: 'pre-wrap' })
    const hint = document.createElement('div')
    hint.textContent = 'Proceed? [y/N]'
    Object.assign(hint.style, { fontSize: '12px', color: '#9AA0A6' })
    panel.appendChild(header)
    panel.appendChild(body)
    panel.appendChild(hint)
    root.appendChild(panel)

    const closeKeys = [] // we handle keys ourselves
    const { close } = openModal({
      modeManager,
      root,
      preferredFocus: () => panel,
      closeKeys,
      restoreMode: true,
      modal: true,
    })

    function done(ok) {
      try {
        root.removeEventListener('keydown', onKey, true)
      } catch {}
      try {
        close('confirm')
      } catch {}
      resolve(!!ok)
    }
    function onKey(e) {
      const k = e.key
      // Default is No. Enter -> No. Escape -> No.
      if (k === 'y' || k === 'Y') {
        e.preventDefault()
        e.stopPropagation()
        return done(true)
      }
      if (k === 'n' || k === 'N' || k === 'Enter' || k === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        return done(false)
      }
      // Any other key: ignore
    }
    root.addEventListener('keydown', onKey, true)
    panel.addEventListener('keydown', onKey, true)

    try {
      document.body.appendChild(root)
      setTimeout(() => {
        try {
          panel.focus()
        } catch {}
      }, 0)
    } catch {}
  })
}

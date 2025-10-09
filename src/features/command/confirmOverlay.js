import { openModal } from '../../shared/openModal.js'

export function openConfirmOverlay({ modeManager, message, title }) {
  return new Promise((resolve) => {
    const root = document.createElement('div')
    root.className = 'overlay-backdrop centered confirm-overlay'
    // styling from CSS: .overlay-backdrop.centered
    const panel = document.createElement('div')
    panel.setAttribute('tabindex', '-1')
    panel.setAttribute('role', 'dialog')
    panel.setAttribute('aria-modal', 'true')
    panel.className = 'overlay-panel'
    const header = document.createElement('header')
    header.textContent = title || 'Confirm'
    header.id = 'confirmDialogTitle'
    panel.setAttribute('aria-labelledby', 'confirmDialogTitle')
    // Align left padding with topic editor header (19px) and add top padding (+5px)
    Object.assign(header.style, { padding: '10px 19px 1px' })
    const body = document.createElement('div')
    body.textContent = message || 'Are you sure?'
    Object.assign(body.style, {
      padding: '17px 19px',
      whiteSpace: 'pre-wrap',
      color: 'var(--text)',
    })
    const hint = document.createElement('div')
    hint.textContent = 'Proceed? [y/N]'
    Object.assign(hint.style, {
      fontSize: '12px',
      color: 'var(--text-dim)',
      padding: '7px 19px 15px',
    })

    // Footer with buttons (Cancel = default, Confirm)
    const footer = document.createElement('footer')
    Object.assign(footer.style, {
      display: 'flex',
      justifyContent: 'flex-end',
      gap: '15px',
      padding: '15px 19px',
    })
    const btnCancel = document.createElement('button')
    btnCancel.className = 'btn-ghost btn-sm'
    btnCancel.type = 'button'
    btnCancel.textContent = 'Cancel'
    const btnConfirm = document.createElement('button')
    btnConfirm.className = 'btn btn-sm'
    btnConfirm.type = 'button'
    btnConfirm.textContent = 'Confirm'
    footer.appendChild(btnCancel)
    footer.appendChild(btnConfirm)

    panel.appendChild(header)
    panel.appendChild(body)
    panel.appendChild(hint)
    panel.appendChild(footer)
    root.appendChild(panel)

    const { close } = openModal({
      modeManager,
      root,
      preferredFocus: () => panel,
      closeKeys: [],
      restoreMode: true,
      modal: true,
    })

    function done(ok) {
      try {
        root.removeEventListener('keydown', onKey, true)
      } catch {}
      try {
        panel.removeEventListener('keydown', onKey, true)
      } catch {}
      try {
        close('confirm')
      } catch {}
      resolve(!!ok)
    }
    function onKey(e) {
      const k = e.key
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
    }
    root.addEventListener('keydown', onKey, true)
    panel.addEventListener('keydown', onKey, true)

    // Button handlers
    btnCancel.addEventListener('click', (e) => {
      e.preventDefault()
      done(false)
    })
    btnConfirm.addEventListener('click', (e) => {
      e.preventDefault()
      done(true)
    })

    // Focus policy: focus Cancel to keep Enter = Cancel (safe default)
    try {
      document.body.appendChild(root)
      setTimeout(() => {
        try {
          btnCancel.focus()
        } catch {}
      }, 0)
    } catch {}
  })
}

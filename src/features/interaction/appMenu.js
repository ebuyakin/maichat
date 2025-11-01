// appMenu.js
// Controller for the app menu overlay and actions. Extracted from interaction.js without behavior change.
import { openModal } from '../../shared/openModal.js'

export function createAppMenuController({
  modeManager,
  store,
  activeParts,
  historyRuntime,
  pendingMessageMeta,
  tutorialUrl,
  overlays: {
    openTopicEditor,
    openModelEditor,
    openDailyStatsOverlay,
    openSettingsOverlay,
    openApiKeysOverlay,
    openHelpOverlay,
  },
  getActiveModel,
  renderPendingMeta,
  scrollController,
}) {
  const menuBtn = () => document.getElementById('appMenuBtn')
  const menuEl = () => document.getElementById('appMenu')
  let menuModal = null

  function toggle(force) {
    const btn = menuBtn()
    const m = menuEl()
    if (!btn || !m) return
    let show = force
    if (show == null) show = m.hasAttribute('hidden')
    if (show) {
      const backdrop = document.createElement('div')
      backdrop.className = 'overlay-backdrop menu-overlay'
      m.removeAttribute('hidden')
      backdrop.appendChild(m)
      document.body.appendChild(backdrop)
      btn.setAttribute('aria-expanded', 'true')
      document.body.setAttribute('data-menu-open', '1')
      m.querySelectorAll('li.active').forEach((li) => li.classList.remove('active'))
      const first = m.querySelector('li')
      if (first) first.classList.add('active')
      function onKey(e) {
        const nav = ['j', 'k', 'ArrowDown', 'ArrowUp', 'Enter', 'Escape']
        if (!nav.includes(e.key)) return
        e.preventDefault()
        e.stopImmediatePropagation()
        const items = Array.from(m.querySelectorAll('li'))
        let idx = items.findIndex((li) => li.classList.contains('active'))
        if (idx < 0 && items.length) {
          idx = 0
          items[0].classList.add('active')
        }
        if (e.key === 'Escape') {
          close()
          return
        }
        if (e.key === 'j' || e.key === 'ArrowDown') {
          if (items.length) {
            idx = (idx + 1 + items.length) % items.length
            items.forEach((li) => li.classList.remove('active'))
            items[idx].classList.add('active')
          }
          return
        }
        if (e.key === 'k' || e.key === 'ArrowUp') {
          if (items.length) {
            idx = (idx - 1 + items.length) % items.length
            items.forEach((li) => li.classList.remove('active'))
            items[idx].classList.add('active')
          }
          return
        }
        if (e.key === 'Enter') {
          const act = items[idx] || items[0]
          if (act) activate(act)
          return
        }
      }
      try {
        m.style.display = 'inline-block'
        m.style.width = 'auto'
        const br = btn.getBoundingClientRect()
        const mm = m.getBoundingClientRect()
        const VW = Math.max(document.documentElement.clientWidth, window.innerWidth || 0)
        const VH = Math.max(document.documentElement.clientHeight, window.innerHeight || 0)
        const margin = 4
        const menuW = Math.min(mm.width || 220, 320)
        const menuH = mm.height || 240
        let left = Math.round(br.right - menuW)
        let top = Math.round(br.bottom + margin)
        if (left < margin) left = margin
        if (left + menuW > VW - margin) left = VW - menuW - margin
        if (top + menuH > VH - margin) top = Math.max(margin, br.top - menuH - margin)
        m.style.left = left + 'px'
        m.style.top = top + 'px'
      } catch {}

      backdrop.addEventListener('keydown', onKey, true)
      menuModal = openModal({
        modeManager,
        root: backdrop,
        closeKeys: [],
        restoreMode: true,
        preferredFocus: () => m,
      })
      try {
        m.setAttribute('tabindex', '-1')
        m.focus()
      } catch {}

      function onHover(e) {
        const li = e.target && e.target.closest && e.target.closest('li')
        if (!li || !m.contains(li)) return
        const items = Array.from(m.querySelectorAll('li'))
        items.forEach((x) => x.classList.remove('active'))
        li.classList.add('active')
      }
      m.addEventListener('mouseover', onHover)
      backdrop.addEventListener('click', (e) => {
        if (m.contains(e.target)) {
          const li = e.target.closest('li[data-action]')
          if (li) {
            e.stopPropagation()
            activate(li)
          }
          return
        }
        close()
      })
    } else {
      close()
    }
  }

  function close() {
    const btn = menuBtn()
    const m = menuEl()
    if (!btn || !m) return
    if (menuModal) {
      try {
        menuModal.close('manual')
      } catch {}
      menuModal = null
    }
    const statusRight = document.getElementById('statusRight')
    if (statusRight && !m.parentElement?.isSameNode(statusRight)) {
      statusRight.appendChild(m)
    }
    try {
      m.style.left = ''
      m.style.top = ''
      m.style.position = ''
      m.style.display = ''
      m.style.width = ''
    } catch {}
    m.setAttribute('hidden', '')
    document.body.removeAttribute('data-menu-open')
    btn.setAttribute('aria-expanded', 'false')
  }

  function activate(li) {
    if (!li) return
    const act = li.getAttribute('data-action')
    close()
    run(act)
  }

  function run(action) {
    if (action === 'topic-editor') {
      const prev = modeManager.mode
      openTopicEditor({
        store,
        onClose: () => {
          modeManager.set(prev)
        },
      })
    } else if (action === 'model-editor') {
      const prev = modeManager.mode
      openModelEditor({
        store,
        onClose: ({ dirty } = {}) => {
          pendingMessageMeta.model = getActiveModel()
          renderPendingMeta()
          try { localStorage.setItem('maichat_pending_model', pendingMessageMeta.model) } catch {}
          if (dirty) {
            historyRuntime.renderCurrentView({ preserveActive: true })
            try {
              const act = activeParts && activeParts.active && activeParts.active()
              const id = act && act.id
              if (id && scrollController && scrollController.alignTo) {
                requestAnimationFrame(() => {
                  requestAnimationFrame(() => {
                    scrollController.alignTo(id, 'bottom', false)
                  })
                })
              }
            } catch {}
          }
          modeManager.set(prev)
        },
      })
    } else if (action === 'daily-stats') {
      openDailyStatsOverlay({ store, activeParts, historyRuntime, modeManager })
    } else if (action === 'settings') {
      const prev = modeManager.mode
      openSettingsOverlay({
        onClose: () => {
          modeManager.set(prev)
        },
      })
    } else if (action === 'api-keys') {
      const prev = modeManager.mode
      openApiKeysOverlay({
        modeManager,
        onClose: () => {
          modeManager.set(prev)
        },
      })
    } else if (action === 'tutorial') {
      try {
        window.open(tutorialUrl, '_blank', 'noopener')
      } catch {
        window.location.href = tutorialUrl
      }
    } else if (action === 'help') {
      openHelpOverlay({ modeManager, onClose: () => {} })
    }
  }

  function handleGlobalClick() {
    const btn = menuBtn()
    const m = menuEl()
    if (!btn || !m) return
    document.addEventListener('click', (e) => {
      if (e.target === btn) {
        e.stopPropagation()
        toggle()
        return
      }
    })
  }

  return { toggle, close, run, handleGlobalClick }
}

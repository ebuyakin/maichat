// Restored original (moved from src/ui/settingsOverlay.js) - path adjusted only.
// REFACTORED (2025-10-10): Form controls now auto-generated from schema (Phase 5)
import { getSettings, saveSettings, getDefaultSettings } from '../../core/settings/index.js'
import { SETTINGS_SCHEMA } from '../../core/settings/schema.js'
import { openModal } from '../../shared/openModal.js'
import { recalculateAllTokenEstimates } from '../../core/context/tokenEstimator.js'
import { openConfirmOverlay } from '../command/confirmOverlay.js'
import { openAlertOverlay } from '../../shared/alertOverlay.js'

/**
 * Generate form controls for a specific tab from schema
 * @param {string} tabName - The tab name ('spacing', 'scroll', 'context')
 * @param {object} existing - Current settings values
 * @returns {string} HTML string for all controls in the tab
 */
function generateControlsForTab(tabName, existing) {
  return Object.entries(SETTINGS_SCHEMA)
    .filter(([_, config]) => config.ui.tab === tabName)
    .map(([key, config]) => {
      const value = existing[key] ?? config.defaultValue
      
      if (config.control.type === 'number') {
        return `<label>${config.ui.label}
                <input name="${key}" type="number" 
                       step="${config.control.step}" 
                       min="${config.control.min}" 
                       max="${config.control.max}" 
                       value="${value}" />
              </label>`
      }
      
      if (config.control.type === 'checkbox') {
        return `<label>
                <input type="checkbox" name="${key}" ${value ? 'checked' : ''} /> ${config.ui.label}
              </label>`
      }
      
      if (config.control.type === 'select') {
        const options = config.control.options
          .map(opt => {
            // Handle boolean options (convert to string for comparison)
            const optValue = typeof opt === 'boolean' ? String(opt) : opt
            const currentValue = typeof value === 'boolean' ? String(value) : value
            const selected = optValue === currentValue ? 'selected' : ''
            // Display value: for booleans show "on"/"off", otherwise show value
            const displayValue = typeof opt === 'boolean' ? (opt ? 'on' : 'off') : opt
            return `<option value="${optValue}" ${selected}>${displayValue}</option>`
          })
          .join('')
        return `<label>${config.ui.label}
                <select name="${key}">${options}</select>
              </label>`
      }
      
      return '' // Unknown control type
    })
    .join('\n              ')
}

export function openSettingsOverlay({ onClose, store }) {
  if (document.getElementById('settingsOverlayRoot')) return
  const existing = getSettings()
  const root = document.createElement('div')
  root.id = 'settingsOverlayRoot'
  root.className = 'overlay-backdrop centered'
  root.innerHTML = `
    <div class="overlay-panel settings-panel compact">
      <header>Settings</header>
      <div class="settings-tabs" role="tablist">
  ${['spacing', 'reading', 'scroll', 'context'].map((t, i) => `<button type="button" class="tab-btn${i === 0 ? ' active' : ''}" data-tab="${t}" role="tab" aria-selected="${i === 0}" aria-controls="tab-${t}">${t}</button>`).join('')}
      </div>
      <div class="settings-body">
        <form id="settingsForm" autocomplete="off">
          <div class="tab-section" data-tab-section="spacing" id="tab-spacing">
            ${generateControlsForTab('spacing', existing)}
            <div class="tab-hint" data-tab-hint="spacing">Shift+1..4 switch tabs • h/l or [ ] cycle • j/k move • +/- adjust • Ctrl+S - Save & Close • Esc - Cancel & Close</div>
          </div>
          <div class="tab-section" data-tab-section="reading" id="tab-reading" hidden>
            ${generateControlsForTab('reading', existing)}
          </div>
          <div class="tab-section" data-tab-section="scroll" id="tab-scroll" hidden>
            ${generateControlsForTab('scroll', existing)}
          </div>
          <div class="tab-section" data-tab-section="context" id="tab-context" hidden>
            ${generateControlsForTab('context', existing)}
            <div class="context-hint">Prediction reserves URA for the *next* user message and ARA (provider-specific) for expected assistant output. Final trimming ensures history fits. ARA currently only influences future budget math phases.</div>
          </div>
          <div class="buttons">
            <button type="button" data-action="reset" title="Restore defaults in the form (no save)">Reset</button>
            <button type="button" data-action="saveclose" title="Save settings and close (Ctrl+S)">Save & Close</button>
            <button type="button" data-action="cancelclose" title="Close without saving (Esc)">Cancel & Close</button>
          </div>
        </form>
      </div>
    </div>`
  document.body.appendChild(root)
  const panel = root.querySelector('.settings-panel')
  const form = root.querySelector('#settingsForm')
  const modal = openModal({
    modeManager: window.__modeManager,
    root,
    closeKeys: [],
    restoreMode: true,
    preferredFocus: () => form.querySelector('input,select'),
  })
  const baseline = { ...existing }
  let isDirty = false
  let persistedThisSession = false
  function updateButtons() {
    /* static labels now; nothing to update */
  }
  function setDirty(v) {
    isDirty = !!v
  }
  function close() {
    modal.close('manual')
    if (onClose)
      try {
        onClose({ dirty: !!persistedThisSession })
      } catch {}
  }
  const cancelBtn = form.querySelector('[data-action="cancelclose"]')
  const resetBtn = form.querySelector('[data-action="reset"]')
  const saveCloseBtn = form.querySelector('[data-action="saveclose"]')
  updateButtons()

  cancelBtn.addEventListener('click', () => close())
  saveCloseBtn.addEventListener('click', () => saveAndClose())
  resetBtn.addEventListener('click', () => doReset())

  root.addEventListener(
    'keydown',
    (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        e.stopImmediatePropagation()
        close()
      } else if ((e.key === 's' || e.key === 'S') && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        e.stopPropagation()
        e.stopImmediatePropagation()
        saveAndClose()
      }
    },
    true
  )

  // future improvement: make the function schema-driven, not hardcoded. same for populaterFromSettings
  function readFormValues() {
    const fd = new FormData(form)
    const fadeZonePx = clampRange(parseInt(fd.get('fadeZonePx')), 0, 120)
    const messageGapPx = clampRange(parseInt(fd.get('messageGapPx')), 0, 60)
    const assistantGapPx = clampRange(parseInt(fd.get('assistantGapPx')), 0, 60)
    const messagePaddingPx = clampRange(parseInt(fd.get('messagePaddingPx')), 0, 48)
    const metaGapPx = clampRange(parseInt(fd.get('metaGapPx')), 0, 48)
  const gutterLPx = clampRange(parseInt(fd.get('gutterLPx')), 0, 400)
  const gutterRPx = clampRange(parseInt(fd.get('gutterRPx')), 0, 400)
    const historyBgLightness = clampRange(parseInt(fd.get('historyBgLightness')), 0, 20)
  const textLightnessPct = clampRange(parseInt(fd.get('textLightnessPct')), 50, 90)
  const fontWeightNormal = clampRange(parseInt(fd.get('fontWeightNormal')), 1, 900)
  const fontWeightStrong = clampRange(parseInt(fd.get('fontWeightStrong')), 1, 900)
    const scrollAnimMs = clampRange(parseInt(fd.get('scrollAnimMs')), 0, 2000)
    const scrollAnimDynamic = fd.get('scrollAnimDynamic') === 'true'
    const scrollAnimMinMs = clampRange(parseInt(fd.get('scrollAnimMinMs')), 0, 1000)
    const scrollAnimMaxMs = clampRange(parseInt(fd.get('scrollAnimMaxMs')), 0, 5000)
    const scrollAnimEasing = fd.get('scrollAnimEasing') || 'easeOutQuad'
    const animateSmallSteps = fd.get('animateSmallSteps') === 'on'
    const animateBigSteps = fd.get('animateBigSteps') === 'on'
    const animateMessageJumps = fd.get('animateMessageJumps') === 'on'
    const userRequestAllowance = clampRange(parseInt(fd.get('userRequestAllowance')), 0, 500000)
    const assistantResponseAllowance = clampRange(
      parseInt(fd.get('assistantResponseAllowance')),
      0,
      500000
    )
    const maxTrimAttempts = clampRange(parseInt(fd.get('maxTrimAttempts')), 0, 1000)
    const charsPerToken = clampFloat(parseFloat(fd.get('charsPerToken')), 1.0, 10.0)
    const assumedUserTokens = clampRange(parseInt(fd.get('assumedUserTokens')), 0, 10000)
    const requestTimeoutSec = clampRange(parseInt(fd.get('requestTimeoutSec')), 5, 600)
    const topicOrderMode = fd.get('topicOrderMode') || 'manual'
    const useInlineFormatting = fd.get('useInlineFormatting') === 'on'
    // Reading – assistant layout
    const twoColumns = fd.get('twoColumns') === 'on'
    const justifyColumns = fd.get('justifyColumns') === 'on'
    return {
      fadeZonePx,
      messageGapPx,
      assistantGapPx,
      messagePaddingPx,
      metaGapPx,
      gutterLPx,
      gutterRPx,
      historyBgLightness,
  textLightnessPct,
  fontWeightNormal,
  fontWeightStrong,
      scrollAnimMs,
      scrollAnimDynamic,
      scrollAnimMinMs,
      scrollAnimMaxMs,
      scrollAnimEasing,
      animateSmallSteps,
      animateBigSteps,
      animateMessageJumps,
      userRequestAllowance,
      assistantResponseAllowance,
      maxTrimAttempts,
      charsPerToken,
      assumedUserTokens,
      requestTimeoutSec,
      topicOrderMode,
      useInlineFormatting,
      twoColumns,
      justifyColumns,
    }
  }
  function shallowEqual(a, b) {
    if (a === b) return true
    if (!a || !b) return false
    const ka = Object.keys(a),
      kb = Object.keys(b)
    if (ka.length !== kb.length) return false
    for (const k of ka) {
      if (a[k] !== b[k]) return false
    }
    return true
  }
  function saveAndClose() {
    const values = readFormValues()
    // Only persist if changed vs baseline
    if (!shallowEqual(values, baseline)) {
      saveSettings(values)
      persistedThisSession = true
    }
    close()
  }
  function populateFormFromSettings(s) {
    // Spacing
    const setNum = (name, v) => {
      const el = form.querySelector(`input[name="${name}"]`)
      if (el && v != null) el.value = String(v)
    }
    setNum('fadeZonePx', s.fadeZonePx)
    setNum('messageGapPx', s.messageGapPx)
    setNum('assistantGapPx', s.assistantGapPx)
    setNum('messagePaddingPx', s.messagePaddingPx)
    setNum('metaGapPx', s.metaGapPx)
    setNum('gutterLPx', s.gutterLPx)
    setNum('gutterRPx', s.gutterRPx)
    setNum('historyBgLightness', s.historyBgLightness)
  setNum('textLightnessPct', s.textLightnessPct)
  setNum('fontWeightNormal', s.fontWeightNormal)
  setNum('fontWeightStrong', s.fontWeightStrong)
    const uif = form.querySelector('input[name="useInlineFormatting"]')
    if (uif) uif.checked = !!s.useInlineFormatting
  const tc = form.querySelector('input[name="twoColumns"]')
  if (tc) tc.checked = !!s.twoColumns
  const jc = form.querySelector('input[name="justifyColumns"]')
  if (jc) jc.checked = !!s.justifyColumns
    // Scroll
    setNum('scrollAnimMs', s.scrollAnimMs)
    const sad = form.querySelector('select[name="scrollAnimDynamic"]')
    if (sad) sad.value = String(!!s.scrollAnimDynamic)
    setNum('scrollAnimMinMs', s.scrollAnimMinMs)
    setNum('scrollAnimMaxMs', s.scrollAnimMaxMs)
    const sae = form.querySelector('select[name="scrollAnimEasing"]')
    if (sae) sae.value = s.scrollAnimEasing || 'easeOutQuad'
    // Animation checkboxes
    const ass = form.querySelector('input[name="animateSmallSteps"]')
    if (ass) ass.checked = !!s.animateSmallSteps
    const abs = form.querySelector('input[name="animateBigSteps"]')
    if (abs) abs.checked = !!s.animateBigSteps
    const amj = form.querySelector('input[name="animateMessageJumps"]')
    if (amj) amj.checked = s.animateMessageJumps !== undefined ? !!s.animateMessageJumps : true
    // Context
    setNum('userRequestAllowance', s.userRequestAllowance)
    setNum('assistantResponseAllowance', s.assistantResponseAllowance)
    setNum('maxTrimAttempts', s.maxTrimAttempts)
    const cpt = form.querySelector('input[name="charsPerToken"]')
    if (cpt && s.charsPerToken != null) cpt.value = String(s.charsPerToken)
    setNum('assumedUserTokens', s.assumedUserTokens)
    setNum('requestTimeoutSec', s.requestTimeoutSec)
    const tom = form.querySelector('select[name="topicOrderMode"]')
    if (tom) tom.value = s.topicOrderMode || 'manual'
  }
  function doReset() {
    const defs = getDefaultSettings()
    populateFormFromSettings(defs)
    updatePfHint()
    setDirty(true)
  }
  function clampRange(v, min, max) {
    if (isNaN(v)) return min
    return Math.min(max, Math.max(min, v))
  }
  function clampFloat(v, min, max) {
    if (isNaN(v)) return min
    return Math.min(max, Math.max(min, v))
  }
  function markSaved() {
    setDirty(false)
  }
  function markDirty() {
    setDirty(true)
  }
  function focusables() {
    return Array.from(form.querySelectorAll('input,select,button')).filter((el) => !el.disabled)
  }
  function moveFocus(dir) {
    const list = focusables()
    if (!list.length) return
    const idx = list.indexOf(document.activeElement)
    let next = 0
    if (idx === -1) {
      next = 0
    } else {
      next = (idx + dir + list.length) % list.length
    }
    list[next].focus()
  }
  function adjustNumber(el, delta) {
    if (!el) return
    const name = el.name
    if (name === 'fadeHiddenOpacity') {
      const min = parseFloat(el.min)
      const max = parseFloat(el.max)
      const base = parseFloat(el.step) || 0.05
      const step = base * (Math.abs(delta) === 2 ? 2 : 1) * (delta > 0 ? 1 : -1)
      let v = parseFloat(el.value)
      if (isNaN(v)) v = isNaN(min) ? 0 : min
      v += step
      if (!isNaN(min) && v < min) v = min
      if (!isNaN(max) && v > max) v = max
      el.value = v.toFixed(2)
    } else {
      const minAttr = parseInt(el.min, 10)
      const maxAttr = parseInt(el.max, 10)
      const min = isNaN(minAttr) ? 0 : minAttr
      const max = isNaN(maxAttr) ? Number.MAX_SAFE_INTEGER : maxAttr
      const base = parseInt(el.step, 10) || 1
      const step = base * (Math.abs(delta) === 2 ? 2 : 1) * (delta > 0 ? 1 : -1)
      let v = parseInt(el.value, 10)
      if (isNaN(v)) v = min
      v += step
      if (v < min) v = min
      if (v > max) v = max
      el.value = String(v)
    }
    markDirty()
  }
  function cycleSelect(sel, dir) {
    if (!sel) return
    const opts = Array.from(sel.options)
    let i = sel.selectedIndex
    i = (i + dir + opts.length) % opts.length
    sel.selectedIndex = i
  }
  form.addEventListener('keydown', (e) => {
    const active = document.activeElement
    const isNumber = active && active.tagName === 'INPUT' && active.type === 'number'
    const isSelect = active && active.tagName === 'SELECT'
    if (e.key === 'j') {
      e.preventDefault()
      moveFocus(1)
      return
    }
    if (e.key === 'k') {
      e.preventDefault()
      moveFocus(-1)
      return
    }
    if (isNumber) {
      if (e.key === '+' || e.key === '=') {
        e.preventDefault()
        adjustNumber(active, e.shiftKey ? 2 : 1)
        return
      }
      if (e.key === '-' || e.key === '_') {
        e.preventDefault()
        adjustNumber(active, e.shiftKey ? -2 : -1)
        return
      }
    }
    if (isSelect && e.key === ' ') {
      e.preventDefault()
      cycleSelect(active, e.shiftKey ? -1 : 1)
      markDirty()
      return
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      close()
      return
    }
    if (['j', 'k', '+', '-', '_', ' ', 'Escape', '='].includes(e.key)) e.stopPropagation()
  })
  form.querySelectorAll('input,select').forEach((el) => {
    el.addEventListener('change', () => markDirty())
    el.addEventListener('input', () => markDirty())
  })
  
  // CPT change handler: trigger recalculation on blur if value changed
  const cptInput = form.querySelector('input[name="charsPerToken"]')
  if (cptInput) {
    cptInput.addEventListener('blur', async () => {
      const newValue = parseFloat(cptInput.value)
      const oldValue = baseline.charsPerToken
      
      if (isNaN(newValue) || newValue === oldValue) return
      
      // Show confirmation modal
      const confirmed = await openConfirmOverlay({
        modeManager: window.__modeManager,
        title: 'Recalculate Token Estimates',
        message: 
          `Chars Per Token changed from ${oldValue} to ${newValue}.\n\n` +
          `Recalculate all stored token estimates?\n\n` +
          `This will update all message pairs in the database and may take a few seconds.`
      })
      
      if (!confirmed) {
        // Revert to original value
        cptInput.value = String(oldValue)
        return
      }
      
      // User confirmed - save CPT and recalculate
      try {
        // Disable form during recalculation
        const formElements = form.querySelectorAll('input,select,button')
        formElements.forEach(el => el.disabled = true)
        
        // Save CPT immediately
        saveSettings({ charsPerToken: newValue })
        
        // Show progress in button
        const originalText = saveCloseBtn.textContent
        saveCloseBtn.textContent = 'Recalculating token estimates...'
        
        // Recalculate
        const count = await recalculateAllTokenEstimates(store, newValue)
        // console.log(`Recalculated ${count} message pairs with CPT=${newValue}`) // debug
        
        // Update baseline so it won't trigger again
        baseline.charsPerToken = newValue
        persistedThisSession = true
        
        // Restore UI
        saveCloseBtn.textContent = originalText
        formElements.forEach(el => el.disabled = false)
        
        // Show success with alert overlay
        await openAlertOverlay({
          modeManager: window.__modeManager,
          title: 'Recalculation Complete',
          message: `Successfully recalculated ${count} message pairs.`
        })
      } catch (err) {
        console.error('Token recalculation failed:', err)
        
        // Show error with alert overlay
        await openAlertOverlay({
          modeManager: window.__modeManager,
          title: 'Recalculation Failed',
          message: `Error: ${err.message}`
        })
        
        // Restore UI
        const formElements = form.querySelectorAll('input,select,button')
        formElements.forEach(el => el.disabled = false)
        saveCloseBtn.textContent = 'Save & Close'
      }
    })
  }
  
  window.addEventListener('keydown', function esc(e) {
    if (e.key === 'Escape') {
      e.preventDefault()
      close()
      window.removeEventListener('keydown', esc)
    }
  })
  function placeCaretAtEnd(el) {
    let attempts = 0
    const desired = el.value.length
    function attempt() {
      attempts++
      try {
        el.focus({ preventScroll: true })
        const origType = el.type
        if (origType === 'number') el.type = 'text'
        el.setSelectionRange(desired, desired)
        if (origType === 'text' || origType === 'number') el.type = origType
        if (el.selectionStart === desired) return
      } catch (_) {}
      if (attempts < 5) setTimeout(attempt, 30)
    }
    requestAnimationFrame(attempt)
  }
  panel.addEventListener('focusin', (e) => {
    const t = e.target
    if (t && t.matches && t.matches('input[type="number"]')) {
      placeCaretAtEnd(t)
    }
  })
  const firstNumeric = form.querySelector('input[type="number"][name="partFraction"]')
  if (firstNumeric) {
    setTimeout(() => placeCaretAtEnd(firstNumeric), 10)
  }
  const pfInput = form.querySelector('input[name="partFraction"]')
  const pfHintEl = form.querySelector('.pf-hint')
  function updatePfHint() {
    if (!pfInput || !pfHintEl) return
    const v = clampPF(parseFloat(pfInput.value))
    try {
      const pane = document.getElementById('historyPane')
      const rootEl = document.documentElement
      let lineH = 18
      if (rootEl) {
        const csR = window.getComputedStyle(rootEl)
        const fs = parseFloat(csR.fontSize) || 13
        lineH = parseFloat(csR.lineHeight) || fs * 1.45
      }
      if (pane) {
        const cs = window.getComputedStyle(pane)
        const padTop = parseFloat(cs.paddingTop) || 0
        const padBottom = parseFloat(cs.paddingBottom) || 0
        const usableH = pane.clientHeight - padTop - padBottom
        if (usableH > 0) {
          const maxLines = Math.max(1, Math.floor((usableH * v) / lineH))
          pfHintEl.textContent = `(≈ ${maxLines} lines)`
          return
        }
      }
    } catch {}
    pfHintEl.textContent = ''
  }
  if (pfInput) {
    pfInput.addEventListener('input', updatePfHint)
    updatePfHint()
  }
  const tabs = Array.from(panel.querySelectorAll('.settings-tabs .tab-btn'))
  function activateTab(name) {
    tabs.forEach((btn) => {
      const on = btn.getAttribute('data-tab') === name
      btn.classList.toggle('active', on)
      btn.setAttribute('aria-selected', on)
    })
    panel.querySelectorAll('[data-tab-section]').forEach((sec) => {
      const on = sec.getAttribute('data-tab-section') === name
      sec.hidden = !on
    })
    panel.querySelectorAll('.tab-hint').forEach((h) => {
      h.style.display = h.getAttribute('data-tab-hint') === name ? 'block' : 'none'
    })
    const first = panel.querySelector(
      `[data-tab-section='${name}'] input, [data-tab-section='${name}'] select`
    )
    if (first) first.focus()
  }
  tabs.forEach((btn) =>
    btn.addEventListener('click', () => activateTab(btn.getAttribute('data-tab')))
  )
  function cycleTab(dir) {
    const order = tabs.map((b) => b.getAttribute('data-tab'))
    const current = order.findIndex(
      (t) => panel.querySelector(`[data-tab-section='${t}']`).hidden === false
    )
    const next = (current + dir + order.length) % order.length
    activateTab(order[next])
  }
  panel.addEventListener('keydown', (e) => {
    if (e.target && e.target.matches('input,select,button')) {
      if (e.shiftKey && ['1', '2', '3', '4'].includes(e.key)) {
        const idx = Number(e.key) - 1
        if (tabs[idx]) {
          e.preventDefault()
          activateTab(tabs[idx].getAttribute('data-tab'))
        }
      }
      if (e.key === '[' || (e.key === 'h' && !e.metaKey && !e.altKey && !e.ctrlKey)) {
        e.preventDefault()
        cycleTab(-1)
      }
      if (e.key === ']' || (e.key === 'l' && !e.metaKey && !e.altKey && !e.ctrlKey)) {
        e.preventDefault()
        cycleTab(1)
      }
    }
  })

  // Constant-size panel: measure tallest tab then lock height (with 70vh cap) so switching tabs doesn't resize.
  ;(function establishConstantHeight() {
    try {
      const sections = Array.from(panel.querySelectorAll('.tab-section'))
      if (!sections.length) return
      const active = sections.find((s) => !s.hidden)
      const activeName = active ? active.getAttribute('data-tab-section') : null
      let maxH = 0
      // Temporarily measure each tab in isolation for accurate outer height (header + tabs + buttons included)
      sections.forEach((sec) => {
        sections.forEach((s) => (s.hidden = s !== sec))
        // Let height auto for measurement
        panel.style.height = 'auto'
        const h = panel.offsetHeight
        if (h > maxH) maxH = h
      })
      // Restore original active tab visibility
      sections.forEach((sec) => (sec.hidden = sec.getAttribute('data-tab-section') !== activeName))
      // Reactivate hint display (hidden states changed during measurement)
      if (activeName) {
        panel.querySelectorAll('.tab-hint').forEach((h) => {
          h.style.display = h.getAttribute('data-tab-hint') === activeName ? 'block' : 'none'
        })
      }
      const cap = Math.floor(window.innerHeight * 0.95)
      // Force a minimum height for spacing tab if it's too small
      const minDesiredHeight = 800
      const finalH = Math.min(Math.max(maxH, minDesiredHeight), cap)
      panel.dataset.maxMeasuredHeight = String(Math.max(maxH, minDesiredHeight))
      panel.style.height = finalH + 'px'
      panel.classList.add('fixed-height')
      const body = panel.querySelector('.settings-body')
      if (body) {
        body.style.overflow = Math.max(maxH, minDesiredHeight) > cap ? 'auto' : 'hidden'
      }
      // On resize, keep constant measured height but re-clamp to current 95vh
      window.addEventListener('resize', () => {
        const stored = parseInt(panel.dataset.maxMeasuredHeight, 10) || maxH
        const capNow = Math.floor(window.innerHeight * 0.95)
        const hNow = Math.min(stored, capNow)
        panel.style.height = hNow + 'px'
        if (body) {
          body.style.overflow = stored > capNow ? 'auto' : 'hidden'
        }
      })
    } catch {}
  })()
}

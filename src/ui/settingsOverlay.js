// Settings Overlay UI (Ctrl+,)
// Minimal implementation: allows editing partFraction, anchorMode, edgeAnchoringMode with Apply/Cancel.

import { getSettings, saveSettings } from '../settings/index.js'
import { openModal } from './openModal.js'

export function openSettingsOverlay({ onClose }){
  if(document.getElementById('settingsOverlayRoot')) return
  const existing = getSettings()
  const root = document.createElement('div')
  root.id = 'settingsOverlayRoot'
  root.className = 'overlay-backdrop centered'
  root.innerHTML = `
    <div class="overlay-panel settings-panel compact">
      <header>Settings</header>
      <div class="settings-tabs" role="tablist">
        ${['layout','spacing','visibility','scroll'].map((t,i)=>`<button type="button" class="tab-btn${i===0?' active':''}" data-tab="${t}" role="tab" aria-selected="${i===0}" aria-controls="tab-${t}">${t}</button>`).join('')}
      </div>
      <div class="settings-body">
        <form id="settingsForm" autocomplete="off">
          <div class="tab-section" data-tab-section="layout" id="tab-layout">
            <fieldset class="spacing-fieldset layout-fieldset">
              <legend>Layout</legend>
              <label><span>Part Fraction <span class="pf-hint" style="opacity:.7;font-size:12px;color:var(--text-dim);"></span></span>
                <input name="partFraction" type="number" step="0.10" min="0.10" max="1.00" value="${existing.partFraction}" />
              </label>
              <label>Anchor Mode
                <select name="anchorMode">
                  ${['bottom','center','top'].map(m=>`<option value="${m}" ${m===existing.anchorMode?'selected':''}>${m}</option>`).join('')}
                </select>
              </label>
              <label>Edge Anchoring Mode
                <select name="edgeAnchoringMode">
                  ${['adaptive','strict'].map(m=>`<option value="${m}" ${m===existing.edgeAnchoringMode?'selected':''}>${m}</option>`).join('')}
                </select>
              </label>
            </fieldset>
            <div class="tab-hint" data-tab-hint="layout">Shift+1..4 switch tabs • h/l or [ ] cycle • j/k move • +/- adjust • Enter save • Esc close</div>
          </div>
          <div class="tab-section" data-tab-section="spacing" id="tab-spacing" hidden>
            <fieldset class="spacing-fieldset">
              <legend>Spacing</legend>
              <label>Part Padding (px)
                <input name="partPadding" type="number" step="1" min="0" max="48" value="${existing.partPadding}" />
              </label>
              <label>Edge Gap (px)
                <input name="gapOuterPx" type="number" step="1" min="0" max="48" value="${existing.gapOuterPx}" />
              </label>
              <label>Meta Gap (px)
                <input name="gapMetaPx" type="number" step="1" min="0" max="48" value="${existing.gapMetaPx}" />
              </label>
              <label>Intra-role Gap (px)
                <input name="gapIntraPx" type="number" step="1" min="0" max="48" value="${existing.gapIntraPx}" />
              </label>
              <label>Between Messages Gap (px)
                <input name="gapBetweenPx" type="number" step="1" min="0" max="48" value="${existing.gapBetweenPx}" />
              </label>
            </fieldset>
          </div>
          <div class="tab-section" data-tab-section="visibility" id="tab-visibility" hidden>
            <fieldset class="spacing-fieldset visibility-fieldset">
              <legend>Visibility</legend>
              <label>Fade Mode
                <select name="fadeMode">
                  ${['binary','gradient'].map(m=>`<option value="${m}" ${m===existing.fadeMode?'selected':''}>${m}</option>`).join('')}
                </select>
              </label>
              <label>Hidden Opacity (binary)
                <input name="fadeHiddenOpacity" type="number" min="0" max="1" step="0.05" value="${existing.fadeHiddenOpacity}" />
              </label>
              <label>Fade In (ms)
                <input name="fadeInMs" type="number" min="0" max="2000" step="10" value="${existing.fadeInMs != null ? existing.fadeInMs : (existing.fadeTransitionMs != null ? existing.fadeTransitionMs : 120)}" />
              </label>
              <label>Fade Out (ms)
                <input name="fadeOutMs" type="number" min="0" max="2000" step="10" value="${existing.fadeOutMs != null ? existing.fadeOutMs : (existing.fadeTransitionMs != null ? existing.fadeTransitionMs : 120)}" />
              </label>
            </fieldset>
          </div>
          <div class="tab-section" data-tab-section="scroll" id="tab-scroll" hidden>
            <fieldset class="spacing-fieldset scroll-fieldset">
              <legend>Scrolling</legend>
              <label>Base Duration (ms)
                <input name="scrollAnimMs" type="number" min="0" max="1200" step="20" value="${existing.scrollAnimMs}" />
              </label>
              <label>Dynamic Scaling
                <select name="scrollAnimDynamic">
                  ${[true,false].map(v=>`<option value="${v}" ${(String(v)===String(existing.scrollAnimDynamic))?'selected':''}>${v?'on':'off'}</option>`).join('')}
                </select>
              </label>
              <label>Min Duration (ms)
                <input name="scrollAnimMinMs" type="number" min="0" max="1000" step="10" value="${existing.scrollAnimMinMs}" />
              </label>
              <label>Max Duration (ms)
                <input name="scrollAnimMaxMs" type="number" min="0" max="2000" step="20" value="${existing.scrollAnimMaxMs}" />
              </label>
              <label>Easing
                <select name="scrollAnimEasing">
                  ${['linear','easeOutQuad','easeInOutCubic','easeOutExpo'].map(m=>`<option value="${m}" ${m===existing.scrollAnimEasing?'selected':''}>${m}</option>`).join('')}
                </select>
              </label>
            </fieldset>
          </div>
          <div class="buttons">
            <button type="button" data-action="cancel">Cancel</button>
            <button type="button" data-action="apply">Apply</button>
          </div>
        </form>
      </div>
    </div>`
  document.body.appendChild(root)
  const panel = root.querySelector('.settings-panel')
  const form = root.querySelector('#settingsForm')
  const modal = openModal({ modeManager: window.__modeManager, root, closeKeys:[], restoreMode:true, preferredFocus: ()=> form.querySelector('input,select') })
  function close(){ modal.close('manual'); if(onClose) onClose() }
  root.addEventListener('click', e=>{ if(e.target===root) close() })
  const cancelBtn = form.querySelector('[data-action="cancel"]')
  const applyBtn = form.querySelector('[data-action="apply"]')

  cancelBtn.addEventListener('click', ()=> close())
  applyBtn.addEventListener('click', ()=> applyChanges())

  // Swallow Esc (cancel) and Enter (apply) to prevent mode leakage
  root.addEventListener('keydown', e=>{
    if(e.key === 'Escape'){
      e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
      close();
    } else if(e.key === 'Enter' && e.target && e.target.tagName !== 'TEXTAREA'){
      // Apply without closing (existing behavior) but swallow so Enter doesn't reach keyRouter
      e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
      applyChanges();
    }
  }, true)

  function applyChanges(){
    const fd = new FormData(form)
    const partFraction = clampPF(parseFloat(fd.get('partFraction')))
    const partPadding = clampRange(parseInt(fd.get('partPadding')),0,48)
    const gapOuterPx = clampRange(parseInt(fd.get('gapOuterPx')),0,48)
    const gapMetaPx = clampRange(parseInt(fd.get('gapMetaPx')),0,48)
    const gapIntraPx = clampRange(parseInt(fd.get('gapIntraPx')),0,48)
    const gapBetweenPx = clampRange(parseInt(fd.get('gapBetweenPx')),0,48)
    const anchorMode = fd.get('anchorMode')
    const edgeAnchoringMode = fd.get('edgeAnchoringMode')
    const fadeMode = fd.get('fadeMode') || 'binary'
  const fadeHiddenOpacity = clampFloat(parseFloat(fd.get('fadeHiddenOpacity')),0,1)
  const fadeInMs = clampRange(parseInt(fd.get('fadeInMs')),0,5000)
  const fadeOutMs = clampRange(parseInt(fd.get('fadeOutMs')),0,5000)
  const scrollAnimMs = clampRange(parseInt(fd.get('scrollAnimMs')),0,2000)
  const scrollAnimDynamic = fd.get('scrollAnimDynamic') === 'true'
  const scrollAnimMinMs = clampRange(parseInt(fd.get('scrollAnimMinMs')),0,1000)
  const scrollAnimMaxMs = clampRange(parseInt(fd.get('scrollAnimMaxMs')),0,5000)
  const scrollAnimEasing = fd.get('scrollAnimEasing') || 'easeOutQuad'
  saveSettings({ partFraction, anchorMode, edgeAnchoringMode, partPadding, gapOuterPx, gapMetaPx, gapIntraPx, gapBetweenPx, fadeMode, fadeHiddenOpacity, fadeInMs, fadeOutMs, scrollAnimMs, scrollAnimDynamic, scrollAnimMinMs, scrollAnimMaxMs, scrollAnimEasing })
    markSaved()
  }
  function clampPF(v){ if(isNaN(v)) v = existing.partFraction || 0.6; return Math.min(1.00, Math.max(0.10, v)) }
  function clampRange(v,min,max){ if(isNaN(v)) return min; return Math.min(max, Math.max(min,v)) }
  function clampFloat(v,min,max){ if(isNaN(v)) return min; return Math.min(max, Math.max(min,v)) }
  function markSaved(){ applyBtn.textContent = 'Saved'; applyBtn.classList.add('saved') }
  function markDirty(){ if(applyBtn.textContent==='Saved'){ applyBtn.textContent='Apply'; applyBtn.classList.remove('saved') } }

  // Ordered focus targets (dynamic function to reflect DOM order)
  function focusables(){ return Array.from(form.querySelectorAll('input,select,button')).filter(el=> !el.disabled) }
  function moveFocus(dir){
    const list = focusables(); if(!list.length) return
    const idx = list.indexOf(document.activeElement)
    let next = 0
    if(idx === -1){ next = 0 }
    else { next = (idx + dir + list.length) % list.length }
    list[next].focus()
  }
  function adjustNumber(el, delta){
    if(!el) return
    const name = el.name
    if(name === 'partFraction'){
      // Uniform step 0.10; Shift accelerates by +2 steps (0.20)
      const stepBase = 0.10
      const stepLarge = 0.20
      const step = (Math.abs(delta)===2?stepLarge:stepBase) * (delta>0?1:-1)
      let v = parseFloat(el.value)
      if(isNaN(v)) v = existing.partFraction || 0.6
      v += step
      v = clampPF(v)
  el.value = v.toFixed(2)
    } else if(name === 'fadeHiddenOpacity') {
      const min = parseFloat(el.min); const max = parseFloat(el.max)
      const base = parseFloat(el.step)||0.05
      const step = base * (Math.abs(delta)===2?2:1) * (delta>0?1:-1)
      let v = parseFloat(el.value); if(isNaN(v)) v = (isNaN(min)?0:min)
      v += step
      if(!isNaN(min) && v < min) v = min
      if(!isNaN(max) && v > max) v = max
      el.value = v.toFixed(2)
    } else { // generic integer/duration spacing etc.
      const minAttr = parseInt(el.min,10); const maxAttr = parseInt(el.max,10)
      const min = isNaN(minAttr)?0:minAttr
      const max = isNaN(maxAttr)?Number.MAX_SAFE_INTEGER:maxAttr
      const base = parseInt(el.step,10) || 1
      const step = base * (Math.abs(delta)===2?2:1) * (delta>0?1:-1)
      let v = parseInt(el.value,10); if(isNaN(v)) v = min
      v += step
      if(v < min) v = min
      if(v > max) v = max
      el.value = String(v)
    }
    markDirty()
  }
  function cycleSelect(sel, dir){
    if(!sel) return
    const opts = Array.from(sel.options)
    let i = sel.selectedIndex
    i = (i + dir + opts.length) % opts.length
    sel.selectedIndex = i
  }

  form.addEventListener('keydown', e=>{
    const active = document.activeElement
    const isNumber = active && active.tagName==='INPUT' && active.type==='number'
    const isSelect = active && active.tagName==='SELECT'
    // Navigation j/k
    if(e.key==='j'){ e.preventDefault(); moveFocus(1); return }
    if(e.key==='k'){ e.preventDefault(); moveFocus(-1); return }
    // Numeric adjustments (+/-) when focused numeric only
    if(isNumber){
      if(e.key==='+' || e.key==='=' ){ // '=' unshifted, '+' shifted
        e.preventDefault(); adjustNumber(active, e.shiftKey?2:1); return
      }
      if(e.key==='-' || e.key==='_'){ // '_' is shifted '-'
        e.preventDefault(); adjustNumber(active, e.shiftKey?-2:-1); return
      }
    }
    // Select cycling with Space / Shift+Space
  if(isSelect && e.key===' '){ e.preventDefault(); cycleSelect(active, e.shiftKey?-1:1); markDirty(); return }
    // Enter applies (always) — ignore Cancel button focus special-case per spec
  if(e.key==='Enter'){ e.preventDefault(); applyChanges(); return }
    // Esc cancels & closes
    if(e.key==='Escape'){ e.preventDefault(); close(); return }
    // Stop bubbling of handled keys to global router
    if(['j','k','+','-','_',' ','Enter','Escape','=',].includes(e.key)) e.stopPropagation()
  })

  // Mark dirty on manual user edits (inputs/select changes)
  form.querySelectorAll('input,select').forEach(el=>{
    el.addEventListener('change', ()=> markDirty())
    el.addEventListener('input', ()=> markDirty())
  })

  window.addEventListener('keydown', function esc(e){ if(e.key==='Escape'){ e.preventDefault(); close(); window.removeEventListener('keydown', esc) } })

  // Caret-at-end behavior for ALL numeric inputs (future-proof): delegated focus handler
  function placeCaretAtEnd(el){
    let attempts = 0
    const desired = el.value.length
    function attempt(){
      attempts++
      try {
        // Keep focus (avoid scroll) then temporarily switch type for reliable selection
        el.focus({ preventScroll:true })
        const origType = el.type
        if(origType === 'number') el.type = 'text'
        el.setSelectionRange(desired, desired)
        if(origType === 'text' || origType === 'number') el.type = origType
        if(el.selectionStart === desired) return // success
      } catch(_){}
      if(attempts < 5) setTimeout(attempt, 30)
    }
    // begin after paint
    requestAnimationFrame(attempt)
  }
  panel.addEventListener('focusin', (e)=>{
    const t = e.target
    if(t && t.matches && t.matches('input[type="number"]')){
      placeCaretAtEnd(t)
    }
  })
  // Kick initial first numeric caret after trap initial focus (setTimeout 0 inside trap)
  const firstNumeric = form.querySelector('input[type="number"][name="partFraction"]')
  if(firstNumeric){ setTimeout(()=> placeCaretAtEnd(firstNumeric), 10) }

  // Dynamic partFraction hint: display approximate max lines result
  const pfInput = form.querySelector('input[name="partFraction"]')
  const pfHintEl = form.querySelector('.pf-hint')
  function updatePfHint(){
    if(!pfInput || !pfHintEl) return
    const v = clampPF(parseFloat(pfInput.value))
    // Estimate lines using current pane height (minus vertical padding) and root line height
    try {
      const pane = document.getElementById('historyPane')
      const root = document.documentElement
      let lineH = 18
      if(root){
        const csR = window.getComputedStyle(root)
        const fs = parseFloat(csR.fontSize)||13
        lineH = parseFloat(csR.lineHeight) || fs*1.45
      }
      if(pane){
        const cs = window.getComputedStyle(pane)
        const padTop = parseFloat(cs.paddingTop)||0
        const padBottom = parseFloat(cs.paddingBottom)||0
        const usableH = pane.clientHeight - padTop - padBottom
        if(usableH>0){
          const maxLines = Math.max(1, Math.floor((usableH * v)/lineH))
          pfHintEl.textContent = `(≈ ${maxLines} lines)`
          return
        }
      }
    } catch {}
    pfHintEl.textContent = ''
  }
  if(pfInput){ pfInput.addEventListener('input', updatePfHint); updatePfHint() }

  // -------- Tabs logic --------
  const tabs = Array.from(panel.querySelectorAll('.settings-tabs .tab-btn'))
  function activateTab(name){
    tabs.forEach(btn=>{
      const on = btn.getAttribute('data-tab')===name
      btn.classList.toggle('active', on)
      btn.setAttribute('aria-selected', on)
    })
    panel.querySelectorAll('[data-tab-section]').forEach(sec=>{
      const on = sec.getAttribute('data-tab-section')===name
      sec.hidden = !on
    })
  panel.querySelectorAll('.tab-hint').forEach(h=>{ h.style.display = (h.getAttribute('data-tab-hint')===name)?'block':'none' })
    // Focus first field in tab
    const first = panel.querySelector(`[data-tab-section='${name}'] input, [data-tab-section='${name}'] select`)
    if(first) first.focus()
  }
  tabs.forEach(btn=> btn.addEventListener('click', ()=> activateTab(btn.getAttribute('data-tab'))))
  function cycleTab(dir){
    const order = tabs.map(b=> b.getAttribute('data-tab'))
    const current = order.findIndex(t=> panel.querySelector(`[data-tab-section='${t}']`).hidden===false)
    const next = (current + dir + order.length) % order.length
    activateTab(order[next])
  }
  // Removed dynamic height logic: panel uses fixed CSS height to avoid flicker.

  // Number keys 1-4 select tab
  panel.addEventListener('keydown', e=>{
    if(e.target && e.target.matches('input,select,button')){
      // Shift+1..4 -> tabs (leave bare 1/2/3/4 for numeric entry)
      if(e.shiftKey && ['1','2','3','4'].includes(e.key)){
        const idx = Number(e.key)-1
        if(tabs[idx]){ e.preventDefault(); activateTab(tabs[idx].getAttribute('data-tab')) }
      }
      // Legacy [ / ] and new h / l for tab cycling
      if(e.key==='[' || (e.key==='h' && !e.metaKey && !e.altKey && !e.ctrlKey)) { e.preventDefault(); cycleTab(-1) }
      if(e.key===']' || (e.key==='l' && !e.metaKey && !e.altKey && !e.ctrlKey)) { e.preventDefault(); cycleTab(1) }
    }
  })
}

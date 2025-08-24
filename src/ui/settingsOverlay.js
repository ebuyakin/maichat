// Settings Overlay UI (Ctrl+,)
// Minimal implementation: allows editing partFraction, anchorMode, edgeAnchoringMode with Apply/Cancel.

import { getSettings, saveSettings } from '../settings/index.js'
import { createFocusTrap } from './focusTrap.js'

export function openSettingsOverlay({ onClose }){
  if(document.getElementById('settingsOverlayRoot')) return
  const existing = getSettings()
  const root = document.createElement('div')
  root.id = 'settingsOverlayRoot'
  root.className = 'overlay-backdrop'
  root.innerHTML = `
    <div class="overlay-panel settings-panel">
      <header>Settings</header>
      <div class="settings-body">
        <form id="settingsForm" autocomplete="off">
          <label>Part Fraction
            <input name="partFraction" type="number" step="0.05" min="0.10" max="0.95" value="${existing.partFraction}" />
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
  const trap = createFocusTrap(panel, ()=> form.querySelector('input,select'))
  function close(){
    trap.release(); root.remove(); if(onClose) onClose()
  }
  root.addEventListener('click', e=>{ if(e.target===root) close() })
  const cancelBtn = form.querySelector('[data-action="cancel"]')
  const applyBtn = form.querySelector('[data-action="apply"]')

  cancelBtn.addEventListener('click', ()=> close())
  applyBtn.addEventListener('click', ()=> applyChanges())

  function applyChanges(){
    const fd = new FormData(form)
    const partFraction = clampPF(parseFloat(fd.get('partFraction')))
    const anchorMode = fd.get('anchorMode')
    const edgeAnchoringMode = fd.get('edgeAnchoringMode')
    saveSettings({ partFraction, anchorMode, edgeAnchoringMode })
    markSaved()
  }
  function clampPF(v){ if(isNaN(v)) v = existing.partFraction || 0.6; return Math.min(0.95, Math.max(0.10, v)) }
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
    const stepBase = 0.05
    const stepLarge = 0.10
    const step = delta>0? (delta===2?stepLarge:stepBase) : (delta===-2?stepLarge:stepBase)
    let v = parseFloat(el.value)
    if(isNaN(v)) v = existing.partFraction || 0.6
    v += (delta>0?1:-1) * step
    v = clampPF(v)
    el.value = v.toFixed(2)
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
}

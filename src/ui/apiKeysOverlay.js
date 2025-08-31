// Simple API Keys overlay (stores keys in localStorage under 'maichat_api_keys')

const STORAGE_KEY = 'maichat_api_keys'

export function loadApiKeys(){
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {} } catch { return {} }
}
export function saveApiKeys(obj){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(obj||{}))
}

import { openModal } from './openModal.js'
export function openApiKeysOverlay({ onClose, modeManager }){
  const existing = loadApiKeys()
  const backdrop = document.createElement('div')
  backdrop.className = 'overlay-backdrop centered'
  const panel = document.createElement('div')
  panel.className = 'overlay-panel api-keys-panel compact'
  panel.innerHTML = `
    <header>API Keys</header>
    <div class="keys-body" >
      <p class="keys-note">Keys are stored locally in plain text (not encrypted). Provide only for models you plan to use.</p>
      <label class="key-field">
        <span>OpenAI Key</span>
        <input class="std-input" type="password" data-key="openai" placeholder="sk-..." value="${existing.openai?escapeHtml(existing.openai):''}" />
      </label>
      <label class="key-field">
        <span>Anthropic Key</span>
        <input class="std-input" type="password" data-key="anthropic" placeholder="..." value="${existing.anthropic?escapeHtml(existing.anthropic):''}" />
      </label>
      <label class="key-field">
        <span>OpenRouter Key</span>
        <input class="std-input" type="password" data-key="openrouter" placeholder="..." value="${existing.openrouter?escapeHtml(existing.openrouter):''}" />
      </label>
      <div class="keys-buttons">
        <button data-action="cancel" class="btn">Close</button>
        <button data-action="save" class="btn">Save</button>
      </div>
      <div class="keys-footnote">Keys live in localStorage only; clearing browser data removes them.</div>
    </div>`
  backdrop.appendChild(panel)
  document.body.appendChild(backdrop)

  backdrop.addEventListener('click', e=>{ if(e.target===backdrop){ close() } })
  panel.addEventListener('click', e=>{
    const btn = e.target.closest('button[data-action]'); if(!btn) return
    if(btn.getAttribute('data-action')==='cancel'){ close(); return }
    if(btn.getAttribute('data-action')==='save'){
      const inputs = panel.querySelectorAll('input[data-key]')
      const data = {}
      inputs.forEach(inp=>{ const v = inp.value.trim(); if(v) data[inp.getAttribute('data-key')] = v })
      saveApiKeys(data)
      close()
    }
  })
  // Keyboard navigation similar to other overlays: j/k cycles focus among inputs and first Close button.
  backdrop.addEventListener('keydown', e=>{
    if(e.metaKey || e.altKey || e.ctrlKey) return
    const focusables = Array.from(panel.querySelectorAll('input[data-key], .keys-buttons button'))
    if(!focusables.length) return
    let idx = focusables.indexOf(document.activeElement)
    if(e.key==='j' || e.key==='ArrowDown'){
      e.preventDefault();
      idx = (idx+1+focusables.length)%focusables.length
      focusables[idx].focus()
    } else if(e.key==='k' || e.key==='ArrowUp'){
      e.preventDefault();
      idx = (idx-1+focusables.length)%focusables.length
      focusables[idx].focus()
    } else if(e.key==='Enter'){
      // If on a button, click it; otherwise ignore (lets user press Enter inside password maybe – but we suppress default to avoid submitting)
      if(document.activeElement && document.activeElement.tagName==='BUTTON'){
        e.preventDefault(); document.activeElement.click()
      }
    }
  })
  const modal = openModal({ modeManager: modeManager || window.__modeManager, root: backdrop, closeKeys:['Escape'], restoreMode:true, beforeClose:()=>{ onClose && onClose() } })
  // Initial focus: first password field
  const firstInput = panel.querySelector('input[data-key]')
  if(firstInput) firstInput.focus()
  function close(){ modal.close('manual') }
}

function escapeHtml(str){ return String(str).replace(/[&<>"']/g, s=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;' }[s])) }

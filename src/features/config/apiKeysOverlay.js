// apiKeysOverlay.js moved from ui/apiKeysOverlay.js (Phase 6.6 Config)
// Restored original (moved from src/ui/apiKeysOverlay.js) - path adjusted only.
import { openModal } from '../../shared/openModal.js'

const STORAGE_KEY = 'maichat_api_keys'

export function loadApiKeys(){
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {} } catch { return {} }
}
export function saveApiKeys(obj){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(obj||{}))
}

export function openApiKeysOverlay({ onClose, modeManager }){
  const existing = loadApiKeys()
  const backdrop = document.createElement('div')
  backdrop.className = 'overlay-backdrop centered'
  const panel = document.createElement('div')
  panel.className = 'overlay-panel api-keys-panel compact'
  panel.innerHTML = `
    <header>API Keys</header>
    <div class="keys-body" >
      <p class="keys-note">Enter your API keys. Keys are stored only in this browser (localStorage). <a href="https://platform.openai.com/account/api-keys" target="_blank" rel="noopener" class="ext-link">OpenAI keys</a> · <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener" class="ext-link">Anthropic keys</a>. You can remove them anytime by clearing browser data.</p>
      <label class="key-field">
        <span>OpenAI Key</span>
        <input class="std-input" type="password" data-key="openai" placeholder="sk-..." value="${existing.openai?escapeHtml(existing.openai):''}" />
      </label>
      <label class="key-field">
        <span>Anthropic Key</span>
        <input class="std-input" type="password" data-key="anthropic" placeholder="sk-ant-..." value="${existing.anthropic?escapeHtml(existing.anthropic):''}" />
      </label>
      <label class="key-field">
        <span>OpenRouter Key (coming soon)</span>
        <input class="std-input" type="password" data-key="openrouter" placeholder="disabled" value="" disabled />
      </label>
    <div class="keys-buttons">
        <button data-action="cancel" class="btn">Close</button>
        <button data-action="save" class="btn">Save</button>
      </div>
  <div class="keys-footnote">OpenAI and Anthropic are supported. Shortcuts: Enter — save; Esc — close.</div>
    </div>`
  backdrop.appendChild(panel)
  document.body.appendChild(backdrop)

  function saveFromInputs(){
    const inputs = panel.querySelectorAll('input[data-key]')
    const cur = loadApiKeys()
    inputs.forEach(inp=>{
      if(inp.disabled) return
      const key = inp.getAttribute('data-key')
      const v = (inp.value||'').trim()
      if(v){ cur[key] = v } else { delete cur[key] }
    })
    saveApiKeys(cur)
  }

  backdrop.addEventListener('click', e=>{ if(e.target===backdrop){ close() } })
  panel.addEventListener('click', e=>{
    const btn = e.target.closest('button[data-action]'); if(!btn) return
    if(btn.getAttribute('data-action')==='cancel'){ close(); return }
    if(btn.getAttribute('data-action')==='save'){ saveFromInputs(); return }
  })
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
      e.preventDefault();
      saveFromInputs();
    }
  })
  const modal = openModal({ modeManager: modeManager || window.__modeManager, root: backdrop, closeKeys:['Escape'], restoreMode:true, beforeClose:()=>{ onClose && onClose() } })
  const firstInput = panel.querySelector('input[data-key]')
  if(firstInput) firstInput.focus()
  function close(){ modal.close('manual') }
}

function escapeHtml(str){ return String(str).replace(/[&<>"']/g, s=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;' }[s])) }

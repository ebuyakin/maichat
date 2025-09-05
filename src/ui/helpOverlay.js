import { openModal } from '../shared/openModal.js'
export function openHelpOverlay({ onClose, modeManager }){
  const backdrop = document.createElement('div')
  backdrop.className = 'overlay-backdrop centered'
  const panel = document.createElement('div')
  panel.className = 'overlay-panel help-panel compact'
  panel.innerHTML = `
    <header>Help / Shortcuts</header>
    <div class="help-body">
      <section><strong>Modes:</strong> VIEW (default), INPUT, COMMAND. Mode indicator shows current mode.</section>
      <section><strong>Global:</strong><br/>Ctrl+I Input • Ctrl+D Command • Ctrl+V View • Ctrl+E Topic Editor • Ctrl+, Settings • Ctrl+T Topic Picker • Ctrl+M Model Selector (Input) • Ctrl+Shift+M Model Editor • Ctrl+. Menu • F1 Help</section>
      <section><strong>Navigation:</strong><br/>j / k (next/prev part) • g first • G last / newest reply tail • n newest reply head</section>
      <section><strong>Metadata:</strong><br/>* cycle star • 1/2/3 set star • Space clear star • a toggle include</section>
      <section><strong>Anchors:</strong> Shift+R cycle reading position (bottom / center / top)</section>
      <div class="help-hint">Esc closes • F1 toggles</div>
      <div class="help-buttons">
        <button class="btn" data-action="close">Close</button>
      </div>
    </div>`
  backdrop.appendChild(panel)
  document.body.appendChild(backdrop)
  const { close } = openModal({ modeManager, root: backdrop, closeKeys:['Escape','F1'], restoreMode:true, beforeClose:()=>{ onClose && onClose() }, preferredFocus:()=> panel.querySelector('button[data-action="close"]') })
  backdrop.addEventListener('click', e=>{ if(e.target===backdrop) close() })
  panel.addEventListener('click', e=>{ const btn = e.target.closest('button[data-action="close"]'); if(btn) close() })
}

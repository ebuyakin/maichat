// helpOverlay.js moved from ui/helpOverlay.js (Phase 6.6 Config)
// Restored original (moved from src/ui/helpOverlay.js) - path adjusted only.
import { openModal } from '../../shared/openModal.js'
export function openHelpOverlay({ onClose, modeManager }){
  const backdrop = document.createElement('div')
  backdrop.className = 'overlay-backdrop centered'
  const panel = document.createElement('div')
  panel.className = 'overlay-panel help-panel compact'
  panel.innerHTML = `
    <header>Help / Shortcuts</header>
    <div class="help-body">
      <div class="help-grid">
        <section class="help-col">
          <div class="help-title">Global</div>
          <div class="help-k">F1</div><div class="help-d">Open Help</div>
          <div class="help-k">Ctrl+.</div><div class="help-d">Toggle Menu</div>
          <div class="help-k">Ctrl+Shift+H</div><div class="help-d">Open Tutorial</div>
          <div class="help-k">Enter</div><div class="help-d">Switch to next mode</div>
          <div class="help-k">Esc</div><div class="help-d">Switch to previous mode</div>
          <div class="help-k">Ctrl+I</div><div class="help-d">Switch to Input Mode</div>
          <div class="help-k">Ctrl+D</div><div class="help-d">Switch to Command Mode</div>
          <div class="help-k">Ctrl+V</div><div class="help-d">Switch to View Mode</div>
          <div class="help-k">Ctrl+,</div><div class="help-d">Settings</div>
          <div class="help-k">Ctrl+Shift+T</div><div class="help-d">Topic Editor</div>
          <div class="help-k">Ctrl+Shift+M</div><div class="help-d">Model Editor</div>
          <div class="help-k">Ctrl+Shift+D</div><div class="help-d">Daily Stats</div>
          <div class="help-k">Ctrl+K</div><div class="help-d">API Keys</div>
        </section>
        <section class="help-col">
          <div class="help-title">Input Mode</div>
          <div class="help-k">Enter</div><div class="help-d">Send message</div>
          <div class="help-k">Esc</div><div class="help-d">Back to View Mode</div>
          <div class="help-k">Ctrl+U</div><div class="help-d">Clear to start</div>
          <div class="help-k">Ctrl+W</div><div class="help-d">Delete word left</div>
          <div class="help-k">Ctrl+M</div><div class="help-d">Model Selector</div>
          <div class="help-k">Ctrl+T</div><div class="help-d">Pick topic for next message</div>
        </section>
        <section class="help-col">
          <div class="help-title">View Mode</div>
          <div class="help-k">Enter</div><div class="help-d">Switch to Input Mode</div>
          <div class="help-k">Esc</div><div class="help-d">Switch to Command Mode</div>
          <div class="help-k">j / ArrowDown</div><div class="help-d">Move to next message part</div>
          <div class="help-k">k / ArrowUp</div><div class="help-d">Move to previous message part</div>
          <div class="help-k">g</div><div class="help-d">Move to first message part</div>
          <div class="help-k">G</div><div class="help-d">Move to last message part</div>
          <div class="help-k">o / Shift+O</div><div class="help-d">Jump to context boundary</div>
          <div class="help-k">r</div><div class="help-d">Toggle Reading Mode</div>
          <div class="help-k">1 / 2 / 3</div><div class="help-d">Set star rating of the message</div>
          <div class="help-k">Space</div><div class="help-d">Clear star rating</div>
          <div class="help-k">a</div><div class="help-d">Toggle color code</div>
          <div class="help-k">e</div><div class="help-d">Edit & resend (error row)</div>
          <div class="help-k">d</div><div class="help-d">Delete (error row)</div>
          <div class="help-k">Ctrl+T</div><div class="help-d">Change topic of active message</div>
        </section>
        <section class="help-col">
          <div class="help-title">Command Mode</div>
          <div class="help-k">Enter</div><div class="help-d">Apply command and switch to View Mode</div>
          <div class="help-k">Esc</div><div class="help-d">Clear input and switch to View Mode</div>
          <div class="help-k">Ctrl+P</div><div class="help-d">Previous command</div>
          <div class="help-k">Ctrl+N</div><div class="help-d">Next command</div>
          <div class="help-k">Ctrl+U</div><div class="help-d">Clear to start</div>
          <div class="help-k">Ctrl+W</div><div class="help-d">Delete word left</div>
        </section>
      </div>
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

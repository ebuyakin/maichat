export function openHelpOverlay({ onClose }){
  const backdrop = document.createElement('div')
  backdrop.className = 'overlay-backdrop centered'
  const panel = document.createElement('div')
  panel.className = 'overlay-panel help-panel compact'
  panel.innerHTML = `
    <header>Help / Shortcuts</header>
    <div style="padding:14px 18px 10px; display:flex; flex-direction:column; gap:12px; font-size:12px; line-height:1.5;">
      <div>
        <strong>Modes:</strong> VIEW (default), INPUT, COMMAND. Mode indicator shows current mode.
      </div>
      <div>
        <strong>Global:</strong><br/>
        Ctrl+I Input • Ctrl+D Command • Ctrl+V View • Ctrl+E Topic Editor • Ctrl+, Settings • Ctrl+T Topic Picker • Ctrl+. Menu • F1 Help
      </div>
      <div>
        <strong>Navigation:</strong><br/>
        j / k (next/prev part) • g first • G last / newest reply tail • n newest reply head
      </div>
      <div>
        <strong>Metadata:</strong><br/>
        * cycle star • 1/2/3 set star • Space clear star • a toggle include
      </div>
      <div>
        <strong>Anchors:</strong> Shift+R cycle reading position (bottom / center / top)
      </div>
      <div style="font-size:11px; opacity:.65;">Press Escape to close.</div>
      <div style="display:flex; justify-content:flex-end; gap:8px;">
        <button data-action="close">Close</button>
      </div>
    </div>`
  backdrop.appendChild(panel)
  document.body.appendChild(backdrop)
  backdrop.addEventListener('click', e=>{ if(e.target===backdrop) close() })
  panel.addEventListener('click', e=>{ const btn = e.target.closest('button[data-action="close"]'); if(btn) close() })
  window.addEventListener('keydown', escClose)
  function escClose(e){ if(e.key==='Escape'){ e.preventDefault(); close() } if(e.key==='F1'){ e.preventDefault(); close() } }
  function close(){ window.removeEventListener('keydown', escClose); backdrop.remove(); onClose && onClose() }
}

// helpOverlay.js moved from ui/helpOverlay.js (Phase 6.6 Config)
// Restored original (moved from src/ui/helpOverlay.js) - path adjusted only.
import { openModal } from '../../shared/openModal.js'
export function openHelpOverlay({ onClose, modeManager }) {
  const backdrop = document.createElement('div')
  backdrop.className = 'overlay-backdrop centered'
  const panel = document.createElement('div')
  panel.className = 'overlay-panel help-panel compact'
  
  let currentTab = 'shortcuts' // 'shortcuts' or 'filters'
  
  function renderContent() {
    if (currentTab === 'shortcuts') {
      return `
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
            <div class="help-k">Ctrl+;</div><div class="help-d">API Keys</div>
          </section>
          <section class="help-col">
            <div class="help-title">Input Mode</div>
            <div class="help-k">Enter</div><div class="help-d">Send message</div>
            <div class="help-k">Esc</div><div class="help-d">Back to View Mode</div>
            <div class="help-k">Ctrl+C</div><div class="help-d">Cancel pending request</div>
            <div class="help-k">Ctrl+A</div><div class="help-d">Start of line</div>
            <div class="help-k">Ctrl+E</div><div class="help-d">End of line</div>
            <div class="help-k">Ctrl+U</div><div class="help-d">Clear to start</div>
            <div class="help-k">Ctrl+W</div><div class="help-d">Delete word left</div>
            <div class="help-k">Ctrl+Shift+F</div><div class="help-d">Forward one word</div>
            <div class="help-k">Ctrl+Shift+B</div><div class="help-d">Backward one word</div>
            <div class="help-k">Ctrl+M</div><div class="help-d">Model Selector</div>
            <div class="help-k">Ctrl+T</div><div class="help-d">Topic picker (full tree)</div>
            <div class="help-k">Ctrl+P</div><div class="help-d">Recent topics picker</div>
            <div class="help-k">Ctrl+F</div><div class="help-d">Attach images (file picker)</div>
            <div class="help-k">Cmd/Ctrl+V</div><div class="help-d">Paste images from clipboard</div>
            <div class="help-k">Ctrl+Shift+O</div><div class="help-d">View draft images</div>
          </section>
          <section class="help-col">
            <div class="help-title">Command Mode</div>
            <div class="help-k">Enter</div><div class="help-d">Apply command and switch to View Mode</div>
            <div class="help-k">Esc</div><div class="help-d">Clear input and switch to View Mode</div>
            <div class="help-k">Ctrl+P</div><div class="help-d">Previous command</div>
            <div class="help-k">Ctrl+N</div><div class="help-d">Next command</div>
            <div class="help-k">Ctrl+A</div><div class="help-d">Start of line</div>
            <div class="help-k">Ctrl+E</div><div class="help-d">End of line</div>
            <div class="help-k">Ctrl+U</div><div class="help-d">Clear to start</div>
            <div class="help-k">Ctrl+W</div><div class="help-d">Delete word left</div>
            <div class="help-k">Ctrl+Shift+F</div><div class="help-d">Forward one word</div>
            <div class="help-k">Ctrl+Shift+B</div><div class="help-d">Backward one word</div>
          </section>
        </div>
        <div class="help-grid help-grid-view">
          <section class="help-col">
            <div class="help-title">View: Navigation</div>
            <div class="help-k">Enter</div><div class="help-d">Switch to Input Mode</div>
            <div class="help-k">Esc</div><div class="help-d">Switch to Command Mode</div>
            <div class="help-k">j / ArrowDown</div><div class="help-d">Scroll down</div>
            <div class="help-k">k / ArrowUp</div><div class="help-d">Scroll up</div>
            <div class="help-k">J</div><div class="help-d">Scroll down (big step)</div>
            <div class="help-k">K</div><div class="help-d">Scroll up (big step)</div>
            <div class="help-k">u</div><div class="help-d">Jump to previous message</div>
            <div class="help-k">d</div><div class="help-d">Jump to next message</div>
            <div class="help-k">U</div><div class="help-d">Scroll current message to top</div>
            <div class="help-k">g</div><div class="help-d">Move to first message part</div>
            <div class="help-k">G</div><div class="help-d">Move to last message part</div>
            <div class="help-k">o / O</div><div class="help-d">Jump to context boundary</div>
          </section>
          <section class="help-col">
            <div class="help-title">View: Actions</div>
            <div class="help-k">c / c1-9</div><div class="help-d">Copy code block(s)</div>
            <div class="help-k">y / y1-9</div><div class="help-d">Copy equation(s)</div>
            <div class="help-k">Y</div><div class="help-d">Copy entire message</div>
            <div class="help-k">v / v1-9</div><div class="help-d">View code in overlay</div>
            <div class="help-k">m / m1-9</div><div class="help-d">View equation in overlay</div>
            <div class="help-k">l</div><div class="help-d">Show link hints (1-9 to open)</div>
            <div class="help-k">Ctrl+Shift+S</div><div class="help-d">Open Sources overlay</div>
            <div class="help-k">i / i1-9</div><div class="help-d">View message images</div>
            <div class="help-k">Ctrl+T</div><div class="help-d">Topic picker (reassign)</div>
            <div class="help-k">e</div><div class="help-d">Edit & resend (error row)</div>
            <div class="help-k">w</div><div class="help-d">Delete (error row)</div>
          </section>
          <section class="help-col">
            <div class="help-title">View: Rating & Flags</div>
            <div class="help-k">1 / 2 / 3</div><div class="help-d">Set star rating</div>
            <div class="help-k">*</div><div class="help-d">Cycle star rating (0→1→2→3→0)</div>
            <div class="help-k">Space</div><div class="help-d">Clear star rating</div>
            <div class="help-k">a</div><div class="help-d">Toggle color flag</div>
          </section>
        </div>`
    } else {
      // Filters tab
      return `
        <div class="help-grid help-grid-filters">
          <section class="help-col">
            <div class="help-title">Topic Filters</div>
            <div class="help-k">t</div><div class="help-d">Current topic (all)</div>
            <div class="help-k">t10</div><div class="help-d">Current topic (last 10 messages)</div>
            <div class="help-k">t'My topic'</div><div class="help-d">All messages from My topic</div>
            <div class="help-k">t'My topic...'</div><div class="help-d">My topic and its children</div>
            <div class="help-k">t'*learning'</div><div class="help-d">Wild card (topic ending with "learning")</div>
            
            <div class="help-title" style="margin-top:12px;">Date Filters</div>
            <div class="help-k">d&lt;7</div><div class="help-d">Last 7 days</div>
            <div class="help-k">d&lt;3h</div><div class="help-d">Last 3 hours</div>
            <div class="help-k">d25-10-11</div><div class="help-d">Messages on that date</div>
            <div class="help-k">d&gt;25-10-01 & d&lt;=25-10-10</div><div class="help-d">Specific date range</div>
            
            <div class="help-title" style="margin-top:12px;">Rating & Flags</div>
            <div class="help-k">s1</div><div class="help-d">Ranked 1 star</div>
            <div class="help-k">s&gt;2</div><div class="help-d">Ranked 2 stars and higher</div>
            <div class="help-k">b</div><div class="help-d">Messages with blue color marks</div>
            <div class="help-k">g</div><div class="help-d">Messages with grey color marks</div>
            
            <div class="help-title" style="margin-top:12px;">Model Filters</div>
            <div class="help-k">m'gpt-5-mini'</div><div class="help-d">Messages from specific model</div>
            <div class="help-k">m'gpt*'</div><div class="help-d">Messages from model start with "gpt"</div>
          </section>
          <section class="help-col">
            <div class="help-title">Content Search</div>
            <div class="help-k">c'python'</div><div class="help-d">Message contains word "python"</div>
            <div class="help-k">c'tomorrow*weather'</div><div class="help-d">Wild card search</div>
            <div class="help-k">c'tomorrow' + c'weather'</div><div class="help-d">Messages containing either word</div>
            
            <div class="help-title" style="margin-top:12px;">Recent Messages</div>
            <div class="help-k">r10</div><div class="help-d">10 recent messages (all topics)</div>
            
            <div class="help-title" style="margin-top:12px;">Combined Filters</div>
            <div class="help-k">t s2</div><div class="help-d">Current topic with 2 stars</div>
            <div class="help-k">t d&lt;3</div><div class="help-d">Current topic for the last 3 days</div>
            <div class="help-k">t + t'My topic'</div><div class="help-d">Current topic or "My topic"</div>
            <div class="help-k">d&lt;7 & s&gt;=2</div><div class="help-d">Recent important messages</div>
            <div class="help-k">(s3 | b) & d&lt;30</div><div class="help-d">3-star or flagged, recent</div>
            <div class="help-k">t'Work...' & (c'bug' | c'error')</div><div class="help-d">Work bugs/errors</div>
            <div class="help-k">(m'gpt*' | m'claude*') & s&gt;=2</div><div class="help-d">GPT or Claude, rated</div>
          </section>
        </div>`
    }
  }
  
  function updatePanel() {
    const body = panel.querySelector('.help-body')
    body.innerHTML = `
      <div class="help-tabs">
        <button class="help-tab ${currentTab === 'shortcuts' ? 'active' : ''}" data-tab="shortcuts">Shortcuts</button>
        <button class="help-tab ${currentTab === 'filters' ? 'active' : ''}" data-tab="filters">Filters</button>
        <div class="help-tab-hint">h / l or [ / ] to switch</div>
      </div>
      <div class="help-content">
        ${renderContent()}
      </div>
      <div class="help-buttons">
        <button class="btn" data-action="close">Close</button>
      </div>`
    
    // Ensure scroll position starts at top when switching tabs
    body.scrollTop = 0

    // Re-establish focus inside the overlay after re-render
    // Prefer the active tab button; fallback to Close button
    const activeTab = panel.querySelector('.help-tab.active')
    if (activeTab) {
      try { activeTab.focus({ preventScroll: true }) } catch {}
    } else {
      const closeBtn = panel.querySelector('button[data-action="close"]')
      if (closeBtn) {
        try { closeBtn.focus({ preventScroll: true }) } catch {}
      }
    }
  }
  
  panel.innerHTML = `
    <div class="help-body"></div>`
  
  updatePanel()
  
  backdrop.appendChild(panel)
  document.body.appendChild(backdrop)
  
  // Key handling on panel (bubble phase), consistent with other overlays
  panel.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return
    // h / [ => Shortcuts tab
    if (e.key === 'h' || e.key === '[') {
      e.preventDefault()
      e.stopPropagation()
      e.stopImmediatePropagation()
      if (currentTab !== 'shortcuts') {
        currentTab = 'shortcuts'
        updatePanel()
      }
      return
    }
    // l / ] => Filters tab
    if (e.key === 'l' || e.key === ']') {
      e.preventDefault()
      e.stopPropagation()
      e.stopImmediatePropagation()
      if (currentTab !== 'filters') {
        currentTab = 'filters'
        updatePanel()
      }
      return
    }
  })
  
  const { close } = openModal({
    modeManager,
    root: backdrop,
    closeKeys: ['Escape', 'F1'],
    restoreMode: true,
    beforeClose: () => {
      onClose && onClose()
    },
    preferredFocus: () => panel.querySelector('button[data-action="close"]'),
  })
  
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) close()
  })
  
  panel.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action="close"]')
    if (btn) {
      close()
      return
    }
    
    // Tab button clicks
    const tabBtn = e.target.closest('.help-tab')
    if (tabBtn) {
      const tab = tabBtn.dataset.tab
      if (tab && tab !== currentTab) {
        currentTab = tab
        updatePanel()
      }
    }
  })
}


// appTemplate.js
// Builds the initial app HTML with pre-loaded state to enable single-paint rendering.
// Extracted from main.js to keep orchestration logic separate from template generation.

/**
 * Escape HTML for text node content (textarea, etc.)
 * @param {string} str - Text to escape
 * @returns {string} Escaped text safe for HTML text nodes
 */
function escapeHtmlForTextNode(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/**
 * Build the complete app HTML structure with pre-loaded values
 * @param {Object} state - Pre-loaded application state
 * @param {string} state.draftText - Draft message text
 * @param {number} state.attachCount - Number of attached images
 * @param {string} state.pendingModel - Selected model name
 * @param {string} state.pendingTopic - Selected topic path
 * @param {number} state.messageCount - Total message pairs count
 * @param {string} state.messagePosition - Current position (e.g., '-' or '5')
 * @returns {string} Complete HTML for app container
 */
export function buildAppHTML({
  draftText = '',
  attachCount = 0,
  pendingModel = '',
  pendingTopic = '',
  messageCount = 0,
  messagePosition = '-',
}) {
  const draftTextEscaped = escapeHtmlForTextNode(draftText)
  const attachIndicatorStyle = attachCount === 0 ? 'display:none' : 'display:inline-flex'
  const attachAria =
    attachCount === 0
      ? 'No images attached'
      : attachCount === 1
      ? '1 image attached'
      : `${attachCount} images attached`
  const attachCountText = attachCount > 1 ? String(attachCount) : ''

  return `
  <div id="topBar" class="zone" data-mode="command">
    <div id="commandWrapper">
      <input id="commandInput" placeholder="filter:command" autocomplete="off"
             spellcheck="false" autocorrect="off" autocapitalize="off"
             data-gramm="false" data-gramm_editor="false" data-lt-active="false" />
    </div>
    <div id="statusRight">
      <span id="commandError"></span>
      <span id="messagePosition" title="Current message position" class="mc">${messagePosition}</span>
      <span id="messageCount" title="Visible message pairs" class="mc">${messageCount}</span>
      <button id="appMenuBtn" aria-haspopup="true" aria-expanded="false" title="Menu (Ctrl+.)" class="menu-btn" tabindex="0">⋮</button>
      <div id="appMenu" class="app-menu" hidden>
        <ul>
          <li data-action="topic-editor"><span class="label">Topic Editor</span><span class="hint">Ctrl+Shift+T</span></li>
          <li data-action="model-editor"><span class="label">Model Editor</span><span class="hint">Ctrl+Shift+M</span></li>
          <li data-action="daily-stats"><span class="label">Activity Stats</span><span class="hint">Ctrl+Shift+D</span></li>
          <li data-action="settings"><span class="label">Settings</span><span class="hint">Ctrl+,</span></li>
          <li data-action="api-keys"><span class="label">API Keys</span><span class="hint">Ctrl+;</span></li>
          <li data-action="tutorial"><span class="label">Tutorial</span><span class="hint">Ctrl+Shift+H</span></li>
          <li data-action="help"><span class="label">Help</span><span class="hint">F1</span></li>
        </ul>
      </div>
    </div>
  </div>
  <div id="historyPane" class="zone" data-mode="view">
    <div class="gradientOverlayTop"></div>
    <div id="history" class="history"></div>
    <div class="gradientOverlayBottom"></div>
  </div>
  <div id="inputBar" class="zone" data-mode="input">
    <div class="inputBar-inner">
      <div class="row first">
        <textarea id="inputField" placeholder="Type message... (Enter to send)" autocomplete="off" rows="2">${draftTextEscaped}</textarea>
      </div>
      <div class="row second">
        <div class="input-meta-left">
          <div id="modeIndicator" class="mode-label"></div>
          <span id="pendingModel" title="Model • Ctrl+M">${escapeHtmlForTextNode(pendingModel)}</span>
          <span id="pendingTopic" title="Topic • Ctrl+T">${escapeHtmlForTextNode(pendingTopic)}</span>
        </div>
        <div class="input-meta-right">
          <span id="attachIndicator" class="attach-indicator" ${attachCount === 0 ? 'hidden' : ''} data-action="view-draft-images" role="button" tabindex="0" title="Attached images • Ctrl+Shift+O • Click to view" aria-label="${attachAria}" style="${attachIndicatorStyle}">
            <span class="icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3.5" y="5.5" width="17" height="13" rx="2" ry="2"></rect>
                <path d="M7 15l4-4 3.5 3.5 2-2 3 3" />
                <circle cx="9.5" cy="9" r="1.2" />
              </svg>
            </span>
            <span id="attachCount">${attachCountText}</span>
          </span>
          <button id="sendBtn" disabled>Send</button>
          <input id="attachFileInput" type="file" accept="image/*" multiple hidden />
        </div>
      </div>
    </div>
  </div>
`
}

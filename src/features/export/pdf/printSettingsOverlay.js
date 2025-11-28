// PDF Export Settings Overlay
import { openModal } from '../../../shared/openModal.js'
import { getSettings, saveSettings } from '../../../core/settings/index.js'
import { generatePrintView, openAndPrint } from './printView.js'

export function openPrintSettingsOverlay({ store, activeParts, modeManager }) {
  // Load saved preferences
  const saved = getSettings().pdfExportSettings || {}
  
  // Default settings
  const defaults = {
    fontSize: '11pt',
    codeFontSize: '9pt',
    lineSpacing: '1.6',
    orientation: 'portrait',
    includeTopicName: true,
    includeDate: true,
    includeCount: true,
    customTitle: '',
    autoOpenPrint: false,
    rememberSettings: true
  }
  
  const settings = { ...defaults, ...saved }
  
  const root = document.createElement('div')
  root.className = 'overlay-backdrop centered'
  root.innerHTML = `
    <div class="overlay-panel pdf-export-panel" style="width:500px;max-width:90vw;">
      <header>Export to PDF</header>
      
      <div class="pdf-settings-body">
        
        <section class="pdf-section">
          <h3 class="section-title">Typography</h3>
          <div class="form-group">
            <label>Font size:</label>
            <select class="pdf-font-size">
              <option value="10pt">10pt</option>
              <option value="11pt">11pt</option>
              <option value="12pt">12pt</option>
            </select>
          </div>
          <div class="form-group">
            <label>Code font size:</label>
            <select class="pdf-code-font-size">
              <option value="8pt">8pt</option>
              <option value="9pt">9pt</option>
              <option value="10pt">10pt</option>
            </select>
          </div>
          <div class="form-group">
            <label>Line spacing:</label>
            <select class="pdf-line-spacing">
              <option value="1.4">1.4</option>
              <option value="1.6">1.6</option>
              <option value="1.8">1.8</option>
            </select>
          </div>
        </section>
        
        <section class="pdf-section">
          <h3 class="section-title">Format</h3>
          <div class="form-group">
            <label>Page: A4</label>
          </div>
          <div class="form-group">
            <label><input type="radio" name="orientation" value="portrait"> Portrait</label>
          </div>
          <div class="form-group">
            <label><input type="radio" name="orientation" value="landscape"> Landscape</label>
          </div>
        </section>
        
        <section class="pdf-section">
          <h3 class="section-title">Document Header</h3>
          <div class="form-group">
            <label><input type="checkbox" class="pdf-include-topic"> Include topic name</label>
          </div>
          <div class="form-group">
            <label><input type="checkbox" class="pdf-include-date"> Include export date</label>
          </div>
          <div class="form-group">
            <label><input type="checkbox" class="pdf-include-count"> Include message count</label>
          </div>
          <div class="form-group">
            <label>Custom title (optional):</label>
            <input type="text" class="pdf-custom-title" placeholder="Leave blank to use topic name">
          </div>
        </section>
        
        <section class="pdf-section">
          <h3 class="section-title">Behavior</h3>
          <div class="form-group">
            <label><input type="checkbox" class="pdf-auto-print"> Auto-open print dialog</label>
          </div>
          <div class="form-group">
            <label><input type="checkbox" class="pdf-remember"> Remember my preferences</label>
          </div>
        </section>
        
      </div>
      
      <div class="buttons">
        <button class="btn btn-primary" data-action="generate">Generate & Print (Enter)</button>
        <button class="btn" data-action="close">Cancel (Escape)</button>
      </div>
    </div>
  `
  
  const panel = root.querySelector('.overlay-panel')
  
  // Initialize modal for proper close behavior
  const modal = openModal({
    modeManager,
    root,
    closeKeys: ['Escape'],
    restoreMode: true
  })
  
  // Enter key triggers Generate & Print
  root.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
      // Don't trigger if user is typing in text input
      if (e.target.tagName === 'INPUT' && e.target.type === 'text') return
      e.preventDefault()
      root.querySelector('[data-action="generate"]').click()
    }
  })
  
  // Set initial values from settings
  root.querySelector('.pdf-font-size').value = settings.fontSize
  root.querySelector('.pdf-code-font-size').value = settings.codeFontSize
  root.querySelector('.pdf-line-spacing').value = settings.lineSpacing
  root.querySelector(`input[name="orientation"][value="${settings.orientation}"]`).checked = true
  root.querySelector('.pdf-include-topic').checked = settings.includeTopicName
  root.querySelector('.pdf-include-date').checked = settings.includeDate
  root.querySelector('.pdf-include-count').checked = settings.includeCount
  root.querySelector('.pdf-custom-title').value = settings.customTitle
  root.querySelector('.pdf-auto-print').checked = settings.autoOpenPrint
  root.querySelector('.pdf-remember').checked = settings.rememberSettings
  
  // Button handlers
  panel.addEventListener('click', (e) => {
    const action = e.target.dataset.action
    
    if (action === 'generate') {
      // Collect form values
      const options = {
        fontSize: root.querySelector('.pdf-font-size').value,
        codeFontSize: root.querySelector('.pdf-code-font-size').value,
        lineSpacing: root.querySelector('.pdf-line-spacing').value,
        orientation: root.querySelector('input[name="orientation"]:checked').value,
        includeTopicName: root.querySelector('.pdf-include-topic').checked,
        includeDate: root.querySelector('.pdf-include-date').checked,
        includeCount: root.querySelector('.pdf-include-count').checked,
        customTitle: root.querySelector('.pdf-custom-title').value.trim(),
        autoOpenPrint: root.querySelector('.pdf-auto-print').checked,
        rememberSettings: root.querySelector('.pdf-remember').checked
      }
      
      // Save settings if requested
      if (options.rememberSettings) {
        saveSettings({ pdfExportSettings: options })
      }
      
      // Generate HTML and open print view
      const htmlContent = generatePrintView({ store, activeParts, options })
      openAndPrint(htmlContent, options.autoOpenPrint)
      
      modal.close('manual')
    } else if (action === 'close') {
      modal.close('manual')
    }
  })
  
  document.body.appendChild(root)
  
  // Focus the panel to ensure Escape key works
  const firstInput = root.querySelector('select, input')
  if (firstInput) {
    setTimeout(() => firstInput.focus(), 0)
  }
  
  return { close: () => modal.close('manual') }
}

// Basic code overlay for Phase 2
// Single frame display with syntax highlighting placeholder

import { openModal } from '../../shared/openModal.js'

export function createCodeOverlay({ modeManager }) {
  let backdrop = null;
  let panel = null;
  let modalHandle = null;
  let currentBlock = null;

  function renderPanel(codeBlock){
    if(!panel) return;
    const highlighted = highlightCode(codeBlock.code, codeBlock.language);
    panel.innerHTML = `
      <div class="code-overlay-header">
        <div class="code-overlay-title">
          Code: ${codeBlock.language}
          <span class="code-overlay-subtitle">${codeBlock.lineCount} lines</span>
        </div>
        <button class="code-overlay-close" title="Close (Esc)">×</button>
      </div>
      <div class="code-overlay-content">
        <pre class="code-overlay-pre" tabindex="0"><code class="code-overlay-code">${highlighted}</code></pre>
      </div>
      <div class="code-overlay-footer">
        <button class="btn code-copy-btn" title="Copy code (c or Ctrl+C)">Copy (or press c)</button>
      </div>
    `;
    const closeBtn = panel.querySelector('.code-overlay-close');
    if(closeBtn){ closeBtn.addEventListener('click', ()=> close('button')) }
    const copyBtn = panel.querySelector('.code-copy-btn');
    if(copyBtn){ copyBtn.addEventListener('click', ()=> copyToClipboard(codeBlock.code)) }
  }

  function show(codeBlock, messagePair){
    if(!codeBlock) return;
    // If already open, just update content
    if(modalHandle){
      currentBlock = codeBlock;
      renderPanel(codeBlock);
      focusCode();
      return;
    }
    currentBlock = codeBlock;
    backdrop = document.createElement('div');
    backdrop.className = 'code-overlay-backdrop';
    panel = document.createElement('div');
    panel.className = 'code-overlay';
    backdrop.appendChild(panel);
    document.body.appendChild(backdrop);
    renderPanel(codeBlock);
    // Click outside panel closes
    backdrop.addEventListener('mousedown', (e)=>{ if(e.target===backdrop) close('backdrop') });
    modalHandle = openModal({
      modeManager,
      root: backdrop, // IMPORTANT: backdrop is now the modal root (Option A)
      preferredFocus: ()=> panel.querySelector('.code-overlay-pre') || panel,
      closeKeys:['Escape'],
      restoreMode:true,
      blockPolicy:{ keys:true, pointer:true, wheel:true },
      beforeClose: ()=> {
        // Cleanup references so GC can reclaim
        currentBlock = null;
        panel = null;
        backdrop = null;
        modalHandle = null;
      }
    });
    // Add copy shortcut inside panel
    panel.addEventListener('keydown', (e)=>{
      if((e.ctrlKey||e.metaKey) && e.key==='c'){
        const codeEl = panel.querySelector('.code-overlay-code');
        if(codeEl){ copyToClipboard(codeEl.textContent); e.preventDefault() }
      } else if(!e.ctrlKey && !e.metaKey && !e.altKey && e.key==='c'){
        const codeEl = panel.querySelector('.code-overlay-code');
        if(codeEl){ copyToClipboard(codeEl.textContent); e.preventDefault() }
      }
    }, true);
    focusCode();
    console.log('[CodeOverlay] Opened modal for block:', codeBlock.language);
  }

  function focusCode(){
    try { const el = panel && panel.querySelector('.code-overlay-pre'); if(el) el.focus() } catch {}
  }

  function close(trigger){
    if(!modalHandle){ return }
    try { modalHandle.close(trigger) } catch {}
    // beforeClose hook handles nulling references
    console.log('[CodeOverlay] Closed');
  }

  function isVisible(){ return !!modalHandle }

  function copyToClipboard(text){
    if(!text) return;
    if(navigator.clipboard){
      navigator.clipboard.writeText(text).catch(err=> console.error('[CodeOverlay] Copy failed', err));
    } else {
      const ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select(); try{ document.execCommand('copy') }catch{}; document.body.removeChild(ta);
    }
  }

  return { show, close, isVisible };
}

// Simple HTML escaping helper
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Lightweight tokenizer-based highlighter (best-effort, not full language support)
function highlightCode(code, lang){
  if(!code) return '';
  const safe = escapeHtml(code);
  const l = (lang||'').toLowerCase();
  try {
    if(l==='json') return highlightJson(safe);
    if(l==='python' || l==='py') return highlightGeneric(safe, PY_KEYWORDS);
    if(l==='javascript' || l==='js' || l==='ts' || l==='typescript') return highlightGeneric(safe, JS_KEYWORDS);
    if(l==='bash' || l==='sh' || l==='shell') return highlightShell(safe);
    return safe; // fallback plain
  } catch { return safe }
}

function wrap(tok, cls){ return `<span class="tok-${cls}">${tok}</span>` }

const JS_KEYWORDS = new Set('import export from const let var function return if else for while do switch case break continue try catch finally throw new class extends super this typeof instanceof in delete void await async yield static get set of'.split(/\s+/));
const PY_KEYWORDS = new Set('def return if elif else for while break continue class pass import from as try except finally raise with lambda yield global nonlocal assert True False None and or not is in'.split(/\s+/));
const SHELL_BUILTINS = new Set('echo cd ls cat grep find mkdir rm rmdir mv cp touch chmod chown export source alias unalias pwd which head tail sed awk kill'.split(/\s+/));

function highlightGeneric(html, keywordSet){
  // Very naive: split on word boundaries, re-wrap
  return html.replace(/\b([A-Za-z_][A-Za-z0-9_]*)\b/g, (m, w)=> keywordSet.has(w) ? wrap(w,'kw') : w)
    .replace(/(\d+)(?![^<]*>)/g, (m)=> wrap(m,'num'))
    .replace(/(&quot;.*?&quot;|'.*?')/g, (m)=> wrap(m,'str'))
}

function highlightJson(html){
  return html
    .replace(/(&quot;.*?&quot;)(\s*:\s*)/g, (m,k,sep)=> wrap(k,'key')+sep)
    .replace(/(:\s*)(&quot;.*?&quot;)/g, (m,pre,val)=> pre+wrap(val,'str'))
    .replace(/(:\s*)(-?\d+(?:\.\d+)?)/g, (m,pre,num)=> pre+wrap(num,'num'))
    .replace(/\b(true|false|null)\b/g, (m)=> wrap(m,'kw'))
}

function highlightShell(html){
  return html.replace(/\b([A-Za-z_][A-Za-z0-9_-]*)\b/g, (m,w)=> SHELL_BUILTINS.has(w) ? wrap(w,'kw') : w)
    .replace(/(#.*?)(?=\n|$)/g, (m)=> wrap(m,'com'))
}
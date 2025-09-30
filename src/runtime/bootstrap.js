// runtime/bootstrap.js (Step 7)
// Orchestrates startup sequence: provider registration, persistence init, model catalog load,
// spacing styles, optional seeding, first render, loading overlay removal, and beforeunload flush.
// ZERO behavioral changes.

import { registerProvider } from '../infrastructure/provider/adapter.js'
import { createOpenAIAdapter } from '../infrastructure/provider/openaiAdapter.js'
import { createAnthropicAdapter } from '../infrastructure/provider/anthropicAdapter.js'
import { ensureCatalogLoaded } from '../core/models/modelCatalog.js'
import { runInitialSeeding, shouldRunInitialSeeding } from './initialSeeding.js'
import { getSettings } from '../core/settings/index.js'
import { getApiKey } from '../infrastructure/api/keys.js'
import { openApiKeysOverlay } from '../features/config/apiKeysOverlay.js'

/**
 * Bootstrap the application.
 * @param {Object} opts
 * @param {Object} opts.ctx runtime context from initRuntime()
 * @param {Object} opts.historyRuntime history runtime API
 * @param {Object} opts.interaction interaction module API
 * @param {HTMLElement} opts.loadingEl overlay element to remove when ready
 */
export async function bootstrap({ ctx, historyRuntime, interaction, loadingEl }){
  const { store, persistence, pendingMessageMeta } = ctx
  const { applySpacingStyles, renderCurrentView, applyActiveMessage, renderStatus, layoutHistoryPane } = historyRuntime

  registerProvider('openai', createOpenAIAdapter())
  registerProvider('anthropic', createAnthropicAdapter())
  await persistence.init()
  ensureCatalogLoaded()
  applySpacingStyles(getSettings())

  // Restore persisted pending topic if available
  try {
    const savedPending = localStorage.getItem('maichat_pending_topic')
    if(savedPending && store.topics.has(savedPending)) pendingMessageMeta.topicId = savedPending
  } catch{}

  // One-time onboarding seeding (replaces demo seeding)
  try { if(shouldRunInitialSeeding(store)) runInitialSeeding({ store }) } catch {}

  renderCurrentView()
  renderStatus()
  // Start focused at the last (newest) part on first load
  try { ctx.activeParts && ctx.activeParts.last && ctx.activeParts.last() } catch{}
  applyActiveMessage()
  // One-shot alignment on open: bottom-align last assistant if present; else bottom-align last meta
  try {
    const sc = ctx.scrollController
    const ap = ctx.activeParts
    if(sc && ap && Array.isArray(ap.parts) && ap.parts.length){
      requestAnimationFrame(()=>{
        // Check if the LAST MESSAGE (last pair) has an assistant part
        const tail = ap.parts[ap.parts.length-1]
        const lastPairId = tail && tail.pairId
        
        // Find assistant parts that belong to the last pair only
        let lastMessageAssistant = null
        for(let i=ap.parts.length-1; i>=0; i--){
          const p = ap.parts[i]
          if(p && p.pairId === lastPairId && p.role === 'assistant'){ 
            lastMessageAssistant = p; 
            break 
          }
        }
        
        if(lastMessageAssistant && sc.alignTo){ 
          sc.alignTo(lastMessageAssistant.id, 'bottom', false) 
        }
        else {
          if(lastPairId && sc.alignTo){ 
            // If no assistant yet, align to the last user message of that pair
            sc.alignTo(`${lastPairId}:user`, 'bottom', false) 
          }
        }
      })
    }
  } catch {}

  if(!pendingMessageMeta.topicId){
    // Prefer 'General talk' if present on first load; else root
    try {
      const match = Array.from(store.topics.values()).find(t=> t.parentId===store.rootTopicId && t.name==='General talk')
      pendingMessageMeta.topicId = match ? match.id : store.rootTopicId
    } catch { pendingMessageMeta.topicId = store.rootTopicId }
  }
  try { localStorage.setItem('maichat_pending_topic', pendingMessageMeta.topicId) } catch{}

  interaction.renderPendingMeta()
  layoutHistoryPane()

  if(loadingEl) loadingEl.remove()

  // Startup: if no OpenAI key present, open API Keys overlay automatically
  try {
    const hasOpenAI = typeof getApiKey === 'function' ? !!getApiKey('openai') : false
    if(!hasOpenAI){
      setTimeout(()=>{ try { openApiKeysOverlay({ onClose:()=>{} }) } catch {} }, 80)
    }
  } catch {}

  // Flush pending writes on unload (moved from main.js)
  window.addEventListener('beforeunload', ()=>{ if(persistence && persistence.flush) persistence.flush() })
}

// keyRouter.js moved from ui/keyRouter.js (Phase 6.2 Interaction)
export class KeyRouter {
  constructor({ modeManager, handlers }){ this.modeManager=modeManager; this.handlers=handlers; this.bound=this._onKey.bind(this) }
  attach(){ window.addEventListener('keydown', this.bound, false) }
  detach(){ window.removeEventListener('keydown', this.bound, false) }
  _onKey(e){
    if(document.querySelector('.topic-editor-backdrop, .topic-picker-backdrop, #settingsOverlayRoot, .overlay-backdrop.centered, .app-menu:not([hidden])')) return
    const tag = e.target && e.target.tagName
    if(tag==='INPUT' || tag==='TEXTAREA'){
      const mode = this.modeManager.mode
      if(mode==='view'){} else {
        const intercept = e.key==='Enter' || e.key==='Escape' || e.ctrlKey
        if(!intercept) return
      }
    }
    const handler = this.handlers[this.modeManager.mode]
    if(handler && handler(e)===true) e.preventDefault()
  }
}
export function createKeyRouter(opts){ return new KeyRouter(opts) }

// KeyRouter: global key handler dispatching by mode

export class KeyRouter {
  /** @param {object} opts */
  constructor({ modeManager, handlers }){
    this.modeManager = modeManager
    this.handlers = handlers // { mode: (event)=>boolean }
    this.bound = this._onKey.bind(this)
  }
  attach(){ window.addEventListener('keydown', this.bound, true) }
  detach(){ window.removeEventListener('keydown', this.bound, true) }
  _onKey(e){
  // If modal overlays active, skip (they handle their own key logic)
  if(document.querySelector('.topic-editor-backdrop, .topic-picker-backdrop')) return
    // ignore if in text input unless command mode uses raw keys
    const tag = e.target && e.target.tagName
    if(tag === 'INPUT' || tag === 'TEXTAREA'){
      const mode = this.modeManager.mode
      if(mode === 'view'){
        // Fall through to allow navigation keys even if focus somehow in input
      } else {
        // In INPUT or COMMAND: only intercept control/navigation keys we care about
        const intercept = e.key === 'Enter' || e.key === 'Escape' || e.ctrlKey
        if(!intercept) return
      }
    }
    const handler = this.handlers[this.modeManager.mode]
    if(handler && handler(e) === true){ e.preventDefault() }
  }
}

export function createKeyRouter(opts){ return new KeyRouter(opts) }
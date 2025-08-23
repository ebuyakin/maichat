// Mode state machine: input, view, command

export const MODES = Object.freeze({ INPUT:'input', VIEW:'view', COMMAND:'command' })

export class ModeManager {
  constructor(){
    this.mode = MODES.VIEW
    this.listeners = []
  }
  set(mode){
    if(this.mode === mode) return
    this.mode = mode
    this.listeners.forEach(l=>l(mode))
  }
  onChange(fn){ this.listeners.push(fn); return ()=>{ this.listeners = this.listeners.filter(f=>f!==fn) } }
}

export function createModeManager(){ return new ModeManager() }
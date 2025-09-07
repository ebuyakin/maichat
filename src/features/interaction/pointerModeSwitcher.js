// Minimal, testable installer for pointer-driven mode switching
export function installPointerModeSwitcher({ modeManager, isModalActiveFn }){
  if(!modeManager) throw new Error('installPointerModeSwitcher: modeManager required')
  const isModal = typeof isModalActiveFn === 'function' ? isModalActiveFn : (()=> (window.modalIsActive && window.modalIsActive()) )
  function onPointerDown(e){
    try{
      if(isModal()) return
      const zone = e.target && e.target.closest && e.target.closest('[data-mode]')
      if(!zone) return
      const m = zone.getAttribute('data-mode')
      if(m && modeManager.mode !== m){ modeManager.set(m) }
    }catch{}
  }
  document.addEventListener('pointerdown', onPointerDown, true)
  return ()=> document.removeEventListener('pointerdown', onPointerDown, true)
}

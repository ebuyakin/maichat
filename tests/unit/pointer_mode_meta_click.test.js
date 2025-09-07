/* @vitest-environment jsdom */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ModeManager } from '../../src/features/interaction/modes.js'
import { installPointerModeSwitcher } from '../../src/features/interaction/pointerModeSwitcher.js'

// Utility to create a minimal DOM structure
function setupDom(){
  document.body.innerHTML = `
    <div id="topBar" data-mode="command"></div>
    <div id="historyPane" data-mode="view">
      <div id="history" class="history">
        <div class="part user" data-part-id="u1" data-role="user"><div class="part-inner">U1</div></div>
        <div class="part meta" data-part-id="m1" data-role="meta"><div class="part-inner"><button class="btn" id="metaBtn">MetaBtn</button></div></div>
        <div class="part assistant" data-part-id="a1" data-role="assistant"><div class="part-inner">A1</div></div>
      </div>
    </div>
    <div id="inputBar" data-mode="input"></div>
  `
}

describe('Pointer mode switcher and meta click behavior', ()=>{
  beforeEach(()=>{ setupDom() })

  it('switches mode on pointerdown to zone with data-mode', ()=>{
    const mm = new ModeManager()
    mm.set('view')
    const dispose = installPointerModeSwitcher({ modeManager: mm, isModalActiveFn: ()=> false })
    const inputBar = document.getElementById('inputBar')
    const evt = new Event('pointerdown', { bubbles:true })
    inputBar.dispatchEvent(evt)
    expect(mm.mode).toBe('input')
    dispose()
  })

  it('does not switch mode when modal is active', ()=>{
    const mm = new ModeManager()
    mm.set('view')
    const dispose = installPointerModeSwitcher({ modeManager: mm, isModalActiveFn: ()=> true })
    const inputBar = document.getElementById('inputBar')
  const evt = new Event('pointerdown', { bubbles:true })
    inputBar.dispatchEvent(evt)
    expect(mm.mode).toBe('view')
    dispose()
  })

  it('clicking meta part does not change active selection; button inside meta does not change selection either', ()=>{
    // Simulate interaction.js selection handler minimal logic
    const selected = { id: null }
    document.addEventListener('click', e=>{
      const partEl = e.target.closest('.part'); if(!partEl) return
      if(partEl.getAttribute('data-role') === 'meta'){
        const t = e.target
        const tag = t && t.tagName ? t.tagName.toLowerCase() : ''
        const isInteractive = tag==='button' || tag==='a' || tag==='input' || tag==='textarea' || t.getAttribute('role')==='button' || t.isContentEditable
        if(isInteractive){ return }
        return
      }
      selected.id = partEl.getAttribute('data-part-id')
    })

    // Click user part -> selects u1
    document.querySelector('.part.user').dispatchEvent(new MouseEvent('click', { bubbles:true }))
    expect(selected.id).toBe('u1')

    // Click meta surface -> selection unchanged
    document.querySelector('.part.meta .part-inner').dispatchEvent(new MouseEvent('click', { bubbles:true }))
    expect(selected.id).toBe('u1')

    // Click button inside meta -> still unchanged
    document.getElementById('metaBtn').dispatchEvent(new MouseEvent('click', { bubbles:true }))
    expect(selected.id).toBe('u1')

    // Click assistant part -> selects a1
    document.querySelector('.part.assistant').dispatchEvent(new MouseEvent('click', { bubbles:true }))
    expect(selected.id).toBe('a1')
  })
})

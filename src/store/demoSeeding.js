// demoSeeding.js (Phase 1 Step 2)
// Demo / test dataset generation utilities extracted from main.js
// Provides: seedDemoPairs, buildWordCountDataset, baseLoremWords, window reseed helpers

import { getSettings } from '../core/settings/index.js'

// baseLoremWords kept deterministic for repeatable dataset
export function baseLoremWords(){
  return `lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua ut enim ad minim veniam quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur excepteur sint occaecat cupidatat non proident sunt in culpa qui officia deserunt mollit anim id est laborum professional workflow architecture partition anchor context management hierarchical topics adaptive strict token estimation performance optimization deterministic stable id navigation focus management experimental feature toggle granular measurement responsive viewport fraction test dataset generation`.split(/\s+/)
}

export function buildWordCountDataset(){
  const sizes = []
  for(let w=100; w<=1000; w+=50){ sizes.push(w) }
  const loremWords = baseLoremWords()
  function makeText(wordCount){
    const words = []
    while(words.length < wordCount){ words.push(loremWords[words.length % loremWords.length]) }
    const textBody = words.join(' ')
    const chars = textBody.length
    return `[${wordCount} words | ${chars} chars]\n` + textBody
  }
  const dataset = []
  sizes.forEach(sz=>{ for(let i=0;i<2;i++){ dataset.push({ model:(sz%2?'gpt':'claude'), user:makeText(sz), assistant:makeText(sz) }) } })
  return dataset
}

export function seedDemoPairs(store){
  if(!store) return
  const topicId = store.rootTopicId
  const data = buildWordCountDataset()
  const starCycle = [0,1,2,3]
  data.forEach((d,i)=>{
    const id = store.addMessagePair({ topicId, model:d.model, userText:d.user, assistantText:d.assistant })
    const pair = store.pairs.get(id)
    pair.star = starCycle[i % starCycle.length]
    if(i===2) pair.colorFlag = 'g'
  })
}

// Development helpers exposed via window for parity with previous behavior.
export function exposeSeedingHelpers(store, renderCurrentView, activeParts, applyActivePart){
  window.seedTestMessages = function(){
    store.pairs.clear()
    seedDemoPairs(store)
    renderCurrentView && renderCurrentView()
    if(activeParts){ activeParts.first && activeParts.first(); applyActivePart && applyActivePart() }
    console.log('Test messages reseeded.')
  }
  window.generateWordCountDataset = function(){
    console.time('generateWordCountDataset')
    const topicId = store.rootTopicId
    store.pairs.clear()
    const data = buildWordCountDataset()
    data.forEach(d=> store.addMessagePair({ topicId, model:d.model, userText:d.user, assistantText:d.assistant }))
    renderCurrentView && renderCurrentView()
    if(activeParts){ activeParts.first && activeParts.first(); applyActivePart && applyActivePart() }
    console.timeEnd('generateWordCountDataset')
    console.log('Generated', data.length, 'pairs for sizes 100..1000 (x2 each).')
  }
}

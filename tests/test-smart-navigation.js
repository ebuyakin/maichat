// Minimal simulation of the smart v / vN logic without DOM
// We'll simulate the core branch conditions extracted from interaction.js modifications.

function simulate(keys, codeBlocksLength){
  let opened = []
  let pending = null
  for(const k of keys){
    if(k==='v'){
      if(codeBlocksLength===0){ /* no-op */ }
      else if(codeBlocksLength===1){ opened.push(0) }
      else { pending = { ts: Date.now(), pairId:'x'} }
    } else if(/^[1-9]$/.test(k)){
      if(pending && codeBlocksLength>1){
        const idx = parseInt(k,10)-1
        if(idx < codeBlocksLength) opened.push(idx)
        pending = null
      } else {
        // would be interpreted as star rating in real app; ignore here
      }
    } else if(k==='X'){
      // simulate other key clears pending
      pending = null
    }
  }
  return opened
}

console.log('Single block scenario: v => [0] expected:', simulate(['v'],1))
console.log('Multi block scenario: v,2 => [1] expected:', simulate(['v','2'],3))
console.log('Multi block scenario: v,1 => [0] expected:', simulate(['v','1'],3))
console.log('Multi block scenario: v,9 (too large) => [] expected:', simulate(['v','9'],2))
console.log('Multi block scenario: v,v,2 => [1] expected (second v resets pending):', simulate(['v','v','2'],4))
console.log('Multi block scenario: v,1,X (X cancels after open) => [0] expected:', simulate(['v','1','X'],3))
console.log('Multi block scenario: v,X,2 (cancel before digit) => [] expected:', simulate(['v','X','2'],3))

// Simulate expiry: we mimic internal pending with timestamp then advance time logic manually here conceptually
function simulateExpiry(){
  let pending = { ts: Date.now() - 4000 } // older than 3s
  const shouldExpire = (Date.now() - pending.ts) > 3000
  console.log('Expiry simulation (>3s old) should clear:', shouldExpire)
}
simulateExpiry()

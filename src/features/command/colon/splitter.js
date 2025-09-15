// Split an input string into { filter, command } by the first colon that is
// outside of quotes and parentheses. Returns { filterPart, commandPart } or null if no colon.
export function splitFilterAndCommand(input){
  if(!input) return null
  let inSingle=false, inDouble=false, esc=false, depth=0
  for(let i=0;i<input.length;i++){
    const ch = input[i]
    if(esc){ esc=false; continue }
    if(ch==='\\'){ esc=true; continue }
    if(!inDouble && ch==='\''){ inSingle=!inSingle; continue }
    if(!inSingle && ch==='"'){ inDouble=!inDouble; continue }
    if(inSingle||inDouble) continue
    if(ch==='(') { depth++; continue }
    if(ch===')') { if(depth>0) depth--; continue }
    if(ch===':'){ if(depth===0){
      const left = input.slice(0,i).trim()
      const right = input.slice(i+1).trim()
      return { filterPart: left, commandPart: right }
    } }
  }
  return null
}

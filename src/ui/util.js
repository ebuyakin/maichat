// Shared UI utility helpers
export function escapeHtml(s){
  if(!s && s!==0) return ''
  return String(s).replace(/[&<>]/g, c=> ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))
}

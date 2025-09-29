// featureFlags.js
// Controls experimental features via URL params or localStorage.

function getUrlParam(name){
  try{
    const url = new URL(window.location.href)
    return url.searchParams.get(name)
  }catch{ return null }
}

export function shouldUseMessageView(){
  const url = getUrlParam('m')
  if(url && (url === 'messages' || url === 'msg' || url === '1')) return true
  try{ return localStorage.getItem('maichat_use_message_view') === 'true' }catch{ return false }
}

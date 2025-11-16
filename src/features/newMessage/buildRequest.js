// Phase 3: Build API request

/**
 * Build provider-agnostic API request with encoded images
 * 
 * @param {Object} params
 * @param {MessagePair[]} params.selectedPairs - History pairs that fit
 * @param {string} params.systemMessage - Topic system message
 * @param {string} params.userText - New user text
 * @param {string[]} params.imageIds - New user images
 * @param {string} params.model - Model ID
 * @param {Function} params.encodeImageToBase64 - Function to encode image to base64
 * @returns {Promise<Object>} Universal request object with encoded images
 */
export async function buildRequest({
  selectedPairs,
  systemMessage,
  userText,
  imageIds,
  model,
  encodeImageToBase64,
}) {
  const messages = []
  
  // Add history pairs (chronological)
  for (const pair of selectedPairs) {
    // User message with images
    const userMsg = {
      role: 'user',
      content: pair.userText,
    }
    
    // Encode history images if present
    if (pair.attachments && pair.attachments.length > 0) {
      userMsg.images = await Promise.all(
        pair.attachments.map(id => encodeImageToBase64(id))
      )
    }
    
    messages.push(userMsg)
    
    // Assistant message
    messages.push({
      role: 'assistant',
      content: pair.assistantText,
    })
  }
  
  // Add new user message at end
  const newUserMsg = {
    role: 'user',
    content: userText,
  }
  
  // Encode new images if present
  if (imageIds && imageIds.length > 0) {
    newUserMsg.images = await Promise.all(
      imageIds.map(id => encodeImageToBase64(id))
    )
  }
  
  messages.push(newUserMsg)
  
  // Build universal request
  return {
    model,
    system: systemMessage,
    messages,
  }
}

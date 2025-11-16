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
 * @param {Function} params.getBase64Many - Batch function to get base64 encodings
 * @returns {Promise<Object>} Universal request object with encoded images
 */
export async function buildRequest({
  selectedPairs,
  systemMessage,
  userText,
  imageIds,
  model,
  getBase64Many,
}) {
  // Step 1: Collect all image IDs from history + new message
  const allImageIds = []
  const imageIdIndexMap = new Map()  // Maps imageId -> index in allImageIds
  
  for (const pair of selectedPairs) {
    if (pair.attachments && pair.attachments.length > 0) {
      for (const id of pair.attachments) {
        if (!imageIdIndexMap.has(id)) {
          imageIdIndexMap.set(id, allImageIds.length)
          allImageIds.push(id)
        }
      }
    }
  }
  
  if (imageIds && imageIds.length > 0) {
    for (const id of imageIds) {
      if (!imageIdIndexMap.has(id)) {
        imageIdIndexMap.set(id, allImageIds.length)
        allImageIds.push(id)
      }
    }
  }
  
  // Step 2: Batch encode all images in one transaction
  const allEncodedImages = await getBase64Many(allImageIds)
  
  // Step 3: Build messages array
  const messages = []
  
  // Add history pairs (chronological)
  for (const pair of selectedPairs) {
    // User message with images
    const userMsg = {
      role: 'user',
      content: pair.userText,
    }
    
    // Attach encoded images if present
    if (pair.attachments && pair.attachments.length > 0) {
      userMsg.images = pair.attachments
        .map(id => allEncodedImages[imageIdIndexMap.get(id)])
        .filter(Boolean)
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
  
  // Attach new encoded images if present
  if (imageIds && imageIds.length > 0) {
    newUserMsg.images = imageIds
      .map(id => allEncodedImages[imageIdIndexMap.get(id)])
      .filter(Boolean)
  }
  
  messages.push(newUserMsg)
  
  // Build universal request
  return {
    model,
    system: systemMessage,
    messages,
  }
}

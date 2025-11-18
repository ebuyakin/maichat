// Phase 3: Build provider-agnostic request parts (text + images)

import { getBase64Many } from '../images/imageStore.js'

/**
 * Build provider-agnostic request parts with encoded images.
 *
 * Takes selected history pairs and the new user message, loads all referenced
 * images in a single batch, and returns a flat list of user/assistant parts
 * with inline base64 image data attached to the relevant user parts.
 *
 * @param {Object} params
 * @param {MessagePair[]} params.selectedPairs - History pairs that fit
 * @param {string} params.userText - New user text
 * @param {string[]} params.pendingImageIds - New user images (pending for this send)
 * @returns {Promise<Array<{ role: 'user' | 'assistant', content: string, images?: string[] }>>}
 */
export async function buildRequestParts({
  selectedPairs,
  userText,
  pendingImageIds,
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
  
  if (pendingImageIds && pendingImageIds.length > 0) {
    for (const id of pendingImageIds) {
      if (!imageIdIndexMap.has(id)) {
        imageIdIndexMap.set(id, allImageIds.length)
        allImageIds.push(id)
      }
    }
  }
  
  // Step 2: Batch encode all images in one transaction
  const allEncodedImages = await getBase64Many(allImageIds)
  
  // Step 3: Build parts array (user/assistant entries with optional images)
  const parts = []
  
  // Add history pairs (chronological)
  for (const pair of selectedPairs) {
    // User message with images
    const userPart = {
      role: 'user',
      content: pair.userText,
    }
    
    // Attach encoded images if present
    if (pair.attachments && pair.attachments.length > 0) {
      userPart.images = pair.attachments
        .map(id => allEncodedImages[imageIdIndexMap.get(id)])
        .filter(Boolean)
    }
    
    parts.push(userPart)
    
    // Assistant part
    parts.push({
      role: 'assistant',
      content: pair.assistantText,
    })
  }
  
  // Add new user message at end
  const newUserPart = {
    role: 'user',
    content: userText,
  }
  
  // Attach new encoded images if present
  if (pendingImageIds && pendingImageIds.length > 0) {
    newUserPart.images = pendingImageIds
      .map(id => allEncodedImages[imageIdIndexMap.get(id)])
      .filter(Boolean)
  }
  
  parts.push(newUserPart)

  return parts
}

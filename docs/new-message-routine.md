# New message routine new architecture

```javascript
// In Enter handler (inputKeys.js):

sendNewMessage({
  // User input
  userText: inputField.value.trim(),
  imageIds: pendingMessageMeta.attachments,  // string[]
  
  // Context
  topicId: pendingMessageMeta.topicId || store.rootTopicId,
  model: pendingMessageMeta.model || getActiveModel(),
  visiblePairIds: [...new Set(activeParts.parts.map(pt => pt.pairId))],  // string[] - WYSIWYG history
  activePartId: activeParts.parts[activeParts.activeIndex]?.id || null,  // string | null - current focused part
  
  // Dependencies
  store: store,  // Access to pairs, topics, images
  
  // Re-ask mode
  editingPairId: window.__editingPairId || null,  // string | null
})
```
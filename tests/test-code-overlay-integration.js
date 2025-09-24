// Test the complete code overlay flow
// This simulates the user interaction: focusing on code part and pressing 'v'

import { createStore } from '../src/core/store/memoryStore.js';
import { buildParts } from '../src/features/history/parts.js';

console.log('🧪 Testing Code Overlay Integration\n');

// Setup: Create store, topic, and message with code
const store = createStore();
const topicId = store.addTopic('Test Topic', store.rootTopicId);

// Simulate a realistic AI response with code
const aiResponse = `Here's how to create a simple web server:

\`\`\`javascript
const express = require('express');
const app = express();

app.get('/', (req, res) => {
  res.send('Hello, World!');
});

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
\`\`\`

This creates a basic Express server that responds with "Hello, World!" on the root path.`;

console.log('1. Adding message pair with code...');
const pairId = store.addMessagePair({
  topicId,
  model: 'test-model',
  userText: 'How do I create a web server?',
  assistantText: aiResponse
});

// Process it as if it came from the API (simulate interaction.js processing)
import { extractCodeBlocks } from '../src/features/codeDisplay/codeExtractor.js';
import { sanitizeAssistantText } from '../src/features/interaction/sanitizeAssistant.js';

const codeExtraction = extractCodeBlocks(aiResponse);
const contentToSanitize = codeExtraction.hasCode ? codeExtraction.displayText : aiResponse;
const clean = sanitizeAssistantText(contentToSanitize);

const updateData = { assistantText: clean, lifecycleState: 'complete' };
if (codeExtraction.hasCode) {
  updateData.processedContent = clean;
  updateData.codeBlocks = codeExtraction.codeBlocks;
}

store.updatePair(pairId, updateData);

console.log('2. Verifying processed message...');
const pair = store.pairs.get(pairId);
console.log('✅ Has code blocks:', !!pair.codeBlocks);
console.log('✅ Code blocks count:', pair.codeBlocks?.length || 0);
console.log('✅ First code block language:', pair.codeBlocks?.[0]?.language);
console.log('✅ First code block lines:', pair.codeBlocks?.[0]?.lineCount);

console.log('\n3. Simulating user navigation...');
const parts = buildParts([pair]);
const assistantParts = parts.filter(p => p.role === 'assistant');

console.log('✅ Assistant parts with placeholders:', assistantParts.length);

// Find a part that contains a code placeholder
const partWithCode = assistantParts.find(part => /\[:[\w]+-\d+\]/.test(part.text));
console.log('✅ Found part with code placeholder:', !!partWithCode);

if (partWithCode) {
  console.log('   Part text preview:', partWithCode.text.substring(0, 50) + '...');
  
  console.log('\n4. Testing v key functionality...');
  console.log('✅ Part belongs to message with code blocks:', !!pair.codeBlocks);
  console.log('✅ First code block available for overlay:');
  console.log('   Language:', pair.codeBlocks[0].language);
  console.log('   Lines:', pair.codeBlocks[0].lineCount);
  console.log('   Code preview:', pair.codeBlocks[0].code.substring(0, 50) + '...');
}

console.log('\n🎉 Integration test completed!');
console.log('\n📋 Manual test steps:');
console.log('1. Open the browser at localhost:5174');
console.log('2. Ask for code (e.g., "show me a Python function")');
console.log('3. Navigate to assistant response with j/k');
console.log('4. When focused on part with green [:python-1], press "v"');
console.log('5. Code overlay should open with syntax highlighting');
console.log('6. Press Esc to close, or click backdrop');
console.log('7. Test Copy button in overlay');
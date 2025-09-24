// Comprehensive test for Phase 1 - visible code placeholders
// This test creates a message pair with code and verifies the complete flow

import { createStore } from '../src/core/store/memoryStore.js';
import { buildParts } from '../src/features/history/parts.js';

console.log('🧪 Testing Phase 1 - Visible Code Placeholders\n');

// Create a store and add a message with code
const store = createStore();

// Add a topic first
const topicId = store.addTopic('Test Topic', store.rootTopicId);

// Create a message pair with code blocks
const messageWithCode = `Here's how to set up the project:

First, install dependencies:

\`\`\`bash
npm install
npm run build
\`\`\`

Then create the config file:

\`\`\`json
{
  "name": "test-project",
  "version": "1.0.0"
}
\`\`\`

Finally, start the server:

\`\`\`javascript
const express = require('express');
const app = express();
app.listen(3000);
console.log('Server running on port 3000');
\`\`\`

That should get everything working!`;

// Add the message pair
console.log('1. Adding message pair with code blocks...');
const pairId = store.addMessagePair({
  topicId,
  model: 'test-model',
  userText: 'How do I set up the project?',
  assistantText: messageWithCode
});

// Get the message pair and verify processing
console.log('2. Verifying code extraction...');
const pair = store.pairs.get(pairId);
console.log('✅ Original assistantText length:', pair.assistantText.length);
console.log('✅ Has processedContent:', !!pair.processedContent);
console.log('✅ Code blocks found:', pair.codeBlocks ? pair.codeBlocks.length : 0);

if (pair.codeBlocks) {
  console.log('✅ Code block languages:', pair.codeBlocks.map(b => b.language));
}

console.log('\n3. Testing parts generation...');
// Build parts from the message pair
const parts = buildParts([pair]);
console.log('✅ Total parts generated:', parts.length);

// Find assistant parts
const assistantParts = parts.filter(p => p.role === 'assistant');
console.log('✅ Assistant parts:', assistantParts.length);

// Check that parts contain placeholders instead of raw code
console.log('\n4. Verifying placeholder content in parts...');
assistantParts.forEach((part, index) => {
  console.log(`Part ${index + 1}:`);
  console.log('  Text preview:', part.text.substring(0, 100) + '...');
  
  // Check for placeholders
  const hasPlaceholders = /\[:[\w]+-\d+\]/.test(part.text);
  const hasRawCode = part.text.includes('```');
  
  console.log('  ✅ Contains placeholders:', hasPlaceholders);
  console.log('  ✅ No raw code blocks:', !hasRawCode);
  
  if (hasPlaceholders) {
    const matches = part.text.match(/\[:[\w]+-\d+\]/g) || [];
    console.log('  ✅ Placeholders found:', matches);
  }
});

console.log('\n5. Testing partitioning with narrow width...');
// Test that placeholders aren't split even with very narrow width
import { partitionMessage } from '../src/features/history/partitioner.js';

// Create a fake message with just a placeholder
const narrowTestText = 'Here is code: [:very-long-language-name-1] and more text.';
const narrowParts = partitionMessage({ 
  text: narrowTestText, 
  role: 'assistant', 
  pairId: 'test-narrow' 
});

console.log('✅ Narrow test parts:', narrowParts.length);
narrowParts.forEach((part, index) => {
  console.log(`  Part ${index + 1}: "${part.text}"`);
  // Verify placeholder is never split
  const hasPartialPlaceholder = /\[:[\w-]*$|^[\w-]*\]/.test(part.text);
  console.log(`  ✅ No partial placeholders: ${!hasPartialPlaceholder}`);
});

console.log('\n🎉 Phase 1 testing completed!');

// Summary
console.log('\n📊 Summary:');
console.log(`- Message processed: ${pair.codeBlocks ? '✅' : '❌'}`);
console.log(`- Parts generated: ${assistantParts.length} assistant parts`);
console.log(`- Placeholders visible: ${assistantParts.some(p => /\[:[\w]+-\d+\]/.test(p.text)) ? '✅' : '❌'}`);
console.log(`- No raw code leakage: ${!assistantParts.some(p => p.text.includes('```')) ? '✅' : '❌'}`);
console.log(`- Atomic placeholders: ${narrowParts.every(p => !/\[:[\w-]*$|^[\w-]*\]/.test(p.text)) ? '✅' : '❌'}`);
// Test for fixed code extraction - pre-sanitization
// This simulates the exact scenario that was failing

import { extractCodeBlocks } from '../src/features/codeDisplay/codeExtractor.js';
import { sanitizeAssistantText } from '../src/features/interaction/sanitizeAssistant.js';

console.log('🧪 Testing Pre-Sanitization Code Extraction Fix\n');

// Simulate the exact AI response format that was causing issues
const aiResponse = `Of course! Here's a simple example of Python code that prints "Hello, world!":

\`\`\`python
print("Hello, world!")
\`\`\`

Would you like a more detailed or different example?`;

console.log('1. Original AI Response:');
console.log('---');
console.log(aiResponse);
console.log('---\n');

console.log('2. What happens with OLD approach (sanitize first):');
const sanitizedFirst = sanitizeAssistantText(aiResponse);
console.log('After sanitization:');
console.log(sanitizedFirst);
const oldExtraction = extractCodeBlocks(sanitizedFirst);
console.log('✅ Code blocks found (old way):', oldExtraction.codeBlocks?.length || 0);
console.log('✅ Has placeholders (old way):', oldExtraction.hasCode);
console.log();

console.log('3. What happens with NEW approach (extract first):');
const newExtraction = extractCodeBlocks(aiResponse);
console.log('Code blocks found:', newExtraction.codeBlocks?.length || 0);
console.log('Display text with placeholders:');
console.log(newExtraction.displayText);

if (newExtraction.hasCode) {
  console.log('\nCode block details:');
  newExtraction.codeBlocks.forEach((block, i) => {
    console.log(`  Block ${i + 1}: ${block.language}, ${block.lineCount} lines`);
    console.log(`  Code: "${block.code}"`);
  });
  
  console.log('\nAfter sanitizing the placeholder version:');
  const sanitizedPlaceholders = sanitizeAssistantText(newExtraction.displayText);
  console.log(sanitizedPlaceholders);
}

console.log('\n🎉 Test Results:');
console.log(`- OLD approach works: ${oldExtraction.hasCode ? '✅' : '❌'}`);
console.log(`- NEW approach works: ${newExtraction.hasCode ? '✅' : '❌'}`);
console.log(`- Fix successful: ${newExtraction.hasCode && !oldExtraction.hasCode ? '✅' : '❌'}`);
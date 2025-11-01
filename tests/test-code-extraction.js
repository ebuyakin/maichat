// Simple test for code extraction Phase 0
// Run with: node tests/test-code-extraction.js

import { extractCodeBlocks, getDisplayContent, getContextContent } from '../src/features/codeDisplay/codeExtractor.js';

function runTests() {
  console.log('🧪 Testing Code Extraction Phase 0\n');
  
  // Test 1: Basic code block detection
  console.log('Test 1: Basic code block detection');
  const basicContent = `Here's a Python example:

\`\`\`python
def hello():
    print("Hello, world!")
\`\`\`

That should work!`;
  
  const result1 = extractCodeBlocks(basicContent);
  console.log('✅ Has code:', result1.hasCode);
  console.log('✅ Display text:', result1.displayText);
  console.log('✅ Code blocks:', result1.codeBlocks.length);
  console.log('✅ First block:', result1.codeBlocks[0]);
  console.log();
  
  // Test 2: Multiple code blocks
  console.log('Test 2: Multiple code blocks');
  const multiContent = `First, Python:

\`\`\`python
print("hello")
\`\`\`

Then JavaScript:

\`\`\`javascript
console.log("world");
\`\`\`

Done!`;
  
  const result2 = extractCodeBlocks(multiContent);
  console.log('✅ Display text:', result2.displayText);
  console.log('✅ Code blocks count:', result2.codeBlocks.length);
  console.log('✅ Languages:', result2.codeBlocks.map(b => b.language));
  console.log();
  
  // Test 3: MessagePair processing (manual, since legacy helper was removed)
  console.log('Test 3: MessagePair processing');
  const testPair = {
    id: 'test-123',
    userText: 'Show me some code',
    assistantText: `Here's an example:

\`\`\`bash
ls -la
echo "done"
\`\`\`

Hope that helps!`,
    topicId: 'test-topic',
    model: 'test-model'
  };
  
  const ex3 = extractCodeBlocks(testPair.assistantText);
  if (ex3.hasCode) {
    testPair.processedContent = ex3.displayText;
    testPair.codeBlocks = ex3.codeBlocks;
  }
  console.log('✅ Original assistantText preserved:', !!testPair.assistantText);
  console.log('✅ Has processedContent:', !!testPair.processedContent);
  console.log('✅ Has codeBlocks:', !!testPair.codeBlocks);
  console.log('✅ Display content:', getDisplayContent(testPair));
  console.log('✅ Context content:', getContextContent(testPair));
  console.log();
  
  // Test 4: No code blocks
  console.log('Test 4: No code blocks');
  const noCodePair = {
    id: 'test-456',
    assistantText: 'Just regular text with no code blocks.'
  };
  
  const ex4 = extractCodeBlocks(noCodePair.assistantText);
  if (ex4.hasCode) {
    noCodePair.processedContent = ex4.displayText;
    noCodePair.codeBlocks = ex4.codeBlocks;
  }
  console.log('✅ No processedContent added:', !noCodePair.processedContent);
  console.log('✅ No codeBlocks added:', !noCodePair.codeBlocks);
  console.log('✅ Display fallback works:', getDisplayContent(noCodePair));
  console.log();
  
  console.log('🎉 Phase 0 tests completed!');
}

runTests();
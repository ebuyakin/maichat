/**
 * Manual test for stringEnhancer functions
 * 
 * Run in browser console after importing:
 * import { testEnhancer } from './test-stringEnhancer.js'
 * testEnhancer()
 */

import { applySyntaxHighlightToString, renderMathToString, enhanceHTMLString } from './stringEnhancer.js'
import { renderMarkdownInline } from './markdownRenderer.js'

export function testEnhancer() {
  console.group('String Enhancer Tests')

  // Test 1: Syntax highlighting
  console.group('Test 1: Syntax Highlighting')
  const codeHTML = '<code class="language-javascript">const x = 1;</code>'
  const highlightedCode = applySyntaxHighlightToString(codeHTML)
  console.log('Input:', codeHTML)
  console.log('Output:', highlightedCode)
  console.log('✓ Should contain <span> tags:', highlightedCode.includes('<span'))
  console.groupEnd()

  // Test 2: Math rendering (inline)
  console.group('Test 2: Inline Math')
  const inlineMath = '<p>The equation $E=mc^2$ is famous.</p>'
  const renderedInline = renderMathToString(inlineMath)
  console.log('Input:', inlineMath)
  console.log('Output:', renderedInline)
  console.log('✓ Should contain katex class:', renderedInline.includes('katex'))
  console.groupEnd()

  // Test 3: Math rendering (display)
  console.group('Test 3: Display Math')
  const displayMath = '<p>$$\\frac{1}{2}$$</p>'
  const renderedDisplay = renderMathToString(displayMath)
  console.log('Input:', displayMath)
  console.log('Output:', renderedDisplay)
  console.log('✓ Should contain katex-display:', renderedDisplay.includes('katex-display'))
  console.groupEnd()

  // Test 4: Combined
  console.group('Test 4: Combined Enhancement')
  const combined = '<code class="language-python">print("hello")</code><p>And $x + y = z$</p>'
  const enhanced = enhanceHTMLString(combined)
  console.log('Input:', combined)
  console.log('Output:', enhanced)
  console.log('✓ Should have both:', enhanced.includes('<span') && enhanced.includes('katex'))
  console.groupEnd()

  // Test 5: Full pipeline with markdown (realistic)
  console.group('Test 5: Full Pipeline (Markdown → HTML → Enhanced)')
  const markdown = `Here is some code:

\`\`\`python
def hello():
    print("world")
\`\`\`

And math: $E=mc^2$ and display:

$$\\int_0^1 x^2 dx$$`
  
  console.log('Step 1 - Markdown input:', markdown)
  
  // OLD WAY: Two-step process
  const htmlWithMath = renderMarkdownInline(markdown)  // No options = default behavior
  console.log('Step 2a - After renderMarkdownInline() [no options]:', htmlWithMath)
  console.log('  → Should contain $...$ or $$...$$:', htmlWithMath.includes('$'))
  console.log('  → Should NOT have katex yet:', !htmlWithMath.includes('katex'))
  
  const manuallyEnhanced = enhanceHTMLString(htmlWithMath)
  console.log('Step 2b - After manual enhanceHTMLString():', manuallyEnhanced)
  console.log('  ✓ Should have syntax highlighting:', manuallyEnhanced.includes('token'))
  console.log('  ✓ Should have rendered math:', manuallyEnhanced.includes('katex'))
  
  // NEW WAY: One-step process
  const autoEnhanced = renderMarkdownInline(markdown, { enhance: true })
  console.log('Step 3 - After renderMarkdownInline({ enhance: true }):', autoEnhanced)
  console.log('  ✓ Should have syntax highlighting:', autoEnhanced.includes('token'))
  console.log('  ✓ Should have rendered math:', autoEnhanced.includes('katex'))
  console.log('  ✓ Results should match:', manuallyEnhanced === autoEnhanced)
  
  console.groupEnd()

  console.groupEnd()
  console.log('✅ All tests complete! Check output above.')
}

// Auto-run if loaded as module
if (typeof window !== 'undefined') {
  window.testEnhancer = testEnhancer
  console.log('💡 Test available: window.testEnhancer()')
}

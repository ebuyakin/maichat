// Print View Generator - Creates HTML for PDF export
import { renderMarkdownInline } from '../../formatting/markdownRenderer.js'
import katexCss from 'katex/dist/katex.min.css?raw'

function escapeHtml(text) {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

export function generatePrintView({ store, activeParts, options }) {
  if (!activeParts || !activeParts.parts || activeParts.parts.length === 0) {
    return '<html><body><p>No messages to export.</p></body></html>'
  }
  
  // Extract unique pair IDs from active parts
  const pairIds = [...new Set(activeParts.parts.map(part => part.pairId))]
  
  // Get actual message pairs from store
  const pairs = pairIds.map(pairId => store.pairs.get(pairId)).filter(Boolean)
  
  if (pairs.length === 0) {
    return '<html><body><p>No messages to export.</p></body></html>'
  }
  
  const currentTopicId = pairs[0]?.topicId
  const topicName = currentTopicId ? (store.topics.get(currentTopicId)?.name || 'Conversation') : 'Conversation'
  
  // Generate CSS based on options
  const css = generateCSS(options)
  
  // Generate header HTML
  const headerHtml = generateHeader(options, topicName, pairs.length)
  
  // Generate messages HTML
  const messagesHtml = pairs.map(pair => renderMessagePair(pair, options)).join('\n')
  
  // Complete HTML document
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(options.customTitle || topicName)}</title>
  <!-- KaTeX CSS from CDN (preferred for better rendering) -->
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css" integrity="sha384-n8MVd4RsNIU0tAv4ct0nTaAbDJwPJzDEaqSD1odI+WdtXRGWt2kTvGFasHpSy3SV" crossorigin="anonymous" onerror="this.onerror=null;this.remove();document.getElementById('katex-fallback').disabled=false;">
  <!-- Fallback: bundled KaTeX CSS (used if CDN fails) -->
  <style id="katex-fallback" disabled>
    ${katexCss}
  </style>
  <style>
    ${css}
  </style>
</head>
<body>
  ${headerHtml}
  <div class="conversation">
    ${messagesHtml}
  </div>
</body>
</html>`
}

function generateCSS(options) {
  return `
    /* Base styles */
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: Georgia, 'Times New Roman', serif;
      font-size: ${options.fontSize};
      line-height: ${options.lineSpacing};
      color: #000;
      background: white;
      padding: 0;
      margin: 0;
    }
    
    /* Print-specific rules */
    @media print {
      @page {
        size: A4 ${options.orientation};
        margin: 2.5cm 2cm;
      }
      
      body {
        font-size: ${options.fontSize};
        line-height: ${options.lineSpacing};
      }
      
      .message-user {
        page-break-after: avoid;
      }
      
      h1, h2, h3 {
        page-break-after: avoid;
      }
    }
    
    /* Screen preview styles */
    @media screen {
      body {
        max-width: 21cm;
        margin: 0 auto;
        padding: 2cm;
        box-shadow: 0 0 10px rgba(0,0,0,0.1);
      }
    }
    
    /* Header */
    .print-header {
      margin-bottom: 0.5em;
      padding-bottom: 0.3em;
      border-bottom: 2px solid #333;
    }
    
    .print-header h1 {
      font-size: 13pt;
      margin: 0 0 0.2em 0;
      font-weight: 600;
    }
    
    .print-meta {
      font-size: 9pt;
      color: #666;
      font-style: italic;
    }
    
    /* Message pairs with numbering */
    .conversation {
      counter-reset: message-counter;
    }
    
    .message-pair {
      margin-bottom: 1.5em;
      counter-increment: message-counter;
    }
    
    .message-user {
      font-weight: normal;
      margin-bottom: 0.5em;
      padding: 0.75em;
      background: #fafafa;
      border: 1px solid #e0e0e0;
      border-radius: 4px;
    }
    
    .message-assistant {
      margin-bottom: 1em;
    }
    
    .message-assistant::before {
      content: counter(message-counter) ". Assistant: ";
      font-weight: bold;
      color: #009900;
      display: block;
      margin-bottom: 0.5em;
    }
    
    /* Code blocks */
    pre, code {
      background: #f5f5f5;
      color: #333;
      border: 1px solid #ccc;
      font-family: Consolas, Monaco, 'Courier New', monospace;
    }
    
    code {
      padding: 2px 4px;
      font-size: ${options.codeFontSize};
    }
    
    pre {
      padding: 8pt;
      margin: 0.5em 0;
      overflow: auto;
      white-space: pre-wrap;
      word-wrap: break-word;
    }
    
    pre code {
      padding: 0;
      border: none;
      background: transparent;
    }
    
    /* Markdown elements */
    h1, h2, h3, h4, h5, h6 {
      font-size: 1em;
      font-weight: bold;
      margin: 0.6em 0 0.3em;
    }
    
    p {
      margin: 0.5em 0;
    }
    
    ul, ol {
      margin: 0.5em 0;
      padding-left: 2em;
    }
    
    blockquote {
      margin: 0.5em 0;
      padding-left: 1em;
      border-left: 3px solid #ccc;
      color: #555;
      font-style: italic;
    }
    
    a {
      color: #0066cc;
      text-decoration: underline;
    }
    
    hr {
      border: none;
      border-top: 1px solid #ccc;
      margin: 1em 0;
    }
  `
}

function generateHeader(options, topicName, messageCount) {
  if (!options.includeTopicName && !options.includeDate && !options.includeCount) {
    return ''
  }
  
  let html = '<div class="print-header">'
  
  if (options.includeTopicName) {
    const title = options.customTitle || topicName
    html += `<h1>${escapeHtml(title)}</h1>`
  }
  
  const metaParts = []
  if (options.includeDate) {
    metaParts.push(`Exported: ${new Date().toLocaleDateString()}`)
  }
  if (options.includeCount) {
    metaParts.push(`${messageCount} message${messageCount !== 1 ? 's' : ''}`)
  }
  
  if (metaParts.length > 0) {
    html += `<p class="print-meta">${metaParts.join(' • ')}</p>`
  }
  
  html += '</div>'
  return html
}

function renderMessagePair(pair, options) {
  const userHtml = renderUserMessage(pair.userText)
  const assistantHtml = renderAssistantMessage(pair.assistantText)
  
  return `
    <div class="message-pair">
      <div class="message-user">${userHtml}</div>
      <div class="message-assistant">${assistantHtml}</div>
    </div>
  `
}

function renderUserMessage(text) {
  // User messages are plain text, just escape HTML
  return escapeHtml(text || '').replace(/\n/g, '<br>')
}

function renderAssistantMessage(text) {
  // Use the app's markdown renderer directly (no sanitization)
  // This matches how the main app renders messages in historyView.js
  const html = renderMarkdownInline(text || '', { enhance: true })
  
  return html
}

export function openAndPrint(htmlContent, autoPrint = true) {
  // Open window first with minimal URL
  const printWindow = window.open('', '_blank')
  
  if (!printWindow) {
    alert('Could not open print window. Please check popup blocker settings.')
    return
  }
  
  // Write content directly (browser will show about:blank or blank in footer)
  printWindow.document.open()
  printWindow.document.write(htmlContent)
  printWindow.document.close()
  
  if (autoPrint) {
    // Wait for content and resources to load
    printWindow.addEventListener('load', () => {
      setTimeout(() => {
        printWindow.print()
      }, 250)
    })
  }
}

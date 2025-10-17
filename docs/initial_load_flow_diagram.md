Initial load flow:

main.js executes (bundled)
  ├─ import katex (synchronous, bundled)
  ├─ window.katex = katex ✅ Available immediately!
  └─ bootstrap() called
       ├─ persistence.init()
       ├─ renderCurrentView()
       │    ├─ renderHistory(pairs)
       │    │    ├─ historyView.renderMessages(messages)
       │    │    │    ├─ For each assistant message:
       │    │    │    │    ├─ renderMarkdownInline(text, {enhance: true})
       │    │    │    │    │    ├─ Marked.js parses markdown (synchronous)
       │    │    │    │    │    └─ enhanceHTMLString(html)
       │    │    │    │    │         ├─ applySyntaxHighlightToString() - synchronous!
       │    │    │    │    │         └─ renderMathToString() - synchronous!
       │    │    │    │    │              └─ window.katex.renderToString() ✅
       │    │    │    │    └─ Build HTML string
       │    │    │    └─ container.innerHTML = tokens.join('') ← ONE DOM WRITE
       │    │    └─ requestAnimationFrame → remeasure, applyActive
       │    └─ Done!
       ├─ layoutHistoryPane() - adjust pane dimensions
       └─ Scroll to bottom:
            ├─ requestAnimationFrame → scrollToBottom()
            └─ setTimeout(scrollToBottom, 100) ← THE DELAY!
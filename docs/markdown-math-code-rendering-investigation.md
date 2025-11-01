# MaiChat rendering pipeline: Markdown, Math, and Code (investigation)

Date: 2025-11-01
Owner: Investigation only (no code changes)

## Scope
- What transforms apply to assistant text before it reaches the DOM.
- How Markdown, code, and LaTeX-like math are detected and rendered.
- Where “legacy” pieces remain and when they’re used.
- Why currency like `$8 … $3` sometimes gets rendered as math.

## High-level knobs
- Setting: `settings.useInlineFormatting`
  - true (default): Inline pipeline (Markdown → sanitize → string-based enhancements) builds a single HTML string and injects once.
  - false (legacy): Placeholder pipeline (no Markdown). Historically added post-DOM enhancements; in current renderer, placeholders (e.g., `[python-1]`, `[eq-2]`) are styled as tokens, not converted to HTML math/code.

## Current rendering paths

1) Inline formatting ON (current default)
- Entrypoint: `historyView.renderMessages()` → for assistant body:
  - `renderMarkdownInline(text, { enhance: true })` (in `features/formatting/markdownRenderer.js`).
  - Steps inside:
    1) Code fences: collects languages, temporarily removes the language label from ``` fences; later adds `data-language` to `<pre>` (note: not `class="language-..."`).
    2) Math pre-extract: replaces math segments with placeholders so Markdown (marked) won’t mangle them:
       - Display: `$$…$$` and `\[ … \]`
       - Inline: `$…$` and `\( … \)`
    3) Markdown parse: via `marked`.
    4) Sanitize: via `DOMPurify` (allowlist of tags/attrs; anchors adjusted later).
    5) Math restore: reinserts original segments (e.g., `$E=mc^2$`) back into the sanitized HTML string.
    6) Post-process HTML string:
       - Set `data-language` on `<pre>` elements based on collected list.
       - Linkify plain URLs; enforce external anchors to open in new tab with safe `rel`.
       - If `enhance: true`: call `enhanceHTMLString` (in `stringEnhancer.js`).
         - `enhanceHTMLString`
           - Code highlighting: `applySyntaxHighlightToString` uses `window.Prism` if already loaded; otherwise no-op with a warning.
           - Math rendering: `renderMathToString` uses `window.katex` if present; otherwise no-op with a warning.
- Note: This path does not itself load Prism or KaTeX; it will use them if they’re globally present.

2) Inline formatting OFF (legacy mode)
- Entrypoint: `historyView.renderMessages()` → assistant body uses placeholder styling path:
  - No Markdown parse.
  - Code/equation placeholders (e.g., `[python-1]`, `[eq-2]`) produced earlier by the send pipeline can be styled as simple tokens via `processCodePlaceholders`.
  - In current code, the legacy DOM-time enhancement function (`enhanceRenderedMessage`) is imported but not invoked by `renderMessages()`.
  - Result: you see “raw-ish” text plus lightweight placeholder styling; no KaTeX rendering here.

## Pre-send processing (affects legacy path)
- Where: `features/interaction/inputKeys.js` after a provider reply, before storing the pair.
  - Pipeline:
    1) `extractCodeBlocks(rawText)` → replaces fenced code blocks with `[lang-N]` placeholders and stores code blocks on the pair.
    2) `extractEquations(textAfterCode)` (in `codeDisplay/equationExtractor.js`):
       - Display math (`$$…$$`, `\[ … \]`) → replaced with `[eq-N]` placeholders and stored as equationBlocks.
       - Inline math (including `$…$`, `\( … \)`) → simple inline equations may be converted to a Unicode approximation and inserted with `__EQINL_K__` markers; complex inline math becomes `[eq-N]` like display.
    3) `sanitizeDisplayPreservingTokens` → cleans plain text while preserving placeholders and inline equation markers.
    4) Replace inline markers `__EQINL_K__` with `<span class="eq-inline" …>`.
    5) Store `processedContent` (and code/equation metadata) on the pair.
- In legacy mode, the renderer shows those placeholders/spans rather than doing KaTeX.

## Providers and content shapes
- Adapters normalize responses to a single string `content` (stored as `assistantText`).

## KaTeX and Prism: load and usage (current)

- Where they are loaded
  - KaTeX: bundled in `src/main.js`
    - `import 'katex/dist/katex.min.css'`
    - `import katex from 'katex'`
    - `window.katex = katex`
  - Prism: bundled in `src/main.js`
    - `import Prism from 'prismjs'`
    - Common grammars imported (python, javascript, typescript, bash, json, sql, yaml, markdown)
    - `window.Prism = Prism`
    - Note: no Prism theme CSS is imported; without a theme, Prism’s token markup renders as monochrome.

- How they’re used in the modern path (useInlineFormatting = true)
  - `renderMarkdownInline()` builds a single HTML string and adds `class="language-…"` to `<code>` for Prism compatibility.
  - `enhanceHTMLString()` then:
    - Calls `applySyntaxHighlightToString()` only if `window.Prism` exists.
    - Calls `renderMathToString()` only if `window.katex` exists.
  - Because KaTeX and Prism are exposed on `window` by `main.js`, both functions are eligible to run at string-time.
  - Visible code colors require a Prism theme CSS (e.g., `prismjs/themes/prism-tomorrow.css`). Without it, code appears correctly formatted but uncolored (by app CSS only).

- Architecture alignment
  - No DOM-time mutations; all work is string-time, preserving the single-paint rule.
  - Legacy DOM enhancers and lazy loaders were removed; Vite import errors were resolved by deleting dead dynamic imports.

## Practical follow-ups (non-breaking)

- If visible code colors are desired, import one Prism theme CSS once (e.g., in `src/main.js`):
  - `import 'prismjs/themes/prism-tomorrow.css'`
  - This is purely presentational; no change to logic, order of operations, or DOM write count.
  - OpenAI (Responses), Anthropic (Messages), Gemini (GenerateContent), Grok (Chat Completions): all return string `content` in our current adapters.
- The inline renderer consumes this string; the legacy placeholder path uses the stored `processedContent` from the post-send extraction.

## Where KaTeX/Prism are loaded
- `features/formatting/mathRenderer.js` contains a lazy loader and an auto-render call intended for a DOM-time pass (`renderMathInElement`).
- `markdownRenderer.enhanceRenderedMessage(element)` would call that loader; however, in the current `historyView.renderMessages()` implementation we do not call `enhanceRenderedMessage` in the inline path. Therefore:
  - Inline path renders math only if `window.katex` is already available (e.g., loaded elsewhere earlier in the session).
  - Legacy path (as currently wired) does not invoke KaTeX.
- Prism is similarly used only if present on `window` in the string path; otherwise no-op.

## Why currency sometimes renders “like math”
- In the inline path, `enhanceHTMLString.renderMathToString` will render inline `$…$` if `window.katex` is present. The simple regex can accidentally pair `$8 … $3` and treat the interior as math, producing italic/tight spacing.
- If KaTeX is not present, the same `$…$` remains literal (not italic), which explains why the issue is intermittent.

## Legacy roots and not-in-use pieces
- `markdownRenderer.enhanceRenderedMessage(element)` (DOM-time enhancements) appears unused by the current `renderMessages()` path.
- `formatting/mathRenderer.js` (KaTeX auto-render) is only used by `enhanceRenderedMessage`.
- `formatting/syntaxHighlight.js` lazy load is only used by `enhanceRenderedMessage`.
// Update 2025-11-01: `codeDisplay/applyEquationsToPair` and `processMessagePair` were removed
// as part of legacy cleanup. Modern pipeline uses `extractCodeBlocks` and `extractEquations`
// directly and stores `processedContent`/metadata without the wrappers.

## Summary matrix (today)
- useInlineFormatting = true (default)
  - Markdown: yes (marked + DOMPurify)
  - Code: optional highlighting via Prism if already loaded; otherwise plain `<pre><code>` (with `data-language` on `<pre>`, not `class="language-…"`).
  - Math: optional KaTeX string-render if `window.katex` is present; otherwise `$…$` remains literal.
  - Single DOM write guarantee: respected (full HTML string composed, then injected once).
- useInlineFormatting = false (legacy)
  - Markdown: no
  - Code: placeholder tokens styled (no ePrism by default in current path)
  - Math: placeholder tokens (`[eq-N]`) and simple inline unicode; no KaTeX in current path
  - Single DOM write guarantee: respected

## Known fragilities
- Inline math `$…$` regex in the string path can misinterpret currency/ranges when KaTeX is present.
- Code fences: languages are removed from the fence and later written as `data-language` on `<pre>`. Prism typically expects `class="language-…"` on `<code>`. As a result, highlighting may be skipped unless Prism is present and/or code classes are present.
- KaTeX/Prism loading is not triggered in the inline path; availability depends on global state or prior calls to the legacy loader.

## Verification checklist (manual)
- Inline ON: `$x^2$` renders (when KaTeX present); `$8 … $3` remains plain text if currency guard is applied.
- Inline OFF: placeholders appear; no KaTeX render.
- Code fences: verify `data-language` set on `<pre>`; check highlighting behavior with/without Prism on `window`.
- Providers: confirm all adapters place a string into `assistantText`.

## Minimal options (future work, if desired)
- Currency-safe inline math: require closing `$` not followed by a digit for `$…$` matches in the string path; keep `$$`, `\(…\)`, `\[…\]` unchanged.
- Optional: remove single-`$` delimiter from KaTeX auto-render (legacy loader) to prevent currency issues if that path is re-enabled.
- Code language propagation: add `class="language-…"` on `<code>` when available to make Prism more reliable (string-time only).
- Loader alignment: if consistent math/code rendering is desired in the inline path, add small, string-phase loaders (not DOM-mutating) that ensure Prism/KaTeX are available before `enhanceHTMLString`.

## Bottom line
- The app currently honors the “single paint” rule: all assistant rendering happens by composing a full HTML string and injecting once.
- Inline path is the primary (and recommended) renderer; legacy path remains but is minimal.
- Currency → math mis-parsing arises from the inline string-path regex when KaTeX happens to be present; it’s independent of provider and intermittent by environment.

# MaiChat

<div align="center">
  <i## 🚀 Quick Start

### Use Online (No Installation)

Visit **[maichat.app](https://maichat.app)** to use MaiChat directly in your browser. No downloads, no setup - just add your API keys and start chatting.

**Hosted on Vercel** with automatic HTTPS, global CDN, and 99.99% uptime.

### Self-Host

Deploy your own instance:
- **Vercel:** Fork this repo, connect to Vercel, auto-deploys on push
- **Other hosts:** Serve the production build from `dist/` on any static host (Netlify, Cloudflare Pages, etc.) src="public/maichat-logo.png" alt="MaiChat Logo" width="128" height="128">
  <br>
  <strong>Keyboard-First LLM Client for Power Users</strong>
  <br>
  <br>
  A unified interface for GPT-4o, Claude, Gemini, and Grok with advanced conversation organization, web search, image support, and precise context control.
  <br>
  <br>
  
  [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
  [![Version](https://img.shields.io/badge/version-1.1.0-green.svg)](CHANGELOG.md)
  
</div>

---

## ✨ Highlights

- **🌳 Topic Tree Organization** - Structure conversations in a hierarchical topic system, like files in folders
- **⌨️ Keyboard-Centric Workflow** - Vim-inspired modal interface (Input/View/Command), zero mouse required
- **🔍 Powerful Search & Filtering** - CLI-style query language with boolean operators, filter by topic/model/date/content/rating
- **🎯 Context Control** - Visual context boundary, precise token management, filter before sending
- **🤖 Multi-Model Support** - OpenAI (GPT-4o, o1), Anthropic Claude, Google Gemini, xAI Grok - all in one interface
- **🖼️ Image Attachments** - Send screenshots and images to vision-capable models (GPT-4o, Claude 3.5, Gemini, Grok)
- **🌐 Web Search** - Native search integration for all providers with citations
- **📊 Activity Statistics** - Track usage by date and model with response time analytics
- **🔒 Privacy First** - 100% client-side, all data stored locally, no backend, open source (MIT)
A keyboard-first, minimal, client-side app for organizing and running conversations with multiple LLMs in one unified interface.

## Highlights
- Topic tree: structure any message into a hierarchical topic system.
- Flexible context: filter/supplement what’s sent to the model.
- Command-line style filtering: fast, composable commands for context control.
- Keyboard-centric: operate without a mouse; distraction-free UI.
- Pure client: vanilla JS, built with Vite; no server required.

## Run in your browser (no install)
End users don’t need Node.js. Open the deployed site (e.g., GitHub Pages) and use MaiChat directly in the browser. If you self-host, serve the production build in `dist/` on any static web host.

## 🛠️ Development

### Prerequisites
- Node.js ≥ 18
- npm (comes with Node.js)

### Setup & Run

```bash
# Clone the repository
git clone https://github.com/ebuyakin/maichat.git
cd maichat

# Install dependencies
npm ci

# Start dev server (Vite)
npm run dev
# Open http://localhost:5173
```

### Build for Production

```bash
# Create optimized production build
npm run build

# Preview production build locally
npm run preview
```

### Run Tests

```bash
# Run tests once
npm test

# Watch mode for development
npm run test:watch
```

### Other Commands

```bash
# Format code with Prettier
npm run format

# Build tutorial HTML
npm run tutorial:build

# Watch tutorial for changes
npm run tutorial:watch
```

## 📚 Key Features

### Topic Tree Organization
- Create hierarchical topic structures (like folders)
- Assign any message to any topic, anytime
- Custom system messages per topic for AI behavior
- Topic-specific model parameters (temperature, max tokens)
- Never lose track of conversations across different themes

### Keyboard-Centric Interface
- **Modal design** (Input/View/Command modes) - keys are contextual, no conflicts
- **Vim-inspired navigation** - j/k scroll, u/d jump messages, g/G first/last
- **One-key actions** - copy code (Y), rate messages (1-5), toggle flags (B/G/R)
- **Fast topic/model switching** - Ctrl+T, Ctrl+M
- **Mouse optional** - fully keyboard-driven, but mouse works when needed

### Powerful Search & Filtering
- **CLI-style queries** - `t'work' & d<7d | s>=3` (topic "work" AND last 7 days OR 3+ stars)
- **Multi-dimensional** - filter by topic, model, date, content, rating, color flags, images
- **Boolean operators** - AND (&), OR (|), NOT (!), grouping with parentheses
- **Command history** - Ctrl+P/N to reuse previous queries
- **Instant results** - see filtered view immediately

### Context Control
- **Visual boundary** - see exactly what's included in context
- **Token budget** - real-time calculation with model-specific limits
- **Filter before sending** - include only relevant messages
- **Smart trimming** - automatic overflow handling with trim indicators
- **Multi-model** - compare context sizes across different models

### Multi-Model Support
- **OpenAI:** GPT-4o, GPT-4o-mini, o1-preview, o1-mini
- **Anthropic:** Claude 3.5 Sonnet, Claude 3 Opus, Claude 3 Haiku
- **Google:** Gemini 1.5 Pro, Gemini 1.5 Flash
- Easy model switching, per-topic defaults
 - **xAI:** Grok (text) and Grok Vision (images + text)

## 🗂️ Project Structure

```
maichat/
├── public/          # Static assets (HTML, favicon, logo)
├── src/             # Application source code
│   ├── core/        # Store, models, settings, persistence
│   ├── features/    # UI features (history, topics, commands, etc.)
│   ├── runtime/     # Bootstrap, lifecycle management
│   ├── shared/      # Shared utilities and components
│   ├── styles/      # CSS modules
│   └── main.js      # Application entry point
├── docs/            # Design docs, specs, ADRs
├── tests/           # Unit tests (Vitest)
└── tutorial.html    # Built tutorial (generated)
```

## 📖 Documentation

### For Users
- **[Tutorial](tutorial.html)** - Interactive getting started guide (Ctrl+Shift+H in app)
- **[Keyboard Reference](docs/keyboard_reference.md)** - Complete shortcut list (F1 in app)
- **[CLI Filtering Language](docs/cli_filtering_language.md)** - Query syntax specification

### For Developers
- **[Architecture](docs/ARCHITECTURE.md)** - System design, runtime/UI layers, data model
- **[Project Vision](docs/project_vision.md)** - Goals, principles, design philosophy
- **[Topic System](docs/topic_system.md)** - Topic tree concepts and operations
- **[ADRs](docs/ADRs/)** - Architecture Decision Records

### Technical Specs
- **[UI Layout](docs/ui_layout.md)** - Zone structure and alignment
- **[Scroll Positioning](docs/scroll_positioning_spec.md)** - Scroll behavior specification
- **[Focus Management](docs/focus_management.md)** - Modal isolation and focus traps
- **[New Message Workflow](docs/new_message_workflow.md)** - Send/reply lifecycle

## 🔒 Privacy & Security

- **100% Client-Side** - No backend, no server, no tracking
- **Local Storage** - All conversations stored in browser IndexedDB
- **Your Keys, Your Control** - API keys stored in localStorage, sent only to providers you choose
- **No Data Collection** - Zero telemetry, analytics, or third-party scripts
- **Open Source** - MIT licensed, audit the code yourself

## 🤝 Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Markdown rendering:** [marked](https://marked.js.org/)
- **Math rendering:** [KaTeX](https://katex.org/)
- **Code highlighting:** [Prism.js](https://prismjs.com/)
- **Sanitization:** [DOMPurify](https://github.com/cure53/DOMPurify)
- **Build tool:** [Vite](https://vitejs.dev/)

## 🔗 Links

- **Website:** [maichat.app](https://maichat.app)
- **Repository:** [github.com/ebuyakin/maichat](https://github.com/ebuyakin/maichat)
- **Issues:** [github.com/ebuyakin/maichat/issues](https://github.com/ebuyakin/maichat/issues)
- **Changelog:** [CHANGELOG.md](CHANGELOG.md)

---

<div align="center">
  Made with ❤️ for keyboard enthusiasts
</div>

# Changelog

All notable changes to MaiChat will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-10-18

### Initial Release

MaiChat 1.0.0 is the first public release - a keyboard-first LLM client with advanced conversation organization and context control.

### Core Features

#### Topic Tree Organization
- Hierarchical topic structure for organizing conversations
- Create, rename, move, and delete topics with keyboard shortcuts
- Custom system messages per topic for AI behavior customization
- Topic-specific model parameters (temperature, max tokens)
- Visual topic path display in message metadata
- Flexible message reassignment between topics

#### Keyboard-Centric Interface
- Modal interface (Input/View/Command modes) inspired by Vim
- j/k navigation for scrolling, u/d for message jumps
- g/G for first/last message navigation
- Shift+O to jump to context boundary
- Comprehensive keyboard shortcuts for all operations (see F1 for full list)
- Mouse support available but optional

#### Advanced Search & Filtering
- CLI-style filtering language with boolean operators (AND, OR, NOT)
- Filter by topic (t'pattern'), model (m'pattern'), date (d<7d, d>2024-10-01)
- Filter by content (c'keyword'), rating (r30, s>=2), recent messages (n10)
- Color flags (b/g/r/o/p for blue/green/red/orange/purple)
- Combine filters with logical operators and grouping
- Command history (Ctrl+P/N) for reusing frequent queries
- Universal search across all topics

#### Context Control
- Visual context boundary indicator showing what's sent to AI
- Precise token budget management with real-time calculations
- Filter before sending to control included history
- Multi-model context calculation (GPT-4, Claude, Gemini)
- Configurable user/assistant token allowances
- Automatic context trimming with overflow detection

#### Multi-Model Support
- OpenAI (GPT-4o, GPT-4o-mini, o1-preview, o1-mini)
- Anthropic Claude (3.5 Sonnet, 3 Opus, 3 Haiku)
- Google Gemini (1.5 Pro, 1.5 Flash)
- Model-specific token limits and pricing
- Easy model switching (Ctrl+M)
- Per-topic default model configuration

### User Interface

#### Message Display
- Inline markdown rendering with code syntax highlighting (Prism.js)
- Math expressions rendered with KaTeX
- One-click copy for code blocks, formulas, and full messages
- Color-coded message flags (blue=in-context, green=out, red=error)
- Star ratings (1-5 stars) for message quality tracking
- Compact metadata display (timestamp, topic, model)

#### Overlays & Modals
- Topic Editor (Ctrl+Shift+T) for managing topic tree
- Model Editor (Ctrl+Shift+M) for model catalog configuration
- Settings overlay (Ctrl+,) for app customization
- API Keys management (Ctrl+K) with secure local storage
- Help overlay (F1) with keyboard reference
- Interactive tutorial (Ctrl+Shift+H)

#### Visual Design
- Dark theme optimized for long reading sessions
- Minimal, distraction-free interface
- Gradient fade zones at top/bottom for context awareness
- Customizable spacing and layout (message gaps, padding)
- Smooth scroll animations with configurable duration
- Responsive design for various screen sizes

### Technical Implementation

#### Architecture
- Pure client-side JavaScript (Vanilla JS)
- No backend or external services (except LLM APIs)
- IndexedDB for local conversation persistence
- LocalStorage for settings and API keys
- Module-based architecture with clear separation of concerns

#### Data Management
- Message pairs as fundamental unit (user request + AI response)
- Immutable message history with metadata tracking
- Efficient context calculation with token estimation
- Automatic persistence with debounced writes
- Export/import functionality for data portability

#### Performance
- Message-based rendering (no partition system)
- Synchronous markdown/math rendering during HTML construction
- Smart scroll positioning with metric caching
- Optimized bootstrap process (single render on load)
- Sub-20ms rendering for typical conversations

#### Security & Privacy
- All data stored locally in browser (IndexedDB)
- API keys stored in LocalStorage, never sent to third parties
- Direct communication with LLM providers (OpenAI, Anthropic, Google)
- No tracking, analytics, or telemetry
- Open source codebase (MIT license)

### Documentation

- Comprehensive tutorial covering all features
- Keyboard reference (F1) with searchable shortcuts
- Architecture documentation in `/docs`
- CLI filtering language specification
- ADRs (Architecture Decision Records) for design rationale

### Development Tools

- Vite for development and production builds
- Vitest for unit testing with jsdom
- Prettier for code formatting
- Tutorial generator for markdown-to-HTML conversion
- Madge for dependency analysis

---

## Future Releases

See [GitHub Issues](https://github.com/ebuyakin/maichat/issues) for planned features and enhancements.

---

[1.0.0]: https://github.com/ebuyakin/maichat/releases/tag/v1.0.0

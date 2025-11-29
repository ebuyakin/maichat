# Changelog

All notable changes to MaiChat will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.5] - 2025-11-29

### Added

#### New Message Pipeline
- Modern send architecture with improved token estimation (per-provider image costs, foundation for future provider-specific tokenizers)
- Cleaner retry/trim logic with better error handling
- Enhanced SSE streaming support
- Service locator pattern for cleaner dependencies
- Controlled via `maichat_use_new_pipeline` localStorage flag (default: enabled)

#### PDF Export
- Export conversations to formatted PDF (`Ctrl+Shift+R`)
- Configurable typography, layout, and metadata
- Settings persistence with auto-open option

#### Activity Statistics
- "By Topic" tab with hierarchical message distribution
- Direct and total (including subtopics) counts per topic
- Collapsible topic tree view

#### App Versioning
- Version tracking and automated migrations system
- Handles settings and data structure evolution across releases

### Changed

#### Model Catalog Updates
- OpenAI: gpt-5.1, gpt-5-mini, gpt-5-nano (400K context)
- Anthropic: claude-sonnet/opus/haiku-4-5 series (200K context)
- Google: gemini-3-pro-preview, gemini-2.5-pro/flash (1M context)
- xAI: grok-4-1-* series (2M context)
- Removed deprecated models (o4-mini, older Claude 3.5/Gemini versions)

#### UI Improvements
- Model Editor redesigned for improved navigation and new model creation
- Topic tree expand/collapse state now persists across sessions
- Adjusted heading sizes in message history for better visual hierarchy

### Fixed
- Context boundary rendering now uses CSS classes instead of DOM mutations (performance improvement)
- Image attachments now correctly included from full history, not just current request
- Budget calculations preserved when swapping response variants
- Pending draft images properly cleared after message send
- Context boundary updates when pending model changes
- Re-ask errors now preserve existing assistant response
- Abort controller properly integrated in send pipeline
- Message pair structure now stores both estimated and actual token usage for accuracy tracking
- Default model changed to gpt-5-mini (was gpt-5-nano)

### Internal
- Performance analysis identified DOM manipulation as primary rendering bottleneck
- Legacy compose pipeline retained for backward compatibility
- Debug console statements cleanup

---

## [1.2.0] - 2025-11-07

### Added
- Second Opinion flow: `E` to re-ask with another model; `Shift+E` toggles last two answers (no extra history clutter).
- Reading Experience customization (columns, gutters, lightness, weights) documented in tutorial.
- Seeded topic tree with varied system messages (General, Daily news, Random questions, Learning depth, Coding, Health, Debating club, Naked truth).
- Copy-on-create system message inheritance (new child topic inherits parent message once at creation).
- Privacy-friendly Vercel Web Analytics on landing pages (index & tutorial) – cookie-less visit counts.

### Changed
- Tutorial expanded: Second Opinion step, System Messages & customization guidance.
- Initial load improvement: welcome message visible on very first fresh load (post-seed conditional render).

### Fixed
- Empty first-load history (seeding previously occurred after initial render without repaint).

### Internal
- Replaced legacy seed tree with new hierarchy and concise per-topic system messages.
- Added analytics disclosure to Security & Privacy section.
- Small fixes and code optimizations across settings and styling defaults.

### Notes
- Font weight change applies only to new profiles; existing users retain stored settings.
- No breaking changes; minor version bump reflects new visible capabilities.

## [1.1.0] - 2025-11-02

### Added

#### Grok/xAI Integration
- Added support for xAI's Grok models (grok-beta, grok-vision-beta)
- Native integration with X/Twitter search capabilities
- Vision support for image analysis

#### Web Search for All Providers
- **Gemini:** Grounding with Google Search integration
- **Grok:** Built-in X/Twitter search (native)
- **OpenAI:** Migrated to Response API with native web search support
- **Anthropic:** Added web search capability via recent API updates
- Search toggle in Model Editor for per-model search configuration
- Sources overlay (`Ctrl+Shift+S`) to view citations and search results
- Link hints system (`l` key) to open citations in new tabs

#### Image Attachments
- Support for image attachments in conversations (JPEG, PNG)
- Multiple attachment methods:
  - Keyboard dialog (`Ctrl+F`) with file picker
  - Clipboard paste (`Cmd/Ctrl+V`) for screenshots
  - Drag-and-drop support
- Image preview overlay (`Ctrl+Shift+O` in Input, `i` in View)
- Image storage in IndexedDB with efficient base64 encoding
- Vision support for GPT-4o, Claude 3.5 Sonnet, Gemini 1.5 Pro/Flash, Grok
- Image indicators in message metadata
- Filter messages by image attachments (`hasImage` filter)

#### Message Management
- `:delete` command to remove messages from history
- Automatic cleanup of orphaned image attachments
- Cascade deletion of images when parent message is deleted

#### Activity Statistics
- New Activity Stats overlay (`Ctrl+Shift+D`)
- Two views: by date and by model
- Message counts and median response times
- Respects current filter for context-aware statistics
- Keyboard navigation: `h`/`l` to switch views, `j`/`k` to navigate

### Changed
- Updated Model Catalog with latest model versions and capabilities
- Enhanced code syntax highlighting with additional language support (C++, Java, C#, etc.)
- Improved math rendering to avoid false positives with currency symbols
- Tutorial comprehensively updated with all new features

### Fixed
- Math equation rendering edge cases with dollar signs followed by digits
- Model persistence when reloading with topic-model combinations
- Message draft preservation on reload when attachments are present
- Image lifecycle management to prevent orphaned attachments

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

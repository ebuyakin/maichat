# MaiChat - AI Interaction Platform

## Table of Contents

1. [Problem Statement](#1-problem-statement)
2. [Product Vision](#2-product-vision)
3. [Target Users](#3-target-users)
4. [Architecture & Design Principles](#4-architecture--design-principles)
5. [App components (high level)](#5-app-components)

---

## 1. Problem Statement

Current AI chat interfaces suffer from fundamental limitations that hinder professional productivity:

**Information Retrieval**: No search functionality within conversations; valuable insights get buried in long chat histories.

**Context Management**: Primitive "last N messages" approach provides no control over what information influences AI responses.

**Multi-Topic Organization**: Users must maintain separate chats for different topics, leading to context fragmentation and cross-reference difficulties.

**Interface Inefficiency**: Mouse-dependent navigation slows down power users who need rapid access to conversation history and controls.

**Limited Model Access**: Single-vendor lock-in prevents users from leveraging the best model for each specific task.

## 2. Product Vision

MaiChat is a **client-side AI interaction platform** that transforms how users engage with multiple AI models through intelligent conversation management and keyboard-driven navigation.

### Core Principles

**Keyboard-First Navigation**: Complete control through vim-like commands without mouse dependency.

**WYSIWYG Context Management**: Transparent filtering system where the displayed (visible) conversation exactly matches what gets sent to AI models.

**Multi-Model Flexibility**: Dynamic switching between AI providers (OpenAI, Anthropic, etc.) within a unified conversation stream.

**Metadata-Rich Interactions**: Every exchange tagged with timestamp, model, category, importance rating, and semantic context.

**Professional User Experience**: Built for serious AI users who need precise control and efficient workflows.

### Key Features

- **Universal Conversation Stream**: All models and topics in one timeline with rich metadata
- **CLI-Based Context Management**: Command-line filtering system for precise message selection
- **Three-Mode Interface**: Modal interaction system mapping to functional UI areas
- **Hierarchical Topic Management**: Tree-based topic organization with keyboard navigation
- **Intelligent Context Construction**: Chronological, visible (WYSIWYG) context today; relevance‑based selection is a future roadmap item.

### Modal System

MaiChat implements a **three-mode interface** that maps directly to the application's three functional areas, following vim-inspired modal interaction principles:

**Input Mode** (Default)
- **Purpose**: Message composition and metadata editing
- **Focus**: Bottom input area (message textarea, model selector, topic assignment)
- **Key Operations**: Type message, Ctrl+T for topic selection, Enter to execute request
- **Transitions**: Escape → View Mode

**View Mode** 
- **Purpose**: Conversation history navigation and message operations
- **Focus**: Middle history area (message browsing, active message selection)
- **Key Operations**: j/k navigation, g/G positioning, copy/edit operations on active message
- **Transitions**: Enter → Input Mode, Escape → Command Mode

**Command Mode**
- **Purpose**: Context management and conversation filtering
- **Focus**: Top CLI area (filter command input with immediate activation)
- **Key Operations**: Type filter commands (e.g., `model:gpt-4 recent:10 starred:2+`)
- **Transitions**: Enter → apply filter and switch to View Mode; Escape → clear filter (if any) and remain in Command Mode

**Navigation Flow**: `VIEW --Enter--> INPUT --Esc--> VIEW --Esc--> COMMAND --Enter--> VIEW`. Direct overrides: Ctrl+I (INPUT), Ctrl+V (VIEW), Ctrl+D (COMMAND).

## 3. Target Users

### Primary: AI Power Users
- Researchers conducting multi-topic investigations
- Developers working on complex projects requiring model comparison
- Content creators managing multiple writing projects
- Professionals using AI for strategic analysis and planning

### Secondary: Advanced Business Users
- Consultants managing client conversations across different domains
- Analysts requiring organized information retrieval from AI interactions
- Project managers coordinating AI-assisted workflows

### User Characteristics
- Comfortable with keyboard shortcuts and command-line interfaces
- Value efficiency and precision over visual aesthetics
- Engage in complex, multi-session AI conversations
- Need reliable access to historical AI interactions

## 4. Architecture & Design Principles

### Technical Architecture

**Pure Client-Side Implementation**: HTML/CSS/JavaScript only — no backend server. Built and served with Vite for modular development.

**Data Persistence**: IndexedDB for conversation history (via adapter) and local storage for lightweight preferences.

**API Integration**: Direct browser fetch() calls to AI provider endpoints.

**File Operations**: HTML5 File API for import/export functionality.

### Design Principles

**Architectural Constraints**:
- ✅ Vanilla HTML/CSS/JavaScript only
- ❌ No server-side components
- ❌ No React, Vue, or complex frameworks


**User Interface**:
- VS Code-inspired dark theme for professional appearance
- Mode-based interaction system (Input/View/Command)
- Responsive design supporting desktop and mobile workflows
- Immediate visual feedback for all user actions

**Code Organization**:
- Modular JavaScript with clear separation of concerns
- CSS custom properties for consistent theming
- Progressive enhancement with graceful degradation

### Operational Benefits

**Simplicity**: Pure client app that runs in any modern browser; built with Vite for local development and bundling.

**Security**: No server vulnerabilities or attack surfaces.

**Portability**: Works on any device without installation or configuration.

**Transparency**: All code is visible and auditable by users.

**Offline Capability**: Full functionality except AI API calls works without internet.


## 5. App components (high level)

The app consists of the following components (not necessarily mapped into files/modules one-to-one)

0. Modal system and Mode management. Modal (vim-like) character of the application. (Input,View,Command)
- Keyboard presses listening, focus and mode transitions control;
- Mode switching and keybindings adaptation to the currenct/active mode;
- General UI layout and mode zones (top - command, middle - view, bottom - input). Spatial reflection of the modal system. Visual/spatial separation of the mode-specific UI zones.

1. Messge history. 
- Message history data model, and metadata attributes (storage and presentation);
- Message partitioning (splitting) into parts for reading convenience and navigation;
- Focused (active) message control; How does the focus move between the messages, what focus does for the message. Keyboard control of the focus.
- Reading regimes, scrolling, positioning of the focused message on the screen;
- Message history UI configuration control (settings) - padding, margins (intra and inter message parts);
- Metadata attributeds editing/update for the messages in history;
- UI styling, elements alignment, productivity, ergonomics of the message history reading, navigation, and search.

2. Topic management system.
- Data model of the hierarchical topic tree, storage and retrieval, basic operations.
- Topic editor. CRUD operations, navigation of the tree, renaming and rearrangement of the branches, message history statistics by topic. Keyboard-based navigation and search.
- New message topic selector. Select topic for the new message. Persistence. Efficient, user-friendly, keyboard-based navigation and search.

3. Command line filtering system.
- Filtering language specification
- Filtering language application to manage presentation of the message history.
- Message history filtering and display
- Command line commands history persistence and usage.
- Command line language extensions beyond filtering.

4. New message processing (including API calls)
- New message input (prompt/request) and metadata attributes specification;
- Fitting history computation and marking of the messge history in the UI. Fitting history - the messages that can be inlcuded into the assembled request in addition to the current message/request;
- Context assembly, and the API call full request composition, making API call, collecting response, managing waiting for the response state;
- Processing the LLM response, updating message history, managing post-response focus, mode swtiching, navigation, and UI badges update (message counter);
- Error processing, editing or/and deleteing messages from the history.

5. Configuration management.
- API keys, input, storage, and application in API calls.
- UI preferences management.
- Help system.

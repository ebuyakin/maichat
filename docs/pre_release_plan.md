# MaiChat v1.0 Pre-Release Plan

**Date**: October 11, 2025  
**Status**: Planning Phase  
**Target**: First Public Release

---

## 🎯 **Overview**

This is the first real public release of MaiChat. Previous version was internal testing for GitHub Pages deployment. We treat this as **Version 1.0** with no prior changelog.

**Key Goals:**
1. Create discoverable landing page (SEO + marketing)
2. Polish user onboarding experience
3. Ensure sensible defaults for new users
4. Prepare for public promotion

---

## 📐 **New Site Structure**

### **Current (Internal Testing)**
```
maichat.app/
└── index.html → App directly
```

### **Proposed (v1.0)**
```
maichat.app/
├── index.html          → Landing page (NEW - for discovery/SEO)
├── app.html            → The actual app (renamed from index.html)
├── tutorial.html       → Tutorial page (keep accessible)
└── docs/              → Documentation // EB: the current documentation is mostly for development, it will be available on github, but it shouldn't be accessible via user's interface
```

**Rationale:**
- Landing page serves two purposes: explain the app + SEO/discoverability
- Separates marketing from application
- Search engines index the landing page
- Users can bookmark app.html directly after first visit

---

## 📄 **Landing Page Design (index.html)**

### **Hero Section**
```
┌─────────────────────────────────────────────┐
│                                             │
│              MaiChat                        │
│   Keyboard-First LLM Client for Power Users│
│                                             │
│         [Launch App →]                      │
│                                             │
│  "A unified interface for ChatGPT, Claude,  │
│   and other LLMs with advanced organization,│
│   filtering, and context control"           │
│                                             │
└─────────────────────────────────────────────┘
```

### **Key Features (4 blocks)**

**1. 🌳 Topic Tree Organization**
- **Hierarchical structure** - Organize conversations like files in folders
- **Custom system messages** - Define AI behavior per topic with tailored prompts
- **Topic-specific models** - Set different temperature and token limits for each topic
- **Instant topic switching** - Jump between conversations in milliseconds (Ctrl+T), no reloading delays
- **Flexible reassignment** - Move any message to any topic anytime, reorganize on the fly
- **Never lose context** - No more scattered chats across multiple apps

**2. ⌨️ Keyboard-Centric Workflow**
- **Modal interface** - Vim-inspired modes (Input/View/Command) keep keys contextual and conflict-free
- **Fluid navigation** - j/k/g/G for browsing, u/d for message jumps, all without reaching for arrow keys
- **Minimal friction** - Access any feature in 1-2 keystrokes, zero unnecessary clicks
- **One-click actions** - Copy code blocks, formulas, or entire messages instantly
- **Mouse optional** - Fully keyboard-driven, but mouse works when you want it

**3. 🔍 Powerful Search & Filtering**
- **Multi-dimensional filters** - By topic, model, date, rating, content, or any combination
- **CLI-like query language** - Combine filters with AND/OR/NOT, use wildcards
- **Universal search** - Query your entire conversation history across all topics in one view
- **Smart discovery** - Star-rate and color-code messages to mark what matters
- **Instant results** - See filtered view immediately, no page reloads
- **Reusable queries** - Command history saves your frequent searches

**4. 🎯 Context Control**
- **Visual context boundary** - See exactly what goes to the AI with clear indicators
- **Precise filtering** - Include only relevant messages via simple queries before sending
- **Token budget control** - Manage context size to fit model limits perfectly
- **Multi-model comparison** - Switch models to see different context calculations
- **Flexible inclusion** - Adjust what the AI sees without editing or deleting messages
- **No surprises** - Always know what context you're working with

### **Quick Start Section**
```
Getting Started in 60 Seconds:
1. Set your API keys (OpenAI, Anthropic, etc.)
2. Start typing in Input Mode
3. Press Enter to send
4. Navigate with j/k, filter with command mode

[View Tutorial →]
```

### **Target Audience**
```
Perfect For:
✓ Developers & Researchers
✓ Writers & Content Creators  
✓ Power users who prefer keyboard shortcuts
✓ Anyone managing complex LLM conversations
✓ Users who want to organize and search chat history
```

### **Technical Details**
```
- Pure client-side JavaScript (no backend)
- Your data stays in your browser
- API keys stored locally
- Open source on GitHub
- Works with: OpenAI, Anthropic, Google Gemini

[GitHub →] [Tutorial →] [Documentation →]
```

### **Footer**
```
License: MIT | Version 1.0 | © 2025
Made with ❤️ for keyboard enthusiasts
```

---

## 📝 **Tutorial Rewrite Plan**

### **Current Tutorial Assessment**

**Strengths:**
- ✅ Comprehensive coverage
- ✅ Good structure (quickstart → details)
- ✅ Clear examples
- ✅ Good troubleshooting section

**Issues to Address:**
- ❌ Too dense for first-time users
- ❌ Jumps between concepts
- ❌ Missing visual hierarchy
- ❌ No progressive disclosure (everything at once)

### **Proposed New Structure**

```markdown
# MaiChat Tutorial

## 🚀 5-Minute Getting Started

### Step 1: Set Your API Key (30 seconds)
- Press Ctrl+K (or Cmd+K on Mac)
- Select your provider (OpenAI/Anthropic/Google)
- Paste your API key
- Click Save
- ℹ️ Keys are stored locally in your browser only

### Step 2: Send Your First Message (60 seconds)
- You start in Input Mode (bottom input box)
- Type your message
- Press Enter to send
- Watch the response appear in the history above
- ℹ️ Responses are saved automatically

### Step 3: Navigate History (60 seconds)
- Press j to move down, k to move up
- Press g to jump to first message, G for last
- Press r to toggle centered scrolling (Typewriter Mode)
- Press Esc to leave Input Mode and browse freely

### Step 4: Organize with Topics (90 seconds)
- Press Ctrl+T to pick a topic for your message
- Press Ctrl+E to open Topic Editor
- Create topics like: Work, Personal, Research
- Assign messages to topics anytime
- ℹ️ Every message belongs to exactly one topic

### Step 5: Filter Your History (90 seconds)
- Press Ctrl+D to enter Command Mode (top bar)
- Type: t'work' to see only Work topic
- Type: r30 s>=2 to see last 30 messages rated 2+ stars
- Press Enter to apply filter, Esc to clear
- ℹ️ Filters don't delete messages, just show/hide them

---

## 💡 Core Concepts

### The Three Modes
[Visual diagram showing three areas]

**Input Mode (Bottom Area)**
- Type new messages
- Pick topic/model
- Send with Enter

**View Mode (Middle Area)**  
- Browse message history
- Navigate with j/k/g/G
- Rate messages (1/2/3)
- Edit topic assignments

**Command Mode (Top Bar)**
- Type filter queries
- Search and organize
- Apply with Enter

**Mode Switching:**
- Enter/Esc cycle between modes contextually
- Ctrl+I → Input, Ctrl+V → View, Ctrl+D → Command (direct jump)

### Topic Tree
[Visual tree diagram]

```
📁 Root
├─ 📁 Work
│  ├─ 📁 Project A
│  └─ 📁 Project B
├─ 📁 Personal
│  ├─ 📁 Learning
│  └─ 📁 Ideas
└─ 📁 Research
```

**Key Points:**
- Hierarchical structure (folders within folders)
- Every message has exactly one topic
- Reassign anytime with Ctrl+T
- Filter by topic path: `t'Work>Project A'`
- Include descendants: `t'Work...'`

### Context Boundary

[Visual diagram with colored messages]

```
Messages sent to AI:
┌────────────────────┐
│ User: Question 1   │ ← In context (white)
│ AI: Answer 1       │
│ User: Question 2   │
│ AI: Answer 2       │
├────────────────────┤ ← Context boundary (line)
│ User: Question 3   │ ← Off context (dimmed)
│ AI: Answer 3       │
└────────────────────┘
```

**What it means:**
- Shows what goes to the AI in next request
- Depends on model's context limit
- Older messages get "trimmed" if needed
- Jump to boundary with 'o' key
- Visual: "off" badge and dimmed text

---

## 🎹 Keyboard Reference

### Essential Keys (View Mode)

**Navigation**
| Key | Action |
|-----|--------|
| j | Next message part |
| k | Previous message part |
| g | Jump to first message |
| G | Jump to last message |
| o / Shift+O | Jump to context boundary |
| u | Previous message (top align) |
| d | Next message (top align) |
| r | Toggle Typewriter Mode (centered scrolling) |

**Actions**
| Key | Action |
|-----|--------|
| 1/2/3 | Set star rating (1-3 stars) |
| Space | Clear star rating |
| a | Toggle color flag (blue/grey) |
| Ctrl+T | Change topic of active message |
| e | Edit & resend (error messages) |
| w | Delete (error messages) |
| Y | Copy message text to clipboard |

**Mode Switching**
| Key | Action |
|-----|--------|
| Enter | Switch to Input Mode |
| Esc | Cycle through modes |
| Ctrl+I | Jump to Input Mode |
| Ctrl+V | Jump to View Mode |
| Ctrl+D | Jump to Command Mode |

### Essential Keys (Input Mode)

| Key | Action |
|-----|--------|
| Enter | Send message |
| Esc | Back to View Mode |
| Ctrl+M | Open Model Selector |
| Ctrl+T | Pick topic for next message |
| Ctrl+U | Clear input to start |
| Ctrl+W | Delete word to left |
| Ctrl+E | Move to end of input |
| Ctrl+A | Move to start of input |

### Essential Keys (Command Mode)

| Key | Action |
|-----|--------|
| Enter | Apply filter and switch to View |
| Esc | Clear input / exit to View |
| Ctrl+P | Previous command (history) |
| Ctrl+N | Next command (history) |
| Ctrl+U | Clear input to start |
| Ctrl+W | Delete word to left |

### Global Keys (Any Mode)

| Key | Action |
|-----|--------|
| F1 | Open Help overlay |
| Ctrl+. | Open Menu |
| Ctrl+E | Open Topic Editor |
| Ctrl+Shift+M | Open Model Editor |
| Ctrl+Shift+T | Open Topic Editor (alt) |
| Ctrl+, | Open Settings |
| Ctrl+K | Open API Keys |
| Ctrl+Shift+D | Open Daily Stats |

---

## 🔍 Command Language

### Quick Reference

**Basic Filters**
| Filter | Example | Description |
|--------|---------|-------------|
| `t'...'` | `t'work'` | Topic name/path match |
| `m'...'` | `m'gpt-4o'` | Model match |
| `c'...'` | `c'error'` | Content search |
| `d...` | `d<7d` | Date/age filter |
| `r...` | `r30` | Recent count |
| `s...` | `s>=2` | Star rating |
| `b` | `b` | Blue flag only |
| `g` | `g` | Grey flag only |
| `e` | `e` | Errors only |

**Operators**
| Operator | Example | Description |
|----------|---------|-------------|
| Space / `&` | `t'work' s>=2` | AND |
| `\|` / `+` | `m'gpt*' \| m'claude*'` | OR |
| `!` | `!e` | NOT (exclude) |
| `(...)` | `(b \| s3) & t'work'` | Grouping |

**Wildcards**
- `*` - any characters: `t'*AI*'`, `m'gpt*'`
- `...` - descendants: `t'Work...'` (Work and all children)

### Examples with Explanations

**Example 1: Last 30, rated 2+ stars**
```
r30 & s>=2
```
**What it does:** Shows your 30 most recent conversations that you rated 2 or 3 stars  
**Why use it:** Quick access to high-quality recent discussions

**Example 2: Work discussions from last week**
```
t'work...' & d<7d
```
**What it does:** All messages under Work topic (including subfolders) from past 7 days  
**Why use it:** Weekly review of work-related conversations

**Example 3: Compare models on coding**
```
(m'gpt-4*' | m'claude*') & t'coding...'
```
**What it does:** Show GPT-4 and Claude messages in Coding topic  
**Why use it:** Compare how different models handled coding questions

**Example 4: Flagged or highly rated research**
```
(b | s3) & t'research...' & !e
```
**What it does:** Blue-flagged OR 3-star messages in Research, excluding errors  
**Why use it:** Find your best research discussions

**Example 5: Recent bugs that need fixing**
```
c'bug' & c'fix' & t'code' & d<30d
```
**What it does:** Messages containing both "bug" and "fix" in Code topic from last 30 days  
**Why use it:** Track ongoing bug fixes

### Topic Filter Patterns

**Exact match:**
- `t'AI'` - exact topic name
- `t'AI > Learning > Transformers'` - full path

**Wildcards:**
- `t'*Learning'` - ends with "Learning"
- `t'Machine*'` - starts with "Machine"
- `t'*Neural*'` - contains "Neural"

**Descendants:**
- `t'AI...'` - AI and all children/grandchildren
- `t'*AI*...'` - any topic containing "AI" plus descendants

**Current topic:**
- `t` - (bare) uses currently selected topic from input bar

### Date Filter Forms

**Absolute dates:**
- `d2025-10-08` - exact day
- `d>=2025-10-01` - on or after
- `d<=2025-10-31` - on or before
- `d>=2025-10-01 & d<=2025-10-31` - closed interval (October 2025)

**Relative ages:**
- `d<24h` - less than 24 hours ago
- `d<7d` - less than 7 days ago
- `d<2w` - less than 2 weeks ago
- `d<6mo` - less than 6 months ago
- `d<1y` - less than 1 year ago
- `d>=3d & d<=14d` - between 3 and 14 days ago

**Default unit is days:**
- `d<7` is same as `d<7d`

---

## 🛠️ Advanced Features

### Model Editor (Ctrl+Shift+M)

**Purpose:** Manage your model catalog and usage limits

**What you can configure per model:**
- **Enabled/Disabled** - Include in model selector (Ctrl+M)
- **Context Window** - Max tokens (affects context boundary)
- **TPM** - Tokens per minute (rate limit tracking)
- **RPM** - Requests per minute (rate limit tracking)
- **TPD** - Tokens per day (daily budget tracking)

**Adding custom models:**
1. Open Model Editor (Ctrl+Shift+M)
2. Click "Add" or use 'n' key
3. Enter model ID (e.g., 'gpt-4-custom')
4. Set context window and limits
5. Save with Ctrl+S

**Base vs Custom models:**
- Base models (OpenAI, Anthropic, Google) can be disabled but not deleted
- Custom models can be fully removed

**How limits affect context:**
- Context boundary is calculated per active model
- Larger context window = more history included
- When exceeded, oldest messages are trimmed
- Switch models to see different boundaries

### Context Management

**Settings that affect context (Ctrl+,):**

**User Request Allowance (URA)** - Default: 600 tokens
- Reserved space for new prompt + expected response
- Higher value = longer prompts allowed, but less history included
- Lower value = more history included, but shorter prompts

**Chars Per Token (CPT)** - Default: 4.0
- Estimation factor for token counting
- Higher CPT = fewer tokens estimated = more history
- Adjust based on your content (code vs prose)

**Max Trim Attempts (NTA)** - Default: 50
- How many iterations to try fitting context
- Rarely needs adjustment

**Message Counter (top-right):**
- Format: `X/Y` - X predicted included, Y currently visible
- `(-) X/Y` - Newest message hidden by filter
- `[S-T]/Y` - S sent after trimming T pairs
- Tooltip shows: predicted tokens, URA status, trim count

**Tips:**
- Use 'o' key to jump to context boundary
- Off-context messages are dimmed with "off" badge
- Switching models changes boundary in real-time
- Use filters to reduce visible set before sending

### Custom Topic Organization

**Strategies:**

**By Project:**
```
Work
├─ Project Alpha
├─ Project Beta
└─ Administrative
```

**By Subject:**
```
Learning
├─ Programming
│  ├─ Python
│  └─ JavaScript
└─ Design
   ├─ UI/UX
   └─ Typography
```

**By Context:**
```
Research
├─ Literature Review
├─ Methodology
└─ Data Analysis
```

**Tips:**
- Start broad, subdivide as needed
- Use consistent naming
- Avoid too deep nesting (3-4 levels max)
- Reassign messages freely - not permanent

### Reading Mode & Typewriter Regime

**Reading Mode (future feature):**
- Not yet implemented in v1.0
- Planned: Distraction-free reading view

**Typewriter Regime (r key):**
- Centers active message on screen during navigation
- Enabled: j/k always keep message centered
- Disabled: Minimal scrolling, message moves up/down
- Use when: Reading long replies continuously
- Toggle off when: Quick scanning, many short messages

---

## ❓ FAQ & Troubleshooting

### Getting Started

**Q: Do I need to install anything?**  
A: No, MaiChat runs entirely in your browser. Just visit the site.

**Q: Where is my data stored?**  
A: Everything is stored locally in your browser (IndexedDB). Your data never leaves your device.

**Q: What if I clear my browser data?**  
A: Your conversation history will be lost. Consider exporting important conversations (`:export` command).

**Q: Which browsers are supported?**  
A: Modern browsers (Chrome, Firefox, Safari, Edge). JavaScript must be enabled.

### API Keys

**Q: Are my API keys safe?**  
A: Keys are stored in browser localStorage, never sent anywhere except directly to the LLM provider (OpenAI, Anthropic, etc.).

**Q: Can I use multiple providers?**  
A: Yes! Set keys for OpenAI, Anthropic, and Google. Switch models with Ctrl+M.

**Q: What if my API key is invalid?**  
A: You'll see an error message. Open API Keys (Ctrl+K) and update the key.

### Navigation

**Q: Keys don't respond / nothing happens when I press j/k**  
A: You may be in the wrong mode. Press Esc to cycle modes, or Ctrl+V to jump directly to View Mode.

**Q: Mouse clicks don't work as expected**  
A: MaiChat is keyboard-first. When you click, it may switch modes automatically. Try using keyboard shortcuts (press F1 for reference).

**Q: How do I scroll with the mouse?**  
A: Mouse scrolling works normally in the history area. But keyboard navigation (j/k/u/d) is recommended for precise control.

### Messages & Topics

**Q: Can't find a message I sent earlier**  
A: It might be filtered out. Press Ctrl+D, clear any filter (Esc), then search:
- By topic: `t'topicname'`
- By content: `c'keyword'`
- By date: `d<30d` (last 30 days)

**Q: How do I move a message to a different topic?**  
A: Navigate to the message (View Mode), press Ctrl+T, select the new topic.

**Q: Can I delete messages?**  
A: Currently only error messages can be deleted (w key). Full delete feature coming in future release.

**Q: What does the "off" badge mean?**  
A: That message is outside the context boundary - it won't be sent to the AI in the next request. See Context Management section.

### Filtering

**Q: My filter shows no results**  
A: Check your syntax. Common mistakes:
- Missing quotes: use `t'work'` not `t work`
- Wrong wildcards: use `*` not `%`
- Logic errors: AND has higher precedence than OR

**Q: How do I clear a filter?**  
A: Press Ctrl+D (Command Mode), then Esc to clear input. The filter clears immediately.

**Q: Filter is case-sensitive?**  
A: No! All filters are case-insensitive: `t'WORK'` = `t'work'` = `t'Work'`

### Models & Context

**Q: Why are old messages dimmed?**  
A: They're outside the context window for the current model. The AI won't see them in the next request. Use a larger context model or apply filters to reduce history.

**Q: What does "trimmed" mean in the message counter?**  
A: The app tried to fit history into the model's context window but had to remove older messages. This is normal for long conversations.

**Q: Can I change which model is used for old messages?**  
A: No, messages remember which model generated them. But you can switch models for new messages (Ctrl+M).

**Q: How do I add a new model?**  
A: Open Model Editor (Ctrl+Shift+M), click Add (or press 'n'), fill in the ID and limits, save with Ctrl+S.

### Performance

**Q: App is slow with many messages**  
A: Apply filters to reduce visible set. Use Command Mode (Ctrl+D) to filter by date (e.g., `d<30d`) or topic.

**Q: Responses are taking long**  
A: This depends on the LLM provider and your API tier. Check your network connection and API status.

### Errors

**Q: "API key missing" error**  
A: Press Ctrl+K, set your OpenAI/Anthropic/Google key, click Save.

**Q: "Context length exceeded" error**  
A: Your conversation is too long. Either:
- Apply a filter to reduce included messages
- Switch to a model with larger context window (Ctrl+M)
- Lower User Request Allowance in Settings (Ctrl+,)

**Q: "Rate limit exceeded" error**  
A: You've hit your API provider's rate limit. Wait a few minutes or upgrade your API tier.

**Q: Message shows "error" badge**  
A: The API request failed. Hover over the badge for details. You can:
- Press 'e' to edit and resend
- Press 'w' to delete the error message
- Check your API key (Ctrl+K)

### Still Need Help?

**Can't find your answer?**
- Press F1 for keyboard shortcuts
- Check GitHub Issues: github.com/yourusername/maichat/issues
- Review documentation: docs section

---

## 🎨 Design & Style Guidelines

### Visual Style
- Dark theme (maintain consistency with app)
- Monospace code blocks
- Clear hierarchy with headers
- Generous whitespace
- Emoji for visual anchors (sparingly)

### Tone
- Friendly but professional
- Concise and action-oriented
- Assume user is technically capable
- Avoid jargon where possible
- Use active voice

### Content Principles
- Progressive disclosure (basics first)
- Each section should be skimmable
- Examples over abstract descriptions
- Visual aids where helpful
- Cross-reference related sections

---

## 🔍 **SEO Strategy**

### Landing Page Meta Tags

```html
<!-- Primary Meta Tags -->
<title>MaiChat - Keyboard-First LLM Client for Power Users | ChatGPT & Claude Interface</title>
<meta name="title" content="MaiChat - Keyboard-First LLM Client">
<meta name="description" content="Unified keyboard-centric interface for ChatGPT, Claude, and other LLMs. Advanced organization with topic trees, powerful CLI filtering, and precise context control. Open source.">
<meta name="keywords" content="ChatGPT client, Claude interface, LLM client, AI chat interface, keyboard shortcuts, vim navigation, context management, topic organization, power user tools">

<!-- Open Graph / Facebook -->
<meta property="og:type" content="website">
<meta property="og:url" content="https://maichat.app/">
<meta property="og:title" content="MaiChat - Keyboard-First LLM Client">
<meta property="og:description" content="Power-user interface for ChatGPT, Claude, and other LLMs with advanced organization, filtering, and context control.">
<meta property="og:image" content="https://maichat.app/preview-image.png">

<!-- Twitter -->
<meta property="twitter:card" content="summary_large_image">
<meta property="twitter:url" content="https://maichat.app/">
<meta property="twitter:title" content="MaiChat - Keyboard-First LLM Client">
<meta property="twitter:description" content="Power-user interface for ChatGPT, Claude, and other LLMs with advanced organization, filtering, and context control.">
<meta property="twitter:image" content="https://maichat.app/preview-image.png">

<!-- Additional SEO -->
<link rel="canonical" href="https://maichat.app/">
<meta name="robots" content="index, follow">
<meta name="language" content="English">
<meta name="author" content="MaiChat">
```

### GitHub Repository Optimization

**Repository Description:**
```
Keyboard-first LLM client with topic organization, CLI filtering, and context control. 
Works with ChatGPT, Claude, and Gemini.
```

**Topics/Tags to Add:**
- `chatgpt`
- `claude`
- `llm-client`
- `keyboard-shortcuts`
- `vim-navigation`
- `context-management`
- `openai`
- `anthropic`
- `conversation-management`
- `javascript`

**README.md Structure:**
1. Eye-catching header with logo
2. One-line description
3. Key features (bullet points)
4. Screenshot/demo
5. Quick start (3 steps)
6. Link to live demo
7. Documentation links
8. License & contributing

---

## 🚀 **Promotion & Launch Strategy**

### Platform-Specific Approaches

#### **1. Product Hunt** (Highest Impact)
**Preparation:**
- Create account if don't have
- Prepare 3-5 high-quality screenshots
- Optional: 30-60 second demo video
- Write compelling tagline (max 60 chars)
- Prepare first comment (explain story/motivation)

**Launch Day:**
- Submit Tuesday-Thursday (best engagement)
- Post at 12:01 AM PST (appears at top all day)
- Be active in comments (respond quickly)
- Ask friends to upvote/comment (genuine only!)
- Cross-post to Twitter

**Tagline Examples:**
- "Keyboard-first LLM client for power users"
- "Vim-inspired interface for ChatGPT & Claude"
- "Organize LLM conversations with topic trees"

#### **2. Hacker News**
**Title Format:**
```
Show HN: MaiChat – Keyboard-centric client for ChatGPT/Claude
```

**Post Guidelines:**
- Include live demo link in title or first comment
- Explain technical choices (client-side, no backend)
- Mention open source
- Be humble, not promotional
- Engage thoughtfully with comments
- Don't ask for upvotes

**Best Times:**
- Weekday mornings (8-11 AM EST)
- Avoid weekends

#### **3. Reddit**

**Target Subreddits:**

**r/ChatGPT** (high visibility)
- Title: "I built a keyboard-first client for ChatGPT with topic organization"
- Include screenshots
- Explain what problem it solves
- Be prepared for questions

**r/ClaudeAI**
- Similar approach
- Emphasize multi-model support

**r/LocalLLaMA**
- Tech-savvy audience
- Emphasize architecture, no backend, privacy

**r/vim** (might be interested in keyboard navigation)
- "Applied vim navigation to LLM conversations"
- Emphasize j/k/g/G keys, modes

**Posting Tips:**
- Read subreddit rules first
- Don't spam multiple subreddits same day
- Respond to all comments within first hour
- Don't be promotional, be helpful

#### **4. Twitter/X Strategy**

**Launch Thread Structure:**

```
Tweet 1: Announcement
"Excited to launch MaiChat - a keyboard-first client for ChatGPT, Claude, & Gemini 🚀

→ Vim-inspired navigation
→ Topic tree organization  
→ CLI-like filtering
→ Precise context control

Try it: [link]
[Screenshot/GIF]"

Tweet 2: Problem/Solution
"Managing complex LLM conversations is hard. Messages get lost, context is unclear, switching between ChatGPT/Claude is painful.

MaiChat solves this with:
[Screenshot showing topic tree]"

Tweet 3: Key Feature Demo
"Search your entire conversation history with a simple query language:

t'work' & d<7d & s>=2

= Work messages from last 7 days rated 2+ stars

[Screenshot of filter in action]"

Tweet 4: Technical Details
"Built with vanilla JS, no backend. Your data stays in your browser. Open source on GitHub.

Perfect for developers, researchers, writers - anyone doing serious work with LLMs.

[GitHub link]"

Tweet 5: Call to Action
"Try it out and let me know what you think! Feedback welcome 🙏

Live demo: [link]
Docs: [link]
GitHub: [link]"
```

**Hashtags:**
- #ChatGPT
- #Claude
- #LLM
- #OpenAI
- #AI
- #ProductivityTools

**Engagement Tips:**
- Tag relevant accounts (@OpenAI, @AnthropicAI)
- Post 10-11 AM EST weekdays
- Pin thread to profile
- Respond to all replies quickly
- Share to relevant LinkedIn groups

#### **5. Directory Submissions**

**Primary Directories:**

**There's An AI For That** (theresanaiforthat.com)
- Category: Productivity, Development Tools
- Submit tool with screenshots
- Include pricing (Free/Open Source)

**Future Tools** (futuretools.io)
- Similar process
- Emphasize unique features

**AI Tool Master List** (spreadsheet)
- Community-maintained lists
- Find relevant GitHub awesome-lists

**Product Hunt Alternatives:**
- BetaList (if still in beta)
- Indie Hackers
- AlternativeTo

**Dev-Specific:**
- Awesome ChatGPT Tools (GitHub)
- Awesome LLM Tools (GitHub)

#### **6. Content Marketing**

**Blog Post Ideas:**
(Can post on Medium, Dev.to, personal blog)

1. "Why I Built a Keyboard-First LLM Client"
2. "Managing Complex AI Conversations with Topic Trees"
3. "Building a Privacy-First ChatGPT Client"
4. "Power User Tips for LLM Conversations"

**Video Content:**
- 60-second demo for Twitter
- 5-minute walkthrough for YouTube
- Feature highlight GIFs for social media

---

## 📋 **Implementation Checklist**

### **Phase 1: Content Creation** ⏳ Not Started

- [ ] Write landing page copy (index.html)
  - [ ] Hero section
  - [ ] Key features (4 blocks)
  - [ ] Quick start
  - [ ] Target audience
  - [ ] Technical details
  - [ ] Footer with links
  
- [ ] Rewrite tutorial (progressive structure)
  - [ ] 5-minute getting started
  - [ ] Core concepts section
  - [ ] Keyboard reference (tables)
  - [ ] Command language guide
  - [ ] Advanced features
  - [ ] FAQ & troubleshooting
  
- [ ] Create visual assets
  - [ ] Take screenshots for landing page (3-5)
  - [ ] Create preview image for social sharing (1200x630px)
  - [ ] Optional: Record demo video (30-60s)
  - [ ] Create favicon if not exists
  
- [ ] SEO preparation
  - [ ] Meta tags for landing page
  - [ ] Update GitHub repository description
  - [ ] Add GitHub topics/tags

### **Phase 2: Code Changes** ⏳ Not Started

- [ ] File restructuring
  - [ ] Rename `public/index.html` → `public/app.html`
  - [ ] Create new `public/index.html` (landing page)
  - [ ] Update `vite.config.js` if needed for multi-page
  - [ ] Test both pages load correctly
  
- [ ] Update internal links
  - [ ] Menu "Tutorial" button → tutorial.html
  - [ ] Landing page "Launch App" → app.html
  - [ ] Landing page "Tutorial" → tutorial.html
  - [ ] App "Help" overlay → keep F1 shortcut
  
- [ ] Navigation flow
  - [ ] Landing page auto-detection (if API keys exist, offer direct app link)
  - [ ] App page can be bookmarked/shared directly
  - [ ] All paths work with GitHub Pages routing

### **Phase 3: Initialization & Defaults** ⏳ Not Started

- [ ] Default settings review
  - [ ] Compare current settings with user's preferred settings
  - [ ] Set sensible defaults for new users
  - [ ] Document any controversial choices
  
- [ ] Default model catalog
  - [ ] Set reasonable usage limits (TPM/RPM/TPD)
  - [ ] Enable commonly-used models
  - [ ] Provide context window sizes from official docs
  - [ ] Add helpful model descriptions
  
- [ ] Default topic tree
  - [ ] Create initial structure (Work/Personal/Research?)
  - [ ] Consider user's likely use cases
  - [ ] Keep it simple (3-5 top-level topics max)
  - [ ] Add brief descriptions/hints
  
- [ ] Welcome message / First run experience
  - [ ] Create welcome message explaining basics
  - [ ] Prompt for API key setup (Ctrl+K)
  - [ ] Offer quick tutorial link
  - [ ] Optional: Interactive onboarding (future)

### **Phase 4: Code Polish** ⏳ Not Started

- [ ] Remove debug code
  - [ ] Search for `console.log` statements
  - [ ] Remove `debugger` statements
  - [ ] Check for `window.__debug` flags
  - [ ] Remove `reqdbg=1` development features (or document)
  
- [ ] Update keyboard reference (F1 overlay)
  - [ ] Verify all shortcuts are current
  - [ ] Add any new shortcuts from recent changes
  - [ ] Ensure descriptions are clear
  - [ ] Test all shortcuts work as documented
  
- [ ] Documentation updates
  - [ ] Update README.md
    - [ ] Project description
    - [ ] Features list
    - [ ] Quick start (3 steps)
    - [ ] Link to live demo
    - [ ] Screenshot
    - [ ] Development setup
    - [ ] License
  - [ ] Write CHANGELOG.md (v1.0 as first entry)
  - [ ] Review all docs/ files for accuracy

### **Phase 5: Testing** ⏳ Not Started

- [ ] Functional testing
  - [ ] Test all 10 scrolling scenarios
  - [ ] Test all overlays (Settings, Model Editor/Selector, Topic Editor/Picker)
  - [ ] Test new message workflow (send → receive → error)
  - [ ] Test filters (basic and complex queries)
  - [ ] Test keyboard navigation (j/k/u/d/g/G/o)
  - [ ] Test mode switching (Enter/Esc/Ctrl+V/I/D)
  
- [ ] Edge cases
  - [ ] Empty history
  - [ ] Single message
  - [ ] Very long conversation (1000+ messages)
  - [ ] Messages with code blocks
  - [ ] Messages with equations
  - [ ] Filter with no results
  - [ ] Invalid API key
  - [ ] Network error during send
  
- [ ] Browser compatibility
  - [ ] Chrome/Chromium
  - [ ] Firefox
  - [ ] Safari (Mac)
  - [ ] Edge
  - [ ] Mobile browsers (iOS Safari, Chrome Android)
  
- [ ] Performance
  - [ ] Check for memory leaks
  - [ ] Test with large history (smooth scrolling?)
  - [ ] Test filter performance with complex queries

### **Phase 6: Release Preparation** ⏳ Not Started

- [ ] Version control
  - [ ] Update version number in package.json
  - [ ] Update version in about/footer
  - [ ] Create git tag `v1.0.0`
  - [ ] Write release notes
  
- [ ] Pre-release checks
  - [ ] All tests passing
  - [ ] No console errors
  - [ ] No TypeScript/JSDoc errors
  - [ ] Build succeeds without warnings
  
- [ ] Documentation
  - [ ] All links work (internal and external)
  - [ ] Tutorial matches current behavior
  - [ ] Screenshots are up-to-date
  - [ ] Keyboard reference is accurate

### **Phase 7: Deploy & Launch** ⏳ Not Started

- [ ] GitHub preparation
  - [ ] Push all changes to main branch
  - [ ] Verify GitHub Pages auto-deploys
  - [ ] Test live site (maichat.app)
  - [ ] Verify DNS works correctly
  - [ ] Check HTTPS certificate
  
- [ ] Final verification
  - [ ] Landing page loads correctly
  - [ ] App page works (app.html)
  - [ ] Tutorial page accessible
  - [ ] All images load
  - [ ] No mixed content warnings
  
- [ ] Announce release
  - [ ] Create GitHub Release (v1.0.0)
  - [ ] Post changelog in release notes
  - [ ] Tag release with `v1.0.0`

### **Phase 8: Promotion** ⏳ Not Started

- [ ] Product Hunt
  - [ ] Create account / log in
  - [ ] Prepare materials (screenshots, description)
  - [ ] Submit product (Tuesday-Thursday morning)
  - [ ] Engage with comments actively
  
- [ ] Hacker News
  - [ ] Post "Show HN" (weekday morning)
  - [ ] Monitor and respond to comments
  - [ ] Be helpful, not defensive
  
- [ ] Reddit
  - [ ] Post to r/ChatGPT
  - [ ] Post to r/ClaudeAI (wait 1-2 days)
  - [ ] Post to r/LocalLLaMA (wait 1-2 days)
  - [ ] Consider r/vim (if relevant)
  
- [ ] Twitter/X
  - [ ] Post launch thread (5 tweets)
  - [ ] Tag @OpenAI, @AnthropicAI
  - [ ] Use relevant hashtags
  - [ ] Pin thread to profile
  - [ ] Engage with replies
  
- [ ] Directory submissions
  - [ ] There's An AI For That
  - [ ] Future Tools
  - [ ] Relevant GitHub awesome-lists
  - [ ] AlternativeTo
  
- [ ] Content marketing (optional)
  - [ ] Write blog post about motivation
  - [ ] Post on Dev.to or Medium
  - [ ] Share technical insights
  - [ ] Create demo video for YouTube

---

## 📊 **Success Metrics**

### **Launch Week Goals**
- 100+ GitHub stars
- 500+ unique visitors to landing page
- 50+ app sessions
- 5+ pieces of user feedback
- Featured on 1+ directory/aggregator

### **First Month Goals**
- 500+ GitHub stars
- 2,000+ unique visitors
- 200+ active users
- 10+ community contributions (issues/PRs)
- Coverage in 1+ tech blog/newsletter

### **Metrics to Track**
- GitHub stars/forks/watchers
- Website analytics (visitors, sessions, bounce rate)
- User engagement (messages sent, avg session length)
- Feedback channels (GitHub issues, email, social)
- Search engine ranking for key terms

---

## 🔄 **Post-Launch Activities**

### **First Week**
- Monitor all launch channels daily
- Respond to feedback within 24 hours
- Fix critical bugs immediately
- Document common questions for FAQ
- Share user testimonials

### **First Month**
- Analyze usage data
- Prioritize feature requests
- Write "lessons learned" post
- Plan v1.1 improvements
- Build community (Discord/Slack?)

### **Ongoing**
- Regular updates (monthly minor releases?)
- Engage with community
- Monitor competitors
- Iterate based on feedback
- Maintain documentation

---

## 📝 **Notes & Decisions**

### **Key Decisions Made**
1. **Landing page approach** - Separate from app for SEO/discovery
2. **Version numbering** - Start at v1.0, no prior changelog
3. **Tutorial structure** - Progressive disclosure (5min start → deep dive)
4. **Promotion strategy** - Product Hunt + HN + Reddit + Twitter
5. **Timing** - No specific date, ready when quality is confirmed

### **Open Questions**
- [ ] Should we include demo video? (nice to have, not critical)
- [ ] Analytics tool? (Google Analytics, Plausible, none?)
- [ ] Feedback mechanism? (GitHub only, or add email/form?)
- [ ] Community platform? (Discord, GitHub Discussions, none?)

### **Future Considerations**
- Localization (i18n) - defer to v2.0
- Mobile optimization - works but not optimized, defer
- Offline mode / PWA - interesting, defer
- Export/import conversations - partially done (`:export`), improve later
- Collaboration features - way future

---

## ✅ **Final Pre-Launch Checklist**

**Must Have (Blocking Release):**
- [ ] Landing page complete and polished
- [ ] Tutorial rewritten and accurate
- [ ] Default settings/catalog/topics configured
- [ ] All debug code removed
- [ ] No console errors
- [ ] Works in all major browsers
- [ ] GitHub Pages deployment tested
- [ ] README and CHANGELOG written

**Should Have (Strongly Recommended):**
- [ ] 3-5 quality screenshots
- [ ] Preview image for social sharing
- [ ] Keyboard reference updated (F1)
- [ ] All 10 scrolling scenarios tested
- [ ] GitHub repository polished

**Nice to Have (Optional):**
- [ ] Demo video (30-60s)
- [ ] Blog post about motivation
- [ ] Community feedback before launch
- [ ] Mobile testing

---

**Document Status:** Living document, update as work progresses  
**Last Updated:** October 11, 2025  
**Next Review:** After Phase 1 completion

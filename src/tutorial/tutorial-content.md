## What is MaiChat {#overview}

MaiChat is a keyboard-centric interface for ChatGPT, Claude, Gemini, and Grok that puts you in control. Unlike standard chat interfaces, MaiChat organizes your conversations into a hierarchical topic tree, lets you filter message history with a powerful CLI-like language, and gives you precise control over what context gets sent to each model. It's designed for power users who want to work faster, stay organized, and maintain complete control over their AI interactions.

## Quickstart (5 minutes) {#quickstart}

Get MaiChat running and send your first message. This guide covers everything you need to start using the app effectively.

> **Important:** MaiChat is designed for keyboard-first navigation with Vim-style commands (`j`/`k` for scrolling, `u`/`d` for jumping between messages, etc.). While you can use your mouse, learning the keyboard shortcuts will make you much more efficient. Press `F1` anytime to see the full reference.

### Step 1: Set up your API key

MaiChat needs API keys to connect to LLM providers (OpenAI, Anthropic, Google, xAI).

1. Press `Ctrl+K` to open API Keys settings
2. Enter your API key for at least one provider:
   - **OpenAI (ChatGPT)**: Get your key at [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
   - **Anthropic (Claude)**: Get your key at [console.anthropic.com](https://console.anthropic.com)
   - **Google (Gemini)**: Get your key at [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
   - **xAI (Grok)**: Get your key at [console.x.ai](https://console.x.ai)
3. Click Save

> **Note:** API keys are stored locally in your browser and never leave your device.

### Step 2: Choose a model

Before sending your first message, select which AI model to use:

1. Press `Ctrl+M` to open the model selector
2. Browse the available models based on your API keys:
   - **OpenAI**: GPT-5, GPT-5 mini, GPT-5 nano, o4-mini
   - **Anthropic**: Claude Sonnet 4.5, Claude Opus 4.1, Claude 3.5 Haiku
   - **Google**: Gemini 2.5 Pro, Gemini 2.5 Flash, Gemini 2.5 Flash-Lite
   - **xAI**: Grok-4-fast-non-reasoning, Grok-4-fast-reasoning, Grok-code-fast-1
3. Select a model and press `Enter`

The selected model will be used for all messages until you change it.

> **Tip:** Not sure which to choose? Start with GPT-5 nano (OpenAI), Claude Sonnet 4.5 (Anthropic), or Gemini 2.5 Flash-Lite (Google) — they're fast and cost-effective.

### Step 3: Send your first message

You start in **Input Mode** with the cursor already in the message box.

1. Type your message (e.g., "Explain what MaiChat is in one sentence")
2. Press `Enter` to send
3. Watch the response appear in the history area above

### Step 4: Navigate the response

After the response arrives, switch to **View Mode** to read and navigate:

1. Press `Esc` to enter View Mode
2. Use `j` and `k` to scroll the conversation history up and down (like Vim)
3. Use `u` and `d` to scroll to the beginning of the previous/next message
4. Press `g` to jump to the first message, `G` for the last

### Step 5: Organize with topics

MaiChat comes with a starter topic tree (General, Work, Personal, Research) that you can use immediately:

1. Press `Ctrl+T` in Input Mode to see the topic selector
2. Use search box to filter the topic list or press `Ctrl+J` to navigate the tree using `h``j``k``l` keys (vim-style).
3. Select a topic from the list and press `Enter`, the selected topic will be displayed at the bottom of the input zone.
4. Type a message and send it

All future messages will use this topic until you change it. You can reassign messages to different topics anytime.

> **Learn more:** See the [Topics](#topics) section to learn how to customize your topic tree structure and use to manage the context of your requests.

### Step 6: Filter your history

As your history grows, use filters to find messages:

1. Press `Ctrl+D` or (`Esc` from the View mode) to enter Command Mode (top bar)
2. In the filter input box you can type various filters and commands controlling your conversation
3. Try these filters:
   - `r10` — show last 10 message pairs (request and response)
   - `t` - show only current topic messages
   - `t'Learning...'` — show all messages in "Learning MaiChat" topic and subtopics
   - `d<7` - show all messages of the last 7 days
   - `c'happy'` - show all messages with word 'happy' in them.

4. Press `Enter` to apply the filter. The conversation history will be filtered and display only messages matching the filter.

Press `Esc` in Command Mode to clear filters and see all history.

### What's next?

You now know the basics! Here's what to explore next:

- **[Navigation](#modes)** — understand the three modes and how to switch between them
- **[Topics](#topics)** — learn to structure your conversations with topic trees
- **[Search & Filtering](#filtering)** — master the powerful CLI filter language
- **[Context Management](#context)** — control what the model sees in each request
- **[Working with Images](#images)** — attach and manage images in your conversations

> **Quick reference:** Press `F1` anytime to see all keyboard shortcuts.

## Navigation: Understanding Modes {#modes}

MaiChat uses a **vim-inspired modal system** where the same keys perform different functions depending on the current mode. This design maximizes keyboard efficiency:

- **In Input Mode and Command Mode:** Most keys are used for typing text (like a regular editor). Commands and actions typically use `Ctrl+Key` combinations.
- **In View Mode:** There's no text entry, so single key presses perform various navigation and management actions.

This modal approach lets you stay on the home row and accomplish tasks without constantly reaching for the mouse or arrow keys.

### Understanding Modes

MaiChat organizes your interaction into **three distinct modes**, each with its own screen area and keyboard commands.

> **Visual indicator:** The current mode is always shown in a badge at the bottom-left corner of the screen (Vim-style), displaying "INPUT", "VIEW", or "COMMAND".

### The Three Modes

**Input Mode** (bottom area)
- **Purpose:** Compose and send messages to AI models
- **Screen:** Message input box with model and topic selectors
- **Main actions:** Type, send messages, select model/topic
- **Visual cue:** Cursor in the input box, input area highlighted

**View Mode** (middle area)
- **Purpose:** Read, navigate, and manage your message history
- **Screen:** Conversation history display
- **Main actions:** Scroll, jump between messages, rate messages, change topics, copy message content
- **Visual cue:** Active message highlighted in history

**Command Mode** (top area)
- **Purpose:** Filter and search your message history
- **Screen:** Command input bar at the top
- **Main actions:** Type filter commands, navigate command history
- **Visual cue:** Cursor in the command bar, command area highlighted

### Switching Between Modes

**Contextual switching with Enter/Esc:**
- `Enter` — Generally moves you "into" action (View → Input, Command → View)
- `Esc` — Generally moves you "out" or "up" (Input → View, View stays in View, Command → clears)

**Direct mode jumps:**
- `Ctrl+I` — Jump directly to Input Mode
- `Ctrl+V` — Jump directly to View Mode  
- `Ctrl+D` — Jump directly to Command Mode

> **Tip:** `Enter` and `Esc` are your primary navigation keys. Learn these first, use the Ctrl shortcuts when you need to jump quickly.

### View Mode Navigation

This is where you'll spend most of your reading time. View Mode uses Vim-inspired keys:

**Basic scrolling:**
- `j` — Scroll down (toward newer messages)
- `k` — Scroll up (toward older messages)

**Jump to message boundaries:**
- `u` — Jump to the start of the previous message
- `d` — Jump to the start of the next message
- `U` — Scroll current message to top (useful for returning to start of long messages)

**Jump to extremes:**
- `g` — Jump to the very first message in history
- `G` — Jump to the last (newest) message

**Context navigation:**
- `o` — Jump to the context boundary (first message that will be sent to the model)
- `Shift+O` — Also jumps to context boundary (same as `o`)

> **Why u/d instead of arrows?** Keeping your hands on the home row is faster. You'll appreciate it after a few sessions!

### View Mode Actions

Beyond navigation, View Mode lets you manage your messages:

**Rating messages:**
- `1` / `2` / `3` — Set star rating (1-3 stars)
- `Space` — Clear star rating
- `a` — Toggle color flag (blue square or grey circle)

**Managing messages:**
- `Ctrl+T` — Change the topic of the active message
- `e` — Edit and resend (only works on error messages)
- `d` — Delete message (only works on error messages)

**Viewing images:**
- `i` — View image(s) in active message (opens immediately for single image)
- `i1` / `i2` / `i3` / ... / `i9` — Jump directly to specific image

**Viewing links:**
- `l` — Show link hints with numbers (press 1-9 to open link)
- `Ctrl+Shift+S` — Open Sources overlay (view citations from web search)

### Input Mode Shortcuts

When composing messages, these editing shortcuts speed up your workflow:

**Basic actions:**
- `Enter` — Send the message
- `Esc` — Return to View Mode (without sending)
- `Ctrl+C` — Cancel/Abort sending message
- `Ctrl+M` — Open model selector
- `Ctrl+T` — Open topic selector

**Emacs-style text editing:**
- `Ctrl+A` — Move cursor to start of line
- `Ctrl+E` — Move cursor to end of line
- `Ctrl+U` — Delete from cursor to start of line
- `Ctrl+W` — Delete word to the left
- `Ctrl+Shift+F` — Move cursor forward one word
- `Ctrl+Shift+B` — Move cursor backward one word

> **Note:** These same Emacs-style shortcuts work in Command Mode too!

**Attaching images:**
- `Ctrl+F` — Open file picker to select images
- `Cmd+V` (macOS) / `Ctrl+V` (Windows/Linux) — Paste images from clipboard
- `Ctrl+Shift+O` — View/manage attached images before sending

### Command Mode Usage

Command Mode is for searching and filtering. See the [Search & Filtering](#filtering) section for detailed filter syntax.

**Filter actions:**
- `Enter` — Apply filter and switch to View Mode
- `Esc` — Clear the command input (stays in Command Mode)
- `Ctrl+P` — Previous command (command history)
- `Ctrl+N` — Next command (command history)

**Emacs-style text editing:**
- `Ctrl+A` — Move cursor to start of line
- `Ctrl+E` — Move cursor to end of line
- `Ctrl+U` — Delete from cursor to start of line
- `Ctrl+W` — Delete word to the left
- `Ctrl+Shift+F` — Move cursor forward one word
- `Ctrl+Shift+B` — Move cursor backward one word

### Mouse/Touchpad Behavior

You can use your mouse, but it respects the mode system:

- **Clicking the input box** → switches to Input Mode
- **Clicking a message in history** → switches to View Mode and makes that message active
- **Clicking the command bar** → switches to Command Mode

The app automatically switches modes to avoid conflicts with keyboard shortcuts.

### Startup Behavior

When you open or reload MaiChat:
1. App starts in **Input Mode**
2. The newest (last) message is scrolled into view
3. Cursor is ready in the input box

This lets you immediately continue your conversation.

### Common Patterns

**Quick send workflow:**
1. Type message (already in Input Mode)
2. `Enter` to send
3. `Esc` to read response in View Mode
4. `Enter` when ready to reply

**Search and respond:**
1. `Ctrl+D` to enter Command Mode
2. Type filter (e.g., `t'Work' & d<7d`)
3. `Enter` to see filtered messages
4. `Ctrl+I` to jump to Input and compose new message

**Review and rate:**
1. `g` to jump to first message
2. Read and use `1`/`2`/`3` to rate
3. `d` to jump to next message
4. Repeat

> **Learn more:** Press `F1` anytime to see the complete keyboard reference with all shortcuts.

## Topics and the Topic Tree {#topics}

Topics are MaiChat's core organizational feature. Every message belongs to exactly one topic in a hierarchical tree structure, letting you organize thousands of messages without chaos.

### Why Use Topics?

Unlike standard chat interfaces where conversations become one endless scroll, topics give you:

- **Logical grouping:** Keep related conversations together (e.g., all Python questions under "Coding > Python")
- **Easy filtering:** Show only messages from one topic or branch with a simple `t` command
- **Context control:** Filter by topic before sending to include only relevant history
- **Quick navigation:** Jump between different conversation threads without scrolling
- **Retrospective organization:** Reassign messages to different topics as your needs evolve

### The Default Topic Tree

MaiChat starts with a simple topic tree to get you going:

```

General
Work
Personal
Research
```

These are intentionally broad. Start using them immediately, then create subtopics as patterns emerge.

### Creating and Managing Topics

**Quick topic picker (during composition):**
1. Press `Ctrl+T` in Input Mode
2. Search for existing topics or press `n` to create a new one
3. Select a topic — all future messages use it until you change it

**Topic Editor (full management):**
1. Press `Ctrl+Shift+T` from any mode to open the Topic Editor
2. Use keyboard navigation:
   - `j`/`k` — Move down/up the tree
   - `h`/`l` — Collapse/expand branches
   - `n` — Create new child topic
   - `N` — Create new root-level topic
   - `r` — Rename focused topic
   - `d` — Delete topic (requires confirmation)
3. Press `Ctrl+S` to save changes

> **Tip:** The Topic Editor shows keyboard hints at the top. It's a powerful interface once you learn the keys!

### Reassigning Messages to Topics

Made a mistake? Want to reorganize? You can change any message's topic:

1. Navigate to the message in View Mode
2. Press `Ctrl+T` to open the topic picker
3. Select the new topic

The message immediately moves to the new topic. This works on both user requests and assistant responses.

### Topic Hierarchy Best Practices

**Start broad, go deep gradually:**
```
✓ Good progression:
  Work
  Work > Client Projects
  Work > Client Projects > Acme Corp
  Work > Client Projects > Acme Corp > Q4 Campaign

✗ Avoid premature detail:
  Work > Client Projects > Acme Corp > Q4 Campaign > Week 1 > Monday
```

**Use 2-4 levels typically:**
- **Level 1:** Major life areas (Work, Personal, Learning)
- **Level 2:** Broad categories (Coding, Writing, Research)
- **Level 3:** Specific projects or themes (Python, Blog Posts, AI Papers)
- **Level 4:** Occasional subcategories (only when clearly needed)

**Common patterns:**

**By domain:**
```

Work
  ├─ Projects
  ├─ Meetings
  └─ Documentation
Personal
  ├─ Health
  ├─ Finance
  └─ Travel
Learning
  ├─ Programming
  ├─ Languages
  └─ History
```

**By project:**
```

Projects
  ├─ Website Redesign
  │   ├─ Frontend
  │   ├─ Backend
  │   └─ Content
  └─ Mobile App
      ├─ iOS
      └─ Android
```

**By technology:**
```

Coding
  ├─ Python
  ├─ JavaScript
  ├─ SQL
  └─ DevOps
```

### Topic Naming Tips

- **Be specific but not too narrow:** "Python Web Scraping" is better than just "Python" or "BeautifulSoup Tutorial Chapter 3"
- **Use consistent patterns:** If you abbreviate, do it consistently (e.g., "JS" vs "JavaScript")
- **Keep names short:** Long names clutter the UI and are harder to filter
- **Avoid dates in names:** Use date filters (`d<7d`) instead of "January 2025 Work"

### Filtering by Topics

Once you have topics organized, filtering becomes powerful:

**Show single topic:**
- `t'Work'` — Only "Work" topic (exact match)
- `t` — Current topic (whatever's selected in Input Mode)
- `t10` — Last 10 messages of current topic
- `t5` — Last 5 messages of current topic

**Show topic branch:**
- `t'Work...'` — "Work" and all subtopics (recursive)
- `t'Coding...'` — Everything under "Coding"

**Wildcards:**
- `t'*Python*'` — Any topic containing "Python"
- `t'Work > *'` — Direct children of "Work" only

**Combine with other filters:**
- `t'Coding...' & d<7d` — Recent coding conversations
- `t'Work...' & s>=2` — Important work messages
- `(t'Python...' | t'JavaScript...') & c'error'` — Errors in either language

See the [Search & Filtering](#filtering) section for complete filter syntax.

### Archive Pattern

Create an "Archive" topic for old conversations you want to keep but rarely need:

```

Archive
  ├─ 2024
  └─ 2025
```

Then filter them out by default: `!t'Archive...'`

### When to Split Topics

Consider creating a subtopic when:
- A topic has 50+ messages and distinct themes emerge
- You find yourself wanting to filter within a topic
- Multiple unrelated conversations share a topic
- A project or theme becomes significant enough to track separately

Don't create subtopics prematurely. Let your usage patterns guide the structure.

### Topic Metadata (Advanced)

Topics can have additional settings:

**System message:**
- Custom instructions for the AI model in this topic
- Press `Ctrl+E` on a topic in the Topic Editor
- Each topic has its own independent system message

**Temperature:**
- Control creativity (0.0-2.0)
- Press `Ctrl+T` on a topic in the Topic Editor

**Max response length:**
- Limit assistant response tokens
- Press `Ctrl+L` on a topic in the Topic Editor

These are optional and most users can ignore them initially.

### Customizing Model Behavior

System messages are powerful tools for shaping how the AI responds in specific topics. Think of them as persistent instructions that apply to every conversation in that topic branch.

**When to use custom system messages:**
- You want a consistent style or tone for a topic area
- You need specific output formats (citations, code, LaTeX)
- You want the AI to adopt a particular role or expertise level
- You have recurring requirements that shouldn't be repeated in every message

**Example system messages:**

**Style variations:**
- *Be extremely concise. Use bullet points. No fluff.*
- *Write in a friendly, conversational tone. Use analogies and examples.*
- *Respond formally and professionally, suitable for business communications.*

**Expertise & personas:**
- *You are an expert Python developer. Focus on best practices, performance, and clean code. Cite PEPs when relevant.*
- *Act as a patient tutor explaining math concepts to a high school student. Use simple language and step-by-step reasoning.*
- *You are a creative writing coach. Provide constructive feedback on style, structure, and narrative flow.*

**Format requirements:**
- *Always cite sources when making factual claims. Use [Author, Year] format.*
- *Write mathematical expressions in LaTeX. Use display mode ($$...$$) for equations.*
- *Respond only with valid JSON. No explanatory text outside the JSON structure.*

**Domain-specific contexts:**
- *Focus on front-end web development with React and TypeScript. Assume familiarity with modern JavaScript.*
- *Discuss health topics from an evidence-based perspective. Remind me to consult healthcare professionals for medical advice.*

**Tips:**
- Keep system messages focused and actionable
- Test them with a few messages to refine the instructions
- Remember: system messages consume tokens from your context budget
- You can update them anytime without affecting existing messages

### Common Questions

**Q: Can a message belong to multiple topics?**  
A: No. Each message has exactly one topic. This keeps things simple and unambiguous.

**Q: What happens if I delete a topic with messages?**  
A: MaiChat requires you to reassign those messages first. No accidental data loss.

**Q: Can I export/import topic structures?**  
A: Yes! See the [Settings & Tools](#settings) section for export/import options.

**Q: Do topics affect what's sent to the model?**  
A: Not directly. But you can filter by topic before sending to control context. The topic's system message (if set) is also included.

## Search and Filtering Language {#filtering}

MaiChat's filtering language is one of its most powerful features. It lets you slice your message history by any combination of topic, model, date, content, ratings, and more — all with terse, keyboard-friendly commands.

### Why Filter?

Filtering serves three main purposes:

1. **Find specific conversations:** Quickly locate messages about a topic, from a date, or containing keywords
2. **Focus your view:** See only what matters right now, reducing clutter
3. **Control context:** Filter before sending a new message to include only relevant history

> **Quick tip:** Press `Ctrl+D` (or `Esc` from View Mode) to enter Command Mode and start filtering.

### Basic Filters

Each filter targets a specific attribute of your message pairs (user request + assistant response).

**Topic:** `t'work'`
- Match messages by topic name
- Case-insensitive
- Supports paths, wildcards, and descendants (see [Topic Patterns](#topic-patterns-case-insensitive))

**Content:** `c'error budget'`
- Search for text within messages
- Searches both user requests and assistant responses
- Use `*` as wildcard: `c'*error*'`

**Model:** `m'gpt-4o-mini'`
- Filter by which model generated the response
- Wildcards supported: `m'gpt*'` matches all GPT models
- Bare `m` (no quotes) uses your currently selected model

**Date:** `d2025-10-08`
- Exact calendar day in your local timezone
- Or relative age: `d<7d` (last 7 days)
- Units: `h` (hours), `d` (days), `w` (weeks), `mo` (months), `y` (years)

**Recent count:** `r30`
- Show last N message pairs by absolute recency
- Common shortcuts: `r1`, `r10`, `r50`
- Ignores all other context; just gives you the most recent

**Stars:** `s3` or `s>=2`
- Filter by your star ratings (0-3)
- `s3` — exactly 3 stars
- `s>=2` — 2 or 3 stars
- `s0` — unrated messages

**Flagged:** `b` or `g`
- `b` — blue square flag
- `g` — grey circle flag
- Use flags for quick visual organization

**Attachments:** `i`
- Show only messages with image attachments
- Useful for finding visual content or managing storage
- Combine with topic or date filters to narrow down

**Errors:** `e`
- Show only message pairs where the assistant response failed
- Useful for troubleshooting API issues

> **Tip:** The simplest and most common filter is just `t` (without quotes) — it shows only messages from your currently selected topic. This is a quick way to focus on one conversation thread.

### Combining Filters

The real power comes from combining filters with logical operators.

**AND (space or &):**
```
r20 s>=2
```
Last 20 pairs that are rated 2+ stars. Space means AND.

```
t'Work' d<7d
```
Work messages from the last 7 days.

**OR (| or +):**
```
m'gpt*' | m'claude*'
```
Messages from either GPT or Claude models.

```
s3 | b
```
3-star messages OR blue-flagged messages.

**NOT (!):**
```
!t'Archive...'
```
Everything EXCEPT Archive topic and its subtopics.

```
d<30d & !e
```
Last 30 days, excluding errors.

**Parentheses for grouping:**
```
(t'Python...' | t'JavaScript...') & c'error'
```
Errors in either Python or JavaScript topics.

```
t'Coding...' & (s3 | b)
```
Coding messages that are either 3-starred OR blue-flagged.

**Operator precedence:**
- `()` — Parentheses (highest priority)
- `!` — NOT
- `&` and adjacency (space) — AND
- `|` and `+` — OR (lowest priority)

### Topic Patterns (Case-Insensitive) {#topic-patterns-case-insensitive}

Topics support powerful pattern matching:

**Exact match:**
- `t'AI'` — Only the "AI" topic (not children)
- `t'AI > Transformers > GPT'` — Full path match

**Descendants (...):**
- `t'AI...'` — AI topic AND all its subtopics (recursive)
- `t'Work...'` — Everything under Work

**Wildcards (*):**
- `t'*Learning'` — Any topic ending with "Learning"
- `t'Machine*'` — Any topic starting with "Machine"
- `t'*Neural*'` — Any topic containing "Neural"

**Combinations:**
- `t'*AI*...'` — Topics containing "AI" and all their descendants
- `t'Work > *'` — Direct children of Work only (not recursive)

**Bare t:**
- `t` — Use currently selected topic from Input Mode

### Model Patterns (Case-Insensitive)

Similar to topics, model filters support patterns:

**Exact ID:**
- `m'gpt-4o'`
- `m'claude-3.5-sonnet'`

**Wildcards:**
- `m'gpt*'` — All GPT models
- `m'*mini*'` — Any model with "mini" in the name
- `m'claude*'` — All Claude models

**Bare m:**
- `m` — Use currently selected model from Input Mode

**Common comparisons:**
```
(m'gpt-4*' | m'claude*') & t'Coding...'
```
Compare GPT-4 vs Claude on coding questions.

### Date Filters

Dates are flexible and support both absolute and relative forms.

**Absolute dates:**
- `d2025-10-08` — Exact day (local timezone)
- `d>=2025-01-01` — On or after January 1
- `d<2025-12-31` — Before December 31

**Relative ages:**
- `d<24h` — Last 24 hours
- `d<7d` — Last 7 days (omit unit = days by default)
- `d<=2w` — Last 2 weeks or less
- `d<6mo` — Last 6 months
- `d<1y` — Last year

**Date ranges (AND two filters):**

Closed interval (inclusive):
```
d>=2025-09-01 & d<=2025-09-30
```
All of September 2025.

Relative age range:
```
d>=3d & d<=14d
```
Messages between 3 and 14 days old.

Half-open range:
```
d>=2025-01-01 & d<2025-02-01
```
January 2025 (excludes February 1).

**Default unit is days:**
- `d<7` ≡ `d<7d`
- `d>=30` ≡ `d>=30d`

### Practical Examples {#filter-examples}

Here are real-world filtering scenarios you can copy and adapt:

**Review recent important conversations:**
```
r30 & s>=2
```
Last 30 pairs that you rated highly.

**Find all discussions about a bug:**
```
c'authentication' & c'bug' & t'Work...'
```
Work messages containing both "authentication" and "bug".

**Compare model outputs on a topic:**
```
(m'gpt-4*' | m'claude*') & t'Writing...'
```
See which model you used for writing tasks.

**Recent conversations excluding archives:**
```
d<14d & !t'Archive...'
```
Last 2 weeks of active conversations.

**Flagged or highly-rated research:**
```
(b | s3) & t'Research...'
```
Your marked or 3-starred research messages.

**Debug recent API errors:**
```
e & d<7d
```
Failed requests from the last week.

**Find conversations about Python errors:**
```
t'Python...' & c'error' & !e
```
Python discussions mentioning "error" but not actual API failures.

**Find screenshot messages from last month:**
```
i & d<30d & t'Screenshots...'
```
Image attachments from Screenshots topic within 30 days.

**Weekly review of all topics:**
```
d>=7d & d<14d
```
Messages from 1-2 weeks ago (last week).

**Current topic, recent, highly rated:**
```
t & d<30d & s>=2
```
Great recent messages in your active topic.

### Workflow Tips

**Start broad, then narrow:**
1. `t'Coding...'` — See all coding
2. `t'Coding...' & d<30d` — Add time constraint
3. `t'Coding...' & d<30d & m'gpt*'` — Narrow to GPT models

**Save common filters as commands:**
The command input has history (`Ctrl+P`/`Ctrl+N`). Your frequent filters are remembered.

**Filter before sending:**
Apply a filter, verify your visible context, then `Ctrl+I` to compose a message with that context.

**Use filters for retrospective organization:**
Find unrated messages: `s0 & d<7d` — rate them while fresh.

**Combine with View Mode actions:**
Filter to a set, then navigate (`j`/`k`) and rate (`1`/`2`/`3`) or flag (`a`) them.

### Actions on Filtered Sets (Colon Commands)

Once you've filtered messages, you can perform bulk actions on the filtered set using colon commands.

**Syntax:** `<filter> :<command> [arguments] [flags]`

Where:
- `<filter>` — Any filter expression (or `*` for all messages)
- `:<command>` — The action to perform on filtered pairs
- `[arguments]` — Optional command-specific arguments
- `[flags]` — Optional command flags (e.g., `--force`, `--no-confirm`)

**Available commands:**

#### :tchange - Bulk Topic Change

Change the topic for all filtered message pairs.

**Syntax:**
- `:tchange` — Change to your currently selected topic (from topic selector)
- `:tchange "Topic Name"` — Change to specified topic by name or path

**Examples:**
```
# Move all errors to "Debug" topic
e :tchange "Debug"

# Move recent unrated messages to current topic
r20 & s0 :tchange

# Move old messages to Archive
d<2024-01-01 :tchange "Archive"

# Move Python discussions to organized topic
c'python' & t'General' :tchange "Work > Python"
```

**Workflow:**
1. Apply filter to find messages you want to move
2. Verify the filtered set in View Mode
3. Execute `:tchange` with target topic
4. Confirm the action (shows count)
5. Messages are reassigned, view refreshes

#### :delete - Bulk Deletion

Permanently delete all filtered message pairs.

**Syntax:**
- `:delete` — Delete all filtered pairs (requires confirmation)
- `:delete --force` — Delete more than 50 pairs (requires force flag)

**Safety restrictions:**

Cannot use with **dynamic filters** (they would show different messages after deletion):
- `r` / `rN` — Recent messages (relative)
- `o` / `oN` — Context boundary (changes based on content)
- `t` — Bare current topic (UI state)
- `tN` — Last N from topic (relative)

**Safe filters for deletion:**
- `t'Topic Name'` — Explicit topic name ✓
- `d<7d` — Date ranges ✓
- `m'model'` — Model name ✓
- `c'text'` — Content search ✓
- `s>=2` — Star ratings ✓
- `e` — Errors only ✓
- `b` / `g` — Flags ✓
- `i` — Attachments ✓

**Examples:**
```
# Delete all error messages
e :delete

# Delete old images to free space
i & d<2024-01-01 :delete --force

# Delete temporary topic content
t'temp' :delete

# Delete unrated non-image messages
s0 & !i :delete

# Clean up low-quality old messages
d<2023-01-01 & s0 :delete --force
```

**Flags:**
- `--force` — Required for deleting more than 50 pairs

**Safety features:**
- Always requires confirmation (no bypass)
- Limit of 50 pairs without `--force`
- Blocks dynamic filters with clear error message
- Shows count before confirming
- After deletion, filter remains active showing empty view (confirmation)
- Press `Esc` to clear filter and see remaining messages

**Error examples:**
```
# ✗ These will be blocked:
r10 :delete                    # Error: no 'r'
t & s0 :delete                 # Error: no 't' (bare)
t5 :delete                     # Error: no 'tN'
o & e :delete                  # Error: no 'o'

# ✓ These work:
t'Coding...' & s0 :delete      # Explicit topic name
d<30d & e :delete              # Date + errors
i & s0 :delete                 # Attachments unrated
```

**Workflow:**
1. Apply filter to find messages to delete
2. Verify filtered set carefully in View Mode
3. Execute `:delete` (add `--force` if >50 pairs)
4. Confirm deletion (shows count and "cannot be undone")
5. Messages deleted, empty view shows (confirmation)
6. Press `Esc` to clear filter and continue

#### :export - Export to File

Export filtered messages to JSON, Markdown, or plain text files.

For full details, see [Export Data](#export-data) section.

**Quick syntax:**
```
s>=2 :export              # Export starred as JSON
d<7d :export md           # Export week as Markdown
t'Python...' :export txt  # Export topic as text
```

### Command Mode Shortcuts

When typing filters in Command Mode:

- `Enter` — Apply filter and switch to View Mode
- `Esc` — Clear input (stays in Command Mode)
- `Ctrl+P` — Previous command from history
- `Ctrl+N` — Next command from history
- `Ctrl+A` — Move to start of line
- `Ctrl+E` — Move to end of line
- `Ctrl+U` — Delete from cursor to start
- `Ctrl+W` — Delete previous word

### Common Mistakes

**Forgetting quotes:**
- ✗ `t'work` — Missing closing quote
- ✓ `t'work'`

**Using commas instead of operators:**
- ✗ `t'work', d<7d` — Comma doesn't work
- ✓ `t'work' & d<7d` or just `t'work' d<7d`

**Wrong wildcard syntax:**
- ✗ `t'work*...'` — Wildcard and dots don't mix well
- ✓ `t'work...'` — Just use dots for descendants

**Confusing NOT with exclusion:**
- ✗ `!s3` alone often too broad
- ✓ `r50 & !s0` — Recent non-zero-rated (more useful)

> **Quick reference:** Press `F1` anytime to see the compact filter syntax cheatsheet in the help overlay.

## Context Management {#context}

One of MaiChat's most important features is giving you **precise control over what context gets sent to the AI model**. Unlike standard chat interfaces where you can't see how far back the model's "memory" extends, MaiChat shows you exactly which messages are in-context and lets you control the selection.

### Why Context Matters

The context you send affects:

1. **Response quality:** Relevant history helps the model understand your needs
2. **Token costs:** Less context = lower API costs
3. **Response time:** Smaller requests are faster
4. **Focus:** Too much irrelevant context can confuse the model

**MaiChat's approach: Visible, flexible control**

MaiChat gives you:

- **Flexible composition:** Use filters + metadata (topics, stars, flags) to select which messages are candidates for context
- **Visual feedback:** See exactly what's in-context and what's not
- **Direct control:** What you choose to filter is what gets sent (as long as it fits the model's limits)
- **Multiple strategies:** Filter by topic, date, rating, model, content — or any combination

**Example:** Send only your highly-rated Python conversations from the last month:
```
t'Python...' & s>=2 & d<30d
```

This level of control helps you balance quality, cost, and relevance for every request.

### What Gets Sent?

When you send a message, MaiChat includes three things:

1. **Your new user request** — what you just typed
2. **The topic's system message** — if your current topic has one configured (custom instructions)
3. **Selected conversation history** — the messages you've chosen through filtering

**How history selection works:**

- You use **filters** to select which messages are candidates (e.g., `t'Python...'`, `d<7d`, `s>=2`)
- MaiChat takes your **filtered/visible messages** and includes as many as fit the model's context window
- Newest messages are included first, working backward in time
- The app shows you **visually** which messages are in-context (will be sent) and which are off-context (won't be sent)

**Typical workflow:**

In most cases, your filtered history will **fit completely** into the context. For example:
- Filter to current topic: `t` → 25 messages → all 25 fit ✓
- Filter to recent starred: `s>=2 & d<30d` → 15 messages → all 15 fit ✓
- Filter to specific project: `t'Project X...'` → 40 messages → all 40 fit ✓

**When trimming occurs:**

If your filtered history is very large (hundreds of messages) or you're using a small context model, MaiChat may need to trim older messages to fit the token limit. You'll see this happen and can:
- Apply a more restrictive filter to focus on what matters most
- Switch to a larger context model (e.g., Claude 3.5 Sonnet with 200K tokens)
- Accept the automatic trimming (often the best choice — newest messages usually matter most)

The key point: **You see what gets sent**. The app marks which messages are in-context, so there are no surprises.

### The Context Boundary

The **context boundary** is the dividing line between messages that will be sent to the model (in-context) and messages that won't be sent (off-context).

**Why you need to see this:**

Knowing where the boundary is lets you:
- Verify that important messages are included
- Understand if you need to filter more restrictively
- See at a glance how much context you're sending
- Make informed decisions about whether to adjust your filter

**How MaiChat shows you the boundary:**

- **In-context messages** appear at normal brightness
- **Off-context messages** are dimmed (grayed out) with an "off" badge in their meta line
- This visual distinction makes it instantly clear what the model will see

**Checking the boundary:**

Press `o` or `Shift+O` in View Mode to jump directly to the first in-context message (the boundary point). The view centers on this message so you can easily review what's included.

### The Message Counter (Top-Right)

The message counter shows context status at a glance:

**Basic format: `X/Y`**
- `X` = Predicted in-context pairs (will be sent)
- `Y` = Currently visible pairs (after filtering)

**Example:** `15/42` means 15 pairs will be sent out of 42 visible.

**Prefix: `(-) `**
- Means your newest message is hidden by the current filter
- **Warning:** You won't be able to send with this filter active!

**Trim indicator: `[S-T]/Y`**
- `S` = Pairs actually sent (after trimming)
- `T` = Pairs trimmed out (didn't fit)
- `Y` = Visible pairs

**Example:** `[12-3]/42` means 12 pairs sent, 3 were trimmed, 42 visible.

**Hover for details:**
The counter's tooltip shows:
- Predicted token count
- Whether URA (User Request Allowance) is active
- How many pairs were trimmed on the last send
- Current model's context window size

### How Context is Computed

MaiChat uses a **prediction algorithm** before you send:

1. **Start with visible history** (after any filters)
2. **Count tokens** for each pair (user + assistant)
3. **Reserve URA tokens** for your new request + expected response (default: 600)
4. **Include pairs from newest to oldest** until space runs out
5. **Mark the boundary** and dim older messages

**Model-dependent:**
- Each model has a different context window (tokens it can handle)
- GPT-4o: 128K tokens
- Claude 3.5 Sonnet: 200K tokens
- Switching models changes the boundary!

**Settings that affect context:**
- **userRequestAllowance (URA):** Default 600. Higher = more room for your new message, but less history included
- **charsPerToken (CPT):** Default 4. Estimation factor (4 chars ≈ 1 token)
- **maxTrimAttempts:** How many times to retry if the initial prediction is too large

### Context Control Strategies

**1. Use filters before sending:**

```
t'Python...' & d<7d
```
Only include recent Python conversations, then send your question.

**2. Switch to a larger context model:**

Press `Ctrl+M` and choose a model with a bigger window if you need more history.

**3. Adjust URA in settings:**

- **Lower URA** (e.g., 400) = more history fits, less room for your new message
- **Higher URA** (e.g., 800) = fewer history pairs, more room for complex prompts

**4. Star and filter important messages:**

Rate key messages with `1`/`2`/`3`, then filter by `s>=2` to include only high-quality context.

**5. Review the boundary:**

Press `o` before sending to see what's included. If something important is off-context, apply a filter to bring it in.

### Understanding Token Trimming

Sometimes MaiChat's prediction is slightly off (different models count tokens differently). When this happens:

1. **Initial send fails** (too many tokens)
2. **MaiChat trims** the oldest included pair
3. **Retries** up to `maxTrimAttempts` times
4. **Updates the counter** to show `[S-T]/Y` format

**Example scenario:**
- Predicted: 15 pairs would fit
- Actual: Only 12 pairs fit
- Result: `[12-3]/42` (3 pairs trimmed)

This is normal and automatic. You'll see the trim indicator briefly after sending.

### Practical Examples

**Review before sending:**
1. Type your message in Input Mode
2. Press `Esc` to enter View Mode
3. Press `o` to jump to context boundary
4. Review what's in-context
5. Apply filters if needed: `Ctrl+D`, type filter, `Enter`
6. Press `Ctrl+I` to return to Input Mode and send

**Focus on recent conversations:**
```
d<7d
```
Only include messages from the last week, reducing noise from old conversations.

**Include only important messages:**
```
s>=2 & t'Work...'
```
Only highly-rated work messages.

**Deep context for complex questions:**
1. Switch to Claude 3.5 Sonnet (200K context)
2. Filter to relevant topic: `t'Project X...'`
3. Check counter: `o` to see boundary
4. Send complex question requiring lots of context

**Minimal context for quick questions:**
```
r5
```
Only last 5 pairs — fast and cheap for simple follow-ups.

### Common Patterns

**Daily workflow:**
- Use `t` filter to focus on current topic
- Check counter occasionally to ensure context size is reasonable
- Press `o` when you want to verify what's being sent

**Research/analysis:**
- Filter by topic and date: `t'Research...' & d<30d`
- Use larger context models
- Review boundary before sending complex queries

**Cost optimization:**
- Use smaller models (mini/flash) with filtered context
- Check counter to avoid sending unnecessary history
- Star important messages, filter by stars before sending

**Debugging context issues:**
- Hover over message counter for token details
- Press `o` to see boundary
- Check if important messages are dimmed
- Adjust filter or URA settings

### Advanced: Context and System Messages

If your current topic (or any ancestor) has a **system message** set:
- It's automatically included in every request
- It doesn't count against your URA
- It appears at the beginning of the context
- Useful for role-setting or custom instructions

Set system messages in the Topic Editor (`Ctrl+Shift+T`), then press `Ctrl+E` on a topic.

### Troubleshooting

**"My important message isn't being sent!"**
- Check if it's dimmed (off-context)
- Press `o` to see the boundary
- Apply a filter to bring it into context, or increase URA

**"Counter shows (-) prefix"**
- Your newest message is hidden by your filter
- Clear the filter (`Esc` in Command Mode) before sending

**"Trim indicator keeps appearing"**
- Your messages are close to the token limit
- Use a larger context model, or filter more aggressively

**"Context seems wrong after filtering"**
- Remember: filters affect what's visible AND what's sent
- Clear filters to reset: `Esc` in Command Mode

**"How do I know exact token count?"**
- Hover over the message counter tooltip
- Or append `?reqdbg=1` to URL for Request Debug overlay

### Key Takeaways

✓ **The context boundary** determines what gets sent — press `o` to see it  
✓ **The message counter** (`X/Y`) shows predicted context size  
✓ **Filters control context** — apply them before sending  
✓ **Different models** have different context windows  
✓ **URA setting** balances new message space vs history inclusion  
✓ **Visual dimming** shows off-context messages clearly  
✓ **Token trimming** is automatic when predictions are slightly off

## Working with Images {#images}

MaiChat supports image attachments for all models in the catalogue, making it easy to get help with screenshots, diagrams, code snippets, UI mockups, and other visual content.

### Overview

**Vision support:**
All base models in MaiChat's catalogue support vision (image understanding). This is a standard capability across OpenAI, Anthropic, Google, and xAI models.

**Common use cases:**
- Getting help with error messages shown in screenshots
- Analyzing charts, graphs, or diagrams
- Asking questions about code in images
- Describing or discussing UI/UX designs
- OCR (extracting text from images)

**Limits:**
- Up to 4 images per message
- Maximum 30MB total per message
- Supported formats: JPEG, PNG, GIF, WebP

### Attaching Images (Input Mode)

You can attach images to your message in three ways:

**1. File picker (Ctrl+F):**
1. Press `Ctrl+F` in Input Mode
2. Select one or more images from your file system
3. Images are added to your draft message

**2. Paste from clipboard (Cmd/Ctrl+V):**
1. Copy an image to your clipboard (screenshot, image from web, etc.)
2. In Input Mode, press `Cmd+V` (macOS) or `Ctrl+V` (Windows/Linux)
3. The image is immediately added to your draft

> **Tip:** This is the fastest way to attach screenshots! Use `Cmd+Shift+4` (macOS) or `Win+Shift+S` (Windows) to capture a screenshot, then paste it directly into MaiChat.

**Visual indicator:**
- The input area shows `📎 N images` when you have attachments
- Hover to see image filenames

### Managing Draft Images

Before sending, you can review and manage your attached images:

**View draft images (Ctrl+Shift+O):**
1. Press `Ctrl+Shift+O` in Input Mode
2. Image overlay opens showing all attached images
3. Navigate with `j`/`k` or arrow keys
4. Press `Delete` or `x` to remove the current image
5. Press `Esc` to close the overlay

### Viewing Message Images (View Mode)

After sending a message with images, you can view them anytime:

**Quick view (i):**
- Press `i` on any message part with images
- If there's only one image, it opens immediately
- If there are multiple images, overlay opens to the first image

**Jump to specific image (i1-i9):**
- Press `i1` to jump to first image
- Press `i2` to jump to second image
- Continue with `i3`, `i4`, etc. up to `i9`

**Visual indicator:**
- Messages with images show `📎 N` in the metadata line

### Image Overlay Navigation

When viewing images in the overlay:

**Navigate between images:**
- `j` / `k` — Next / previous image
- `1` / `2` / `3` ... `9` — Jump to specific image by number
- Arrow keys — Also work for navigation

**Manage images (draft only):**
- `Delete` or `x` — Remove current image from draft
- (Only works when viewing draft images via Ctrl+Shift+O)

**Close overlay:**
- `Esc` — Close and return to previous mode

### Image Limits and Storage

**Technical limits:**
- **Per-message limit**: 4 images
- **Size limit**: 30MB total per message
- **Supported formats**: JPEG, PNG, GIF, WebP

**Storage:**
- Images are stored locally in your browser's IndexedDB
- They never leave your device except when sent to AI providers
- Large image collections can consume browser storage

**Managing storage:**
- Use the `i` filter to find all messages with attachments: `i`
- Combine with date filters to find old images: `i & d<2024-01-01`
- Delete messages with attachments to free space (see [Deletion Examples](#deletion-examples))

### Common Workflows

**Screenshot workflow:**
1. Capture screenshot (`Cmd+Shift+4` on macOS, `Win+Shift+S` on Windows)
2. Switch to MaiChat (Input Mode)
3. Paste with `Cmd+V` / `Ctrl+V`
4. Type your question
5. Press `Enter` to send

**Multiple images:**
1. Press `Ctrl+F` to open file picker
2. Select multiple images (Shift+click or Cmd+click)
3. All images attach at once
4. Preview with `Ctrl+Shift+O` before sending

**Finding and cleaning up images:**
```
# Find all messages with images
i

# Find old screenshot messages
i & t'Screenshots...' & d<90d

# Delete old temporary images (requires confirmation)
i & t'temp' :delete
```

**Review images from a conversation:**
1. Filter to your topic: `t'Project X...'`
2. Navigate with `j`/`k` in View Mode
3. Press `i` on any message to view its images
4. Use `j`/`k` in the overlay to browse all images in sequence

## Web Search & Sources {#search}

AI models can search the web in real-time and cite their sources. MaiChat makes it easy to enable search and review citations, giving you transparency into where information comes from.

### Overview

**Search support:**
All base models in MaiChat's catalogue support web search with citations. This is a standard capability provided by the LLM providers (OpenAI, Anthropic, Google, xAI).

**Use cases:**
- Getting current information (news, events, stock prices)
- Fact-checking with verifiable sources
- Research with citations
- Finding recent documentation or updates
- Asking about recent developments in any field

### Enabling Web Search

Search is controlled per-model in the Model Editor (search is enabled by default for all models):

1. Press `Ctrl+M` to open model selector
2. Navigate to any model
3. Press `Enter` to edit the model
4. Check the **"Search Enabled"** checkbox
5. Press `Ctrl+S` to save

**When to enable search:**
- Research topics requiring current information
- Fact-checking and verification workflows
- Questions about recent events or updates
- Any query where sources matter

**When to disable search:**
- Creative writing or brainstorming
- Code generation (unless checking current APIs)
- General conversation
- When speed is more important than sources

> **Performance note:** Enabling search slightly increases response time as the model searches before generating.

### Viewing Citations (View Mode)

When a model uses web search, it includes numbered citations in the response like `[1]`, `[2]`, etc.

**Open Sources overlay (Ctrl+Shift+S):**
1. Navigate to a message with citations (look for `[1]`, `[2]` in text)
2. Press `Ctrl+Shift+S` in View Mode
3. The Sources overlay opens showing all cited URLs

**Sources overlay features:**
- **List view**: All sources numbered with titles and URLs
- **Navigate**: Use `j`/`k` or arrow keys to scroll
- **Copy URL**: Click the copy button or select text
- **Open link**: Click the URL to open in browser (or use link hints)
- **Close**: Press `Esc` to return

**Visual indicator:**
- Messages with search results may show additional metadata
- Look for `[1]`, `[2]`, `[3]` inline citations in the response

### Link Hints

MaiChat provides vim-style link hints to open any link in the response without using your mouse:

**Activate link hints (l):**
1. In View Mode, navigate to a message with links
2. Press `l` (lowercase L)
3. Numbers appear next to each link
4. Press `1`, `2`, `3`, etc. to open that link
5. Links open in a new browser tab

**Works with:**
- Citation links from web search
- Any URLs in the assistant response
- Markdown links
- Plain text URLs

> **Tip:** Combine with `Ctrl+Shift+S` for full citation workflow: press `Ctrl+Shift+S` to see all sources, then `l` to quickly open any link.

### How It Works

**Behind the scenes:**
1. You send a message to a search-enabled model
2. The model performs web searches before generating the response
3. Search results are analyzed and relevant content is extracted
4. The model generates a response using the search results
5. Citations are added inline: `[1]`, `[2]`, `[3]`
6. Full URLs are stored and accessible via `Ctrl+Shift+S`

**Citation format:**
- Inline: `According to recent studies [1], the approach has proven effective [2].`
- Sources overlay: Shows full titles and URLs for each number

**Performance impact:**
- Adds 2-5 seconds to response time (depending on query complexity)
- Uses additional tokens (search results are part of context)
- Slightly higher API costs

## API Keys and Model Catalogue {#models}

MaiChat connects to AI providers through their APIs. To use the app, you need to set up API keys and understand how to manage your model catalog.

### Setting Up API Keys

**Important: Bring Your Own Key (BYOK)**

MaiChat is **completely free** — you pay nothing to use the app itself. Instead, you use your own API keys from AI providers, and you pay them directly based on your usage.

- **You register** with OpenAI, Anthropic, and/or Google (see details below)
- **You obtain** your own API keys from their platforms
- **You pay** the providers directly for API usage
- **MaiChat cost:** $0 (the app is free)
- **AI provider cost:** Pay-as-you-go or subscription plans

**Free tiers and costs:**

- **OpenAI:** No free tier; pay per token (roughly $2-20 per 1M tokens depending on model. 1M tokens corresponds to 1200-1500 typical chat messages)
- **Anthropic:** Some credits for new users; similar pricing to OpenAI
- **Google (Gemini):** Generous free tier (15 requests/min, 1M tokens/day for Gemini 1.5 Flash)
- **xAI:** Pay-as-you-go pricing; check console.x.ai for current rates
- **Typical usage:** Light use might cost $5-20/month; heavy use $50-100+/month

Check each provider's website for current pricing and free tier details.

MaiChat supports four major AI providers. You need at least one API key to use the app.

**Opening API Keys settings:**
- Press `Ctrl+K` from any mode
- Or use the menu: `Ctrl+.` → API Keys

**Supported providers:**

1. **OpenAI** (ChatGPT models)
   - Get your key at [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
   - Models: GPT-5, GPT-5 mini, GPT-5 nano, o4-mini
   
2. **Anthropic** (Claude models)
   - Get your key at [console.anthropic.com](https://console.anthropic.com)
   - Models: Claude Sonnet 4.5, Claude Opus 4.1, Claude 3.5 Haiku
   
3. **Google** (Gemini models)
   - Get your key at [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
   - Models: Gemini 2.5 Pro, Gemini 2.5 Flash, Gemini 2.5 Flash-Lite

4. **xAI** (Grok models)
   - Get your key at [console.x.ai](https://console.x.ai)
   - Models: grok-4-fast-non-reasoning, grok-4-fast-reasoning, grok-code-fast-1

**Security and privacy:**

- API keys are stored **locally** in your browser's localStorage
- **OpenAI and Google:** Keys are sent directly from your browser to their APIs
- **Anthropic (Claude):** Requests go through a MaiChat proxy server (required due to browser CORS restrictions). The proxy forwards your key and request to Anthropic but doesn't store or log either
- Your conversation data stays between you and the AI providers
- Use your browser's private/incognito mode if on a shared computer

### Understanding the Model Catalogue

MaiChat comes with a pre-configured catalog of popular models. You can enable/disable models and add custom ones.

**Opening the Model Editor:**
- Press `Ctrl+Shift+M` from any mode
- Or use the menu: `Ctrl+.` → Model Editor

**What you see:**

A table showing all available models with:
- **Model ID** — The unique identifier (e.g., `gpt-5`, `claude-sonnet-4-5-20250929`)
- **Enabled** — Whether the model appears in the model selector (`Ctrl+M`)
- **Context Window** — Maximum tokens the model can handle
- **TPM/RPM/TPD** — Tokens/Requests per Minute, Tokens per Day limits

**Model categories:**

**High-performance models** (expensive, powerful):
- GPT-5 (OpenAI) — 128K context
- Claude Opus 4.1 (Anthropic) — 200K context
- Claude Sonnet 4.5 (Anthropic) — 200K context (1M beta)
- Gemini 2.5 Pro (Google) — 2M context

**Balanced models** (mid-tier):
- GPT-5 mini (OpenAI) — 128K context
- Gemini 2.5 Flash (Google) — 1M context

**Fast/economical models** (cheap, quick):
- GPT-5 nano (OpenAI) — 128K context
- Claude 3.5 Haiku (Anthropic) — 200K context
- Gemini 2.5 Flash-Lite (Google) — 1M context
- grok-4-fast-non-reasoning (xAI) — Fast inference without extended reasoning

**Reasoning models** (specialized):
- o4-mini (OpenAI) — Extended thinking time
- grok-4-fast-reasoning (xAI) — Fast inference with reasoning capabilities

**Coding models** (specialized):
- grok-code-fast-1 (xAI) — Optimized for code generation and analysis

### Managing Models

**Enable/disable models:**
1. Open Model Editor (`Ctrl+Shift+M`)
2. Click the checkbox next to a model to toggle
3. Only enabled models appear in the model selector (`Ctrl+M`)
4. Tip: Disable models you don't have API keys for to declutter the selector

**Why disable models:**
- No API key for that provider
- Don't want to accidentally use expensive models
- Simplify the model selector
- Testing with specific model subset

**Editing model parameters:**

Click on any field to edit:
- **Context Window:** The model's maximum capacity (get from provider docs)
- **TPM:** Your plan's tokens per minute limit — **See "Understanding Rate Limits" below**
- **RPM:** Requests per minute (not yet enforced, set for reference)
- **TPD:** Tokens per day (not yet enforced, set for reference)

**Important:** You must set TPM to match YOUR plan, not the model's advertised capacity. MaiChat uses TPM to calculate how much context fits in each message.

### Adding More Models

By default, MaiChat includes only the most popular and relevant models from each provider. However, you can add any other official model from OpenAI, Anthropic, Google, or xAI.

**Important:** You can only add models from the four supported providers. You cannot add models from other providers or use custom/fine-tuned models (those typically have different API endpoints).

**How to add a model:**

1. Open Model Editor (`Ctrl+Shift+M`)
2. Use the **Add** row at the bottom
3. Enter:
   - **Model ID** — Exact API identifier (check provider's documentation)
   - **Context Window** — Maximum tokens (from provider specs)
   - **TPM/RPM/TPD** — Your plan's rate limits (see next section)
4. Press Enter or click Save
5. The model immediately appears in your selector (`Ctrl+M`)

**When to add models:**
- Provider releases a new model not yet in the default catalog
- You have beta access to an experimental model
- You need a specialized model (e.g., specific GPT-4 variant)
- Testing with different model versions

**Removing models:**
- Click the delete icon next to models you've added
- Default models (pre-configured by MaiChat) can't be deleted, only disabled

### How Context Window Affects Your Work

The **context window** is one of the two key parameters that determine how much history you can include in each message (the other is TPM - see next section).

**Small context (8K-32K tokens):**
- Limits conversation depth
- Forces aggressive filtering
- Lower cost per request
- Faster responses

**Medium context (128K-200K tokens):**
- Most modern models (GPT-5, Claude Sonnet 4.5)
- Comfortable for most use cases
- Balances depth and cost

**Large context (1M-2M tokens):**
- Gemini models (massive windows!)
- Claude Sonnet 4.5 with beta header (1M)
- Include entire project histories
- Expensive per request
- Use when deep context is critical

**Switching models changes the boundary:**

MaiChat recalculates the context boundary when you switch models:
- Larger window → More messages fit → Boundary moves back
- Smaller window → Fewer messages fit → Boundary moves forward
- You see this instantly (dimming updates in real-time)

Press `o` after switching models to see the new boundary.

### Understanding Rate Limits (TPM vs Context Window)

This is crucial to understand how MaiChat calculates what fits in each message.

**Two different limits:**

1. **Context Window (CW):** The model's theoretical maximum capacity
   - Example: GPT-5 can handle up to 128,000 tokens
   - This is what providers advertise
   
2. **Tokens Per Minute (TPM):** Your plan's rate limit
   - Example: Your tier allows 30,000 tokens per minute
   - This is what you're actually limited by

**How MaiChat calculates your limit:**

For each message, MaiChat uses: **MIN(Context Window, TPM)**

Whichever is smaller becomes the actual constraint.

**Why both matter:**

- If TPM < CW (common): TPM is the bottleneck — your plan limits you before the model's capacity
- If CW < TPM (rare): Context Window is the bottleneck — the model's capacity limits you before your plan

**Example scenario (TPM is smaller):**
- Model: GPT-5 (CW = 128K)
- Your plan: TPM = 30K
- **Your actual limit per message:** MIN(128K, 30K) = 30K tokens
- MaiChat will trim history to fit within 30K tokens

**Provider differences in rate limits:**

**OpenAI:**
- Has a single **total TPM limit** that applies to input tokens
- Your input (prompt + history) must fit within this limit
- Output tokens don't count toward TPM (but do count toward context window)

**Anthropic (Claude):**
- Has **separate input TPM and output TPM limits**
- Input limit: Controls how many tokens you can send (prompt + history)
- Output limit: Controls how many tokens the model can generate in response
- Both limits are enforced independently

**Google (Gemini):**
- Uses **"Tokens per minute (input)"** limit
- Similar to OpenAI — only input tokens count toward TPM
- Very generous free tier: 250K-1M TPM depending on model
- Output tokens don't count toward TPM

**xAI (Grok):**
- Uses TPM limit similar to OpenAI
- Only input tokens count toward TPM
- Check console.x.ai for your plan's specific limits

**What this means for you:**

- **OpenAI/Gemini/xAI:** Set TPM to your plan's input token limit
- **Anthropic:** Set TPM to your plan's input token limit (MaiChat handles output limits separately)

**Setting TPM correctly:**

**This is your responsibility!** You must set TPM to match YOUR plan, not the model's advertised capacity.

1. Check your plan on the provider's website:
   - **OpenAI:** platform.openai.com → Settings → Limits (look for "Tokens per minute")
   - **Anthropic:** console.anthropic.com → Settings → Limits (look for "Input tokens per minute")
   - **Google:** Check your tier — Free tier has very high limits (250K-1M TPM)
   - **xAI:** console.x.ai → Check your account limits

2. Open Model Editor (`Ctrl+Shift+M`)

3. Update TPM for each model to match your plan's **input** token limit

**Default TPM values:**

MaiChat ships with conservative defaults that should work for most paid plans. However:
- **If you're on a free tier:** You might need to lower TPM (except Gemini, which has generous limits)
- **If you're on a high-tier plan:** You can increase TPM for better performance

**RPM and TPD:**

- **RPM (Requests Per Minute):** Currently not enforced by MaiChat (future feature)
- **TPD (Tokens Per Day):** Currently tracked but not enforced (future feature)
- Set them for your own reference and future proofing

### Model Selection Strategy

**Daily workflow:**
- Use **mini/flash/nano models** (GPT-5 nano, Gemini 2.5 Flash-Lite, Claude 3.5 Haiku)
- Fast, cheap, good enough for most tasks
- Switch to larger models only when needed

**Complex questions:**
- Use **flagship models** (GPT-5, Claude Sonnet 4.5, Gemini 2.5 Pro)
- Better reasoning and understanding
- Worth the cost for important tasks

**Deep context needs:**
- Use **Claude Sonnet 4.5** (200K, 1M beta) or **Gemini 2.5 Pro** (2M)
- When you need lots of conversation history
- Research, analysis, long-form content

**Cost optimization:**
- Filter aggressively with nano/flash-lite models
- Check message counter before sending
- Use `r10` or `r20` filters for quick questions
- Reserve flagship models for complex work

**Speed optimization:**
- Flash-lite/nano models are significantly faster
- Use them for rapid iteration
- Switch to larger models only for final versions

### Best Practices

✓ **Set up all four providers** if possible — gives you flexibility and backup options  
✓ **Start with free tier** (Gemini) to experiment before committing budget  
✓ **Monitor your costs** using provider dashboards and Daily Stats (`Ctrl+Shift+D`)  
✓ **Disable models you don't use** — keeps the selector clean  
✓ **Start with mini/flash models** — upgrade to flagship only when needed  
✓ **Check the message counter** before sending expensive flagship models  
✓ **Add more models** as providers release new ones  
✓ **Set realistic TPM limits** to control context size per message  
✓ **Press `o` after switching models** to see the new context boundary

## Settings and Tools {#settings}

MaiChat provides several tools for configuration, monitoring, and data management.

### Settings

Configure app-wide behavior and appearance through the Settings panel.

**Access:** Press `Ctrl+,` from any mode, or use menu (`Ctrl+.` → Settings)

**Settings are organized in 3 tabs:**

1. **Spacing Tab** — Visual layout controls:
   - Fade Zone, Message Gap, Assistant Gap, Message Padding
   - Meta Gap, Gutter Left/Right
   - Inline Markdown Formatting (experimental)
   - Adjust for more spacious or compact reading experience

2. **Scroll Tab** — Animation behavior:
   - Base Duration, Dynamic Scaling, Min/Max Duration, Easing
   - Navigation Animation toggles (j/k, J/K, u/d)
   - Disable for instant navigation or adjust for preferred feel

3. **Context Tab** — Token estimation and AI request behavior:
   - **User Request Allowance (URA):** Default 600 tokens — Space reserved for your message. Higher = more room for long prompts but less history; Lower = more history but less room for your message. Adjust if you write very long or very short messages.
   - **Assistant Response Allowance (ARA):** Default 800 tokens — Expected response size (OpenAI only). Rarely needs adjustment.
   - **Chars Per Token (CPT):** Default 4 — Estimation factor. Rarely needs adjustment (works well for English).
   - **Assumed User Tokens:** Default 256 — Preview boundary reserve. Rarely needs adjustment.
   - **Max Trim Attempts:** Default 10 — Retry limit for context overflow. Rarely needs adjustment.
   - **Topic Order Mode:** How topics sort in Topic Selector (manual/alpha/recent)

**Saving:**
- Click "Apply (Ctrl+S)" or press `Ctrl+S` to save
- Click "Cancel+Close (Esc)" or press `Esc` to discard
- Settings stored in browser localStorage (persist across sessions)

**When changes take effect:**
- Spacing: Immediate visual update
- Scroll: Next navigation action
- Context: Next message send (recalculates boundary)

**Storage location:** Settings, API keys, model catalog, and topic tree are stored in **localStorage**. Conversation history (message pairs) is stored in **IndexedDB** for better performance with large datasets.

### Activity Statistics

View activity breakdown for your currently filtered conversations with two different perspectives: by date or by model.

**Access:** Press `Ctrl+Shift+D` from any mode, or use menu (`Ctrl+.` → Activity Stats)

**Two tabs available:**

**1. By Date tab:**
- Date-by-date message count breakdown
- Shows which days you were most active
- Includes median response time per day
- Sorted chronologically

**2. By Model tab:**
- Message count breakdown by AI model
- Shows which models you use most
- Includes median response time per model
- Sorted by usage count

**Navigation:**
- **Switch tabs:** Press `h` / `l` or `[` / `]` keys
- **Navigate rows:** Use `j` / `k` or arrow keys
- **Jump:** `g` to top, `G` to bottom
- **Close:** Press `Esc`

**Features:**
- **Respects current filter** — Shows stats only for visible messages (filtered set)
- **Response times** — Median time gives you sense of model speed and API performance
- **Context-aware** — Filter to a topic first, then check stats for that topic only

**Use cases:**
- Quick activity overview across time or models
- Compare model performance (speed) side-by-side
- Verify filter is working as expected
- Identify usage patterns (which models for which topics)
- See which days or models had slower responses

**What it's NOT:**
- Not a cost tracker (no pricing/spending data)
- Not exportable (shows only current data in overlay
- Not historical in the sense of trends over time

**Note:** Data comes from IndexedDB (where conversation history is stored). Clearing browser data will delete this history.

### Export Data

Download your conversations as files for backup, sharing, or analysis.

**How it works:**

Command Mode syntax: `<filter> :export <format>`

Where:
- `<filter>` — Any filter expression (or `*` for all messages)
- `:export` — The export command
- `<format>` — Optional: `json` (default), `md`, or `txt`

**Available formats:**

1. **JSON (default)** — Structured data with full metadata
   - Command: `:export` or `:export json`
   - Output file: `export_chat-YYYYMMDD-HHMMSS.json`
   - Best for: Backup, re-importing, programmatic processing

2. **Markdown (.md)** — Human-readable formatted text
   - Command: `:export md`
   - Output file: `export_chat-YYYYMMDD-HHMMSS.md`
   - Best for: Reading, sharing, documentation

3. **Plain Text (.txt)** — Simple unformatted text
   - Command: `:export txt`
   - Output file: `export_chat-YYYYMMDD-HHMMSS.txt`
   - Best for: Minimal files, plain text editors

**Examples:**

```
# Export all messages as JSON
* :export

# Export only starred messages
s>=2 :export

# Export last 5 days as Markdown
d<5 :export md

# Export specific topic as plain text
t'Python...' :export txt

# Export recent high-rated conversations
d<30 & s>=2 :export
```

**What gets exported:**
- Message pairs (user request + AI response)
- Timestamps, topics, models, ratings, flags
- Error states (if response failed)
- Full topic paths (e.g., "Work > Python > Debugging")

**What does NOT get exported:**
- In-context markers (not relevant outside app)
- UI state (dimming, active message, etc.)
- Settings or API keys
- Internal temporary data

**JSON structure example:**

```json
{
  "schemaVersion": "1",
  "app": "MaiChat",
  "generatedAt": "2025-10-12T10:30:00Z",
  "filterInput": "t'Python...' :export",
  "count": 42,
  "pairs": [
    {
      "id": "p_123",
      "createdAt": "2025-10-12T08:15:00Z",
      "topicPath": "Work > Python",
      "topicId": "uuid-here",
      "model": "gpt-5-mini",
      "stars": 2,
      "flagColor": "blue",
      "userText": "How do I...?",
      "assistantText": "Here's how...",
      "errorState": false
    }
  ]
}
```

**When to use export:**

✓ **Regular backups** — Download important conversations periodically  
✓ **Project documentation** — Export completed projects as Markdown  
✓ **Sharing** — Export specific topics to share with colleagues  
✓ **Analysis** — Export as JSON to process with other tools  
✓ **Archiving** — Save before cleaning up or browser reset  
✓ **Migration** — Backup before major changes

**Tips:**

- **Filter first** — Export exactly what you need, not everything
- **Use JSON for backups** — Most complete format
- **Use Markdown for sharing** — Most readable for others
- **Check your filter** — Verify message count before exporting

## Common Errors and Solutions {#errors}

When a message send fails, MaiChat displays an error badge in the message metadata with a short classification code. The full error message appears on hover. You can retry with the "Re-ask" button (or press `e` in View Mode) or delete the error with the "Delete" button (or press `w` in View Mode).

### Error Classifications

MaiChat categorizes errors into 5 types based on the error message from the provider:

**error: auth**
- **Meaning:** Authentication failed — API key is missing, invalid, or expired
- **Triggers:**
  - "API key" in error message
  - "Unauthorized" or "401" response
  - "Forbidden" response
- **How to fix:**
  1. Press `Ctrl+K` to open API Keys
  2. Check that the correct API key is entered
  3. Verify the key is active on the provider's website
  4. Generate a new key if needed
  5. Make sure billing is set up (some providers require it)

**error: model**
- **Meaning:** The model ID doesn't exist or you don't have access
- **Triggers:**
  - "Model not found" or "unknown model"
  - "Invalid model" or "unsupported model"
  - "Model doesn't exist" or "deprecated model"
  - 404 errors mentioning "model"
- **How to fix:**
  1. Open Model Editor (`Ctrl+Shift+M`)
  2. Check the model ID matches provider documentation exactly
  3. Some models require beta access or special enrollment
  4. Try switching to a different model from the same provider
  5. Remove the model if it's been deprecated

**error: quota**
- **Meaning:** You've hit a rate limit or context size limit
- **Triggers:**
  - 429 status code (too many requests)
  - "Rate limit" or "quota" in error message
  - "TPM" or "RPM" (tokens/requests per minute)
  - "Context length exceeded" or "context window"
- **How to fix:**
  - **For rate limits (429/TPM/RPM):**
    1. Wait 60 seconds and try again
    2. Check your plan limits on provider's website
    3. Consider upgrading your plan if this happens often
    4. Use a different model (they often have separate limits)
  - **For context limits:**
    1. Apply a more restrictive filter to include less history
    2. Try `r20` to include only last 20 message pairs
    3. Switch to a model with larger context window
    4. Press `o` to see what's being included
    5. Check Model Editor (`Ctrl+Shift+M`) — your TPM might be too low

**error: net**
- **Meaning:** Network connection failed
- **Triggers:**
  - "Network error" in message
  - "Fetch failed" 
  - Connection timeouts
  - DNS resolution failures
- **How to fix:**
  1. Check your internet connection
  2. Try again in a moment (temporary network issue)
  3. Check if the provider's API is down (visit status page)
  4. Disable VPN if using one (might interfere)
  5. Try a different network if available

**error: unknown**
- **Meaning:** Error doesn't match any known pattern
- **Triggers:** Any error that doesn't fit the above categories
- **How to fix:**
  1. Hover over error badge to read full error message
  2. Search for the error message in provider's documentation
  3. Check if it's a content policy violation
  4. Try rephrasing your request
  5. Try a different model
  6. Check browser console (F12) for additional details

### Common Workflows

**After an error occurs:**

1. **Read the error** — Hover over the error badge to see the full message
2. **Retry** — Press `e` (View Mode) or click the ↻ button to re-ask
3. **Delete** — Press `w` (View Mode) or click the ✕ button to remove the error
4. **Fix and retry** — Fix the underlying issue (add API key, change model, apply filter) then press `e` to re-ask

**The Re-ask feature:**
- Copies the original user message to input field
- Sets the model to what was used
- Switches to Input Mode
- You can edit before resending
- Original error message remains until you delete it or send successfully

### Interface Issues

**"Keys don't respond"**
- **Cause:** You're in the wrong mode
- **Solution:** 
  1. Check mode indicator (bottom-left: VIEW/INPUT/COMMAND)
  2. Press `Esc` to cycle through modes
  3. Or use `Ctrl+V` (View), `Ctrl+I` (Input), `Ctrl+D` (Command)

**"Can't find a message"**
- **Cause:** A filter is hiding it
- **Solution:**
  1. Press `Ctrl+D` to enter Command Mode
  2. Type `*` and press `Enter` to clear all filters
  3. Or check active filters shown at top of history pane
  4. Use `c'search term'` to search for specific content

**"Modal or overlay won't close"**
- **Cause:** Not using the right key
- **Solution:**
  1. Press `Esc` to close most overlays
  2. Or click outside the overlay
  3. For Settings/Model Editor: click "Cancel" or press `Esc`

### When All Else Fails

1. **Refresh the page** — Sometimes the app state gets confused
2. **Check browser console** — Press F12 and look for error messages
3. **Try a different browser** — Some extensions can interfere
4. **Clear browser data** — Last resort (you'll lose settings/history)
5. **Report the issue** — Check GitHub issues or create a new one
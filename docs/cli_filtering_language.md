# CLI Filtering Language Specification

## Overview

The MaiChat CLI Filtering Language is a concise, powerful query language designed for rapid context management in AI conversations. It enables users to construct precise filters using single-letter commands, boolean operators, and intuitive parameter syntax.

Unit of operation: All filters operate on assistant–user pairs (a user request and its model response are treated as a single unit for filtering, display, rating, pinning, context, etc.). 
Messages in the message history have the following metadata parameters: topic, flag (blue / grey), star rating (0-1-2-3), model, timestamp. Each of those parameters shall be subject to filtering via CLI filtering language.

Note: Actions can be executed on the filtered set via colon commands using the same input: `<filter> :<command>`. See `docs/colon_commands_spec.md` for the colon command grammar and the available commands (`export`, `tchange`).

## Design Philosophy

### Core Principles

**Efficiency First**: Single-letter commands minimize typing and maximize speed for power users.

**Intuitive Syntax**: Parameter patterns follow natural conventions (quotes for strings, numbers for quantities, operators for comparisons). Quoted strings support spaces and common escapes (\\, \' , \n, \t, \r).

**Composable Logic**: Standard boolean operators (`&`, `|`, `+`, `!`, parentheses) enable complex query construction. Whitespace is ignored; adjacency implies AND (e.g., `s2 r3` ≡ `s2 & r3`). `+` - implies OR.

**WYSIWYG Filtering**: The displayed conversation history exactly matches what gets sent to AI models after filtering. Future extensions may allow flags to alter what is sent vs displayed (see Extensibility).

**Command History**: In Command Mode, use ArrowUp/Down or Ctrl+P/Ctrl+N to navigate history. From Command Mode, Ctrl+P/Ctrl+N switches to Filter and immediately steps history. The last-draft is preserved; first Ctrl+P shows the previous command immediately.

**Help**: An in-app Help popup/cheatsheet is available and summarizes commands, operators, and examples.

### Use Cases

- **Context Refinement**: `r20 & s>=2` - Focus on recent important messages (min 2 stars)
- **Topic Research**: `t'AI...' & !s0` - All AI-related content that's been starred
- **Model Comparison**: `m'gpt-4' | m'claude'` - Compare outputs from specific models
- **Content Curation**: `(b | s3) & t'*Research'` - High-value research content (flagged or high star)

## Command Reference

### Topic Filtering (`t`)

**Purpose**: Filter messages by hierarchical topic paths or recent messages within current topic

**Syntax**: 
- `t'<topic_expression>'` - Filter by topic name/pattern
- `t` - Current topic (bare)
- `tN` - Last N messages of current topic (e.g., `t10`, `t5`)

**Topic Expression Formats (case-insensitive)**:
- **Exact Match**: `t'AI'` - Only messages in the "AI" topic (no children)
- **Hierarchical Match**: `t'AI...'` - Messages in "AI" and all descendant topics
- **Path Format**: `t'AI > Transformers > GPT > GPT-5'` -  reference (alternative to breadcrumb format)
- **Partial path format**: t'AI > Transformers ...' - for all children
- **Wildcard Match**: `t'*Learning'` - Topics ending with "Learning"
- **Wildcard Match**: `t'Machine*'` - Topics starting with "Machine"
- **Wildcard Match**: `t'*Neural*'` - Topics containing "Neural"
 - Combinations allowed: `t"*AI*..."` (wildcard name across the tree + descendants)

**Recent Messages of Current Topic (`tN`)**:
- `t10` - Last 10 messages of current topic (including descendants)
- `t5` - Last 5 messages of current topic
- `t20` - Last 20 messages of current topic
- Works only with current topic; combines topic filtering with recency limit
- Useful for focusing on recent conversation in active topic

**Bare `t` (Current Topic Shortcut)**:
- `t` with no quotes uses the current selection from the main topic selector (input area).
- Equivalent to quoting the current topic path/name depending on the UI selection; descendants are not implied (use `t'…...'` or an explicit descendant expression if needed later).

Notes:
- Quoted topic patterns may include spaces and escapes (e.g., `t'Natural Language Processing'`, `t'It\'s AI'`).
- Use wildcards to span words if desired (e.g., `t'*Natural*Language*Processing*'`).
- Numeric patterns: `t10` is recent count, `t'10'` is topic named "10"

**Examples**:
```
t'Artificial*Intelligence'           # Exact-ish topic match using wildcard (no spaces supported yet)
t'Artificial*Intelligence...'        # Topic and all children via wildcard
t'/ai/ml/neural-nets'               # Direct path format
t'*Learning'                        # All topics ending with "Learning"
t'Machine*'                         # All topics starting with "Machine"
t                                   # Use the current topic selected in the main topic selector
t10                                 # Last 10 messages of current topic
t5                                  # Last 5 messages of current topic
t'10'                               # Topic named "10" (if it exists)
```

### Star Rating Filtering (`s`)

**Purpose**: Filter messages by importance/quality rating (0–3 stars)

**Syntax**: `s[op]N` where `op` is one of `=`, `<`, `<=`, `>`, `>=` and `N` is 0–3. Shorthand `sN` is treated as equality (`s= N`). Evaluation uses the max stars of the pair (max of user and assistant importance).

**Examples**:
```
s0          # Exactly 0-star messages
s=1         # Exactly 1 star
s>=2        # At least 2 stars (2 or 3)
s3          # Exactly 3 stars (shorthand for s=3)
```

### Recent Messages (`r`)

**Purpose**: Boolean predicate over absolute recency (global chronology of pairs)

**Syntax**: `r<count>`

**Parameters**: Positive integer representing pair count

**Behavior**: True if a pair is among the last `<count>` pairs of the full conversation, regardless of other predicates. Works in boolean expressions, e.g., `s>=2 | r3` means at least 2-star pairs plus the last 3 pairs overall.

**Examples**:
```
r10         # Last 10 messages
r50         # Last 50 messages
r1          # Most recent message only
```

### Flag / Color Status (`b`, `g`)

**Purpose**: Filter messages by a simple user flag (blue = flagged, grey = unflagged). This flag is purely a labeling aid for filtering; it does not itself force inclusion/exclusion from LLM context.

**Visual**:
- Blue filled square = flagged (default for new messages)
- Grey outlined circle = unflagged

**Syntax**:
- `b` – Flagged (blue)
- `g` – Unflagged (grey)
- `!b` – Equivalent to `g`

**Examples**:
```
b           # Only flagged (blue) messages
g           # Only unflagged (grey) messages
!b          # Same as g
```

### Model Filtering (`m`)

Filter by assistant model name (case-insensitive). Supports `*` wildcards and a bare form.

Syntax: `m'<pattern>'` or bare `m` (uses current/pending model from the input bar)

Semantics:
- Wildcards: `*` matches any sequence of characters (no regex).
- Exact: without `*`, performs a case-insensitive exact match.
- Bare `m`: equivalent to `m'<current model>'` where the current model comes from the input bar (pending model if set; otherwise active model).

Examples:
```
m'gpt-4'              # exactly GPT-4
m'gpt*'               # all GPT family models
m'claude-3-opus'      # specific Claude variant
m                     # current model selected in the input bar
```

### Date Filtering (`d`)

Filter by pair timestamp (any message in the pair; earliest timestamp used). Supports absolute dates and relative ages. Operators: `<`, `<=`, `>`, `>=`, `=`.

Syntax:
- Relative age: `d<7d`, `d<=24h`, `d<2w`, `d<6mo`, `d<1y` (units: min, h, d, w, mo, y). If unit is omitted, days are assumed: `d<3` ≡ `d<3d`.
- Absolute date (local, unquoted):
	- `dYYYY-MM-DD` or `d=YYYY-MM-DD` (equality to calendar day)
	- `dYY-MM-DD` (two-digit year maps to 2000+YY), e.g., `d25-03-04` ≡ `d=2025-03-04`
	- With comparators: `d>=2025-01-01`, `d>=25-01-01`, `d<2025-09-01`

Semantics:
- Relative compares the age (now − timestamp) to the given threshold. Example: `d<7d` means newer than 7 days.
- Absolute uses local time; `=` matches the same calendar day.

Examples:
```
d<7d                  # within last 7 days
d<=24h                # within last 24 hours
d>=2025-01-01         # on/after Jan 1, 2025
d2025-01-01           # exactly on Jan 1, 2025 (local day)
d25-03-04             # exactly on Mar 4, 2025 (two-digit year)
```

### Messages with Attachments (`i`)

**Purpose**: Filter messages by presence of image attachments

**Syntax**: `i`

**Semantics**: 
- Includes pairs where the `attachments` array is non-empty (has one or more images)
- Useful for managing storage, finding visual content, or cleaning up attachment-heavy conversations

**Examples**:
```
i                       # Only messages with attachments
!i                      # Messages without attachments
i & t'Screenshots'      # Attachments in Screenshots topic
i & d<30d               # Attachments from last 30 days
i | e                   # Messages with attachments OR errors
```

### Content Search (`c`)

Filter by message content (user+assistant text concatenated per pair).

Syntax: `c'<pattern>'`

- Case-insensitive substring match by default.
- `*` acts as a wildcard matching any sequence (order-preserving when used between terms). e.g. `c'mad*d'`.
- No regex support. To express non-contiguous terms in any order, AND multiple `c` predicates: `c'transformer' & c'attention'`.

Examples:
```
c'algorithm'                 # pairs containing "algorithm"
c'*error*timeout*'           # pairs where "error" precedes "timeout"
(c'bug' | c'fix') & t'Code'  # debugging content in Code topic
```

### In-context Boundary (`o` / `oN`)

Purpose: Focus the view on what will be included by the current context boundary (model + settings). Optionally add a short “tail” of the newest off‑context pairs for situational awareness.

Syntax:
- `o` – keep only in‑context pairs
- `oN` – keep in‑context pairs plus the last N off‑context pairs (N ≥ 0; `o0` ≡ `o`)

Semantics (base–then–boundary):
- First, your query is evaluated without any `o` terms to form the base set.
- The context boundary is computed against that base (using the current/pending model and settings).
- `o` keeps only pairs included by the boundary.
- `oN` keeps those included pairs plus the newest N pairs that the boundary would exclude, preserving the original chronological order of the base set.

Negation and composition:
- `!o` selects only the off‑context pairs (relative to the base set).
- `!oN` selects off‑context pairs excluding the newest N of them.
- `o` does not change the boundary itself; it’s a projection on the base result and composes with other filters normally. Use parentheses as needed.

Sending vs. display:
- The added off‑context tail from `oN` is view‑only and does not change what the model receives. Off‑context items may be visually indicated as such in the UI.

Examples:
```
t'AI...' & o              # show only in‑context pairs within AI topics
(s>=2 | b) & o5           # in‑context plus 5 newest off‑context for awareness
!o & r20                  # the last 20 that would be dropped by the boundary
t'API' & m & o            # use bare m (current model) then project to in‑context
(t'AI...' & o) | r3       # union with global last 3 pairs
```

## Boolean Operators

### AND Operator (`&` and adjacency)

**Purpose**: Logical AND - both conditions must be true. Whitespace is ignored; adjacent commands imply AND: `s2r3` ≡ `s2 & r3`.

**Examples**:
```
r20 & s>=2                        # Recent messages that are highly rated
t'Programming...' & m'gpt-4'      # Programming topics from GPT-4
```

### OR Operator (`|` and `+`)

**Purpose**: Logical OR - either condition can be true. `+` is an alias of `|` to ease typing.

**Examples**:
```
s3 | b                  # 3-star messages OR flagged (blue) messages
m'gpt-4' | m'claude'    # Messages from either model
```

### NOT Operator (`!`)

**Purpose**: Logical NOT - negates the condition

**Examples**:
```
!s0                     # Exclude unstarred messages
!t'Archive...'          # Exclude archived topics
!(s0 | g)               # Exclude unstarred AND unflagged (grey) messages
```

### Grouping with Parentheses

**Purpose**: Control operator precedence and create complex logic

**Examples**:
```
(r50 | s3) & b          # (Recent OR 3-star) AND flagged
!((s0 & g) | t'Archive...') # NOT ((unstarred AND unflagged) OR archived)
(t'AI...' | t'Programming...') & s>=2  # Important messages from two topic trees
```

## Operator Precedence

**Order** (highest to lowest precedence):
1. **Parentheses** `()`
2. **NOT** `!`
3. **AND** `&` (and adjacency)
4. **OR** `|` and `+`

**Example**: `!s0 & t'AI...' | b` is evaluated as `((!s0) & t'AI...') | b`

## Common Usage Patterns

### Context Curation
```
r30 & s>=2              # Focus on recent important content (min 2 stars)
(b | s3)                # High-value messages (flagged or exactly 3-star)
t'Research...' & !s0    # Non-zero-starred research content
o                       # View exactly what the boundary includes right now
(t'AI...' & s>=1) & o5  # AI content in context + 5 newest off‑context
```

### Model Analysis
```
m'gpt-4' & s>=2         # High-quality GPT-4 responses (min 2 stars)
(m'gpt-4' | m'claude') & t'Coding...'  # Compare models on coding topics
```

### Topic Exploration
```
t'AI...' & d<7d         # Recent AI discussions
t'*Learning*' | t'*Neural*'  # All machine learning related topics
```

### Content Search
```
c'algorithm' & s>=1     # Starred content about algorithms (min 1 star)
(c'bug' | c'error') & t'Programming...'  # Debugging discussions
```

### Messages with Error Responses (`e`)

Filter to only pairs where the assistant response errored.

Syntax: `e`

Semantics:
- Includes pairs with `lifecycleState === 'error'` or a non-empty `errorMessage`.

Examples:
```
e                       # only pairs with response errors
e & d<7d                # error pairs from the last week
e & t'API'              # error pairs inside the API topic tree
```

## Implementation Considerations

### Parser Architecture

**Tokenizer**: Split input into tokens (commands, operators including `+`, implicit AND via adjacency, values, parentheses). Quoted strings form a single token and may include whitespace and escapes (\\, \' , \n, \t, \r).

**Expression Tree**: Build abstract syntax tree respecting operator precedence

**Evaluator**: Walk tree and apply filters to message collection. OR unions must de-duplicate by pair id and preserve original chronological order.

### Error Handling

**Syntax Errors**: 
- Invalid command letters
- Malformed expressions
- Unmatched parentheses
- Invalid date formats

**Runtime Errors**:
- Topic not found
- Invalid star rating values
- Malformed search patterns

**Error Response**: Stay in Command Mode, display error message, allow correction

## Usability details

- History saves only successful commands; invalid commands are not recorded.
- Inline hint appears near the CLI input for validation or parser errors and clears on input change, history navigation, or successful execution.
- Keyboard: Ctrl+P/Ctrl+N reserved for history in both Command and View modes; View mode `a` toggles the color flag; star ratings use bare keys `1`/`2`/`3` (Space clears) with no modifiers.

### Performance Optimization

**Lazy Evaluation**: Short-circuit boolean operations when possible

**Index Utilization**: Pre-compute indexes for topics, models, dates, star ratings

**Result Caching**: Cache filter results for repeated queries

### Future Extensions

**Saved Filters**: `@important` - Named filter aliases
**Regex Support**: `c/pattern/` - Regular expression content search  
**User Fields**: `author'John'` - Multi-user conversation support
**Fuzzy Search**: `t~'Machne Learning'` - Typo-tolerant topic matching
**Context Flags**: Postfix flags to influence sending vs displaying (e.g., `--s` show-only; `--k(advisor)` add persona prompt on send). Exact flag syntax TBD.

## Examples Library

### Basic Filtering
```
r10                     # Last 10 messages
s2                      # 2-star messages
t'Programming'          # Programming topic only
b                       # Flagged (blue) messages
```

### Intermediate Queries
```
r20 & s>=1              # Last 20 starred messages
t'AI...' & !s0          # All AI content that's been rated
m'gpt-4' | s3           # GPT-4 messages or 3-star content
```

### Advanced Queries
```
(r50 | s2) & !t'Archive...'             # Recent or important, not archived
(t'*Research*' | c'study') & s>=1       # Research content that's been starred
!(s0 & g) & (d<30d | t'Current...')     # Active content from last month or current topics
```

This specification provides a complete blueprint for implementing a powerful, intuitive CLI filtering system that matches the vim-inspired philosophy of MaiChat while enabling sophisticated context management for AI conversations.

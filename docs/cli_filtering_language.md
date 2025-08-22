# CLI Filtering Language Specification

## Overview

The MaiChat CLI Filtering Language is a concise, powerful query language designed for rapid context management in AI conversations. It enables users to construct precise filters using single-letter commands, boolean operators, and intuitive parameter syntax.

Unit of operation: All filters operate on assistant–user pairs (a user request and its model response are treated as a single unit for filtering, display, rating, pinning, context, etc.). 
Messages in the message history have the following metadata parameters: topic, allow(=include)/exclude flag, star rating (0-1-2-3), model, timestamp. Each of those parameters shall be subject to filtering via CLI filtering language.

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
- **Content Curation**: `(a | s3) & t'*Research'` - High-value research content

## Command Reference

### Topic Filtering (`t`)

**Purpose**: Filter messages by hierarchical topic paths

**Syntax**: `t'<topic_expression>'` or bare `t`

**Topic Expression Formats (case-insensitive)**:
- **Exact Match**: `t'AI'` - Only messages in the "AI" topic (no children)
- **Hierarchical Match**: `t'AI...'` - Messages in "AI" and all descendant topics
- **Path Format**: `t'AI > Transformers > GPT > GPT-5'` -  reference (alternative to breadcrumb format)
- **Partial path format**: t'AI > Transformers ...' - for all children
- **Wildcard Match**: `t'*Learning'` - Topics ending with "Learning"
- **Wildcard Match**: `t'Machine*'` - Topics starting with "Machine"
- **Wildcard Match**: `t'*Neural*'` - Topics containing "Neural"
 - Combinations allowed: `t"*AI*..."` (wildcard name across the tree + descendants)

**Bare `t` (Current Topic Shortcut)**:
- `t` with no quotes uses the current selection from the main topic selector (input area).
- Equivalent to quoting the current topic path/name depending on the UI selection; descendants are not implied (use `t'…...'` or an explicit descendant expression if needed later).

Notes:
- Quoted topic patterns may include spaces and escapes (e.g., `t'Natural Language Processing'`, `t'It\'s AI'`).
- Use wildcards to span words if desired (e.g., `t'*Natural*Language*Processing*'`).

**Examples**:
```
t'Artificial*Intelligence'           # Exact-ish topic match using wildcard (no spaces supported yet)
t'Artificial*Intelligence...'        # Topic and all children via wildcard
t'/ai/ml/neural-nets'               # Direct path format
t'*Learning'                        # All topics ending with "Learning"
t'Machine*'                         # All topics starting with "Machine"
t                                   # Use the current topic selected in the main topic selector
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

### Allow/Exclude Status (`a`, `x`)

**Purpose**: Filter messages by manual inclusion/exclusion status (context include flag)

**Syntax**:
- `a` - Allowed/included in context (includeInContext = true)
- `x` - Excluded from context (includeInContext = false)

**Aliases (backward-compatible)**:
- `p` ≡ `a` (legacy "pinned")
- `u` ≡ `x` (legacy "unpinned")

**Examples**:
```
a           # Only allowed/included messages
x           # Only excluded messages
!a          # All except allowed (equivalent to 'x')
```

### Model Filtering (`m`)

Filter by assistant model name (case-insensitive). Matches against `assistant_message.metadata.model` (or `modelName` fallback). Supports `*` wildcard.

Syntax: `m'<model>'` or bare `m` (current model from the input area)

Examples:
```
m'gpt-4'              # exactly GPT-4
m'gpt-*'              # all GPT family models
m'claude-3-opus'      # specific Claude variant
m                    # current model selected in the input bar
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

### Content Search (`c`)

Filter by message content (user+assistant text concatenated per pair).

Syntax: `c'<pattern>'`

- Case-insensitive substring match by default.
- `*` acts as a wildcard for any sequence of characters.
- No regex support (future option). To express non-contiguous terms in order, use `*` between them: `c'*transformer*attention*'`.
- To require multiple independent terms in any order, AND multiple `c` predicates: `c'transformer' & c'attention'`.

Examples:
```
c'algorithm'                 # pairs containing "algorithm"
c'*error*timeout*'           # pairs where "error" precedes "timeout"
(c'bug' | c'fix') & t'Code'  # debugging content in Code topic
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
s3 | a                  # 3-star messages OR allowed messages
m'gpt-4' | m'claude'    # Messages from either model
```

### NOT Operator (`!`)

**Purpose**: Logical NOT - negates the condition

**Examples**:
```
!s0                     # Exclude unstarred messages
!t'Archive...'          # Exclude archived topics
!(s0 | x)               # Exclude unstarred AND excluded messages
```

### Grouping with Parentheses

**Purpose**: Control operator precedence and create complex logic

**Examples**:
```
(r50 | s3) & a          # (Recent OR 3-star) AND allowed
!((s0 & x) | t'Archive...') # NOT ((unstarred AND excluded) OR archived)
(t'AI...' | t'Programming...') & s>=2  # Important messages from two topic trees
```

## Operator Precedence

**Order** (highest to lowest precedence):
1. **Parentheses** `()`
2. **NOT** `!`
3. **AND** `&` (and adjacency)
4. **OR** `|` and `+`

**Example**: `!s0 & t'AI...' | a` is evaluated as `((!s0) & t'AI...') | a`

## Common Usage Patterns

### Context Curation
```
r30 & s>=2              # Focus on recent important content (min 2 stars)
a | s3                  # High-value messages (allowed or exactly 3-star)
t'Research...' & !s0    # Non-zero-starred research content
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
- Keyboard: Ctrl+P/Ctrl+N reserved for history in both Command and View modes; View mode `a` toggles Allow/Exclude, `x` explicitly excludes; star ratings use bare keys `1`/`2`/`3` (Space clears) with no modifiers.

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
a                       # Allowed/included messages
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
!(s0 & x) & (d<30d | t'Current...')     # Active content from last month or current topics
```

This specification provides a complete blueprint for implementing a powerful, intuitive CLI filtering system that matches the vim-inspired philosophy of MaiChat while enabling sophisticated context management for AI conversations.

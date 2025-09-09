Here’s a focused reference for t (topic) filter arguments and behavior, plus practical examples. I’ll cover plain topics, paths, wildcards, descendants, and a few gotchas.

## what t matches
- Case-insensitive
- Matches by topic names (not IDs)
- Works against the topic tree; can target a single node or a subtree

## forms of t
- Bare t
  - t with no argument uses the current topic selected in the input bar.
  - Includes that exact topic only (no descendants).
  - Example: t combined with other filters: t & s>=2
- Name or wildcard
  - t'AI' matches topics named “AI”.
  - t'*Learn*' matches any topic whose name contains “Learn”.
  - Wildcard is glob-style: * matches any sequence (no ? or regex).
  - Examples:
    - t'AI'
    - t'*Learn*'
- Descendants
  - Add ... at the end to include matched topic(s) and all descendants.
  - Works with plain names, wildcards, and paths.
  - Examples:
    - t'AI...' → “AI” and all children
    - t'*AI*...' → any topic containing “AI” and all their children
- Path
  - Use > or / to specify a path of topic names from the root.
  - Whitespace around segments is ignored; leading / is optional.
  - Each segment can use wildcards.
  - Path must match the full path length to that node; adding ... includes descendants.
  - Examples:
    - t'AI > Transformers' → exactly the “Transformers” node under “AI”
    - t'AI > Transformers...' → “Transformers” node and all children
    - t'/AI/Transformers' → same as above
    - t'AI > *formers' → wildcard in a path segment

## examples cheat-sheet
- Single topic by name
  - t'AI'
- Name with descendants
  - t'AI...'
- Wildcard on name
  - t'*Neural*'
- Wildcard with descendants
  - t'*Neural*...'
- Exact path
  - t'AI > Transformers > GPT'
- Path with descendants
  - t'AI > Transformers...'
- Slash-separated path
  - t'/AI/Transformers'
- Current topic (no descendants)
  - t
- Combine with other filters
  - t'AI...' & s>=2
  - (t'AI...' | t'Programming...') & !s0

## notes and limits
- Matching is by names; if multiple branches have the same name, name-only queries match all of them. Use a path for disambiguation.
- Bare t doesn’t include descendants. To include them, name or wildcard the topic and add ....
- Wildcards use * only (glob), not regex.
- Path matching is exact by depth (unless you add ... to include deeper descendants).

If you want a shorthand for “current topic + descendants” (like t...), we can add it later; today, write the topic explicitly with ... (e.g., t'Current...' if you need that behavior).
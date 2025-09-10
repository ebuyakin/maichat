## current problem notes and comments.

### Tutorial

horizontal scroll bar.

# MaiChat Tutorial

topic tree for initialization:

1. General
2. Study
2.1. Math
2.2. Physics
2.2.1. Classic
2.2.2. Modern
2.3. CompSci
2.3.1. Python
2.3.2. Linux
3. Work
4. Entertainment
4.1. Fitness
4.2. Music
4.3. Movies
5. Curiousity
6. Travel

Model initialization:
use current set of models (except)

First message:

User: Hello! What is MaiChat? How to use it?
Assistant:
```
Welcome to MaiChat — a keyboard‑centric workspace for chatting with multiple AI models.

Quick start:
- Esc / Enter to cycle different modes; Ctrl+I / Ctrl+V / Ctrl+D jump to Input / View / Command.
- In View: j/k move between parts; g/G first/last; Shift+O jump to context boundary; Shift+R cycle reading position.
- In Input: Ctrl+M pick a model; Ctrl+T pick a topic; Enter sends.
- In Command: filter with terse queries, e.g. t'AI...'  d<7d  m'gpt*'  r10  s>=2  b
  • AND: space or &   • OR: | or +   • NOT: !   • Group: (...). Enter - to apply filter, Esc - switch to View, Ctrl-U - clear filter.

Tips:
- Your history is organized by topics; you can reassign any message later (Ctrl+T in View).
- Press F1 anytime for the full shortcut list and a compact CLI cheatsheet.
- Press Ctrl+. for the menu (or use mouse)
- Press Ctrl+Shift+H for the tutorial.

Ready when you are — type your first request below and press Enter.
```


2 issues to discuss:

1. focus after long response - when the user sent message the focus goes to the new message user part. (that's correctly works). when the response arrives and it doesn't fit the screen - the focus goes to the first assistant part. That is how it's described in the specs. #new_message_workflow.md that is how it worked, now it works differently. it moves focus to the first user request and it stays there. then if the assistant message is partitioned the View mode activates, but the focus stays on the first user part, doesn't move to the assistant part. Two errors: 1. the view mode shall be activated when the assistant response does not fit the viewport, not when it's just split into parts. Otherwise the input mode shall remain active. 2. if the view mode activated upone the assistant response, the first assistant part shall get focus, not the first user part. To be clear: this is just for the case of the new message workflow, not general switching between modes or navigation.


Desired (from spec):
After send, focus stays on the new user part; mode remains INPUT.
When the assistant reply arrives:
1. If the reply cannot fully fit in the viewport: switch to VIEW and focus the first assistant part of the new reply.
2. If the reply fits fully: remain in INPUT; focus stays in the input/new user context. The history pane is scrolled so the assistant response (all parts if there are more than one) is fully visible.
3. If user already left INPUT before the reply arrives: don’t change mode or focus.



2. The 'AI thinking...' indicator is not prominent enough. Is it possible to change the background color of the button when 'AI is thinking...' to bright blue? (VS Code style). Is it possible to introduce some more prominent dynamic elements that would inform the user that the app is not frozen, but just waiting for the response?

## current problem notes and comments.

Documents to review and find inconsistencies and duplications:
#ui_layout.md
#ui_view_reading_behaviour.md
#scroll_positioning_spec.md
#new_message_workflow.md

Noticed bugs / improvements:
Topic editor - message count by topic
Intra part gap default - 0 is fine. looks more compact.
Topic ordering - by date, by original meaning (=manuallly)o


Topic Editor
Ctrl+J - focus on topic tree; 
j/k - move down/up the tree, h/l - collapse/expand, n - new child topic, N - new root topic
r - rename topic, d - delete topic, m - mark topic, p - paste topic.

Edit focused tree parameters: Ctrl+E - system message, Ctrl+T - temperature, Ctrl+O - max response length.
Ctrl+S - Save changes, Esc - Cancel+Close.

when 'Save' is pressed 'Saved' badge appears (probably useful), but it should be 1) the same font size. 2) don't resize the overlay (now when it appears the overlay increases height)
Esc button - doesn't work (Esc - key works)
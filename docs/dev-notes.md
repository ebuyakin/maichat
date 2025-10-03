## current problem notes and comments.

## command line filtering UX and scenarios:
To avoid misunderstanding/confusion: command/filter line, command/filter input box - all refer to the control element that is used to type and apply the filter/commands. line/box - are generally used interchangeably.
Apply filter / execute command - actually means to execute whatever command is supposed to be executed. The most standard case is the execution is just filtering/refresh of the message history.

1. Message history reflects the filter displayed in the filter/command line (top zone)
2. Filter/command can be changed only in the command mode. When command mode is activated (by Esc from the view mode or via Ctrl-Dk) the command/filter input box gets focus automatically.

3. When the command/filter box is active:
- Esc clears the filter (but doesn't apply it)
- Enter applies the filter (only Enter key applies the filter) and switch to View mode.
- Ctrl-W - delete the last word in the command line
- Ctrl-U - delete all text in the command line (same as Esc)


Command/filter history:
- when the filter/command is applied (by pressing Enter) the command that has been applied is stored in localHistory and can be re-used later by the user (convenience to avoid re-typing the same command). NB the command is only stored when it's applied (not any typed text is stored).

- Ctrl-P - replaces the current content of the command/filter line (but doesn't apply filter until Enter)
- Ctrl-N - replaces the current content of the command line with the next filter in history.

Some typicals key secquences:
Starting from the view mode with no filter applied:
1. Esc (go to command mode, focus on command line)
2. 'r10' (for example) - type some filter
3. Enter - applie typed filter and switch to  View mode.
.... do something in view or input mode
4. Esc - back to command mode (focus on command line)
5. Esc or Ctrl-U - delete the existing filter
6. 's2' - type new filter
7. Enter - apply new filter


or another scenario:
5. Ctrl-P - replaces 'r10' with the previous filter from the history (say 'd<5')
6. Enter - apply 'd<5'
7. Ctrl-P - replaces 'd<5' with 'r10' (as it's now previous filter)
8. Ctrl-N - replaces 'r10' with 'd<5' (as it's the next filter in the history)
9. Esc - clear filter again
10. Enter - apply empty filter and switch to view mode (ie get the whole message history).




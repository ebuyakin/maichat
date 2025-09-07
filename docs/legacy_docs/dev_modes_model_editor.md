
## current problem notes and comments.

The Model Editor design:
7 vertical blocks:
1. 'Models' - title
2. Table with existing models (Grid)
6. Hint/help row
7. Sync models,

- The left-most elements: 'Models' badge, 'Add' button, hint/help row and 'Sync models' button shall be left aligned.
- the columns of the grid shall be aligned with the corresponding columns of the new model row.
- all blocks (1-7) shall be separated by 5 px margin
- The vertical scroll bar of the table/grid shall be 12px and ALWAYS visible (not fading)

The Model Editor navigation:

1. On open the Grid (table with existing models) and its first row is focused.
2. j/k g/G moves the focus/scroll along the rows (between the models). When we move to the row, no column is focused (just the row focused in general, not a specific column). Space - toggles enabled/disabled indicator (as now)
3. l/h - move the focus between the columns of a given row (ie parameters) Active parameter column is highlighted with thin blue border (as in other places in the app). the model name (model columnn) is not separately focusable (not editable). When we land to the row the first l moves focus to 'Context window' column. Parameters columns are editable.
4. Ctrl-N creates the new pre-filled row in the model list and moves focus to that row. The New Model line is not necessary and shall be deleted (that was a mistake from the beginning, that's why it was so difficult)
5. On Enter or Esc  - the separate yes/no dialogue window appears. On Enter - it says 'Confirm changes' Y/N - then on Y the changes are confirmed (take effect) and the overlays is close, on N - the focus goes back to the grid (last focused row) 
On Esc - it says 'Disregard changes' Y/N? - then on Y, changes are disregarded and the overlay is closed, on N - focus goes back to the grid (last focused row)

Add, Save, Cancel - buttons shall be removed. 'Sync models' stays, but remains ghost button for the future.
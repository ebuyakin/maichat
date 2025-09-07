## current problem notes and comments.

What M9 is about?
At the moment we have hardcoded list of models and their usage limits, right? The new user may have different availability of the models and different usage limits. It's important this information is correct and uptodate as it is used in the context assembly of the api call payload. I am not sure what is the simplest and easiest way to implement this. Need your advice.

Comments:
Wire into runtime:
Ensure boundary manager uses contextWindow (it already references model meta; we’ll verify and keep HUD aligned). - It's not just contextWindow, we have some more sophisticated formula that takes into account various constraints for calculation of the context-fitting boundary in the message history. Let's make sure we're on the same page here. Investigate how it works and give me some brief summary.

Next, I'll share my thoughts on options A/B/C.


Error message on the new response processing.
When we process the new request and get an error we mark the new message with the error type. Can you remind me what are the error types we recognize?


The Model Editor design:
7 vertical blocks:
1. 'Models' - title
2. Table with existing models (Grid)
3. Separator line
4. New model row
5. Add button
6. Hint/help row
7. Sync models, Save, Cancel buttons. 

- The left-most elements: 'Models' badge, 'Add' button, hint/help row and 'Sync models' button shall be left aligned.
- the columns of the grid shall be aligned with the corresponding columns of the new model row.
- all blocks (1-7) shall be separated by 5 px margin
- The vertical scroll bar of the table/grid shall be 12px and ALWAYS visible (not fading)
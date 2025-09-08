## current problem notes and comments.

1. Mouse/touchpad navigation vs. keys. Noticed issues:
1.1. The app has modal/spatial correspondence. Ie. the top zone of the main window is used only in the command mode, the middle - only in the view zone, the bottom - only in the input mode. So the elements can be activated by keyboard only in the correct mode. e.g. I can change the CLI filter when I am in input mode. BUT touchpad/mouse allows me to activate elements without changing the mode. This is confusing and potentially leads to conflicts. So, can we correct mouse/touch pad events in such a way that before the element is activated, the mode is switched correctly. E.g. if I am in the command mode and I use mouse/touchpad to focus on topic selector in the input mode, the mode is automatically changed to Input (prior to the selector getting focus? or right after it gets focus, but before I can do anything with it)? Not sure how this issue can be addressed, but it's important
1.2. Small issue, should be easy to fix. in the message history part meta (with metadata) is not focusable by keys, but it still can get focus by mouse/touchpad. Can we make it unfocusable for the mouse/touchpad as well?
With keyboard, when I navigate up/down the history I jump over the meta parts, so they never get 'active/focused' in terms of messageHistory (message history always has one part active/focused, but this is always user part or assistant part and never meta part). So meta parts don't get blue border when I navigate the history with j/k g/G keys. But with the mouse I can click on part meta and it does get the blue border and become 'active/'focused'. - that's the bug.

2. Help (F1) needs update and more structured listing of the key bindings. 
- Global keys (list and purpose)
- Modal keys (working in specific mode)
-- Input:
-- View:
-- Command:

keys for overlays don't needed as the overlays have hints in most of the cases

3. Tutorial like page. This is I don't know how to do correctly. Shall this be a separate static .html? What should be its structure? The idea is to explain the users what app is about and how to use it. Can you help here?

4. Initialization (for the release version). We need to initialize: 1. the topic tree (some basic/template starting point, so users don't start from scratch and easier get the idea how to use it), 2. model list - again, the users don't start from nothing, 3. the message history - I was thinking of initializing the app with 1 'greetings' message prepopulated, that would be a concise presentation of the app and its main features/purposes.


HELP PAGE COMMENTS: (DON'T CHANGE THE BEHAVIOUR OF THE APP - ALL COMMENTS HERE ABOUR THE HELP PAGE!)

1. general layout. Let's make 4 coluns: Global, Input mode, View mode, Command mode (in that order). Use narros group borders to visually separate the columns. Make the title, a different color, so it's easier to recognize.
2. Global: add Enter/Esc cycle to describe the switching between the modes (in addition to CTrl+... commands. leave Enter/Esc in each mode help too). Ctrl+T and Ctrl+M are not global commands. They work differently in View and Input mode and shall be described there. Ctrl+E and Ctrl+Shift+M - are global (work the same in all modes)

3. View. Group commands into sections: History navigation, Message attributes editing (stars, a, e, d, ctrl-T, space). Add n (does it work, by the way?) - it's go to new message first part command.

4. Input: add Ctrl+T - for topic selection.



BUGS:

1. ok, now make the overlay wider, so each command/key fits one row. Don't use bold colors. make the commands and their descriptions vertiaclly aligned (like column of shortcuts, the column of descriptions) [x]

2. the size of the overlay does not match the size of the content, so the content is out of the borders of the overlay itself. Adjust, sot the content fits the overlay. [ ]

3. change titles to Input Mode, View Mode, Command Mode. [x]

4. Make Ctrl+I, Ctrl+D , Ctrl+W - 3 different rows, [ ]

5. In global mode: Enter - switch to next mode, Esc - switch to previous mode (2 separate lines)

6. make the gap between the keys and their descriptions smaller by 20 px.

7. Make the keys and descriptions different color.


make the space between the rows the same in all columns (global/inpue mode/ etc..)
in view mode: a - toggle color code (not include), does n - command work? can you check?
everywhere where you describe Enter/Esc as Switch to ... add word 'mode'... 'Switch to Command Mode' / View Mode' etc..

Use the same font size for 'history navigation' and 'message attributes' as for all other text. The same font size everywhere.

Same row spacing across all columns: Done (uniform row-gap across sections). - probably you misunderstood me. In 'Global' columns the gap between the rows (eg F1 - help and Ctlr+. Toggle menu) is smalle than in Input Mode or Command mode, and all of them have bigger then View mode. It looks like the rows are spaced equally to fill the full height of the container. So, what I want: the height of the containers remain the same (as it is now), and the line spacing is constant across all columns regardless of the number of rows in the column. ok? let me know if this is not clear.

great, that's what I wanted. Now increase the margin/padding above 'Message attributes' , so there is a visual separation between the sections of keys of the View mode.
2. decrease the gap between the keys and their descriptions by 10px

Use the same font type and font size. No separate background color for shortcuts boxes.
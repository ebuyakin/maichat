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


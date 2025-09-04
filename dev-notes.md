
## High-level overview of the app

The app consists of the following components (not necessarily mapped into files/modules one-to-one)

0. Modal system and Mode management. Modal (vim-like) character of the application. (Input,View,Command)
- Keyboard presses listening, focus and mode transitions control;
- Mode switching and keybindings adaptation to the currenct/active mode;
- General UI layout and mode zones (top - command, middle - view, bottom - input). Spatial reflection of the modal system. Visual/spatial separation of the mode-specific UI zones.

1. Messge history. 
- Message history data model, and metadata attributes (storage and presentation);
- Message partitioning (splitting) into parts for reading convenience and navigation;
- Focused (active) message control; How does the focus move between the messages, what focus does for the message. Keyboard control of the focus.
- Reading regimes, scrolling, positioning of the focused message on the screen;
- Message history UI configuration control (settings) - padding, margins (intra and inter message parts);
- Metadata attributeds editing/update for the messages in history;
- UI styling, elements alignment, productivity, ergonomics of the message history reading, navigation, and search.

2. Topic management system.
- Data model of the hierarchical topic tree, storage and retrieval, basic operations.
- Topic editor. CRUD operations, navigation of the tree, renaming and rearrangement of the branches, message history statistics by topic. Keyboard-based navigation and search.
- New message topic selector. Select topic for the new message. Persistence. Efficient, user-friendly, keyboard-based navigation and search.

3. Command line filtering system.
- Filtering language specification
- Filtering language application to manage presentation of the message history.
- Message history filtering and display
- Command line commands history persistence and usage.
- Command line language extensions beyond filtering.

4. New message processing (including API calls)
- New message input (prompt/request) and metadata attributes specification;
- Fitting history computation and marking of the messge history in the UI. Fitting history - the messages that can be inlcuded into the assembled request in addition to the current message/request;
- Context assembly, and the API call full request composition, making API call, collecting response, managing waiting for the response state;
- Processing the LLM response, updating message history, managing post-response focus, mode swtiching, navigation, and UI badges update (message counter);
- Error processing, editing or/and deleteing messages from the history.

5. Configuration management.
- API keys, input, storage, and application in API calls.
- UI preferences management.
- Help system.



## Other important fils:
#implementation_plan.md
#project_vision.md
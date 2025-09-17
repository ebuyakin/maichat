# Overlays in MaiChat

There are several types of overlays used in the app:

### 1. Modal overlays
- Modal overlays acquire focus and prevent any key / mouse / pointer commands/events from propagating to other windows. Only one active overlays processes all user interaction at any given time. Since the same keys (shortcuts) are used to perform different commands in different situations it's important to strictly control which regime (manifested by the active overlay) is in effect and how are the key/pointer commands interpreted and implemented. This is general rule applied to all types of modal overlays.
- There are several different types of modal overlays.
#### 1.1. Information overlays (e.g. Daily Stats, Help)
- These overlays are for informatio only and do not require/allow any input from the user. They may have internal user interaction scenarios (like scrolling of the information display within them), but they don't introduce any persistent changes anywhere. These displays don't have Any confirmation/save/cancel buttons. They are closed by Escape key. These overlays exists do not trigger re-rendering of the message history or any other changes in the main window or anywhere in the app.
#### 1.2. Selectors (e.g. Topic Selector, Model Selector)
- These overlays modify the value of a single field either in the message history or in the input area. They don't have confirmation/cancel/save buttons or dialogues. They are exited on Enter (with change of the value they control) or on Escape (without changing of the value they control). These overlays exits do not trigger re-rendering of the message history.
#### 1.3. Editors (e.g. Topic Editor, Model Editor)
- These overlays modify configuration/parameters of the app or its components (like topic tree or model catalogue). These overlays have Save and Cancel buttons. These overlays allow to edit the underlying data and save the changes. The changes are saved explicitly via shortcut Ctrl-S or Pressing Save button. Escape command or Cancel button close the overlay and if any changes were saved, they trigger re-rendering of the message history. If no changes have been made, not re-rendering occurs. The re-rendering is processed in accordance with specs in scroll_positioning_spec.md and focus_management.md
#### 1.4 Menus (e.g. settings menu)
- these overlays serve as just as access point to other functions, they are closed either by clicking on their items or by Escape. They don't change any data, formatting, configuration or anything else. The exist from the menu does not trigger re-rendering of the message history.
#### 1.5. Confirmation dialog (e.g. topic change confirmation dialogue)
- these overlays are used to confirm important commands/actions and serve as an additional measure to prevent accidental actions that may have unintended consequences. These overlays have Confirm/Cancel button. They also accept y/N as confimation/cancellation command. These dialog do not change any underlying data and do not trigger re-rendering of the message history.
### 1.6. Settings overlay
- Settings overlay controls general configuration of the app. It shall have 3 buttons: 'Reset', 'Save & Close (Ctrl+S)' 'Cancel & Close (Esc)'. The first button saves the changes, closes the overlay and triggers the application of the changes (i.e. re-rendering of the messge history or other changes as the case may be). Cancel & Close - discard the changes and closes the overlay without triggering re-rendering of the main window.
### 2. Non-modal overlays (Debug overlays).
- These overlays don't block the underlying windows, don't overtake control and don't prevent any interaction of the user with the app interface elements.


### How Editors shall process changes:
- General rule: changes that are inputed by the user are applied to the state of the app (propagate, persist, saved) on explicit command, not immediately on edit. E.g. the settings overlay has 'Part Fraction' field. When the user changes the value, nothing shall happen with the app or with the stored data. The new value is saved when the user press Apply or corresponding key command.
- The changes affecting the presentation of the data (e.g. formatting of the message history) are reflected in the app, only when the overlay is closed, in other words, there is no background re-rendeding or other changes of the state of the windows behind the overlay.
- To summarize: There are 3 distinct actions: 1) typing new value in the field in the Editor (including creating new records in Model catalog or topic tree) - this shall be only 'drafting' visual representation of the intended changes. 2) saving the changes in the storage (persistent localStorage, indexedDB or some other persistent storage) 3) applying the changes to the state of the app (primarily message history - composition, focus, alignhment/anchoring, but to other components of the app as the case may be). 

The buttons and commands: There shall be unified way of approving/confirming data changes in Editors. Editors may have the following buttons:
1. 'Apply (Ctrl-S)' - the confirmation button (and key command that does the same). Pressing this button triggers saving the changes. When the changes are saved, the label changes to 'All saved'
2. 'Cancel+Close (Esc)' - the button (and key command Esc that does the same) - when pressed this command/button triggers clsoing the overlay (editor) and if required re-rendering of the message history (according to the specs in above and in scroll_positioning_spec.md and focus_management.md). When the confirmation button changes the label to 'All saved', the cancel/close button changes the label to 'Close (Esc)'. If user makes any further changes, both buttons change back to their original labels.
3. Settings overlay also have button 'Reset (Shift-Ctrl-R)' that restores default (factory) settings.

The buttons are placed in the bottom row of overlays in the following order from left to right:
<Reset>, Apply, Cancel+Close. 

Enter - key is free to be used for other purposes in Editors, it does not trigger Saving or Closing of the overlay.

In Topic Editor at the moment Esc is used inconsistently. It first activates the search button and if the search button is active it closes the overlay. Let's remove this inconsistency. So the desired behaviour: on open of the Topic editor the search button is active (as now) and all key commands work as they work now. Repeated activation of the search button is done with Ctrl-F (not with Esc) and Esc is reserved for Cancel+Close.

# Overlays formatting:
- fixed size. The overlays shall not mutate depending on the content or tab that is active. The size shall be fixed. And chosen in such a way as to avoid appearance of the sroll at all reasonable screen resolutions. Different overlays, however, don't have to have the same size (they can differ from each other)

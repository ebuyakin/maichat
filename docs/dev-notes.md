## current problme notes and comments.

### Error message handling.

What is error message in this context - we receive the response from API and for some reason the response is not the answer to the user's question. This can happen for many reasons (networking, cw/tpm other usage limits, what else?). Note, the context window limit is handled by the app (it cuts the context and repeats the attempt for a pre-configured number of times), but it's not 100% solution and still may return error message.
What is the task? We need to decide how this situation is presented to the user and how the user can respond to it.
How it works now (workflow):
1. After the message is sent to LLM, the message history is updated and the new user part appears at the bottom of the message history
2. When the response arrives the message history is updated again and the response appears below the the user part. Depending on the size of the response, it either get focus (the first part) or the focus stays in the Input field.
How the error case should look like:
if the response is 'error', the response part shall not appear. The metadata pane does appear and on the right hand side it displays error badge and 2 buttons: edit and delete (this is partially implemented).
If the user to press delete, the user part is deleted and focus gets back to the input field. (there should be some key command to delete the message).
If the user presses 'edit' the user part gets copied back to the input field and the user can either edit the message and send it or just send it again as it is. If the user edits/modifies the message, after he presses Send, the user part in the message history shall be updated to match the new (edited) message.

'Delete Error Message' scenarios:
We need to distinguish the active mode (command, view, input) and focused (sometimes called 'active' too) part in the message history (there is always one focused message regardless of the active mode). Whend the message is deleted (d) the app can be in different modes and the mode shall remain the same after delete.
Now, if the deleted message was in focus in message history, the focus moves to the previous message part. If the deleted message was not in focus, then the focus stays where it was. If deleted message was the only message (due to filtering) in the history and it was deleted, then the no message shall be in focus (I am not sure it fits the implementation and we can do it, let's discuss)

Ctrl+Shift-D
Ctrl+Shift-Y (update docs, keys document)

= New scenario: what if user doesn't edit or delete the error message and instead types and send the new message?

1. Exclude the pair by default from the context - I am not sure... it violates WYSIWIG principle. if we mark is as off (as other out-of-context) messages it gets too messy and confusing. User can be lost. I think it shouldn't be a problem if we just treat it as a regular message (albeit unanswered) for the purpose of context assembly. After all the user has multiple options how to exclude a given message from the context using CLI filter. And general philosophy of the app is that its user's responsibility to define the context scope.

2. The question is do we allow edit/delete of the error message AFTER the next message sent / responded? What if there are several error messages? How do we define which one is subject to Ctrl-Shift-D / Y commands?
Maybe! we should allow edit/delete messages ONLY in view mode and only the focused message? Ie we allow multiple error messages to be accumulated in the history if the user choses to do so. At any moment the user can go to VIEW mode, focus on the error message and using e/d (additional benefit, simpler keybindings) do what edit/delete command do (edit or delete). If we accept this, we simply don't allow edit/delete commands from other modes?

Important clarification: Keys: e = Edit & Resend (loads text into input; on send, updates the original pair text). When the user press e on the old (not last in history) error message, it's content (the question) is copied to the input box. The user can edit it in the input box as usual and send or send as is. In both cases, the old message (unanswered, with old timestamp and id) is deleted and the new message with the current timestamp and new id (and with the same other metadata such as topic, or model) is created (and placed at the end of the history). Right? So we avoid multiple branches and don't allow answering past questions (in the history), but simply allow to copy the content of the error message as a draft for the new one. 
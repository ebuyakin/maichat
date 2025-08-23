## noticed bugs

1. in the input area the alignment of model label and topic label shall have fixed position from the left edge (not from the previous element), so when the mode changes (and the length of the mode label changes) the model label and topic label remain static. reserve enough space for all mode names and for model names (say max length is 30 characters)
2. model label, topic labels in the input area - background color shall be the same as the input area (so, they should be transparent) - possible they should have border, so the do look like selectors
3. dark blue background behind the user request shall have the same padding as active message border (so it should expand around the user request, not touch its edges).
4. the active user request shall preserve its background (dark blue) color. now it gets black background when focused
5. Insert some padding between the user request and metadata pane.
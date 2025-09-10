## current problem notes and comments.

I think there is a conceptual problem...
we're mixing reading regimes with 'ad-hoc' scrolling positioning. so I suggest to change it conceptually and introduce 6 different non-overlapping positioning regimes

New Scrolling Rules:
0. No various top/bottom/center reading regimes at all (but see caveat at the end). We just remove them. It was a bad idea and it's too difficult to test all possible scenarios.
1. On open/reload the last part of last message is focused and anchored to the bottom (unless there is not enough history to fill the screen, then it's just 0 scroll).
2. On New request sent, the new message meta part is anchored to bottom, the new message user request is focused. (remember, focus and position are different things)
3. On new response arrival the rules are the same as in specs. (if fits - last part is anchored to the bottom, first part is focused, if doesn't fit first part is focused and anchored to the top)
4. When I am in the view mode and:
- I do j: the focus moves to the next part, if that new focused part is fully visible, then no scrolling happens, if it's not (ie it's below the viewport), then the new focused part gets anchored to the bottom when it gets focus.
- I do k: the focus moves to the previous part, if that new focused part is fully visible, then no scrolling happens, if it isn't (it's above the viewporw), then the new focused part gets anchored to the top.
So basically, the scrolling happens only to ensure the focused part is visible and it's done with minimum scrolling. I hope you get the logic.
5. I want to retain the possiblity of one 'reading regimes'. This is how it should work: when I initiate the 'reading regime', say by r/Shift R in the view mode: the focused message get anchored to the center, and when I navigate up and down (k/j), each time the history gets scrolled, so the new focused message is anchored to the center. The reading regime ends automatically, on g/G, new message, or new/changed filter.
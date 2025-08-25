# Layout mananagement and padding control

## 1. DOM structure of the message history (middle pane)

This is my understanding of the DOM tree:

body
    app
        topBar
        historyPane
            history
                pair
                    part user
                    part user // optional
                    ...
                    part meta
                    part assistant
                    part assistant // optional
        inputBar        

This documnent discusses the history pane padding (not topBar or inputBar formatting)

## 2.  What matters to Users. What padding/margins/gaps shall we be able to control.

A. all immediated content nodes (ie nodes containing the messages content - part user, part assistant) shall have some padding around the text. For the part assistant this padding is invisbile as the node has no visible border and its background color is equal to the background color of the history/historyPane (not sure where it's set). For part user the padding shall be visible as this node has dark blue background color. For consistency, I believe the padding shall be the same for both nodes (but visible, invisible depending on the typ) and the size of the padding shall be controlled via settings by the user
B. The gap between parts. There are several types of gaps between parts that in general might have different size:
1. gap between the topBar and the first part user of the first message - call it top gap.
2. gap between the inputBar and the last part of the last message (may be part user or part assistant depending wherther AI responded or thinking) - call it bottom gap.
3. gap between messages, ie gap betweeen the last part assistant of a given message and first part user of the next message - call it between-messages gap
4. gap between last part user of a given message and part meta - call top-meta gap
5. gap between part meta and the first part assistant - call it bottom-meta gap
6. gap between part user and part user (if the user request has several parts) - call in inter-user gap
7. gap between part assistant and part assistant (if the assistant response has several parts) - call it inter-assistant gap.

Generally speaking all gaps types can have different sizes (so they should be programmed to be managed independently?), but for simplicity let's set the following rules:

top gap = bottom gap = gap1
top-meta gap = bottom-meta gap = gap2
inter-user gap = inter-assitang gap = gap3
between-messages gap = gap4

So there are 4 different types of gaps that shall be controlled by the user via settings.

Implementation mapping (updated – container inset model):
| Concept | Setting Key | Applies To | CSS Mechanism |
|---------|-------------|------------|---------------|
| Part Padding (uniform) | `partPadding` | Inner wrapper `.part-inner` (user & assistant; meta minimal) | `padding: Xpx` |
| Edge Gap (persistent) | `gapOuterPx` | Space between topBar & first visible part and last visible part & inputBar | History pane top/bottom offset (container inset) |
| Meta Gap | `gapMetaPx` | user→meta, meta→assistant adjacencies | `margin-top` on following `.part` |
| Intra-role Gap | `gapIntraPx` | user→user, assistant→assistant | `margin-top` on following `.part` |
| Between Messages Gap | `gapBetweenPx` | `.pair` to next `.pair` | `margin-bottom` on each `.pair` except last |

Notes:
* Edge gap implemented structurally by increasing `#historyPane` inline `top` and `bottom` offsets by `gapOuterPx` (no internal spacer elements).
* Partition maxLines uses usableHeight = viewportHeight - 2*gapOuterPx ensuring any part fits fully within the pane while preserving the configured edge gap.
* Flex container gap removed (`.history{gap:0}`) to allow differentiated margins; we apply only a single directional margin (top of following element) to avoid doubling.
* Active highlighting encloses internal padding on `.part-inner` without changing left alignment (outer `.part` has no side padding).
* Migration: legacy keys still mapped; no change needed for existing user settings.

## 4. Edge Visibility Requirements (New)

1. Edge Gap Integrity: The top edge gap (`gapOuterPx`) must show the entire top border / focus ring / background edge of the first visible part. No clipping of the top 1px line is permitted.
2. Bottom Edge Integrity: The last visible part must never be partially clipped at the bottom edge of the viewport. It is either fully visible or fully outside the viewport (edge gap area remains empty when hidden).
3. Anchor Mode Independence: These constraints apply regardless of anchor mode (top / center / bottom) and while free–scrolling (not only during keyboard navigation).
4. No Dynamic Gap Shrink: We do not shrink `gapOuterPx`; instead part partitioning (maxLines) ensures a part’s height always fits inside `viewportHeight - 2*gapOuterPx`.
5. Highlight Ring Containment: The active part’s highlight (border or ring) must be fully visible even when the part is flush against the virtual reading position (i.e. inside edge gap boundaries).

Implementation Notes (planned):
* Replace outer box-shadow highlight (which can be clipped by container overflow) with an internal border (border-box) or inset shadow so all four edges remain visible.
* Introduce a post-scroll normalization step (or stricter scroll snapping) to snap the scroll position such that the first and last visible parts land on whole boundaries, eliminating partial edge rendering.

## 3. Left gutter / right gutter

The following nodes shall be vertically aligned (have the same horizontal position) to the left:
1. left edge of the commandInput (importantly commandInput shall have no padding, so first character is aligned, not the border on the node - it shall have no border, no padding, no background) of the topBar
2. left edge of the text inside part user and part assistant (not the border, but the text / first character)
3. left edge of the in/out node in the part meta
4. left edge of the inputField text (not the border, first character) in the inputBar
5. left edge of the modeIndicator (again first character, not the border)

Accordingly, certain elements shall be vertically aligned (have the same horizontal position) to the right:
1. right edge of the part user (border, not the text)
2. right edge of the timestamp
3. right edge of the Send button
4. right edge of the menu (hamburger, three dots) icon (not implemented yet, to be located in right edge of the topBar at the same vertical position as commandInput)


## Explanation of the top/bottom gaps!

The top gap (tg) is not just the gap between the first part of the first message and the topBar.
The top gap is the gap between the first VISIBLE part and the topBar bottom edge. I.e. when I use 'top reading position' and scroll up, the focused message is anchored at the top of the historyPane. And there should be a gap between that top edge of the first part (sitting in that position) and the topBar equal to tg. So top gap (tg) is about vertical position of the first visible part of the message history and the bottom edge of the topBar.

Equivalently, the bottom gap is the gap between the last VISIBLE part and the inputBar top edge. When the User applied 'bottom reading position' - the focused part is anchored to the bottom and there should be the gap between the bottom edge of the part and the top edge of the inputBar. When I scroll down and the next part gets focused, that new last part shall have the gap between its bottom edge and the top edge of the inputBar.

Let me clarify further. it's not just about active (focused part), it's about ANY VISIBLE part. so Even if I am in bottom-reading-position regime (or central-reading-position), the top visible part (whatever it is) shall have a gap between its top edge and the topBar (set by top gap parameter) and the last visible part (closest to the bottom of the screen) shall have a visual gap with the inputBar. 

There is a vertical gap (correct), but th top part (top-most visible part) is not positioned correctly. The top edge of the top part shall not be cut (hidden behind the gap? what is the effect called?) The top border of the top part shall be exactly at the gapOuter below the topBar, so the top blue line is visible. 
Similarily, the bottom part shall not be cut off in the middle, it's either displayed in full or fullly hidden.


## Scrolling behaviour
1. The historyPane always display only fully visible parts (no clipped, partially visible message parts)
2. Message part is either visible in full or not displayed at all (hidden)
3. Scrolling is discrete (not continuous). (but smooth motion is ensured)
4. Scrolling behaviour depends on the reading position mode
4.1. Top reading position: the active (focused) part is anchored to the top of the historyPane with preconfigured OuterGap. Then the screen displays as many following parts as the historyPane can accomodate in full. The rest of the history is hidden. On j/k the same pattern is reproduced counting from the new (post j/k) active (focused) part.
4.2. Bottom reading position: the active part is anchored to the bottom and then as many message before that are displayd as the screen can accomodate in full. The same principle applied on changing the active part.
4.3. Center reading position: the active part is positioned in the middle of the screen. Then as many parts before and after the active part are displayed as the screen can accomodate in full. The pattern repeats when the focus moves to a different active part.
5. Edge cases: 
5.1. Top reading position: if there are no parts hidden below the active parts (ie all following messages fit the historyPane), then the top reading position is disregarded and the focus (blue border) just moves along the screen (on j/k)
5.2. Similarily in Bottom reading position: if there are no parts hidden (not fitting the historyPane) above the active part, the bottom reading position is disregarded and the focus just move along the screen as well
5.3. Same for the center reading position.
Comment: to make sure this is clear. Say I focus on the last part of the last message in the history. and I am in the Top reading position. Following the standard rule, I would see that last part anchored to the top and the remaining part of the screen empty. This should not happen. As soon as there are no more messages to hide, the focus/cursor shall move to the next active part without scrolling.
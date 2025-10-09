## current problem notes and comments.


scrolling/anchoring of the new message in case pre-sending is not G. [x]
filtering upon changing the topic in the input box.[x]
smooth scrolling for j/k [x]
margin for the equations (top.bottom) [x]

fade visibility code - remove - what is fade visibility?
context boundary - o key, greying off-topic[x]
- 

scrolling bar - color [x]
e (re-ask) - alignment and model/topic parameters (don't change them)

copy tables - ...

settings:

remove legacy settings, redundant settings
equation size
line height
margins
smooth scrolling
refresh/re-rerender history on exit from settings.

more text editing keybindings (emac style Ctrl-A/E Ctrl-R) [x]


Ctrl-N - shall be deleted from the input mode keys.
how Ctrl-P should work in view mode:
it opens chronoTopicPicker and allows to choose one of the topic in history
On Enter topic is selected (and pending topic updated) and then if naked t is in in the filter (command zone)
the message history shall be refreshed/ re-rendered and the last message in the new selection shall be activated and anchored to the bottom
If, however, there is no naked t (t without an argument) in the current filter (no re-rendering, scrolling or changing active message should happen) 
## current tasks, notes and comments.

# bugs:
- Ctrl-P - choose a topic with default model. Then Reload - the model is changed to something else. [x]
- Grok - markdown recognition...[x]
- utilities functions - show the filtered history in console. Show orphaned images? [x]
- daily stats - activity stats [x]
- filter help [x]
- changelog/readme
- multiple tabs / separate browsers [x]

# reminders:
- tooltips for new (and check old) controls: link counter, image counter, topic picker, model picker [x]
- model badge in the input zone - expand to fit the longer model names [x]
- command history (filter command history - make it finite) [x]
- hyperlinks in the assistant messages open with lN [x] - add to tutorial/F1
- link topic to model (set combo: topic+model+search settings) [x]
- Topic editor redesign (layout, navigation) [x]
- Stats overlay: model stat in addition to daily stat, median response time by date / by model [x]
- file picker - no customization allowed. - tutorial notes about clipboarding [x]
- inherited system message and settings for children topics. [-]
- clearing debug code. local storage [x]
- filtering by messages with attachments [x]
- delete messages and attachments! [x]
- using localStorage for debugging. - effective, but bad idea
- parallel usage in several tabs - tutorial 

For Tutorial: [xj]
- tutorial about web search . 
- also tutorial about working with images - not aiming to upload large files etc... only for snapshots.
- delete command
- new keys Ctrl-Shift-s - view links overlay in view mode - add to Tutorial/F1
- new keys lN - for the link opening (in new tab) - add to Tutorial/F1
- new keys Ctrl-Shift-o - open image overlay in input mode - add to Tutorial/F1
- new keys i - open image overlay in view mode
- new keys Ctrl-F - file picker - add to Tutorial/F1/keyboard_reference

fixes/changes:
1. vercel analytics and privacy statement update. Decide y/N? [ ]
2. model catalog updated [x]
3. in index.html meta tags updated (Gemini added). [x] also add Grok!
4. update index.html to reflect the new tagline and other content. [x]
5. feedback collection [x]
6. tutorial - collapsed sections. [x]


new version specs/fixes/ideas:
1. model catalogue update (changing model names) - think how?
2. Grok integration
3. Internet search
4. Attachments
5. file recognition.


ok, plain_text_policy.md is a way outdated... it was created for the 0.1 version when we ignored all markdown and embedded content in order to split the message into measurable parts based on token counting. Since then we walked a long road. The app is very different now. We now parse and render code snippets, math equations and all standard markdown. Can you investigate the relevant #codebase and #file:docs (#history_navigation_redesign, #inline_content_rendering, #messages_with_code_snippets)

also, what about the width/height of the image overlay? is it fixed? is it derived from the image width/height? I just want to understand how it's defined. For one thing it should not change depending on the size of the image, the image should be scaled to fit the pre-defined image overlay.


{'model': 'gpt-5-mini',
 'input': [{'role': 'user',
   'content': [{'type': 'input_text', 'text': 'What animal is in this image:'},
    {'type': 'input_image',
     'image_url': 'data:image/png;base64,iVBO...







filter help:

t - current topic (all)
t10 - current topic (last 10 messages)
t'My topic' - all messages from My topic
t'My topic...' - My topic and its children
t'*learning' - wild card (topic ending with "learning")

d<7 - last 7 days
d<3h - last 3 hours
d25-10-11 - messages on that date
d>25-10-01 & d<=25-10-10 - messages from specific date range

s1 - ranked 1 star
s>2 - ranked 2 stars and higher

b - messages with blue color marks
g - messages with grey color marks

m'gpt-5-mini' - messages from specific model
m'gpt*' - messages from model start with "gpt"


c'python' - message contains word "python"
c'tomorrow*weather' - wild card search
c'tomorrow' + c'weather' - messages containing either word

r10 - 10 recent messages (all topics)

t s2 - messages from current topic with 2 stars
t d<3 - messages from current topic for the last 3 days
t + t'My topic' - messages from current topic or "My topic"


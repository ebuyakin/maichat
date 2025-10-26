## current tasks, notes and comments.

# reminders:
- tooltips for new (and check old) controls: link counter, image counter, topic picker, model picker
- model badge in the input zone - expand to fit the longer model names [x]
- new keys Ctrl-Shift-s - in view mode - add to Tutorial/F1
- new keys lN - for the link opening (in new tab) - add to Tutorial/F1
- new keys Ctrl-Shift-o - open image overlay - add to Tutorial/F1
- command history (filter command history - make it finite)
- using localStorage for debugging. - effective, but bad idea
- hyperlinks in the assistant messages open with lN [x] - add to tutorial/F1
- link topic to model (set combo: topic+model+search settings)
- timing of the response - is it saved? expose average time in daily stats?
- file picker - j/k navigation? default folder, default focus. - tutorial notes about clipboarding
- also tutorial about working with images - not aiming to upload large files etc... only for snapshots.

fixes/changes:
1. vercel analytics and privacy statement update. Decide y/N? [ ]
2. model catalog updated [x]
3. in index.html meta tags updated (Gemini added). [x]
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
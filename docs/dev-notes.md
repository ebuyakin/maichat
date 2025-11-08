## current tasks, notes and comments.


0. Alignment on Shift-E - 
1. context boundary - disappeared?
2. Geminit math enhancement - length limit for block equations?

1. empty topic [x]
2. delete message on error


### Bugs / enhancements for the next release
1. right gutter default setting - 7 to 10 [x]
2. 'Send' label on the button - aligned to the right - shall be to the middle [x]
3. Math formatting in Gemini (see example) [x]
4. topic picker scrolling and mouse selection [x]
5. Loading... text on reload [x]
6. rounding of the blue border [~] - deferred
7. scrolling on API key overlay open. - changed to Ctrl+; [x]
8. Settings overlay overflow. [x]
9. background color and font width settings [x]
10. tutorial 'reading experience' configuration section [x]
11. re-ask for any request! - new feature. [x] 
12. interval between error/delete buttons and model badge in the meta line. [x]
13. Custom system message, inheritance. [x]
14. Default colors, font weight 
15. Multiple presets [-] - rejected
16. Gutter limits [x]
17. Tutorial - numbers on separate lines [x]
18. Tutorial - overview in sections link to the top. [x]
19. vercel statistics enabler. privacy policy update.

### Requirements for version 1.2
1. pdf attachments
2. pdf export
3. backup import
4. new models - qwen, mistral, gigachat, deepseek
5. drag and drop attachments
6. moderation parameter
7. accurate context limit calculation


### tutorial updates for 1.1.5

1. reading experience. settings expansion [x]
2. re-sending the message to a different model or in a different context [x]
3. keys/shortcuts update. just double check. [x]


System instruction. Absolute Mode. Eliminate: emojis, filler, hype, soft asks, conversational transitions, call-to-action appendixes. Assume: user retains high-perception despite blunt tone. Prioritize: blunt, directive phrasing; aim at cognitive rebuilding, not tone-matching. Disable: engagement/sentiment-boosting behaviour. Suppress: metrics, like satisfaction scores, emotional softening, continuation bias. Never mirror: user's diction, mood, or affect. Speak only: to underlying cognitive tier. No: questions, offers, suggestions, transitions, motivational content. Terminate reply: immediately after delivering info - no closures. Goal: restore independent, high-fidelity thinking. Outcome: model obsolescence via user self-sufficiency


new seeding topic tree:

1. General
1.1. Daily news
1.2. Random questions
2. Learning
2.1. Math
2.2. Physics
2.2. Art
3. Coding
3.1. Python
3.2. JavaScript
4. Health
4.1. Exercise
4.2. Diet
4.3. Medication
5. Debating club
5.1. Life
5.2. Politics
6. Naked truth

system messages:

Checklist

1. Tutorial rebuild
Run your existing build (npm run tutorial:build).
Open the generated tutorial.html, spot check: Step 7, Reading Experience, System Messages paragraph, anchor links (images-overview, search-overview).
2. Version bump
Update package.json version: 1.2.0.
If SEED_VERSION should remain 1 (no migration for existing users), leave it. If you want existing users to get new seeded topic tree automatically, bump SEED_VERSION to 2 and add a migration note (optional).
3. Vercel Web Analytics
In the Vercel dashboard enable Web Analytics for the project.
Add this one line inside <head> of index.html and tutorial.html (or app.html if that’s your entry): <script defer src="https://vercel.com/analytics/script.js"></script>
Deploy; verify in Vercel dashboard after a visit.
4. CHANGELOG.md
Add a 1.2.0 section: Added: Second Opinion re‑ask; Reading Experience customization; per‑topic seeded system messages; copy‑on‑create inheritance; first‑load seeding render fix; tutorial expansions.
Mention internal: bootstrap conditional render post‑seeding.
5. README.md (only if needed)
Optional short “What’s new in 1.2.0” or link to tutorial page.
Confirm instructions for running dev and building tutorial are current.
6. Testing & validation
Fresh incognito load: greeting + API key overlay visible.
Create new child topic under “Coding” → inherits Coding system message.
Re‑ask (E / Shift+E) works; toggling preserves previous answer.
Tutorial anchor “Overview” subsections jump correctly (no collisions).
Run vitest (npm test or npm run test) and ensure green.
7. Performance sanity
First paint still fast (no added blocking code).
Check console for missing asset warnings.
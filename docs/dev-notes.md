## current tasks, notes and comments.

### pre-release:
Shift-U or something - for top position of the current message (in addition to u - for the previsou message) [x]
tN - N last messages of a given topic (as opposed to trN which is t AND rN - ie topic messages among last N) [x]
interrupting the response waiting - [x]
100 ms waiting... including loading optimization [x] - that's a big one!
log messages - to remove [x]
scrollAndRefresh - to remove [x]
LEGACY_KEYS in index.js [x]
legacy code in interaction.js - deferred.
system messages for different topics? - deferred. - tutorial - updatead [x]
icon - I have a good one. [x]

#### initialization for new users:
1. tutorial [x]
2. model catalogue - usage limits defaults? [x]
3. default settings - double check they match my current settings [x]
4. default topic tree - prepare initial topic tree for new users [x]
5. first message / greeting. [x]
6. Double check keyboard reference / F1 help - to make sure they reflect the latest changes. [x]

#### code polish:
1. remove debug code. inclduing scroll-alignment experimental file
- fadeVisible, ensureVisible, parts.. - what is unused? 
- feature flags, legacy_keys.
2. readme, changelog - consider this the first real public beta.

#### push/production/release steps:
- publish on github pages (as current version) - generally should work automatically after push
- launch on vercel

2. discoverability of the app.

Recommended Actions:
Priority 1 - Remove (Noisy/Useless):
❌ All boot console.log statements in main.js (10+ lines)
❌ Scroll debug logs in scrollControllerV3.js (4 lines)
❌ Code/equation overlay logs (3 lines)
❌ window.__BOOT_STAGE global
❌ console.log('xxx') in scrollControllerV3.js (line 89)
Priority 2 - Consider:
❓ Context trimming log (line 314) - make it conditional on debug flag?
❓ window.__scrollController and window.__store - remove or keep for console debugging?
Keep (Already Safe):
✅ HUD system (dev-gated)
✅ Request debug overlay (dev-gated)
✅ Focus debug logs (gated by window.__focusDebug)
✅ Error handlers and warnings
✅ Essential window.__ globals used by app logic


Test non-delay on scrolling to bottom:
1. regular topic picker
2. chrono topic picker
3. model picker
4. error edit
5. error delete
6. settings update

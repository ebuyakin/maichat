## current problem notes and comments.

### pre-release:


#### initialization for new users:
1. tutorial [x]
2. model catalogue - usage limits defaults? [x]
3. default settings - double check they match my current settings [x]
4. default topic tree - prepare initial topic tree for new users [x]
5. first message / greeting. [x]
6. Double check keyboard reference / F1 help - to make sure they reflect the latest changes. [x]

#### code polish:
1. remove debug code
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

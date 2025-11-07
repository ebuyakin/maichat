# MaiChat v1.2.0 — Second Opinion, Seeded System Messages, First‑Load Fix

Date: 2025-11-07  
Tag: v1.2.0

## What’s new

### Added
- Second Opinion: Press `E` to re‑ask with a different model; `Shift+E` toggles the last two answers — no history clutter.
- Seeded topic tree with curated system messages (General, Daily news, Random questions, Learning, Coding, Health, Debating club, Naked truth).
- Copy‑on‑create inheritance: new child topics inherit the parent’s system message at creation time.
- Privacy‑friendly Web Analytics on landing/tutorial pages (cookie‑less; no personal data).
- Tutorial updates: Second Opinion, System Messages, Reading Experience.

### Changed
- More direct, user‑first system messages across seeded topics.
- Initial load improvement: welcome message now appears on the very first fresh load beneath the API key overlay.
- README updated with current model catalog and privacy note.

### Fixed
- First‑load empty history (seeding previously occurred after initial render without repaint).

### Notes
- Seeded topics and system messages apply to fresh profiles only (existing users keep their data). To see the new tree locally, clear the app’s localStorage + IndexedDB or use a fresh profile.
- No breaking changes; minor version bump reflects user‑visible improvements.

## Links
- Tutorial: https://maichat.io/tutorial.html
- Changelog: https://github.com/ebuyakin/maichat/blob/main/CHANGELOG.md
- Keyboard reference: https://github.com/ebuyakin/maichat/blob/main/docs/keyboard_reference.md
- Compare: https://github.com/ebuyakin/maichat/compare/v1.1.0...v1.2.0

## Acknowledgments
Thanks to Eugene for direction, testing, and feedback.

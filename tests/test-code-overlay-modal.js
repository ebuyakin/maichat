// Lightweight runtime smoke test for modal-integrated code overlay.
// NOTE: This does not fully simulate focus trap (needs DOM interaction in browser),
// but exercises show/update/close pathways.

import { createCodeOverlay } from '../src/features/codeDisplay/codeOverlay.js';

// Mock minimal modeManager
const modeManager = { mode:'view', set(m){ this.mode=m } };

const overlay = createCodeOverlay({ modeManager });

const block1 = { language:'python', lineCount:2, code:'print("Hello")\nprint("World")' };
const block2 = { language:'javascript', lineCount:1, code:'console.log("Hi")' };

console.log('Showing first block...');
overlay.show(block1, {});
console.log('Visible?', overlay.isVisible());

console.log('Updating to second block (should not close/reopen)...');
overlay.show(block2, {});
console.log('Visible after update?', overlay.isVisible());

console.log('Closing overlay...');
overlay.close('test');
console.log('Visible after close?', overlay.isVisible());

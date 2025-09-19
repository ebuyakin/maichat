// Moved from src/settings/index.js (Phase 5 core move)
// Removed legacy anchorMode / edgeAnchoringMode (stateless scroll now always explicit). Fallback is 'bottom'.
// Updated spacing defaults (2025-09-11): gapOuterPx 15 (was 6), gapMetaPx 4 (was 6), gapIntraPx 4 (was 6)
// Removed unused topZoneLines / bottomZoneLines (2025-09-11) — never implemented in scrollControllerV3; legacy keys are ignored if present in stored JSON.
const DEFAULTS={ partFraction:0.2, partPadding:15, gapOuterPx:15, gapMetaPx:4, gapIntraPx:4, gapBetweenPx:10, fadeMode:'binary', fadeHiddenOpacity:1, fadeInMs:120, fadeOutMs:120, fadeTransitionMs:120, scrollAnimMs:240, scrollAnimEasing:'easeOutQuad', scrollAnimDynamic:true, scrollAnimMinMs:80, scrollAnimMaxMs:600, assumedUserTokens:256, userRequestAllowance:600, assistantResponseAllowance:800, maxTrimAttempts:10, charsPerToken:4, showTrimNotice:false, topicOrderMode:'manual' }
const LS_KEY='maichat.settings.v1'
let current=null; const listeners=new Set()
export function loadSettings(){
	if(current) return current;
	try {
		const raw=localStorage.getItem(LS_KEY);
		if(raw){
			const parsed=JSON.parse(raw);
			// Legacy gap/spacing migration
			if(parsed && (parsed.paddingPx!==undefined || parsed.gapPx!==undefined)){
				if(parsed.paddingPx!==undefined && parsed.partPadding===undefined) parsed.partPadding=parsed.paddingPx;
				if(parsed.gapPx!==undefined){
					if(parsed.gapIntraPx===undefined) parsed.gapIntraPx=parsed.gapPx;
					if(parsed.gapMetaPx===undefined) parsed.gapMetaPx=parsed.gapPx;
					if(parsed.gapOuterPx===undefined) parsed.gapOuterPx=parsed.gapPx;
					if(parsed.gapBetweenPx===undefined) parsed.gapBetweenPx=parsed.gapPx;
				}
				delete parsed.paddingPx; delete parsed.gapPx;
			}
			// Legacy fade transition single value → split
			if(parsed && parsed.fadeTransitionMs!=null){
				if(parsed.fadeInMs==null) parsed.fadeInMs=parsed.fadeTransitionMs;
				if(parsed.fadeOutMs==null) parsed.fadeOutMs=parsed.fadeTransitionMs;
			}
			// Remove deprecated zone line keys if present
			if(parsed){ delete parsed.topZoneLines; delete parsed.bottomZoneLines }
			current={ ...DEFAULTS, ...parsed };
		} else {
			current={ ...DEFAULTS };
		}
	} catch {
		current={ ...DEFAULTS };
	}
	return current;
}
export function saveSettings(patch){ current={ ...loadSettings(), ...patch }; try { localStorage.setItem(LS_KEY, JSON.stringify(current)) } catch{}; for(const fn of listeners) fn(current); return current }
export function getSettings(){ return loadSettings() }
export function subscribeSettings(fn){ listeners.add(fn); return ()=>listeners.delete(fn) }
export function resetSettings(){ current={ ...DEFAULTS }; saveSettings({}) }
export function getDefaultSettings(){ return { ...DEFAULTS } }

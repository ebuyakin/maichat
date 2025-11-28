// App Version Migrations
// Runs on every app load to upgrade localStorage for existing users

const APP_VERSION_KEY = 'maichat_app_version'
const CURRENT_VERSION = '1.2.5'

/**
 * Migration for v1.2.5
 * - No actions needed (just marking version)
 * - Pipeline: Defaults to new (check is !== 'false')
 * - Models: normalize() adds new BASE_MODELS automatically
 * - Settings: Merge with DEFAULTS adds new settings automatically
 */
function migrate_1_2_5() {
  // No actions needed - everything handled by existing logic
  console.log('[Migrate] Applied 1.2.5 migration')
}

/**
 * Run app migrations
 * Called early in app bootstrap (before anything reads localStorage)
 * Idempotent: safe to run multiple times (early exits if current)
 */
export function runMigrations() {
  try {
    const storedVersion = localStorage.getItem(APP_VERSION_KEY)
    
    // Early exit: already on current version
    if (storedVersion === CURRENT_VERSION) {
      return
    }
    
    // Run migrations for all versions between storedVersion and CURRENT_VERSION
    if (!storedVersion || storedVersion < '1.2.5') {
      migrate_1_2_5()
      
      // Future migrations go here:
      // if (!storedVersion || storedVersion < '1.3.0') {
      //   migrate_1_3_0()
      // }
      
      // Mark upgrade complete
      localStorage.setItem(APP_VERSION_KEY, CURRENT_VERSION)
      console.log(`[Migrate] Upgraded to ${CURRENT_VERSION}`)
    }
    
  } catch (err) {
    console.error('[Migrate] Migration system failed:', err)
    // App continues with current state
  }
}

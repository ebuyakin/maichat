/**
 * Settings Schema - Single Source of Truth
 * 
 * All application settings defined here with metadata:
 * - defaultValue: Initial/fallback value
 * - renderAction: 'rebuild' | 'restyle' | 'none'
 *   - 'rebuild': Requires full history re-render (affects layout/content)
 *   - 'restyle': Only CSS update needed (affects appearance only)
 *   - 'none': No visual change (affects behavior/future operations)
 * - control: UI control specification { type, min, max, step, options }
 * - ui: Display metadata { label, tab }
 */

export const SETTINGS_SCHEMA = {
  // ========================================
  // SPACING SETTINGS
  // ========================================
  
  fadeZonePx: {
    defaultValue: 10,
    renderAction: 'restyle',
    control: { type: 'number', min: 0, max: 120, step: 1 },
    ui: { label: 'Fade Zone (px)', tab: 'spacing' },
  },
  
  messageGapPx: {
    defaultValue: 10,
    renderAction: 'restyle',
    control: { type: 'number', min: 0, max: 60, step: 1 },
    ui: { label: 'Message Gap (px)', tab: 'spacing' },
  },
  
  assistantGapPx: {
    defaultValue: 5,
    renderAction: 'restyle',
    control: { type: 'number', min: 0, max: 60, step: 1 },
    ui: { label: 'Assistant Gap (px)', tab: 'spacing' },
  },
  
  messagePaddingPx: {
    defaultValue: 15,
    renderAction: 'restyle',
    control: { type: 'number', min: 0, max: 48, step: 1 },
    ui: { label: 'Message Padding (px)', tab: 'spacing' },
  },
  
  metaGapPx: {
    defaultValue: 10,
    renderAction: 'restyle',
    control: { type: 'number', min: 0, max: 48, step: 1 },
    ui: { label: 'Meta Gap (px)', tab: 'spacing' },
  },
  
  gutterLPx: {
    defaultValue: 15,
    renderAction: 'restyle',
    control: { type: 'number', min: 0, max: 400, step: 1 },
    ui: { label: 'Gutter Left (px)', tab: 'spacing' },
  },
  
  gutterRPx: {
    defaultValue: 10,
    renderAction: 'restyle',
    control: { type: 'number', min: 0, max: 400, step: 1 },
    ui: { label: 'Gutter Right (px)', tab: 'spacing' },
  },
  
  historyBgLightness: {
    defaultValue: 7,
    renderAction: 'restyle',
    control: { type: 'number', min: 0, max: 20, step: 1 },
    ui: { label: 'History Background Lightness (%)', tab: 'reading' },
  },

  // Typography (user-facing)
  textLightnessPct: {
    defaultValue: 74,
    renderAction: 'restyle',
    control: { type: 'number', min: 50, max: 90, step: 1 },
    ui: { label: 'Text Lightness (%)', tab: 'reading' },
  },
  fontWeightNormal: {
    defaultValue: 300,
    renderAction: 'restyle',
    control: { type: 'number', min: 1, max: 900, step: 1 },
    ui: { label: 'Font Weight – Normal', tab: 'reading' },
  },
  fontWeightStrong: {
    defaultValue: 400,
    renderAction: 'restyle',
    control: { type: 'number', min: 1, max: 900, step: 1 },
    ui: { label: 'Font Weight – Strong', tab: 'reading' },
  },
  
  useInlineFormatting: {
    defaultValue: true,
    renderAction: 'rebuild',
    control: { type: 'checkbox' },
    ui: { label: 'Inline Markdown Formatting', tab: 'reading' },
  },

  // Assistant reading layout
  twoColumns: {
    defaultValue: false,
    renderAction: 'restyle',
    control: { type: 'checkbox' },
    ui: { label: 'Two Columns (Assistant Text)', tab: 'reading' },
  },
  justifyColumns: {
    defaultValue: false,
    renderAction: 'restyle',
    control: { type: 'checkbox' },
    ui: { label: 'Justify Text (Two Columns)', tab: 'reading' },
  },
  
  // ========================================
  // SCROLL ANIMATION SETTINGS
  // ========================================
  
  scrollAnimMs: {
    defaultValue: 240,
    renderAction: 'none',
    control: { type: 'number', min: 0, max: 1200, step: 20 },
    ui: { label: 'Base Duration (ms)', tab: 'scroll' },
  },
  
  scrollAnimDynamic: {
    defaultValue: true,
    renderAction: 'none',
    control: { type: 'select', options: [true, false] },
    ui: { label: 'Dynamic Scaling', tab: 'scroll' },
  },
  
  scrollAnimMinMs: {
    defaultValue: 80,
    renderAction: 'none',
    control: { type: 'number', min: 0, max: 1000, step: 10 },
    ui: { label: 'Min Duration (ms)', tab: 'scroll' },
  },
  
  scrollAnimMaxMs: {
    defaultValue: 600,
    renderAction: 'none',
    control: { type: 'number', min: 0, max: 2000, step: 20 },
    ui: { label: 'Max Duration (ms)', tab: 'scroll' },
  },
  
  scrollAnimEasing: {
    defaultValue: 'easeOutQuad',
    renderAction: 'none',
    control: { 
      type: 'select', 
      options: ['linear', 'easeOutQuad', 'easeInOutCubic', 'easeOutExpo'] 
    },
    ui: { label: 'Easing', tab: 'scroll' },
  },
  
  // ========================================
  // NAVIGATION ANIMATION PREFERENCES
  // ========================================
  
  animateSmallSteps: {
    defaultValue: true,
    renderAction: 'none',
    control: { type: 'checkbox' },
    ui: { label: 'Animate j/k (small steps)', tab: 'scroll' },
  },
  
  animateBigSteps: {
    defaultValue: true,
    renderAction: 'none',
    control: { type: 'checkbox' },
    ui: { label: 'Animate J/K (big steps)', tab: 'scroll' },
  },
  
  animateMessageJumps: {
    defaultValue: true,
    renderAction: 'none',
    control: { type: 'checkbox' },
    ui: { label: 'Animate u/d (message jumps)', tab: 'scroll' },
  },
  
  // ========================================
  // CONTEXT ASSEMBLY SETTINGS
  // ========================================
  
  userRequestAllowance: {
    defaultValue: 600,
    renderAction: 'none',
    control: { type: 'number', min: 0, max: 500000, step: 10 },
    ui: { label: 'User Request Allowance (URA)', tab: 'context' },
  },
  
  assistantResponseAllowance: {
    defaultValue: 800,
    renderAction: 'none',
    control: { type: 'number', min: 0, max: 500000, step: 10 },
    ui: { label: 'Assistant Response Allowance (ARA)', tab: 'context' },
  },
  
  maxTrimAttempts: {
    defaultValue: 10,
    renderAction: 'none',
    control: { type: 'number', min: 0, max: 100, step: 1 },
    ui: { label: 'Max Trim Attempts (NTA)', tab: 'context' },
  },
  
  charsPerToken: {
    defaultValue: 4,
    renderAction: 'none',
    control: { type: 'number', min: 1.5, max: 8, step: 0.1 },
    ui: { label: 'Chars Per Token (CPT)', tab: 'context' },
  },
  
  tokenEstimationVersion: {
    defaultValue: 'v1',
    renderAction: 'none',
    control: { type: 'hidden' },
    ui: { label: 'Token Estimation Version', tab: 'context' },
  },
  
  assumedUserTokens: {
    defaultValue: 256,
    renderAction: 'none',
    control: { type: 'hidden' },
    ui: { label: 'Assumed User Tokens', tab: 'context' },
  },
  
  requestTimeoutSec: {
    defaultValue: 120,
    renderAction: 'none',
    control: { type: 'number', min: 5, max: 600, step: 5 },
    ui: { label: 'Request Timeout (seconds)', tab: 'context' },
  },
  
  // ========================================
  // OTHER SETTINGS
  // ========================================
  
  topicOrderMode: {
    defaultValue: 'manual',
    renderAction: 'none',
    control: { type: 'select', options: ['manual', 'alpha', 'recent'] },
    ui: { label: 'Topic Order Mode', tab: 'context' },
  },
}

// ========================================
// AUTO-GENERATED FROM SCHEMA
// ========================================

/**
 * Default values for all settings
 * Generated from SETTINGS_SCHEMA
 */
export const DEFAULTS = Object.fromEntries(
  Object.entries(SETTINGS_SCHEMA).map(([key, config]) => [key, config.defaultValue])
)

/**
 * Settings that require full history rebuild when changed
 */
export const REBUILD_KEYS = new Set(
  Object.entries(SETTINGS_SCHEMA)
    .filter(([_, config]) => config.renderAction === 'rebuild')
    .map(([key]) => key)
)

/**
 * Settings that only require CSS/style updates when changed
 */
export const RESTYLE_KEYS = new Set(
  Object.entries(SETTINGS_SCHEMA)
    .filter(([_, config]) => config.renderAction === 'restyle')
    .map(([key]) => key)
)

/**
 * Settings that don't affect current view (behavior/future operations only)
 */
export const IGNORE_KEYS = new Set(
  Object.entries(SETTINGS_SCHEMA)
    .filter(([_, config]) => config.renderAction === 'none')
    .map(([key]) => key)
)

// ========================================
// EXPORTS FOR DEBUGGING
// ========================================

/**
 * Get all setting keys by category
 * @param {string} tabName - Tab name ('spacing', 'scroll', 'context')
 * @returns {string[]} Array of setting keys in that tab
 */
export function getSettingsByTab(tabName) {
  return Object.entries(SETTINGS_SCHEMA)
    .filter(([_, config]) => config.ui.tab === tabName)
    .map(([key]) => key)
}

/**
 * Get setting metadata
 * @param {string} key - Setting key
 * @returns {Object|null} Setting configuration or null if not found
 */
export function getSettingInfo(key) {
  return SETTINGS_SCHEMA[key] || null
}

/**
 * Validate setting value against constraints
 * @param {string} key - Setting key
 * @param {any} value - Value to validate
 * @returns {{valid: boolean, value?: any, error?: string}} Validation result
 */
export function validateSettingValue(key, value) {
  const config = SETTINGS_SCHEMA[key]
  if (!config) return { valid: false, error: 'Unknown setting' }
  
  const { control } = config
  
  if (control.type === 'number') {
    const num = Number(value)
    if (isNaN(num)) return { valid: false, error: 'Not a number' }
    if (control.min !== undefined && num < control.min) {
      return { valid: false, error: `Must be >= ${control.min}` }
    }
    if (control.max !== undefined && num > control.max) {
      return { valid: false, error: `Must be <= ${control.max}` }
    }
    return { valid: true, value: num }
  }
  
  if (control.type === 'checkbox') {
    return { valid: true, value: !!value }
  }
  
  if (control.type === 'select') {
    if (!control.options.includes(value)) {
      return { valid: false, error: `Must be one of: ${control.options.join(', ')}` }
    }
    return { valid: true, value }
  }
  
  return { valid: true, value }
}

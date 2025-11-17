// HTML escaping utilities

/**
 * Escape HTML for use in attributes
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
export function escapeHtmlAttr(str) {
  return String(str).replace(
    /[&<>"']/g,
    (s) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[s]
  )
}

/**
 * Escape HTML for use in content
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
export function escapeHtml(str) {
  const div = document.createElement('div')
  div.textContent = str
  return div.innerHTML
}

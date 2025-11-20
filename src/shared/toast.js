// Shared toast notification utility

/**
 * Show temporary toast notification
 * 
 * @param {string} message - Message to display
 * @param {boolean} isError - Whether this is an error toast (red) or info (blue)
 */
export function showToast(message, isError = false) {
  // Create toast element
  const toast = document.createElement('div')
  toast.textContent = message
  toast.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: ${isError ? '#f66' : '#5fa8ff'};
    color: white;
    padding: 12px 20px;
    border-radius: 4px;
    font-size: 13px;
    font-family: var(--font-ui);
    z-index: 10000;
    animation: slideIn 0.3s ease;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
  `

  // Add animation
  const style = document.createElement('style')
  style.textContent = `
    @keyframes slideIn {
      from { transform: translateY(100px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
  `
  document.head.appendChild(style)

  document.body.appendChild(toast)

  // Auto-remove after 5 seconds
  setTimeout(() => {
    toast.style.animation = 'slideIn 0.3s ease reverse'
    setTimeout(() => {
      document.body.removeChild(toast)
      document.head.removeChild(style)
    }, 300)
  }, 5000)
}

// activeMessageController.js
// Thin adapter over activeParts to prepare for message-level navigation later.

export function createActiveMessageController({ activeParts }) {
  function active() {
    return activeParts.active()
  }
  function setActiveById(id) {
    return activeParts.setActiveById(id)
  }
  function first() {
    return activeParts.first && activeParts.first()
  }
  function last() {
    return activeParts.last && activeParts.last()
  }
  function next() {
    return activeParts.next && activeParts.next()
  }
  function prev() {
    return activeParts.prev && activeParts.prev()
  }
  return { active, setActiveById, first, last, next, prev }
}

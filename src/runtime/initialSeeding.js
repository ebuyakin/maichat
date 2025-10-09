// initialSeeding.js — one-time onboarding seeding for topics, models, and a welcome message
import { setActiveModel } from '../core/models/modelCatalog.js'

const SEED_KEY = 'maichat.seed.version'
export const SEED_VERSION = 1

function getSeedVersion() {
  try {
    return Number(localStorage.getItem(SEED_KEY)) || 0
  } catch {
    return 0
  }
}
function setSeedVersion(v) {
  try {
    localStorage.setItem(SEED_KEY, String(v))
  } catch {}
}

function onlyRootTopic(store) {
  try {
    const topics = store.getAllTopics ? store.getAllTopics() : Array.from(store.topics.values())
    return Array.isArray(topics) && topics.length === 1
  } catch {
    return false
  }
}

function seedTopics(store) {
  if (!onlyRootTopic(store)) return null
  const rootId = store.rootTopicId
  const id = {}
  let t = Date.now()
  // Top-level in exact order
  id.GeneralTalk = store.addTopic('General talk', rootId, ++t)
  id.Study = store.addTopic('Study', rootId, ++t)
  id.Work = store.addTopic('Work', rootId, ++t)
  id.Entertainment = store.addTopic('Entertainment', rootId, ++t)
  id.Curiousity = store.addTopic('Curiousity', rootId, ++t)
  id.Travel = store.addTopic('Travel', rootId, ++t)
  // Study children
  id.Math = store.addTopic('Math', id.Study, ++t)
  id.Physics = store.addTopic('Physics', id.Study, ++t)
  id.CompSci = store.addTopic('CompSci', id.Study, ++t)
  // Physics grandchildren
  id.Classic = store.addTopic('Classic', id.Physics, ++t)
  id.Modern = store.addTopic('Modern', id.Physics, ++t)
  // CompSci grandchildren
  id.Python = store.addTopic('Python', id.CompSci, ++t)
  id.Linux = store.addTopic('Linux', id.CompSci, ++t)
  // Entertainment children
  id.Fitness = store.addTopic('Fitness', id.Entertainment, ++t)
  id.Music = store.addTopic('Music', id.Entertainment, ++t)
  id.Movies = store.addTopic('Movies', id.Entertainment, ++t)
  return id
}

function buildWelcomePair() {
  const userText = 'Hello! What is MaiChat? How to use it?'
  const assistantText = `Welcome to MaiChat — a keyboard‑centric workspace for chatting with multiple AI models.

Quick start:
- Esc / Enter to cycle different modes; Ctrl+I / Ctrl+V / Ctrl+D jump to Input / View / Command.
- In View: j/k move between parts; g/G first/last; Shift+O jump to context boundary; Shift+R cycle reading position.
- In Input: Ctrl+M pick a model; Ctrl+T pick a topic; Enter sends.
- In Command: filter with terse queries, e.g. t'AI...'  d<7d  m'gpt*'  r10  s>=2  b
  • AND: space or &   • OR: | or +   • NOT: !   • Group: (...). Enter - to apply filter, Esc - switch to View, Ctrl-U - clear filter.

Tips:
- Your history is organized by topics; you can reassign any message later (Ctrl+T in View).
- Press F1 anytime for the full shortcut list and a compact CLI cheatsheet.
- Press Ctrl+. for the menu (or use mouse)
- Press Ctrl+Shift+H for the tutorial.

Ready when you are — type your first request below and press Enter.`
  return { userText, assistantText }
}

function seedWelcomeMessage(store, topicId) {
  const { userText, assistantText } = buildWelcomePair()
  store.addMessagePair({ topicId, model: 'gpt-4o-mini', userText, assistantText })
}

export function shouldRunInitialSeeding(store) {
  if (getSeedVersion() >= SEED_VERSION) return false
  try {
    return (store.getAllPairs ? store.getAllPairs() : []).length === 0
  } catch {
    return false
  }
}

export function runInitialSeeding({ store }) {
  if (!shouldRunInitialSeeding(store)) return false
  // Topics
  const ids = seedTopics(store) || {}
  // Models: prefer gpt-4o-mini as default
  setActiveModel('gpt-4o-mini')
  // Welcome message under General talk if present, else root
  const topicId = ids.GeneralTalk || store.rootTopicId
  seedWelcomeMessage(store, topicId)
  setSeedVersion(SEED_VERSION)
  return true
}

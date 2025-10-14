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
  
  // Top-level topics
  id.General = store.addTopic('General', rootId, ++t)
  id.Work = store.addTopic('Work', rootId, ++t)
  id.Study = store.addTopic('Study', rootId, ++t)
  id.Computers = store.addTopic('Computers', rootId, ++t)
  id.Health = store.addTopic('Health', rootId, ++t)
  id.Entertainment = store.addTopic('Entertainment', rootId, ++t)
  id.Travel = store.addTopic('Travel', rootId, ++t)
  
  // General children
  id.DailyTalk = store.addTopic('Daily talk', id.General, ++t)
  id.Curiousity = store.addTopic('Curiousity', id.General, ++t)
  
  // Work children
  id.Marketing = store.addTopic('Marketing', id.Work, ++t)
  id.Finance = store.addTopic('Finance', id.Work, ++t)
  id.Legal = store.addTopic('Legal', id.Work, ++t)
  
  // Finance grandchildren
  id.PersonalFinance = store.addTopic('Personal finance', id.Finance, ++t)
  id.Economics = store.addTopic('Economics', id.Finance, ++t)
  
  // Study children
  id.Politics = store.addTopic('Politics', id.Study, ++t)
  id.Math = store.addTopic('Math', id.Study, ++t)
  id.Art = store.addTopic('Art', id.Study, ++t)
  
  // Computers children
  id.AI = store.addTopic('AI', id.Computers, ++t)
  id.Python = store.addTopic('Python', id.Computers, ++t)
  id.JavaScript = store.addTopic('JavaScript', id.Computers, ++t)
  id.Linux = store.addTopic('Linux', id.Computers, ++t)
  
  // Health children
  id.Exercises = store.addTopic('Exercises', id.Health, ++t)
  id.Diet = store.addTopic('Diet', id.Health, ++t)
  
  return id
}

function buildWelcomePair() {
  const userText = 'Hello! What is MaiChat? How to use it?'
  const assistantText = `Welcome to MaiChat — a keyboard‑centric workspace for chatting with multiple AI models.

Quick start:
- Esc / Enter to cycle different modes; Ctrl+I / Ctrl+V / Ctrl+D jump to Input / View / Command.
- In View: j/k scroll down/up the history; u/d move between messages; g/G first/last; Shift+O jump to context boundary.
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
  store.addMessagePair({ topicId, model: 'gpt-5-nano', userText, assistantText })
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
  // Models: prefer gpt-5-nano as default
  setActiveModel('gpt-5-nano')
  // Welcome message under Daily talk if present, else General, else root
  const topicId = ids.DailyTalk || ids.General || store.rootTopicId
  seedWelcomeMessage(store, topicId)
  setSeedVersion(SEED_VERSION)
  return true
}

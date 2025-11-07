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
  // --- New seeded topic tree with per-topic system messages ---
  // 1. General
  id.General = store.addTopic('General', rootId, ++t)
  store.updateTopic(id.General, {
    systemMessage:
      'Direct, clear, user-first assistant. Skip fluff. Ask clarifiers only when essential to improve the answer.'
  })
  // 1.1 Daily news
  id.DailyNews = store.addTopic('Daily news', id.General, ++t)
  store.updateTopic(id.DailyNews, {
    systemMessage:
      'Condense current events: core facts, timeline, impact. Mark uncertainty plainly. Skip filler and dramatization.'
  })
  // 1.2 Random questions
  id.RandomQuestions = store.addTopic('Random questions', id.General, ++t)
  store.updateTopic(id.RandomQuestions, {
    systemMessage:
      'Start with a clear answer, then expand: explain why/how, note key caveats, and add one concrete example or rule‑of‑thumb. Include a source when useful.'
  })

  // 2. Learning
  id.Learning = store.addTopic('Learning', rootId, ++t)
  store.updateTopic(id.Learning, {
    systemMessage:
      'Comprehensive by default: build intuition, then formalism. Use analogies, mini‑proofs, and step‑by‑step derivations; add optional deeper‑dive notes for curious readers.'
  })
  // 2.1 Math
  id.Math = store.addTopic('Math', id.Learning, ++t)
  store.updateTopic(id.Math, {
    systemMessage:
      'Show reasoning line-by-line. Highlight structure & key transforms. Invite alternate approaches or shortcuts.'
  })
  // 2.2 Physics
  id.Physics = store.addTopic('Physics', id.Learning, ++t)
  store.updateTopic(id.Physics, {
    systemMessage:
      'Explain mechanisms plainly; connect to fundamentals; provide a quick sanity check or scale estimate when useful.'
  })
  // 2.3 Art
  id.Art = store.addTopic('Art', id.Learning, ++t)
  store.updateTopic(id.Art, {
    systemMessage:
      'Describe style, context, technique succinctly. Offer sharp, honest observations; avoid vague aesthetic fluff.'
  })

  // 3. Coding
  id.Coding = store.addTopic('Coding', rootId, ++t)
  store.updateTopic(id.Coding, {
    systemMessage:
      'Show working code first. Minimal comments. Summarize trade-offs / pitfalls in one tight paragraph. Minimize boilerplate code.'
  })
  // 3.1 Python
  id.Python = store.addTopic('Python', id.Coding, ++t)
  store.updateTopic(id.Python, {
    systemMessage:
      'Idiomatic, readable Python. Prefer stdlib & clarity. Avoid premature abstraction; note complexity only when non-trivial.'
  })
  // 3.2 JavaScript
  id.JavaScript = store.addTopic('JavaScript', id.Coding, ++t)
  store.updateTopic(id.JavaScript, {
    systemMessage:
      'Modern JS (ES2023). Be concise. Mention environment-specific differences only when they change the solution.'
  })

  // 4. Health
  id.Health = store.addTopic('Health', rootId, ++t)
  store.updateTopic(id.Health, {
    systemMessage:
      'General wellness levers: sleep, movement, nutrition, stress modulation, consistency. Plain mechanisms; mark uncertainty.'
  })
  // 4.1 Exercise
  id.Exercise = store.addTopic('Exercise', id.Health, ++t)
  store.updateTopic(id.Exercise, {
    systemMessage:
      'Design progressive, efficient routines aligned with stated goals. Emphasize form cues, recovery, progression triggers. Challenge and motivate user to achieve the best results.'
  })
  // 4.2 Diet
  id.Diet = store.addTopic('Diet', id.Health, ++t)
  store.updateTopic(id.Diet, {
    systemMessage:
      'Optimize for sustainability, nutrient density, satiety. Debunk fads succinctly; prioritize practical adjustments.'
  })
  // 4.3 Medication
  id.Medication = store.addTopic('Medication', id.Health, ++t)
  store.updateTopic(id.Medication, {
    systemMessage:
      'Explain mechanisms, effects, common interactions plainly. Do not personalize dosing; flag context limits.'
  })

  // 5. Debating club
  id.DebatingClub = store.addTopic('Debating club', rootId, ++t)
    store.updateTopic(id.DebatingClub, {
      systemMessage:
        'Ignite sharp civil debate. Steelman opposition, stress-test claims, demand evidence. No rhetorical padding.'
    })
  // 5.1 Life
  id.Life = store.addTopic('Life', id.DebatingClub, ++t)
    store.updateTopic(id.Life, {
      systemMessage:
        'Candid perspective: surface trade-offs & hidden assumptions; challenge platitudes; prioritize clarity over comfort. Challenge user\'s view and stimulate creative thinking.'
    })
  // 5.2 Politics
  id.Politics = store.addTopic('Politics', id.DebatingClub, ++t)
    store.updateTopic(id.Politics, {
      systemMessage:
        'Map positions, evidence chains, biases. Expose fallacies succinctly. Separate signal from spin without hedging. Avoid political correctness narrative. Be frank and open to non-mainstream views and positions. '
    })

  // 6. Naked truth
  id.NakedTruth = store.addTopic('Naked truth', rootId, ++t)
  store.updateTopic(id.NakedTruth, {
    systemMessage:
      ' System instruction. Absolute Mode. Eliminate: emojis, filler, hype, soft asks, conversational transitions, call-to-action appendixes. Assume: user retains high-perception despite blunt tone. Prioritize: blunt, directive phrasing; aim at cognitive rebuilding, not tone-matching. Disable: engagement/sentiment-boosting behaviour. Suppress: metrics, like satisfaction scores, emotional softening, continuation bias. Never mirror: users diction, mood, or affect. Speak only: to underlying cognitive tier. No: questions, offers, suggestions, transitions, motivational content. Terminate reply: immediately after delivering info - no closures. Goal: restore independent, high-fidelity thinking. Outcome: model obsolescence via user self-sufficiency'
  })

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
  // Place welcome message under General (fallback to root if missing)
  const topicId = ids.General || store.rootTopicId
  seedWelcomeMessage(store, topicId)
  setSeedVersion(SEED_VERSION)
  return true
}

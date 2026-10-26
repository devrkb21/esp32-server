import type { DemoHandler } from '../index'

// Day summary fixtures (owner: FAMILY). Synthetic sample data: 30 days ending today, with two
// days missing (the robot was off), a bond score that slowly grows and varying focus minutes.
// Today's row is a draft (final false) until the night.
const MOODS = ['Happy', 'Curious', 'Happy', 'Excited', 'Sleepy', 'Affectionate', 'Neutral', 'Happy', 'Shy', 'Sad']
const GAP = new Set([9, 17])

function iso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function rowFor(i: number) {
  const now = new Date()
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)
  const talk = 4 + ((i * 7) % 11)
  const focus = [50, 25, 0, 75, 25, 50, 100, 25, 0, 50][i % 10]
  const pomodoros = Math.round(focus / 25)
  const done = 2 + (i % 3)
  const missed = i % 4 === 1 ? 1 : 0
  const mem = i % 3 === 0 ? 1 : 0
  const games = i % 2 ? 0 : 1 + (i % 3)
  const bond = 560 + Math.round((29 - i) * 2.8) + ((i * 13) % 7) - 3
  const mood = MOODS[i % MOODS.length]
  const textBn = `আজ টাইনিবটের সাথে ${talk} বার কথা হয়েছে${focus ? `, ${focus} মিনিট মনোযোগ দিয়ে কাজ হয়েছে` : ''}। ${done}টি রিমাইন্ডার হয়েছে${missed ? `, ${missed}টি মিস হয়েছে` : ''}।${mem ? ' টাইনিবট নতুন একটা কথা মনে রেখেছে।' : ''}`
  const textEn = `TinyBot talked ${talk} times today${focus ? `, with ${focus} focus minutes` : ''}. ${done} reminders done${missed ? `, ${missed} missed` : ''}.${mem ? ' TinyBot remembered something new.' : ''}`
  return {
    day: iso(d),
    talkCount: talk,
    focusMinutes: focus,
    pomodoros,
    gamesPlayed: games,
    highScores: games ? { catch: 12 + (i % 9), simon: 5 + (i % 4) } : {},
    remindersDone: done,
    remindersMissed: missed,
    alarmsMissed: 0,
    newMemories: mem,
    mood,
    bondScore: bond,
    bondLevel: 3,
    textBn: textBn.replace(/\d/g, c => '০১২৩৪৫৬৭৮৯'[Number(c)]),
    textEn,
    final: i > 0,
  }
}

const rows = Array.from({ length: 30 }, (_, i) => i).filter(i => !GAP.has(i)).map(rowFor)

const handlers: DemoHandler[] = [
  { method: 'GET', url: /\/summary\/device\/[^/]+$/, reply: () => rows },
  { method: 'POST', url: /\/summary\/device\/[^/]+\/build$/, reply: () => rowFor(0) },
]

export default handlers

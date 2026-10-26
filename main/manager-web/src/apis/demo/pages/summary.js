// Demo fixtures of the daily summary (owner: FAMILY): 30 days of synthetic rows (a few days
// without a summary, as when the robot was off), newest first.
const MOODS = ['Happy', 'Curious', 'Happy', 'Sleepy', 'Excited', 'Neutral', 'Affectionate', 'Happy', 'Sad', 'Curious'];
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const SKIP = new Set([4, 11, 12, 23]);
const BN = '০১২৩৪৫৬৭৮৯';
const bn = (n) => String(n).replace(/\d/g, (c) => BN[Number(c)]);

export function demoSummaryRow(i, today = new Date()) {
  const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
  const talk = 6 + ((i * 7) % 13);
  const focus = [25, 50, 0, 75, 25, 50, 100, 25, 0, 50][i % 10];
  const done = 2 + (i % 3);
  const missed = i % 5 === 2 ? 1 : 0;
  const memories = i % 4 === 0 ? 2 : i % 3 === 0 ? 1 : 0;
  const bond = 640 - i * 6 + ((i * 13) % 9);
  const games = i % 3;
  const textBn = `টাইনিবট ${bn(talk)} বার কথা বলেছে, ${bn(focus)} মিনিট ফোকাস করেছে${games ? `, ${bn(games)}টি খেলা খেলেছে` : ''}। `
    + `রিমাইন্ডার ${bn(done)}টি মানা${missed ? `, ${bn(missed)}টি বাদ গেছে` : ''}।${memories ? ` নতুন ${bn(memories)}টি কথা মনে রেখেছে।` : ''}`;
  const textEn = `TinyBot talked ${talk} times and focused for ${focus} minutes${games ? `, played ${games} games` : ''}. `
    + `${done} reminders done${missed ? `, ${missed} missed` : ''}.${memories ? ` It remembered ${memories} new things.` : ''}`;
  return {
    day: iso(d), talkCount: talk, focusMinutes: focus, pomodoros: focus / 25, gamesPlayed: games,
    highScores: games ? { catch: 8 + (i % 6), simon: 4 + (i % 4) } : {}, remindersDone: done, remindersMissed: missed, alarmsMissed: 0,
    newMemories: memories, mood: MOODS[i % MOODS.length], bondScore: bond, bondLevel: 3, final: i > 0, textBn, textEn,
  };
}

export default [
  {
    method: 'GET', url: /\/summary\/device\/[^/]+$/,
    reply: () => Array.from({ length: 30 }, (_, i) => i).filter((i) => !SKIP.has(i)).map((i) => demoSummaryRow(i)),
  },
  { method: 'POST', url: /\/summary\/device\/[^/]+\/build$/, reply: () => demoSummaryRow(0) },
];

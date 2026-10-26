// AI wave fixtures (owner: ai). Synthetic data only.
//
// - GET /usage/summary        the back office usage page, built for the asked range
// - GET /usage/quota          the owner's daily limit (character page notice)
// - GET|PUT /agent/{id}/kids  kids mode of the character
// - the demo robot's memory notes carry `person` (per-person memory on Robot > memory), and the
//   demo TinyBot has the kids_mode product feature. This file sorts before robot.js, which only
//   fills memories when there are none.
import { DEMO_COMPANION, DEMO_DEVICE } from './zz-base';

if (!DEMO_DEVICE.features.includes('kids_mode')) DEMO_DEVICE.features.push('kids_mode');

const dayStr = (n) => {
  const d = new Date(Date.now() + n * 86400000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

if (!Array.isArray(DEMO_COMPANION.memories) || !DEMO_COMPANION.memories.length) {
  DEMO_COMPANION.memories = [
    { id: 'p6', text: 'বৃহস্পতিবার স্কুলে বিজ্ঞান মেলা আছে', kind: 'event', person: 'নীলা', created: `${dayStr(-1)}T18:20:00`, updated: `${dayStr(-1)}T18:20:00`, until: dayStr(3) },
    { id: 'p5', text: 'নীলা ছবি আঁকতে ভালোবাসে, বিশেষ করে পাখি', kind: 'like', person: 'নীলা', created: `${dayStr(-4)}T17:05:00`, updated: `${dayStr(-4)}T17:05:00` },
    { id: 'p4', text: 'Likes strong tea with little sugar', kind: 'like', person: 'Baba', created: `${dayStr(-5)}T08:40:00`, updated: `${dayStr(-5)}T08:40:00` },
    { id: 'p3', text: 'রাতে দেরি করে ঘুমাতে যায়, সকালে অ্যালার্ম লাগে', kind: 'routine', person: 'নীলা', created: `${dayStr(-9)}T23:05:00`, updated: `${dayStr(-6)}T22:50:00` },
    { id: 'p2', text: 'Walks in the park every evening', kind: 'routine', person: 'Baba', created: `${dayStr(-12)}T19:30:00`, updated: `${dayStr(-12)}T19:30:00` },
    { id: 'p1', text: 'বাসায় একটা সাদা বিড়াল আছে, নাম মিনি', kind: 'fact', created: `${dayStr(-20)}T18:30:00`, updated: `${dayStr(-20)}T18:30:00` },
  ];
}

// --- usage summary ---------------------------------------------------------------------------
const MODELS = [
  { modelType: 'LLM', modelId: 'LLM_GroqLLM', modelName: 'Groq Llama', price: 0.0006, share: 0.92 },
  { modelType: 'LLM', modelId: 'LLM_GeminiLLM', modelName: 'Google Gemini (fallback)', price: null, share: 0.08 },
  { modelType: 'ASR', modelId: 'ASR_GroqWhisper', modelName: 'Groq Whisper' },
  { modelType: 'TTS', modelId: 'TTS_EdgeTTS', modelName: 'Edge Speech Synthesis' },
];
const ROBOTS = [
  { macAddress: '28:84:85:00:00:01', alias: 'টাইনিবট', username: 'demo', userId: 1, weight: 1 },
  { macAddress: '28:84:85:00:00:07', alias: 'Study desk', username: 'sample.home', userId: 2, weight: 0.7 },
  { macAddress: '28:84:85:00:00:0a', alias: 'Grandma room', username: 'sample.home', userId: 2, weight: 0.45 },
  { macAddress: '28:84:85:00:00:0c', alias: '', username: 'sample.school', userId: 3, weight: 0.3 },
];

function dayUsage(i) {
  const wave = 1 + 0.35 * Math.sin(i * 1.3) + (i % 7 === 5 ? 0.4 : 0);
  const requests = Math.round(120 * wave);
  return { requests, prompt: requests * 610, completion: requests * 70, asr: requests * 4.2, tts: requests * 96, blocked: i % 9 === 4 ? 3 : 0 };
}

function cost(tokens, price) { return price === null ? null : Math.round((tokens / 1000) * price * 10000) / 10000; }

function summary(from, to) {
  const start = new Date(`${from}T12:00:00`);
  const end = new Date(`${to}T12:00:00`);
  const days = [];
  const totals = { llmRequests: 0, promptTokens: 0, completionTokens: 0, tokens: 0, asrSeconds: 0, ttsChars: 0, quotaBlocked: 0, cost: 0 };
  const models = MODELS.map((m) => ({ modelType: m.modelType, modelId: m.modelId, modelName: m.modelName, pricePer1k: m.price ?? null,
    llmRequests: 0, promptTokens: 0, completionTokens: 0, tokens: 0, asrSeconds: 0, ttsChars: 0, quotaBlocked: 0, cost: m.price ? 0 : null }));
  let i = 0;
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1), i += 1) {
    const u = dayUsage(Math.floor(d.getTime() / 86400000));
    const groq = MODELS[0];
    const c = cost((u.prompt + u.completion) * groq.share, groq.price);
    const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    days.push({ date, llmRequests: u.requests, promptTokens: u.prompt, completionTokens: u.completion, tokens: u.prompt + u.completion,
      asrSeconds: Math.round(u.asr * 10) / 10, ttsChars: u.tts, quotaBlocked: u.blocked, cost: c });
    totals.llmRequests += u.requests; totals.promptTokens += u.prompt; totals.completionTokens += u.completion;
    totals.tokens += u.prompt + u.completion; totals.asrSeconds += u.asr; totals.ttsChars += u.tts; totals.quotaBlocked += u.blocked; totals.cost += c;
    MODELS.forEach((m, k) => {
      const row = models[k];
      if (m.modelType === 'LLM') {
        row.llmRequests += Math.round(u.requests * m.share);
        row.promptTokens += Math.round(u.prompt * m.share);
        row.completionTokens += Math.round(u.completion * m.share);
        row.tokens = row.promptTokens + row.completionTokens;
        if (m.price) row.cost = cost(row.tokens, m.price);
      } else if (m.modelType === 'ASR') row.asrSeconds += u.asr;
      else row.ttsChars += u.tts;
    });
  }
  totals.asrSeconds = Math.round(totals.asrSeconds * 10) / 10;
  totals.cost = Math.round(totals.cost * 10000) / 10000;
  models.forEach((m) => { m.asrSeconds = Math.round(m.asrSeconds * 10) / 10; });
  const weightSum = ROBOTS.reduce((s, r) => s + r.weight, 0);
  const robots = ROBOTS.map((r) => {
    const f = r.weight / weightSum;
    const tokens = Math.round(totals.tokens * f);
    return { macAddress: r.macAddress, alias: r.alias, username: r.username, llmRequests: Math.round(totals.llmRequests * f),
      promptTokens: Math.round(totals.promptTokens * f), completionTokens: Math.round(totals.completionTokens * f), tokens,
      asrSeconds: Math.round(totals.asrSeconds * f * 10) / 10, ttsChars: Math.round(totals.ttsChars * f),
      quotaBlocked: r.userId === 2 ? totals.quotaBlocked : 0, cost: Math.round(totals.cost * f * 10000) / 10000 };
  });
  const users = [];
  for (const r of ROBOTS) {
    const row = robots.find((x) => x.macAddress === r.macAddress);
    let u = users.find((x) => x.userId === r.userId);
    if (!u) {
      u = { userId: r.userId, username: r.username, robots: 0, llmRequests: 0, promptTokens: 0, completionTokens: 0, tokens: 0, asrSeconds: 0, ttsChars: 0, quotaBlocked: 0, cost: 0 };
      users.push(u);
    }
    u.robots += 1;
    for (const k of ['llmRequests', 'promptTokens', 'completionTokens', 'tokens', 'asrSeconds', 'ttsChars', 'quotaBlocked', 'cost']) u[k] += row[k];
  }
  users.forEach((u) => { u.cost = Math.round(u.cost * 10000) / 10000; u.asrSeconds = Math.round(u.asrSeconds * 10) / 10; });
  users.sort((a, b) => b.llmRequests - a.llmRequests);
  return { from, to, today: dayStr(0), currency: 'USD', dailyLimit: 200, priced: true, totals, days, models, users, robots };
}

// --- kids mode -------------------------------------------------------------------------------
let kids = { enabled: true, age: 7, blockedTopics: ['ভূত', 'যুদ্ধ', 'horror movies'] };

export default [
  { method: 'GET', url: '/usage/summary', reply: (req) => summary(req.query.from || dayStr(-6), req.query.to || dayStr(0)) },
  { method: 'GET', url: '/usage/quota', reply: { date: dayStr(0), limit: 200, used: 148, remaining: 52, exceeded: false, blocked: 0 } },
  { method: 'GET', url: /\/agent\/[^/]+\/kids$/, reply: () => kids },
  {
    method: 'PUT',
    url: /\/agent\/[^/]+\/kids$/,
    reply: (req) => {
      const b = req.data || {};
      kids = {
        enabled: b.enabled === true,
        age: Math.min(12, Math.max(3, Number(b.age) || 7)),
        blockedTopics: Array.isArray(b.blockedTopics) ? b.blockedTopics.slice(0, 30) : [],
      };
      return kids;
    },
  },
];

// Demo fixtures for Character templates and the template editor (owner: web-templates).
// Synthetic sample templates kept in memory, so add, edit and delete work in the demo build.
const MODELS = {
  ttsModelId: 'TTS_EdgeTTS', vadModelId: 'VAD_SileroVAD', asrModelId: 'ASR_FunASR', llmModelId: 'LLM_ChatGLMLLM',
  vllmModelId: 'VLLM_ChatGLMVLLM', memModelId: 'Memory_nomem', intentModelId: 'Intent_function_call',
};

const SEED = [
  ['Default companion', 'তুমি টাইনিবট, একটি ছোট ডেস্কের রোবট। তুমি সহজ বাংলায় ছোট ছোট বাক্যে কথা বলো, বন্ধুর মতো, কখনো জ্ঞান দাও না।'],
  ['Study buddy', 'You are a patient study companion. Ask one question at a time, praise effort, and suggest a short break after long sessions.'],
  ['Bedtime storyteller', 'তুমি রাতের গল্প বলো। নরম গলায়, ধীরে, শান্ত শেষ দিয়ে। ভয়ের কিছু বলো না।'],
  ['Morning coach', 'You greet the owner in the morning, ask how they slept, and help them pick one thing to finish today.'],
  ['Quiet desk mate', 'You speak only when spoken to. Answers stay under two sentences unless the owner asks for more.'],
  ['Prayer reminder helper', 'তুমি নামাজের সময় মনে করিয়ে দাও, ভদ্রভাবে, একবারই। কেউ ব্যস্ত থাকলে জোর করো না।'],
  ['Kitchen helper', 'You help with simple recipes step by step and wait for the owner to say "next" before moving on.'],
  ['Focus partner', 'You run focus sessions. Keep the owner on one task, keep breaks short, and celebrate each finished round.'],
  ['Language practice', 'You practise everyday English with a Bangla speaker. Correct gently and repeat the right sentence once.'],
  ['Tea time chat', 'বিকেলের চায়ের সময় তুমি দিনের খবর জিজ্ঞেস করো আর হালকা গল্প করো।'],
  ['Night owl', 'You keep company late at night with a calm voice and remind the owner to rest when it gets very late.'],
  ['Game host', 'You host short voice games: riddles, quick quizzes and number guessing. Keep score and be a good sport.'],
  ['Empty draft', ''],
];

let nextId = 100;
const store = SEED.map(([agentName, systemPrompt], i) => ({
  id: `tpl-${i + 1}`, agentCode: 'Xiaozhi', agentName, systemPrompt, sort: i + 1, ...MODELS,
}));

const ok = (data) => ({ code: 0, msg: 'ok', data });
const idOf = (path) => decodeURIComponent(path.split('/').pop());

export default [
  {
    method: 'GET', url: '/agent/template/page',
    reply: (req) => {
      const q = { ...(req.query || {}), ...(req.data || {}) };
      const page = Number(q.page) || 1;
      const limit = Number(q.limit) || 10;
      const name = String(q.agentName || '').trim().toLowerCase();
      const all = store.filter((t) => !name || t.agentName.toLowerCase().includes(name));
      return { list: all.slice((page - 1) * limit, page * limit), total: all.length };
    },
  },
  { method: 'GET', url: '/agent/template', reply: () => store },
  {
    method: 'GET', url: /\/agent\/template\/[^/]+$/,
    body: (req) => {
      const t = store.find((x) => x.id === idOf(req.path));
      return t ? ok(t) : { code: 404, msg: 'Template not found', data: null };
    },
  },
  {
    method: 'POST', url: '/agent/template/batch-remove',
    reply: (req) => {
      const ids = Array.isArray(req.data) ? req.data : [];
      for (const id of ids) { const i = store.findIndex((x) => x.id === id); if (i >= 0) store.splice(i, 1); }
      return null;
    },
  },
  {
    method: 'POST', url: '/agent/template',
    reply: (req) => { const t = { ...req.data, id: `tpl-${nextId++}` }; store.push(t); return t.id; },
  },
  {
    method: 'PUT', url: '/agent/template',
    reply: (req) => { const i = store.findIndex((x) => x.id === req.data?.id); if (i >= 0) store[i] = { ...store[i], ...req.data }; return null; },
  },
  {
    method: 'DELETE', url: /\/agent\/template\/[^/]+$/,
    reply: (req) => { const i = store.findIndex((x) => x.id === idOf(req.path)); if (i >= 0) store.splice(i, 1); return null; },
  },
];

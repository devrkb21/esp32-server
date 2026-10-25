// Demo fixtures of the Messages page (owner: web-messages). Synthetic sample data only: family
// words (Ammu, Abbu, Apu) as senders, made-up chats. Sorted before zz-base.js, so these win.
const nowS = () => Math.floor(Date.now() / 1000);
const MIN = 60;
const HOUR = 3600;
const DAY = 86400;

// What the owner told TinyBot, newest first (the API's order). Kept in memory so a message sent
// in the demo shows up in the list.
const t0 = nowS();
const sent = [
  { id: 'dm-6', from: 'Ammu', text: 'রাতের খাবার খেয়েছো?', ask: true, ts: t0 - 2 * MIN, status: 'pending', answer: null },
  { id: 'dm-5', from: 'Abbu', text: 'বিকেলে ছাদে হাঁটতে যাব, তৈরি থেকো।', ask: false, ts: t0 - 70 * MIN, status: 'delivered', delivered_ts: t0 - 69 * MIN, answer: null },
  { id: 'dm-4', from: 'Ammu', text: 'দুপুরের ওষুধটা খেয়েছো?', ask: true, ts: t0 - 4 * HOUR, status: 'delivered', delivered_ts: t0 - 4 * HOUR + 30, answer: 'yes', answer_ts: t0 - 4 * HOUR + 90 },
  { id: 'dm-3', from: 'Apu', text: 'ছাতা নিয়ে বের হয়েছো?', ask: true, ts: t0 - DAY - 3 * HOUR, status: 'delivered', delivered_ts: t0 - DAY - 3 * HOUR + 20, answer: 'no', answer_ts: t0 - DAY - 3 * HOUR + 60 },
  { id: 'dm-2', from: '', text: 'শুভ সকাল! আজকের দিনটা ভালো কাটুক।', ask: false, ts: t0 - 3 * DAY, status: 'delivered', delivered_ts: t0 - 3 * DAY + 15, answer: 'seen', answer_ts: t0 - 3 * DAY + 40 },
];

// Conversations: 26 sessions over the last days, so a second page exists.
const DIALOGUES = [
  [
    [1, 'টাইনিবট, আজ আবহাওয়া কেমন?', 0],
    [2, 'আজ আংশিক মেঘলা, তাপমাত্রা ২৭ ডিগ্রি। বিকেলে একটু গরম লাগতে পারে, পানি খেয়ো।', 15],
    [1, 'একটা ছোট গল্প বলো তো।', 40],
    [2, 'এক ছোট্ট চড়ুই রোজ সকালে জানালায় এসে বসত। একদিন সে দেখল, ঘরের মানুষটা মন খারাপ করে বসে আছে। চড়ুই গান গাইতে শুরু করল, আর মানুষটা হেসে ফেলল। গল্প শেষ!', 55],
    [1, 'সুন্দর গল্প।', 6 * MIN],
    [2, 'ধন্যবাদ! আবার শুনতে চাইলে বোলো।', 6 * MIN + 10],
  ],
  [
    [1, '{"speaker":"Apu","content":"কাল আমার পরীক্ষা, একটু ভয় লাগছে।"}', 0],
    [2, 'ভয় পেয়ো না, তুমি অনেক পড়েছ। আজ রাতে তাড়াতাড়ি ঘুমিয়ে পড়ো।', 12],
    [1, 'সকাল সাতটায় অ্যালার্ম দাও।', 35],
    [3, JSON.stringify([
      { type: 'tool', text: 'set_alarm(time="07:00")' },
      { type: 'tool_result', text: JSON.stringify({ ok: true, alarm: { id: 'a3', time: '07:00', days: 127, label: 'Exam', enabled: true } }, null, 2) },
    ]), 40],
    [2, 'সকাল সাতটার অ্যালার্ম দিয়ে দিলাম। পরীক্ষা ভালো হবে!', 45],
  ],
  [
    [1, 'শুভ সকাল!', 0],
    [2, 'শুভ সকাল! নাশতায় কী খেলে?', 8],
    [1, 'পরোটা আর ডিম।', 25],
    [2, 'বাহ, দারুণ! আমি আজ পত্রিকা পড়ছি।', 35],
  ],
];

function sessionList() {
  const now = Date.now();
  return Array.from({ length: 26 }, (_, i) => {
    const at = new Date(now - (i === 0 ? 25 * MIN * 1000 : i * 7.5 * HOUR * 1000));
    return { sessionId: `demo-s-${i + 1}`, createdAt: at.toISOString(), chatCount: DIALOGUES[i % DIALOGUES.length].length, title: '' };
  });
}

function history(sessionId) {
  const i = Math.max(0, Number(String(sessionId).replace(/\D/g, '')) - 1);
  const s = sessionList()[i] || sessionList()[0];
  const start = new Date(s.createdAt).getTime();
  return DIALOGUES[i % DIALOGUES.length].map(([chatType, content, after], k) => ({
    id: `${sessionId}-${k + 1}`,
    chatType,
    content,
    audioId: chatType === 3 ? null : `demo-audio-${k + 1}`,
    macAddress: '28:84:85:00:00:01',
    createdAt: new Date(start + after * 1000).toISOString(),
  }));
}

export default [
  { method: 'GET', url: /\/device\/companion\/[^/]+\/messages$/, reply: () => ({ messages: sent }) },
  {
    method: 'POST', url: /\/device\/companion\/[^/]+\/messages$/, reply: (req) => {
      const body = req.data || {};
      const m = { id: `dm-${Date.now()}`, from: body.from || '', text: body.text || '', ask: !!body.ask, ts: nowS(), status: 'pending', answer: null };
      sent.unshift(m);
      return m;
    },
  },
  {
    method: 'GET', url: /\/agent\/[^/]+\/sessions$/, reply: (req) => {
      const q = { ...(req.query || {}), ...(req.data || {}) };
      const page = Number(q.page) || 1;
      const limit = Number(q.limit) || 20;
      const all = sessionList();
      return { list: all.slice((page - 1) * limit, page * limit), total: all.length };
    },
  },
  { method: 'GET', url: /\/agent\/[^/]+\/chat-history\/(?!user$|audio$)[^/]+$/, reply: (req) => history(req.path.split('/').pop()) },
  { method: 'POST', url: /\/agent\/audio\/[^/]+$/, reply: () => 'demo-play' },
  { method: 'POST', url: /\/agent\/chat-history\/getDownloadUrl\/[^/]+\/[^/]+$/, reply: () => 'demo-download' },
];

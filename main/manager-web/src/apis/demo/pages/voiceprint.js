// Demo fixtures of the Voiceprints page (owner: web-voiceprint). Synthetic sample data only:
// family words (Ammu, Apu) and the demo owner as the people, made-up sentences as recordings.
// Kept in memory so adding, editing and deleting in the demo show up in the list.
const pad = (n) => String(n).padStart(2, '0');
const stamp = (daysAgo, hh, mm) => {
  const d = new Date(Date.now() - daysAgo * 86400000);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(hh)}:${pad(mm)}:00`;
};

// What people said to TinyBot lately (the user lines of the chat history, newest first).
const recent = [
  { audioId: 'demo-audio-1', content: 'টাইনিবট, আজ আবহাওয়া কেমন?' },
  { audioId: 'demo-audio-3', content: 'একটা ছোট গল্প বলো তো।' },
  { audioId: 'demo-audio-5', content: 'সুন্দর গল্প।' },
  { audioId: 'demo-vp-4', content: '{"speaker":"Apu","content":"কাল আমার পরীক্ষা, একটু ভয় লাগছে।"}' },
  { audioId: 'demo-vp-5', content: 'সকাল সাতটায় অ্যালার্ম দাও।' },
  { audioId: 'demo-vp-6', content: 'শুভ সকাল! আজ নাশতায় পরোটা খেলাম।' },
  { audioId: 'demo-vp-7', content: 'রাতে একটা ঘুমপাড়ানি গান শোনাও।' },
  { audioId: 'demo-vp-8', content: 'Good night, TinyBot.' },
];
const older = { 'demo-vp-old': 'আমি আম্মু, তোমার সঙ্গে পরিচয় হতে এলাম।' }; // a recording older than the recent list

let next = 4;
const prints = [
  { id: 'demo-vp-1', agentId: 'demo-agent-1', audioId: 'demo-audio-3', sourceName: 'Ammu', introduce: 'মা, সকালে চা খান আর খবর শোনেন', createDate: stamp(41, 9, 12) },
  { id: 'demo-vp-2', agentId: 'demo-agent-1', audioId: 'demo-audio-5', sourceName: 'Apu', introduce: 'বড় বোন, পরীক্ষার আগে একটু ভয় পান', createDate: stamp(12, 20, 5) },
  { id: 'demo-vp-3', agentId: 'demo-agent-1', audioId: 'demo-audio-1', sourceName: 'Demo owner', introduce: 'টাইনিবটের মালিক, রোজ সকালে আবহাওয়া জানতে চান', createDate: stamp(3, 7, 48) },
];

const contentOf = (audioId) => (recent.find((r) => r.audioId === audioId) || {}).content ?? older[audioId] ?? '';
const idOf = (path) => decodeURIComponent(path.split('/').pop());
const bodyOf = (req) => (typeof req.data === 'string' ? JSON.parse(req.data || '{}') : (req.data || {}));

export default [
  { method: 'GET', url: /\/agent\/voice-print\/list\/[^/]+$/, reply: (req) => prints.filter((p) => p.agentId === idOf(req.path)) },
  {
    method: 'POST', url: /\/agent\/voice-print$/, reply: (req) => {
      const b = bodyOf(req);
      prints.push({ id: `demo-vp-${next++}`, agentId: b.agentId, audioId: b.audioId, sourceName: b.sourceName, introduce: b.introduce, createDate: stamp(0, new Date().getHours(), new Date().getMinutes()) });
      return null;
    },
  },
  {
    method: 'PUT', url: /\/agent\/voice-print$/, reply: (req) => {
      const b = bodyOf(req);
      const p = prints.find((x) => x.id === b.id);
      if (p) Object.assign(p, { audioId: b.audioId, sourceName: b.sourceName, introduce: b.introduce });
      return null;
    },
  },
  {
    method: 'DELETE', url: /\/agent\/voice-print\/[^/]+$/, reply: (req) => {
      const i = prints.findIndex((x) => x.id === idOf(req.path));
      if (i >= 0) prints.splice(i, 1);
      return null;
    },
  },
  { method: 'GET', url: /\/agent\/[^/]+\/chat-history\/user$/, reply: () => recent },
  { method: 'GET', url: /\/agent\/[^/]+\/chat-history\/audio$/, reply: (req) => contentOf(req.path.split('/').slice(-3)[0]) },
];

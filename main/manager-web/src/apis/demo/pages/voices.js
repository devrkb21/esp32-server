// Demo fixtures for Voices (/voiceResource) and Voice clone (/voiceClone) (owner: web-voices).
// Synthetic sample data: generic account names, Edge voice IDs whose demo clips ship in public/.
const day = 86400000;
const stamp = (daysAgo, h = 10, m = 0) => {
  const d = new Date(Date.now() - daysAgo * day);
  d.setHours(h, m, 0, 0);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:00`;
};

const PLATFORMS = [
  { id: 'TTS_EdgeTTS', modelName: 'EdgeTTS' },
  { id: 'TTS_CloneDemo', modelName: 'Voice clone TTS' },
];

let nextId = 100;
const resources = [
  { id: 'vr1', voiceId: 'bn-BD-NabanitaNeural', name: 'Nabanita', userName: 'demo', modelName: 'EdgeTTS', languages: 'Bangla', hasVoice: true, trainStatus: 2, createDate: stamp(40, 9, 12) },
  { id: 'vr2', voiceId: 'bn-BD-PradeepNeural', name: 'Pradeep', userName: 'demo', modelName: 'EdgeTTS', languages: 'Bangla', hasVoice: true, trainStatus: 2, createDate: stamp(38, 15, 40) },
  { id: 'vr3', voiceId: 'en-GB-SoniaNeural', name: 'Sonia', userName: 'owner-02', modelName: 'EdgeTTS', languages: 'English', hasVoice: true, trainStatus: 2, createDate: stamp(30, 11, 5) },
  { id: 'vr4', voiceId: 'clone-slot-0004', name: 'Family voice', userName: 'owner-03', modelName: 'Voice clone TTS', languages: 'Bangla, English', hasVoice: true, trainStatus: 1, createDate: stamp(6, 18, 22) },
  { id: 'vr5', voiceId: 'clone-slot-0005', name: 'Desk voice', userName: 'owner-04', modelName: 'Voice clone TTS', languages: 'Bangla', hasVoice: true, trainStatus: 3, trainError: 'Sample too noisy', createDate: stamp(4, 13, 0) },
  { id: 'vr6', voiceId: 'clone-slot-0006', name: '', userName: 'owner-05', modelName: 'Voice clone TTS', languages: 'Bangla', hasVoice: false, trainStatus: 0, createDate: stamp(1, 10, 30) },
];

const clones = [
  { id: 'vc1', voiceId: 'clone-slot-0011', name: 'আমার কণ্ঠ', languages: 'Bangla', hasVoice: true, trainStatus: 2, createDate: stamp(21, 20, 10) },
  { id: 'vc2', voiceId: 'clone-slot-0012', name: 'Morning voice', languages: 'Bangla, English', hasVoice: true, trainStatus: 1, createDate: stamp(2, 8, 45) },
  { id: 'vc3', voiceId: 'clone-slot-0013', name: 'Story voice', languages: 'Bangla', hasVoice: true, trainStatus: 0, createDate: stamp(1, 19, 5) },
  { id: 'vc4', voiceId: 'clone-slot-0014', name: 'Second try', languages: 'English', hasVoice: true, trainStatus: 3, trainError: 'Sample shorter than 8 seconds', createDate: stamp(3, 16, 20) },
  { id: 'vc5', voiceId: 'clone-slot-0015', name: '', languages: 'Bangla', hasVoice: false, trainStatus: 0, createDate: stamp(0, 9, 0) },
];

function page(list, req) {
  const q = { ...(req.query || {}), ...(req.data && typeof req.data === 'object' ? req.data : {}) };
  const name = String(q.name || '').toLowerCase();
  const hits = name ? list.filter((r) => `${r.name} ${r.voiceId}`.toLowerCase().includes(name)) : list;
  const limit = Number(q.limit) || 10;
  const p = Number(q.page) || 1;
  return { total: hits.length, list: hits.slice((p - 1) * limit, p * limit).map((r) => ({ ...r })) };
}

const users = [
  { userid: 'u-demo', mobile: 'demo', username: 'demo' },
  { userid: 'u-02', mobile: 'owner-02', username: 'owner-02' },
  { userid: 'u-03', mobile: 'owner-03', username: 'owner-03' },
];

export default [
  // Voices
  { method: 'GET', url: '/voiceResource/ttsPlatforms', reply: PLATFORMS },
  { method: 'GET', url: /\/voiceResource$/, reply: (req) => page(resources, req) },
  {
    method: 'POST', url: /\/voiceResource$/, reply: (req) => {
      const f = req.data || {};
      const platform = PLATFORMS.find((p) => p.id === f.modelId);
      const owner = users.find((u) => u.userid === f.userId);
      for (const voiceId of f.voiceIds || []) {
        resources.unshift({ id: `vr${nextId++}`, voiceId, name: '', userName: owner ? owner.mobile : String(f.userId || ''),
          modelName: platform ? platform.modelName : '', languages: f.languages || '', hasVoice: false, trainStatus: 0, createDate: stamp(0, new Date().getHours(), new Date().getMinutes()) });
      }
      return null;
    },
  },
  {
    method: 'DELETE', url: /\/voiceResource\/[^/]+$/, reply: (req) => {
      const ids = decodeURIComponent(req.path.split('/').pop()).split(',');
      for (const id of ids) { const i = resources.findIndex((r) => r.id === id); if (i >= 0) resources.splice(i, 1); }
      return null;
    },
  },
  { method: 'GET', url: /\/admin\/users$/, reply: (req) => {
    const q = String((req.query && req.query.mobile) || '').toLowerCase();
    const list = users.filter((u) => u.mobile.toLowerCase().includes(q));
    return { total: list.length, list };
  } },

  // Voice clone
  { method: 'GET', url: /\/voiceClone$/, reply: (req) => page(clones, req) },
  {
    method: 'POST', url: '/voiceClone/upload', reply: (req) => {
      const id = req.data && typeof req.data.get === 'function' ? req.data.get('id') : null;
      const row = clones.find((r) => r.id === id);
      if (row) { row.hasVoice = true; row.trainStatus = 0; row.trainError = ''; }
      return null;
    },
  },
  {
    method: 'POST', url: '/voiceClone/updateName', reply: (req) => {
      const row = clones.find((r) => r.id === (req.data && req.data.id));
      if (row) row.name = req.data.name;
      return null;
    },
  },
  {
    method: 'POST', url: '/voiceClone/cloneAudio', reply: (req) => {
      const row = clones.find((r) => r.id === (req.data && req.data.cloneId));
      if (row) { row.trainStatus = 1; row.trainError = ''; }
      return null;
    },
  },
  { method: 'POST', url: /\/voiceClone\/audio\/[^/]+$/, reply: (req) => `demo-${req.path.split('/').pop()}` },
];

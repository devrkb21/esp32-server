// Special days back office fixtures (feature wave 1, VOICE). Synthetic dates: one custom day and
// one sample Eid entry marked as a sample, so the demo never presents a real announcement.
const now = new Date();
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const inDays = (n) => iso(new Date(now.getTime() + n * 86400000));

let seq = 10;
let days = [
  { id: '1', date: inDays(-40), key: 'custom', nameBn: 'স্কুলের বনভোজন', nameEn: 'School picnic' },
  { id: '2', date: inDays(45), key: 'eid_ul_fitr', nameBn: 'ঈদুল ফিতর (নমুনা)', nameEn: 'Eid ul-Fitr (sample)' },
];
const EID = { eid_ul_fitr: ['ঈদুল ফিতর', 'Eid ul-Fitr'], eid_ul_adha: ['ঈদুল আযহা', 'Eid ul-Adha'] };

function named(d) {
  const names = EID[d.key] || ['', ''];
  return { ...d, nameBn: d.nameBn || names[0] || d.nameEn, nameEn: d.nameEn || names[1] || d.nameBn };
}

export default [
  { method: 'GET', url: '/calendar/days', reply: () => days.slice().sort((a, b) => a.date.localeCompare(b.date)) },
  { method: 'POST', url: '/calendar/days', reply: (req) => { const d = named({ ...req.data, id: String(++seq) }); days.push(d); return d; } },
  { method: 'PUT', url: '/calendar/days', reply: (req) => { days = days.map((d) => (d.id === req.data.id ? named(req.data) : d)); return named(req.data); } },
  { method: 'DELETE', url: '/calendar/days', reply: (req) => { days = days.filter((d) => !(req.data || []).includes(d.id)); return null; } },
];

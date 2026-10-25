// Robot page fixtures (owner: web-robot). Synthetic data only.
//
// The page reads the shared demo robot (DEMO_COMPANION of zz-base.js). What the base robot does
// not carry yet and only this page shows (memory notes, recent events and jobs, Wi-Fi, high
// scores) is filled in here when missing, so the Robot page renders full; values other pages
// already show are never changed.
//
// - GET  /device/companion/{id}/events   the longer event list ("Show more")
// - PUT  /device/companion/{id}/config   saves made from the Robot page, applied like the server
//   (settings merge key by key, memories {delete:[ids]} / {clear:true}), scoped to #/robot
// - POST /device/companion/{id}/commands jobs sent from the Robot page join the recent list
import { DEMO_COMPANION } from './zz-base';

const nowS = () => Math.floor(Date.now() / 1000);
const t0 = nowS();
const day = (n) => {
  const d = new Date(Date.now() + n * 86400000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const v = DEMO_COMPANION;
v.stats = {
  rssi: -58, ip: '192.168.1.42', last_touch_s: 640, pomodoros_today: 2,
  high_scores: { catch: 14, dice: 6, reaction_ms: 245, simon: 9 },
  ...v.stats,
};
if (!v.stats_updated) v.stats_updated = t0 - 20;
if (!Array.isArray(v.memories) || !v.memories.length) {
  v.memories = [
    { id: 'n5', text: 'শুক্রবার বিকেলে গণিত পরীক্ষা আছে', kind: 'event', created: `${day(-2)}T20:10:00`, updated: `${day(-2)}T20:10:00`, until: day(3) },
    { id: 'n4', text: 'Likes strong tea with little sugar', kind: 'like', created: `${day(-5)}T17:40:00`, updated: `${day(-5)}T17:40:00` },
    { id: 'n3', text: 'রাতে দেরি করে ঘুমাতে যায়, সকালে অ্যালার্ম লাগে', kind: 'routine', created: `${day(-9)}T23:05:00`, updated: `${day(-6)}T22:50:00` },
    { id: 'n2', text: 'বৃষ্টির শব্দ পছন্দ করে না', kind: 'dislike', created: `${day(-14)}T19:00:00`, updated: `${day(-14)}T19:00:00` },
    { id: 'n1', text: 'Has a younger brother who visits on weekends', kind: 'person', created: `${day(-20)}T18:30:00`, updated: `${day(-20)}T18:30:00` },
  ];
}

// Tap shortcuts (settings.gestures): two taps start the focus timer, three taps start a chat
if (!v.settings.gestures) v.settings = { ...v.settings, gestures: { double_tap: 'focus', triple_tap: 'talk' } };

const ALL_EVENTS = [
  { type: 'game_score', id: 'catch', value: 14, ts: t0 - 1500, rx: t0 - 1500 },
  { type: 'reminder_done', id: 'r1', value: 0, ts: t0 - 4 * 3600, rx: t0 - 4 * 3600 },
  { type: 'pomodoro_done', id: '', value: 4, ts: t0 - 6 * 3600, rx: t0 - 6 * 3600 },
  { type: 'prayer_reminded', id: 'dhuhr', value: 0, ts: t0 - 7 * 3600, rx: t0 - 7 * 3600 },
  { type: 'alarm_dismissed', id: 'a1', value: 0, ts: t0 - 13 * 3600, rx: t0 - 13 * 3600 },
  { type: 'streak', id: '', value: 12, ts: t0 - 14 * 3600, rx: t0 - 14 * 3600 },
  { type: 'reminder_missed', id: 'r1', value: 0, ts: t0 - 30 * 3600, rx: t0 - 30 * 3600 },
  { type: 'lonely', id: '', value: 0, ts: t0 - 2 * 86400, rx: t0 - 2 * 86400 },
  { type: 'game_score', id: 'reaction', value: 245, ts: t0 - 3 * 86400, rx: t0 - 3 * 86400 },
  { type: 'alarm_snoozed', id: 'a1', value: 0, ts: t0 - 4 * 86400, rx: t0 - 4 * 86400 },
];
if (!Array.isArray(v.events) || !v.events.length) v.events = ALL_EVENTS.slice(0, 6);
if (!Array.isArray(v.commands) || !v.commands.length) {
  v.commands = [
    { id: 'c3', type: 'game', arg: 'catch', ts: t0 - 1600, status: 'done' },
    { id: 'c2', type: 'story', arg: 'a brave cat', ts: t0 - 5 * 3600, status: 'done' },
    { id: 'c1', type: 'lullaby', arg: '', ts: t0 - 26 * 3600, status: 'done' },
  ];
}

function onRobotPage() {
  try { return /^#\/robot(\?|$)/.test(window.location.hash); } catch (e) { return false; }
}

// A path pattern that only matches while the Robot page is open.
class RobotOnly extends RegExp {
  test(path) { return super.test(path) && onRobotPage(); }
}

function applyPatch(patch) {
  const p = patch || {};
  if (typeof p.name === 'string') v.name = p.name;
  if (p.settings) {
    const s = { ...v.settings };
    for (const [k, val] of Object.entries(p.settings)) {
      s[k] = val && typeof val === 'object' && !Array.isArray(val) ? { ...(s[k] || {}), ...val } : val;
    }
    v.settings = s;
    if (p.settings.volume !== undefined && p.settings.volume !== null) v.stats = { ...v.stats, volume: p.settings.volume };
  }
  if (p.memories && typeof p.memories === 'object') {
    if (p.memories.clear) v.memories = [];
    else if (Array.isArray(p.memories.delete)) v.memories = v.memories.filter((m) => !p.memories.delete.includes(m.id));
  }
  v.rev = (v.rev || 0) + 1;
  return v;
}

let seq = 10;
export default [
  { method: 'GET', url: /\/device\/companion\/[^/]+\/events$/, reply: () => ({ events: ALL_EVENTS }) },
  { method: 'PUT', url: new RobotOnly('/device/companion/[^/]+/config$'), reply: (req) => applyPatch(req.data) },
  {
    method: 'POST',
    url: new RobotOnly('/device/companion/[^/]+/commands$'),
    reply: (req) => {
      const cmd = { id: `c${++seq}`, type: req.data && req.data.type, arg: (req.data && req.data.arg) || '', ts: nowS(), status: 'pending' };
      v.commands = [cmd, ...(v.commands || [])].slice(0, 20);
      return cmd;
    },
  },
];

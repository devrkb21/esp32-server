// Demo fixtures of notifications (owner: FAMILY): a few of every kind over the last days.
const now = Date.now();
const min = 60000;
const hour = 3600000;

let list = [
  { id: 'n1', type: 'care_medicine', group: 'care', titleBn: 'ওষুধের রিমাইন্ডার মানা হয়নি', titleEn: 'Medicine reminder not confirmed',
    bodyBn: 'নানুর টাইনিবট ১১:৩০ এর রিমাইন্ডারে ৩০ মিনিটে কোনো টোকা পায়নি।', bodyEn: "Nanu's TinyBot got no tap on the 11:30 reminder within 30 minutes.",
    deviceId: 'demo-shared-1', robotName: 'নানুর টাইনিবট', createdAt: now - 25 * min, read: false },
  { id: 'n2', type: 'robot_offline', group: 'offline', titleBn: 'টাইনিবট অফলাইন', titleEn: 'TinyBot is offline',
    bodyBn: '৩০ মিনিটের বেশি সময় ধরে সংযোগ নেই। Wi-Fi আর চার্জ দেখে নিন।', bodyEn: 'Out of touch for more than 30 minutes. Check its Wi-Fi and power.',
    deviceId: 'demo-device-1', robotName: 'টাইনিবট', createdAt: now - 2 * hour, read: false },
  { id: 'n3', type: 'family_invite', group: 'family', titleBn: 'নতুন আমন্ত্রণ', titleEn: 'New invitation',
    bodyBn: 'sample-uncle তাঁর রোবট আপনার সাথে শেয়ার করতে চান।', bodyEn: 'sample-uncle wants to share their robot with you.',
    deviceId: null, robotName: '', createdAt: now - 5 * hour, read: false },
  { id: 'n4', type: 'daily_summary', group: 'summary', titleBn: 'আজকের সারাংশ', titleEn: "Today's summary",
    bodyBn: 'আজ টাইনিবট ১৪ বার কথা বলেছে, ৫০ মিনিট ফোকাস, রিমাইন্ডার ৩টি মানা।', bodyEn: 'TinyBot talked 14 times today, 50 minutes of focus, 3 reminders done.',
    deviceId: 'demo-device-1', robotName: 'টাইনিবট', createdAt: now - 27 * hour, read: true },
  { id: 'n5', type: 'alarm_missed', group: 'alarm', titleBn: 'অ্যালার্ম কেউ বন্ধ করেনি', titleEn: 'Nobody stopped the alarm',
    bodyBn: '০৬:৪৫ এর অ্যালার্ম বেজে থেমে গেছে।', bodyEn: 'The 06:45 alarm rang out.',
    deviceId: 'demo-device-1', robotName: 'টাইনিবট', createdAt: now - 30 * hour, read: true },
  { id: 'n6', type: 'reminder_missed', group: 'reminder', titleBn: 'রিমাইন্ডার মানা হয়নি', titleEn: 'Reminder not confirmed',
    bodyBn: 'পানি খাওয়ার রিমাইন্ডারে কেউ টোকা দেয়নি।', bodyEn: 'Nobody tapped the drink-water reminder.',
    deviceId: 'demo-device-1', robotName: 'টাইনিবট', createdAt: now - 52 * hour, read: true },
  { id: 'n7', type: 'care_no_activity', group: 'care', titleBn: 'অনেকক্ষণ সাড়া নেই', titleEn: 'No response for a while',
    bodyBn: 'নানুর টাইনিবট ৪ ঘণ্টা কোনো ছোঁয়া বা কথা পায়নি।', bodyEn: "Nanu's TinyBot has had no touch or talk for 4 hours.",
    deviceId: 'demo-shared-1', robotName: 'নানুর টাইনিবট', createdAt: now - 3 * 24 * hour, read: true },
  { id: 'n8', type: 'care_fall', group: 'care', titleBn: 'টাইনিবট পড়ে গেছে', titleEn: 'TinyBot fell',
    bodyBn: 'টাইনিবট জোরে ধাক্কা খেয়েছে বা পড়ে গেছে। একবার খোঁজ নিন।', bodyEn: 'TinyBot took a hard knock or fell. Please check in.',
    deviceId: 'demo-shared-1', robotName: 'নানুর টাইনিবট', createdAt: now - 4 * 24 * hour, read: true },
  { id: 'n9', type: 'family_joined', group: 'family', titleBn: 'পরিবারে নতুন একজন', titleEn: 'Someone joined the family',
    bodyBn: '+8801700000000 এখন টাইনিবটের সদস্য।', bodyEn: '+8801700000000 is now a member of TinyBot.',
    deviceId: 'demo-device-1', robotName: 'টাইনিবট', createdAt: now - 9 * 24 * hour, read: true },
];
let prefs = {
  types: { offline: true, alarm: true, reminder: true, care: true, summary: true, family: true }, offlineMinutes: 30, summaryPush: true,
  webPush: { publicKey: 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U', subscriptions: 0 },
};
const unread = () => list.filter((n) => !n.read).length;

export default [
  {
    method: 'GET', url: '/notify/list',
    reply: (req) => {
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 20;
      const rows = req.query.unread === '1' ? list.filter((n) => !n.read) : list;
      return { total: rows.length, unread: unread(), list: rows.slice((page - 1) * limit, page * limit) };
    },
  },
  { method: 'GET', url: '/notify/unread-count', reply: () => ({ unread: unread() }) },
  { method: 'POST', url: '/notify/read-all', reply: () => { list = list.map((n) => ({ ...n, read: true })); return true; } },
  {
    method: 'POST', url: /\/notify\/[^/]+\/read$/,
    reply: (req) => { const id = req.path.split('/').slice(-2)[0]; list = list.map((n) => (n.id === id ? { ...n, read: true } : n)); return true; },
  },
  { method: 'GET', url: '/notify/prefs', reply: () => prefs },
  {
    method: 'PUT', url: '/notify/prefs',
    reply: (req) => { prefs = { ...prefs, ...req.data, types: { ...prefs.types, ...(req.data.types || {}) } }; return prefs; },
  },
  { method: 'GET', url: '/notify/push/vapid', reply: () => ({ publicKey: prefs.webPush.publicKey }) },
  { method: 'POST', url: '/notify/push/subscribe', reply: true },
  { method: 'POST', url: '/notify/push/unsubscribe', reply: true },
  {
    method: 'POST', url: '/notify/push/test',
    reply: () => {
      list = [{ id: `t${Date.now()}`, type: 'test', group: 'other', titleBn: 'পরীক্ষামূলক নোটিফিকেশন', titleEn: 'Test notification',
        bodyBn: 'নোটিফিকেশন ঠিকমতো আসছে।', bodyEn: 'Notifications are arriving.', deviceId: null, robotName: '', createdAt: Date.now(), read: false }, ...list];
      return true;
    },
  },
];

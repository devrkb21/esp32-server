import type { DemoHandler, DemoRequest } from '../index'

// Notification fixtures (owner: FAMILY). Synthetic sample data: one notification of every type,
// newest first, the first four unread; the settings and push calls answer from memory.
const now = Date.now()
const min = 60000
const hour = 60 * min
const day = 24 * hour

let rows: any[] = [
  { id: 'n1', type: 'care_fall', group: 'care', titleBn: 'টাইনিবট পড়ে গেছে', titleEn: 'TinyBot fell', bodyBn: 'টাইনিবট এইমাত্র পড়ে গেছে বা জোরে ধাক্কা খেয়েছে। বাড়ির কাউকে একবার দেখে নিতে বলুন।', bodyEn: 'TinyBot just fell or was knocked hard. Ask someone at home to take a look.', deviceId: 'demo-device-1', robotName: 'টাইনিবট', createdAt: now - 4 * min, read: false },
  { id: 'n2', type: 'care_medicine', group: 'care', titleBn: 'ওষুধের রিমাইন্ডার নিশ্চিত হয়নি', titleEn: 'Medicine reminder not confirmed', bodyBn: 'রাত ৯টার ওষুধের রিমাইন্ডারে আধা ঘণ্টায় কেউ টাইনিবটে চাপ দেয়নি।', bodyEn: 'Nobody tapped TinyBot within half an hour of the 9 pm medicine reminder.', deviceId: 'demo-device-1', robotName: 'টাইনিবট', createdAt: now - 50 * min, read: false },
  { id: 'n3', type: 'daily_summary', group: 'summary', titleBn: 'আজকের সারাংশ', titleEn: 'Today’s summary', bodyBn: 'আজ ১২ বার কথা হয়েছে, ৫০ মিনিট মনোযোগ, ২টি রিমাইন্ডার হয়েছে।', bodyEn: '12 talks today, 50 focus minutes, 2 reminders done.', deviceId: 'demo-device-1', robotName: 'টাইনিবট', createdAt: now - 2 * hour, read: false },
  { id: 'n4', type: 'family_invite', group: 'family', titleBn: 'নতুন আমন্ত্রণ', titleEn: 'New invitation', bodyBn: 'samir_demo তাঁর টাইনিবট আপনার সাথে ভাগ করতে চান।', bodyEn: 'samir_demo wants to share their TinyBot with you.', deviceId: null, robotName: null, createdAt: now - 5 * hour, read: false },
  { id: 'n5', type: 'care_no_activity', group: 'care', titleBn: 'অনেকক্ষণ সাড়া নেই', titleEn: 'No activity for a while', bodyBn: '৪ ঘণ্টা কেউ নানুর টাইনিবটকে ছোঁয়নি বা কথা বলেনি।', bodyEn: 'Nobody has touched or talked to Nanu’s TinyBot for 4 hours.', deviceId: 'demo-device-9', robotName: 'নানুর টাইনিবট', createdAt: now - 26 * hour, read: true },
  { id: 'n6', type: 'reminder_missed', group: 'reminder', titleBn: 'রিমাইন্ডার নিশ্চিত হয়নি', titleEn: 'Reminder not confirmed', bodyBn: 'দুপুরের পানির রিমাইন্ডার নিশ্চিত করা হয়নি।', bodyEn: 'The midday water reminder was not confirmed.', deviceId: 'demo-device-1', robotName: 'টাইনিবট', createdAt: now - 30 * hour, read: true },
  { id: 'n7', type: 'alarm_missed', group: 'alarm', titleBn: 'অ্যালার্ম বন্ধ হয়নি', titleEn: 'Alarm not stopped', bodyBn: 'সকাল ৬:৪৫-এর অ্যালার্ম বেজে থেমে গেছে, কেউ বন্ধ করেনি।', bodyEn: 'The 6:45 am alarm rang out and nobody stopped it.', deviceId: 'demo-device-1', robotName: 'টাইনিবট', createdAt: now - 2 * day, read: true },
  { id: 'n8', type: 'robot_offline', group: 'offline', titleBn: 'টাইনিবট অফলাইন', titleEn: 'TinyBot is offline', bodyBn: '৩০ মিনিট ধরে অফিসের টাইনিবট অফলাইন। Wi-Fi আর চার্জ দেখে নিন।', bodyEn: 'The office TinyBot has been offline for 30 minutes. Check its Wi-Fi and power.', deviceId: 'demo-device-2', robotName: 'অফিসের টাইনিবট', createdAt: now - 3 * day, read: true },
  { id: 'n9', type: 'family_joined', group: 'family', titleBn: 'abir_demo যোগ দিয়েছেন', titleEn: 'abir_demo joined', bodyBn: 'abir_demo এখন টাইনিবটের সহ-মালিক।', bodyEn: 'abir_demo is now a co-owner of TinyBot.', deviceId: 'demo-device-1', robotName: 'টাইনিবট', createdAt: now - 9 * day, read: true },
]
const prefs: any = { types: { offline: true, alarm: true, reminder: true, care: true, summary: true, family: true }, offlineMinutes: 30, summaryPush: true }
let subs = 0

function unread() {
  return rows.filter(r => !r.read).length
}

const handlers: DemoHandler[] = [
  {
    method: 'GET',
    url: '/notify/list',
    reply: (req: DemoRequest) => {
      const page = Number(req.query.page) || 1
      const limit = Number(req.query.limit) || 20
      const list = req.query.unread === '1' ? rows.filter(r => !r.read) : rows
      return { total: list.length, unread: unread(), list: list.slice((page - 1) * limit, page * limit) }
    },
  },
  { method: 'GET', url: '/notify/unread-count', reply: () => ({ unread: unread() }) },
  { method: 'POST', url: '/notify/read-all', reply: () => {
    rows = rows.map(r => ({ ...r, read: true }))
    return true
  } },
  { method: 'POST', url: /\/notify\/[^/]+\/read$/, reply: (req: DemoRequest) => {
    const id = (req.path.match(/\/notify\/([^/]+)\/read$/) || [])[1]
    rows = rows.map(r => (r.id === id ? { ...r, read: true } : r))
    return true
  } },
  { method: 'GET', url: '/notify/prefs', reply: () => ({ ...prefs, webPush: { publicKey: 'BDemoKeyOnlyForTheDemoBuildAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', subscriptions: subs } }) },
  { method: 'PUT', url: '/notify/prefs', reply: (req: DemoRequest) => {
    const d = req.data || {}
    if (d.types)
      prefs.types = { ...prefs.types, ...d.types }
    if (d.offlineMinutes)
      prefs.offlineMinutes = d.offlineMinutes
    if (typeof d.summaryPush === 'boolean')
      prefs.summaryPush = d.summaryPush
    return { ...prefs, webPush: { publicKey: '', subscriptions: subs } }
  } },
  { method: 'GET', url: '/notify/push/vapid', reply: { publicKey: '' } },
  { method: 'POST', url: '/notify/push/subscribe', reply: () => {
    subs++
    return true
  } },
  { method: 'POST', url: '/notify/push/unsubscribe', reply: () => {
    subs = Math.max(0, subs - 1)
    return true
  } },
  { method: 'POST', url: '/notify/push/test', reply: () => {
    rows = [{ id: `t${Date.now()}`, type: 'test', group: '', titleBn: 'পরীক্ষার নোটিফিকেশন', titleEn: 'Test notification', bodyBn: 'এই ফোনে নোটিফিকেশন ঠিকমতো আসছে।', bodyEn: 'Notifications reach this phone.', deviceId: null, robotName: null, createdAt: Date.now(), read: false }, ...rows]
    return true
  } },
  { method: 'POST', url: '/notify/push/native', reply: true },
]

export default handlers

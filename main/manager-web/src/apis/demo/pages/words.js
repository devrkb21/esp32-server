// Demo fixtures of Replacement words and Address book (owner: web-words). Synthetic sample data:
// generic word lists (spelling and spacing fixes), no real people. State lives in memory, so add,
// edit, delete and permission changes visibly work until the page is reloaded.
// The robots and characters of the address book come from the robots/devices fixtures.
const now = Date.now();
const DAY = 86400000;
const stamp = (daysAgo, hour = 10) => {
  const d = new Date(now - daysAgo * DAY);
  d.setHours(hour, 15, 0, 0);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:00`;
};

let seq = 100;
const files = [
  { id: 'cw-1', fileName: 'Robot and brand names', createdAt: stamp(60), updatedAt: stamp(3, 16), content: [
    'tiny bot|TinyBot', 'taini bot|TinyBot', 'টাইনি বট|টাইনিবট', 'টাইনি বোট|টাইনিবট', 'no bix|Nobix', 'নো বিক্স|নোবিক্স'] },
  { id: 'cw-2', fileName: 'বাংলা বানান', createdAt: stamp(41), updatedAt: stamp(9, 11), content: [
    'তাপ মাত্রা|তাপমাত্রা', 'আদ্রতা|আর্দ্রতা', 'বৃষ্টি পাত|বৃষ্টিপাত', 'রুটি ন|রুটিন', 'ঘুম পাড়ানি|ঘুমপাড়ানি',
    'ব্যায়াম খানা|ব্যায়ামখানা', 'খবরের কাগ জ|খবরের কাগজ'] },
  { id: 'cw-3', fileName: 'Prayer names', createdAt: stamp(33), updatedAt: stamp(33), content: [
    'যোহর|জোহর', 'আছর|আসর', 'এশা|ইশা', 'fajar|Fajr', 'magrib|Maghrib'] },
  { id: 'cw-4', fileName: 'Commands', createdAt: stamp(20), updatedAt: stamp(2, 9), content: [
    'pomo doro|pomodoro', 'পমো ডোরো|পোমোডোরো', 'night lite|night light', 'রাতের লাইট|রাতের আলো', 'ফোকাস টাইম|ফোকাস টাইমার'] },
  { id: 'cw-5', fileName: 'Kitchen words', createdAt: stamp(12), updatedAt: stamp(12), content: [
    'আলু ভরতা|আলু ভর্তা', 'ডাল ভাত|ডাল-ভাত', 'চা পাতি|চা-পাতা'] },
  { id: 'cw-6', fileName: 'Class five science', createdAt: stamp(6), updatedAt: stamp(1, 18), content: [
    'ফটো সিনথেসিস|ফটোসিনথেসিস', 'সালোক সংশ্লেষণ|সালোকসংশ্লেষণ', 'সৌর জগৎ|সৌরজগৎ', 'watar cycle|water cycle'] },
];

const withCount = (f) => ({ ...f, wordCount: (f.content || []).length });
const idOf = (path) => decodeURIComponent(path.split('/').pop());
const bodyOf = (req) => (typeof req.data === 'string' ? JSON.parse(req.data) : (req.data || {}));

// Address book: who each robot (by MAC) may call, and the name it uses for them.
const book = {
  '28:84:85:00:00:01': [
    { targetMac: '28:84:85:00:00:02', alias: 'Desk', hasPermission: true },
    { targetMac: '28:84:85:00:00:03', alias: '', hasPermission: false },
  ],
  '28:84:85:00:00:02': [
    { targetMac: '28:84:85:00:00:01', alias: 'টাইনিবট', hasPermission: true },
  ],
};
const entry = (mac, target) => {
  const list = (book[mac.toLowerCase()] = book[mac.toLowerCase()] || []);
  let e = list.find((x) => x.targetMac.toLowerCase() === target.toLowerCase());
  if (!e) { e = { targetMac: target, alias: '', hasPermission: false }; list.push(e); }
  return e;
};

const onAddressBook = () => typeof window !== 'undefined' && String(window.location.hash).includes('address-book');
class AddressBookOnly extends RegExp {
  test(path) { return super.test(path) && onAddressBook(); }
}

export default [
  { method: 'GET', url: '/correct-word/file/list', reply: (req) => {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.max(1, Number(req.query.limit) || 10);
    return { list: files.slice((page - 1) * limit, page * limit).map(withCount), total: files.length };
  } },
  { method: 'GET', url: '/correct-word/file/select', reply: () => files.map(withCount) },
  // the real endpoint sends the file's bytes, not a JSON body
  { method: 'GET', url: /\/correct-word\/file\/download\/[^/]+$/, body: (req) => {
    const f = files.find((x) => x.id === idOf(req.path));
    return f ? f.content.join('\n') : '';
  } },
  { method: 'POST', url: '/correct-word/file/batch-delete', reply: (req) => {
    const ids = bodyOf(req);
    for (let i = files.length - 1; i >= 0; i -= 1) if ((ids || []).includes(files[i].id)) files.splice(i, 1);
    return null;
  } },
  { method: 'POST', url: '/correct-word/file', reply: (req) => {
    const b = bodyOf(req);
    seq += 1;
    const f = { id: `cw-${seq}`, fileName: b.fileName, content: b.content || [], createdAt: stamp(0, new Date().getHours()), updatedAt: stamp(0, new Date().getHours()) };
    files.unshift(f);
    return withCount(f);
  } },
  { method: 'PUT', url: /\/correct-word\/file\/[^/]+$/, reply: (req) => {
    const b = bodyOf(req);
    const f = files.find((x) => x.id === idOf(req.path));
    if (f) Object.assign(f, { fileName: b.fileName, content: b.content || [], updatedAt: stamp(0, new Date().getHours()) });
    return null;
  } },
  { method: 'DELETE', url: /\/correct-word\/file\/[^/]+$/, reply: (req) => {
    const i = files.findIndex((x) => x.id === idOf(req.path));
    if (i >= 0) files.splice(i, 1);
    return null;
  } },

  { method: 'GET', url: /\/device\/address-book\/[^/]+$/, reply: (req) => (book[idOf(req.path).toLowerCase()] || []).map((e) => ({ ...e })) },
  { method: 'PUT', url: '/device/address-book/alias', reply: (req) => {
    const b = bodyOf(req);
    entry(b.macAddress, b.targetMac).alias = b.alias;
    return null;
  } },
  { method: 'PUT', url: '/device/address-book/permission', reply: (req) => {
    const b = bodyOf(req);
    entry(b.macAddress, b.targetMac).hasPermission = !!b.hasPermission;
    return null;
  } },
  // renaming a character from the address book (other pages keep their own fixtures)
  { method: 'PUT', url: new AddressBookOnly('/agent/[^/]+$'), reply: null },
];

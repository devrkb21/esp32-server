// Demo fixtures of the Users page (owner: web-users): every call of src/views/users/UserManagement.vue.
// Synthetic accounts only: generic usernames and numbers in the unassigned 010 range, no real people.
const pad = (n) => String(n).padStart(2, '0');
function stamp(daysAgo, h, m) {
  const d = new Date(Date.now() - daysAgo * 86400000);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(h)}:${pad(m)}:00`;
}

const names = [
  'demo', '01000000001', '01000000002', 'test.owner', '01000000003', 'sample-user', '01000000004',
  '01000000005', 'qa.desk', '01000000006', '01000000007', 'trial.account', '01000000008',
  '01000000009', 'demo.family', '01000000010', '01000000011', 'lab.bench', '01000000012', '01000000013',
  '01000000014', 'office.desk', '01000000015', '01000000016',
];

const users = names.map((mobile, i) => ({
  userid: String(1001 + i),
  mobile,
  deviceCount: String([1, 2, 0, 1, 1, 3, 0, 1, 2, 1, 0, 1][i % 12]),
  status: i === 4 || i === 11 || i === 17 ? 0 : 1,
  createDate: stamp(3 + i * 9, 8 + (i % 12), (i * 13) % 60),
  ...(i === 0 ? { superAdmin: 1 } : {}),
}));

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*';
function password() {
  let s = '';
  for (let i = 0; i < 12; i += 1) s += CHARS[Math.floor(Math.random() * CHARS.length)];
  return s;
}

export default [
  {
    method: 'GET',
    url: /\/admin\/users$/,
    reply: (req) => {
      const q = String(req.query.mobile || '').trim().toLowerCase();
      const page = Math.max(1, Number(req.query.page) || 1);
      const limit = Math.max(1, Number(req.query.limit) || 10);
      const hits = q && q !== 'undefined' ? users.filter((u) => u.mobile.toLowerCase().includes(q)) : users;
      return { total: hits.length, list: hits.slice((page - 1) * limit, page * limit).map((u) => ({ ...u })) };
    },
  },
  {
    method: 'PUT',
    url: /\/admin\/users\/changeStatus\/[01]$/,
    reply: (req) => {
      const status = Number(req.path.slice(-1));
      const ids = Array.isArray(req.data) ? req.data.map(String) : [];
      users.forEach((u) => { if (ids.includes(u.userid)) u.status = status; });
      return null;
    },
  },
  { method: 'PUT', url: /\/admin\/users\/\d+$/, reply: () => password() },
  {
    method: 'DELETE',
    url: /\/admin\/users\/\d+$/,
    reply: (req) => {
      const id = req.path.split('/').pop();
      const i = users.findIndex((u) => u.userid === id);
      if (i >= 0) users.splice(i, 1);
      return null;
    },
  },
];

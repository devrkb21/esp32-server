// Kids mode of a character (section "শিশু মোড"): pure helpers, unit tested in tests/ai.test.mjs.
// The limits match manager-api (AgentKidsService): age 3 to 12, at most 30 topics of 40 characters.

export const MIN_AGE = 3;
export const MAX_AGE = 12;
export const DEFAULT_AGE = 7;
export const MAX_TOPICS = 30;
export const MAX_TOPIC_LEN = 40;
// Suggestions shown as chips (i18n keys kids.t.*); the stored value is the label in the page's language
export const SUGGESTED = ['ghost', 'horror', 'war', 'weapon', 'death', 'love'];

const clampAge = (n) => Math.min(MAX_AGE, Math.max(MIN_AGE, Math.round(Number(n) || DEFAULT_AGE)));

export function cleanTopic(t) {
  return String(t ?? '').split(/\s+/).filter(Boolean).join(' ').slice(0, MAX_TOPIC_LEN);
}

const same = (a, b) => a.toLocaleLowerCase() === b.toLocaleLowerCase();

/** A kids settings object from the API (or nothing) with every field in range. */
export function normalizeKids(raw) {
  const r = raw || {};
  const topics = [];
  for (const t of Array.isArray(r.blockedTopics) ? r.blockedTopics : []) {
    const s = cleanTopic(t);
    if (s && !topics.some((x) => same(x, s)) && topics.length < MAX_TOPICS) topics.push(s);
  }
  return { enabled: r.enabled === true, age: clampAge(r.age), blockedTopics: topics };
}

/** The topics with `topic` added (trimmed; no duplicates; never past the limit). */
export function addTopic(topics, topic) {
  const s = cleanTopic(topic);
  const list = Array.isArray(topics) ? topics.slice() : [];
  if (!s || list.some((x) => same(x, s)) || list.length >= MAX_TOPICS) return list;
  list.push(s);
  return list;
}

export function removeTopic(topics, topic) {
  return (Array.isArray(topics) ? topics : []).filter((x) => x !== topic);
}

/** Does `topics` already hold `topic` (case-insensitive)? */
export function hasTopic(topics, topic) {
  const s = cleanTopic(topic);
  return (Array.isArray(topics) ? topics : []).some((x) => same(x, s));
}

/** A stable text of the settings, to tell whether they changed since the last save. */
export function kidsSignature(k) {
  const n = normalizeKids(k);
  return JSON.stringify([n.enabled, n.age, n.blockedTopics]);
}

/** The quota notice state from GET /usage/quota: null when there is no limit to show. */
export function quotaView(q) {
  if (!q || !(Number(q.limit) > 0)) return null;
  const limit = Number(q.limit);
  const used = Math.max(0, Number(q.used) || 0);
  return {
    limit,
    used,
    left: Math.max(0, limit - used),
    exceeded: q.exceeded === true || used >= limit,
    blocked: Math.max(0, Number(q.blocked) || 0),
    pct: Math.min(100, Math.round((used / limit) * 100)),
  };
}

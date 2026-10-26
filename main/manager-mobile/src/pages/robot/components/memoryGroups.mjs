// TinyBot's notes grouped by the person they are about (per-person memory: the server files a
// note under the family member the voiceprint check recognised). Unit tested in memoryGroups.test.mjs.

/**
 * [{ person, notes }] in the notes' order: named people first (most notes first, then by name),
 * the notes nobody is named on last (person ''). Empty when there are no notes.
 */
export function groupByPerson(notes) {
  const groups = new Map()
  for (const n of Array.isArray(notes) ? notes : []) {
    const person = String((n && n.person) || '').trim()
    if (!groups.has(person))
      groups.set(person, [])
    groups.get(person).push(n)
  }
  const named = [...groups.entries()].filter(([p]) => p).sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0])).map(([person, list]) => ({ person, notes: list }))
  const rest = groups.get('')
  return rest ? [...named, { person: '', notes: rest }] : named
}

/** Are any notes filed under a person (else the page keeps one plain list)? */
export function hasPeople(notes) {
  return (Array.isArray(notes) ? notes : []).some(n => n && String(n.person || '').trim())
}

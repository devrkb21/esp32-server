/* eslint-disable test/no-import-node-test -- zero-dependency unit tests */
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  applyMemoryChoice,
  firstLine,
  fromEditableProviders,
  isHomeAssistant,
  languagesOf,
  linesToList,
  listToLines,
  localeName,
  normalizeAgentFunctions,
  normalizeFunctionParams,
  pluginCatalog,
  previewText,
  signed,
  splitLanguages,
  stableSerialize,
  toEditableProviders,
  tuningSummary,
} from './agentModel.mjs'

test('signed values read as people say them', () => {
  assert.equal(signed(12), '+12')
  assert.equal(signed(-5), '-5')
  assert.equal(signed(0), '0')
  assert.equal(signed(undefined), '0')
})

test('previews collapse whitespace, first lines are trimmed and clipped', () => {
  assert.equal(previewText('  a\n\n b  c '), 'a b c')
  assert.equal(previewText(null), '')
  assert.equal(firstLine('\n  Hello there \nsecond'), 'Hello there')
  assert.equal(firstLine('x'.repeat(100), 10), `${'x'.repeat(9)}…`)
})

test('voice languages split on every separator the server uses', () => {
  assert.deepEqual(splitLanguages('bn-BD、en-US; zh，de , fr'), ['bn-BD', 'en-US', 'zh', 'de', 'fr'])
  assert.deepEqual(splitLanguages(null), [])
  assert.deepEqual(languagesOf([{ languages: 'bn-BD,en-US' }, { languages: 'en-US' }, {}]), ['bn-BD', 'en-US'])
})

test('plugin parameters normalise from strings, objects and junk', () => {
  assert.deepEqual(normalizeFunctionParams('{"a":1}'), { a: 1 })
  assert.deepEqual(normalizeFunctionParams('[1]', { d: 1 }), { d: 1 })
  assert.deepEqual(normalizeFunctionParams('nope'), {})
  assert.deepEqual(normalizeFunctionParams({ a: 2 }, { a: 1, b: 1 }), { a: 2, b: 1 })
  assert.deepEqual(normalizeFunctionParams(null, { d: 1 }), { d: 1 })
  assert.deepEqual(normalizeAgentFunctions([{ pluginId: 'p', paramInfo: '{"x":true}' }]), [{ pluginId: 'p', paramInfo: { x: true } }])
})

test('stable serialisation ignores key order but keeps array order', () => {
  assert.equal(stableSerialize({ b: 1, a: { d: 1, c: 2 } }), stableSerialize({ a: { c: 2, d: 1 }, b: 1 }))
  assert.notEqual(stableSerialize([1, 2]), stableSerialize([2, 1]))
})

test('plugin catalogue reads its field list and defaults', () => {
  const [p] = pluginCatalog([{ id: 'w', fields: '[{"key":"city","default":"Dhaka","type":"string"}]' }])
  assert.deepEqual(p.params, { city: 'Dhaka' })
  assert.equal(p.fieldsMeta.length, 1)
  assert.deepEqual(pluginCatalog([{ id: 'x', fields: 'broken' }])[0].fieldsMeta, [])
})

test('the smart home helper is recognised by code, id or name', () => {
  assert.ok(isHomeAssistant({ providerCode: 'hass_state' }))
  assert.ok(isHomeAssistant({ id: 'SYSTEM_PLUGIN_HA_STATE' }))
  assert.ok(isHomeAssistant({ name: 'Home Assistant control' }))
  assert.ok(!isHomeAssistant({ name: 'Weather' }))
  assert.ok(!isHomeAssistant(null))
})

test('list parameters round-trip through lines', () => {
  assert.deepEqual(linesToList('a\n\nb'), ['a', 'b'])
  assert.equal(listToLines(['a', 'b']), 'a\nb')
  assert.equal(listToLines(undefined), '')
})

test('context sources become editable rows and back', () => {
  assert.deepEqual(toEditableProviders([]), [{ url: '', headers: [{ key: '', value: '' }] }])
  const rows = toEditableProviders([{ url: 'https://x.test', headers: { Authorization: 'k' } }])
  assert.deepEqual(rows, [{ url: 'https://x.test', headers: [{ key: 'Authorization', value: 'k' }] }])
  rows.push({ url: '  ', headers: [] })
  rows[0].headers.push({ key: ' ', value: 'dropped' })
  assert.deepEqual(fromEditableProviders(rows), [{ url: 'https://x.test', headers: { Authorization: 'k' } }])
})

test('tuning summary is empty at the natural voice', () => {
  assert.equal(tuningSummary({ ttsVolume: 0, ttsRate: 0, ttsPitch: 0 }), '')
  assert.equal(tuningSummary({ ttsVolume: 10, ttsRate: -5, ttsPitch: 0 }), '+10 / -5 / 0')
})

test('memory choice keeps the summary aside while memory is off', () => {
  const off = applyMemoryChoice({ memModelId: 'Memory_mem_local_short', summaryMemory: 'likes tea', chatHistoryConf: 2 }, 'Memory_nomem', '')
  assert.equal(off.form.summaryMemory, '')
  assert.equal(off.form.chatHistoryConf, 0)
  assert.equal(off.stash, 'likes tea')
  const on = applyMemoryChoice(off.form, 'Memory_mem_local_short', off.stash)
  assert.equal(on.form.summaryMemory, 'likes tea')
  assert.equal(on.form.chatHistoryConf, 2)
  assert.equal(on.stash, '')
})

test('localeName turns known voice language codes into plain words', () => {
  assert.equal(localeName('bn-BD'), 'বাংলা (বাংলাদেশ)')
  assert.equal(localeName('bn-IN'), 'বাংলা (ভারত)')
  assert.equal(localeName('en-US'), 'English (US)')
  assert.equal(localeName('en-GB'), 'English (UK)')
  assert.equal(localeName('ja-JP'), 'ja-JP')
  assert.equal(localeName(''), '')
  assert.equal(localeName(undefined), '')
})

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
// eslint-disable-next-line test/no-import-node-test -- run with node --test (packet rule)
import { it } from 'node:test'
import {
  aliasesFromText,
  contactBody,
  contactProblems,
  deviceBody,
  deviceProblems,
  editState,
  groupContacts,
  integrationBody,
  integrationProblems,
  needsSecretAgain,
  readIntegration,
  requestErrorKey,
  resultKey,
  sendProblems,
  sendResultKey,
  sortDevices,
  sortTargets,
  testActions,
} from './homeModel.mjs'

const TOKEN = 'eyJhbGciOiJIUzI1NiJ9.real-token'
const VIEW = {
  ha: { baseUrl: 'http://192.168.0.50:8123', tokenSaved: true },
  mqtt: { host: '192.168.0.60', port: 1883, username: 'home', passwordSaved: false, tls: true },
}

it('the form never holds a saved secret, and a secret is sent only when typed', () => {
  const s = readIntegration(VIEW)
  assert.equal(s.form.haToken, '')
  assert.deepEqual(s.saved, { token: true, password: false })
  assert.deepEqual(integrationBody(s.form, 'ha'), { haBaseUrl: 'http://192.168.0.50:8123' })
  assert.deepEqual(integrationBody({ ...s.form, haToken: ` ${TOKEN} ` }, 'ha'), { haBaseUrl: 'http://192.168.0.50:8123', haToken: TOKEN })
  assert.deepEqual(integrationBody(s.form, 'mqtt'), { mqttHost: '192.168.0.60', mqttPort: 1883, mqttUsername: 'home', mqttTls: true })
  assert.deepEqual(integrationBody({ ...s.form, mqttPassword: 'pw' }, 'mqtt').mqttPassword, 'pw')
})

it('field checks', () => {
  assert.deepEqual(integrationProblems({ haBaseUrl: 'ha.local', haToken: '' }, 'ha', { token: false }), { haBaseUrl: 'mhome.err.url', haToken: 'mhome.err.tokenRequired' })
  assert.deepEqual(integrationProblems({ haBaseUrl: 'https://ha.example', haToken: '' }, 'ha', { token: true }), {})
  assert.deepEqual(integrationProblems({ mqttHost: 'a b', mqttPort: '0' }, 'mqtt'), { mqttHost: 'mhome.err.host', mqttPort: 'mhome.err.port' })
  assert.equal(needsSecretAgain({ serverMsg: 'token_required: enter it again' }), 'haToken')
  assert.equal(needsSecretAgain({ serverMsg: 'password_required: x' }), 'mqttPassword')
  assert.equal(needsSecretAgain(new Error('x')), '')
})

it('aliases and devices', () => {
  assert.deepEqual(aliasesFromText('বসার ঘরের বাতি, living room,\nLiving Room।ড্রয়িং রুমের লাইট'), ['বসার ঘরের বাতি', 'living room', 'ড্রয়িং রুমের লাইট'])
  const e = editState({ id: '2', source: 'mqtt', domain: 'switch', name: 'Kettle', aliases: ['কেটলি'], topic: 'home/kettle/set', enabled: true })
  assert.equal(e.aliasText, 'কেটলি')
  assert.deepEqual(deviceProblems({ ...e, topic: 'home/+/set' }, true), { topic: 'mhome.err.topicWildcard' })
  assert.deepEqual(deviceProblems({ ...e, name: ' ' }, false), { name: 'mhome.err.nameRequired' })
  assert.deepEqual(deviceBody(e, true), { name: 'Kettle', aliases: ['কেটলি'], enabled: true, domain: 'switch', topic: 'home/kettle/set', payloadOn: 'ON', payloadOff: 'OFF' })
  assert.deepEqual(testActions('cover').map(a => a.action), ['open', 'close'])
  assert.deepEqual(testActions('light').map(a => a.action), ['on', 'off'])
  assert.equal(resultKey('unauthorized'), 'mhome.result.unauthorized')
  assert.equal(resultKey('?'), 'mhome.result.error')
  assert.deepEqual(sortDevices([{ id: 'a', enabled: false }, { id: 'b', enabled: true }]).map(d => d.id), ['b', 'a'])
})

it('robot contacts and the composer', () => {
  const g = groupContacts([
    { id: '1', status: 'pending', direction: 'in' },
    { id: '2', status: 'accepted', direction: 'out' },
    { id: '3', status: 'pending', direction: 'out' },
    { id: '4', status: 'declined', direction: 'out' },
  ])
  assert.deepEqual([g.incoming, g.accepted, g.outgoing].map(l => l.map(c => c.id)), [['1'], ['2'], ['3']])
  assert.deepEqual(contactProblems({ deviceId: '', username: '', name: '' }, 'ask'), { deviceId: 'mrmsg.err.robot', username: 'mrmsg.err.username', name: 'mrmsg.err.nameRequired' })
  assert.deepEqual(contactProblems({ name: 'বাবার রোবট' }, 'rename'), {})
  assert.deepEqual(contactBody({ deviceId: 'd1', username: ' baba ', name: 'বাবার রোবট', aliasText: 'বাবা, Abbu' }, 'ask'), { name: 'বাবার রোবট', aliases: ['বাবা', 'Abbu'], deviceId: 'd1', username: 'baba' })
  assert.deepEqual(sendProblems({ target: '', text: '' }), { target: 'mrmsg.err.target', text: 'mrmsg.err.text' })
  assert.equal(sendResultKey({ ok: true, later: true }), 'mrmsg.send.later')
  assert.equal(sendResultKey({ ok: false, code: 'not_registered' }), 'mrmsg.send.err.not_registered')
  assert.equal(requestErrorKey({ serverMsg: 'exists: already' }), 'mrmsg.err.exists')
  assert.deepEqual(sortTargets([{ key: 'c', name: 'A', kind: 'contact' }, { key: 'd', name: 'Z', kind: 'own' }]).map(t => t.key), ['d', 'c'])
})

it('strings: both languages, same keys, no em dash', async () => {
  const src = readFileSync(new URL('../../i18n/pages/m-home.ts', import.meta.url), 'utf8')
  const keysOf = (lang) => {
    const block = src.split(`${lang}: {`)[1].split('\n  },')[0]
    return [...block.matchAll(/^\s+'([^']+)':/gm)].map(m => m[1]).sort()
  }
  assert.ok(src.indexOf('bn: {') < src.indexOf('en: {'))
  assert.deepEqual(keysOf('bn'), keysOf('en'))
  assert.ok(keysOf('bn').length > 50)
  assert.ok(!src.includes('—'))
})

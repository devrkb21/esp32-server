import assert from 'node:assert/strict'
import test from 'node:test'
import { compactPhone, inviteTarget, looksLikePhone, mergeRobots, roleCan, roleOfAgent, sharedRobot, splitMembers } from './familyModel.mjs'

test('invite target: Bangladeshi phone forms become +8801...', () => {
  assert.deepEqual(inviteTarget('01712345678'), { ok: true, kind: 'phone', value: '+8801712345678', problem: '' })
  assert.equal(inviteTarget('8801712345678').value, '+8801712345678')
  assert.equal(inviteTarget('+880 1712-345678').value, '+8801712345678')
  assert.equal(inviteTarget('01212345678').problem, 'phone')
  assert.equal(inviteTarget('0171234567').problem, 'phone')
})

test('invite target: usernames and empty input', () => {
  assert.deepEqual(inviteTarget('  rina_k '), { ok: true, kind: 'username', value: 'rina_k', problem: '' })
  assert.equal(inviteTarget('').problem, 'required')
  assert.equal(inviteTarget('two words').problem, 'username')
  assert.equal(looksLikePhone('abc123'), false)
  assert.equal(compactPhone(' (017) 12 '), '01712')
})

test('roles: members use, co-owners manage, only the owner deletes and shares', () => {
  assert.equal(roleCan('member', 'use'), true)
  assert.equal(roleCan('member', 'manage'), false)
  assert.equal(roleCan('co_owner', 'manage'), true)
  assert.equal(roleCan('co_owner', 'delete'), false)
  assert.equal(roleCan('owner', 'share'), true)
  assert.equal(roleCan(undefined, 'delete'), true)
  assert.equal(roleCan('member', 'nope'), false)
})

test('members split into accepted and pending, oldest first', () => {
  const s = splitMembers([
    { id: 'b', status: 'accepted', createdAt: 2 },
    { id: 'a', status: 'accepted', createdAt: 1 },
    { id: 'c', status: 'pending', createdAt: 3 },
    null,
  ])
  assert.deepEqual(s.accepted.map(m => m.id), ['a', 'b'])
  assert.deepEqual(s.pending.map(m => m.id), ['c'])
  assert.deepEqual(splitMembers(undefined), { accepted: [], pending: [] })
})

test('shared robots join the list after own robots, never twice', () => {
  const shared = sharedRobot({ shareId: 's1', deviceId: 'd2', agentId: 'a9', alias: 'Nanu', role: 'co_owner', ownerName: 'rina' }, { productKey: 'tinybot', features: ['companion'] })
  assert.equal(shared.role, 'co_owner')
  assert.equal(shared.sharedBy, 'rina')
  assert.equal(shared.name, 'Nanu')
  const list = mergeRobots([{ deviceId: 'd1', agentId: 'a1' }], [shared, { ...shared, deviceId: 'd1' }])
  assert.deepEqual(list.map(r => [r.deviceId, r.role]), [['d1', 'owner'], ['d2', 'co_owner']])
  assert.equal(sharedRobot({ role: 'boss' }).role, 'member')
})

test('role of an agent follows the robots that run it', () => {
  const list = [{ agentId: 'a1', role: 'owner' }, { agentId: 'a9', role: 'member' }, { agentId: 'a8', role: 'co_owner' }]
  assert.equal(roleOfAgent(list, 'a1'), 'owner')
  assert.equal(roleOfAgent(list, 'a9'), 'member')
  assert.equal(roleOfAgent(list, 'a8'), 'co_owner')
  assert.equal(roleOfAgent(list, 'zz'), 'owner')
})

test('care settings get the alert defaults', async () => {
  const { careSettings, CARE_HOURS } = await import('./familyModel.mjs')
  assert.deepEqual(careSettings(undefined), { enabled: true, no_activity_hours: 0, fall_alert: true, missed_medicine_alert: true })
  assert.deepEqual(careSettings({ enabled: false, no_activity_hours: 40, fall_alert: false, lonely_after_min: 90 }), { enabled: false, no_activity_hours: 12, fall_alert: false, missed_medicine_alert: true })
  assert.equal(careSettings({ no_activity_hours: 'x' }).no_activity_hours, 0)
  assert.deepEqual(CARE_HOURS, [0, 2, 3, 4, 6, 8])
})

/* eslint-disable test/no-import-node-test -- this zero-dependency gate intentionally uses Node's built-in runner */
import assert from 'node:assert/strict'
import test from 'node:test'
import { createVoicePreviewRequestGate, hasVoicePreview, resolveVoicePreviewUrl } from './voicePreviewUtils.mjs'

test('keeps normal voice previews on their direct URL', async () => {
  let cloneRequestCount = 0
  const url = await resolveVoicePreviewUrl({
    id: 'normal-voice',
    isClone: false,
    voiceDemo: 'https://cdn.example.test/normal.wav',
  }, async () => {
    cloneRequestCount += 1
    return 'unused'
  }, 'https://api.example.test')

  assert.equal(url, 'https://cdn.example.test/normal.wav')
  assert.equal(cloneRequestCount, 0)
})

test('resolves relative voice-demos to static bundled path', async () => {
  const url = await resolveVoicePreviewUrl({
    id: 'TTS_EdgeTTS0001',
    isClone: false,
    voiceDemo: '/voice-demos/en-US-JennyNeural.mp3',
  }, async () => 'unused', 'https://api.example.test')

  assert.equal(url, '/static/voice-demos/en-US-JennyNeural.mp3')
})

test('resolves voice key fallback to static bundled path', async () => {
  const url = await resolveVoicePreviewUrl({
    id: 'bn-BD-NabanitaNeural',
    isClone: false,
  }, async () => 'unused', 'https://api.example.test')

  assert.equal(url, '/static/voice-demos/bn-BD-NabanitaNeural.mp3')
})

test('uses the clone record id to obtain and construct a temporary play URL', async () => {
  let requestedCloneId = ''
  const url = await resolveVoicePreviewUrl({
    id: 'clone-record-id',
    isClone: true,
    voiceDemo: 'provider-speaker-id-must-not-be-played',
  }, async (cloneId) => {
    requestedCloneId = cloneId
    return 'temporary uuid'
  }, 'https://api.example.test/')

  assert.equal(requestedCloneId, 'clone-record-id')
  assert.equal(url, 'https://api.example.test/voiceClone/play/temporary%20uuid')
})

test('shows a preview control for cloned voices even without voiceDemo', () => {
  assert.equal(hasVoicePreview({ id: 'clone-record-id', isClone: true }), true)
  assert.equal(hasVoicePreview({ id: 'normal-voice', isClone: false, voiceDemo: '' }), false)
})

test('invalidates an older request when the same voice is cancelled and retried', () => {
  const gate = createVoicePreviewRequestGate()
  const firstRequest = gate.begin()

  gate.invalidate()
  const retryRequest = gate.begin()

  assert.equal(gate.isCurrent(firstRequest), false)
  assert.equal(gate.isCurrent(retryRequest), true)
})

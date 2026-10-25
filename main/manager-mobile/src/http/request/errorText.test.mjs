/* eslint-disable test/no-import-node-test -- this zero-dependency gate intentionally uses Node's built-in runner */
import assert from 'node:assert/strict'
import test from 'node:test'
import { businessKey, httpStatusKey, networkErrorKey, peopleText, readRequestError, requestErrorMessage, wasShown } from './errorText.mjs'

function business(code, msg) {
  const e = new Error(`Request error [${code}]: ${msg}`)
  e.code = code
  e.serverMsg = msg
  return e
}

test('HTTP statuses map to plain lines', () => {
  assert.equal(httpStatusKey(401), 'request.sessionEnded')
  assert.equal(httpStatusKey(403), 'request.forbidden')
  assert.equal(httpStatusKey(404), 'request.notFound')
  assert.equal(httpStatusKey(408), 'network.timeout')
  assert.equal(httpStatusKey(504), 'network.timeout')
  assert.equal(httpStatusKey(500), 'request.server')
  assert.equal(httpStatusKey(502), 'request.server')
  assert.equal(httpStatusKey(503), 'request.server')
  assert.equal(httpStatusKey(400), 'request.failed')
  assert.equal(httpStatusKey(429), 'request.busy')
})

test('no answer at all: timeout, unreachable, or an abort the app made', () => {
  assert.equal(networkErrorKey({ errMsg: 'request:fail timeout' }), 'network.timeout')
  assert.equal(networkErrorKey({ errMsg: 'request:fail' }), 'network.unreachable')
  assert.equal(networkErrorKey(new Error('Network Error')), 'network.unreachable')
  assert.equal(networkErrorKey({ errMsg: 'request:fail abort' }), '')
})

test('server text reaches people only when it is meant for them', () => {
  assert.equal(peopleText('This name is already used'), 'This name is already used')
  assert.equal(peopleText('এই নামটি আগে থেকেই আছে'), 'এই নামটি আগে থেকেই আছে')
  assert.equal(peopleText('device not found'), '')
  assert.equal(peopleText('Companion server is not reachable'), '')
  assert.equal(peopleText('java.lang.NullPointerException: null'), '')
  assert.equal(peopleText('Internal Server Error'), '')
  assert.equal(peopleText('Error at com.x.Service.run(Service.java:12)\n  at y'), '')
  assert.equal(peopleText('{"error":"bad"}'), '')
  assert.equal(peopleText('<html><body>502</body></html>'), '')
  assert.equal(peopleText('服务器内部错误'), '')
  assert.equal(peopleText('x'.repeat(200)), '')
  assert.equal(peopleText(''), '')
  assert.equal(peopleText(null), '')
})

test('business codes without people text', () => {
  assert.equal(businessKey(401), 'request.sessionEnded')
  assert.equal(businessKey(403), 'request.forbidden')
  assert.equal(businessKey(404), 'request.notFound')
  assert.equal(businessKey(500), 'request.server')
  assert.equal(businessKey(10194), 'request.failed')
})

test('reads what the request layer throws', () => {
  assert.deepEqual(readRequestError(business(500, 'device not found')), { kind: 'business', code: 500, status: null, msg: 'device not found' })
  assert.equal(readRequestError(new Error('Request error [10211]: feature')).code, 10211)
  const http = new Error('HTTP request error [502]')
  http.status = 502
  assert.equal(readRequestError(http).kind, 'http')
  assert.equal(readRequestError(new Error('HTTP request error [404]')).status, 404)
  assert.equal(readRequestError('Name taken').kind, 'business')
  assert.equal(readRequestError({ errMsg: 'request:fail timeout' }).kind, 'network')
  assert.equal(readRequestError(new Error('no frame')).kind, 'local')
})

test('one message per failure, never raw text', () => {
  assert.deepEqual(requestErrorMessage(business(500, 'Name already used'), 'x.failed'), { text: 'Name already used' })
  assert.deepEqual(requestErrorMessage(business(500, 'device not found'), 'x.failed'), { key: 'x.failed' })
  assert.deepEqual(requestErrorMessage(business(403, 'Forbidden'), 'x.failed'), { key: 'request.forbidden' })
  assert.deepEqual(requestErrorMessage(business(404, 'Not Found'), 'x.failed'), { key: 'request.notFound' })
  const http = new Error('HTTP request error [503]')
  http.status = 503
  assert.deepEqual(requestErrorMessage(http, 'x.failed'), { key: 'request.server' })
  assert.deepEqual(requestErrorMessage({ errMsg: 'request:fail timeout' }, 'x.failed'), { key: 'network.timeout' })
  assert.deepEqual(requestErrorMessage({ errMsg: 'request:fail' }, 'x.failed'), { key: 'network.unreachable' })
  assert.deepEqual(requestErrorMessage(new Error('TypeError: x is undefined'), 'x.failed'), { key: 'x.failed' })
})

test('an error the request layer showed is not shown again', () => {
  const e = business(500, 'x')
  assert.equal(wasShown(e), false)
  e.shown = true
  assert.equal(wasShown(e), true)
  assert.equal(wasShown('text'), false)
})

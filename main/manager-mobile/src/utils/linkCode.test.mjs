/* eslint-disable test/no-import-node-test -- this zero-dependency gate intentionally uses Node's built-in runner */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  asciiDigits,
  codeFromScan,
  codeFromText,
  errorCodeOf,
  linkCodeOf,
  linkErrorKind,
  linkPagePath,
  linkPlan,
  safePagePath,
} from './linkCode.mjs'

test('code parsing: digits, spaces, dashes, at most six', () => {
  assert.equal(codeFromText('123456'), '123456')
  assert.equal(codeFromText(' 123 456 '), '123456')
  assert.equal(codeFromText('123-456'), '123456')
  assert.equal(codeFromText('12'), '12')
  assert.equal(codeFromText('1234567'), '123456')
  assert.equal(codeFromText(null), '')
})

test('code parsing: Bangla and full-width digits', () => {
  assert.equal(asciiDigits('০১২৩৪৫৬৭৮৯'), '0123456789')
  assert.equal(codeFromText('১২৩ ৪৫৬'), '123456')
  assert.equal(codeFromText('１２３４５６'), '123456')
})

test('code parsing: the robot\'s pasted link', () => {
  assert.equal(codeFromText('https://esp.czbd.app/#/link?code=123456'), '123456')
  assert.equal(codeFromText('http://192.168.0.123:8001/#/link?code=654321&x=1'), '654321')
  assert.equal(codeFromText('http://192.168.0.123:8001/#/link'), '')
  assert.equal(linkCodeOf('123 456'), '123456')
  assert.equal(linkCodeOf('12345'), '')
})

test('scan: our link or a bare code, nothing else', () => {
  assert.equal(codeFromScan('https://esp.czbd.app/#/link?code=123456'), '123456')
  assert.equal(codeFromScan('http://192.168.0.123:8001/#/link?code=654321'), '654321')
  assert.equal(codeFromScan('https://esp.czbd.app/#/link?x=1&code=123456'), '123456')
  assert.equal(codeFromScan('/#/link?code=123456'), '123456')
  assert.equal(codeFromScan(' 123456 '), '123456')
  assert.equal(codeFromScan('১২৩৪৫৬'), '123456')
  assert.equal(codeFromScan('WIFI:S:home;T:WPA;P:secret;;'), '')
  assert.equal(codeFromScan('https://example.com/?q=123456'), '')
  assert.equal(codeFromScan('https://esp.czbd.app/#/link?code=12345'), '')
  assert.equal(codeFromScan('1234567'), '')
  assert.equal(codeFromScan(''), '')
})

test('the link page path', () => {
  assert.equal(linkPagePath('123456'), '/pages/link/index?code=123456')
  assert.equal(linkPagePath(''), '/pages/link/index')
})

test('sign-in redirect: only pages of this app', () => {
  assert.equal(safePagePath('/pages/link/index?code=123456'), '/pages/link/index?code=123456')
  assert.equal(safePagePath(encodeURIComponent('/pages/link/index?code=123456')), '/pages/link/index?code=123456')
  assert.equal(safePagePath('/pages/robots/index'), '/pages/robots/index')
  for (const bad of ['https://evil.example', '//evil.example', '/pages/../x', 'pages/link/index', '/pages/login/index', '/pages/register/index?x=1', '/pages/link/index?code=<script>', 'javascript:alert(1)', '', null]) {
    assert.equal(safePagePath(bad, 'F'), 'F', String(bad))
  }
})

test('auto-link decision and errors', () => {
  assert.equal(linkPlan(0), 'auto')
  assert.equal(linkPlan(1), 'auto')
  assert.equal(linkPlan(3), 'choose')
  assert.equal(errorCodeOf(new Error('Request error [10213]: expired')), 10213)
  assert.equal(errorCodeOf('nothing'), 0)
  assert.equal(linkErrorKind(10213), 'expired')
  assert.equal(linkErrorKind(10063), 'taken')
  assert.equal(linkErrorKind(10214), 'choose')
  assert.equal(linkErrorKind(10212), 'format')
  assert.equal(linkErrorKind(0), 'failed')
})

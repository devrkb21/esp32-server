import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
// eslint-disable-next-line test/no-import-node-test
import { it } from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { withContact } from '../login/authKit.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const docs = resolve(here, '../../../../../docs/legal')
// The generator lives outside src (and outside the TypeScript project), so load it by path.
const { parse } = await import(pathToFileURL(resolve(here, '../../../scripts/legal-gen.mjs')).href)

// texts.ts is TypeScript in a CommonJS package, so read its data part as JSON.
const source = readFileSync(resolve(here, 'texts.ts'), 'utf8')
const LEGAL_TEXTS = JSON.parse(source.slice(source.indexOf('= {') + 2, source.lastIndexOf('export default')).trim())

it('the legal texts are generated from the current docs/legal Markdown (run pnpm legal)', () => {
  for (const name of ['terms', 'privacy']) {
    for (const lang of ['bn', 'en']) {
      const md = readFileSync(resolve(docs, `${name}.${lang}.md`), 'utf8')
      assert.deepEqual(LEGAL_TEXTS[name][lang], parse(md, `${name}.${lang}.md`))
    }
  }
})

it('the closing contact sentence never shows the placeholder', () => {
  for (const name of ['terms', 'privacy']) {
    for (const lang of ['bn', 'en']) {
      const doc = LEGAL_TEXTS[name][lang]
      const last = doc.sections[doc.sections.length - 1].blocks.at(-1)
      assert.ok(last.text.includes('{{CONTACT}}'))
      const shown = withContact(last.text)
      assert.ok(!shown.includes('{{CONTACT}}'))
      assert.ok(shown.endsWith(lang === 'bn' ? 'বাংলাদেশ-এর সঙ্গে যোগাযোগ করুন।' : 'Industries, Bangladesh.'), shown)
    }
  }
})

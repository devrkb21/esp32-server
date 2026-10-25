// Nobix's terms of use and privacy policy: the generated texts match docs/legal, the contact
// placeholder never shows, and the reading page renders each document in the current language.
import { afterEach, describe, expect, it } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from '../scripts/legal-gen.mjs';
import { LEGAL_TEXTS } from '../src/views/legal/texts.js';
import { LEGAL_CONTACT, legalDoc, withContact } from '../src/views/legal/legal.js';

const docs = resolve(__dirname, '../../../docs/legal');

describe('legal texts', () => {
  it('are generated from the current docs/legal Markdown (run npm run legal after editing it)', () => {
    for (const name of ['terms', 'privacy']) {
      for (const lang of ['bn', 'en']) {
        const md = readFileSync(resolve(docs, `${name}.${lang}.md`), 'utf8');
        expect(LEGAL_TEXTS[name][lang]).toEqual(parse(md, `${name}.${lang}.md`));
      }
    }
  });
  it('keep the bold lead-ins and the effective date', () => {
    const en = LEGAL_TEXTS.privacy.en;
    expect(en.effective).toBe('Effective date: 25 October 2026');
    expect(en.sections[0].blocks[0]).toMatchObject({ type: 'p', lead: 'Account details.' });
    expect(LEGAL_TEXTS.terms.bn.effective.startsWith('কার্যকর তারিখ')).toBe(true);
  });
  it('picks Bangla for bn and English otherwise', () => {
    expect(legalDoc('terms', 'bn')).toBe(LEGAL_TEXTS.terms.bn);
    expect(legalDoc('privacy', 'en')).toBe(LEGAL_TEXTS.privacy.en);
    expect(legalDoc('privacy', 'zh_CN')).toBe(LEGAL_TEXTS.privacy.en);
  });
});

describe('contact placeholder', () => {
  it('has no contact yet', () => {
    expect(LEGAL_CONTACT).toBe('');
  });
  it('drops ": {{CONTACT}}" while there is no contact, keeping the full stop', () => {
    expect(withContact('contact Nobix Industries, Bangladesh: {{CONTACT}}.', '')).toBe('contact Nobix Industries, Bangladesh.');
    expect(withContact('যোগাযোগ করুন: {{CONTACT}}।', '')).toBe('যোগাযোগ করুন।');
  });
  it('fills the contact in once Nobix gives one', () => {
    expect(withContact('Bangladesh: {{CONTACT}}.', 'help@example.com')).toBe('Bangladesh: help@example.com.');
  });
});

describe('LegalPage', { timeout: 60000 }, () => {
  afterEach(() => { document.body.innerHTML = ''; localStorage.clear(); });

  async function mountAt(path, locale) {
    const { createRouter, createMemoryHistory } = await import('vue-router');
    const LegalPage = (await import('../src/views/legal/LegalPage.vue')).default;
    const i18n = (await import('../src/i18n/index.js')).default;
    const kit = (await import('../src/kit/index.js')).default;
    const Blank = { template: '<div />' };
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/terms', component: LegalPage, meta: { doc: 'terms' } },
        { path: '/privacy', component: LegalPage, meta: { doc: 'privacy' } },
        { path: '/login', component: Blank }, { path: '/more', component: Blank },
      ],
    });
    router.push(path);
    await router.isReady();
    i18n.global.locale = locale;
    const w = mount(LegalPage, { global: { plugins: [router, i18n, kit] } });
    await flushPromises();
    return w;
  }

  it('shows the English terms with ruled section headings and a way back to sign in', async () => {
    const w = await mountAt('/terms', 'en');
    expect(w.find('h1').text()).toBe('TinyBot Terms of Use');
    expect(w.findAll('h2').length).toBe(LEGAL_TEXTS.terms.en.sections.length);
    const back = w.findAll('a.legal__back');
    expect(back.length).toBe(2);
    expect(back[0].attributes('href')).toBe('/login');
    expect(back[0].text()).toBe('Back to sign in');
    expect(w.text()).not.toContain('{{CONTACT}}');
    expect(w.text()).toContain('contact Nobix Industries, Bangladesh.');
  });

  it('shows the Bangla privacy policy in Bangla mode with its bold lead-ins', async () => {
    const w = await mountAt('/privacy', 'bn');
    expect(w.find('h1').text()).toBe('টাইনিবট গোপনীয়তা নীতি');
    expect(w.find('.legal__lead').text()).toBe('অ্যাকাউন্টের তথ্য।');
    expect(w.text()).not.toContain('{{CONTACT}}');
    expect(w.text()).toContain('যোগাযোগ করুন।');
  });
});

describe('legal routes', () => {
  it('are bare and open without signing in', async () => {
    localStorage.clear();
    window.scrollTo = () => {};
    const { default: router } = await import('../src/router/index.js');
    await router.push('/privacy');
    expect(router.currentRoute.value.path).toBe('/privacy');
    expect(router.currentRoute.value.meta.bare).toBe(true);
    await router.push('/terms');
    expect(router.currentRoute.value.path).toBe('/terms');
  });
});

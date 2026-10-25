<template>
  <div class="legal">
    <div class="legal__wrap">
      <header class="legal__top">
        <p class="legal__brand">
          <img :src="markSrc" alt="" width="56" height="32" />
          <span><b>{{ $t('nav.brand') }}</b></span>
        </p>
        <div class="legal__lang">
          <TbIcon name="language" :size="18" aria-hidden="true" />
          <TbSelect :model-value="lang" :options="languageOptions" size="s" :aria-label="$t('nav.language')"
            @change="pickLanguage" />
        </div>
      </header>

      <nav class="legal__nav" :aria-label="$t(titleKey)">
        <RouterLink class="legal__back" :to="back.to"><TbIcon name="chevron-left" :size="16" />{{ $t(back.label) }}</RouterLink>
        <RouterLink class="legal__other" :to="`/${other}`">{{ $t(`legal.other.${name}`) }}</RouterLink>
      </nav>

      <article class="legal__doc" :lang="docLang">
        <header class="legal__head">
          <h1>{{ doc.title }}</h1>
          <p class="legal__effective">{{ doc.effective }}</p>
        </header>
        <template v-for="(b, i) in doc.intro" :key="`i${i}`">
          <LegalBlock :block="b" />
        </template>
        <section v-for="(s, si) in doc.sections" :key="si" class="legal__section">
          <h2>{{ s.heading }}</h2>
          <LegalBlock v-for="(b, bi) in s.blocks" :key="bi" :block="b" />
        </section>
        <TbMaker class="legal__maker" :width="120" />
      </article>

      <footer class="legal__foot">
        <RouterLink class="legal__back" :to="back.to"><TbIcon name="chevron-left" :size="16" />{{ $t(back.label) }}</RouterLink>
      </footer>
    </div>
  </div>
</template>

<script setup>
import { computed, h } from 'vue';
import { useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { LANGUAGES, changeLanguage } from '@/i18n';
import { legalDoc, withContact } from './legal';

// One reading page for Nobix's terms of use (/terms) and privacy policy (/privacy), shown in the
// current language. Bare like the sign-in pages: anyone can read it, signed in or not.
const route = useRoute();
const { locale } = useI18n({ useScope: 'global' });
const lang = computed(() => locale.value);
const name = computed(() => (route.meta.doc === 'privacy' ? 'privacy' : 'terms'));
const other = computed(() => (name.value === 'privacy' ? 'terms' : 'privacy'));
const titleKey = computed(() => `legal.${name.value}`);
const doc = computed(() => legalDoc(name.value, lang.value));
const docLang = computed(() => (lang.value === 'bn' ? 'bn' : 'en'));
const markSrc = `${import.meta.env.BASE_URL || '/'}brand/nobix-mark.png`;
const languageOptions = LANGUAGES.map((l) => ({ value: l.code, label: l.label }));

function signedIn() {
  try { return Boolean(localStorage.getItem('token')); } catch (e) { return false; }
}
const back = signedIn() ? { to: '/more', label: 'legal.backApp' } : { to: '/login', label: 'legal.back' };

function pickLanguage(code) { if (code && code !== lang.value) changeLanguage(code); }

// A paragraph or a list of the document; a bold lead-in ("Account details.") opens either.
const text = (t) => withContact(t);
const LegalBlock = (props) => {
  const b = props.block;
  const line = (node) => [node.lead ? h('b', { class: 'legal__lead' }, node.lead) : null, node.lead ? ' ' : null, text(node.text)];
  if (b.type === 'list') return h('ul', { class: 'legal__list' }, b.items.map((it) => h('li', line(it))));
  return h('p', line(b));
};
LegalBlock.props = ['block'];
</script>

<style>
.legal { min-height: 100vh; min-height: 100dvh; background: var(--tb-paper); color: var(--tb-ink); }
.legal__wrap {
  width: min(100%, var(--tb-content-max)); margin: 0 auto; padding: 0 16px max(16px, env(safe-area-inset-bottom));
}
.legal__top { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--tb-rule-soft); }
.legal__brand { display: flex; align-items: center; gap: 10px; min-width: 0; }
.legal__brand img { width: auto; height: 32px; flex: none; }
.legal__brand span { display: grid; line-height: 1.15; }
.legal__brand b { font-family: var(--tb-font-display); font-weight: 800; font-size: var(--tb-fs-18); }
.legal__brand small { color: var(--tb-ink-2); font-size: var(--tb-fs-12); }
.legal__lang { display: flex; align-items: center; gap: 6px; color: var(--tb-ink-2); }
.legal__lang .tb-select select { min-height: 40px; border-color: var(--tb-ink-3); font-size: 16px; padding-right: 34px; max-width: 46vw; }
.legal__lang .tb-select__chev { right: 9px; }

.legal__nav, .legal__doc, .legal__foot { max-width: 65ch; margin: 0 auto; }
.legal__nav { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 4px 16px; padding: 12px 0 0; }
.legal__back, .legal__other {
  display: inline-flex; align-items: center; gap: 4px; min-height: 44px;
  color: var(--tb-ink); font-weight: 600; font-size: var(--tb-fs-14); text-decoration: none;
}
.legal__other { color: var(--tb-ink-2); text-decoration: underline; text-underline-offset: 3px; }
@media (hover: hover) and (pointer: fine) {
  .legal__back:hover, .legal__other:hover { color: var(--tb-action); transition: color 120ms var(--tb-ease); }
}

.legal__head { padding: 20px 0 14px; border-bottom: var(--tb-rule-band) solid var(--tb-rule); }
.legal__head h1 { font-family: var(--tb-font-display); font-size: clamp(var(--tb-fs-24), 5vw, var(--tb-fs-32)); font-weight: 800; letter-spacing: -.01em; line-height: 1.2; }
.legal__effective { margin-top: 6px; color: var(--tb-ink-2); font-size: var(--tb-fs-14); }

.legal__doc p, .legal__list { margin-top: 12px; line-height: 1.65; }
.legal__doc > p:first-of-type { margin-top: 16px; }
.legal__section { padding-top: 22px; }
.legal__section h2 {
  font-family: var(--tb-font-display); font-size: var(--tb-fs-18); font-weight: 700; line-height: 1.3;
  padding-bottom: 6px; border-bottom: 1px solid var(--tb-rule);
}
.legal__lead { font-weight: 700; }
.legal__list { padding-left: 1.25em; display: grid; gap: 6px; }
.legal__list li { padding-left: 2px; }
.legal__list li::marker { color: var(--tb-ink-3); }

.legal__maker { padding: 36px 0 8px; }
.legal__foot { margin-top: 28px; padding: 6px 0 12px; border-top: 1px solid var(--tb-rule-soft); }

@media (min-width: 960px) {
  .legal__wrap { padding: 0 32px 16px; }
  .legal__head { padding-top: 28px; }
}
</style>

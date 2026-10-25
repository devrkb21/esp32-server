<template>
  <div class="auth">
    <div class="auth__wrap">
      <TbMonthBand :date="today" :lang="lang" />

      <header class="auth__top">
        <p class="auth__brand">
          <img :src="markSrc" alt="" width="32" height="32" />
          <span><b>{{ $t('nav.brand') }}</b></span>
        </p>
        <div class="auth__lang">
          <TbIcon name="language" :size="18" aria-hidden="true" />
          <TbSelect :model-value="lang" :options="languageOptions" size="s" :aria-label="$t('nav.language')"
            @change="pickLanguage" />
        </div>
      </header>

      <main class="auth__main">
        <div class="auth__aside">
          <TbDateBlock class="auth__date" :date="today" :lang="lang" />
          <figure class="auth__bot">
            <TbFace :mood="mood" :pulse="pulse" :alt="$t('auth.faceAlt')" />
            <figcaption class="auth__mood" aria-live="polite">
              <b>{{ $t('nav.brand') }}</b>
              <span>{{ $t(`auth.mood.${mood}`) }}</span>
            </figcaption>
          </figure>
        </div>

        <section class="auth__paper" :aria-labelledby="titleId">
          <header class="auth__head">
            <h1 :id="titleId">{{ title }}</h1>
            <p v-if="lead" class="auth__lead">{{ lead }}</p>
          </header>
          <div class="auth__form"><slot /></div>
        </section>
      </main>

      <footer class="auth__foot">
        <TbMaker class="auth__maker" :width="120" />
        <p>
          <span v-if="ver.year" class="tb-num">{{ num(ver.year) }}</span>
          <span v-if="ver.name">{{ ver.name }}</span>
          <span v-if="ver.version" class="tb-num">{{ $t('auth.version', { v: ver.version }) }}</span>
        </p>
      </footer>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useStore } from 'vuex';
import { LANGUAGES, changeLanguage } from '@/i18n';
import { digits } from '@/kit/calendar';
import { versionParts } from './authKit';

// The frame of the bare sign-in pages: the month band, the Nobix mark with the language choice,
// TinyBot's face window waking up beside (phone) or under the giant date (desktop), the form on
// the paper column, the maker's (Nobix) lockup and the version at the foot.
defineProps({
  title: { type: String, required: true },
  lead: { type: String, default: '' },
  mood: { type: String, default: 'sleepy' },
  pulse: Boolean,
});

const { locale } = useI18n({ useScope: 'global' });
const store = useStore();
const lang = computed(() => locale.value);
const today = new Date();
const titleId = `auth-h-${Math.random().toString(36).slice(2, 7)}`;
const markSrc = `${import.meta.env.BASE_URL || '/'}nobix-mark.svg`;
const languageOptions = LANGUAGES.map((l) => ({ value: l.code, label: l.label }));
const ver = computed(() => versionParts(store.state.pubConfig));
const num = (v) => digits(v, lang.value);

function pickLanguage(code) { if (code && code !== lang.value) changeLanguage(code); }
</script>

<style>
.auth { min-height: 100vh; min-height: 100dvh; background: var(--tb-paper); color: var(--tb-ink); }
.auth__wrap {
  width: min(100%, var(--tb-content-max)); margin: 0 auto; padding: 0 16px max(16px, env(safe-area-inset-bottom));
  min-height: 100vh; min-height: 100dvh; display: flex; flex-direction: column;
}

.auth__top { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--tb-rule-soft); }
.auth__brand { display: flex; align-items: center; gap: 10px; min-width: 0; }
.auth__brand img { width: 32px; height: 32px; flex: none; }
.auth__brand span { display: grid; line-height: 1.15; }
.auth__brand b { font-family: var(--tb-font-display); font-weight: 800; font-size: var(--tb-fs-18); }
.auth__brand small { color: var(--tb-ink-2); font-size: var(--tb-fs-12); }
.auth__lang { display: flex; align-items: center; gap: 6px; color: var(--tb-ink-2); }
.auth__lang .tb-select select { min-height: 40px; border-color: var(--tb-ink-3); font-size: 16px; padding-right: 34px; max-width: 46vw; }
.auth__lang .tb-select__chev { right: 9px; }

/* phone: the face beside the title, the form under them; the date lives in the band */
.auth__main {
  flex: 1; display: grid; align-content: start;
  grid-template-columns: 120px minmax(0, 1fr); column-gap: 16px;
  grid-template-areas: "bot head" "form form";
  padding: 16px 0 24px;
}
.auth__aside, .auth__paper { display: contents; }
.auth__date { display: none; }
.auth__bot { grid-area: bot; margin: 0; display: grid; gap: 6px; align-content: start; }
.auth__mood { display: grid; line-height: 1.3; font-size: var(--tb-fs-12); color: var(--tb-ink-2); }
.auth__mood b { display: none; }
.auth__head { grid-area: head; display: grid; align-content: center; gap: 6px; min-width: 0; }
.auth__head h1 { font-size: var(--tb-fs-24); font-weight: 800; letter-spacing: -.01em; }
.auth__lead { color: var(--tb-ink-2); font-size: var(--tb-fs-14); max-width: 46ch; }
.auth__form { grid-area: form; margin-top: 16px; min-width: 0; }

.auth__foot { display: grid; gap: 4px; padding: 12px 0 4px; border-top: 1px solid var(--tb-rule-soft); color: var(--tb-ink-2); font-size: var(--tb-fs-12); }
.auth__foot p { display: flex; flex-wrap: wrap; justify-content: center; gap: 4px 10px; }
.auth__foot .auth__maker { padding: 14px 0 8px; }

/* desktop: the giant date heads the left column with TinyBot under it; the form on the right */
@media (min-width: 960px) {
  .auth__wrap { padding: 0 32px 16px; }
  .auth__main {
    grid-template-columns: minmax(0, 1fr) minmax(360px, 440px); column-gap: 0;
    grid-template-areas: none; padding: 0;
  }
  .auth__aside { display: grid; align-content: start; gap: 28px; padding: 18px 40px 40px 0; border-right: 1px solid var(--tb-rule); }
  .auth__paper { display: block; padding: 28px 0 40px 40px; }
  .auth__bot, .auth__head, .auth__form { grid-area: auto; }
  .auth__date { display: grid; }
  .auth__date .tb-dateblock__num { font-size: clamp(8rem, 13vw, 11.5rem); }
  .auth__date .tb-dateblock__wd { font-size: var(--tb-fs-24); }
  .auth__date .tb-dateblock__sub { font-size: var(--tb-fs-14); }
  .auth__bot { width: min(100%, 300px); gap: 10px; }
  .auth__mood { font-size: var(--tb-fs-14); }
  .auth__mood b { display: block; font-family: var(--tb-font-display); font-size: var(--tb-fs-18); color: var(--tb-ink); }
  .auth__head h1 { font-size: var(--tb-fs-32); }
  .auth__form { margin-top: 20px; }
}
@media (max-width: 359px) {
  .auth__main { grid-template-columns: 96px minmax(0, 1fr); column-gap: 12px; }
}
</style>

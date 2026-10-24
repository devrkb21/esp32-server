import { createI18n } from 'vue-i18n';
import { reactive } from 'vue';
import bn from './bn';
import en from './en';
import de from './de';
import vi from './vi';
import ptBR from './pt_BR';
import zhCN from './zh_CN';
import zhTW from './zh_TW';

// Each page keeps its own new strings in src/i18n/pages/<page>.js, exporting
// { bn: {...}, en: {...}, de: {...}, ... }, so page work never edits the shared locale files.
const pageFiles = import.meta.glob('./pages/*.js', { eager: true });

export const LANGUAGES = [
  { code: 'bn', label: 'বাংলা' },
  { code: 'en', label: 'English' },
  { code: 'de', label: 'Deutsch' },
  { code: 'pt_BR', label: 'Português (BR)' },
  { code: 'vi', label: 'Tiếng Việt' },
  { code: 'zh_CN', label: '简体中文' },
  { code: 'zh_TW', label: '繁體中文' },
];

const base = { bn, en, de, vi, pt_BR: ptBR, zh_CN: zhCN, zh_TW: zhTW };

function buildMessages() {
  const messages = {};
  for (const [code, table] of Object.entries(base)) messages[code] = { ...table };
  for (const mod of Object.values(pageFiles)) {
    const tables = mod.default || {};
    for (const [code, table] of Object.entries(tables)) {
      messages[code] = { ...(messages[code] || {}), ...table };
    }
  }
  return messages;
}

// Bangla is the default; a saved choice wins.
export function getDefaultLanguage() {
  let saved = null;
  try { saved = localStorage.getItem('userLanguage'); } catch (e) { /* private mode */ }
  if (saved && base[saved]) return saved;
  return 'bn';
}

const i18n = createI18n({
  legacy: true,
  allowComposition: true, // pages may use either this.$t (options API) or useI18n (script setup)
  locale: getDefaultLanguage(),
  fallbackLocale: 'en',
  messages: buildMessages(),
  warnHtmlInMessage: 'off',
  silentTranslationWarn: true,
  silentFallbackWarn: true,
});

// A tiny reactive mirror other modules can watch without an event bus.
export const languageState = reactive({ current: i18n.global.locale });

export function applyDocumentLanguage(lang) {
  document.documentElement.lang = lang === 'bn' ? 'bn' : lang.replace('_', '-');
}

export const changeLanguage = (lang) => {
  i18n.global.locale = lang;
  languageState.current = lang;
  try { localStorage.setItem('userLanguage', lang); } catch (e) { /* private mode */ }
  applyDocumentLanguage(lang);
};

applyDocumentLanguage(i18n.global.locale);

export default i18n;

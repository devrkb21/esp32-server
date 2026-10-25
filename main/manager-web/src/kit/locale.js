import { computed, getCurrentInstance } from 'vue';

// The app's active language for kit components, read from the installed i18n plugin. Unlike
// useI18n() it works with any i18n setup (legacy mode included) and with none, where it is ''.
export function useLocale() {
  const g = getCurrentInstance()?.appContext.config.globalProperties;
  return computed(() => {
    const l = g?.$i18n?.locale;
    return (l && typeof l === 'object' ? l.value : l) || '';
  });
}

// Theme management utility for Web Console

const THEME_KEY = 'app_theme';

export function getTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === 'dark' || saved === 'light') {
    return saved;
  }
  // Check system preference
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
}

export function isDark() {
  return getTheme() === 'dark';
}

export function applyTheme(theme) {
  const root = document.documentElement;
  const body = document.body;
  if (theme === 'dark') {
    root.classList.add('dark');
    body.classList.add('dark');
  } else {
    root.classList.remove('dark');
    body.classList.remove('dark');
  }
  localStorage.setItem(THEME_KEY, theme);
  // Dispatch custom event for reactive listeners
  window.dispatchEvent(new CustomEvent('app-theme-changed', { detail: { theme } }));
}

export function toggleTheme() {
  const current = getTheme();
  const next = current === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  return next;
}

export function initTheme() {
  const initial = getTheme();
  applyTheme(initial);
  return initial;
}

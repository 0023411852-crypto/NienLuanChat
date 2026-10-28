export type Theme = 'light' | 'dark';

const THEME_KEY = 'khoachat.theme';

export function getTheme(): Theme {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === 'dark' || saved === 'light') return saved;
  return 'light';
}

export function applyTheme(theme: Theme) {
  if (theme === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
  localStorage.setItem(THEME_KEY, theme);
  window.dispatchEvent(new CustomEvent('khoachat:theme-changed', { detail: theme }));
}

export const setTheme = applyTheme;

export function initTheme() {
  const t = getTheme();
  applyTheme(t);
  return t;
}

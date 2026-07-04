export type Theme = 'light' | 'dark';

/** Quyết định theme khởi đầu: ưu tiên lựa chọn đã lưu, nếu không thì theo hệ điều hành. */
export function resolveInitialTheme(stored: string | null, prefersDark: boolean): Theme {
  if (stored === 'dark' || stored === 'light') return stored;
  return prefersDark ? 'dark' : 'light';
}

/** Áp theme vào <html> bằng class 'dark' (khớp Tailwind darkMode: 'class'). */
export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  if (theme === 'dark') root.classList.add('dark');
  else root.classList.remove('dark');
}

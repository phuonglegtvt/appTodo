import type { Theme } from '../lib/theme';

/**
 * Công tắc giao diện dạng segmented (☀ sáng / ☾ tối) — bám mockup dashboard.
 * Ô đang chọn nổi lên bằng nền surface + bóng đổ mềm.
 */
export function ThemeToggle({ theme, onToggle }: { theme: Theme; onToggle: () => void }) {
  const cell = 'flex h-[26px] w-7 items-center justify-center rounded-md text-[13px] transition-colors duration-150';
  const active = 'bg-surface text-text shadow-soft dark:bg-surface-2dark dark:text-text-dark dark:shadow-soft-dark';
  const idle = 'text-text-muted dark:text-text-muted-dark';
  return (
    <button
      onClick={onToggle}
      aria-label="Đổi giao diện sáng/tối"
      className="flex gap-0.5 rounded-lg border border-border bg-surface-2 p-0.5 dark:border-border-dark dark:bg-surface-2dark"
    >
      <span className={`${cell} ${theme === 'light' ? active : idle}`}>☀</span>
      <span className={`${cell} ${theme === 'dark' ? active : idle}`}>☾</span>
    </button>
  );
}

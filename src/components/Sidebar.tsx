import type { SmartView } from '../types/todo';
import { tagColor } from '../lib/tagColor';

interface Props {
  page: 'todos' | 'plan' | 'stocks';
  onPage: (p: 'todos' | 'plan' | 'stocks') => void;
  view: SmartView;
  onView: (v: SmartView) => void;
  counts: Record<SmartView, number>;
  tags: { name: string; count: number }[];
  activeTag: string | null;
  onTag: (t: string | null) => void;
  userEmail: string;
  onSignOut: () => void;
}

const VIEWS: { key: SmartView; label: string }[] = [
  { key: 'today', label: 'Hôm nay' },
  { key: 'upcoming', label: 'Sắp tới' },
  { key: 'all', label: 'Tất cả' },
  { key: 'done', label: 'Đã xong' },
];

/** Sidebar dashboard (desktop): smart views + nhãn + tài khoản. Chỉ nhận props, không gọi mạng. */
export function Sidebar({
  page,
  onPage,
  view,
  onView,
  counts,
  tags,
  activeTag,
  onTag,
  userEmail,
  onSignOut,
}: Props) {
  return (
    <aside className="hidden w-[258px] flex-none flex-col gap-1 border-r border-border bg-surface px-3.5 py-[18px] md:flex dark:border-border-dark dark:bg-surface-dark">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-1.5 pb-3.5 pt-0.5">
        <div className="flex h-[30px] w-[30px] items-center justify-center rounded-[9px] bg-primary text-[15px] font-bold text-white dark:bg-primary-dark">
          ✓
        </div>
        <div className="text-[15.5px] font-bold tracking-tight text-text dark:text-text-dark">Việc của tôi</div>
      </div>

      {/* Chuyển trang: Việc / Kế hoạch */}
      <div className="mb-2 flex gap-0.5 rounded-lg border border-border bg-surface-2 p-0.5 dark:border-border-dark dark:bg-surface-2dark">
        <button
          onClick={() => onPage('todos')}
          aria-pressed={page === 'todos'}
          className={`flex-1 rounded-md px-3 py-1.5 text-[12.5px] font-semibold transition-colors ${
            page === 'todos'
              ? 'bg-surface text-text shadow-sm dark:bg-surface-dark dark:text-text-dark'
              : 'text-text-muted dark:text-text-muted-dark'
          }`}
        >
          Việc
        </button>
        <button
          onClick={() => onPage('plan')}
          aria-pressed={page === 'plan'}
          className={`flex-1 rounded-md px-3 py-1.5 text-[12.5px] font-semibold transition-colors ${
            page === 'plan'
              ? 'bg-surface text-text shadow-sm dark:bg-surface-dark dark:text-text-dark'
              : 'text-text-muted dark:text-text-muted-dark'
          }`}
        >
          Kế hoạch
        </button>
        <button
          onClick={() => onPage('stocks')}
          aria-pressed={page === 'stocks'}
          className={`flex-1 rounded-md px-3 py-1.5 text-[12.5px] font-semibold transition-colors ${
            page === 'stocks'
              ? 'bg-surface text-text shadow-sm dark:bg-surface-dark dark:text-text-dark'
              : 'text-text-muted dark:text-text-muted-dark'
          }`}
        >
          Cổ phiếu
        </button>
      </div>

      {page === 'todos' && (
        <>
          {/* Smart views */}
          <div className="px-2 pb-1.5 pt-2 text-[10.5px] font-bold tracking-[0.09em] text-text-muted dark:text-text-muted-dark">
            SMART VIEWS
          </div>
          {VIEWS.map((v) => {
            const active = view === v.key;
            return (
              <button
                key={v.key}
                onClick={() => onView(v.key)}
                aria-current={active ? 'page' : undefined}
                className={`flex items-center rounded-[9px] border-l-2 px-2.5 py-2 text-sm transition-colors ${
                  active
                    ? 'border-primary bg-primary-soft font-semibold text-primary dark:border-primary-dark dark:bg-primary-soft-dark dark:text-primary-dark'
                    : 'border-transparent font-medium text-text hover:bg-surface-2 dark:text-text-dark dark:hover:bg-surface-2dark'
                }`}
              >
                <span className="flex-1 text-left">{v.label}</span>
                <span
                  className={`text-xs font-semibold ${
                    active ? '' : 'text-text-muted dark:text-text-muted-dark'
                  }`}
                >
                  {counts[v.key]}
                </span>
              </button>
            );
          })}

          {/* Nhãn */}
          {tags.length > 0 && (
            <>
              <div className="px-2 pb-1.5 pt-4 text-[10.5px] font-bold tracking-[0.09em] text-text-muted dark:text-text-muted-dark">
                NHÃN
              </div>
              {tags.map((t) => {
                const active = activeTag === t.name;
                return (
                  <button
                    key={t.name}
                    onClick={() => onTag(active ? null : t.name)}
                    aria-pressed={active}
                    className={`flex items-center gap-2.5 rounded-[9px] px-2.5 py-1.5 ${
                      active
                        ? 'bg-primary-soft dark:bg-primary-soft-dark'
                        : 'hover:bg-surface-2 dark:hover:bg-surface-2dark'
                    }`}
                  >
                    <span className="h-2 w-2 rounded-full" style={{ background: tagColor(t.name) }} />
                    <span className="flex-1 text-left text-[13.5px] font-medium text-text dark:text-text-dark">
                      {t.name}
                    </span>
                    <span className="text-xs text-text-muted dark:text-text-muted-dark">{t.count}</span>
                  </button>
                );
              })}
            </>
          )}
        </>
      )}

      <div className="flex-1" />

      {/* Tài khoản */}
      <div className="mt-2 flex items-center gap-2.5 border-t border-border px-2 pb-1 pt-2.5 dark:border-border-dark">
        <div className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-primary-soft text-[13px] font-bold uppercase text-primary dark:bg-primary-soft-dark dark:text-primary-dark">
          {userEmail.charAt(0) || '?'}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[11px] text-text-muted dark:text-text-muted-dark">{userEmail}</div>
        </div>
        <button
          onClick={onSignOut}
          title="Đăng xuất"
          aria-label="Đăng xuất"
          className="btn-icon h-[30px] w-[30px] flex-none text-[15px]"
        >
          ⏻
        </button>
      </div>
    </aside>
  );
}

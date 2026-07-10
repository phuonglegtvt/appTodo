import { useEffect, useState } from 'react';
import type { Todo } from '../types/todo';

interface Props {
  date: string;
  todos: Todo[];
  onAdd: (title: string) => void;
  onToggle: (id: string, done: boolean) => void;
  onOpenFull: () => void;
  onClose: () => void;
}

/** 'YYYY-MM-DD' -> 'DD/MM'. */
function shortDate(date: string): string {
  const [, m, d] = date.split('-');
  return `${d}/${m}`;
}

/** Ô nổi khi click 1 ngày: thêm việc nhanh + danh sách việc + lối xuống tầng Ngày. */
export function DayPopover({ date, todos, onAdd, onToggle, onOpenFull, onClose }: Props) {
  const [title, setTitle] = useState('');

  // Đóng khi nhấn Esc (click ra ngoài xử lý bằng backdrop bên dưới).
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    onAdd(t);
    setTitle('');
  }

  return (
    <>
      {/* Backdrop bắt click ra ngoài để đóng (kể cả click lại chính ô đó). */}
      <div className="fixed inset-0 z-10" onClick={onClose} />
      <div className="absolute left-1/2 top-full z-20 mt-1 w-56 -translate-x-1/2 rounded-lg border border-border bg-surface p-3 text-left shadow-md dark:border-border-dark dark:bg-surface-dark dark:shadow-md-dark">
        <div className="mb-2 text-xs font-semibold text-text dark:text-text-dark">
          Việc ngày {shortDate(date)}
        </div>

        <form onSubmit={submit} className="mb-2 flex gap-1">
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Thêm việc…"
            aria-label={`Thêm việc ngày ${shortDate(date)}`}
            className="min-w-0 flex-1 rounded-md border border-border bg-surface px-2 py-1 text-xs text-text outline-none placeholder:text-text-muted focus:border-primary dark:border-border-dark dark:bg-surface-2dark dark:text-text-dark dark:placeholder:text-text-muted-dark dark:focus:border-primary-dark"
          />
          <button
            type="submit"
            className="rounded-md bg-primary px-2 py-1 text-xs font-semibold text-white dark:bg-primary-dark"
          >
            Thêm
          </button>
        </form>

        {todos.length > 0 ? (
          <ul className="mb-2 flex max-h-40 flex-col gap-1 overflow-auto">
            {todos.map((t) => (
              <li key={t.id} className="flex items-center gap-1.5 text-xs">
                <input
                  type="checkbox"
                  checked={t.is_done}
                  onChange={() => onToggle(t.id, !t.is_done)}
                  aria-label={`Đánh dấu xong: ${t.title}`}
                  className="flex-none"
                />
                <span
                  className={`truncate ${
                    t.is_done
                      ? 'text-text-muted line-through dark:text-text-muted-dark'
                      : 'text-text dark:text-text-dark'
                  }`}
                >
                  {t.title}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mb-2 text-xs text-text-muted dark:text-text-muted-dark">Chưa có việc.</p>
        )}

        <button
          type="button"
          onClick={onOpenFull}
          className="text-xs font-medium text-primary hover:underline dark:text-primary-dark"
        >
          Mở ngày →
        </button>
      </div>
    </>
  );
}

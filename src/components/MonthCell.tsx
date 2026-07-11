import { useState } from 'react';
import type { MonthCellData } from '../lib/monthCell';
import { visibleTodos } from '../lib/monthCell';

interface Props {
  data: MonthCellData;
  onSelect: () => void;
  onToggleTodo: (id: string, done: boolean) => void;
}

/**
 * 1 ô tháng trong chế độ Năm: nhãn tháng (bấm để đi xuống chế độ Tháng) + số
 * done/total, và danh sách todo trong tháng. Mặc định hiện tối đa 6 việc; nếu
 * nhiều hơn có nút bung/thu gọn tại chỗ (state cục bộ trong ô này).
 */
export function MonthCell({ data, onSelect, onToggleTodo }: Props) {
  const [expanded, setExpanded] = useState(false);
  const { visible, overflow } = visibleTodos(data.todos, expanded);

  return (
    <div className="flex min-h-[9rem] flex-col gap-1.5 rounded-lg border border-border bg-surface p-2 dark:border-border-dark dark:bg-surface-dark">
      <button
        type="button"
        onClick={onSelect}
        className="flex items-baseline justify-between gap-1 text-left transition-colors hover:text-primary dark:hover:text-primary-dark"
      >
        <span className="text-sm font-semibold text-text dark:text-text-dark">{data.monthLabel}</span>
        {data.totalCount > 0 && (
          <span className="text-[10px] text-text-muted dark:text-text-muted-dark">
            {data.doneCount}/{data.totalCount}
          </span>
        )}
      </button>

      <div className="flex flex-col gap-1">
        {visible.map((t) => (
          <label
            key={t.id}
            className={`flex min-w-0 items-center gap-1.5 rounded px-1.5 py-0.5 text-[12px] font-medium ${
              t.is_done
                ? 'text-text-muted line-through dark:text-text-muted-dark'
                : 'bg-primary-soft text-primary dark:bg-primary-soft-dark dark:text-primary-dark'
            }`}
          >
            <input
              type="checkbox"
              checked={t.is_done}
              onChange={() => onToggleTodo(t.id, !t.is_done)}
              className="h-3.5 w-3.5 shrink-0 accent-primary dark:accent-primary-dark"
            />
            <span className="truncate">{t.title}</span>
          </label>
        ))}
      </div>

      {(overflow > 0 || expanded) && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="mt-auto self-start px-1 text-[10px] text-text-muted underline-offset-2 hover:underline dark:text-text-muted-dark"
        >
          {expanded ? 'thu gọn' : `+${overflow} xem thêm`}
        </button>
      )}
    </div>
  );
}

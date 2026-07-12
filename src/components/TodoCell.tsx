import { useState } from 'react';
import type { Todo } from '../types/todo';
import type { TodoCellData } from '../lib/todoCell';
import { visibleTodos, formatDayMonth } from '../lib/todoCell';
import { CellAddForm } from './CellAddForm';

interface Props {
  data: TodoCellData;
  onSelect: () => void;
  onToggleTodo: (id: string, done: boolean) => void;
  onDeleteTodo: (id: string) => void;
  onEditTodo: (todo: Todo) => void;
  onAdd?: (title: string) => void; // có → hiện ô "+ thêm việc"
  showDate?: boolean; // hiện dd/mm mỗi việc
}

/**
 * 1 ô lịch liệt kê việc (dùng cho ô tháng ở tab Năm và ô năm ở tab 5 Năm):
 * nhãn kỳ (bấm để đi xuống tầng con) + số done/total, danh sách việc có checkbox
 * + ngày dd/mm + nút ✕ xóa, tối đa 6 việc với nút bung/thu, và ô thêm việc tùy chọn.
 */
export function TodoCell({ data, onSelect, onToggleTodo, onDeleteTodo, onEditTodo, onAdd, showDate }: Props) {
  const [expanded, setExpanded] = useState(false);
  const { visible, overflow } = visibleTodos(data.todos, expanded);

  function handleDoubleClick(e: React.MouseEvent) {
    // Bỏ qua khi double-click rơi vào phần tử tương tác (việc, checkbox, ✕, ô thêm).
    if ((e.target as HTMLElement).closest('button, input, form')) return;
    onSelect();
  }

  return (
    <div
      onDoubleClick={handleDoubleClick}
      title="Bấm đúp để mở"
      className="flex min-h-[9rem] flex-col gap-1.5 rounded-lg border border-border bg-surface p-2 dark:border-border-dark dark:bg-surface-dark">
      <button
        type="button"
        onClick={onSelect}
        className="flex items-baseline justify-between gap-1 text-left transition-colors hover:text-primary dark:hover:text-primary-dark"
      >
        <span className="text-sm font-semibold text-text dark:text-text-dark">{data.label}</span>
        {data.totalCount > 0 && (
          <span className="text-[10px] text-text-muted dark:text-text-muted-dark">
            {data.doneCount}/{data.totalCount}
          </span>
        )}
      </button>

      <div className="flex flex-col gap-1">
        {visible.map((t) => (
          <div
            key={t.id}
            className={`group flex min-w-0 items-center gap-1.5 rounded px-1.5 py-0.5 text-[12px] font-medium ${
              t.is_done
                ? 'text-text-muted line-through dark:text-text-muted-dark'
                : 'bg-primary-soft text-primary dark:bg-primary-soft-dark dark:text-primary-dark'
            }`}
          >
            <input
              type="checkbox"
              checked={t.is_done}
              onChange={() => onToggleTodo(t.id, !t.is_done)}
              aria-label={t.due_date ? `${t.title} ${formatDayMonth(t.due_date)}` : t.title}
              className="h-3.5 w-3.5 shrink-0 accent-primary dark:accent-primary-dark"
            />
            <button
              type="button"
              onClick={() => onEditTodo(t)}
              aria-label={`Sửa ${t.title}`}
              className="min-w-0 flex-1 truncate text-left hover:underline"
            >
              {t.title}
            </button>
            {showDate && t.due_date && (
              <span className="shrink-0 text-[10px] tabular-nums text-text-muted dark:text-text-muted-dark">
                {formatDayMonth(t.due_date)}
              </span>
            )}
            <button
              type="button"
              onClick={() => onDeleteTodo(t.id)}
              aria-label={t.due_date ? `Xóa ${t.title} ${formatDayMonth(t.due_date)}` : `Xóa ${t.title}`}
              className="shrink-0 rounded px-1 text-[11px] text-text-muted opacity-0 transition hover:text-red-600 group-hover:opacity-100 dark:text-text-muted-dark dark:hover:text-red-300"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      {(overflow > 0 || expanded) && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="self-start px-1 text-[10px] text-text-muted underline-offset-2 hover:underline dark:text-text-muted-dark"
        >
          {expanded ? 'thu gọn' : `+${overflow} xem thêm`}
        </button>
      )}

      {onAdd && <CellAddForm onAdd={onAdd} />}
    </div>
  );
}

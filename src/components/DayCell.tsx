import { useState } from 'react';
import type { Todo } from '../types/todo';
import { CellAddForm } from './CellAddForm';
import { visibleTodos } from '../lib/todoCell';

interface Props {
  dayNumber: number;
  todos: Todo[];
  isToday: boolean;
  maxLines: number;
  onAdd: (title: string) => void;
  onToggle: (id: string, done: boolean) => void;
  onDelete: (id: string) => void;
  onOpenFull: () => void;
}

/** 1 ô ngày (Tháng/Tuần): số ngày (bấm để mở tab Ngày) + việc có checkbox/✕ + ô thêm. */
export function DayCell({
  dayNumber,
  todos,
  isToday,
  maxLines,
  onAdd,
  onToggle,
  onDelete,
  onOpenFull,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const { visible, overflow } = visibleTodos(todos, expanded, maxLines);

  return (
    <div
      className={`flex min-h-[6rem] flex-col gap-1 rounded-lg border bg-surface p-1.5 dark:bg-surface-dark ${
        isToday ? 'border-primary dark:border-primary-dark' : 'border-border dark:border-border-dark'
      }`}
    >
      <button
        type="button"
        onClick={onOpenFull}
        aria-label={`Mở ngày ${dayNumber}`}
        className={`self-start text-xs font-semibold transition-colors hover:text-primary dark:hover:text-primary-dark ${
          isToday ? 'text-primary dark:text-primary-dark' : 'text-text dark:text-text-dark'
        }`}
      >
        {dayNumber}
      </button>

      <div className="flex flex-col gap-0.5">
        {visible.map((t) => (
          <div
            key={t.id}
            className={`group flex min-w-0 items-center gap-1 rounded px-1 text-[10px] ${
              t.is_done
                ? 'text-text-muted line-through dark:text-text-muted-dark'
                : 'bg-primary-soft text-primary dark:bg-primary-soft-dark dark:text-primary-dark'
            }`}
          >
            <input
              type="checkbox"
              checked={t.is_done}
              onChange={() => onToggle(t.id, !t.is_done)}
              aria-label={t.title}
              className="h-3 w-3 shrink-0 accent-primary dark:accent-primary-dark"
            />
            <span className="min-w-0 flex-1 truncate">{t.title}</span>
            <button
              type="button"
              onClick={() => onDelete(t.id)}
              aria-label={`Xóa ${t.title}`}
              className="shrink-0 px-0.5 text-text-muted opacity-0 transition hover:text-red-600 group-hover:opacity-100 dark:text-text-muted-dark dark:hover:text-red-300"
            >
              ✕
            </button>
          </div>
        ))}
        {overflow > 0 && (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="px-1 text-left text-[10px] text-text-muted hover:underline dark:text-text-muted-dark"
          >
            +{overflow} việc
          </button>
        )}
      </div>

      <CellAddForm onAdd={onAdd} />
    </div>
  );
}

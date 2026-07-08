import { useState } from 'react';
import type { Goal } from '../types/goal';

interface Props {
  goal: Goal;
  onToggle: (id: string, done: boolean) => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
}

/** 1 dòng mục tiêu: checkbox hoàn thành + tên (bấm để sửa tại chỗ) + xóa. */
export function GoalItem({ goal, onToggle, onRename, onDelete }: Props) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(goal.title);

  function save() {
    const t = title.trim();
    if (t && t !== goal.title) onRename(goal.id, t);
    else setTitle(goal.title);
    setEditing(false);
  }

  return (
    <li className="flex items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2 dark:border-border-dark dark:bg-surface-dark">
      <button
        type="button"
        role="checkbox"
        aria-checked={goal.is_done}
        aria-label={goal.is_done ? 'Bỏ đánh dấu hoàn thành' : 'Đánh dấu hoàn thành'}
        onClick={() => onToggle(goal.id, !goal.is_done)}
        className={`flex h-5 w-5 flex-none items-center justify-center rounded-md text-[13px] leading-none transition-colors ${
          goal.is_done
            ? 'bg-primary text-white dark:bg-primary-dark'
            : 'border-2 border-border dark:border-border-dark'
        }`}
      >
        {goal.is_done ? '✓' : ''}
      </button>

      {editing ? (
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => e.key === 'Enter' && save()}
          className="min-w-0 flex-1 rounded-md border border-border bg-surface px-2 py-1 text-sm text-text outline-none focus:border-primary dark:border-border-dark dark:bg-surface-2dark dark:text-text-dark"
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className={`min-w-0 flex-1 truncate text-left text-sm ${
            goal.is_done
              ? 'text-text-muted line-through opacity-75 dark:text-text-muted-dark'
              : 'text-text dark:text-text-dark'
          }`}
        >
          {goal.title}
        </button>
      )}

      <button
        onClick={() => onDelete(goal.id)}
        aria-label="Xóa mục tiêu"
        className="flex h-7 w-7 flex-none items-center justify-center rounded-lg text-[13px] text-text-muted transition hover:bg-red-50 hover:text-red-600 dark:text-text-muted-dark dark:hover:bg-red-950/50 dark:hover:text-red-300"
      >
        ✕
      </button>
    </li>
  );
}

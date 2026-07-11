import { useState } from 'react';
import type { Goal, GoalUpdate } from '../types/goal';
import { GoalItem } from './GoalItem';

interface Props {
  goals: Goal[];
  onAdd: (title: string) => void;
  onUpdate: (id: string, patch: GoalUpdate) => void;
  onDelete: (id: string) => void;
}

/** Bảng mục tiêu chung: hiện ở mọi tab, không gắn theo kỳ. Thêm/tick/sửa/xóa. */
export function GoalBoard({ goals, onAdd, onUpdate, onDelete }: Props) {
  const [title, setTitle] = useState('');

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    onAdd(t);
    setTitle('');
  }

  return (
    <div className="flex flex-col gap-2">
      <form onSubmit={submit} className="flex gap-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Thêm mục tiêu…"
          aria-label="Mục tiêu mới"
          className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-primary dark:border-border-dark dark:bg-surface-2dark dark:text-text-dark"
        />
        <button className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white dark:bg-primary-dark">
          Thêm
        </button>
      </form>
      {goals.length === 0 ? (
        <p className="text-sm text-text-muted dark:text-text-muted-dark">Chưa có mục tiêu nào.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {goals.map((g) => (
            <GoalItem
              key={g.id}
              goal={g}
              onToggle={(id, done) => onUpdate(id, { is_done: done })}
              onRename={(id, t) => onUpdate(id, { title: t })}
              onDelete={onDelete}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

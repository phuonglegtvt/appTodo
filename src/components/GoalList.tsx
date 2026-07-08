import { useState } from 'react';
import type { Goal, GoalUpdate, Horizon, NewGoal } from '../types/goal';
import { GoalItem } from './GoalItem';

interface Props {
  goals: Goal[];
  horizon: Horizon;
  periodKey: string;
  onAdd: (input: NewGoal) => void;
  onUpdate: (id: string, patch: GoalUpdate) => void;
  onDelete: (id: string) => void;
}

/** Danh sách mục tiêu của đúng 1 kỳ đang chọn: thêm, tick, sửa tên, xóa. */
export function GoalList({ goals, horizon, periodKey, onAdd, onUpdate, onDelete }: Props) {
  const [title, setTitle] = useState('');

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    onAdd({ horizon, period_key: periodKey, title: t });
    setTitle('');
  }

  return (
    <div className="flex flex-col gap-2">
      <form onSubmit={submit} className="flex gap-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Thêm mục tiêu cho kỳ này…"
          aria-label="Mục tiêu mới"
          className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-primary dark:border-border-dark dark:bg-surface-2dark dark:text-text-dark"
        />
        <button className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white dark:bg-primary-dark">
          Thêm
        </button>
      </form>
      {goals.length === 0 ? (
        <p className="text-sm text-text-muted dark:text-text-muted-dark">Chưa có mục tiêu nào cho kỳ này.</p>
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

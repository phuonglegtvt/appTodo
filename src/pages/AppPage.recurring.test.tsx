import { describe, expect, it, vi } from 'vitest';
import { recurringToggle } from './recurringToggle';
import type { Todo } from '../types/todo';

function todo(p: Partial<Todo>): Todo {
  return {
    id: 't1', user_id: 'u', title: 'Uống thuốc', notes: null, is_done: false,
    due_date: '2026-07-12', priority: 'medium', tags: [], recurrence: 'daily',
    completed_dates: [], sort_order: 0, created_at: '', updated_at: '', ...p,
  };
}

describe('recurringToggle', () => {
  it('việc lặp → cập nhật completed_dates ở due_date, không set is_done', () => {
    const onUpdate = vi.fn();
    recurringToggle(todo({ completed_dates: [] }), onUpdate);
    expect(onUpdate).toHaveBeenCalledWith('t1', { completed_dates: ['2026-07-12'] });
  });

  it('việc lặp đã xong hôm đó → bỏ tick (xóa khỏi completed_dates)', () => {
    const onUpdate = vi.fn();
    recurringToggle(todo({ completed_dates: ['2026-07-12'] }), onUpdate);
    expect(onUpdate).toHaveBeenCalledWith('t1', { completed_dates: [] });
  });
});

import { describe, it, expect } from 'vitest';
import { dayCellItems } from './dayCell';
import type { Todo } from '../types/todo';

function todo(partial: Partial<Todo>): Todo {
  return {
    id: 'id',
    user_id: 'u',
    title: 't',
    notes: null,
    is_done: false,
    due_date: null,
    priority: 'medium',
    tags: [],
    recurrence: 'none',
    sort_order: 0,
    created_at: '',
    updated_at: '',
    ...partial,
  };
}

describe('dayCellItems', () => {
  it('ngày không có việc → rỗng', () => {
    const todos = [todo({ id: 'a', due_date: '2026-06-11' })];
    expect(dayCellItems(todos, '2026-06-10', 3)).toEqual({ lines: [], overflow: 0 });
  });

  it('số việc ≤ max → trả hết, overflow 0', () => {
    const todos = [
      todo({ id: 'a', title: 'A', due_date: '2026-06-10' }),
      todo({ id: 'b', title: 'B', due_date: '2026-06-10', is_done: true }),
    ];
    expect(dayCellItems(todos, '2026-06-10', 3)).toEqual({
      lines: [
        { id: 'a', title: 'A', is_done: false },
        { id: 'b', title: 'B', is_done: true },
      ],
      overflow: 0,
    });
  });

  it('số việc > max → cắt còn max dòng, overflow là phần dư', () => {
    const todos = [
      todo({ id: 'a', title: 'A', due_date: '2026-06-10' }),
      todo({ id: 'b', title: 'B', due_date: '2026-06-10' }),
      todo({ id: 'c', title: 'C', due_date: '2026-06-10' }),
      todo({ id: 'd', title: 'D', due_date: '2026-06-10' }),
      todo({ id: 'e', title: 'E', due_date: '2026-06-10' }),
    ];
    const result = dayCellItems(todos, '2026-06-10', 3);
    expect(result.lines.map((l) => l.id)).toEqual(['a', 'b', 'c']);
    expect(result.overflow).toBe(2);
  });

  it('chỉ lấy việc đúng ngày', () => {
    const todos = [
      todo({ id: 'a', due_date: '2026-06-10' }),
      todo({ id: 'b', due_date: '2026-06-09' }),
      todo({ id: 'c', due_date: null }),
    ];
    expect(dayCellItems(todos, '2026-06-10', 3).lines.map((l) => l.id)).toEqual(['a']);
  });
});

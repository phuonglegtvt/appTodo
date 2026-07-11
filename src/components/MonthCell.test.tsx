import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MonthCell } from './MonthCell';
import type { MonthCellData } from '../lib/monthCell';
import type { Todo } from '../types/todo';

function todo(partial: Partial<Todo>): Todo {
  return {
    id: 'todo-1',
    user_id: 'u',
    title: 'Việc trong tháng',
    notes: null,
    is_done: false,
    due_date: '2026-07-11',
    priority: 'medium',
    tags: [],
    recurrence: 'none',
    sort_order: 0,
    created_at: '',
    updated_at: '',
    ...partial,
  };
}

function monthCellData(overrides: Partial<MonthCellData> = {}): MonthCellData {
  const todos = overrides.todos ?? [todo({})];
  return {
    key: '2026-07',
    monthLabel: 'Tháng 07',
    todos,
    doneCount: todos.filter((t) => t.is_done).length,
    totalCount: todos.length,
    ...overrides,
  };
}

describe('MonthCell', () => {
  it('tick checkbox để toggle todo mà không drill-down sang tháng', () => {
    const onSelect = vi.fn();
    const onToggleTodo = vi.fn();

    render(<MonthCell data={monthCellData()} onSelect={onSelect} onToggleTodo={onToggleTodo} />);

    fireEvent.click(screen.getByRole('checkbox', { name: 'Việc trong tháng' }));

    expect(onToggleTodo).toHaveBeenCalledWith('todo-1', true);
    expect(onSelect).not.toHaveBeenCalled();
  });
});

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TodoCell } from './TodoCell';
import type { TodoCellData } from '../lib/todoCell';
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

function monthCellData(overrides: Partial<TodoCellData> = {}): TodoCellData {
  const todos = overrides.todos ?? [todo({})];
  return {
    key: '2026-07',
    label: 'Tháng 07',
    todos,
    doneCount: todos.filter((t) => t.is_done).length,
    totalCount: todos.length,
    ...overrides,
  };
}

describe('TodoCell', () => {
  it('tick checkbox để toggle todo mà không drill-down sang tháng', () => {
    const onSelect = vi.fn();
    const onToggleTodo = vi.fn();
    const onDeleteTodo = vi.fn();

    render(
      <TodoCell data={monthCellData()} onSelect={onSelect} onToggleTodo={onToggleTodo} onDeleteTodo={onDeleteTodo} />,
    );

    fireEvent.click(screen.getByRole('checkbox', { name: 'Việc trong tháng 11/07' }));

    expect(onToggleTodo).toHaveBeenCalledWith('todo-1', true);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('bấm ✕ gọi onDeleteTodo với id của việc', () => {
    const onSelect = vi.fn();
    const onToggleTodo = vi.fn();
    const onDeleteTodo = vi.fn();

    render(
      <TodoCell data={monthCellData()} onSelect={onSelect} onToggleTodo={onToggleTodo} onDeleteTodo={onDeleteTodo} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Xóa Việc trong tháng 11/07' }));

    expect(onDeleteTodo).toHaveBeenCalledWith('todo-1');
  });

  it('có onAdd → bấm "+ thêm việc" hiện ô nhập, nhập rồi submit gọi onAdd với title đã trim', () => {
    const onSelect = vi.fn();
    const onToggleTodo = vi.fn();
    const onDeleteTodo = vi.fn();
    const onAdd = vi.fn();

    render(
      <TodoCell
        data={monthCellData()}
        onSelect={onSelect}
        onToggleTodo={onToggleTodo}
        onDeleteTodo={onDeleteTodo}
        onAdd={onAdd}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '+ thêm việc' }));
    const input = screen.getByLabelText('Thêm việc');
    fireEvent.change(input, { target: { value: '  Việc mới  ' } });
    fireEvent.submit(input.closest('form')!);

    expect(onAdd).toHaveBeenCalledWith('Việc mới');
  });

  it('không có onAdd → không hiện ô "+ thêm việc"', () => {
    render(
      <TodoCell
        data={monthCellData()}
        onSelect={vi.fn()}
        onToggleTodo={vi.fn()}
        onDeleteTodo={vi.fn()}
      />,
    );

    expect(screen.queryByRole('button', { name: '+ thêm việc' })).not.toBeInTheDocument();
  });

  it('showDate + due_date → hiện dd/mm của việc', () => {
    const data = monthCellData({ todos: [todo({ due_date: '2026-08-05' })] });

    render(<TodoCell data={data} onSelect={vi.fn()} onToggleTodo={vi.fn()} onDeleteTodo={vi.fn()} showDate />);

    expect(screen.getByText('05/08')).toBeInTheDocument();
  });

  it('không có showDate → không hiện dd/mm dù có due_date', () => {
    const data = monthCellData({ todos: [todo({ due_date: '2026-08-05' })] });

    render(<TodoCell data={data} onSelect={vi.fn()} onToggleTodo={vi.fn()} onDeleteTodo={vi.fn()} />);

    expect(screen.queryByText('05/08')).not.toBeInTheDocument();
  });
});

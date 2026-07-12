import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DayCell } from './DayCell';
import type { Todo } from '../types/todo';

function todo(partial: Partial<Todo> = {}): Todo {
  return {
    id: 'todo-1',
    user_id: 'u',
    title: 'Việc hôm nay',
    notes: null,
    is_done: false,
    due_date: '2026-07-12',
    priority: 'medium',
    tags: [],
    recurrence: 'none',
    completed_dates: [],
    sort_order: 0,
    created_at: '',
    updated_at: '',
    ...partial,
  };
}

function renderCell(props: Partial<React.ComponentProps<typeof DayCell>> = {}) {
  return render(
    <DayCell
      dayNumber={12}
      todos={[todo()]}
      isToday={false}
      maxLines={3}
      onAdd={vi.fn()}
      onToggle={vi.fn()}
      onDelete={vi.fn()}
      onEdit={vi.fn()}
      onOpenFull={vi.fn()}
      {...props}
    />,
  );
}

describe('DayCell — double-click mở ngày', () => {
  it('double-click nền ô gọi onOpenFull', () => {
    const onOpenFull = vi.fn();
    const { container } = renderCell({ onOpenFull });

    fireEvent.dblClick(container.firstChild as Element);

    expect(onOpenFull).toHaveBeenCalledTimes(1);
  });

  it('double-click lên một việc KHÔNG gọi onOpenFull', () => {
    const onOpenFull = vi.fn();
    renderCell({ onOpenFull });

    fireEvent.dblClick(screen.getByRole('button', { name: 'Sửa Việc hôm nay' }));

    expect(onOpenFull).not.toHaveBeenCalled();
  });
});

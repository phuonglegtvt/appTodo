import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import { SortableContext } from '@dnd-kit/sortable';
import { TodoItem } from './TodoItem';
import type { Todo } from '../types/todo';

const todo: Todo = {
  id: '1', user_id: 'u', title: 'Mua sữa', notes: null, is_done: false,
  due_date: null, priority: 'medium', tags: [], recurrence: 'none',
  sort_order: 0, created_at: '', updated_at: '',
};

function renderItem(overrides: Partial<Todo> = {}, onUpdate = vi.fn(), onDelete = vi.fn()) {
  const item = { ...todo, ...overrides };
  return render(
    <DndContext>
      <SortableContext items={['1']}>
        <ul>
          <TodoItem todo={item} today="2026-07-12" onToggle={vi.fn()} onUpdate={onUpdate} onDelete={onDelete} />
        </ul>
      </SortableContext>
    </DndContext>,
  );
}

describe('TodoItem — click để sửa', () => {
  it('click vùng nội dung mở form sửa (hiện nút Lưu)', () => {
    renderItem();
    fireEvent.click(screen.getByRole('button', { name: /sửa việc: mua sữa/i }));
    expect(screen.getByRole('button', { name: 'Lưu' })).toBeInTheDocument();
  });

  it('bấm Enter trên vùng nội dung cũng mở form sửa', () => {
    renderItem();
    fireEvent.keyDown(screen.getByRole('button', { name: /sửa việc: mua sữa/i }), { key: 'Enter' });
    expect(screen.getByRole('button', { name: 'Lưu' })).toBeInTheDocument();
  });

  it('bấm phím cách (Space) trên vùng nội dung cũng mở form sửa', () => {
    renderItem();
    fireEvent.keyDown(screen.getByRole('button', { name: /sửa việc: mua sữa/i }), { key: ' ' });
    expect(screen.getByRole('button', { name: 'Lưu' })).toBeInTheDocument();
  });

  it('click nút xem ghi chú ▾ không mở form sửa (chặn lan click)', () => {
    renderItem({ notes: 'Ghi chú gì đó' });
    fireEvent.click(screen.getByRole('button', { name: 'Xem ghi chú' }));
    expect(screen.queryByRole('button', { name: 'Lưu' })).not.toBeInTheDocument();
    // ghi chú vẫn được mở ra bình thường
    expect(screen.getByText('Ghi chú gì đó')).toBeInTheDocument();
  });

  it('bấm phím trên nút xem ghi chú ▾ không mở nhầm form sửa (chặn lan keydown)', () => {
    renderItem({ notes: 'Ghi chú gì đó' });
    fireEvent.keyDown(screen.getByRole('button', { name: 'Xem ghi chú' }), { key: 'Enter' });
    expect(screen.queryByRole('button', { name: 'Lưu' })).not.toBeInTheDocument();
  });

  it('không còn nút ✎ riêng, vẫn còn nút ✕ xóa hoạt động', () => {
    const onDelete = vi.fn();
    renderItem({}, vi.fn(), onDelete);
    expect(screen.queryByRole('button', { name: 'Sửa' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Xóa' }));
    expect(onDelete).toHaveBeenCalledWith('1');
  });
});

describe('TodoItem — hiện ghi chú sẵn', () => {
  it('defaultShowNotes → ghi chú hiện ngay không cần click', () => {
    render(
      <DndContext>
        <SortableContext items={['1']}>
          <ul>
            <TodoItem
              todo={{ ...todo, notes: 'Nội dung ghi chú' }}
              today="2026-07-12"
              onToggle={vi.fn()}
              onUpdate={vi.fn()}
              onDelete={vi.fn()}
              defaultShowNotes
            />
          </ul>
        </SortableContext>
      </DndContext>,
    );
    expect(screen.getByText('Nội dung ghi chú')).toBeInTheDocument();
  });

  it('không truyền defaultShowNotes → ghi chú vẫn ẩn', () => {
    render(
      <DndContext>
        <SortableContext items={['1']}>
          <ul>
            <TodoItem
              todo={{ ...todo, notes: 'Nội dung ghi chú' }}
              today="2026-07-12"
              onToggle={vi.fn()}
              onUpdate={vi.fn()}
              onDelete={vi.fn()}
            />
          </ul>
        </SortableContext>
      </DndContext>,
    );
    expect(screen.queryByText('Nội dung ghi chú')).not.toBeInTheDocument();
  });
});

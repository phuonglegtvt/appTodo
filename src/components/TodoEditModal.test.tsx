import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TodoEditModal } from './TodoEditModal';
import type { Todo } from '../types/todo';

const todo: Todo = {
  id: '1', user_id: 'u', title: 'Mua sữa', notes: null, is_done: false,
  due_date: null, priority: 'medium', tags: [], recurrence: 'none',
  completed_dates: [],
  sort_order: 0, created_at: '', updated_at: '',
};

function renderModal(onSave = vi.fn(), onDelete = vi.fn(), onClose = vi.fn()) {
  render(<TodoEditModal todo={todo} onSave={onSave} onDelete={onDelete} onClose={onClose} />);
  return { onSave, onDelete, onClose };
}

describe('TodoEditModal', () => {
  it('đổi tiêu đề rồi Lưu → gọi onSave với patch đúng và onClose', () => {
    const { onSave, onClose } = renderModal();
    fireEvent.change(screen.getByLabelText('Tiêu đề việc'), { target: { value: 'Mua bánh' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu' }));
    expect(onSave).toHaveBeenCalledWith('1', expect.objectContaining({ title: 'Mua bánh' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('tiêu đề rỗng → không lưu', () => {
    const { onSave } = renderModal();
    fireEvent.change(screen.getByLabelText('Tiêu đề việc'), { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu' }));
    expect(onSave).not.toHaveBeenCalled();
  });

  it('bấm Hủy → gọi onClose, không lưu', () => {
    const { onSave, onClose } = renderModal();
    fireEvent.click(screen.getByRole('button', { name: 'Hủy' }));
    expect(onClose).toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('nhấn Esc → gọi onClose', () => {
    const { onClose } = renderModal();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('bấm Xóa → gọi onDelete rồi onClose', () => {
    const { onDelete, onClose } = renderModal();
    fireEvent.click(screen.getByRole('button', { name: 'Xóa' }));
    expect(onDelete).toHaveBeenCalledWith('1');
    expect(onClose).toHaveBeenCalled();
  });

  it('recurrence bị khóa khi chưa có hạn', () => {
    renderModal();
    expect(screen.getByLabelText('Lặp lại')).toBeDisabled();
  });
});

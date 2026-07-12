import { useEffect, useState } from 'react';
import type { Todo, TodoUpdate, Priority, Recurrence } from '../types/todo';

interface Props {
  todo: Todo;
  onSave: (id: string, patch: TodoUpdate) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

const field =
  'rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/30 dark:border-border-dark dark:bg-surface-2dark dark:text-text-dark dark:focus:border-primary-dark dark:focus:ring-primary-dark/30';

/**
 * Hộp thoại sửa việc dùng chung cho các ô lịch (Tháng/Tuần/Năm/5 Năm), vì ô lịch
 * quá nhỏ để nhét form inline. Trường và quy tắc khớp form sửa ở view Việc.
 */
export function TodoEditModal({ todo, onSave, onDelete, onClose }: Props) {
  const [title, setTitle] = useState(todo.title);
  const [notes, setNotes] = useState(todo.notes ?? '');
  const [priority, setPriority] = useState<Priority>(todo.priority);
  const [dueDate, setDueDate] = useState(todo.due_date ?? '');
  const [recurrence, setRecurrence] = useState<Recurrence>(todo.recurrence);
  const [tagsText, setTagsText] = useState(todo.tags.join(', '));

  // Đóng bằng phím Esc.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  function save(e: React.FormEvent) {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    onSave(todo.id, {
      title: t,
      notes: notes.trim() || null,
      priority,
      due_date: dueDate || null,
      recurrence: dueDate ? recurrence : 'none',
      tags: tagsText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    });
    onClose();
  }

  // Việc lặp cần due_date làm mốc — xóa hạn thì bỏ luôn lặp.
  function handleDueDateChange(value: string) {
    setDueDate(value);
    if (!value) setRecurrence('none');
  }

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="presentation"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`Sửa việc: ${todo.title}`}
        className="w-full max-w-md rounded-xl border border-border bg-surface p-4 shadow-lg dark:border-border-dark dark:bg-surface-dark"
      >
        <form onSubmit={save} className="flex flex-col gap-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            aria-label="Tiêu đề việc"
            autoFocus
            className={field}
          />
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ghi chú"
            rows={3}
            aria-label="Ghi chú"
            className={field}
          />
          <div className="flex flex-wrap gap-2">
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as Priority)}
              aria-label="Ưu tiên"
              className={field}
            >
              <option value="high">Cao</option>
              <option value="medium">Trung bình</option>
              <option value="low">Thấp</option>
            </select>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => handleDueDateChange(e.target.value)}
              aria-label="Hạn"
              className={field}
            />
            <select
              value={recurrence}
              onChange={(e) => setRecurrence(e.target.value as Recurrence)}
              disabled={!dueDate}
              aria-label="Lặp lại"
              title={!dueDate ? 'Chọn hạn chót trước để bật lặp lại' : undefined}
              className={field}
            >
              <option value="none">Không lặp</option>
              <option value="daily">Hàng ngày</option>
              <option value="weekly">Hàng tuần</option>
              <option value="monthly">Hàng tháng</option>
              <option value="yearly">Hàng năm</option>
            </select>
            <input
              value={tagsText}
              onChange={(e) => setTagsText(e.target.value)}
              placeholder="nhãn, cách nhau dấu phẩy"
              aria-label="Nhãn"
              className={`flex-1 ${field}`}
            />
          </div>
          <div className="mt-1 flex items-center gap-2">
            <button className="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-white transition active:scale-95 dark:bg-primary-dark">
              Lưu
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-border px-3 py-1.5 text-sm transition-colors hover:bg-surface-2 dark:border-border-dark dark:hover:bg-surface-2dark"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={() => {
                onDelete(todo.id);
                onClose();
              }}
              className="ml-auto rounded-lg px-3 py-1.5 text-sm text-text-muted transition hover:bg-red-50 hover:text-red-600 dark:text-text-muted-dark dark:hover:bg-red-950/50 dark:hover:text-red-300"
            >
              Xóa
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

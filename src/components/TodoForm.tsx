import { useState } from 'react';
import type { NewTodo, Priority, Recurrence } from '../types/todo';

const inputClass =
  'rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-text outline-none transition-colors placeholder:text-text-muted focus:border-primary focus:ring-2 focus:ring-primary/30 dark:border-border-dark dark:bg-surface-2dark dark:text-text-dark dark:placeholder:text-text-muted-dark dark:focus:border-primary-dark dark:focus:ring-primary-dark/30';

/** Form thêm việc: tiêu đề + ưu tiên + hạn + nhãn + lặp lại. Nhấn Enter/nút để thêm. */
export function TodoForm({ onAdd }: { onAdd: (t: NewTodo) => void }) {
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [dueDate, setDueDate] = useState('');
  const [tagsText, setTagsText] = useState('');
  const [recurrence, setRecurrence] = useState<Recurrence>('none');

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    const tags = tagsText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    onAdd({ title: t, priority, due_date: dueDate || null, tags, recurrence });
    setTitle('');
    setDueDate('');
    setTagsText('');
    setPriority('medium');
    setRecurrence('none');
  }

  // Việc lặp cần due_date làm mốc tính kỳ sau — xóa hạn thì tự bỏ luôn lặp,
  // để không thể tạo ra tổ hợp "lặp nhưng không có hạn".
  function handleDueDateChange(value: string) {
    setDueDate(value);
    if (!value) setRecurrence('none');
  }

  return (
    <form
      onSubmit={submit}
      className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface p-3 dark:border-border-dark dark:bg-surface-dark"
    >
      <div className="flex h-[22px] w-[22px] flex-none items-center justify-center rounded-md bg-primary-soft text-base font-semibold text-primary dark:bg-primary-soft-dark dark:text-primary-dark">
        ＋
      </div>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Thêm việc nhanh — nhập tiêu đề rồi nhấn Enter"
        aria-label="Tiêu đề việc mới"
        className={`min-w-[12rem] flex-1 ${inputClass}`}
      />
      <select
        value={priority}
        onChange={(e) => setPriority(e.target.value as Priority)}
        className={inputClass}
        aria-label="Ưu tiên"
      >
        <option value="high">Cao</option>
        <option value="medium">Trung bình</option>
        <option value="low">Thấp</option>
      </select>
      <input
        type="date"
        value={dueDate}
        onChange={(e) => handleDueDateChange(e.target.value)}
        className={inputClass}
        aria-label="Hạn"
      />
      <select
        value={recurrence}
        onChange={(e) => setRecurrence(e.target.value as Recurrence)}
        disabled={!dueDate}
        className={inputClass}
        aria-label="Lặp lại"
        title={!dueDate ? 'Chọn hạn chót trước để bật lặp lại' : undefined}
      >
        <option value="none">Không lặp</option>
        <option value="weekly">Hàng tuần</option>
        <option value="monthly">Hàng tháng</option>
        <option value="yearly">Hàng năm</option>
      </select>
      <input
        value={tagsText}
        onChange={(e) => setTagsText(e.target.value)}
        placeholder="nhãn, cách nhau dấu phẩy"
        className={inputClass}
      />
      <button className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:shadow-md active:scale-95 dark:bg-primary-dark dark:shadow-soft-dark dark:hover:shadow-md-dark">
        Thêm
      </button>
    </form>
  );
}

import { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Todo, TodoUpdate, Priority } from '../types/todo';
import { PriorityBadge } from './PriorityBadge';
import { isOverdue } from '../lib/todoFilters';
import { tagColor } from '../lib/tagColor';

interface Props {
  todo: Todo;
  today: string;
  onToggle: (id: string, done: boolean) => void;
  onUpdate: (id: string, patch: TodoUpdate) => void;
  onDelete: (id: string) => void;
}

const editInput =
  'rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-primary dark:border-border-dark dark:bg-surface-2dark dark:text-text-dark';

export function TodoItem({ todo, today, onToggle, onUpdate, onDelete }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: todo.id,
  });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1 };
  const overdue = isOverdue(todo, today);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(todo.title);
  const [priority, setPriority] = useState<Priority>(todo.priority);
  const [dueDate, setDueDate] = useState(todo.due_date ?? '');
  const [tagsText, setTagsText] = useState(todo.tags.join(', '));
  const [notes, setNotes] = useState(todo.notes ?? '');

  function save(e: React.FormEvent) {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    onUpdate(todo.id, {
      title: t,
      priority,
      due_date: dueDate || null,
      notes: notes.trim() || null,
      tags: tagsText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    });
    setEditing(false);
  }

  if (editing) {
    return (
      <li className="rounded-xl border border-border bg-surface p-3 dark:border-border-dark dark:bg-surface-dark">
        <form onSubmit={save} className="flex flex-col gap-2">
          <input value={title} onChange={(e) => setTitle(e.target.value)} className={editInput} />
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ghi chú"
            className={editInput}
          />
          <div className="flex flex-wrap gap-2">
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as Priority)}
              className={editInput}
            >
              <option value="high">Cao</option>
              <option value="medium">Trung bình</option>
              <option value="low">Thấp</option>
            </select>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={editInput} />
            <input
              value={tagsText}
              onChange={(e) => setTagsText(e.target.value)}
              placeholder="nhãn, cách nhau dấu phẩy"
              className={`flex-1 ${editInput}`}
            />
          </div>
          <div className="flex gap-2">
            <button className="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-white">Lưu</button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-lg border border-border px-3 py-1.5 text-sm dark:border-border-dark"
            >
              Hủy
            </button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 rounded-xl border border-border bg-surface px-3 py-[11px] shadow-sm dark:border-border-dark dark:bg-surface-dark"
    >
      {/* Tay cầm kéo — 6 chấm */}
      <button
        {...attributes}
        {...listeners}
        type="button"
        aria-label="Kéo để sắp xếp"
        className="grid flex-none cursor-grab grid-cols-2 gap-[3px]"
      >
        {Array.from({ length: 6 }).map((_, i) => (
          <span key={i} className="h-[3px] w-[3px] rounded-full bg-text-muted opacity-40" />
        ))}
      </button>

      {/* Checkbox tùy biến 20px */}
      <button
        type="button"
        role="checkbox"
        aria-checked={todo.is_done}
        aria-label={todo.is_done ? 'Bỏ đánh dấu hoàn thành' : 'Đánh dấu hoàn thành'}
        onClick={() => onToggle(todo.id, !todo.is_done)}
        className={`flex h-5 w-5 flex-none items-center justify-center rounded-md text-[13px] leading-none ${
          todo.is_done
            ? 'bg-primary text-white'
            : 'border-2 border-border dark:border-border-dark'
        }`}
      >
        {todo.is_done ? '✓' : ''}
      </button>

      <div className="flex min-w-0 flex-1 flex-col gap-[5px]">
        <span
          className={`text-[14.5px] font-medium ${
            todo.is_done
              ? 'text-text-muted line-through opacity-75 dark:text-text-muted-dark'
              : 'text-text dark:text-text-dark'
          }`}
        >
          {todo.title}
        </span>

        <div className="flex flex-wrap items-center gap-2">
          {todo.due_date &&
            (overdue ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-priority-high">
                <span className="h-[5px] w-[5px] rounded-full bg-priority-high" />
                {todo.due_date} (quá hạn)
              </span>
            ) : (
              <span className="text-xs font-medium text-text-muted dark:text-text-muted-dark">
                {todo.due_date}
              </span>
            ))}

          {todo.tags.map((t) => (
            <span
              key={t}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-2 px-2 py-0.5 text-[11.5px] font-medium text-text-muted dark:border-border-dark dark:bg-surface-2dark dark:text-text-muted-dark"
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: tagColor(t) }} />
              {t}
            </span>
          ))}
        </div>
      </div>

      <div className="flex flex-none items-center gap-2">
        <PriorityBadge priority={todo.priority} />
        <button
          onClick={() => setEditing(true)}
          aria-label="Sửa"
          className="flex h-7 w-7 items-center justify-center rounded-md text-sm text-text-muted hover:bg-surface-2 hover:text-text dark:text-text-muted-dark dark:hover:bg-surface-2dark dark:hover:text-text-dark"
        >
          ✎
        </button>
        <button
          onClick={() => onDelete(todo.id)}
          aria-label="Xóa"
          className="flex h-7 w-7 items-center justify-center rounded-md text-[13px] text-text-muted hover:bg-red-50 hover:text-red-600 dark:text-text-muted-dark dark:hover:bg-red-950/50 dark:hover:text-red-300"
        >
          ✕
        </button>
      </div>
    </li>
  );
}

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Todo } from '../types/todo';
import { isOverdue } from '../lib/todoFilters';
import { tagColor } from '../lib/tagColor';

interface Props {
  todo: Todo;
  today: string;
  onToggle: (id: string, done: boolean) => void;
}

/** Thẻ việc trên bảng Kanban (bám KanbanCard.dc.html). Kéo-thả được để đổi cột ưu tiên. */
export function KanbanCard({ todo, today, onToggle }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: todo.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  const overdue = isOverdue(todo, today);

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`surface-card flex cursor-grab flex-col gap-2.5 p-3.5 transition-transform duration-150 ${
        isDragging ? 'scale-105 shadow-lg dark:shadow-lg-dark' : ''
      }`}
    >
      <span
        className={`text-[13.5px] font-semibold leading-snug ${
          todo.is_done
            ? 'text-text-muted line-through opacity-75 dark:text-text-muted-dark'
            : 'text-text dark:text-text-dark'
        }`}
      >
        {todo.title}
      </span>

      {todo.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {todo.tags.map((t) => (
            <span
              key={t}
              className="pill border border-border bg-surface-2 text-text-muted dark:border-border-dark dark:bg-surface-2dark dark:text-text-muted-dark"
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: tagColor(t) }} />
              {t}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 pt-0.5">
        <button
          type="button"
          role="checkbox"
          aria-checked={todo.is_done}
          aria-label={todo.is_done ? 'Bỏ đánh dấu hoàn thành' : 'Đánh dấu hoàn thành'}
          onClick={() => onToggle(todo.id, !todo.is_done)}
          onPointerDown={(e) => e.stopPropagation()}
          className={`flex h-[18px] w-[18px] flex-none items-center justify-center rounded-full text-[11px] leading-none transition-colors duration-150 ${
            todo.is_done
              ? 'bg-primary text-white dark:bg-primary-dark'
              : 'border-2 border-border dark:border-border-dark'
          }`}
        >
          {todo.is_done ? '✓' : ''}
        </button>
        {todo.due_date &&
          (overdue ? (
            <span className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-priority-high">
              <span className="h-[5px] w-[5px] rounded-full bg-priority-high" />
              {todo.due_date} (quá hạn)
            </span>
          ) : (
            <span className="text-[11.5px] font-medium text-text-muted dark:text-text-muted-dark">
              {todo.due_date}
            </span>
          ))}
      </div>
    </div>
  );
}

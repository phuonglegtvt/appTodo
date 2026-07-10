import { dayCellItems } from '../lib/dayCell';
import type { Todo } from '../types/todo';
import { DayPopover } from './DayPopover';

interface Props {
  date: string;
  dayNumber: number;
  todos: Todo[];
  isToday: boolean;
  isOpen: boolean;
  maxLines: number;
  onOpen: () => void;
  onClose: () => void;
  onAdd: (title: string) => void;
  onToggle: (id: string, done: boolean) => void;
  onOpenFull: () => void;
}

/** 1 ô ngày cao (kiểu Google Calendar): số ngày + vài việc; click mở popover. */
export function DayCell({
  date,
  dayNumber,
  todos,
  isToday,
  isOpen,
  maxLines,
  onOpen,
  onClose,
  onAdd,
  onToggle,
  onOpenFull,
}: Props) {
  const { lines, overflow } = dayCellItems(todos, date, maxLines);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Ngày ${dayNumber}, ${todos.length} việc`}
        className={`flex min-h-[6rem] w-full flex-col gap-1 rounded-lg border bg-surface p-1.5 text-left transition-colors hover:border-primary dark:bg-surface-dark dark:hover:border-primary-dark ${
          isToday ? 'border-primary dark:border-primary-dark' : 'border-border dark:border-border-dark'
        }`}
      >
        <span
          className={`text-xs font-semibold ${
            isToday ? 'text-primary dark:text-primary-dark' : 'text-text dark:text-text-dark'
          }`}
        >
          {dayNumber}
        </span>
        <span className="flex flex-col gap-0.5">
          {lines.map((l) => (
            <span
              key={l.id}
              className={`truncate rounded px-1 text-[10px] ${
                l.is_done
                  ? 'text-text-muted line-through dark:text-text-muted-dark'
                  : 'bg-primary-soft text-primary dark:bg-primary-soft-dark dark:text-primary-dark'
              }`}
            >
              {l.title}
            </span>
          ))}
          {overflow > 0 && (
            <span className="px-1 text-[10px] text-text-muted dark:text-text-muted-dark">
              +{overflow} việc
            </span>
          )}
        </span>
      </button>

      {isOpen && (
        <DayPopover
          date={date}
          todos={todos}
          onAdd={onAdd}
          onToggle={onToggle}
          onOpenFull={onOpenFull}
          onClose={onClose}
        />
      )}
    </div>
  );
}

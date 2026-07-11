import type { Todo } from '../types/todo';
import { DayCell } from './DayCell';

export interface DayCellData {
  date: string;
  dayNumber: number;
  todos: Todo[];
}

interface Props {
  leadingBlanks: number;
  cells: DayCellData[];
  today: string;
  maxLines: number;
  onAdd: (date: string, title: string) => void;
  onToggle: (id: string, done: boolean) => void;
  onDelete: (id: string) => void;
  onOpenFull: (date: string) => void;
}

/** Lưới ngày kiểu Google Calendar cho tầng Tháng/Tuần (7 cột). */
export function DayGrid({ leadingBlanks, cells, today, maxLines, onAdd, onToggle, onDelete, onOpenFull }: Props) {
  return (
    <div className="grid grid-cols-7 gap-1.5">
      {Array.from({ length: leadingBlanks }).map((_, i) => (
        <div key={`blank-${i}`} />
      ))}
      {cells.map((c) => (
        <DayCell
          key={c.date}
          date={c.date}
          dayNumber={c.dayNumber}
          todos={c.todos}
          isToday={c.date === today}
          maxLines={maxLines}
          onAdd={(title) => onAdd(c.date, title)}
          onToggle={onToggle}
          onDelete={onDelete}
          onOpenFull={() => onOpenFull(c.date)}
        />
      ))}
    </div>
  );
}

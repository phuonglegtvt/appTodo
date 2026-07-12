import type { Todo } from '../types/todo';
import { getChildPeriods, getPeriodRange } from './goalFilters';
import type { Horizon } from '../types/goal';
import { sortByDoneThenOrder } from './todoFilters';
import { occurrenceDatesInRange } from './recurringOccurrences';

export interface TodoCellData {
  key: string; // 'YYYY-MM' (ô tháng) | 'YYYY' (ô năm)
  label: string; // 'Tháng 08' | 'Năm 2026'
  todos: Todo[]; // todo trong kỳ, đã sort việc-chưa-xong-trước
  doneCount: number;
  totalCount: number;
}

/** Dựng 1 ô gom: việc thường lọc theo kỳ; việc lặp gộp thành 1 đại diện/kỳ. */
function cellFrom(todos: Todo[], childHorizon: Horizon, key: string, label: string): TodoCellData {
  const { start, end } = getPeriodRange(childHorizon, key);
  const items: Todo[] = [];
  for (const t of todos) {
    if (t.recurrence !== 'none' && t.due_date) {
      const dates = occurrenceDatesInRange(t.due_date, t.recurrence, start, end);
      if (dates.length > 0) {
        items.push({
          ...t,
          id: `${t.id}::P${key}`,
          due_date: dates[0],
          is_done: dates.every((d) => t.completed_dates.includes(d)),
        });
      }
    } else if (t.due_date !== null && t.due_date >= start && t.due_date <= end) {
      items.push(t);
    }
  }
  const sorted = sortByDoneThenOrder(items);
  return {
    key,
    label,
    todos: sorted,
    doneCount: sorted.filter((t) => t.is_done).length,
    totalCount: sorted.length,
  };
}

/** 12 ô tháng của một năm (chế độ Năm). */
export function buildMonthCells(todos: Todo[], yearPeriodKey: string): TodoCellData[] {
  return getChildPeriods('year', yearPeriodKey).map((key) =>
    cellFrom(todos, 'month', key, `Tháng ${key.slice(5)}`),
  );
}

/** 5 ô năm của một khối 5 năm (chế độ 5 Năm). */
export function buildYearCells(todos: Todo[], fiveYearKey: string): TodoCellData[] {
  return getChildPeriods('five_year', fiveYearKey).map((key) =>
    cellFrom(todos, 'year', key, `Năm ${key}`),
  );
}

export interface VisibleTodos {
  visible: Todo[];
  overflow: number;
}

/** Cắt còn `max` dòng khi chưa mở rộng; phần dư gộp vào overflow. */
export function visibleTodos(todos: Todo[], expanded: boolean, max = 6): VisibleTodos {
  if (expanded || todos.length <= max) return { visible: todos, overflow: 0 };
  return { visible: todos.slice(0, max), overflow: todos.length - max };
}

/** 'YYYY-MM-DD' → 'dd/mm'; null → ''. */
export function formatDayMonth(dueDate: string | null): string {
  if (!dueDate) return '';
  return `${dueDate.slice(8, 10)}/${dueDate.slice(5, 7)}`;
}

import type { Todo } from '../types/todo';
import { getChildPeriods, getPeriodRange } from './goalFilters';
import { sortByDoneThenOrder } from './todoFilters';

export interface MonthCellData {
  key: string; // 'YYYY-MM'
  monthLabel: string; // 'Tháng MM'
  todos: Todo[]; // todo trong tháng, đã sort việc-chưa-xong-trước
  doneCount: number;
  totalCount: number;
}

/** Dựng dữ liệu 12 ô tháng của một năm cho chế độ xem Năm. */
export function buildMonthCells(todos: Todo[], yearPeriodKey: string): MonthCellData[] {
  return getChildPeriods('year', yearPeriodKey).map((key) => {
    const { start, end } = getPeriodRange('month', key);
    const inMonth = todos.filter(
      (t) => t.due_date !== null && t.due_date >= start && t.due_date <= end,
    );
    const sorted = sortByDoneThenOrder(inMonth);
    return {
      key,
      monthLabel: `Tháng ${key.slice(5)}`,
      todos: sorted,
      doneCount: sorted.filter((t) => t.is_done).length,
      totalCount: sorted.length,
    };
  });
}

export interface VisibleTodos {
  visible: Todo[];
  overflow: number;
}

/**
 * Việc để hiển thị trong ô tháng: khi chưa mở rộng cắt còn `max` dòng, phần dư
 * gộp vào `overflow`; khi đã mở rộng hiện hết. Giữ nguyên thứ tự đầu vào.
 */
export function visibleTodos(todos: Todo[], expanded: boolean, max = 6): VisibleTodos {
  if (expanded || todos.length <= max) return { visible: todos, overflow: 0 };
  return { visible: todos.slice(0, max), overflow: todos.length - max };
}

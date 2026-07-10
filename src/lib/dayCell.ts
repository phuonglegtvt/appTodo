import type { Todo } from '../types/todo';

export interface DayCellLine {
  id: string;
  title: string;
  is_done: boolean;
}

export interface DayCellItems {
  lines: DayCellLine[];
  overflow: number;
}

/**
 * Việc của một ngày để hiển thị trong ô lịch: lấy tối đa `max` dòng đầu,
 * phần dư gộp vào `overflow`. Giữ nguyên thứ tự đầu vào (đã sắp ở nơi gọi).
 */
export function dayCellItems(todos: Todo[], date: string, max: number): DayCellItems {
  const onDate = todos.filter((t) => t.due_date === date);
  const lines = onDate
    .slice(0, max)
    .map((t) => ({ id: t.id, title: t.title, is_done: t.is_done }));
  return { lines, overflow: Math.max(0, onDate.length - max) };
}

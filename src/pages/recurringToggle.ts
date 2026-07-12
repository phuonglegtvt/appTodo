import type { Todo, TodoUpdate } from '../types/todo';
import { toggleDateInList } from '../lib/recurringOccurrences';

/**
 * Tick việc lặp trong list phẳng: bật/tắt hoàn thành cho ngày bắt đầu (due_date)
 * qua completed_dates. Không đụng is_done (việc lặp done suy từ completed_dates).
 */
export function recurringToggle(todo: Todo, onUpdate: (id: string, patch: TodoUpdate) => void): void {
  if (!todo.due_date) return;
  onUpdate(todo.id, { completed_dates: toggleDateInList(todo.completed_dates, todo.due_date) });
}

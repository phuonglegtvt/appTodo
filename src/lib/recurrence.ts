import type { NewTodo, Recurrence, Todo } from '../types/todo';

/** Ngày đến hạn kế tiếp cho một kỳ lặp, tính từ ngày đến hạn hiện tại. */
export function nextDueDate(dueDate: string, recurrence: Recurrence): string {
  const [year, month, day] = dueDate.split('-').map(Number);
  switch (recurrence) {
    case 'weekly':
      return addDays(year, month, day, 7);
    case 'monthly':
      return addMonths(year, month, day, 1);
    case 'yearly':
      return addMonths(year, month, day, 12);
    case 'none':
      return dueDate;
  }
}

function addDays(year: number, month: number, day: number, days: number): string {
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return toDateString(date);
}

/**
 * Cộng thêm `months` tháng; nếu ngày gốc không tồn tại ở tháng đích (VD 31/1
 * cộng 1 tháng → tháng 2 không có ngày 31) thì dồn về ngày cuối tháng đó.
 */
function addMonths(year: number, month: number, day: number, months: number): string {
  const totalMonths = month - 1 + months;
  const targetYear = year + Math.floor(totalMonths / 12);
  const targetMonth = ((totalMonths % 12) + 12) % 12;
  const lastDayOfTargetMonth = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const clampedDay = Math.min(day, lastDayOfTargetMonth);
  return toDateString(new Date(Date.UTC(targetYear, targetMonth, clampedDay)));
}

function toDateString(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Dữ liệu để tạo việc cho kỳ lặp tiếp theo, dựa trên việc của kỳ hiện tại. */
export function buildNextOccurrence(todo: Todo): NewTodo {
  if (!todo.due_date) {
    throw new Error('Việc lặp phải có hạn chót để tính kỳ tiếp theo.');
  }
  return {
    title: todo.title,
    notes: todo.notes,
    due_date: nextDueDate(todo.due_date, todo.recurrence),
    priority: todo.priority,
    tags: todo.tags,
    recurrence: todo.recurrence,
  };
}

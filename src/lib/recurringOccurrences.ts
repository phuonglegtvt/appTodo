import type { Recurrence, Todo } from '../types/todo';
import { nextDueDate } from './recurrence';

export type OccurrenceRef =
  | { templateId: string; kind: 'day'; date: string }
  | { templateId: string; kind: 'period'; periodKey: string };

/** Tách id occurrence ảo. 'id::YYYY-MM-DD' → day; 'id::P<key>' → period; không '::' → null. */
export function parseOccurrenceId(id: string): OccurrenceRef | null {
  const sep = id.indexOf('::');
  if (sep === -1) return null;
  const templateId = id.slice(0, sep);
  const rest = id.slice(sep + 2);
  if (rest.startsWith('P')) return { templateId, kind: 'period', periodKey: rest.slice(1) };
  return { templateId, kind: 'day', date: rest };
}

/** Thêm ngày nếu vắng, bớt nếu có; luôn trả mảng đã sắp xếp tăng dần. */
export function toggleDateInList(dates: string[], date: string): string[] {
  const set = new Set(dates);
  if (set.has(date)) set.delete(date);
  else set.add(date);
  return [...set].sort();
}

/** Mọi ngày của chuỗi lặp trong [rangeStart, rangeEnd], bắt đầu từ startDate. */
export function occurrenceDatesInRange(
  startDate: string,
  recurrence: Recurrence,
  rangeStart: string,
  rangeEnd: string,
): string[] {
  if (recurrence === 'none') {
    return startDate >= rangeStart && startDate <= rangeEnd ? [startDate] : [];
  }
  const out: string[] = [];
  let d = startDate;
  while (d < rangeStart) d = nextDueDate(d, recurrence); // bỏ kỳ trước khoảng
  while (d <= rangeEnd) {
    out.push(d);
    d = nextDueDate(d, recurrence);
  }
  return out;
}

/** Thay template lặp bằng occurrence ảo trong khoảng; việc thường giữ nguyên. */
export function expandRecurring(todos: Todo[], rangeStart: string, rangeEnd: string): Todo[] {
  const out: Todo[] = [];
  for (const t of todos) {
    if (t.recurrence === 'none' || !t.due_date) {
      out.push(t);
      continue;
    }
    for (const date of occurrenceDatesInRange(t.due_date, t.recurrence, rangeStart, rangeEnd)) {
      out.push({ ...t, id: `${t.id}::${date}`, due_date: date, is_done: t.completed_dates.includes(date) });
    }
  }
  return out;
}

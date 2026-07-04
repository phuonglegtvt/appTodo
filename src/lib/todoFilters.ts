import type { Todo, Priority, SmartView } from '../types/todo';

/** Tìm theo từ khóa trong tiêu đề (không phân biệt hoa thường). */
export function searchTodos(todos: Todo[], query: string): Todo[] {
  const q = query.trim().toLowerCase();
  if (!q) return todos;
  return todos.filter((t) => t.title.toLowerCase().includes(q));
}

/** Lọc theo mức ưu tiên; 'all' trả tất cả. */
export function filterByPriority(todos: Todo[], priority: Priority | 'all'): Todo[] {
  if (priority === 'all') return todos;
  return todos.filter((t) => t.priority === priority);
}

/** Lọc theo tag; null trả tất cả. */
export function filterByTag(todos: Todo[], tag: string | null): Todo[] {
  if (!tag) return todos;
  return todos.filter((t) => t.tags.includes(tag));
}

/** Sắp xếp tăng dần theo sort_order (không đổi mảng gốc). */
export function sortByOrder(todos: Todo[]): Todo[] {
  return [...todos].sort((a, b) => a.sort_order - b.sort_order);
}

/** Việc quá hạn: chưa xong và due_date trước hôm nay (today dạng 'YYYY-MM-DD'). */
export function isOverdue(todo: Todo, today: string): boolean {
  if (todo.is_done || !todo.due_date) return false;
  return todo.due_date < today;
}

/** Áp smart view. today là chuỗi 'YYYY-MM-DD' để dễ test. */
export function applySmartView(todos: Todo[], view: SmartView, today: string): Todo[] {
  switch (view) {
    case 'all':
      return todos;
    case 'done':
      return todos.filter((t) => t.is_done);
    case 'today':
      return todos.filter((t) => !t.is_done && t.due_date !== null && t.due_date <= today);
    case 'upcoming':
      return todos.filter((t) => !t.is_done && t.due_date !== null && t.due_date > today);
  }
}

/** Danh sách tag duy nhất trong toàn bộ việc, đã sắp xếp. */
export function allTags(todos: Todo[]): string[] {
  const set = new Set<string>();
  for (const t of todos) for (const tag of t.tags) set.add(tag);
  return [...set].sort();
}

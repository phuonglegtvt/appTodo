import { describe, it, expect } from 'vitest';
import type { Todo } from '../types/todo';
import {
  searchTodos,
  filterByPriority,
  filterByTag,
  sortByOrder,
  sortByDoneThenOrder,
  isOverdue,
  applySmartView,
  allTags,
} from './todoFilters';

function makeTodo(over: Partial<Todo>): Todo {
  return {
    id: over.id ?? crypto.randomUUID(),
    user_id: 'u1',
    title: over.title ?? 'Việc',
    notes: null,
    is_done: over.is_done ?? false,
    due_date: over.due_date ?? null,
    priority: over.priority ?? 'medium',
    tags: over.tags ?? [],
    recurrence: over.recurrence ?? 'none',
    sort_order: over.sort_order ?? 0,
    created_at: '2026-07-01T00:00:00Z',
    updated_at: '2026-07-01T00:00:00Z',
  };
}

describe('searchTodos', () => {
  const todos = [makeTodo({ title: 'Mua sữa' }), makeTodo({ title: 'Học React' })];
  it('không có từ khóa thì trả nguyên danh sách', () => {
    expect(searchTodos(todos, '  ')).toHaveLength(2);
  });
  it('tìm không phân biệt hoa thường', () => {
    expect(searchTodos(todos, 'react')).toHaveLength(1);
    expect(searchTodos(todos, 'react')[0].title).toBe('Học React');
  });
});

describe('filterByPriority', () => {
  const todos = [makeTodo({ priority: 'high' }), makeTodo({ priority: 'low' })];
  it('"all" trả tất cả', () => {
    expect(filterByPriority(todos, 'all')).toHaveLength(2);
  });
  it('lọc đúng mức ưu tiên', () => {
    expect(filterByPriority(todos, 'high')).toHaveLength(1);
  });
});

describe('filterByTag', () => {
  const todos = [makeTodo({ tags: ['nhà'] }), makeTodo({ tags: ['việc'] })];
  it('null trả tất cả', () => {
    expect(filterByTag(todos, null)).toHaveLength(2);
  });
  it('lọc theo tag', () => {
    expect(filterByTag(todos, 'nhà')).toHaveLength(1);
  });
});

describe('sortByOrder', () => {
  it('sắp xếp tăng dần theo sort_order, không đổi mảng gốc', () => {
    const todos = [makeTodo({ sort_order: 2 }), makeTodo({ sort_order: 1 })];
    const sorted = sortByOrder(todos);
    expect(sorted.map((t) => t.sort_order)).toEqual([1, 2]);
    expect(todos[0].sort_order).toBe(2); // gốc không đổi
  });
});

describe('sortByDoneThenOrder', () => {
  it('việc chưa xong lên trên, việc đã xong xuống dưới', () => {
    const todos = [
      makeTodo({ id: 'done1', is_done: true, sort_order: 1 }),
      makeTodo({ id: 'todo1', is_done: false, sort_order: 2 }),
    ];
    expect(sortByDoneThenOrder(todos).map((t) => t.id)).toEqual(['todo1', 'done1']);
  });

  it('trong mỗi nhóm giữ thứ tự theo sort_order', () => {
    const todos = [
      makeTodo({ id: 'done-b', is_done: true, sort_order: 4 }),
      makeTodo({ id: 'todo-b', is_done: false, sort_order: 3 }),
      makeTodo({ id: 'done-a', is_done: true, sort_order: 2 }),
      makeTodo({ id: 'todo-a', is_done: false, sort_order: 1 }),
    ];
    expect(sortByDoneThenOrder(todos).map((t) => t.id)).toEqual([
      'todo-a',
      'todo-b',
      'done-a',
      'done-b',
    ]);
  });

  it('không đổi mảng gốc', () => {
    const todos = [
      makeTodo({ id: 'done1', is_done: true, sort_order: 1 }),
      makeTodo({ id: 'todo1', is_done: false, sort_order: 2 }),
    ];
    sortByDoneThenOrder(todos);
    expect(todos.map((t) => t.id)).toEqual(['done1', 'todo1']);
  });
});

describe('isOverdue', () => {
  it('quá hạn khi chưa xong và due_date < hôm nay', () => {
    expect(isOverdue(makeTodo({ due_date: '2026-07-01' }), '2026-07-04')).toBe(true);
  });
  it('không quá hạn nếu đã xong', () => {
    expect(isOverdue(makeTodo({ due_date: '2026-07-01', is_done: true }), '2026-07-04')).toBe(false);
  });
  it('không có due_date thì không quá hạn', () => {
    expect(isOverdue(makeTodo({ due_date: null }), '2026-07-04')).toBe(false);
  });
});

describe('applySmartView', () => {
  const today = '2026-07-04';
  const overdue = makeTodo({ id: 'a', due_date: '2026-07-01' });
  const dueToday = makeTodo({ id: 'b', due_date: '2026-07-04' });
  const future = makeTodo({ id: 'c', due_date: '2026-07-10' });
  const noDate = makeTodo({ id: 'd', due_date: null });
  const done = makeTodo({ id: 'e', due_date: '2026-07-02', is_done: true });
  const todos = [overdue, dueToday, future, noDate, done];

  it('"today" gồm việc đến hạn hôm nay và quá hạn, chưa xong', () => {
    const ids = applySmartView(todos, 'today', today).map((t) => t.id).sort();
    expect(ids).toEqual(['a', 'b']);
  });
  it('"upcoming" gồm việc có hạn trong tương lai, chưa xong', () => {
    expect(applySmartView(todos, 'upcoming', today).map((t) => t.id)).toEqual(['c']);
  });
  it('"done" chỉ việc đã xong', () => {
    expect(applySmartView(todos, 'done', today).map((t) => t.id)).toEqual(['e']);
  });
  it('"all" gồm việc chưa xong, không gồm việc đã xong', () => {
    const ids = applySmartView(todos, 'all', today).map((t) => t.id).sort();
    expect(ids).toEqual(['a', 'b', 'c', 'd']);
  });
});

describe('allTags', () => {
  it('gộp tag duy nhất, đã sắp xếp', () => {
    const todos = [makeTodo({ tags: ['b', 'a'] }), makeTodo({ tags: ['a', 'c'] })];
    expect(allTags(todos)).toEqual(['a', 'b', 'c']);
  });
});

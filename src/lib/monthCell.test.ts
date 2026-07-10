import { describe, it, expect } from 'vitest';
import { buildMonthCells, visibleTodos } from './monthCell';
import type { Todo } from '../types/todo';

function todo(partial: Partial<Todo>): Todo {
  return {
    id: 'id',
    user_id: 'u',
    title: 't',
    notes: null,
    is_done: false,
    due_date: null,
    priority: 'medium',
    tags: [],
    recurrence: 'none',
    sort_order: 0,
    created_at: '',
    updated_at: '',
    ...partial,
  };
}

describe('buildMonthCells', () => {
  it('trả về 12 tháng với nhãn "Tháng MM" theo thứ tự 01→12', () => {
    const cells = buildMonthCells([], '2026');
    expect(cells).toHaveLength(12);
    expect(cells[0].key).toBe('2026-01');
    expect(cells[0].monthLabel).toBe('Tháng 01');
    expect(cells[11].key).toBe('2026-12');
    expect(cells[11].monthLabel).toBe('Tháng 12');
  });

  it('gom todo vào đúng tháng theo due_date, kể cả biên đầu/cuối tháng', () => {
    const todos = [
      todo({ id: 'a', due_date: '2026-01-01' }), // biên đầu
      todo({ id: 'b', due_date: '2026-01-31' }), // biên cuối
      todo({ id: 'c', due_date: '2026-02-15' }),
    ];
    const cells = buildMonthCells(todos, '2026');
    expect(cells[0].todos.map((t) => t.id)).toEqual(['a', 'b']);
    expect(cells[0].totalCount).toBe(2);
    expect(cells[1].todos.map((t) => t.id)).toEqual(['c']);
  });

  it('todo due_date = null không rơi vào tháng nào', () => {
    const cells = buildMonthCells([todo({ id: 'x', due_date: null })], '2026');
    expect(cells.every((c) => c.totalCount === 0)).toBe(true);
  });

  it('đếm doneCount/totalCount đúng', () => {
    const todos = [
      todo({ id: 'a', due_date: '2026-03-05', is_done: true }),
      todo({ id: 'b', due_date: '2026-03-06', is_done: false }),
      todo({ id: 'c', due_date: '2026-03-07', is_done: true }),
    ];
    const march = buildMonthCells(todos, '2026')[2];
    expect(march.totalCount).toBe(3);
    expect(march.doneCount).toBe(2);
  });

  it('sắp việc chưa xong lên trước, đã xong xuống sau', () => {
    const todos = [
      todo({ id: 'done', due_date: '2026-04-01', is_done: true, sort_order: 1 }),
      todo({ id: 'open', due_date: '2026-04-02', is_done: false, sort_order: 2 }),
    ];
    const april = buildMonthCells(todos, '2026')[3];
    expect(april.todos.map((t) => t.id)).toEqual(['open', 'done']);
  });
});

describe('visibleTodos', () => {
  const list = Array.from({ length: 8 }, (_, i) =>
    todo({ id: String(i), due_date: '2026-05-01' }),
  );

  it('≤ max → hiện hết, overflow 0', () => {
    const three = list.slice(0, 3);
    expect(visibleTodos(three, false)).toEqual({ visible: three, overflow: 0 });
  });

  it('> max, chưa mở rộng → cắt còn max, overflow = phần dư', () => {
    const res = visibleTodos(list, false);
    expect(res.visible).toHaveLength(6);
    expect(res.overflow).toBe(2);
  });

  it('> max, đã mở rộng → hiện hết, overflow 0', () => {
    const res = visibleTodos(list, true);
    expect(res.visible).toHaveLength(8);
    expect(res.overflow).toBe(0);
  });
});

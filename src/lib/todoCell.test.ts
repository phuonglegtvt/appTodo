import { describe, it, expect } from 'vitest';
import { buildMonthCells, buildYearCells, visibleTodos, formatDayMonth } from './todoCell';
import type { Todo } from '../types/todo';

function todo(partial: Partial<Todo>): Todo {
  return {
    id: 'id', user_id: 'u', title: 't', notes: null, is_done: false,
    due_date: null, priority: 'medium', tags: [], recurrence: 'none',
    completed_dates: [],
    sort_order: 0, created_at: '', updated_at: '', ...partial,
  };
}

describe('buildMonthCells', () => {
  it('trả 12 tháng nhãn "Tháng MM" theo thứ tự 01→12', () => {
    const cells = buildMonthCells([], '2026');
    expect(cells).toHaveLength(12);
    expect(cells[0].key).toBe('2026-01');
    expect(cells[0].label).toBe('Tháng 01');
    expect(cells[11].label).toBe('Tháng 12');
  });

  it('gom todo vào đúng tháng theo due_date, kể cả biên đầu/cuối', () => {
    const todos = [
      todo({ id: 'a', due_date: '2026-01-01' }),
      todo({ id: 'b', due_date: '2026-01-31' }),
      todo({ id: 'c', due_date: '2026-02-15' }),
    ];
    const cells = buildMonthCells(todos, '2026');
    expect(cells[0].todos.map((t) => t.id)).toEqual(['a', 'b']);
    expect(cells[0].totalCount).toBe(2);
    expect(cells[1].todos.map((t) => t.id)).toEqual(['c']);
  });

  it('due_date=null không rơi vào tháng nào; đếm done/total; việc chưa xong lên trước', () => {
    expect(buildMonthCells([todo({ due_date: null })], '2026').every((c) => c.totalCount === 0)).toBe(true);
    const march = buildMonthCells(
      [
        todo({ id: 'a', due_date: '2026-03-05', is_done: true }),
        todo({ id: 'b', due_date: '2026-03-06', is_done: false }),
      ],
      '2026',
    )[2];
    expect(march.totalCount).toBe(2);
    expect(march.doneCount).toBe(1);
    expect(march.todos.map((t) => t.id)).toEqual(['b', 'a']);
  });

  it('việc lặp daily hiện 1 đại diện/kỳ trong ô tháng, id có ::P', () => {
    const daily = todo({ id: 'd1', due_date: '2026-01-05', recurrence: 'daily', completed_dates: [] });
    const cells = buildMonthCells([daily], '2026');
    const march = cells.find((c) => c.key === '2026-03')!;
    expect(march.todos).toHaveLength(1);
    expect(march.todos[0].id).toBe('d1::P2026-03');
    expect(march.totalCount).toBe(1);
  });

  it('đại diện kỳ is_done = mọi occurrence trong kỳ đã xong', () => {
    // Tháng 2/2026 có 28 ngày; đánh dấu xong đủ 28 ngày.
    const all = Array.from({ length: 28 }, (_, i) => `2026-02-${String(i + 1).padStart(2, '0')}`);
    const daily = todo({ id: 'd1', due_date: '2026-01-05', recurrence: 'daily', completed_dates: all });
    const cells = buildMonthCells([daily], '2026');
    const feb = cells.find((c) => c.key === '2026-02')!;
    expect(feb.todos[0].is_done).toBe(true);
  });
});

describe('buildYearCells', () => {
  it('trả 5 năm nhãn "Năm YYYY" theo thứ tự', () => {
    const cells = buildYearCells([], '2025');
    expect(cells).toHaveLength(5);
    expect(cells[0].key).toBe('2025');
    expect(cells[0].label).toBe('Năm 2025');
    expect(cells[4].key).toBe('2029');
  });

  it('gom todo vào đúng năm theo due_date, kể cả biên đầu/cuối năm', () => {
    const todos = [
      todo({ id: 'a', due_date: '2025-01-01' }),
      todo({ id: 'b', due_date: '2025-12-31' }),
      todo({ id: 'c', due_date: '2026-06-15' }),
    ];
    const cells = buildYearCells(todos, '2025');
    expect(cells[0].todos.map((t) => t.id)).toEqual(['a', 'b']);
    expect(cells[1].todos.map((t) => t.id)).toEqual(['c']);
  });

  it('đếm done/total trong năm; việc chưa xong lên trước', () => {
    const year = buildYearCells(
      [
        todo({ id: 'a', due_date: '2025-03-05', is_done: true, sort_order: 1 }),
        todo({ id: 'b', due_date: '2025-02-01', is_done: false, sort_order: 0 }),
      ],
      '2025',
    )[0];
    expect(year.totalCount).toBe(2);
    expect(year.doneCount).toBe(1);
    expect(year.todos.map((t) => t.id)).toEqual(['b', 'a']);
  });
});

describe('formatDayMonth', () => {
  it('YYYY-MM-DD → dd/mm', () => {
    expect(formatDayMonth('2026-08-05')).toBe('05/08');
    expect(formatDayMonth('2026-12-31')).toBe('31/12');
  });
  it('null → chuỗi rỗng', () => {
    expect(formatDayMonth(null)).toBe('');
  });
});

describe('visibleTodos', () => {
  const list = Array.from({ length: 8 }, (_, i) => todo({ id: String(i), due_date: '2026-05-01' }));
  it('≤ max → hiện hết, overflow 0', () => {
    const three = list.slice(0, 3);
    expect(visibleTodos(three, false)).toEqual({ visible: three, overflow: 0 });
  });
  it('> max chưa mở → cắt còn 6, overflow 2', () => {
    const res = visibleTodos(list, false);
    expect(res.visible).toHaveLength(6);
    expect(res.overflow).toBe(2);
  });
  it('> max đã mở → hiện hết', () => {
    expect(visibleTodos(list, true).overflow).toBe(0);
  });
});

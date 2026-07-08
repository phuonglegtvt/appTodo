import { describe, it, expect } from 'vitest';
import { getPeriodRange, getPeriodKey, getChildPeriods, countTodosInRange, shiftPeriod } from './goalFilters';
import type { Todo } from '../types/todo';

describe('getPeriodRange', () => {
  it('year: cả năm từ 01/01 đến 31/12', () => {
    expect(getPeriodRange('year', '2026')).toEqual({ start: '2026-01-01', end: '2026-12-31' });
  });

  it('month: tháng thường', () => {
    expect(getPeriodRange('month', '2026-07')).toEqual({ start: '2026-07-01', end: '2026-07-31' });
  });

  it('month: tháng 2 năm nhuận có 29 ngày', () => {
    expect(getPeriodRange('month', '2028-02')).toEqual({ start: '2028-02-01', end: '2028-02-29' });
  });

  it('month: tháng 2 năm thường có 28 ngày', () => {
    expect(getPeriodRange('month', '2026-02')).toEqual({ start: '2026-02-01', end: '2026-02-28' });
  });

  it('five_year: khối 5 năm từ period_key là năm đầu khối', () => {
    expect(getPeriodRange('five_year', '2025')).toEqual({ start: '2025-01-01', end: '2029-12-31' });
    expect(getPeriodRange('five_year', '2030')).toEqual({ start: '2030-01-01', end: '2034-12-31' });
  });

  it('week: tuần ISO bình thường (tuần 28/2026 chứa 07/07/2026, Thứ Ba)', () => {
    expect(getPeriodRange('week', '2026-W28')).toEqual({ start: '2026-07-06', end: '2026-07-12' });
  });

  it('week: tuần cuối năm ISO có thể lấn sang năm sau (tuần 53/2026)', () => {
    expect(getPeriodRange('week', '2026-W53')).toEqual({ start: '2026-12-28', end: '2027-01-03' });
  });
});

describe('getPeriodKey', () => {
  it('year: lấy đúng năm', () => {
    expect(getPeriodKey('year', '2026-07-15')).toBe('2026');
  });

  it('month: lấy đúng năm-tháng', () => {
    expect(getPeriodKey('month', '2026-07-15')).toBe('2026-07');
  });

  it('five_year: quy về năm đầu khối 5 năm', () => {
    expect(getPeriodKey('five_year', '2026-07-15')).toBe('2025');
  });

  it('five_year: ranh giới khối — 2029 và 2030 phải khác khối', () => {
    expect(getPeriodKey('five_year', '2029-12-31')).toBe('2025');
    expect(getPeriodKey('five_year', '2030-01-01')).toBe('2030');
  });

  it('week: ngày giữa tuần (07/07/2026 thuộc tuần 28)', () => {
    expect(getPeriodKey('week', '2026-07-07')).toBe('2026-W28');
  });

  it('week: ca biên cuối năm — 01/01/2027 vẫn thuộc tuần 53 của năm ISO 2026', () => {
    expect(getPeriodKey('week', '2027-01-01')).toBe('2026-W53');
  });

  it('round-trip: getPeriodRange và getPeriodKey khớp nhau cho tuần', () => {
    const key = getPeriodKey('week', '2026-07-07');
    const range = getPeriodRange('week', key);
    expect(getPeriodKey('week', range.start)).toBe(key);
    expect(getPeriodKey('week', range.end)).toBe(key);
  });
});

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

describe('getChildPeriods', () => {
  it('five_year: ra đúng 5 năm liên tiếp', () => {
    expect(getChildPeriods('five_year', '2025')).toEqual(['2025', '2026', '2027', '2028', '2029']);
  });

  it('year: ra đúng 12 tháng', () => {
    const months = getChildPeriods('year', '2026');
    expect(months).toHaveLength(12);
    expect(months[0]).toBe('2026-01');
    expect(months[11]).toBe('2026-12');
  });

  it('month: ra đúng số ngày trong tháng (năm nhuận, 29 ngày)', () => {
    const days = getChildPeriods('month', '2028-02');
    expect(days).toHaveLength(29);
    expect(days[0]).toBe('2028-02-01');
    expect(days[28]).toBe('2028-02-29');
  });

  it('month: ra đúng số ngày trong tháng (năm thường, 28 ngày)', () => {
    expect(getChildPeriods('month', '2026-02')).toHaveLength(28);
  });

  it('week: ra đúng 7 ngày Thứ Hai đến Chủ Nhật', () => {
    expect(getChildPeriods('week', '2026-W28')).toEqual([
      '2026-07-06',
      '2026-07-07',
      '2026-07-08',
      '2026-07-09',
      '2026-07-10',
      '2026-07-11',
      '2026-07-12',
    ]);
  });
});

describe('countTodosInRange', () => {
  it('đếm đúng done/total, bỏ qua việc ngoài khoảng và việc không có hạn', () => {
    const todos = [
      makeTodo({ id: 'a', due_date: '2026-07-05', is_done: true }),
      makeTodo({ id: 'b', due_date: '2026-07-10', is_done: false }),
      makeTodo({ id: 'c', due_date: '2026-08-01', is_done: false }),
      makeTodo({ id: 'd', due_date: null }),
    ];
    expect(countTodosInRange(todos, '2026-07-01', '2026-07-31')).toEqual({ done: 1, total: 2 });
  });
});

describe('shiftPeriod', () => {
  it('year: +1/-1 năm', () => {
    expect(shiftPeriod('year', '2026', 1)).toBe('2027');
    expect(shiftPeriod('year', '2026', -1)).toBe('2025');
  });

  it('month: qua ranh giới năm', () => {
    expect(shiftPeriod('month', '2026-12', 1)).toBe('2027-01');
    expect(shiftPeriod('month', '2026-01', -1)).toBe('2025-12');
  });

  it('five_year: nhảy nguyên khối 5 năm', () => {
    expect(shiftPeriod('five_year', '2025', 1)).toBe('2030');
  });

  it('week: qua ranh giới năm ISO (tuần 53/2026 -> tuần 1/2027)', () => {
    expect(shiftPeriod('week', '2026-W53', 1)).toBe('2027-W01');
  });

  it('week: đi tới rồi quay lại đúng kỳ ban đầu', () => {
    const key = '2026-W28';
    expect(shiftPeriod('week', shiftPeriod('week', key, 1), -1)).toBe(key);
  });
});

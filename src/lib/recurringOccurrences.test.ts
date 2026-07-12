import { describe, expect, it } from 'vitest';
import {
  occurrenceDatesInRange,
  expandRecurring,
  parseOccurrenceId,
  toggleDateInList,
} from './recurringOccurrences';
import type { Todo } from '../types/todo';

function todo(p: Partial<Todo>): Todo {
  return {
    id: 't1', user_id: 'u', title: 'Uống thuốc', notes: null, is_done: false,
    due_date: '2026-07-12', priority: 'medium', tags: [], recurrence: 'daily',
    completed_dates: [], sort_order: 0, created_at: '', updated_at: '', ...p,
  };
}

describe('occurrenceDatesInRange', () => {
  it('daily: mọi ngày trong khoảng, từ startDate', () => {
    expect(occurrenceDatesInRange('2026-07-12', 'daily', '2026-07-12', '2026-07-15')).toEqual([
      '2026-07-12', '2026-07-13', '2026-07-14', '2026-07-15',
    ]);
  });

  it('bỏ các ngày trước startDate dù khoảng bắt đầu sớm hơn', () => {
    expect(occurrenceDatesInRange('2026-07-14', 'daily', '2026-07-12', '2026-07-15')).toEqual([
      '2026-07-14', '2026-07-15',
    ]);
  });

  it('weekly: bước 7 ngày', () => {
    expect(occurrenceDatesInRange('2026-07-01', 'weekly', '2026-07-01', '2026-07-31')).toEqual([
      '2026-07-01', '2026-07-08', '2026-07-15', '2026-07-22', '2026-07-29',
    ]);
  });

  it('monthly: clamp ngày 31 về cuối tháng ngắn', () => {
    expect(occurrenceDatesInRange('2026-01-31', 'monthly', '2026-01-31', '2026-03-31')).toEqual([
      '2026-01-31', '2026-02-28', '2026-03-31',
    ]);
  });

  it('yearly: bước 12 tháng', () => {
    expect(occurrenceDatesInRange('2024-02-29', 'yearly', '2024-01-01', '2027-12-31')).toEqual([
      '2024-02-29', '2025-02-28', '2026-02-28', '2027-02-28',
    ]);
  });

  it('none: trả startDate nếu trong khoảng, ngược lại rỗng', () => {
    expect(occurrenceDatesInRange('2026-07-12', 'none', '2026-07-01', '2026-07-31')).toEqual(['2026-07-12']);
    expect(occurrenceDatesInRange('2026-06-12', 'none', '2026-07-01', '2026-07-31')).toEqual([]);
  });
});

describe('expandRecurring', () => {
  it('template daily → nhiều occurrence với id/due_date/is_done đúng', () => {
    const t = todo({ completed_dates: ['2026-07-13'] });
    const out = expandRecurring([t], '2026-07-12', '2026-07-14');
    expect(out.map((o) => o.id)).toEqual(['t1::2026-07-12', 't1::2026-07-13', 't1::2026-07-14']);
    expect(out.map((o) => o.due_date)).toEqual(['2026-07-12', '2026-07-13', '2026-07-14']);
    expect(out.map((o) => o.is_done)).toEqual([false, true, false]);
  });

  it('việc thường giữ nguyên (không đổi id)', () => {
    const t = todo({ id: 'n1', recurrence: 'none' });
    const out = expandRecurring([t], '2026-07-01', '2026-07-31');
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe('n1');
  });
});

describe('parseOccurrenceId', () => {
  it('ngày', () => {
    expect(parseOccurrenceId('abc::2026-07-13')).toEqual({ templateId: 'abc', kind: 'day', date: '2026-07-13' });
  });
  it('kỳ (period)', () => {
    expect(parseOccurrenceId('abc::P2026-08')).toEqual({ templateId: 'abc', kind: 'period', periodKey: '2026-08' });
  });
  it('id thường → null', () => {
    expect(parseOccurrenceId('abc')).toBeNull();
  });
});

describe('toggleDateInList', () => {
  it('thêm khi vắng (sắp xếp)', () => {
    expect(toggleDateInList(['2026-07-14'], '2026-07-12')).toEqual(['2026-07-12', '2026-07-14']);
  });
  it('bớt khi có', () => {
    expect(toggleDateInList(['2026-07-12', '2026-07-14'], '2026-07-12')).toEqual(['2026-07-14']);
  });
});

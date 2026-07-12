import { describe, it, expect } from 'vitest';
import type { Todo } from '../types/todo';
import { nextDueDate, buildNextOccurrence } from './recurrence';

describe('nextDueDate', () => {
  it('weekly: cộng 7 ngày', () => {
    expect(nextDueDate('2026-07-01', 'weekly')).toBe('2026-07-08');
  });
  it('monthly: cộng 1 tháng, ngày thường', () => {
    expect(nextDueDate('2026-07-15', 'monthly')).toBe('2026-08-15');
  });
  it('monthly: dồn về cuối tháng khi tháng sau không có ngày gốc', () => {
    expect(nextDueDate('2026-01-31', 'monthly')).toBe('2026-02-28');
  });
  it('monthly: năm nhuận vẫn tính đúng 29/2', () => {
    expect(nextDueDate('2024-01-31', 'monthly')).toBe('2024-02-29');
  });
  it('monthly: cộng qua năm mới', () => {
    expect(nextDueDate('2026-12-15', 'monthly')).toBe('2027-01-15');
  });
  it('yearly: cộng 1 năm, dồn 29/2 về 28/2 năm không nhuận', () => {
    expect(nextDueDate('2024-02-29', 'yearly')).toBe('2025-02-28');
  });
  it('none: giữ nguyên ngày', () => {
    expect(nextDueDate('2026-07-15', 'none')).toBe('2026-07-15');
  });
  it('daily: cộng 1 ngày', () => {
    expect(nextDueDate('2026-07-12', 'daily')).toBe('2026-07-13');
  });
  it('daily: qua ranh giới cuối tháng', () => {
    expect(nextDueDate('2026-07-31', 'daily')).toBe('2026-08-01');
  });
  it('daily: qua ranh giới cuối năm', () => {
    expect(nextDueDate('2026-12-31', 'daily')).toBe('2027-01-01');
  });
});

function makeTodo(over: Partial<Todo>): Todo {
  return {
    id: over.id ?? 'x',
    user_id: 'u1',
    title: over.title ?? 'Đóng thẻ VPBank',
    notes: over.notes ?? null,
    is_done: over.is_done ?? false,
    due_date: over.due_date === undefined ? '2026-07-15' : over.due_date,
    priority: over.priority ?? 'medium',
    tags: over.tags ?? [],
    recurrence: over.recurrence ?? 'monthly',
    sort_order: over.sort_order ?? 0,
    created_at: '2026-07-01T00:00:00Z',
    updated_at: '2026-07-01T00:00:00Z',
  };
}

describe('buildNextOccurrence', () => {
  it('copy title/notes/priority/tags/recurrence, tính due_date kỳ sau', () => {
    const todo = makeTodo({ title: 'Đóng thẻ VPBank', tags: ['tài chính'], priority: 'high' });
    const next = buildNextOccurrence(todo);
    expect(next).toEqual({
      title: 'Đóng thẻ VPBank',
      notes: null,
      due_date: '2026-08-15',
      priority: 'high',
      tags: ['tài chính'],
      recurrence: 'monthly',
    });
  });
  it('báo lỗi nếu việc lặp không có due_date', () => {
    const todo = makeTodo({ due_date: null });
    expect(() => buildNextOccurrence(todo)).toThrow();
  });
});

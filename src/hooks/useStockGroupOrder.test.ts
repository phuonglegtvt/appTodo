import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// Giả lập Supabase: một "bảng" user_prefs trong bộ nhớ, đủ cho select + upsert.
const db: { row: { stock_group_order: string[] } | null; fail: boolean } = { row: null, fail: false };
const upsert = vi.fn(async (v: { stock_group_order: string[] }) => {
  if (db.fail) return { error: { message: 'mất mạng' } };
  db.row = { stock_group_order: v.stock_group_order };
  return { error: null };
});
vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: db.row, error: null }) }) }),
      upsert,
    }),
  },
}));

import { useStockGroupOrder } from './useStockGroupOrder';

describe('useStockGroupOrder', () => {
  beforeEach(() => {
    localStorage.clear();
    db.row = null;
    db.fail = false;
    upsert.mockClear();
  });

  it('mặc định Dài hạn đứng đầu', () => {
    const { result } = renderHook(() => useStockGroupOrder('u1'));
    expect(result.current.order[0]).toBe('longterm');
  });

  it('lấy thứ tự từ Supabase (máy khác đã sắp)', async () => {
    db.row = { stock_group_order: ['defense', 'balance', 'attack', 'longterm'] };
    const { result } = renderHook(() => useStockGroupOrder('u1'));
    await waitFor(() => expect(result.current.order[0]).toBe('defense'));
  });

  it('move đổi ngay trên màn hình và lưu lên Supabase', async () => {
    const { result } = renderHook(() => useStockGroupOrder('u1'));
    act(() => result.current.move('defense', -1));
    expect(result.current.order).toEqual(['longterm', 'attack', 'defense', 'balance']);
    await waitFor(() => expect(db.row?.stock_group_order).toEqual(['longterm', 'attack', 'defense', 'balance']));
  });

  it('chưa có dòng trên Supabase mà máy có bản đệm cũ → đẩy bản đệm lên', async () => {
    localStorage.setItem('apptodo-stock-group-order', JSON.stringify(['balance', 'longterm', 'attack', 'defense']));
    renderHook(() => useStockGroupOrder('u1'));
    await waitFor(() => expect(db.row?.stock_group_order).toEqual(['balance', 'longterm', 'attack', 'defense']));
  });

  it('lưu thất bại → báo lỗi, không im lặng', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { result } = renderHook(() => useStockGroupOrder('u1'));
    // Chờ lần tải ban đầu xong, rồi mới "mất mạng" lúc lưu.
    await act(async () => {});
    db.fail = true;
    act(() => result.current.move('defense', -1));
    await waitFor(() => expect(result.current.error).toMatch(/Không lưu được/));
    err.mockRestore();
  });
});

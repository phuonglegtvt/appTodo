import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useStockGroupOrder } from './useStockGroupOrder';

describe('useStockGroupOrder', () => {
  beforeEach(() => localStorage.clear());

  it('mặc định Dài hạn đứng đầu', () => {
    const { result } = renderHook(() => useStockGroupOrder());
    expect(result.current.order[0]).toBe('longterm');
  });

  it('move đổi vị trí và ghi localStorage, mở lại vẫn giữ', () => {
    const { result } = renderHook(() => useStockGroupOrder());
    act(() => result.current.move('defense', -1));
    expect(result.current.order).toEqual(['longterm', 'attack', 'defense', 'balance']);
    const { result: lai } = renderHook(() => useStockGroupOrder());
    expect(lai.current.order).toEqual(['longterm', 'attack', 'defense', 'balance']);
  });

  it('bản lưu hỏng → dùng mặc định, không vỡ trang', () => {
    localStorage.setItem('apptodo-stock-group-order', '{không phải json');
    const { result } = renderHook(() => useStockGroupOrder());
    expect(result.current.order).toHaveLength(4);
  });
});

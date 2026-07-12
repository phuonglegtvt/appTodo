import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSidebarCollapsed } from './useSidebarCollapsed';

describe('useSidebarCollapsed', () => {
  beforeEach(() => localStorage.clear());

  it('mặc định mở (không thu gọn)', () => {
    const { result } = renderHook(() => useSidebarCollapsed());
    expect(result.current.collapsed).toBe(false);
  });

  it('toggle đổi trạng thái và ghi localStorage', () => {
    const { result } = renderHook(() => useSidebarCollapsed());
    act(() => result.current.toggle());
    expect(result.current.collapsed).toBe(true);
    expect(localStorage.getItem('apptodo-sidebar-collapsed')).toBe('1');
  });

  it('đọc lại trạng thái đã lưu', () => {
    localStorage.setItem('apptodo-sidebar-collapsed', '1');
    const { result } = renderHook(() => useSidebarCollapsed());
    expect(result.current.collapsed).toBe(true);
  });
});

import { describe, it, expect } from 'vitest';
import { moveGroup, normalizeGroupOrder } from './groupOrder';
import { STOCK_GROUPS } from './stockCalc';

describe('normalizeGroupOrder', () => {
  it('không có bản lưu / bản lưu hỏng → thứ tự mặc định', () => {
    expect(normalizeGroupOrder(null)).toEqual(STOCK_GROUPS);
    expect(normalizeGroupOrder('rác')).toEqual(STOCK_GROUPS);
  });

  it('giữ thứ tự đã lưu, bỏ giá trị lạ và trùng, nối nhóm còn thiếu vào cuối', () => {
    expect(normalizeGroupOrder(['defense', 'xyz', 'defense', 'attack']))
      .toEqual(['defense', 'attack', 'longterm', 'balance']);
  });
});

describe('moveGroup', () => {
  const order = ['longterm', 'attack', 'balance', 'defense'] as const;

  it('lên / xuống một bậc', () => {
    expect(moveGroup([...order], 'balance', -1)).toEqual(['longterm', 'balance', 'attack', 'defense']);
    expect(moveGroup([...order], 'balance', 1)).toEqual(['longterm', 'attack', 'defense', 'balance']);
  });

  it('bỏ qua nhóm đang ẩn: đổi chỗ với bảng ĐANG HIỆN liền kề', () => {
    // attack trống (ẩn) ⇒ balance "lên" phải đổi chỗ với longterm.
    expect(moveGroup([...order], 'balance', -1, ['longterm', 'balance', 'defense']))
      .toEqual(['balance', 'attack', 'longterm', 'defense']);
  });

  it('ở mép thì giữ nguyên', () => {
    expect(moveGroup([...order], 'longterm', -1)).toEqual([...order]);
    expect(moveGroup([...order], 'defense', 1)).toEqual([...order]);
  });
});

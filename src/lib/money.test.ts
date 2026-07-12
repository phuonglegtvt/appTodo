import { describe, it, expect } from 'vitest';
import { formatMoney } from './money';

describe('formatMoney', () => {
  it('USD → tiền tệ $ với tối đa 2 số lẻ', () => {
    expect(formatMoney(64832.1, 'USD', null)).toBe('$64,832.1');
    expect(formatMoney(1000, 'USD', 26000)).toBe('$1,000');
  });
  it('VND có tỷ giá → quy đổi, làm tròn, hậu tố đ (vi-VN dùng dấu . ngăn nghìn)', () => {
    expect(formatMoney(10, 'VND', 26000)).toBe('260.000 đ');
  });
  it('VND nhưng chưa có tỷ giá → fallback hiển thị USD', () => {
    expect(formatMoney(10, 'VND', null)).toBe('$10');
  });
  it('số 0', () => {
    expect(formatMoney(0, 'USD', null)).toBe('$0');
  });
});

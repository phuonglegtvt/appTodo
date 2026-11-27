import { describe, it, expect } from 'vitest';
import { niceTicks, nearestIndex } from './chartScale';

describe('niceTicks', () => {
  it('bắt đầu từ 0 và phủ hết max', () => {
    const t = niceTicks(10e6, 1_938_428_376);
    expect(t[0]).toBe(0);
    expect(t[t.length - 1]).toBeGreaterThanOrEqual(1_938_428_376);
    expect(t).toEqual([0, 500e6, 1000e6, 1500e6, 2000e6]);
  });
  it('dải âm vẫn chạy được', () => {
    const t = niceTicks(-30, 80);
    expect(t[0]).toBeLessThanOrEqual(-30);
    expect(t[t.length - 1]).toBeGreaterThanOrEqual(80);
  });
  it('mọi giá trị bằng 0 không chia cho 0', () => {
    expect(niceTicks(0, 0).length).toBeGreaterThan(1);
  });
});

describe('nearestIndex', () => {
  it('tìm phần tử gần nhất', () => {
    expect(nearestIndex([0, 10, 20, 30], 14)).toBe(1);
    expect(nearestIndex([0, 10, 20, 30], 16)).toBe(2);
    expect(nearestIndex([0, 10, 20, 30], 99)).toBe(3);
    expect(nearestIndex([5], 0)).toBe(0);
    expect(nearestIndex([], 0)).toBe(-1);
  });
});

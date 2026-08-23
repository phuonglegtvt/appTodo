import { describe, it, expect } from 'vitest';
import { roundDownTo, sumVnd, daysBetween } from './money';

describe('roundDownTo', () => {
  it('làm tròn XUỐNG bội số gần nhất', () => {
    expect(roundDownTo(1_420_789, 100_000)).toBe(1_400_000);
    expect(roundDownTo(1_579_211, 100_000)).toBe(1_500_000);
  });

  it('giữ nguyên khi đã là bội số', () => {
    expect(roundDownTo(1_400_000, 100_000)).toBe(1_400_000);
  });

  it('trả 0 khi nhỏ hơn một bước', () => {
    expect(roundDownTo(99_999, 100_000)).toBe(0);
  });

  it('trả nguyên giá trị khi bước <= 0 (không chia cho 0)', () => {
    expect(roundDownTo(1_234_567, 0)).toBe(1_234_567);
    expect(roundDownTo(1_234_567, -5)).toBe(1_234_567);
  });

  it('kết quả luôn là bội số đúng của bước (không lệch dấu phẩy động)', () => {
    for (const v of [1, 333_333, 999_999_999, 1_000_000_001]) {
      expect(roundDownTo(v, 100_000) % 100_000).toBe(0);
    }
  });
});

describe('sumVnd', () => {
  it('cộng chính xác, mảng rỗng ra 0', () => {
    expect(sumVnd([])).toBe(0);
    expect(sumVnd([1_400_000, 1_600_000])).toBe(3_000_000);
  });
});

describe('daysBetween', () => {
  it('đếm đúng số ngày giữa hai mốc ISO', () => {
    expect(daysBetween('2026-08-01', '2026-08-22')).toBe(21);
    expect(daysBetween('2026-08-22', '2026-08-22')).toBe(0);
  });

  it('trả số âm khi mốc sau nằm trước mốc trước', () => {
    expect(daysBetween('2026-08-22', '2026-08-01')).toBe(-21);
  });

  it('không bị lệch vì giờ trong ngày', () => {
    expect(daysBetween('2026-08-01T23:00:00Z', '2026-08-01T01:00:00Z')).toBe(0);
  });
});

import { describe, it, expect } from 'vitest';
import { getPeriodRange, getPeriodKey } from './goalFilters';

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

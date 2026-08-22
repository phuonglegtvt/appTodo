import { describe, it, expect } from 'vitest';
import { computeDrawdown } from './drawdown';

/** Chuỗi ngày liên tiếp từ 2026-01-01 để kiểm daysSinceHigh cho tiện. */
function chuoi(...values: number[]) {
  return values.map((value, i) => ({
    date: `2026-01-${String(i + 1).padStart(2, '0')}`,
    value,
  }));
}

describe('computeDrawdown — chuỗi tăng liên tục', () => {
  const d = computeDrawdown(chuoi(100, 110, 120))!;

  it('không sụt giảm', () => {
    expect(d.currentPct).toBe(0);
    expect(d.maxPct).toBe(0);
  });

  it('đỉnh là điểm cuối, 0 ngày kể từ đỉnh', () => {
    expect(d.ath).toEqual({ date: '2026-01-03', value: 120 });
    expect(d.daysSinceHigh).toBe(0);
  });

  it('đã hồi phục 100%', () => {
    expect(d.recoveryPct).toBe(100);
  });
});

describe('computeDrawdown — chuỗi giảm liên tục', () => {
  const d = computeDrawdown(chuoi(100, 90, 80))!;

  it('sụt 20% từ đỉnh, và đó cũng là mức sâu nhất', () => {
    expect(d.currentPct).toBeCloseTo(20, 6);
    expect(d.maxPct).toBeCloseTo(20, 6);
  });

  it('đáy là điểm cuối, chưa hồi phục gì', () => {
    expect(d.trough).toEqual({ date: '2026-01-03', value: 80 });
    expect(d.recoveryPct).toBe(0);
  });

  it('2 ngày kể từ đỉnh', () => {
    expect(d.daysSinceHigh).toBe(2);
  });
});

describe('computeDrawdown — hình chữ V (đã hồi một phần)', () => {
  const d = computeDrawdown(chuoi(100, 60, 80))!;

  it('hiện sụt 20% nhưng ĐÃ TỪNG sụt 40%', () => {
    expect(d.currentPct).toBeCloseTo(20, 6);
    expect(d.maxPct).toBeCloseTo(40, 6);
  });

  it('hồi được 50% quãng đường từ đáy về đỉnh', () => {
    // (80 − 60) / (100 − 60) = 50%
    expect(d.recoveryPct).toBeCloseTo(50, 6);
  });
});

describe('computeDrawdown — hai đợt sụt, đỉnh mới ở giữa', () => {
  // 100 → 70 (sụt 30%) → 120 (đỉnh mới) → 90 (sụt 25% từ đỉnh mới)
  const d = computeDrawdown(chuoi(100, 70, 120, 90))!;

  it('sụt hiện tại tính từ ĐỈNH CAO NHẤT (120), không phải đỉnh đầu', () => {
    expect(d.currentPct).toBeCloseTo(25, 6);
    expect(d.ath).toEqual({ date: '2026-01-03', value: 120 });
  });

  it('sụt sâu nhất trong lịch sử là 30% (đợt đầu), không phải 25%', () => {
    expect(d.maxPct).toBeCloseTo(30, 6);
  });

  it('đáy dùng để tính hồi phục là đáy SAU đỉnh cao nhất', () => {
    expect(d.trough).toEqual({ date: '2026-01-04', value: 90 });
    expect(d.recoveryPct).toBe(0);
  });
});

describe('computeDrawdown — biên', () => {
  it('chuỗi rỗng → null (người gọi phải xử lý tường minh)', () => {
    expect(computeDrawdown([])).toBeNull();
  });

  it('một điểm duy nhất → không sụt, hồi phục 100%', () => {
    const d = computeDrawdown(chuoi(100))!;
    expect(d.currentPct).toBe(0);
    expect(d.maxPct).toBe(0);
    expect(d.recoveryPct).toBe(100);
    expect(d.daysSinceHigh).toBe(0);
  });

  it('toàn số 0 → không chia cho 0, không ra NaN', () => {
    const d = computeDrawdown(chuoi(0, 0, 0))!;
    expect(Number.isNaN(d.currentPct)).toBe(false);
    expect(Number.isNaN(d.maxPct)).toBe(false);
    expect(Number.isNaN(d.recoveryPct)).toBe(false);
    expect(d.currentPct).toBe(0);
  });

  it('chuỗi truyền vào KHÔNG theo thứ tự ngày vẫn tính đúng (tự sắp xếp)', () => {
    const daoLon = [
      { date: '2026-01-03', value: 80 },
      { date: '2026-01-01', value: 100 },
      { date: '2026-01-02', value: 60 },
    ];
    const d = computeDrawdown(daoLon)!;
    expect(d.currentPct).toBeCloseTo(20, 6);
    expect(d.maxPct).toBeCloseTo(40, 6);
  });

  it('KHÔNG làm biến đổi mảng đầu vào', () => {
    const goc = chuoi(100, 60, 80);
    const ban = [...goc];
    computeDrawdown(goc);
    expect(goc).toEqual(ban);
  });
});

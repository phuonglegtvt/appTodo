// Test cho topUp.ts — "cần bổ sung bao nhiêu vốn để đạt tỷ trọng mục tiêu".
//
// Khác allocate.ts: allocate chia MỘT số tiền đã biết (Z tháng này) theo tỷ lệ
// khoảng thiếu. topUp trả lời câu ngược lại — CẦN bao nhiêu tiền để mọi nhóm về
// đúng target mà KHÔNG phải bán gì.
//
// Công thức: cần v_c + a_c = t_c × (T + M) với a_c ≥ 0
//   ⇒ M ≥ v_c/t_c − T với mọi c  ⇒ M = max(0, max_c(v_c/t_c) − T)
//   rồi a_c = t_c × (T + M) − v_c

import { describe, it, expect } from 'vitest';
import { planTopUp } from './topUp';
import type { AssetClass, TargetBand } from './types';

/** 60:30:10:0 — hồ sơ tab Danh mục. Band không dùng ở đây, chỉ target. */
const T_60_30_10: Record<AssetClass, TargetBand> = {
  STOCKS: { targetPct: 60, minPct: 55, maxPct: 65 },
  CRYPTO: { targetPct: 30, minPct: 25, maxPct: 35 },
  GOLD:   { targetPct: 10, minPct: 5,  maxPct: 15 },
  CASH:   { targetPct: 0,  minPct: 0,  maxPct: 0 },
};

const v = (
  STOCKS: number, CRYPTO: number, GOLD: number, CASH = 0,
): Record<AssetClass, number> => ({ STOCKS, CRYPTO, GOLD, CASH });

describe('planTopUp — danh mục đã đúng target', () => {
  it('không cần bổ sung đồng nào', () => {
    const r = planTopUp(v(600_000_000, 300_000_000, 100_000_000), T_60_30_10);
    expect(r.status).toBe('OK');
    expect(r.totalNeededVnd).toBe(0);
    expect(r.perClass).toEqual(v(0, 0, 0));
  });
});

describe('planTopUp — nhóm nào đang vượt thì nhóm đó quyết định tổng', () => {
  // STOCKS 350tr, CRYPTO 200tr, GOLD 0. T = 550tr.
  // v/t: STOCKS 350/0,6 = 583,33tr · CRYPTO 200/0,3 = 666,67tr · GOLD 0
  // ⇒ tổng đích = 666,666,666.67 ⇒ M = 116.666.666,67
  const r = planTopUp(v(350_000_000, 200_000_000, 0), T_60_30_10);

  it('tổng cần bổ sung do nhóm lệch nhất (CRYPTO) quyết định', () => {
    expect(r.status).toBe('OK');
    expect(Math.round(r.totalNeededVnd)).toBe(116_666_667);
  });

  it('nhóm quyết định không cần thêm đồng nào', () => {
    expect(Math.round(r.perClass.CRYPTO)).toBe(0);
  });

  it('cộng từng nhóm lại đúng bằng tổng — không có tiền bốc hơi', () => {
    const tong = r.perClass.STOCKS + r.perClass.CRYPTO + r.perClass.GOLD + r.perClass.CASH;
    expect(Math.round(tong)).toBe(Math.round(r.totalNeededVnd));
  });

  it('sau khi bổ sung, mọi nhóm về đúng tỷ trọng mục tiêu', () => {
    const tongMoi = 550_000_000 + r.totalNeededVnd;
    expect((350_000_000 + r.perClass.STOCKS) / tongMoi).toBeCloseTo(0.6, 10);
    expect((200_000_000 + r.perClass.CRYPTO) / tongMoi).toBeCloseTo(0.3, 10);
    expect((0 + r.perClass.GOLD) / tongMoi).toBeCloseTo(0.1, 10);
  });
});

describe('planTopUp — không thể về target bằng cách nạp thêm', () => {
  it('nhóm target 0% mà đang giữ tiền thì phải BÁN, không nạp thêm được', () => {
    // CASH target 0% nhưng đang có 50tr: nạp bao nhiêu cũng không đưa CASH về 0%.
    const r = planTopUp(v(350_000_000, 200_000_000, 0, 50_000_000), T_60_30_10);
    expect(r.status).toBe('IMPOSSIBLE_WITHOUT_SELLING');
    expect(r.blockingClasses).toEqual(['CASH']);
  });

  it('nhóm target 0% mà đang giữ 0 thì không chặn gì', () => {
    const r = planTopUp(v(350_000_000, 200_000_000, 0, 0), T_60_30_10);
    expect(r.status).toBe('OK');
    expect(r.blockingClasses).toEqual([]);
  });
});

describe('planTopUp — danh mục rỗng', () => {
  it('chưa đầu tư gì thì không có tỷ trọng nào để đuổi theo', () => {
    const r = planTopUp(v(0, 0, 0), T_60_30_10);
    expect(r.status).toBe('EMPTY_PORTFOLIO');
    expect(r.totalNeededVnd).toBe(0);
  });
});

describe('planTopUp — dữ liệu bất thường thì NÉM, không đoán', () => {
  it('tổng target khác 100% → ném lỗi', () => {
    const lech: Record<AssetClass, TargetBand> = {
      ...T_60_30_10,
      GOLD: { targetPct: 20, minPct: 5, maxPct: 25 },
    };
    expect(() => planTopUp(v(1, 1, 1), lech)).toThrow(/110/);
  });

  it('giá trị âm → ném lỗi', () => {
    expect(() => planTopUp(v(-1, 0, 0), T_60_30_10)).toThrow(/âm/);
  });

  it('giá trị NaN → ném lỗi (NaN < 0 là false, phải chặn riêng)', () => {
    expect(() => planTopUp(v(NaN, 0, 0), T_60_30_10)).toThrow(/không phải số/);
  });

  it('target âm → ném lỗi', () => {
    const am: Record<AssetClass, TargetBand> = {
      ...T_60_30_10,
      CASH: { targetPct: -10, minPct: -10, maxPct: 0 },
      GOLD: { targetPct: 20, minPct: 5, maxPct: 25 },
    };
    expect(() => planTopUp(v(1, 1, 1), am)).toThrow(/âm/);
  });
});

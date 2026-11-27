import { describe, it, expect } from 'vitest';
import { defaultTargets, lapKeHoachPhanBo, type AllocationItem } from './longtermAllocation';

const item = (ticker: string, priceVnd: number | null, quantity: number | null, targetPct: number): AllocationItem =>
  ({ id: ticker, ticker, priceVnd, quantity, targetPct });

describe('defaultTargets', () => {
  it('E1VFVN30 20%, 8 mã còn lại mỗi mã 10%', () => {
    const ds = ['E1VFVN30', 'FPT', 'HPG', 'ACB', 'VPB', 'MWG', 'QNS', 'VND', 'FUESSVFL'].map((t) => ({ id: t, ticker: t }));
    const t = defaultTargets(ds);
    expect(t.E1VFVN30).toBe(20);
    expect(t.FPT).toBe(10);
    expect(Object.values(t).reduce((s, v) => s + v, 0)).toBeCloseTo(100);
  });
  it('không có E1VFVN30 thì chia đều', () => {
    expect(defaultTargets([{ id: 'a', ticker: 'A' }, { id: 'b', ticker: 'B' }])).toEqual({ a: 50, b: 50 });
  });
});

describe('lapKeHoachPhanBo', () => {
  it('danh mục rỗng: chia đúng tỷ trọng, làm tròn xuống số cổ', () => {
    const p = lapKeHoachPhanBo([item('E1', 20_000, 0, 20), item('A', 10_000, 0, 80)], 1_000_000, 1);
    // E1: 200.000 / 20.000 = 10 cổ; A: 800.000 / 10.000 = 80 cổ.
    expect(p.rows.map((r) => r.buyShares)).toEqual([10, 80]);
    expect(p.spentVnd).toBe(1_000_000);
    expect(p.leftoverVnd).toBe(0);
    expect(p.rows[0].afterPct).toBeCloseTo(20);
  });

  it('mã đang vượt mục tiêu không được mua, không bán', () => {
    // A đang 900k (90%) mục tiêu 50%; B 100k mục tiêu 50%. Nạp 200k: T = 1,2tr.
    // gap A = max(0, 600k − 900k) = 0; gap B = 600k − 100k = 500k ⇒ toàn bộ 200k cho B.
    const p = lapKeHoachPhanBo([item('A', 1000, 900, 50), item('B', 1000, 100, 50)], 200_000, 1);
    expect(p.rows[0].buyShares).toBe(0);
    expect(p.rows[1].buyShares).toBe(200);
    // Cần thêm bao nhiêu để về đúng 50/50: tổng đích = 900k/0,5 = 1,8tr ⇒ 800k.
    expect(p.neededForExactVnd).toBeCloseTo(800_000);
  });

  it('tiền lẻ sau làm tròn dồn vào mã thiếu nhiều nhất còn mua được', () => {
    const p = lapKeHoachPhanBo([item('A', 30_000, 0, 50), item('B', 7_000, 0, 50)], 100_000, 1);
    // Thực: 50k/50k ⇒ làm tròn: A 1 cổ (30k), B 7 cổ (49k); dư 21k.
    // A thiếu 20k nhưng 1 cổ 30k > 21k; B thiếu 1k ⇒ +1 cổ (7k). Sau đó không mã
    // nào còn thiếu ⇒ dừng, KHÔNG mua vượt mục tiêu; dư 14k.
    expect(p.rows.map((r) => r.buyShares)).toEqual([1, 8]);
    expect(p.spentVnd + p.leftoverVnd).toBeCloseTo(100_000);
    expect(p.leftoverVnd).toBe(14_000);
  });

  it('lô 100 cổ', () => {
    const p = lapKeHoachPhanBo([item('A', 10_000, 0, 100)], 2_500_000, 100);
    expect(p.rows[0].buyShares).toBe(200);
    expect(p.leftoverVnd).toBe(500_000);
  });

  it('báo lỗi rõ: tổng ≠ 100%, thiếu giá', () => {
    expect(() => lapKeHoachPhanBo([item('A', 1, 0, 60), item('B', 1, 0, 30)], 1, 1)).toThrow(/phải bằng 100%/);
    expect(() => lapKeHoachPhanBo([item('A', null, 0, 100)], 1, 1)).toThrow(/Chưa có giá hiện tại của A/);
  });
});

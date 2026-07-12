import { describe, it, expect } from 'vitest';
import { cost, value, pnl, pnlPercent, portfolioTotals, allocationPercent } from './cryptoCalc';
import type { Crypto } from '../types/crypto';

/** Tạo một Crypto tối thiểu cho test (các cột không dùng để giá trị mặc định). */
function mk(partial: Partial<Crypto>): Crypto {
  return {
    id: 'x',
    user_id: 'u',
    symbol: 'BTC',
    name: '',
    quantity: null,
    avg_buy_price: null,
    current_price: null,
    sort_order: 0,
    created_at: '',
    updated_at: '',
    ...partial,
  };
}

describe('cost/value/pnl/pnlPercent', () => {
  it('đủ dữ liệu: tính vốn, giá trị, lời/lỗ, %', () => {
    const c = mk({ quantity: 2, avg_buy_price: 100, current_price: 150 });
    expect(cost(c)).toBe(200);
    expect(value(c)).toBe(300);
    expect(pnl(c)).toBe(100);
    expect(pnlPercent(c)).toBeCloseTo(50);
  });

  it('lỗ ra số âm', () => {
    const c = mk({ quantity: 1, avg_buy_price: 200, current_price: 150 });
    expect(pnl(c)).toBe(-50);
    expect(pnlPercent(c)).toBeCloseTo(-25);
  });

  it('thiếu current_price → value/pnl/pnlPercent null (cost vẫn tính)', () => {
    const c = mk({ quantity: 2, avg_buy_price: 100 });
    expect(cost(c)).toBe(200);
    expect(value(c)).toBeNull();
    expect(pnl(c)).toBeNull();
    expect(pnlPercent(c)).toBeNull();
  });

  it('thiếu quantity → tất cả null', () => {
    const c = mk({ avg_buy_price: 100, current_price: 150 });
    expect(cost(c)).toBeNull();
    expect(value(c)).toBeNull();
    expect(pnl(c)).toBeNull();
  });

  it('cost = 0 → pnlPercent null (tránh chia cho 0)', () => {
    const c = mk({ quantity: 5, avg_buy_price: 0, current_price: 10 });
    expect(cost(c)).toBe(0);
    expect(pnl(c)).toBe(50);
    expect(pnlPercent(c)).toBeNull();
  });
});

describe('portfolioTotals', () => {
  it('cộng dồn, bỏ qua coin thiếu dữ liệu', () => {
    const list = [
      mk({ quantity: 2, avg_buy_price: 100, current_price: 150 }), // cost 200, value 300
      mk({ quantity: 1, avg_buy_price: 50, current_price: 40 }),   // cost 50, value 40
      mk({ quantity: 3, avg_buy_price: 10 }),                       // cost 30, value bỏ qua
    ];
    const t = portfolioTotals(list);
    expect(t.totalCost).toBe(280);
    expect(t.totalValue).toBe(340);
    expect(t.totalPnl).toBe(60);
    expect(t.totalPnlPercent).toBeCloseTo((60 / 280) * 100);
  });

  it('danh mục rỗng → 0 và pnlPercent null', () => {
    const t = portfolioTotals([]);
    expect(t).toEqual({ totalCost: 0, totalValue: 0, totalPnl: 0, totalPnlPercent: null });
  });
});

describe('allocationPercent', () => {
  it('tỷ trọng theo giá trị hiện tại', () => {
    const c = mk({ quantity: 2, current_price: 150 }); // value 300
    expect(allocationPercent(c, 600)).toBeCloseTo(50);
  });
  it('thiếu value hoặc tổng 0 → null', () => {
    expect(allocationPercent(mk({ quantity: 2 }), 600)).toBeNull();
    expect(allocationPercent(mk({ quantity: 2, current_price: 150 }), 0)).toBeNull();
  });
});

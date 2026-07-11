import { describe, it, expect } from 'vitest';
import {
  computeYield,
  groupWeights,
  compareToTarget,
  isBelowThreshold,
  TARGET_PROFILES,
} from './stockCalc';
import type { Stock, StockGroup } from '../types/stock';

// Tạo Stock mẫu; chỉ cần override phần liên quan cho từng test.
function makeStock(over: Partial<Stock> = {}): Stock {
  return {
    id: 'id-' + (over.ticker ?? 'x'),
    user_id: 'u1',
    ticker: 'ACB',
    company_name: 'Ngân hàng ACB',
    group: 'balance',
    price_threshold: null,
    price_protect: null,
    current_price: null,
    dividend: null,
    invested_amount: null,
    sort_order: 0,
    created_at: '2026-07-11T00:00:00Z',
    updated_at: '2026-07-11T00:00:00Z',
    ...over,
  };
}

describe('computeYield', () => {
  it('khớp ví dụ AzFin: ACB 700đ cổ tức / giá ngưỡng 30,1 nghìn ≈ 2,3%', () => {
    const y = computeYield({ dividend: 700, price_threshold: 30.1 });
    expect(y).not.toBeNull();
    expect(y!).toBeCloseTo(2.326, 2);
  });

  it('trả null khi thiếu cổ tức', () => {
    expect(computeYield({ dividend: null, price_threshold: 30.1 })).toBeNull();
  });

  it('trả null khi thiếu giá ngưỡng', () => {
    expect(computeYield({ dividend: 700, price_threshold: null })).toBeNull();
  });

  it('trả null khi giá ngưỡng = 0 (không chia cho 0)', () => {
    expect(computeYield({ dividend: 700, price_threshold: 0 })).toBeNull();
  });
});

describe('groupWeights', () => {
  it('tính tổng vốn và % mỗi nhóm theo invested_amount', () => {
    const stocks = [
      makeStock({ ticker: 'A', group: 'attack', invested_amount: 30 }),
      makeStock({ ticker: 'B', group: 'balance', invested_amount: 30 }),
      makeStock({ ticker: 'C', group: 'defense', invested_amount: 40 }),
    ];
    const w = groupWeights(stocks);
    expect(w.total).toBe(100);
    expect(w.byGroup.attack.percent).toBeCloseTo(30, 5);
    expect(w.byGroup.balance.percent).toBeCloseTo(30, 5);
    expect(w.byGroup.defense.percent).toBeCloseTo(40, 5);
  });

  it('bỏ qua mã chưa nhập số tiền (null)', () => {
    const stocks = [
      makeStock({ ticker: 'A', group: 'attack', invested_amount: 50 }),
      makeStock({ ticker: 'B', group: 'balance', invested_amount: null }),
    ];
    const w = groupWeights(stocks);
    expect(w.total).toBe(50);
    expect(w.byGroup.attack.percent).toBeCloseTo(100, 5);
    expect(w.byGroup.balance.amount).toBe(0);
  });

  it('total = 0 thì mọi percent = 0, không chia cho 0', () => {
    const w = groupWeights([makeStock({ invested_amount: null })]);
    expect(w.total).toBe(0);
    expect(w.byGroup.attack.percent).toBe(0);
    expect(w.byGroup.balance.percent).toBe(0);
    expect(w.byGroup.defense.percent).toBe(0);
  });

  it('danh sách rỗng: total = 0', () => {
    const w = groupWeights([]);
    expect(w.total).toBe(0);
    expect(w.byGroup.defense.amount).toBe(0);
  });
});

describe('TARGET_PROFILES', () => {
  it('3 khẩu vị đã chốt, mỗi khẩu vị cộng đủ 100', () => {
    const keys: StockGroup[] = ['attack', 'balance', 'defense'];
    for (const k of keys) {
      const p = TARGET_PROFILES[k];
      expect(p.attack + p.balance + p.defense).toBe(100);
    }
    expect(TARGET_PROFILES.attack).toEqual({ attack: 30, balance: 30, defense: 40 });
    expect(TARGET_PROFILES.balance).toEqual({ attack: 20, balance: 40, defense: 40 });
    expect(TARGET_PROFILES.defense).toEqual({ attack: 10, balance: 40, defense: 50 });
  });
});

describe('compareToTarget', () => {
  it('chênh lệch = thực tế − mục tiêu, theo từng nhóm', () => {
    const weights = groupWeights([
      makeStock({ group: 'attack', invested_amount: 50 }),
      makeStock({ group: 'balance', invested_amount: 30 }),
      makeStock({ group: 'defense', invested_amount: 20 }),
    ]);
    // thực tế 50/30/20 so khẩu vị Cân bằng 20/40/40 → +30 / -10 / -20
    const diff = compareToTarget(weights, 'balance');
    expect(diff.attack).toBeCloseTo(30, 5);
    expect(diff.balance).toBeCloseTo(-10, 5);
    expect(diff.defense).toBeCloseTo(-20, 5);
  });
});

describe('isBelowThreshold', () => {
  it('true khi giá hiện tại <= giá ngưỡng', () => {
    expect(isBelowThreshold({ current_price: 29, price_threshold: 30.1 })).toBe(true);
    expect(isBelowThreshold({ current_price: 30.1, price_threshold: 30.1 })).toBe(true);
  });
  it('false khi giá hiện tại > giá ngưỡng', () => {
    expect(isBelowThreshold({ current_price: 31, price_threshold: 30.1 })).toBe(false);
  });
  it('false khi thiếu dữ liệu', () => {
    expect(isBelowThreshold({ current_price: null, price_threshold: 30.1 })).toBe(false);
    expect(isBelowThreshold({ current_price: 29, price_threshold: null })).toBe(false);
  });
});

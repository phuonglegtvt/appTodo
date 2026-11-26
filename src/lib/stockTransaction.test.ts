import { describe, it, expect } from 'vitest';
import { applyStockTx, avgCostThousand, validateStockTx } from './stockTransaction';

describe('applyStockTx — MUA', () => {
  it('mã chưa có gì: số lượng và vốn = đúng lần mua', () => {
    const { after, realizedPnlThousand } = applyStockTx(
      { quantity: null, invested_amount: null },
      { side: 'BUY', quantity: 1_000, price_thousand: 25, amount_thousand: 25_040 },
    );
    expect(after).toEqual({ quantity: 1_000, invested_amount: 25_040 });
    expect(realizedPnlThousand).toBeNull();
  });

  it('cộng dồn lên số cũ', () => {
    const { after } = applyStockTx(
      { quantity: 1_000, invested_amount: 20_000 },
      { side: 'BUY', quantity: 1_000, price_thousand: 30, amount_thousand: 30_000 },
    );
    expect(after).toEqual({ quantity: 2_000, invested_amount: 50_000 });
    expect(avgCostThousand(after)).toBe(25);
  });

  it('đang giữ mà chưa nhập vốn → ném lỗi', () => {
    expect(() => applyStockTx(
      { quantity: 100, invested_amount: null },
      { side: 'BUY', quantity: 100, price_thousand: 10, amount_thousand: 1_000 },
    )).toThrow(/Số tiền đầu tư/);
  });
});

describe('applyStockTx — BÁN', () => {
  it('bán một phần: vốn giảm theo tỷ lệ, giá vốn TB không đổi, ra lãi/lỗ', () => {
    const { after, realizedPnlThousand } = applyStockTx(
      { quantity: 2_000, invested_amount: 50_000 },
      { side: 'SELL', quantity: 500, price_thousand: 32, amount_thousand: 16_000 },
    );
    expect(after).toEqual({ quantity: 1_500, invested_amount: 37_500 });
    expect(avgCostThousand(after)).toBe(25);
    expect(realizedPnlThousand).toBe(3_500); // 16.000 − 12.500
  });

  it('bán hết: vốn về đúng 0', () => {
    const { after, realizedPnlThousand } = applyStockTx(
      { quantity: 300, invested_amount: 10_000 },
      { side: 'SELL', quantity: 300, price_thousand: 30, amount_thousand: 9_000 },
    );
    expect(after).toEqual({ quantity: 0, invested_amount: 0 });
    expect(realizedPnlThousand).toBe(-1_000);
  });

  it('bán quá số đang có → ném lỗi', () => {
    expect(() => applyStockTx(
      { quantity: 100, invested_amount: 1_000 },
      { side: 'SELL', quantity: 200, price_thousand: 10, amount_thousand: 2_000 },
    )).toThrow(/Không thể bán/);
  });
});

describe('validateStockTx', () => {
  it('số lượng phải là số nguyên dương', () => {
    const ok = { side: 'BUY' as const, quantity: 100, price_thousand: 10, amount_thousand: 1_000 };
    expect(() => validateStockTx(ok)).not.toThrow();
    expect(() => validateStockTx({ ...ok, quantity: 10.5 })).toThrow(/số nguyên/);
    expect(() => validateStockTx({ ...ok, quantity: 0 })).toThrow(/số nguyên/);
    expect(() => validateStockTx({ ...ok, price_thousand: 0 })).toThrow(/Giá/);
    expect(() => validateStockTx({ ...ok, amount_thousand: -1 })).toThrow(/Số tiền/);
  });
});

describe('avgCostThousand', () => {
  it('null khi thiếu dữ liệu hoặc đã bán hết', () => {
    expect(avgCostThousand({ quantity: null, invested_amount: 100 })).toBeNull();
    expect(avgCostThousand({ quantity: 10, invested_amount: null })).toBeNull();
    expect(avgCostThousand({ quantity: 0, invested_amount: 0 })).toBeNull();
  });
});

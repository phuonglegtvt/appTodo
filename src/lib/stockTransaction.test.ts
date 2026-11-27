import { describe, it, expect } from 'vitest';
import { applyStockTx, avgCostThousand, validateStockTx, planStockTxEdit, type RecordedStockTx } from './stockTransaction';

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

describe('planStockTxEdit', () => {
  // Dây chuyền thật: 0 → mua 100 cổ (2.000) → mua 50 cổ (1.500) → bán 60 cổ (2.400).
  const chain: RecordedStockTx[] = [
    { id: 'a', created_at: '2026-01-01T00:00:00Z', trade_date: '2026-01-01', side: 'BUY', quantity: 100, price_thousand: 20, amount_thousand: 2000,
      before_quantity: 0, before_invested_amount: 0, after_quantity: 100, after_invested_amount: 2000 },
    { id: 'c', created_at: '2026-01-03T00:00:00Z', trade_date: '2026-01-03', side: 'SELL', quantity: 60, price_thousand: 40, amount_thousand: 2400,
      before_quantity: 150, before_invested_amount: 3500, after_quantity: 90, after_invested_amount: 2100 },
    { id: 'b', created_at: '2026-01-02T00:00:00Z', trade_date: '2026-01-02', side: 'BUY', quantity: 50, price_thousand: 30, amount_thousand: 1500,
      before_quantity: 100, before_invested_amount: 2000, after_quantity: 150, after_invested_amount: 3500 },
  ];

  it('sửa giao dịch đầu ⇒ tính lại cả dây chuyền theo thứ tự ghi', () => {
    const plan = planStockTxEdit(chain, 'a', { side: 'BUY', quantity: 50, price_thousand: 20, amount_thousand: 1000 });
    expect(plan.updates.map((u) => u.id)).toEqual(['a', 'b', 'c']);
    expect(plan.updates[0].after).toEqual({ quantity: 50, invested_amount: 1000 });
    expect(plan.updates[1].before).toEqual({ quantity: 50, invested_amount: 1000 });
    expect(plan.updates[1].after).toEqual({ quantity: 100, invested_amount: 2500 });
    // Bán 60/100: vốn phần bán = 1.500 ⇒ còn 40 cổ, vốn 1.000; lãi chốt = 2.400 − 1.500.
    expect(plan.final).toEqual({ quantity: 40, invested_amount: 1000 });
    expect(plan.updates[2].realizedPnlThousand).toBeCloseTo(900);
    expect(plan.expectedCurrent).toEqual({ quantity: 90, invested_amount: 2100 });
  });

  it('sửa giao dịch mới nhất ⇒ chỉ một dòng cập nhật', () => {
    const plan = planStockTxEdit(chain, 'c', { side: 'SELL', quantity: 30, price_thousand: 40, amount_thousand: 1200 });
    expect(plan.updates).toHaveLength(1);
    expect(plan.final.quantity).toBe(120);
  });

  it('sửa làm lệnh bán phía sau vượt số đang có ⇒ báo rõ giao dịch nào', () => {
    expect(() => planStockTxEdit(chain, 'a', { side: 'BUY', quantity: 5, price_thousand: 20, amount_thousand: 100 }))
      .toThrow(/bán 60 cổ ngày 03\/01\/2026 phía sau không còn hợp lệ/);
  });

  it('dây chuyền bị sửa tay ở giữa ⇒ từ chối', () => {
    const dut = chain.map((t) => (t.id === 'c' ? { ...t, before_quantity: 999 } : t));
    expect(() => planStockTxEdit(dut, 'a', { side: 'BUY', quantity: 100, price_thousand: 20, amount_thousand: 2000 }))
      .toThrow(/sửa tay/);
    // Sửa chính giao dịch cuối thì không cần dây chuyền phía sau ⇒ vẫn được.
    expect(() => planStockTxEdit(dut, 'c', { side: 'SELL', quantity: 10, price_thousand: 40, amount_thousand: 400 })).not.toThrow();
  });

  it('không thấy giao dịch / số liệu sai ⇒ ném lỗi', () => {
    expect(() => planStockTxEdit(chain, 'x', { side: 'BUY', quantity: 1, price_thousand: 1, amount_thousand: 1 })).toThrow(/Không tìm thấy/);
    expect(() => planStockTxEdit(chain, 'a', { side: 'BUY', quantity: 1.5, price_thousand: 1, amount_thousand: 1 })).toThrow(/số nguyên/);
  });
});

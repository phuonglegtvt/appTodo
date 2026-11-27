import { describe, it, expect } from 'vitest';
import { applyStockTx, avgCostThousand, validateStockTx, planStockTxEdit, planStockTxDelete, type RecordedStockTx } from './stockTransaction';

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
  // Mã S1: 0 → mua 100 (2.000) → mua 50 (1.500) → bán 60 (2.400). Thứ tự mảng cố ý xáo.
  const chain: RecordedStockTx[] = [
    { id: 'a', stock_id: 'S1', created_at: '2026-01-01T00:00:00Z', trade_date: '2026-01-01', side: 'BUY', quantity: 100, price_thousand: 20, amount_thousand: 2000,
      before_quantity: 0, before_invested_amount: 0, after_quantity: 100, after_invested_amount: 2000 },
    { id: 'c', stock_id: 'S1', created_at: '2026-01-03T00:00:00Z', trade_date: '2026-01-03', side: 'SELL', quantity: 60, price_thousand: 40, amount_thousand: 2400,
      before_quantity: 150, before_invested_amount: 3500, after_quantity: 90, after_invested_amount: 2100 },
    { id: 'b', stock_id: 'S1', created_at: '2026-01-02T00:00:00Z', trade_date: '2026-01-02', side: 'BUY', quantity: 50, price_thousand: 30, amount_thousand: 1500,
      before_quantity: 100, before_invested_amount: 2000, after_quantity: 150, after_invested_amount: 3500 },
    // Mã S2: đang có 10 cổ (vốn 300) trước khi có sổ, rồi mua 20 cổ (600) ngày 02/01.
    { id: 'd', stock_id: 'S2', created_at: '2026-01-02T12:00:00Z', trade_date: '2026-01-02', side: 'BUY', quantity: 20, price_thousand: 30, amount_thousand: 600,
      before_quantity: 10, before_invested_amount: 300, after_quantity: 30, after_invested_amount: 900 },
  ];

  it('sửa giao dịch đầu ⇒ tính lại cả dây chuyền theo thứ tự ghi', () => {
    const { source: plan, target } = planStockTxEdit(chain, 'a', { side: 'BUY', quantity: 50, price_thousand: 20, amount_thousand: 1000 });
    expect(target).toBeNull();
    expect(plan.updates.map((u) => u.id)).toEqual(['a', 'b', 'c']);
    expect(plan.updates[0].after).toEqual({ quantity: 50, invested_amount: 1000 });
    expect(plan.updates[1].before).toEqual({ quantity: 50, invested_amount: 1000 });
    expect(plan.updates[1].after).toEqual({ quantity: 100, invested_amount: 2500 });
    // Bán 60/100: vốn phần bán = 1.500 ⇒ còn 40 cổ, vốn 1.000; lãi chốt = 2.400 − 1.500.
    expect(plan.final).toEqual({ quantity: 40, invested_amount: 1000 });
    expect(plan.updates[2].realized).toBeCloseTo(900);
    expect(plan.expected).toEqual({ quantity: 90, invested_amount: 2100 });
  });

  it('sửa giao dịch mới nhất ⇒ chỉ một dòng cập nhật', () => {
    const { source } = planStockTxEdit(chain, 'c', { side: 'SELL', quantity: 30, price_thousand: 40, amount_thousand: 1200 });
    expect(source.updates).toHaveLength(1);
    expect(source.final.quantity).toBe(120);
  });

  it('sửa làm lệnh bán phía sau vượt số đang có ⇒ báo rõ giao dịch nào', () => {
    expect(() => planStockTxEdit(chain, 'a', { side: 'BUY', quantity: 5, price_thousand: 20, amount_thousand: 100 }))
      .toThrow(/bán 60 cổ ngày 03\/01\/2026 phía sau không còn hợp lệ/);
  });

  it('dây chuyền bị sửa tay ở giữa ⇒ từ chối', () => {
    const dut = chain.map((t) => (t.id === 'c' ? { ...t, before_quantity: 999 } : t));
    expect(() => planStockTxEdit(dut, 'a', { side: 'BUY', quantity: 100, price_thousand: 20, amount_thousand: 2000 }))
      .toThrow(/sửa tay/);
    expect(() => planStockTxEdit(dut, 'c', { side: 'SELL', quantity: 10, price_thousand: 40, amount_thousand: 400 })).not.toThrow();
  });

  it('không thấy giao dịch / số liệu sai ⇒ ném lỗi', () => {
    expect(() => planStockTxEdit(chain, 'x', { side: 'BUY', quantity: 1, price_thousand: 1, amount_thousand: 1 })).toThrow(/Không tìm thấy/);
    expect(() => planStockTxEdit(chain, 'a', { side: 'BUY', quantity: 1.5, price_thousand: 1, amount_thousand: 1 })).toThrow(/số nguyên/);
  });

  describe('đổi sang mã khác', () => {
    it('chuyển giao dịch mua "b" sang S2: chèn trước "d" theo thời điểm ghi', () => {
      const plan = planStockTxEdit(chain, 'b', { side: 'BUY', quantity: 50, price_thousand: 30, amount_thousand: 1500 },
        { stockId: 'S2', current: { quantity: 30, invested_amount: 900 } });
      // S1 mất lệnh mua 50: bán 60 từ 100 cổ (vốn 2.000) ⇒ còn 40, vốn 800.
      expect(plan.source.updates.map((u) => u.id)).toEqual(['c']);
      expect(plan.source.updates[0].before).toEqual({ quantity: 100, invested_amount: 2000 });
      expect(plan.source.final).toEqual({ quantity: 40, invested_amount: 800 });
      expect(plan.source.expected).toEqual({ quantity: 90, invested_amount: 2100 });
      // S2: "b" (ghi 02/01 00:00) đứng trước "d" (02/01 12:00), áp lên TRƯỚC của d.
      expect(plan.target?.updates.map((u) => u.id)).toEqual(['b', 'd']);
      expect(plan.target?.updates[0].before).toEqual({ quantity: 10, invested_amount: 300 });
      expect(plan.target?.final).toEqual({ quantity: 80, invested_amount: 2400 });
      expect(plan.target?.expected).toEqual({ quantity: 30, invested_amount: 900 });
    });

    it('chuyển giao dịch mới nhất sang mã chưa có giao dịch ⇒ áp lên số đang có', () => {
      const plan = planStockTxEdit(chain, 'c', { side: 'SELL', quantity: 5, price_thousand: 40, amount_thousand: 200 },
        { stockId: 'S3', current: { quantity: 10, invested_amount: 100 } });
      expect(plan.source.updates).toEqual([]);
      expect(plan.source.final).toEqual({ quantity: 150, invested_amount: 3500 }); // = TRƯỚC của c
      expect(plan.target?.expected).toEqual({ quantity: 10, invested_amount: 100 });
      expect(plan.target?.final).toEqual({ quantity: 5, invested_amount: 50 });
    });

    it('mã mới không đủ cổ để bán ⇒ báo lỗi của chính giao dịch', () => {
      expect(() => planStockTxEdit(chain, 'c', { side: 'SELL', quantity: 60, price_thousand: 40, amount_thousand: 2400 },
        { stockId: 'S3', current: { quantity: 10, invested_amount: 100 } })).toThrow(/chỉ đang có 10/);
    });

    it('truyền move với chính mã cũ ⇒ coi như không đổi mã', () => {
      const plan = planStockTxEdit(chain, 'c', { side: 'SELL', quantity: 60, price_thousand: 40, amount_thousand: 2400 },
        { stockId: 'S1', current: { quantity: 90, invested_amount: 2100 } });
      expect(plan.target).toBeNull();
    });
  });
});

describe('planStockTxDelete', () => {
  const chain: RecordedStockTx[] = [
    { id: 'a', stock_id: 'S1', created_at: '2026-01-01T00:00:00Z', trade_date: '2026-01-01', side: 'BUY', quantity: 100, price_thousand: 20, amount_thousand: 2000,
      before_quantity: 0, before_invested_amount: 0, after_quantity: 100, after_invested_amount: 2000 },
    { id: 'b', stock_id: 'S1', created_at: '2026-01-02T00:00:00Z', trade_date: '2026-01-02', side: 'BUY', quantity: 50, price_thousand: 30, amount_thousand: 1500,
      before_quantity: 100, before_invested_amount: 2000, after_quantity: 150, after_invested_amount: 3500 },
    { id: 'c', stock_id: 'S1', created_at: '2026-01-03T00:00:00Z', trade_date: '2026-01-03', side: 'SELL', quantity: 60, price_thousand: 40, amount_thousand: 2400,
      before_quantity: 150, before_invested_amount: 3500, after_quantity: 90, after_invested_amount: 2100 },
  ];

  it('xoá giao dịch ở giữa ⇒ giao dịch sau tính lại như thể nó chưa từng có', () => {
    const plan = planStockTxDelete(chain, 'b');
    expect(plan.updates.map((u) => u.id)).toEqual(['c']);
    expect(plan.updates[0].before).toEqual({ quantity: 100, invested_amount: 2000 });
    expect(plan.final).toEqual({ quantity: 40, invested_amount: 800 });
    expect(plan.expected).toEqual({ quantity: 90, invested_amount: 2100 });
  });

  it('xoá giao dịch mới nhất = hoàn tác', () => {
    const plan = planStockTxDelete(chain, 'c');
    expect(plan.updates).toEqual([]);
    expect(plan.final).toEqual({ quantity: 150, invested_amount: 3500 });
  });

  it('xoá lần mua làm lệnh bán sau thành bán quá ⇒ từ chối, nói rõ', () => {
    expect(() => planStockTxDelete(chain, 'a')).toThrow(/bán 60 cổ ngày 03\/01\/2026 phía sau không còn hợp lệ/);
  });
});

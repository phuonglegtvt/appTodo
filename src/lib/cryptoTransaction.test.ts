import { describe, it, expect } from 'vitest';
import { applyTx, holdingMatches, validateTx, planCryptoTxEdit, planCryptoTxDelete, type RecordedCryptoTx } from './cryptoTransaction';
import type { Holding } from './cryptoTransaction';

const trong: Holding = { quantity: null, avg_buy_price: null, invested_amount: null };

describe('applyTx — MUA', () => {
  it('coin chưa có gì: giá TB = giá mua, vốn = số tiền', () => {
    const { after, realizedPnlVnd } = applyTx(trong, {
      side: 'BUY', quantity: 0.5, price_usd: 60_000, amount_vnd: 780_000_000,
    });
    expect(after).toEqual({ quantity: 0.5, avg_buy_price: 60_000, invested_amount: 780_000_000 });
    expect(realizedPnlVnd).toBeNull();
  });

  it('cộng dồn lên số cũ: giá TB bình quân gia quyền, vốn cộng thêm', () => {
    // 1 coin @ 50k + 1 coin @ 70k ⇒ 2 coin @ 60k.
    const { after } = applyTx(
      { quantity: 1, avg_buy_price: 50_000, invested_amount: 1_300_000_000 },
      { side: 'BUY', quantity: 1, price_usd: 70_000, amount_vnd: 1_800_000_000 },
    );
    expect(after.quantity).toBe(2);
    expect(after.avg_buy_price).toBe(60_000);
    expect(after.invested_amount).toBe(3_100_000_000);
  });

  it('đang giữ mà thiếu giá TB → ném lỗi, không đoán', () => {
    expect(() => applyTx(
      { quantity: 1, avg_buy_price: null, invested_amount: 1_000 },
      { side: 'BUY', quantity: 1, price_usd: 10, amount_vnd: 260_000 },
    )).toThrow(/giá mua TB/);
  });

  it('đang giữ mà chưa nhập "Đã đầu tư" → ném lỗi', () => {
    expect(() => applyTx(
      { quantity: 1, avg_buy_price: 10, invested_amount: null },
      { side: 'BUY', quantity: 1, price_usd: 10, amount_vnd: 260_000 },
    )).toThrow(/Đã đầu tư/);
  });

  it('đã bán hết trước đó (quantity 0): mua lại bắt đầu giá TB mới', () => {
    const { after } = applyTx(
      { quantity: 0, avg_buy_price: 40_000, invested_amount: 0 },
      { side: 'BUY', quantity: 1, price_usd: 90_000, amount_vnd: 2_340_000_000 },
    );
    expect(after.avg_buy_price).toBe(90_000);
    expect(after.invested_amount).toBe(2_340_000_000);
  });
});

describe('applyTx — BÁN', () => {
  const dangCo: Holding = { quantity: 2, avg_buy_price: 60_000, invested_amount: 3_000_000_000 };

  it('bán một phần: giá TB giữ nguyên, vốn giảm theo tỷ lệ, ra lãi/lỗ đã chốt', () => {
    const { after, realizedPnlVnd } = applyTx(dangCo, {
      side: 'SELL', quantity: 0.5, price_usd: 80_000, amount_vnd: 1_000_000_000,
    });
    expect(after.quantity).toBe(1.5);
    expect(after.avg_buy_price).toBe(60_000);
    expect(after.invested_amount).toBe(2_250_000_000); // 3 tỷ × 1,5/2
    expect(realizedPnlVnd).toBe(250_000_000);          // 1 tỷ − 750tr vốn
  });

  it('bán hết: số lượng và vốn về đúng 0, kể cả có sai số làm tròn', () => {
    const { after, realizedPnlVnd } = applyTx(
      { quantity: 0.1 + 0.2, avg_buy_price: 100, invested_amount: 780_000 },
      { side: 'SELL', quantity: 0.3, price_usd: 90, amount_vnd: 700_000 },
    );
    expect(after.quantity).toBe(0);
    expect(after.invested_amount).toBe(0);
    expect(realizedPnlVnd).toBe(-80_000);
  });

  it('bán nhiều hơn số đang có → ném lỗi', () => {
    expect(() => applyTx(dangCo, {
      side: 'SELL', quantity: 3, price_usd: 80_000, amount_vnd: 1,
    })).toThrow(/Không thể bán/);
  });

  it('chưa nhập vốn: vẫn bán được, nhưng lãi/lỗ = null (không bịa số)', () => {
    const { after, realizedPnlVnd } = applyTx(
      { quantity: 2, avg_buy_price: 10, invested_amount: null },
      { side: 'SELL', quantity: 1, price_usd: 12, amount_vnd: 300_000 },
    );
    expect(after.quantity).toBe(1);
    expect(after.invested_amount).toBeNull();
    expect(realizedPnlVnd).toBeNull();
  });
});

describe('validateTx', () => {
  it('chặn số lượng / giá ≤ 0, NaN, và số tiền âm', () => {
    const ok = { side: 'BUY' as const, quantity: 1, price_usd: 1, amount_vnd: 0 };
    expect(() => validateTx(ok)).not.toThrow();
    expect(() => validateTx({ ...ok, quantity: 0 })).toThrow(/Số lượng/);
    expect(() => validateTx({ ...ok, quantity: Number.NaN })).toThrow(/Số lượng/);
    expect(() => validateTx({ ...ok, price_usd: -1 })).toThrow(/Giá/);
    expect(() => validateTx({ ...ok, amount_vnd: -5 })).toThrow(/Số tiền/);
  });
});

describe('holdingMatches', () => {
  it('khớp khi chỉ lệch sai số dấu phẩy động', () => {
    expect(holdingMatches(
      { quantity: 0.30000000000000004, avg_buy_price: 10, invested_amount: 5 },
      { quantity: 0.3, avg_buy_price: 10, invested_amount: 5 },
    )).toBe(true);
  });

  it('không khớp khi đã bị sửa tay, hoặc null ≠ 0', () => {
    expect(holdingMatches(
      { quantity: 2, avg_buy_price: 10, invested_amount: 5 },
      { quantity: 1, avg_buy_price: 10, invested_amount: 5 },
    )).toBe(false);
    expect(holdingMatches(
      { quantity: 1, avg_buy_price: 10, invested_amount: null },
      { quantity: 1, avg_buy_price: 10, invested_amount: 0 },
    )).toBe(false);
  });
});

describe('planCryptoTxEdit', () => {
  const h = (quantity: number, avg: number, invested: number) => ({ quantity, avg_buy_price: avg, invested_amount: invested });
  // BTC: mua 1 @100 (2.500.000đ) → mua 1 @200 (5.000.000đ). ETH: chưa có giao dịch, đang giữ 0.
  const all: RecordedCryptoTx[] = [
    { id: 'a', crypto_id: 'BTC', created_at: '2026-01-01T00:00:00Z', trade_date: '2026-01-01', side: 'BUY', quantity: 1, price_usd: 100, amount_vnd: 2_500_000,
      before: { quantity: 0, avg_buy_price: null, invested_amount: 0 }, after: h(1, 100, 2_500_000) },
    { id: 'b', crypto_id: 'BTC', created_at: '2026-01-02T00:00:00Z', trade_date: '2026-01-02', side: 'BUY', quantity: 1, price_usd: 200, amount_vnd: 5_000_000,
      before: h(1, 100, 2_500_000), after: h(2, 150, 7_500_000) },
  ];

  it('sửa giá lần mua đầu ⇒ giá mua TB của lần sau tính lại', () => {
    const { source } = planCryptoTxEdit(all, 'a', { side: 'BUY', quantity: 1, price_usd: 300, amount_vnd: 7_500_000 });
    expect(source.updates.map((u) => u.id)).toEqual(['a', 'b']);
    expect(source.final).toEqual(h(2, 250, 12_500_000));
    expect(source.expected).toEqual(h(2, 150, 7_500_000));
  });

  it('xoá lần mua đầu ⇒ giá mua TB chỉ còn của lần sau', () => {
    const plan = planCryptoTxDelete(all, 'a');
    expect(plan.final).toEqual(h(1, 200, 5_000_000));
  });

  it('chuyển lần mua mới nhất sang ETH', () => {
    const plan = planCryptoTxEdit(all, 'b', { side: 'BUY', quantity: 1, price_usd: 200, amount_vnd: 5_000_000 },
      { cryptoId: 'ETH', current: { quantity: 0, avg_buy_price: null, invested_amount: null } });
    expect(plan.source.final).toEqual(h(1, 100, 2_500_000));
    expect(plan.target?.final).toEqual(h(1, 200, 5_000_000));
  });
});

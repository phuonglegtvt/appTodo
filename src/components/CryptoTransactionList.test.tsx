import { describe, it, expect } from 'vitest';
import { latestTxIds } from './CryptoTransactionList';
import type { CryptoTransaction } from '../types/cryptoTransaction';

function tx(id: string, crypto_id: string, created_at: string): CryptoTransaction {
  return {
    id, user_id: 'u1', crypto_id, side: 'BUY', trade_date: '2026-11-01',
    quantity: 1, price_usd: 1, amount_vnd: 1, note: '',
    before_quantity: null, before_avg_buy_price: null, before_invested_amount: null,
    after_quantity: 1, after_avg_buy_price: 1, after_invested_amount: 1,
    realized_pnl_vnd: null, created_at,
  };
}

describe('latestTxIds', () => {
  it('chọn giao dịch ghi SAU CÙNG của từng coin (theo thời điểm ghi, không theo ngày giao dịch)', () => {
    const ids = latestTxIds([
      tx('a1', 'btc', '2026-11-26T10:00:00Z'),
      tx('a2', 'btc', '2026-11-26T11:00:00Z'),
      tx('b1', 'eth', '2026-11-20T09:00:00Z'),
    ]);
    expect([...ids].sort()).toEqual(['a2', 'b1']);
  });

  it('danh sách rỗng → không có gì để hoàn tác', () => {
    expect(latestTxIds([]).size).toBe(0);
  });
});

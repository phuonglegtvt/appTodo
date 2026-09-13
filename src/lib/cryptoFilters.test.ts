import { describe, it, expect } from 'vitest';
import { filterCryptos } from './cryptoFilters';
import type { Crypto } from '../types/crypto';

function mk(symbol: string, name: string): Crypto {
  return {
    id: symbol, user_id: 'u', symbol, name,
    quantity: null, avg_buy_price: null, current_price: null, peak_price: null,
    invested_amount: null, sort_order: 0, created_at: '', updated_at: '',
  };
}

const list = [mk('BTC', 'Bitcoin'), mk('ETH', 'Ethereum'), mk('BNB', 'Binance Coin')];

describe('filterCryptos', () => {
  it('query rỗng → trả nguyên danh sách', () => {
    expect(filterCryptos(list, '   ')).toHaveLength(3);
  });
  it('khớp theo mã, không phân biệt hoa/thường', () => {
    expect(filterCryptos(list, 'btc').map((c) => c.symbol)).toEqual(['BTC']);
  });
  it('khớp theo tên', () => {
    expect(filterCryptos(list, 'ethereum').map((c) => c.symbol)).toEqual(['ETH']);
  });
  it('khớp một phần trên cả mã lẫn tên', () => {
    expect(filterCryptos(list, 'bin').map((c) => c.symbol)).toEqual(['BNB']);
  });
});

import { describe, it, expect } from 'vitest';
import { filterStocks } from './stockFilters';
import type { Stock } from '../types/stock';

function stock(over: Partial<Stock>): Stock {
  return {
    id: '1', user_id: 'u', ticker: 'ACB', company_name: 'Ngân hàng Á Châu',
    group: 'attack', price_threshold: null, price_protect: null,
    current_price: null, dividend: null, invested_amount: null,
    sort_order: 0, created_at: '', updated_at: '', ...over,
  };
}

describe('filterStocks', () => {
  const list = [
    stock({ id: '1', ticker: 'ACB', company_name: 'Ngân hàng Á Châu' }),
    stock({ id: '2', ticker: 'HPG', company_name: 'Tập đoàn Hòa Phát' }),
  ];

  it('query rỗng trả nguyên danh sách', () => {
    expect(filterStocks(list, '')).toHaveLength(2);
    expect(filterStocks(list, '   ')).toHaveLength(2);
  });
  it('lọc theo mã, không phân biệt hoa thường', () => {
    const r = filterStocks(list, 'hpg');
    expect(r).toHaveLength(1);
    expect(r[0].ticker).toBe('HPG');
  });
  it('lọc theo tên công ty', () => {
    const r = filterStocks(list, 'hòa phát');
    expect(r).toHaveLength(1);
    expect(r[0].ticker).toBe('HPG');
  });
  it('không khớp trả mảng rỗng', () => {
    expect(filterStocks(list, 'xyz')).toHaveLength(0);
  });
});

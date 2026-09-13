// Bảng cổ phiếu phải MỞ RA ĐÃ sắp sẵn theo "% so ngưỡng" — mã rẻ hơn ngưỡng
// nhiều nhất lên đầu, tức mã đáng mua nhất nằm ngay tầm mắt.

import { describe, expect, test, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { StockTable } from './StockTable';
import type { Stock } from '../types/stock';

function stock(over: Partial<Stock>): Stock {
  return {
    id: 'id', user_id: 'u', ticker: 'AAA', company_name: 'Cty', group: 'attack',
    price_threshold: null, price_protect: null, current_price: null, dividend: null,
    invested_amount: null, quantity: null, peak_price: null, sort_order: 0,
    created_at: '', updated_at: '',
    ...over,
  };
}

/** Mã theo đúng thứ tự đang hiện trên bảng. */
function maTheoThuTu(): string[] {
  const tbody = screen.getAllByRole('rowgroup')[1];
  return within(tbody).getAllByRole('row')
    .map((tr) => tr.querySelector('td')?.textContent ?? '');
}

function ve(stocks: Stock[]) {
  render(<StockTable stocks={stocks} onUpdate={vi.fn()} onDelete={vi.fn()} />);
}

describe('StockTable — sắp xếp mặc định', () => {
  // thứ tự truyền vào cố tình ngược với thứ tự mong đợi, để nếu bảng KHÔNG sort
  // mà chỉ hiện nguyên đầu vào thì test vẫn đỏ.
  const ds = [
    stock({ id: '1', ticker: 'DAT', current_price: 60, price_threshold: 40 }),   // +50%
    stock({ id: '2', ticker: 'GAN', current_price: 39, price_threshold: 40 }),   // −2.5%
    stock({ id: '3', ticker: 'RE', current_price: 30, price_threshold: 40 }),    // −25%
  ];

  test('mở ra đã sắp sẵn: rẻ hơn ngưỡng nhiều nhất lên đầu', () => {
    ve(ds);
    expect(maTheoThuTu()).toEqual(['RE', 'GAN', 'DAT']);
  });

  test('mã chưa có giá xuống cuối, không chen lên đầu', () => {
    ve([...ds, stock({ id: '4', ticker: 'TRONG', current_price: null, price_threshold: 40 })]);
    expect(maTheoThuTu()).toEqual(['RE', 'GAN', 'DAT', 'TRONG']);
  });

  test('tiêu đề "% so ngưỡng" báo đang sort tăng dần ngay khi mở', () => {
    ve(ds);
    const th = screen.getAllByRole('columnheader')
      .find((e) => e.textContent?.includes('% so ngưỡng'));
    expect(th).toHaveAttribute('aria-sort', 'ascending');
  });
});

describe('StockTable — bỏ dấu trừ ở hai cột phần trăm', () => {
  test('% so ngưỡng âm hiện không có dấu trừ', () => {
    ve([stock({ ticker: 'RE', current_price: 30, price_threshold: 40 })]);
    const tbody = screen.getAllByRole('rowgroup')[1];
    expect(within(tbody).getByText('25.0%')).toBeInTheDocument();
  });

  test('% so ngưỡng dương VẪN giữ dấu cộng', () => {
    ve([stock({ ticker: 'DAT', current_price: 60, price_threshold: 40 })]);
    const tbody = screen.getAllByRole('rowgroup')[1];
    expect(within(tbody).getByText('+50.0%')).toBeInTheDocument();
  });

  test('% so đỉnh âm hiện không có dấu trừ', () => {
    ve([stock({ ticker: 'X', current_price: 21.3, peak_price: 29.89 })]);
    const tbody = screen.getAllByRole('rowgroup')[1];
    expect(within(tbody).getByText('28.7%')).toBeInTheDocument();
  });
});

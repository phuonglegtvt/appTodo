import type { Stock } from '../types/stock';

/** Lọc mã có ticker HOẶC tên công ty chứa từ khóa (không phân biệt hoa/thường). */
export function filterStocks(stocks: Stock[], query: string): Stock[] {
  const q = query.trim().toLowerCase();
  if (!q) return stocks;
  return stocks.filter(
    (s) =>
      s.ticker.toLowerCase().includes(q) ||
      s.company_name.toLowerCase().includes(q),
  );
}

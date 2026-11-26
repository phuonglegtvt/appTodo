// Khai báo cột của bảng Cổ phiếu: nhãn tiêu đề + cách lấy giá trị để sort.
// Hàm THUẦN, không I/O, không React.
//
// Đây là NGUỒN DUY NHẤT cho nhãn tiêu đề. Trước đây nhãn nằm cứng trong
// StockTable còn giá trị nằm trong StockRow — hai chỗ, không gì ràng chúng
// với nhau.

import type { Stock } from '../types/stock';
import type { ColumnDef, SortValue } from './tableSort';
import { computeYield } from './stockCalc';
import { drawdownFromPeakPct, gapToPricePct } from './peakDrawdown';
import { avgCostThousand } from './stockTransaction';

export type StockSortKey =
  | 'ticker' | 'company_name' | 'price_threshold' | 'gap_threshold' | 'price_protect'
  | 'current_price' | 'peak_price' | 'drawdown' | 'dividend' | 'yield'
  | 'invested_amount' | 'quantity' | 'avg_cost';

/**
 * Cách lấy giá trị SO SÁNH của từng cột.
 *
 * ⚠️ Bốn cột `gap_threshold` / `drawdown` / `yield` không có trong bảng DB —
 * chúng được TÍNH ra. Phải sort theo số đã tính, không theo chuỗi hiển thị:
 * so chuỗi thì '-38.7%' đứng trước '-9.1%' vì ký tự '3' < '9'.
 *
 * Trả thẳng `null` khi thiếu dữ liệu (các hàm tính đã lo) — `sortRows` đẩy
 * null xuống cuối.
 */
const GIA_TRI: Record<StockSortKey, (s: Stock) => SortValue> = {
  ticker: (s) => s.ticker,
  company_name: (s) => s.company_name,
  price_threshold: (s) => s.price_threshold,
  gap_threshold: (s) => gapToPricePct(s.current_price, s.price_threshold),
  price_protect: (s) => s.price_protect,
  current_price: (s) => s.current_price,
  peak_price: (s) => s.peak_price,
  drawdown: (s) => drawdownFromPeakPct(s.current_price, s.peak_price),
  dividend: (s) => s.dividend,
  yield: (s) => computeYield(s),
  invested_amount: (s) => s.invested_amount,
  quantity: (s) => s.quantity,
  avg_cost: (s) => avgCostThousand(s),
};

/**
 * Thứ tự ở đây quyết định thứ tự tiêu đề bảng, nên PHẢI khớp thứ tự `<td>`
 * trong StockRow. Có một test khoá đúng danh sách nhãn này lại để lệch cột
 * thì test đỏ chứ không âm thầm hiện sai nhãn.
 */
const NHAN: [StockSortKey, string][] = [
  ['ticker', 'Mã'],
  ['company_name', 'Tên công ty'],
  ['price_threshold', 'Giá ngưỡng'],
  ['gap_threshold', '% so ngưỡng'],
  ['price_protect', 'Giá bảo vệ'],
  ['current_price', 'Giá hiện tại'],
  ['peak_price', 'Đỉnh LS'],
  ['drawdown', '% so đỉnh'],
  ['dividend', 'Cổ tức'],
  ['yield', 'Tỷ suất'],
  ['invested_amount', 'Đã đầu tư'],
  ['quantity', 'Số lượng'],
  ['avg_cost', 'Giá vốn TB'],
];

export const STOCK_COLUMNS: ColumnDef<Stock, StockSortKey>[] = NHAN.map(([key, label]) => ({
  key,
  label,
  value: GIA_TRI[key],
}));

export function stockSortValue(s: Stock, k: StockSortKey): SortValue {
  return GIA_TRI[k](s);
}

// Khai báo cột của bảng Crypto: nhãn tiêu đề + cách lấy giá trị để sort.
// Hàm THUẦN, không I/O, không React.
//
// ⚠️ KHÔNG cần tỷ giá USD→VND. Giá trị và lời/lỗ sort theo USD; quy đổi sang
// VND là nhân một hằng số DƯƠNG nên không đổi thứ tự. Giữ module này thuần
// nghĩa là sort vẫn chạy đúng cả khi mạng không lấy được tỷ giá.

import type { Crypto } from '../types/crypto';
import type { ColumnDef, SortValue } from './tableSort';
import { pnl, value } from './cryptoCalc';
import { drawdownFromPeakPct } from './peakDrawdown';

export type CryptoSortKey =
  | 'symbol' | 'name' | 'quantity' | 'avg_buy_price' | 'current_price'
  | 'peak_price' | 'drawdown' | 'invested_amount' | 'value' | 'pnl';

const GIA_TRI: Record<CryptoSortKey, (c: Crypto) => SortValue> = {
  symbol: (c) => c.symbol,
  // Tên rỗng hiện ra là '—' nên phải xử như ô trống. Để nguyên chuỗi rỗng thì
  // nó sort lên đầu bảng, ngược hẳn với thứ mắt người đọc thấy.
  name: (c) => c.name || null,
  quantity: (c) => c.quantity,
  avg_buy_price: (c) => c.avg_buy_price,
  current_price: (c) => c.current_price,
  peak_price: (c) => c.peak_price,
  drawdown: (c) => drawdownFromPeakPct(c.current_price, c.peak_price),
  // VND đồng tuyệt đối, KHÔNG quy đổi — khác mọi cột giá của bảng này (USD).
  // Chưa nhập ⇒ null (xuống cuối), KHÔNG suy ra từ quantity × giá mua: cột
  // hiển thị '—' nên sort phải khớp thứ mắt nhìn thấy.
  invested_amount: (c) => c.invested_amount,
  value: (c) => value(c),
  pnl: (c) => pnl(c),
};

/** Thứ tự PHẢI khớp thứ tự `<td>` trong CryptoRow — có test khoá lại. */
const NHAN: [CryptoSortKey, string][] = [
  ['symbol', 'Mã'],
  ['name', 'Tên'],
  ['quantity', 'Số lượng'],
  ['avg_buy_price', 'Giá mua TB'],
  ['current_price', 'Giá hiện tại'],
  ['peak_price', 'Đỉnh LS'],
  ['drawdown', '% so đỉnh'],
  ['invested_amount', 'Đã đầu tư (đ)'],
  ['value', 'Giá trị'],
  ['pnl', 'Lời/Lỗ'],
];

export const CRYPTO_COLUMNS: ColumnDef<Crypto, CryptoSortKey>[] = NHAN.map(([key, label]) => ({
  key,
  label,
  value: GIA_TRI[key],
}));

export function cryptoSortValue(c: Crypto, k: CryptoSortKey): SortValue {
  return GIA_TRI[k](c);
}

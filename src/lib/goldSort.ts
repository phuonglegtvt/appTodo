// Khai báo cột của bảng Vàng: nhãn tiêu đề + cách lấy giá trị để sort.
// Hàm THUẦN, không I/O, không React.
//
// ⚠️ ĐƠN VỊ: giá vàng là ĐỒNG trên MỘT LƯỢNG (khác `stocks` lưu nghìn đồng).
// Không nhân 1.000 ở đây.

import type { Gold } from '../types/gold';
import type { ColumnDef, SortValue } from './tableSort';

export type GoldSortKey =
  | 'label' | 'quantity' | 'avg_buy_price' | 'current_price' | 'invested_amount' | 'value';

const GIA_TRI: Record<GoldSortKey, (g: Gold) => SortValue> = {
  label: (g) => g.label,
  quantity: (g) => g.quantity,
  avg_buy_price: (g) => g.avg_buy_price,
  current_price: (g) => g.current_price,
  // VND đồng tuyệt đối. Chưa nhập ⇒ null (xuống cuối), KHÔNG suy ra từ
  // quantity × giá mua — cột hiển thị '—' nên sort phải khớp.
  invested_amount: (g) => g.invested_amount,
  // Cùng công thức GoldTable đang vẽ. Thiếu một vế ⇒ null, KHÔNG quy về 0đ.
  value: (g) => (g.quantity !== null && g.current_price !== null
    ? g.quantity * g.current_price
    : null),
};

/** Thứ tự PHẢI khớp thứ tự `<td>` trong GoldTable — có test khoá lại. */
const NHAN: [GoldSortKey, string][] = [
  ['label', 'Loại'],
  ['quantity', 'Số lượng'],
  ['avg_buy_price', 'Giá mua TB (đ/lượng)'],
  ['current_price', 'Giá hiện tại (đ/lượng)'],
  ['invested_amount', 'Đã đầu tư (đ)'],
  ['value', 'Giá trị'],
];

export const GOLD_COLUMNS: ColumnDef<Gold, GoldSortKey>[] = NHAN.map(([key, label]) => ({
  key,
  label,
  value: GIA_TRI[key],
}));

export function goldSortValue(g: Gold, k: GoldSortKey): SortValue {
  return GIA_TRI[k](g);
}

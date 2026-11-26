// Thứ tự các bảng nhóm cổ phiếu do người dùng tự sắp (nút ▲▼). Hàm THUẦN.

import { STOCK_GROUPS } from './stockCalc';
import type { StockGroup } from '../types/stock';

/**
 * Đọc thứ tự đã lưu một cách an toàn: bỏ giá trị lạ / trùng, và nhóm nào chưa
 * có trong bản lưu (VD thêm nhóm mới sau này) thì nối vào cuối theo thứ tự mặc
 * định — để không nhóm nào biến mất khỏi màn hình chỉ vì bản lưu đã cũ.
 */
export function normalizeGroupOrder(saved: unknown): StockGroup[] {
  const out: StockGroup[] = [];
  if (Array.isArray(saved)) {
    for (const g of saved) {
      if ((STOCK_GROUPS as unknown[]).includes(g) && !out.includes(g as StockGroup)) {
        out.push(g as StockGroup);
      }
    }
  }
  for (const g of STOCK_GROUPS) {
    if (!out.includes(g)) out.push(g);
  }
  return out;
}

/**
 * Đổi chỗ nhóm `g` với nhóm ĐANG HIỆN liền trên (-1) hoặc liền dưới (+1).
 * Nhóm trống thì bảng bị ẩn; đổi chỗ với một bảng ẩn thì người dùng bấm mà
 * không thấy gì thay đổi — nên bỏ qua chúng. `visible` mặc định = tất cả.
 * Ở mép thì giữ nguyên.
 */
export function moveGroup(
  order: StockGroup[], g: StockGroup, dir: -1 | 1, visible: StockGroup[] = order,
): StockGroup[] {
  const hien = order.filter((x) => visible.includes(x));
  const k = hien.indexOf(g);
  const hangXom = hien[k + dir];
  if (k < 0 || hangXom === undefined) return order;
  const i = order.indexOf(g);
  const j = order.indexOf(hangXom);
  const next = [...order];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

// Nhãn tiếng Việt + màu của bốn nhóm tài sản. MỘT nguồn sự thật cho cả biểu đồ,
// legend và bảng — để màu không bao giờ lệch giữa ba chỗ đó.
//
// MÀU: mã màu thật khai trong src/index.css (hai bậc light/dark), ở đây chỉ trỏ
// tới biến CSS. Palette đã chạy qua validator của skill dataviz và PASS mọi
// check ở cả light và dark (lightness band, chroma floor, CVD separation,
// normal-vision floor, contrast). Light mode có WARN contrast (#eda100 2.17:1)
// — hợp lệ vì biểu đồ luôn kèm legend có nhãn chữ VÀ bảng số ngay dưới, đúng
// "relief required: visible labels or table view".
//
// ⚠️ Màu gán theo NHÓM, không theo thứ hạng: lọc bớt một nhóm không được làm
// các nhóm còn lại đổi màu. Vì vậy tra theo key, không tra theo index.

import type { AssetClass } from '../domain/types';

export interface ClassMeta {
  label: string;
  /**
   * Biến CSS chứa màu của nhóm. Trỏ tới biến chứ KHÔNG nhúng mã màu: biến được
   * khai hai bậc (light + dark) trong src/index.css nên biểu đồ tự đổi màu theo
   * theme mà không cần component biết theme hiện tại là gì.
   */
  colorVar: string;
}

export const CLASS_META: Record<AssetClass, ClassMeta> = {
  STOCKS: { label: 'Cổ phiếu', colorVar: 'var(--viz-stocks)' },
  CRYPTO: { label: 'Crypto',   colorVar: 'var(--viz-crypto)' },
  GOLD:   { label: 'Vàng',     colorVar: 'var(--viz-gold)' },
  CASH:   { label: 'Tiền mặt', colorVar: 'var(--viz-cash)' },
};

/** Định dạng VND tuyệt đối. Đơn vị trong toàn module là ĐỒNG. */
export function formatVnd(amount: number): string {
  return Math.round(amount).toLocaleString('vi-VN') + ' đ';
}

/** Rút gọn cho nhãn chật: 1.087.500.000 → "1,09 tỷ". */
export function formatVndShort(amount: number): string {
  const abs = Math.abs(amount);
  if (abs >= 1_000_000_000) return (amount / 1_000_000_000).toFixed(2) + ' tỷ';
  if (abs >= 1_000_000) return (amount / 1_000_000).toFixed(1) + ' tr';
  if (abs >= 1_000) return Math.round(amount / 1_000) + ' ng';
  return String(Math.round(amount));
}

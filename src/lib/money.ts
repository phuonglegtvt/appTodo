import type { Currency } from '../types/crypto';

/**
 * Định dạng số tiền (lưu theo USD) để hiển thị.
 * - VND + có tỷ giá: nhân tỷ giá, làm tròn, hậu tố " đ" (định dạng nhóm ngàn kiểu VN).
 * - USD, hoặc VND nhưng chưa có tỷ giá: hiển thị "$" (tối đa 2 số lẻ).
 */
export function formatMoney(usdAmount: number, currency: Currency, rate: number | null): string {
  if (currency === 'VND' && rate != null) {
    return Math.round(usdAmount * rate).toLocaleString('vi-VN') + ' đ';
  }
  return '$' + usdAmount.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

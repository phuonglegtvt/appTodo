/** Chuỗi rỗng → null; ngược lại parse số (chấp nhận dấu phẩy thập phân kiểu VN). */
export function parseVnNumber(v: string): number | null {
  const t = v.trim().replace(',', '.');
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/**
 * Đọc một ô nhập SỐ TIỀN VND. Khác `parseVnNumber` ở chỗ chấp nhận dấu phân cách
 * nghìn theo cách người Việt gõ thật: `3.000.000`, `3,000,000`, `3 000 000 đ`.
 *
 * `parseVnNumber` không dùng được cho ô tiền: nó chỉ thay dấu phẩy ĐẦU TIÊN nên
 * `Number('3.000.000')` ra NaN ⇒ app báo "không phải số" với một con số hoàn
 * toàn hợp lệ.
 *
 * Đồng không có số lẻ nên phần thập phân bị bỏ. Dấu trừ được GIỮ (không nuốt):
 * bỏ dấu thì `-5.000.000` lặng lẽ thành `5.000.000` rồi lưu vào DB; giữ lại để
 * guard ở tầng trên từ chối với đúng lý do "không thể âm".
 *
 * Không có chữ số nào → `null`, KHÔNG phải 0 — "abc" thành 0 đồng là kiểu lỗi
 * người dùng tưởng đã lưu đúng.
 */
export function parseVndAmount(v: string): number | null {
  const am = v.trim().startsWith('-');
  // Cắt phần thập phân trước khi bỏ dấu phân cách, nếu không "3.000.000,5" sẽ
  // thành 30000005.
  const nguyen = v.split(/[.,]\d{1,2}$/)[0];
  const chuSo = nguyen.replace(/\D/g, '');
  if (chuSo === '') return null;
  const n = Number(chuSo);
  if (!Number.isFinite(n)) return null;
  return am ? -n : n;
}

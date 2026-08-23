// Đỉnh lịch sử và mức giảm so với đỉnh — hàm THUẦN, không I/O.
//
// ĐƠN VỊ: hàm ở đây KHÔNG quan tâm đơn vị, chỉ đòi `current` và `peak` cùng một
// đơn vị. Cổ phiếu dùng NGHÌN ĐỒNG (như `stocks.current_price`), crypto dùng USD
// (như `cryptos.current_price`). Không quy đổi gì ở đây.

/** Số dương hữu hạn — điều kiện để một con số được coi là "một mức giá". */
function laGiaHopLe(v: number | null | undefined): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v > 0;
}

/**
 * % so với đỉnh = (giá hiện tại − đỉnh) / đỉnh × 100.
 *   · âm    → đang thấp hơn đỉnh bấy nhiêu % (ca thường gặp)
 *   · 0     → đang đúng ở đỉnh
 *   · dương → giá đã vượt đỉnh đang lưu, tức cột đỉnh đã cũ. KHÔNG kẹp về 0:
 *             kẹp lại sẽ che mất chuyện dữ liệu đỉnh cần cập nhật.
 *
 * `null` khi thiếu giá, thiếu đỉnh, hoặc đỉnh ≤ 0. Trả `null` chứ KHÔNG trả 0%:
 * "không biết" khác hẳn "đang ở đỉnh".
 */
export function drawdownFromPeakPct(
  current: number | null | undefined,
  peak: number | null | undefined,
): number | null {
  if (!laGiaHopLe(peak)) return null;
  if (typeof current !== 'number' || !Number.isFinite(current)) return null;
  return ((current - peak) / peak) * 100;
}

/**
 * Đỉnh mới = ứng viên hợp lệ LỚN NHẤT. Dùng khi ghi `peak_price`.
 *
 * Vì sao chỉ được TĂNG: đỉnh lịch sử theo định nghĩa không giảm. Một lần nguồn
 * giá trả thiếu (dchart chưa có đủ lịch sử, CoinGecko không có coin đó) hoặc một
 * lần mạng lỗi mà đạp đỉnh xuống thì số liệu cũ đúng bị mất luôn, không lấy lại
 * được. Đỉnh nhập tay cao hơn đỉnh API cũng vì thế mà được giữ.
 *
 * Bỏ qua null/undefined/NaN/Infinity và mọi số ≤ 0 — giá ≤ 0 không phải một đỉnh.
 * `null` khi không ứng viên nào hợp lệ.
 */
export function nextPeak(...candidates: (number | null | undefined)[]): number | null {
  const hopLe = candidates.filter(laGiaHopLe);
  return hopLe.length === 0 ? null : Math.max(...hopLe);
}

// Tiện ích số/ngày cho tầng domain. Hàm thuần, không import gì.

/**
 * Làm tròn XUỐNG bội số của `step`. Dùng để không sinh lệnh mua lẻ đồng.
 * `step <= 0` → trả nguyên giá trị (không chia cho 0).
 */
export function roundDownTo(value: number, step: number): number {
  if (step <= 0) return value;
  return Math.floor(value / step) * step;
}

/** Tổng một danh sách số tiền VND. Mảng rỗng → 0. */
export function sumVnd(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0);
}

/**
 * Số ngày từ `fromIso` tới `toIso`, tính theo NGÀY LỊCH (bỏ phần giờ)
 * để không bị lệch vì múi giờ hay giờ trong ngày. Âm nếu `toIso` sớm hơn.
 *
 * Dùng Date.parse trên chuỗi truyền vào — KHÔNG phải Date.now(), nên vẫn
 * tái lập được hoàn toàn.
 */
export function daysBetween(fromIso: string, toIso: string): number {
  const dayOf = (iso: string): number => {
    const ms = Date.parse(iso.slice(0, 10));
    if (Number.isNaN(ms)) {
      throw new Error(`Ngày không hợp lệ: "${iso}". Cần định dạng ISO (YYYY-MM-DD).`);
    }
    return Math.round(ms / 86_400_000);
  };
  return dayOf(toIso) - dayOf(fromIso);
}

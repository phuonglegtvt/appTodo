// §9 — đo mức sụt giảm. Hàm thuần, dùng chung cho benchmark và cho danh mục.
//
// Phân biệt hai con số dễ lẫn:
//   currentPct = sụt hiện tại, tính từ ĐỈNH CAO NHẤT toàn chuỗi (ATH)
//   maxPct     = sụt SÂU NHẤT từng xảy ra, tính bằng cách quét đỉnh trượt
// Chuỗi 100 → 70 → 120 → 90 có currentPct 25% nhưng maxPct 30%.

import { daysBetween } from './money';
import type { DrawdownStats } from './types';

export function computeDrawdown(
  series: { date: string; value: number }[],
): DrawdownStats | null {
  if (series.length === 0) return null;

  // Sắp xếp bản SAO — không làm biến đổi mảng của người gọi.
  const sorted = [...series].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const last = sorted[sorted.length - 1];

  // Đỉnh cao nhất; nếu trùng giá trị thì lấy điểm SỚM NHẤT (đỉnh thật sự).
  let athIndex = 0;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].value > sorted[athIndex].value) athIndex = i;
  }
  const ath = sorted[athIndex];

  // Sụt sâu nhất trong lịch sử: quét bằng đỉnh trượt.
  let runningPeak = sorted[0].value;
  let maxPct = 0;
  for (const p of sorted) {
    if (p.value > runningPeak) runningPeak = p.value;
    if (runningPeak > 0) {
      const dd = ((runningPeak - p.value) / runningPeak) * 100;
      if (dd > maxPct) maxPct = dd;
    }
  }

  // Đáy dùng để tính hồi phục là đáy SAU đỉnh cao nhất.
  let trough = sorted[athIndex];
  for (let i = athIndex; i < sorted.length; i++) {
    if (sorted[i].value < trough.value) trough = sorted[i];
  }

  const currentPct = ath.value > 0 ? ((ath.value - last.value) / ath.value) * 100 : 0;
  const range = ath.value - trough.value;
  // Chưa từng sụt (đỉnh = đáy) ⇒ coi như đã hồi phục hoàn toàn, không chia cho 0.
  const recoveryPct = range > 0 ? ((last.value - trough.value) / range) * 100 : 100;

  return {
    currentPct,
    maxPct,
    ath: { date: ath.date, value: ath.value },
    trough: { date: trough.date, value: trough.value },
    daysSinceHigh: daysBetween(ath.date, last.date),
    recoveryPct,
  };
}

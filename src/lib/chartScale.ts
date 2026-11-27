// Tính vạch chia trục cho biểu đồ đường (hàm thuần, có test).

/**
 * Vạch chia "đẹp" (1, 2, 2.5, 5 × 10^k) phủ [min, max], khoảng `soVach` vạch.
 * Luôn gồm 0 khi min ≥ 0 — biểu đồ tiền mà trục không bắt đầu từ 0 sẽ phóng
 * đại chênh lệch.
 */
export function niceTicks(min: number, max: number, soVach = 5): number[] {
  const lo = Math.min(0, min);
  const hi = max > lo ? max : lo + 1;
  const tho = (hi - lo) / soVach;
  const mu = Math.pow(10, Math.floor(Math.log10(tho)));
  const buoc = [1, 2, 2.5, 5, 10].map((b) => b * mu).find((b) => b >= tho) ?? 10 * mu;
  const dau = Math.floor(lo / buoc) * buoc;
  const out: number[] = [];
  for (let v = dau; v < hi + buoc * 0.999; v += buoc) out.push(Math.round(v / buoc) * buoc);
  return out;
}

/** Chỉ số phần tử có `x` gần `target` nhất trong mảng đã sắp tăng (tìm nhị phân). */
export function nearestIndex(xs: number[], target: number): number {
  if (xs.length === 0) return -1;
  let lo = 0;
  let hi = xs.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (xs[mid] <= target) lo = mid;
    else hi = mid;
  }
  return Math.abs(xs[hi] - target) < Math.abs(xs[lo] - target) ? hi : lo;
}

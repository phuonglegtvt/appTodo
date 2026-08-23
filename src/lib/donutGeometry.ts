// Hình học biểu đồ tròn (donut) — hàm thuần, không React.
//
// Vì sao tách riêng: ba ca dưới đây là chỗ biểu đồ tròn hay vẽ sai, và cả ba
// đều kiểm được không cần DOM:
//   ① tổng = 0 (danh mục rỗng) → phải KHÔNG vẽ gì, không sinh NaN trong path
//   ② một lát chiếm 100% → cung SVG 360° có điểm đầu trùng điểm cuối nên trình
//     duyệt vẽ ra RỖNG; phải báo cho component đổi sang <circle>
//   ③ lát nhỏ hơn cả khe hở → trừ thẳng khe sẽ ra góc quét âm, cung vẽ ngược
//
// Quy ước góc: 0° = 12 giờ, tăng theo chiều kim đồng hồ (giống mọi biểu đồ tròn
// người đọc quen), KHÔNG phải quy ước toán học 0° = 3 giờ ngược kim đồng hồ.

export interface DonutOptions {
  radius: number;
  innerRadius: number;
  /** Khe hở giữa hai lát, tính bằng độ. Khe là "spacer" 2px của mark spec. */
  gapDeg: number;
}

export interface DonutSegment {
  /** Chỉ số trong mảng đầu vào — để component tra đúng màu và nhãn. */
  index: number;
  startAngle: number;
  endAngle: number;
  fractionPct: number;
  /** true ⇒ vẽ bằng <circle>, KHÔNG dùng path cung. */
  isFullCircle: boolean;
}

/** Toạ độ trên đường tròn, với 0° = 12 giờ, chiều kim đồng hồ. */
function toaDo(cx: number, cy: number, r: number, deg: number): { x: number; y: number } {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

/**
 * Path hình vành khuyên từ `startAngle` tới `endAngle`.
 * Hệ toạ độ: tâm (0,0) — component đặt `viewBox` sao cho tâm ở giữa.
 */
export function arcPath(
  startAngle: number, endAngle: number, radius: number, innerRadius: number,
): string {
  const ngoaiDau = toaDo(0, 0, radius, startAngle);
  const ngoaiCuoi = toaDo(0, 0, radius, endAngle);
  const trongCuoi = toaDo(0, 0, innerRadius, endAngle);
  const trongDau = toaDo(0, 0, innerRadius, startAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  const n = (v: number) => v.toFixed(3);

  return (
    `M ${n(ngoaiDau.x)} ${n(ngoaiDau.y)} `
    + `A ${n(radius)} ${n(radius)} 0 ${largeArc} 1 ${n(ngoaiCuoi.x)} ${n(ngoaiCuoi.y)} `
    + `L ${n(trongCuoi.x)} ${n(trongCuoi.y)} `
    + `A ${n(innerRadius)} ${n(innerRadius)} 0 ${largeArc} 0 ${n(trongDau.x)} ${n(trongDau.y)} `
    + 'Z'
  );
}

export function donutSegments(values: number[], opts: DonutOptions): DonutSegment[] {
  for (const [i, v] of values.entries()) {
    if (!Number.isFinite(v)) {
      throw new Error(`Giá trị thứ ${i} của biểu đồ tròn không phải số hợp lệ: ${v}.`);
    }
    if (v < 0) {
      throw new Error(`Giá trị thứ ${i} của biểu đồ tròn đang âm: ${v}.`);
    }
  }

  // Bỏ lát bằng 0 TRƯỚC khi chia khe hở: một lát vô hình vẫn chiếm một khe,
  // làm tổng góc lệch và để lại một vệt trống không giải thích được.
  const duoc = values
    .map((value, index) => ({ value, index }))
    .filter((x) => x.value > 0);

  const tong = duoc.reduce((s, x) => s + x.value, 0);
  if (tong === 0) return [];

  if (duoc.length === 1) {
    return [{
      index: duoc[0].index,
      startAngle: 0,
      endAngle: 360,
      fractionPct: 100,
      isFullCircle: true,
    }];
  }

  const segments: DonutSegment[] = [];
  let goc = 0;
  for (const x of duoc) {
    const quet = (x.value / tong) * 360;
    const start = goc + opts.gapDeg / 2;
    // Math.max: lát nhỏ hơn khe hở thì góc quét về 0 chứ KHÔNG âm — cung âm vẽ
    // ngược chiều, tạo ra một lát to đùng sai hoàn toàn.
    const end = Math.max(start, goc + quet - opts.gapDeg / 2);
    segments.push({
      index: x.index,
      startAngle: start,
      endAngle: end,
      fractionPct: (x.value / tong) * 100,
      isFullCircle: false,
    });
    goc += quet;
  }
  return segments;
}

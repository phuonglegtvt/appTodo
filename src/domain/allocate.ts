// §4 (tiền mới hàng tháng) và §5 (cổ tức) — MỘT engine, hai wrapper.
//
// Khác biệt duy nhất giữa hai trường hợp: tiền mới Z làm TĂNG tổng danh mục,
// còn cổ tức thì ĐÃ nằm trong Cash rồi. Nên chỉ cần một cờ `addsToTotal`.
//
// CÔNG THỨC MẶC ĐỊNH — PROPORTIONAL_GAP (spec mục 4.4):
//   chia tỷ lệ theo khoảng thiếu tính bằng VND. Lý do chọn: danh mục ĐANG ở
//   đúng target thì phân bổ mới giữ NGUYÊN target — vì khi đang ở target,
//   gap_c = targetPct_c × pool với mọi class, nên chia theo tỷ lệ gap cũng
//   chính là chia theo targetPct_c. Đã kiểm: danh mục 500/200/150/150tr,
//   Z = 3tr → alloc đúng 1.500.000/600.000/450.000/450.000; mô phỏng 24
//   tháng giữ nguyên 50/20/15/15%.
//
//   ⚠️ KHÔNG phải phân bổ tối thiểu hoá tổng bình phương độ lệch KHÔNG trọng
//   số Σ(gap_c − alloc_c)² — phân bổ đó là "water-filling" (dồn hết pool
//   vào class có gap lớn nhất). Water-filling phá đúng tính chất ở trên (đổ
//   hết vào 1 class dù danh mục đang ở target) và cho kế hoạch hàng tháng
//   lởm chởm — mỗi tháng chỉ mua 1 class, trái tinh thần DCA của §4.
//   PROPORTIONAL_GAP tối thiểu hoá bản CÓ TRỌNG SỐ theo gap thay vào đó:
//   Σ(gap_c − alloc_c)² / gap_c — vẫn phục vụ mục tiêu 2 của §18 "MINIMIZE
//   DEVIATION FROM TARGET", chỉ không phải bản không trọng số.
//
// ⚠️ Số trong ví dụ §4, §5, §21 của spec gốc là minh hoạ viết tay, KHÔNG suy ra
// được từ bất cứ công thức nào. Chi tiết ở spec mục 4.5. Test ở đây ghi số
// engine tính, không sửa engine cho vừa số viết tay.
//
// BẤT BIẾN: sum(allocations) + unallocatedVnd === poolVnd, LUÔN LUÔN.
// Giữ được VÔ ĐIỀU KIỆN vì pool âm bị NÉM LỖI ngay đầu hàm chứ không bị lặng lẽ
// quy về 0 — quy về 0 thì 0 + 0 ≠ pool âm, bất biến vỡ và tiền biến mất im lặng.

import { ASSET_CLASSES } from './types';
import { roundDownTo, sumVnd } from './money';
import type {
  Allocation, AllocationResult, AssetClass, EngineConfig, TargetBand,
} from './types';

export interface AllocateInput {
  classValues: Record<AssetClass, number>;
  targets: Record<AssetClass, TargetBand>;
  poolVnd: number;
  /** true = tiền từ ngoài vào (Z), làm tăng tổng. false = cổ tức, đã nằm trong Cash. */
  addsToTotal: boolean;
  config: EngineConfig;
}

/** Chia tỷ lệ theo khoảng thiếu VND. */
function splitProportionalToGap(
  candidates: AssetClass[],
  gaps: Record<AssetClass, number>,
  poolVnd: number,
): Map<AssetClass, number> {
  const totalGap = sumVnd(candidates.map((c) => gaps[c]));
  const out = new Map<AssetClass, number>();
  for (const c of candidates) out.set(c, poolVnd * (gaps[c] / totalGap));
  return out;
}

/** Đổ đầy lần lượt theo thứ tự ưu tiên, mỗi class tối đa tới khoảng thiếu của nó. */
function splitByPriority(
  candidates: AssetClass[],
  gaps: Record<AssetClass, number>,
  poolVnd: number,
  config: EngineConfig,
): Map<AssetClass, number> {
  const order = [...candidates].sort(
    (a, b) => config.classPriority[b] - config.classPriority[a],
  );
  const out = new Map<AssetClass, number>();
  let remaining = poolVnd;
  for (const c of order) {
    const take = Math.min(remaining, gaps[c]);
    out.set(c, take);
    remaining -= take;
    if (remaining <= 0) break;
  }
  // Pool lớn hơn tổng khoảng thiếu: phần dư dồn vào class ưu tiên cao nhất.
  if (remaining > 0) out.set(order[0], (out.get(order[0]) ?? 0) + remaining);
  return out;
}

export function allocate(input: AllocateInput): AllocationResult {
  const { classValues, targets, poolVnd, addsToTotal, config } = input;

  // Pool âm là DỮ LIỆU SAI, không phải "không có gì để phân bổ". Nuốt im lặng
  // (coi như 0) sẽ phá bất biến tổng và làm tiền biến mất — nên ném lỗi.
  if (poolVnd < 0) {
    throw new Error(
      `Số tiền cần phân bổ không được âm: nhận được ${poolVnd} VND. `
      + 'Kiểm tra lại tiền mới hàng tháng / cổ tức trong dữ liệu đầu vào.',
    );
  }
  // 0 là hợp lệ: không có gì để phân bổ, cũng không có gì dư.
  if (poolVnd === 0) return { allocations: [], unallocatedVnd: 0 };

  const total = sumVnd(ASSET_CLASSES.map((c) => classValues[c]));
  const newTotal = total + (addsToTotal ? poolVnd : 0);

  // QUY TẮC: pool LUÔN nằm NGOÀI baseline dùng để tính khoảng thiếu.
  // Lý do: phân bổ cho CASH cũng được CỘNG vào CASH y như mọi class khác, nên
  // baseline của CASH phải là "CASH chưa có pool". Cộng pool vào baseline là đếm
  // pool hai lần ⇒ CASH bị bỏ đói (addsToTotal = true), hoặc bị coi là đã đủ nên
  // tiền đáng để lại trong ví bị giải ngân hết (addsToTotal = false).
  //   addsToTotal = true  (§4 tiền mới): pool còn NGOÀI classValues ⇒ giữ nguyên.
  //   addsToTotal = false (§5 cổ tức)  : pool ĐÃ nằm trong CASH     ⇒ phải trừ ra.
  // `addsToTotal` chỉ quyết định newTotal có tăng hay không.
  const preValues = { ...classValues };
  if (!addsToTotal) {
    // Cổ tức không thể lớn hơn toàn bộ tiền đang có trong ví — đầu vào tự mâu thuẫn.
    if (poolVnd > classValues.CASH) {
      throw new Error(
        `Cổ tức ${poolVnd} VND lớn hơn số dư Cash ${classValues.CASH} VND. `
        + 'Với addsToTotal = false, cổ tức phải ĐÃ nằm trong Cash nên không thể '
        + 'lớn hơn Cash.',
      );
    }
    preValues.CASH -= poolVnd;
  }

  const gaps = {} as Record<AssetClass, number>;
  for (const c of ASSET_CLASSES) {
    gaps[c] = newTotal * (targets[c].targetPct / 100) - preValues[c];
  }

  let candidates = ASSET_CLASSES.filter((c) => gaps[c] > 0);
  if (!config.cashEligibleForNewCapital) {
    candidates = candidates.filter((c) => c !== 'CASH');
  }
  // Không có chỗ nào thiếu: tiền KHÔNG được biến mất, nó nằm nguyên trong ví.
  if (candidates.length === 0) {
    return { allocations: [], unallocatedVnd: poolVnd };
  }

  const rawShares = config.formula === 'PRIORITY_WATERFALL'
    ? splitByPriority(candidates, gaps, poolVnd, config)
    : splitProportionalToGap(candidates, gaps, poolVnd);

  // Làm tròn XUỐNG bội số, rồi dồn phần dư vào class có khoảng thiếu lớn nhất.
  // Nhờ làm tròn xuống, phần dư luôn ≥ 0 ⇒ bất biến tổng đúng tuyệt đối.
  const rounded = new Map<AssetClass, number>();
  for (const c of candidates) {
    rounded.set(c, roundDownTo(rawShares.get(c) ?? 0, config.roundingStepVnd));
  }
  const residualVnd = poolVnd - sumVnd([...rounded.values()]);
  if (residualVnd > 0) {
    const largestGap = candidates.reduce((a, b) => (gaps[b] > gaps[a] ? b : a));
    rounded.set(largestGap, (rounded.get(largestGap) ?? 0) + residualVnd);
  }

  const allocations: Allocation[] = ASSET_CLASSES
    .filter((c) => (rounded.get(c) ?? 0) > 0)
    .map((c) => ({ assetClass: c, amountVnd: rounded.get(c) as number, gapVnd: gaps[c] }));

  return {
    allocations,
    unallocatedVnd: poolVnd - sumVnd(allocations.map((a) => a.amountVnd)),
  };
}

/** §4 — tiền mới hàng tháng (Z). Làm tăng tổng danh mục. */
export function allocateNewCapital(
  classValues: Record<AssetClass, number>,
  targets: Record<AssetClass, TargetBand>,
  monthlyVnd: number,
  config: EngineConfig,
): AllocationResult {
  return allocate({ classValues, targets, poolVnd: monthlyVnd, addsToTotal: true, config });
}

/** §5 — cổ tức/lãi đã nhận. ĐÃ nằm trong Cash nên tổng không tăng. */
export function allocateIncome(
  classValues: Record<AssetClass, number>,
  targets: Record<AssetClass, TargetBand>,
  incomeVnd: number,
  config: EngineConfig,
): AllocationResult {
  return allocate({ classValues, targets, poolVnd: incomeVnd, addsToTotal: false, config });
}

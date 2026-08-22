// §4 (tiền mới hàng tháng) và §5 (cổ tức) — MỘT engine, hai wrapper.
//
// Khác biệt duy nhất giữa hai trường hợp: tiền mới Z làm TĂNG tổng danh mục,
// còn cổ tức thì ĐÃ nằm trong Cash rồi. Nên chỉ cần một cờ `addsToTotal`.
//
// CÔNG THỨC MẶC ĐỊNH — PROPORTIONAL_GAP (spec mục 4.4):
//   chia tỷ lệ theo khoảng thiếu tính bằng VND. Đây là phân bổ DUY NHẤT tối
//   thiểu hoá tổng bình phương độ lệch sau khi giải ngân — đúng mục tiêu 2 của
//   §18 "MINIMIZE DEVIATION FROM TARGET".
//
// ⚠️ Số trong ví dụ §4, §5, §21 của spec gốc là minh hoạ viết tay, KHÔNG suy ra
// được từ bất cứ công thức nào. Chi tiết ở spec mục 4.5. Test ở đây ghi số
// engine tính, không sửa engine cho vừa số viết tay.
//
// BẤT BIẾN: sum(allocations) + unallocatedVnd === poolVnd, LUÔN LUÔN.

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

  if (poolVnd <= 0) return { allocations: [], unallocatedVnd: 0 };

  const total = sumVnd(ASSET_CLASSES.map((c) => classValues[c]));
  const newTotal = total + (addsToTotal ? poolVnd : 0);

  // Z được nộp vào ví TRƯỚC khi mua ⇒ giá trị CASH trước phân bổ đã gồm Z.
  // Không làm bước này thì Cash bị coi là thiếu hơn thực tế.
  const preValues = { ...classValues };
  if (addsToTotal) preValues.CASH += poolVnd;

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

// §17 — công thức tỷ trọng. Hàm thuần, không import gì ngoài type.
import { ASSET_CLASSES } from './types';
import type { AssetClass, TargetBand, Weight } from './types';

/** Tổng giá trị danh mục (VND). */
export function totalVnd(values: Record<AssetClass, number>): number {
  let sum = 0;
  for (const c of ASSET_CLASSES) sum += values[c];
  return sum;
}

/**
 * §17 nguyên văn, tính trên TỔNG HIỆN TẠI (không cộng tiền mới):
 *   current_weight = current_value / portfolio_total
 *   target_value   = portfolio_total × target_weight
 *   difference     = target_value − current_value
 *
 * Tổng = 0 (danh mục rỗng) → mọi số ra 0, KHÔNG ra NaN. Người dùng thấy
 * danh mục rỗng, không thấy "NaN%".
 */
export function computeWeights(
  values: Record<AssetClass, number>,
  targets: Record<AssetClass, TargetBand>,
): Weight[] {
  const total = totalVnd(values);

  return ASSET_CLASSES.map((assetClass): Weight => {
    const valueVnd = values[assetClass];
    const targetPct = targets[assetClass].targetPct;
    const weightPct = total === 0 ? 0 : (valueVnd / total) * 100;
    const targetValueVnd = total * (targetPct / 100);

    return {
      assetClass,
      valueVnd,
      weightPct,
      targetPct,
      deviationPp: total === 0 ? 0 : weightPct - targetPct,
      targetValueVnd,
      differenceVnd: targetValueVnd - valueVnd,
    };
  });
}

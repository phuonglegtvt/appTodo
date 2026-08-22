import { describe, it, expect } from 'vitest';
import { planSellRebalance } from './rebalanceSell';
import { computeWeights } from './weights';
import { classifyAll } from './bands';
import { DEFAULT_CONFIG } from './types';
import type { AssetClass, TargetBand } from './types';

const TARGETS: Record<AssetClass, TargetBand> = {
  STOCKS: { targetPct: 50, minPct: 40, maxPct: 55 },
  CRYPTO: { targetPct: 20, minPct: 15, maxPct: 25 },
  GOLD:   { targetPct: 15, minPct: 10, maxPct: 20 },
  CASH:   { targetPct: 15, minPct: 7,  maxPct: 20 },
};

/** Crypto 28% — ngoài band 15–25 và lệch +8đ% ⇒ REBALANCE_REQUIRED. */
const CRYPTO_OVERHEATED: Record<AssetClass, number> = {
  STOCKS: 460_000_000,  // 46%
  CRYPTO: 280_000_000,  // 28%
  GOLD:   140_000_000,  // 14%
  CASH:   120_000_000,  // 12%
};

/** Bộ số §21 — không class nào REBALANCE_REQUIRED. */
const EXAMPLE_21: Record<AssetClass, number> = {
  STOCKS: 513_300_000, CRYPTO: 269_700_000, GOLD: 179_437_500, CASH: 125_062_500,
};

function buildPlan(values: Record<AssetClass, number>, config = DEFAULT_CONFIG) {
  const weights = computeWeights(values, TARGETS);
  const statuses = classifyAll(weights, TARGETS, config);
  return planSellRebalance({ weights, statuses, classValues: values, targets: TARGETS, config });
}

describe('planSellRebalance — Crypto 28%, bán về TARGET (mặc định)', () => {
  const plan = buildPlan(CRYPTO_OVERHEATED);

  it('bán đúng một class: Crypto', () => {
    expect(plan.sells.map((s) => s.assetClass)).toEqual(['CRYPTO']);
  });

  it('bán 80.000.000 để về đúng target 20% (280tr → 200tr)', () => {
    expect(plan.sells[0].sellVnd).toBe(80_000_000);
  });

  it('tiền bán được chia hết vào ba class đang thiếu, lấp vừa khít khoảng thiếu', () => {
    // Sau khi bán: Crypto 200tr (đúng target, gap = 0, tự loại khỏi ứng viên).
    // Baseline còn lại trùng với giá trị TRƯỚC bán: Stocks 460tr, Gold 140tr,
    // Cash 120tr ⇒ gap Stocks 500−460=40tr, Gold 150−140=10tr, Cash 150−120=30tr.
    // Tổng gap ba class = 80tr = đúng pool ⇒ chia hết, không dư.
    const destByClass = Object.fromEntries(
      plan.destinations.map((d) => [d.assetClass, d.amountVnd]),
    );
    expect(destByClass).toEqual({ STOCKS: 40_000_000, GOLD: 10_000_000, CASH: 30_000_000 });
  });

  it('BẤT BIẾN: tổng tiền vào + chưa phân bổ === tổng tiền bán', () => {
    const totalSell = plan.sells.reduce((s, x) => s + x.sellVnd, 0);
    const totalDest = plan.destinations.reduce((s, x) => s + x.amountVnd, 0);
    expect(totalDest + plan.unallocatedVnd).toBe(totalSell);
  });

  it('không có lệnh nào bị bỏ', () => {
    expect(plan.skipped).toEqual([]);
  });
});

describe('planSellRebalance — bán về rìa band', () => {
  const cfg = { ...DEFAULT_CONFIG, sellTo: 'BAND_EDGE' as const };
  const plan = buildPlan(CRYPTO_OVERHEATED, cfg);

  it('chỉ bán 30.000.000 để về rìa trên 25% (280tr → 250tr) — bán ít hơn', () => {
    expect(plan.sells[0].sellVnd).toBe(30_000_000);
  });

  it('BẤT BIẾN: tổng tiền vào + chưa phân bổ === tổng tiền bán', () => {
    const totalSell = plan.sells.reduce((s, x) => s + x.sellVnd, 0);
    const totalDest = plan.destinations.reduce((s, x) => s + x.amountVnd, 0);
    expect(totalDest + plan.unallocatedVnd).toBe(totalSell);
  });
});

describe('planSellRebalance — không bán khi chưa cần', () => {
  it('bộ số §21: không class nào REBALANCE_REQUIRED → KHÔNG có lệnh bán', () => {
    const plan = buildPlan(EXAMPLE_21);
    expect(plan.sells).toEqual([]);
    expect(plan.destinations).toEqual([]);
    expect(plan.unallocatedVnd).toBe(0);
    expect(plan.skipped).toEqual([]);
  });

  it('class REBALANCE_REQUIRED nhưng đang THIẾU (không thừa) → không bán nó', () => {
    // Stocks 38% ⇒ ngoài band 40–55, lệch −12đ% ⇒ REBALANCE_REQUIRED nhưng thiếu.
    const values: Record<AssetClass, number> = {
      STOCKS: 380_000_000, CRYPTO: 240_000_000, GOLD: 190_000_000, CASH: 190_000_000,
    };
    const plan = buildPlan(values);
    expect(plan.sells.map((s) => s.assetClass)).not.toContain('STOCKS');
  });
});

describe('planSellRebalance — không bán vụn (§18)', () => {
  it('lệnh dưới minSellAmountVnd bị bỏ, nhưng PHẢI báo ở skipped', () => {
    const cfg = { ...DEFAULT_CONFIG, minSellAmountVnd: 100_000_000 };
    const plan = buildPlan(CRYPTO_OVERHEATED, cfg);
    expect(plan.sells).toEqual([]);
    expect(plan.destinations).toEqual([]);
    expect(plan.skipped).toEqual([{ assetClass: 'CRYPTO', wouldSellVnd: 80_000_000 }]);
  });
});

describe('planSellRebalance — tiền bán không có chỗ đi', () => {
  it('mọi nhóm khác đều thừa và Cash bị loại → tiền bán vào unallocatedVnd, KHÔNG biến mất', () => {
    // Crypto 300tr/1.010tr = 29,7% ⇒ ngoài band, lệch +9,7đ% ⇒ REBALANCE_REQUIRED,
    // đang thừa ⇒ bán về target 202tr, sellVnd = 98tr. Sau khi bán và cộng pool
    // vào Cash rồi trừ lại (đúng addendum), baseline: Stocks 550tr (thừa),
    // Gold 160tr (thừa nhẹ), Cash 0 (thiếu 151,5tr) — nhưng Cash bị loại bằng
    // cấu hình ⇒ không còn ứng viên nào ⇒ toàn bộ 98tr rơi vào unallocatedVnd.
    const values: Record<AssetClass, number> = {
      STOCKS: 550_000_000, CRYPTO: 300_000_000, GOLD: 160_000_000, CASH: 0,
    };
    const cfg = { ...DEFAULT_CONFIG, cashEligibleForNewCapital: false };
    const plan = buildPlan(values, cfg);
    const totalSell = plan.sells.reduce((s, x) => s + x.sellVnd, 0);
    const totalDest = plan.destinations.reduce((s, x) => s + x.amountVnd, 0);
    expect(totalSell).toBeGreaterThan(0);
    expect(totalDest + plan.unallocatedVnd).toBe(totalSell);
  });
});

describe('planSellRebalance — biên', () => {
  it('danh mục rỗng → không bán gì, không NaN', () => {
    const empty: Record<AssetClass, number> = { STOCKS: 0, CRYPTO: 0, GOLD: 0, CASH: 0 };
    const plan = buildPlan(empty);
    expect(plan.sells).toEqual([]);
    expect(plan.destinations).toEqual([]);
  });

  it('hai class cùng quá nóng → bán cả hai', () => {
    // Crypto 28%, Gold 27% (ngoài band 10–20, lệch +12đ%) đều REBALANCE_REQUIRED
    // và đang thừa ⇒ cả hai bị bán về target: Crypto 280→200 (80tr), Gold
    // 270→150 (120tr), tổng pool 200tr. Sau khi mô phỏng bán, baseline trùng
    // với giá trị TRƯỚC bán (Stocks 350tr, Cash 100tr) ⇒ gap Stocks 150tr,
    // Cash 50tr, tổng đúng 200tr = pool ⇒ chia hết, không dư.
    const values: Record<AssetClass, number> = {
      STOCKS: 350_000_000, CRYPTO: 280_000_000, GOLD: 270_000_000, CASH: 100_000_000,
    };
    const plan = buildPlan(values);
    expect(plan.sells.map((s) => s.assetClass).sort()).toEqual(['CRYPTO', 'GOLD']);
    const totalSell = plan.sells.reduce((s, x) => s + x.sellVnd, 0);
    const totalDest = plan.destinations.reduce((s, x) => s + x.amountVnd, 0);
    expect(totalDest + plan.unallocatedVnd).toBe(totalSell);
  });
});

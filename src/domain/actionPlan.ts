// §20 — bộ điều phối. Gộp 7 module kia theo THỨ TỰ ƯU TIÊN của §18:
//   1. tiền mới hàng tháng  2. cổ tức  3. Crash Reserve (chỉ khi crash)
//   4. bán tài sản thừa (chỉ khi buộc phải)
// Kèm alerts §19. Hàm thuần — cùng snapshot luôn ra cùng kết quả.
//
// GỘP Z VÀ CỔ TỨC VÀO MỘT LẦN PHÂN BỔ (điểm tinh tế nhất của module này):
// Z là tiền từ ngoài vào nên làm TĂNG tổng; cổ tức thì ĐÃ nằm trong Cash rồi.
// Gộp hai khoản rồi gọi allocate với addsToTotal = true sẽ đếm cổ tức hai lần.
// Cách đúng, tái dùng allocate không cần sửa: cộng Z vào Cash TRƯỚC rồi gọi với
// addsToTotal = false. Bên trong allocate khi đó:
//   newTotal      = tổng cũ + Z                       ✓ chỉ Z làm tăng tổng
//   preValues.CASH = (CASH + Z) − (Z + cổ tức)        ✓ pool bị lấy ra đúng một lần
// Nhánh ném lỗi `poolVnd > classValues.CASH` của allocate không bao giờ chạm tới:
// điều kiện quy về `cổ tức > CASH gốc`, mà cổ tức đã nằm trong CASH gốc.

import { ASSET_CLASSES } from './types';
import { computeWeights, totalVnd } from './weights';
import { classifyAll } from './bands';
import { allocate } from './allocate';
import { pickCandidates } from './tickerCandidates';
import { planSellRebalance } from './rebalanceSell';
import { evaluateCrashReserve } from './crashReserve';
import type { ActionPlan, Alert, AssetClass, PortfolioSnapshot, Weight } from './types';

/**
 * Dồn tiền trong túi DCA về đúng nhóm tài sản nó đã được đặt tên cho. Tổng không đổi.
 * Tiền túi DCA đang nằm trong Cash (xem `PortfolioSnapshot.classValues`), nên cộng
 * vào class nào thì phải trừ đúng chừng đó khỏi Cash. `earmarkedPots.CASH` theo hợp
 * đồng kiểu luôn = 0 nên không tham gia phép dồn.
 */
export function toEarmarkedValues(
  classValues: Record<AssetClass, number>,
  earmarkedPots: Record<AssetClass, number>,
): Record<AssetClass, number> {
  const earmarkedTotal =
    earmarkedPots.STOCKS + earmarkedPots.CRYPTO + earmarkedPots.GOLD;
  return {
    STOCKS: classValues.STOCKS + earmarkedPots.STOCKS,
    CRYPTO: classValues.CRYPTO + earmarkedPots.CRYPTO,
    GOLD: classValues.GOLD + earmarkedPots.GOLD,
    CASH: classValues.CASH - earmarkedTotal,
  };
}

const CLASS_NAME_VI: Record<AssetClass, string> = {
  STOCKS: 'Cổ phiếu', CRYPTO: 'Tiền mã hoá', GOLD: 'Vàng', CASH: 'Tiền mặt',
};

const DRAWDOWN_CODE: Record<AssetClass, Alert['code'] | null> = {
  STOCKS: 'STOCK_DRAWDOWN', CRYPTO: 'CRYPTO_DRAWDOWN', GOLD: 'GOLD_DRAWDOWN', CASH: null,
};

/** Định dạng số tiền VND cho message hiển thị thẳng cho người dùng. */
function formatVnd(value: number): string {
  return Math.round(value).toLocaleString('vi-VN');
}

/** Lấy tỷ trọng của một class. Thiếu là lỗi dữ liệu — báo rõ, không nuốt im lặng. */
function weightOf(weights: Weight[], assetClass: AssetClass): Weight {
  const found = weights.find((w) => w.assetClass === assetClass);
  if (!found) {
    throw new Error(`Thiếu tỷ trọng của nhóm tài sản ${assetClass} — không dựng được kế hoạch.`);
  }
  return found;
}

export function buildActionPlan(s: PortfolioSnapshot): ActionPlan {
  const earmarked = toEarmarkedValues(s.classValues, s.earmarkedPots);
  const weights = computeWeights(earmarked, s.targets);
  const total = totalVnd(s.classValues);

  const basePlan: ActionPlan = {
    asOf: s.asOf,
    status: 'READY',
    blockedReason: null,
    totalVnd: total,
    weights,
    statuses: classifyAll(weights, s.targets, s.config),
    sources: {
      monthlyContributionVnd: s.monthlyContributionVnd,
      incomeReceivedVnd: s.incomeReceivedVnd,
      poolVnd: s.monthlyContributionVnd + s.incomeReceivedVnd,
    },
    buys: [],
    unallocatedVnd: 0,
    doNotBuy: [],
    tickerCandidates: { affordable: [], shortfalls: [] },
    sellPlan: null,
    crash: null,
    alerts: [],
  };

  // ---- Cổng chặn: kế hoạch tính trên dữ liệu thiếu còn tệ hơn không có kế hoạch ----
  if (s.missingPriceSymbols.length > 0) {
    return {
      ...basePlan,
      status: 'MISSING_PRICES',
      blockedReason:
        `${s.missingPriceSymbols.length} tài sản chưa có giá: ` +
        `${s.missingPriceSymbols.join(', ')}. Nhập giá rồi tạo lại kế hoạch.`,
    };
  }
  if (total === 0) {
    return {
      ...basePlan,
      status: 'EMPTY_PORTFOLIO',
      blockedReason:
        'Danh mục còn rỗng. Hãy ghi các giao dịch đã có, hoặc nhập vị thế ban đầu.',
    };
  }

  // ---- §18 bước 3: Crash Reserve ----
  const crash = evaluateCrashReserve({
    portfolioDrawdownPct: s.portfolioDrawdownPct,
    currentEpisodeStart: s.currentEpisodeStart,
    cashReserveVnd: s.cashReserveVnd,
    levels: s.crashLevels,
    history: s.crashHistory,
  });

  // ---- §18 bước 1+2: Z và cổ tức, MỘT lần phân bổ (xem comment đầu file) ----
  const valuesWithZ = { ...earmarked, CASH: earmarked.CASH + s.monthlyContributionVnd };
  const poolVnd = s.monthlyContributionVnd + s.incomeReceivedVnd;
  const { allocations, unallocatedVnd } = allocate({
    classValues: valuesWithZ, targets: s.targets, poolVnd,
    addsToTotal: false, config: s.config,
  });

  const buyingClasses = new Set(allocations.map((a) => a.assetClass));
  const doNotBuy = ASSET_CLASSES
    .filter((c) => !buyingClasses.has(c))
    .map((c) => {
      const w = weightOf(weights, c);
      return {
        assetClass: c,
        reason: w.deviationPp > 0
          ? `${CLASS_NAME_VI[c]} đang vượt mục tiêu ${w.deviationPp.toFixed(1)} điểm %.`
          : `${CLASS_NAME_VI[c]} không nằm trong nhóm được ưu tiên tháng này.`,
      };
    });

  // ---- §18 bước 4: chỉ bán khi thực sự buộc phải ----
  const needsSell = ASSET_CLASSES.some(
    (c) => basePlan.statuses[c] === 'REBALANCE_REQUIRED',
  );
  const sellPlan = needsSell
    ? planSellRebalance({
        weights, statuses: basePlan.statuses, classValues: earmarked,
        targets: s.targets, config: s.config,
      })
    : null;

  // ---- Gợi ý mã: ngân sách = phân bổ tháng này + tiền còn trong túi DCA Stocks ----
  // Chính là cơ chế dồn tiền (carryover), không cần code riêng.
  const stocksAllocationVnd =
    allocations.find((a) => a.assetClass === 'STOCKS')?.amountVnd ?? 0;
  const tickerCandidates = pickCandidates(
    s.watchlist,
    stocksAllocationVnd + s.earmarkedPots.STOCKS,
    s.monthlyContributionVnd,
  );

  // ---- §19 alerts ----
  const alerts: Alert[] = [];
  const drawdownThresholdPct = s.crashLevels.length > 0
    ? Math.min(...s.crashLevels.map((l) => l.drawdownPct))
    : Number.POSITIVE_INFINITY;

  for (const w of weights) {
    const status = basePlan.statuses[w.assetClass];
    const direction = w.deviationPp > 0 ? 'vượt' : 'thiếu';
    const description =
      `${CLASS_NAME_VI[w.assetClass]} ${w.weightPct.toFixed(1)}% / mục tiêu ` +
      `${w.targetPct}% — ${direction} ${Math.abs(w.deviationPp).toFixed(1)} điểm %`;

    if (status === 'WATCH') {
      alerts.push({ code: 'BAND_WATCH', severity: 'INFO',
        message: `${description}. Vẫn trong band, chưa cần bán.` });
    } else if (status === 'OUT_OF_BAND') {
      alerts.push({ code: 'OUT_OF_BAND', severity: 'WARN',
        message: `${description}. Đã ra ngoài band — ưu tiên dồn tiền mới vào.` });
    } else if (status === 'REBALANCE_REQUIRED') {
      alerts.push({ code: 'REBALANCE_REQUIRED', severity: 'ACTION',
        message: `${description}. Ngoài band và lệch lớn — cần cân lại danh mục.` });
    }
  }

  const cashWeight = weightOf(weights, 'CASH');
  if (cashWeight.weightPct < s.targets.CASH.minPct) {
    alerts.push({ code: 'CASH_BELOW_MIN', severity: 'ACTION',
      message:
        `Tiền mặt ${cashWeight.weightPct.toFixed(1)}% đã xuống dưới mức tối thiểu ` +
        `${s.targets.CASH.minPct}% — Crash Reserve đang bị bòn rút.` });
  }

  for (const c of ASSET_CLASSES) {
    const code = DRAWDOWN_CODE[c];
    if (code !== null && s.drawdowns[c] >= drawdownThresholdPct) {
      alerts.push({ code, severity: 'ACTION',
        message:
          `${CLASS_NAME_VI[c]} đã sụt ${s.drawdowns[c].toFixed(1)}% từ đỉnh — ` +
          `vượt ngưỡng ${drawdownThresholdPct}%.` });
    }
  }

  if (s.portfolioDrawdownPct >= drawdownThresholdPct) {
    alerts.push({ code: 'PORTFOLIO_DRAWDOWN', severity: 'ACTION',
      message:
        `Toàn danh mục sụt ${s.portfolioDrawdownPct.toFixed(1)}% từ đỉnh. ` +
        `Crash Reserve khả dụng ${formatVnd(crash.reserveAtEpisodeStartVnd)} đ.` });
  }

  if (!s.contributionRecordedThisPeriod) {
    alerts.push({ code: 'CONTRIBUTION_MISSING', severity: 'ACTION',
      message:
        `Kỳ này chưa ghi nhận khoản tiền vào ${formatVnd(s.monthlyContributionVnd)} đ.` });
  }

  return {
    ...basePlan,
    buys: allocations,
    unallocatedVnd,
    doNotBuy,
    tickerCandidates,
    sellPlan,
    crash,
    alerts,
  };
}

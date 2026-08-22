// Nối DB với tầng domain. mapToSnapshot là HÀM THUẦN — toàn bộ phần biến đổi
// dữ liệu nằm ở đây để test được không cần DB. loadSnapshot chỉ ghép I/O.

import { ASSET_CLASSES, DEFAULT_CONFIG } from '../domain/types';
import type {
  AssetClass, EngineConfig, PortfolioSnapshot, TargetBand,
} from '../domain/types';
import type { SettingsRow, SnapshotSourceData } from '../types/portfolio';
import * as repo from './portfolioRepo';

/**
 * Z mặc định khi chưa có dòng `portfolio.settings` — khớp giá trị default của
 * cột DB (core.sql: `monthly_contribution_vnd numeric not null default 3000000`).
 */
const DEFAULT_MONTHLY_CONTRIBUTION_VND = 3_000_000;

function isValidAllocationFormula(value: string): value is EngineConfig['formula'] {
  return value === 'PROPORTIONAL_GAP' || value === 'PRIORITY_WATERFALL';
}

function isValidSellTo(value: string): value is EngineConfig['sellTo'] {
  return value === 'TARGET' || value === 'BAND_EDGE';
}

/**
 * `settings.allocation_formula` và `settings.sell_to` là cột `text` KHÔNG có
 * CHECK constraint trong DB (xem comment ngay tại cột trong
 * supabase/migrations/2026-08-22-portfolio-core.sql) — DB nhận bất cứ chuỗi
 * nào. Union type của domain thì từ chối, nên ở đây PHẢI validate tường minh
 * bằng type guard và ném lỗi tiếng Việt rõ ràng khi giá trị không hợp lệ —
 * KHÔNG được ép kiểu bừa bằng `as`, và KHÔNG được âm thầm tụt về mặc định
 * (đó vẫn là một dạng nuốt lỗi im lặng: người dùng tưởng app đang chạy đúng
 * công thức họ chọn trong khi thực ra DB chứa một chuỗi vô nghĩa).
 */
function buildEngineConfig(row: SettingsRow | null): EngineConfig {
  if (row === null) return DEFAULT_CONFIG;

  if (!isValidAllocationFormula(row.allocation_formula)) {
    throw new Error(
      `Giá trị allocation_formula không hợp lệ trong portfolio.settings: ` +
      `"${row.allocation_formula}". Giá trị hợp lệ: PROPORTIONAL_GAP hoặc PRIORITY_WATERFALL.`,
    );
  }
  if (!isValidSellTo(row.sell_to)) {
    throw new Error(
      `Giá trị sell_to không hợp lệ trong portfolio.settings: "${row.sell_to}". ` +
      `Giá trị hợp lệ: TARGET hoặc BAND_EDGE.`,
    );
  }

  return {
    formula: row.allocation_formula,
    watchDeviationPp: row.watch_deviation_pp,
    strongRebalancePp: row.strong_rebalance_pp,
    minSellAmountVnd: row.min_sell_amount_vnd,
    roundingStepVnd: row.rounding_step_vnd,
    cashEligibleForNewCapital: row.cash_eligible_for_new_capital,
    sellTo: row.sell_to,
    // NỢ KỸ THUẬT (chưa gán đợt cụ thể): portfolio.settings không có cột nào
    // lưu classPriority (chỉ dùng khi formula = PRIORITY_WATERFALL) — DB lưu
    // được allocation_formula = 'PRIORITY_WATERFALL' nhưng không lưu được thứ
    // tự ưu tiên đi kèm. Tạm luôn lấy từ DEFAULT_CONFIG cho tới khi có cột.
    classPriority: DEFAULT_CONFIG.classPriority,
  };
}

export function mapToSnapshot(input: SnapshotSourceData): PortfolioSnapshot {
  const classValues = { STOCKS: 0, CRYPTO: 0, GOLD: 0, CASH: 0 } as Record<AssetClass, number>;
  const earmarkedPots = { STOCKS: 0, CRYPTO: 0, GOLD: 0, CASH: 0 } as Record<AssetClass, number>;
  const missingPriceSymbols: string[] = [];
  let cashReserveVnd = 0;

  // `v_positions`/`v_allocation` KHÔNG trả dòng nào cho instrument chưa có
  // giao dịch (không phải dòng quantity = 0) — xem addendum Task 14 mục 2.
  // Bốn biến khởi tạo sẵn 0 cho cả bốn asset class ở trên chính là cách xử lý
  // ca "danh mục mới toanh, allocation rỗng": vòng lặp dưới đây có thể không
  // chạm tới một class nào cả mà kết quả vẫn là 0, không phải undefined.
  for (const r of input.allocation) {
    if (r.asset_class === 'CASH') {
      const balance = r.cash_balance_vnd ?? 0;
      classValues.CASH += balance;
      if (r.earmarked_for !== null) earmarkedPots[r.earmarked_for] += balance;
      else cashReserveVnd += balance;
      continue;
    }

    const isHeld = (r.quantity ?? 0) > 0;
    if (!isHeld) continue; // mã watchlist chưa mua: bỏ qua, không chặn kế hoạch

    if (r.market_value_vnd === null) {
      // Đang giữ mà không biết giá ⇒ phải chặn kế hoạch, không được coi là 0đ
      // (market_value_vnd = NULL là chủ ý của v_allocation — addendum mục 3).
      missingPriceSymbols.push(r.symbol);
      continue;
    }
    classValues[r.asset_class] += r.market_value_vnd;
  }

  const targets = {} as Record<AssetClass, TargetBand>;
  for (const c of ASSET_CLASSES) {
    const t = input.targets.find((x) => x.asset_class === c);
    if (!t) {
      throw new Error(
        `Thiếu tỷ trọng mục tiêu của nhóm ${c} trong portfolio.allocation_targets. ` +
        `Chạy lại file seed 2026-08-22-portfolio-seed.sql.`,
      );
    }
    targets[c] = { targetPct: t.target_pct, minPct: t.min_pct, maxPct: t.max_pct };
  }

  const settings = input.settings;

  return {
    asOf: input.asOf,
    classValues,
    earmarkedPots,
    cashReserveVnd,
    targets,
    monthlyContributionVnd: settings?.monthly_contribution_vnd ?? DEFAULT_MONTHLY_CONTRIBUTION_VND,
    incomeReceivedVnd: input.incomeReceivedVnd,
    drawdowns: input.drawdowns,
    portfolioDrawdownPct: input.portfolioDrawdownPct,
    crashLevels: input.crashLevels.map((l) => ({
      level: l.level,
      drawdownPct: l.drawdown_pct,
      deployPctOfReserve: l.deploy_pct_of_reserve,
    })),
    crashHistory: input.crashEvents.map((e) => ({
      level: e.level,
      episodeStart: e.episode_start,
      reserveAtEpisodeStartVnd: e.reserve_at_episode_start_vnd,
    })),
    currentEpisodeStart: input.currentEpisodeStart,
    missingPriceSymbols,
    contributionRecordedThisPeriod: input.contributionRecordedThisPeriod,
    watchlist: input.watchlist,
    config: buildEngineConfig(settings),
  };
}

/** Ghép I/O rồi gọi mapToSnapshot. Mọi biến đổi dữ liệu đều nằm trong hàm thuần trên. */
export async function loadSnapshot(userId: string, asOf: string): Promise<PortfolioSnapshot> {
  const sources = await repo.fetchSnapshotSources(userId, asOf);
  return mapToSnapshot(sources);
}

// mapToSnapshot là HÀM THUẦN — toàn bộ phần biến đổi dữ liệu nằm ở đây để test
// được không cần DB, không cần mock supabase. File này CHỈ được import
// '../domain/types' và '../types/portfolio' — không import portfolioRepo hay
// bất cứ gì chạm supabase, để tránh kéo theo lib/supabaseClient.ts (module đó
// ném lỗi NGAY LÚC IMPORT nếu thiếu biến môi trường, sẽ làm biến mất toàn bộ
// test file này thay vì cho fail đúng lý do). loadSnapshot (ghép I/O) nằm ở
// portfolioRepo.ts, không nằm ở đây.

import { monthlyPool } from '../domain/dcaPool';
import { ASSET_CLASSES, DEFAULT_CONFIG } from '../domain/types';
import type {
  AssetClass, EngineConfig, MonthlyPool, PortfolioSnapshot, TargetBand,
} from '../domain/types';
import type { SettingsRow, SnapshotSourceData } from '../types/portfolio';

/**
 * Z mặc định khi chưa có dòng `portfolio.settings` — khớp giá trị default của
 * cột DB (core.sql: `monthly_contribution_vnd numeric not null default 3000000`).
 */
const DEFAULT_MONTHLY_CONTRIBUTION_VND = 3_000_000;

/**
 * Số tiền chia tháng này, dựng từ đúng một dòng `portfolio.settings`.
 *
 * Export vì CẢ HAI nơi cần nó: mapToSnapshot lấy `totalVnd` cho engine, còn
 * portfolioView lấy từng phần cho UI. Nếu mỗi nơi tự gọi monthlyPool với tham số
 * riêng thì giá trị mặc định và cách đọc null sẽ trôi khỏi nhau, và con số UI
 * hiện ra sẽ khác con số engine chia — đúng loại bug không ai phát hiện.
 */
export function poolFromSettings(settings: SettingsRow | null): MonthlyPool {
  return monthlyPool({
    contributionVnd:
      settings?.monthly_contribution_vnd ?? DEFAULT_MONTHLY_CONTRIBUTION_VND,
    capitalVnd: settings?.dca_capital_vnd ?? 0,
    months: settings?.dca_months ?? null,
  });
}

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

  // Cột `numeric` không có CHECK constraint nào chặn giá trị âm (core.sql:114).
  // "Góp âm hàng tháng" không phải trạng thái nghiệp vụ hợp lệ nào — nếu lọt qua
  // sẽ ném exception KHÔNG AI BẮT từ allocate.ts, thay vì một trạng thái chặn có
  // lý do tiếng Việt rõ ràng ở ngay biên đọc dữ liệu này.
  // NaN phải chặn RIÊNG: `NaN < 0` là false nên phép so sánh âm ngay dưới đây
  // không bắt được nó, và NaN sẽ chảy tới poolVnd làm cả kế hoạch thành NaN
  // trong khi status vẫn là READY (bàn giao 2026-08-22 mục 2).
  if (!Number.isFinite(row.monthly_contribution_vnd)) {
    throw new Error(
      `Giá trị monthly_contribution_vnd trong portfolio.settings không phải số hợp lệ: ` +
      `${row.monthly_contribution_vnd}. Kiểm tra lại cấu hình số tiền góp hàng tháng.`,
    );
  }

  if (row.monthly_contribution_vnd < 0) {
    throw new Error(
      `Giá trị monthly_contribution_vnd trong portfolio.settings đang âm: ` +
      `${row.monthly_contribution_vnd} đ. Số tiền góp hàng tháng không thể âm.`,
    );
  }

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
      // trigger tx_validate KHÔNG kiểm số dư nên một túi CASH (kể cả túi DCA)
      // đạt tới được số dư âm thật trên DB. Lọt qua đây thì nó cộng thẳng vào
      // classValues/earmarkedPots — kế hoạch sinh ra TRÔNG hợp lệ mà sai hẳn tỷ
      // trọng các nhóm khác (một nhóm bị trừ đúng phần bị nhóm này "vay").
      if (!Number.isFinite(balance)) {
        throw new Error(
          `Túi CASH "${r.symbol}" có cash_balance_vnd không phải số hữu hạn ` +
          `(${balance}) trong portfolio.v_allocation. Kiểm tra lại dữ liệu nguồn.`,
        );
      }
      if (balance < 0) {
        throw new Error(
          `Túi CASH "${r.symbol}" có cash_balance_vnd âm (${balance} đ) trong ` +
          `portfolio.v_allocation — số dư tiền mặt không thể âm. Kiểm tra lại ` +
          `portfolio.transactions.`,
        );
      }
      classValues.CASH += balance;
      if (r.earmarked_for === null) {
        cashReserveVnd += balance;
      } else if (r.earmarked_for === 'CASH') {
        // Hợp đồng domain (types.ts: "earmarkedPots.CASH luôn = 0") không được
        // DB cưỡng chế: constraint earmark_chi_cho_cash chỉ đòi asset_class =
        // 'CASH', không cấm earmarked_for = 'CASH'. Một túi CASH "đặt tên cho
        // chính CASH" là vô nghĩa nghiệp vụ (không phải trạng thái hợp lệ nào
        // của DCA) — nếu lọt qua sẽ bị toEarmarkedValues (actionPlan.ts) bỏ
        // sót vì hàm đó chỉ cộng STOCKS+CRYPTO+GOLD, tức tiền biến mất khỏi cả
        // earmarkedPots lẫn cashReserveVnd. Ném lỗi thay vì nuốt im lặng.
        throw new Error(
          `Túi CASH "${r.symbol}" có earmarked_for = CASH — vô nghĩa (một túi CASH ` +
          `không thể "đặt tên" cho chính CASH). Kiểm tra lại portfolio.instruments.earmarked_for.`,
        );
      } else {
        earmarkedPots[r.earmarked_for] += balance;
      }
      continue;
    }

    const quantity = r.quantity ?? 0;
    if (quantity < 0) {
      // Số lượng âm nghĩa là sổ giao dịch có SELL vượt quá số đang giữ — một
      // lỗi dữ liệu thật sự, không phải "chưa mua" (đó là quantity = 0/null).
      // Bỏ qua âm thầm sẽ khiến tài sản này biến mất khỏi classValues mà
      // không ai biết, nên phải ném lỗi rõ ràng thay vì continue.
      throw new Error(
        `Vị thế "${r.symbol}" có số lượng âm (${quantity}) trong portfolio.v_allocation — ` +
        `sổ giao dịch có SELL vượt quá số đang giữ. Kiểm tra lại portfolio.transactions.`,
      );
    }
    if (quantity === 0) continue; // mã watchlist chưa mua: bỏ qua, không chặn kế hoạch

    if (r.market_value_vnd === null) {
      // Đang giữ mà không biết giá ⇒ phải chặn kế hoạch, không được coi là 0đ
      // (market_value_vnd = NULL là chủ ý của v_allocation — addendum mục 3).
      missingPriceSymbols.push(r.symbol);
      continue;
    }
    if (!Number.isFinite(r.market_value_vnd)) {
      // NaN không phải null nên không rơi vào nhánh missingPriceSymbols ở trên —
      // nó cộng thẳng vào classValues và biến cả nhóm tài sản thành NaN. Hậu quả
      // còn kín hơn cả throw: `gaps[c] > 0` với NaN luôn là false, allocate coi
      // như "không nhóm nào thiếu" và trả unallocatedVnd = pool — TRÔNG như một
      // kế hoạch hợp lệ bình thường.
      throw new Error(
        `Vị thế "${r.symbol}" có market_value_vnd không phải số hữu hạn ` +
        `(${r.market_value_vnd}) trong portfolio.v_allocation. Kiểm tra lại dữ liệu nguồn.`,
      );
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
    // Cùng lý do như monthly_contribution_vnd: `Math.abs(NaN - 100) > 0.01` là
    // false, nên phép kiểm "tổng phải bằng 100" ngay dưới KHÔNG bắt được một
    // target_pct = NaN. Band NaN thì mọi phép so band cũng lặng lẽ ra false.
    for (const [ten, gia_tri] of [
      ['target_pct', t.target_pct], ['min_pct', t.min_pct], ['max_pct', t.max_pct],
    ] as const) {
      if (!Number.isFinite(gia_tri)) {
        throw new Error(
          `Giá trị ${ten} của nhóm ${c} trong portfolio.allocation_targets không phải ` +
          `số hợp lệ: ${gia_tri}. Kiểm tra lại cấu hình phân bổ mục tiêu.`,
        );
      }
    }

    targets[c] = { targetPct: t.target_pct, minPct: t.min_pct, maxPct: t.max_pct };
  }

  // core.sql:100-109 chỉ có constraint band_hop_le (min ≤ target ≤ max của TỪNG
  // nhóm) — không có constraint nào ép tổng bốn target_pct = 100. Lệch tổng lọt
  // qua sẽ không tự lộ ra: allocate vẫn chạy, chỉ âm thầm chia gap sai (Σ=90%
  // từng khiến một nhóm nhận nhiều hơn cả gap thật của chính nó).
  const targetPctSum = ASSET_CLASSES.reduce((sum, c) => sum + targets[c].targetPct, 0);
  if (Math.abs(targetPctSum - 100) > 0.01) {
    throw new Error(
      `Tổng target_pct của portfolio.allocation_targets là ${targetPctSum}%, phải bằng ` +
      `100%. Kiểm tra lại cấu hình phân bổ mục tiêu.`,
    );
  }

  const settings = input.settings;

  // Gọi TRƯỚC khi dựng pool: buildEngineConfig là chỗ kiểm
  // `monthly_contribution_vnd` và message của nó gọi đúng TÊN CỘT DB, thứ người
  // dùng cần để biết sửa ở đâu. monthlyPool cũng chặn số âm/NaN nhưng nó ở tầng
  // domain nên không được biết tên cột — để nó ném trước thì message mất thông
  // tin đó.
  const config = buildEngineConfig(settings);

  // Hai cột DCA cũng là `numeric`/`integer` không có CHECK nào chặn số âm. Kiểm
  // ở đây (biên đọc dữ liệu) để message gọi tên cột; monthlyPool chặn lần hai.
  if (settings !== null) {
    if (!Number.isFinite(settings.dca_capital_vnd) || settings.dca_capital_vnd < 0) {
      throw new Error(
        `Giá trị dca_capital_vnd trong portfolio.settings không hợp lệ: ` +
        `${settings.dca_capital_vnd}. Vốn DCA phải là số không âm.`,
      );
    }
    // `null` là hợp lệ (chưa đặt kế hoạch). Số 0/âm thì monthlyPool coi như chưa
    // đặt — KHÔNG ném lỗi, vì đó là trạng thái bình thường của form điền dở.
    if (settings.dca_months !== null && !Number.isFinite(settings.dca_months)) {
      throw new Error(
        `Giá trị dca_months trong portfolio.settings không phải số hợp lệ: ` +
        `${settings.dca_months}. Kiểm tra lại số tháng DCA.`,
      );
    }
  }

  // Tiền chia tháng này = tiền góp đều + vốn DCA rải ra.
  const pool = poolFromSettings(settings);

  return {
    asOf: input.asOf,
    classValues,
    earmarkedPots,
    cashReserveVnd,
    targets,
    // Engine chỉ cần TỔNG. Chi tiết "tổng gồm những gì" là việc của tầng hiển
    // thị (portfolioView.ts) — nhồi vào snapshot thì mọi fixture domain phải
    // khai một trường mà engine không bao giờ đọc.
    monthlyContributionVnd: pool.totalVnd,
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
    config,
  };
}

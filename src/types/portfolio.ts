// Kiểu của row trả về từ schema `portfolio`. Đây là hình dạng DB,
// KHÁC với kiểu của tầng domain — mapToSnapshot làm việc chuyển đổi.
//
// Tên cột lấy nguyên văn từ hai file migration đã chạy thật trên Postgres 16:
//   supabase/migrations/2026-08-22-portfolio-core.sql (bảng gốc)
//   supabase/migrations/2026-08-22-portfolio-views.sql (v_positions, v_allocation)
import type {
  AssetClass, CrashLevel, EngineConfig, TargetBand, WatchlistItem,
} from '../domain/types';

/**
 * Một dòng của `portfolio.v_allocation`. View này SUY RA vị thế từ sổ giao dịch
 * (`v_legs` → `v_positions` → `v_allocation`) nên có hai đặc điểm khác trực giác:
 *   - Instrument CHƯA CÓ giao dịch nào thì KHÔNG xuất hiện dòng nào ở đây (không
 *     phải dòng với quantity = 0) — xem addendum Task 14 mục 2.
 *   - `market_value_vnd` là NULL khi thiếu giá (chủ ý, không phải 0) — xem
 *     addendum Task 14 mục 3.
 */
export interface AllocationRow {
  instrument_id: string;
  asset_class: AssetClass;
  symbol: string;
  earmarked_for: AssetClass | null;
  quantity: number | null;
  cost_basis_vnd: number | null;
  cash_balance_vnd: number | null;
  price_vnd: number | null;
  price_as_of: string | null;
  market_value_vnd: number | null;
}

/** Một dòng của `portfolio.allocation_targets`. */
export interface TargetRow {
  asset_class: AssetClass;
  target_pct: number;
  min_pct: number;
  max_pct: number;
}

/**
 * Một dòng của `portfolio.settings` (bảng chỉ có tối đa 1 dòng/user, primary
 * key = user_id). `allocation_formula` và `sell_to` là cột `text` KHÔNG có
 * CHECK constraint trong DB (core.sql không ràng buộc) — buildSnapshot phải tự
 * validate, xem addendum Task 14 mục 4.
 */
export interface SettingsRow {
  monthly_contribution_vnd: number;
  watch_deviation_pp: number;
  strong_rebalance_pp: number;
  min_sell_amount_vnd: number;
  rounding_step_vnd: number;
  allocation_formula: string;
  cash_eligible_for_new_capital: boolean;
  sell_to: string;
  /** Vốn có sẵn để rải dần (ĐỒNG). 0 = không có kế hoạch DCA. */
  dca_capital_vnd: number;
  /** Số tháng rải hết `dca_capital_vnd`. `null` = chưa đặt. */
  dca_months: number | null;
  /** Tiền mặt đang có, người dùng nhập tay (ĐỒNG). Tính vào nhóm CASH. */
  cash_on_hand_vnd: number;
}

/** Một dòng của `portfolio.crash_reserve_levels`. */
export interface CrashLevelRow {
  level: number;
  drawdown_pct: number;
  deploy_pct_of_reserve: number;
}

/** Một dòng của `portfolio.crash_reserve_events`. */
export interface CrashEventRow {
  level: number;
  episode_start: string;
  reserve_at_episode_start_vnd: number;
}

/** Toàn bộ dữ liệu thô cần để dựng một PortfolioSnapshot. */
export interface SnapshotSourceData {
  asOf: string;
  allocation: AllocationRow[];
  targets: TargetRow[];
  settings: SettingsRow | null;
  crashLevels: CrashLevelRow[];
  crashEvents: CrashEventRow[];
  watchlist: WatchlistItem[];
  incomeReceivedVnd: number;
  portfolioDrawdownPct: number;
  drawdowns: Record<AssetClass, number>;
  currentEpisodeStart: string;
  contributionRecordedThisPeriod: boolean;
}

export type { AssetClass, CrashLevel, EngineConfig, TargetBand, WatchlistItem };

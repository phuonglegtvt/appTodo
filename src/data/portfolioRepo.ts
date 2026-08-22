// CRUD thuần trên schema `portfolio`. KHÔNG có logic nghiệp vụ ở đây.
// KHÔNG nuốt lỗi: mọi lỗi Supabase đều ném lên kèm message tiếng Việt.
//
// ĐỌC-CHỈ ở đợt này (Task 14): chỉ có các hàm fetch*, không có insert/update/
// delete nào. Ghi transaction thuộc đợt 3.
//
// service_role KHÔNG có usage trên schema `portfolio` (chỉ grant anon,
// authenticated — đúng spec §3.3). Các hàm dưới đây dùng session của user nên
// không bị chặn; đừng để bất kỳ đường nào ở đây đi qua service key.

import { supabase } from '../lib/supabaseClient';
import { mapToSnapshot } from './buildSnapshot';
import type { PortfolioSnapshot } from '../domain/types';
import type {
  AllocationRow, CrashEventRow, CrashLevelRow, SettingsRow,
  SnapshotSourceData, TargetRow, WatchlistItem,
} from '../types/portfolio';

/** Mọi truy vấn schema `portfolio` đi qua đây. */
const portfolioSchema = () => supabase.schema('portfolio');

function throwIfError(action: string, error: { message: string } | null): void {
  if (error) {
    console.error(`Lỗi ${action}:`, error);
    throw new Error(`Không ${action} được: ${error.message}`);
  }
}

/**
 * `v_allocation` (portfolio-views.sql) trả về `p.*` của v_positions (gồm cả
 * các cột không cần cho AllocationRow như name/currency/lot_size) cộng thêm
 * price_vnd, price_as_of, market_value_vnd. Chỉ select đúng 10 cột cần dùng.
 *
 * ⚠️ instrument chưa có giao dịch nào thì KHÔNG có dòng ở đây (không phải
 * dòng quantity = 0) — mapToSnapshot (buildSnapshot.ts) mới là nơi default 0.
 * ⚠️ market_value_vnd = NULL nghĩa là thiếu giá, không phải 0đ.
 * ⚠️ PostgREST KHÔNG đảm bảo thứ tự dòng khi không có `.order()` — `symbol`
 * đi thẳng từ đây vào `missingPriceSymbols` rồi hiện lên UI bằng `join(', ')`
 * (actionPlan.ts), nên phải `.order('symbol')` để danh sách đó ổn định giữa
 * các lần tải, không xáo trộn ngẫu nhiên.
 */
export async function fetchAllocation(userId: string): Promise<AllocationRow[]> {
  // LƯU Ý: chuỗi select() phải là MỘT literal duy nhất (không nối bằng `+`) —
  // supabase-js suy ra kiểu cột từ chính nội dung literal của select(); nối
  // chuỗi bằng `+` làm mất khả năng đó và tsc báo lỗi convert kiểu.
  const { data, error } = await portfolioSchema()
    .from('v_allocation')
    .select('instrument_id, asset_class, symbol, earmarked_for, quantity, cost_basis_vnd, cash_balance_vnd, price_vnd, price_as_of, market_value_vnd')
    .eq('user_id', userId)
    .order('symbol');
  throwIfError('tải phân bổ danh mục', error);
  return (data ?? []) as AllocationRow[];
}

export async function fetchTargets(userId: string): Promise<TargetRow[]> {
  const { data, error } = await portfolioSchema()
    .from('allocation_targets')
    .select('asset_class, target_pct, min_pct, max_pct')
    .eq('user_id', userId);
  throwIfError('tải tỷ trọng mục tiêu', error);
  return (data ?? []) as TargetRow[];
}

export async function fetchSettings(userId: string): Promise<SettingsRow | null> {
  // (chuỗi select() phải là một literal duy nhất — xem lý do ở fetchAllocation)
  const { data, error } = await portfolioSchema()
    .from('settings')
    .select('monthly_contribution_vnd, watch_deviation_pp, strong_rebalance_pp, min_sell_amount_vnd, rounding_step_vnd, allocation_formula, cash_eligible_for_new_capital, sell_to')
    .eq('user_id', userId)
    .maybeSingle();
  throwIfError('tải cấu hình', error);
  return (data ?? null) as SettingsRow | null;
}

export async function fetchCrashLevels(userId: string): Promise<CrashLevelRow[]> {
  const { data, error } = await portfolioSchema()
    .from('crash_reserve_levels')
    .select('level, drawdown_pct, deploy_pct_of_reserve')
    .eq('user_id', userId)
    .order('level');
  throwIfError('tải bậc Crash Reserve', error);
  return (data ?? []) as CrashLevelRow[];
}

export async function fetchCrashEvents(userId: string): Promise<CrashEventRow[]> {
  const { data, error } = await portfolioSchema()
    .from('crash_reserve_events')
    .select('level, episode_start, reserve_at_episode_start_vnd')
    .eq('user_id', userId)
    .order('triggered_at');
  throwIfError('tải lịch sử Crash Reserve', error);
  return (data ?? []) as CrashEventRow[];
}

/**
 * Watchlist lấy từ bảng CŨ `public.stocks` (chỉ đọc).
 * ĐƠN VỊ: bảng cũ lưu giá bằng NGHÌN ĐỒNG ⇒ ×1000 để về VND. Đây là một trong
 * hai chỗ duy nhất được phép quy đổi đơn vị.
 *
 * NỢ KỸ THUẬT (đợt 4): lotSize gán cứng = 100. Nguồn đúng lâu dài là
 * `portfolio.instruments.lot_size`, nhưng join chéo schema (public.stocks →
 * portfolio.instruments) qua PostgREST không đáng tin ở đợt này. Cả 56 mã
 * watchlist hiện tại đều là cổ phiếu VN lô 100 nên giá trị tạm này đúng thực
 * tế, nhưng vẫn là số cứng cần thay khi đợt 4 làm xong providers/.
 */
export async function fetchWatchlist(userId: string): Promise<WatchlistItem[]> {
  const { data, error } = await supabase
    .from('stocks')
    .select('ticker, company_name, group, current_price, price_threshold')
    .eq('user_id', userId);
  throwIfError('tải watchlist cổ phiếu', error);

  type Row = {
    ticker: string; company_name: string; group: 'attack' | 'balance' | 'defense';
    current_price: number | null; price_threshold: number | null;
  };
  return ((data ?? []) as Row[]).map((r) => ({
    symbol: r.ticker,
    name: r.company_name,
    group: r.group,
    currentPriceVnd: r.current_price === null ? null : r.current_price * 1000,
    thresholdVnd: r.price_threshold === null ? null : r.price_threshold * 1000,
    lotSize: 100,
  }));
}

/**
 * Gom mọi nguồn cần cho một snapshot. Gọi song song — một lỗi thì ném luôn,
 * không trả snapshot nửa vời.
 *
 * PHẦN CHƯA LÀM Ở ĐỢT NÀY:
 *   - incomeReceivedVnd thật (đợt 3): tạm 0.
 *   - contributionRecordedThisPeriod thật (đợt 3): tạm false ⇒ luôn có alert
 *     CONTRIBUTION_MISSING — an toàn hơn là giả vờ đã ghi nhận.
 *   - drawdowns + portfolioDrawdownPct thật (đợt 6, cần benchmark + snapshots):
 *     tạm 0, currentEpisodeStart tạm = asOf. Hệ quả: Crash Reserve chưa bao
 *     giờ kích hoạt cho tới khi đợt 6 xong — ĐÚNG và an toàn (thà không đề
 *     xuất, hơn là đề xuất dựa trên số 0 giả).
 */
export async function fetchSnapshotSources(
  userId: string, asOf: string,
): Promise<SnapshotSourceData> {
  const [allocation, targets, settings, crashLevels, crashEvents, watchlist] =
    await Promise.all([
      fetchAllocation(userId), fetchTargets(userId), fetchSettings(userId),
      fetchCrashLevels(userId), fetchCrashEvents(userId), fetchWatchlist(userId),
    ]);

  return {
    asOf, allocation, targets, settings, crashLevels, crashEvents, watchlist,
    incomeReceivedVnd: 0,
    portfolioDrawdownPct: 0,
    drawdowns: { STOCKS: 0, CRYPTO: 0, GOLD: 0, CASH: 0 },
    currentEpisodeStart: asOf,
    contributionRecordedThisPeriod: false,
  };
}

/**
 * Ghép I/O rồi gọi mapToSnapshot. Mọi biến đổi dữ liệu đều nằm trong hàm
 * thuần đó (buildSnapshot.ts), không lặp lại ở đây.
 *
 * Đặt ở FILE NÀY (không phải buildSnapshot.ts) để buildSnapshot.ts không kéo
 * theo '../lib/supabaseClient' — module đó ném lỗi NGAY LÚC IMPORT khi thiếu
 * biến môi trường, sẽ làm cả file test của mapToSnapshot "biến mất" (import
 * lỗi ⇒ 0 test được thu thập) thay vì fail đúng lý do trên máy/CI không có
 * `.env`. Việc tách này giữ mapToSnapshot test được hoàn toàn không cần DB,
 * đúng addendum Task 14 mục 8.
 */
export async function loadSnapshot(userId: string, asOf: string): Promise<PortfolioSnapshot> {
  const sources = await fetchSnapshotSources(userId, asOf);
  return mapToSnapshot(sources);
}

// CRUD thuần trên schema `portfolio`. KHÔNG có logic nghiệp vụ ở đây.
// KHÔNG nuốt lỗi: mọi lỗi Supabase đều ném lên kèm message tiếng Việt.
//
// ĐƯỜNG GHI: chỉ có CẤU HÌNH (allocation_targets, settings) — xem cuối file.
// KHÔNG có insert/update/delete nào lên `portfolio.transactions`: sổ giao dịch
// chưa có UI, và bảng đó cố tình không có policy UPDATE (§14 sổ bất biến).
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
import type { AssetClass } from '../domain/types';

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
    .select('monthly_contribution_vnd, watch_deviation_pp, strong_rebalance_pp, min_sell_amount_vnd, rounding_step_vnd, allocation_formula, cash_eligible_for_new_capital, sell_to, dca_capital_vnd, dca_months, cash_on_hand_vnd')
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


// ---------------------------------------------------------------------------
// ĐƯỜNG GHI CẤU HÌNH
// ---------------------------------------------------------------------------
// Đây là đường ghi ĐẦU TIÊN của module. Hệ quả đáng ghi: hai lỗ `NaN` mà bản
// bàn giao 2026-08-22 mục 2 để lại ("chưa có đường ghi nào đặt được NaN vào
// cột đó") từ đây hết còn giả thuyết — guard Number.isFinite trong
// buildSnapshot.ts là thứ chặn chúng.

/** Một dòng target người dùng sửa được ở màn Cấu hình. */
export interface TargetUpsert {
  asset_class: AssetClass;
  target_pct: number;
  min_pct: number;
  max_pct: number;
}

/**
 * Ghi lại cả BỐN dòng target trong một lần. Ghi cả bốn chứ không ghi từng dòng:
 * bất biến "tổng target = 100" là bất biến CỦA CẢ BỘ, nên lưu từng dòng một sẽ
 * để lại trạng thái trung gian tổng ≠ 100 mà mapToSnapshot ném lỗi khi đọc.
 *
 * Kiểm ở client TRƯỚC khi gửi, vì DB không có constraint nào ép tổng = 100
 * (core.sql chỉ có band_hop_le cho từng nhóm). Không kiểm thì lưu xong mới vỡ
 * lúc mở tab, và người dùng không biết mình vừa làm gì sai.
 */
export async function saveTargets(userId: string, rows: TargetUpsert[]): Promise<void> {
  if (rows.length !== 4) {
    throw new Error(`Cần đúng 4 nhóm tỷ trọng, đang có ${rows.length}.`);
  }

  for (const r of rows) {
    for (const [ten, v] of [
      ['tỷ trọng mục tiêu', r.target_pct], ['giới hạn dưới', r.min_pct],
      ['giới hạn trên', r.max_pct],
    ] as const) {
      if (!Number.isFinite(v)) {
        throw new Error(`${ten} của nhóm ${r.asset_class} không phải số hợp lệ.`);
      }
      if (v < 0 || v > 100) {
        throw new Error(`${ten} của nhóm ${r.asset_class} phải nằm trong 0–100, đang là ${v}.`);
      }
    }
    // Cùng luật với CHECK band_hop_le trong core.sql — báo trước khi DB từ chối,
    // để message là tiếng Việt chứ không phải tên constraint.
    if (!(r.min_pct <= r.target_pct && r.target_pct <= r.max_pct)) {
      throw new Error(
        `Nhóm ${r.asset_class}: phải có giới hạn dưới ≤ mục tiêu ≤ giới hạn trên ` +
        `(đang là ${r.min_pct} ≤ ${r.target_pct} ≤ ${r.max_pct}).`,
      );
    }
  }

  const tong = rows.reduce((s, r) => s + r.target_pct, 0);
  if (Math.abs(tong - 100) > 0.01) {
    throw new Error(`Tổng tỷ trọng mục tiêu đang là ${tong}%, phải bằng đúng 100%.`);
  }

  const { error } = await portfolioSchema()
    .from('allocation_targets')
    .upsert(
      rows.map((r) => ({ user_id: userId, ...r })),
      { onConflict: 'user_id,asset_class' },
    );
  throwIfError('lưu tỷ trọng mục tiêu', error);
}

/**
 * Lưu số tiền góp hàng tháng (Z). Chặn NaN và số âm tại đây thay vì để chúng
 * xuống tới engine: `NaN < 0` là false nên phép so sánh âm một mình không đủ.
 */
export async function saveMonthlyContribution(
  userId: string, amountVnd: number,
): Promise<void> {
  if (!Number.isFinite(amountVnd)) {
    throw new Error('Số tiền góp hàng tháng không phải số hợp lệ.');
  }
  if (amountVnd < 0) {
    throw new Error(`Số tiền góp hàng tháng không thể âm (đang là ${amountVnd} đ).`);
  }
  const { error } = await portfolioSchema()
    .from('settings')
    .update({ monthly_contribution_vnd: amountVnd })
    .eq('user_id', userId);
  throwIfError('lưu số tiền góp hàng tháng', error);
}


/**
 * Lưu kế hoạch DCA: vốn có sẵn + số tháng rải. Ghi CẢ HAI trong một lần vì chúng
 * chỉ có nghĩa cùng nhau — lưu riêng lẻ để lại trạng thái "có vốn, chưa có tháng"
 * mà app phải hiện cảnh báo, dù người dùng đã điền đủ cả hai ô rồi.
 *
 * `months === null` là hợp lệ: xoá kế hoạch, giữ lại vốn.
 */
export async function saveDcaPlan(
  userId: string, capitalVnd: number, months: number | null,
): Promise<void> {
  if (!Number.isFinite(capitalVnd)) {
    throw new Error('Vốn DCA không phải số hợp lệ.');
  }
  if (capitalVnd < 0) {
    throw new Error(`Vốn DCA không thể âm (đang là ${capitalVnd} đ).`);
  }
  if (months !== null) {
    if (!Number.isFinite(months)) {
      throw new Error('Số tháng DCA không phải số hợp lệ.');
    }
    // Cùng luật với CHECK settings_dca_months_duong — báo trước khi DB từ chối,
    // để message là tiếng Việt chứ không phải tên constraint.
    if (!Number.isInteger(months) || months <= 0) {
      throw new Error(`Số tháng DCA phải là số nguyên lớn hơn 0 (đang là ${months}).`);
    }
  }

  const { error } = await portfolioSchema()
    .from('settings')
    .update({ dca_capital_vnd: capitalVnd, dca_months: months })
    .eq('user_id', userId);
  throwIfError('lưu kế hoạch DCA', error);
}

/**
 * Lưu số tiền mặt đang có (ĐỒNG). Cùng luật với CHECK settings_cash_on_hand_khong_am
 * — báo trước bằng tiếng Việt thay vì để DB trả tên constraint.
 */
export async function saveCashOnHand(userId: string, amountVnd: number): Promise<void> {
  if (!Number.isFinite(amountVnd)) {
    throw new Error('Số tiền mặt không phải số hợp lệ.');
  }
  if (amountVnd < 0) {
    throw new Error(`Số tiền mặt không thể âm (đang là ${amountVnd} đ).`);
  }
  const { error } = await portfolioSchema()
    .from('settings')
    .update({ cash_on_hand_vnd: amountVnd })
    .eq('user_id', userId);
  throwIfError('lưu số tiền mặt', error);
}

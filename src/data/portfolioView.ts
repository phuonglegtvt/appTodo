// Seam duy nhất nối holdings thật với engine domain.
//
// Luồng:  stocks/cryptos/golds  →  toAllocationRows  →  mapToSnapshot
//                                                          ↓
//                                    buildActionPlan  +  planTopUp  →  PortfolioView
//
// Component chỉ HIỂN THỊ `PortfolioView`, không tính gì. Mọi phép tính nằm trong
// `src/domain/` (đã test riêng) hoặc trong file này (test ở portfolioView.test.ts).
//
// Hàm THUẦN — không I/O, không React. Hook `usePortfolioView` mới gọi mạng.

import { buildActionPlan } from '../domain/actionPlan';
import { planTopUp } from '../domain/topUp';
import { ASSET_CLASSES } from '../domain/types';
import { mapToSnapshot, poolFromSettings } from './buildSnapshot';
import { toAllocationRows } from './holdingsMap';
import type {
  ActionPlan, Alert, AssetClass, MonthlyPool, PortfolioSnapshot, Weight,
} from '../domain/types';
import type { TopUpPlan } from '../domain/topUp';
import type { SettingsRow, TargetRow } from '../types/portfolio';
import type { Stock } from '../types/stock';
import type { Crypto } from '../types/crypto';
import type { Gold } from '../types/gold';

/** Số liệu một nhóm, đủ để vẽ một dòng bảng. */
export interface ClassView {
  assetClass: AssetClass;
  marketValueVnd: number;
  /** `null` khi không nhóm nào trong lớp này có giá mua ⇒ không tính được lãi/lỗ. */
  costBasisVnd: number | null;
  /** marketValue − costBasis. `null` khi thiếu giá mua. */
  unrealizedPnlVnd: number | null;
}

export interface PortfolioViewInput {
  asOf: string;
  stocks: Stock[];
  cryptos: Crypto[];
  golds: Gold[];
  targets: TargetRow[];
  settings: SettingsRow | null;
  usdVnd: number;
}

export interface PortfolioView {
  snapshot: PortfolioSnapshot;
  plan: ActionPlan;
  topUp: TopUpPlan;
  weights: Weight[];
  /**
   * `snapshot.monthlyContributionVnd` gồm những gì. Snapshot chỉ mang TỔNG (engine
   * chỉ cần thế); phần chi tiết ở đây để UI nói được "13tr = 3tr góp + 10tr vốn
   * DCA" — không có dòng đó thì cột "Góp tháng này" tự nhiên to lên mà không ai
   * biết vì sao.
   */
  monthlyPool: MonthlyPool;
  byClass: Record<AssetClass, ClassView>;
  /** Nhóm đáng hiện lên bảng: có target > 0 hoặc đang giữ tiền. */
  visibleClasses: AssetClass[];
  /** Alert đã lọc bỏ những loại đợt này không có cách nào hành động. */
  alerts: Alert[];
  missingQuantitySymbols: string[];
  /** true ⇒ tỷ trọng đang tính thiếu dữ liệu, UI phải nói ra. */
  incompleteData: boolean;
}

/**
 * Alert đợt này KHÔNG hiện, kèm lý do — không phải nuốt lỗi mà là không bày ra
 * một việc người dùng không có cách nào làm:
 *   · CONTRIBUTION_MISSING — cần sổ giao dịch mới biết tháng này đã nộp tiền
 *     chưa. Chưa có sổ ⇒ alert này bật vĩnh viễn, mỗi tháng, không đổi được.
 *     Màn Cấu hình có ghi chú tĩnh nói thẳng chuyện này.
 */
const ALERT_CHUA_DUNG_DUOC: ReadonlySet<Alert['code']> = new Set(['CONTRIBUTION_MISSING']);

function zeroClassViews(): Record<AssetClass, ClassView> {
  const out = {} as Record<AssetClass, ClassView>;
  for (const c of ASSET_CLASSES) {
    out[c] = { assetClass: c, marketValueVnd: 0, costBasisVnd: null, unrealizedPnlVnd: null };
  }
  return out;
}

export function buildPortfolioView(input: PortfolioViewInput): PortfolioView {
  if (input.targets.length === 0) {
    throw new Error(
      'Chưa có cấu hình tỷ trọng mục tiêu. Chạy file seed ' +
      'supabase/migrations/2026-08-22-portfolio-seed.sql rồi tải lại trang ' +
      '(xem docs/portfolio-db-setup.md).',
    );
  }

  const { rows, missingQuantitySymbols } = toAllocationRows({
    stocks: input.stocks, cryptos: input.cryptos, golds: input.golds,
    usdVnd: input.usdVnd,
    cashOnHandVnd: input.settings?.cash_on_hand_vnd ?? 0,
  });

  const snapshot = mapToSnapshot({
    asOf: input.asOf,
    allocation: rows,
    targets: input.targets,
    settings: input.settings,
    // Crash Reserve và drawdown chưa thuộc phạm vi tab này: danh sách rỗng làm
    // engine không bao giờ đề xuất giải ngân reserve. Thà không đề xuất còn hơn
    // đề xuất dựa trên số 0 giả (cùng lý do như đợt 1+2).
    crashLevels: [],
    crashEvents: [],
    // Watchlist rỗng ⇒ không gợi ý mã cụ thể. Gợi ý mã cần lô chẵn + ngưỡng giá,
    // là việc của màn Kế hoạch tháng, không phải tab tỷ trọng này.
    watchlist: [],
    incomeReceivedVnd: 0,
    portfolioDrawdownPct: 0,
    drawdowns: { STOCKS: 0, CRYPTO: 0, GOLD: 0, CASH: 0 },
    currentEpisodeStart: input.asOf,
    // Nói THẬT: không theo dõi tiền vào thì không thể khẳng định đã nộp. Alert
    // sinh ra từ đây bị lọc khỏi `alerts` bên dưới, không bị tắt trong engine.
    contributionRecordedThisPeriod: false,
  });

  // CÙNG hàm mapToSnapshot đã dùng để ra `monthlyContributionVnd`, nên chi tiết
  // ở đây cộng lại luôn đúng bằng tổng engine chia (có test kiểm bất biến đó).
  const pool = poolFromSettings(input.settings);

  const plan = buildActionPlan(snapshot);
  const topUp = planTopUp(snapshot.classValues, snapshot.targets);

  // Gộp vốn và giá trị theo nhóm. `costBasisVnd` giữ `null` khi KHÔNG một dòng
  // nào trong nhóm có giá mua — khác hẳn 0đ, và là thứ quyết định có hiện được
  // cột lãi/lỗ hay không.
  const byClass = zeroClassViews();
  for (const r of rows) {
    const view = byClass[r.asset_class];
    view.marketValueVnd += r.market_value_vnd ?? 0;
    if (r.cost_basis_vnd !== null) {
      view.costBasisVnd = (view.costBasisVnd ?? 0) + r.cost_basis_vnd;
    }
  }
  for (const c of ASSET_CLASSES) {
    const v = byClass[c];
    v.unrealizedPnlVnd = v.costBasisVnd === null ? null : v.marketValueVnd - v.costBasisVnd;
  }

  const visibleClasses = ASSET_CLASSES.filter(
    (c) => snapshot.targets[c].targetPct > 0 || snapshot.classValues[c] > 0,
  );

  return {
    snapshot,
    plan,
    topUp,
    weights: plan.weights,
    monthlyPool: pool,
    byClass,
    visibleClasses,
    alerts: plan.alerts.filter((a) => !ALERT_CHUA_DUNG_DUOC.has(a.code)),
    missingQuantitySymbols,
    incompleteData: missingQuantitySymbols.length > 0
      || snapshot.missingPriceSymbols.length > 0,
  };
}

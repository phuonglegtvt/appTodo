// Hợp đồng kiểu của toàn bộ tầng domain.
// LUẬT: file này (và mọi file trong src/domain/) KHÔNG import gì cả.
// Không supabase, không react, không fetch, không Date.now().

export type AssetClass = 'STOCKS' | 'CRYPTO' | 'GOLD' | 'CASH';

/** Thứ tự cố định dùng cho mọi vòng lặp — để kết quả luôn tái lập được. */
export const ASSET_CLASSES: readonly AssetClass[] = ['STOCKS', 'CRYPTO', 'GOLD', 'CASH'];

/**
 * Bốn mức trạng thái, giải mâu thuẫn của §7 (spec mục 4.3).
 * Band là CỔNG, điểm % chỉ nâng mức độ. Lệnh bán chỉ mở ở REBALANCE_REQUIRED.
 */
export type BandStatus = 'OK' | 'WATCH' | 'OUT_OF_BAND' | 'REBALANCE_REQUIRED';

export interface TargetBand {
  targetPct: number;
  minPct: number;
  maxPct: number;
}

export type AllocationFormula = 'PROPORTIONAL_GAP' | 'PRIORITY_WATERFALL';

export interface EngineConfig {
  formula: AllocationFormula;
  /** Trong band nhưng lệch ≥ ngưỡng này → WATCH (cảnh báo mềm, không bán). */
  watchDeviationPp: number;
  /** Ngoài band VÀ lệch ≥ ngưỡng này → REBALANCE_REQUIRED (mở khoá lệnh bán). */
  strongRebalancePp: number;
  /** §18: không sinh lệnh bán vụn dưới mức này. */
  minSellAmountVnd: number;
  roundingStepVnd: number;
  /** false = tiền mới luôn đi vào tài sản, không để lại Cash. */
  cashEligibleForNewCapital: boolean;
  sellTo: 'TARGET' | 'BAND_EDGE';
  /** Chỉ dùng khi formula = PRIORITY_WATERFALL. Số lớn = ưu tiên trước. */
  classPriority: Record<AssetClass, number>;
}

export const DEFAULT_CONFIG: EngineConfig = {
  formula: 'PROPORTIONAL_GAP',
  watchDeviationPp: 3,
  strongRebalancePp: 5,
  minSellAmountVnd: 5_000_000,
  roundingStepVnd: 100_000,
  cashEligibleForNewCapital: true,
  sellTo: 'TARGET',
  classPriority: { STOCKS: 4, CRYPTO: 3, GOLD: 2, CASH: 1 },
};

/** §17. Tất cả tính trên TỔNG HIỆN TẠI (không cộng tiền mới). */
export interface Weight {
  assetClass: AssetClass;
  valueVnd: number;
  weightPct: number;
  targetPct: number;
  deviationPp: number;
  targetValueVnd: number;
  /** targetValueVnd − valueVnd. Dương = thiếu, âm = thừa. */
  differenceVnd: number;
}

export interface Allocation {
  assetClass: AssetClass;
  amountVnd: number;
  /** Khoảng thiếu đã dùng để chia — giữ lại để giải thích trên UI. */
  gapVnd: number;
}

/**
 * BẤT BIẾN: sum(allocations.amountVnd) + unallocatedVnd === poolVnd, LUÔN LUÔN.
 * Khi mọi class đều thừa (không có ứng viên), toàn bộ pool rơi vào unallocatedVnd
 * — tiền không được phép biến mất.
 * "LUÔN LUÔN" là vô điều kiện vì pool âm bị NÉM LỖI thay vì trả về kết quả: mọi
 * lần TRẢ VỀ một AllocationResult đều thoả bất biến, không có ngoại lệ nào.
 */
export interface AllocationResult {
  allocations: Allocation[];
  unallocatedVnd: number;
}

export type StockGroupVi = 'attack' | 'balance' | 'defense';

export interface WatchlistItem {
  symbol: string;
  name: string;
  group: StockGroupVi;
  currentPriceVnd: number | null;
  thresholdVnd: number | null;
  lotSize: number;
}

export interface Candidate {
  symbol: string;
  name: string;
  group: StockGroupVi;
  priceVnd: number;
  /** priceVnd × lotSize — số tiền tối thiểu để mua được 1 lô. */
  lotCostVnd: number;
  /** Giá đang thấp hơn ngưỡng bao nhiêu %. Càng lớn càng "rẻ". */
  belowThresholdPct: number;
}

export interface ShortfallNote {
  symbol: string;
  lotCostVnd: number;
  shortfallVnd: number;
  /** null khi không có tiền vào hàng tháng (không suy ra được bao lâu). */
  monthsToAfford: number | null;
}

export interface CandidateResult {
  affordable: Candidate[];
  shortfalls: ShortfallNote[];
}

export interface SellOrder {
  assetClass: AssetClass;
  sellVnd: number;
}

/**
 * BẤT BIẾN: sum(destinations) + unallocatedVnd === sum(sells), LUÔN LUÔN.
 * unallocatedVnd > 0 xảy ra khi mọi nhóm còn lại đều thừa và Cash bị loại bằng
 * cấu hình — tiền bán được vẫn phải hiện ra, không được biến mất im lặng.
 */
export interface SellPlan {
  sells: SellOrder[];
  /** Tiền bán được phân bổ vào đâu. */
  destinations: Allocation[];
  /** Tiền bán được mà không có nhóm nào nhận — nằm lại trong VND-RESERVE. */
  unallocatedVnd: number;
  /** Lệnh bị bỏ vì dưới minSellAmountVnd — vẫn phải báo, không nuốt im lặng. */
  skipped: { assetClass: AssetClass; wouldSellVnd: number }[];
}

export interface CrashLevel {
  level: number;
  drawdownPct: number;
  deployPctOfReserve: number;
}

export interface CrashEventRecord {
  level: number;
  episodeStart: string;
  reserveAtEpisodeStartVnd: number;
}

export interface CrashRecommendation {
  episodeStart: string;
  /** Số dư reserve tại lúc đợt sụt giảm bắt đầu. MỌI % tính trên số này. */
  reserveAtEpisodeStartVnd: number;
  triggeredLevels: { level: number; drawdownPct: number; deployVnd: number }[];
  totalDeployVnd: number;
  /** Bậc kế tiếp chưa tới, để UI hiện "còn cách bao nhiêu". */
  nextLevel: { level: number; drawdownPct: number; gapPp: number } | null;
}

export interface DrawdownStats {
  currentPct: number;
  maxPct: number;
  ath: { date: string; value: number };
  trough: { date: string; value: number };
  daysSinceHigh: number;
  recoveryPct: number;
}

export type AlertCode =
  | 'BAND_WATCH'          // trong band nhưng lệch đáng kể — §21 gọi là REBALANCE WARNING
  | 'OUT_OF_BAND'
  | 'REBALANCE_REQUIRED'
  | 'STOCK_DRAWDOWN'
  | 'CRYPTO_DRAWDOWN'
  | 'GOLD_DRAWDOWN'
  | 'PORTFOLIO_DRAWDOWN'
  | 'CASH_BELOW_MIN'
  | 'CONTRIBUTION_MISSING';

export interface Alert {
  code: AlertCode;
  severity: 'INFO' | 'WARN' | 'ACTION';
  message: string;
  /**
   * Nhóm tài sản sinh ra alert này — để UI gắn đúng dòng bảng mà không phải
   * parse `message` tiếng Việt. Optional: alert không thuộc riêng nhóm nào
   * (VD PORTFOLIO_DRAWDOWN, CONTRIBUTION_MISSING) thì để trống.
   */
  assetClass?: AssetClass;
}

export type PlanStatus = 'READY' | 'EMPTY_PORTFOLIO' | 'MISSING_PRICES' | 'EARMARK_EXCEEDS_CASH';

export interface ActionPlan {
  asOf: string;
  status: PlanStatus;
  /** Lý do không tạo được kế hoạch, tiếng Việt, hiện thẳng cho người dùng. */
  blockedReason: string | null;
  totalVnd: number;
  weights: Weight[];
  statuses: Record<AssetClass, BandStatus>;
  sources: {
    monthlyContributionVnd: number;
    incomeReceivedVnd: number;
    poolVnd: number;
  };
  buys: Allocation[];
  unallocatedVnd: number;
  doNotBuy: { assetClass: AssetClass; reason: string }[];
  tickerCandidates: CandidateResult;
  sellPlan: SellPlan | null;
  crash: CrashRecommendation | null;
  alerts: Alert[];
}

export interface PortfolioSnapshot {
  /** ISO date. LUÔN truyền vào — domain không được gọi Date.now(). */
  asOf: string;
  /** Giá trị đã giải ngân theo asset_class (VND). Túi DCA nằm ở CASH. */
  classValues: Record<AssetClass, number>;
  /** Tiền trong từng túi DCA (VND). earmarkedPots.CASH luôn = 0. */
  earmarkedPots: Record<AssetClass, number>;
  /** Số dư túi VND-RESERVE (VND). */
  cashReserveVnd: number;
  targets: Record<AssetClass, TargetBand>;
  monthlyContributionVnd: number;
  incomeReceivedVnd: number;
  drawdowns: Record<AssetClass, number>;
  portfolioDrawdownPct: number;
  crashLevels: CrashLevel[];
  crashHistory: CrashEventRecord[];
  currentEpisodeStart: string;
  /** Tài sản ĐANG GIỮ mà thiếu giá. Khác rỗng ⇒ từ chối tạo kế hoạch. */
  missingPriceSymbols: string[];
  /** §19 CONTRIBUTION_MISSING: kỳ này đã ghi nhận tiền vào chưa. */
  contributionRecordedThisPeriod: boolean;
  watchlist: WatchlistItem[];
  config: EngineConfig;
}

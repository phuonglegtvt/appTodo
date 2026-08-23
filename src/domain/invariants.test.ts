// Bất biến của toàn bộ tầng domain, kiểm trên 1.000 snapshot sinh giả ngẫu nhiên.
//
// VÌ SAO LÀ LCG CÓ SEED CHỨ KHÔNG PHẢI Math.random():
// với app tiền, TÁI LẬP ĐƯỢC quan trọng hơn ngẫu nhiên thật. Cùng seed luôn cho
// cùng dãy số, nên khi một ca đỏ thì lần chạy sau lỗi lặp lại y nguyên và chép
// được thẳng thành test tay. Không thêm dependency nào.
//
// BẤT BIẾN QUAN TRỌNG NHẤT: Σ phân bổ + chưa phân bổ === pool. Sai làm tròn ở
// đây là mất tiền thật hoặc thừa tiền ảo, nên kiểm bằng `toBe` (khớp tuyệt đối)
// chứ không `toBeCloseTo`.
//
// KỶ LUẬT CHỐNG "TEST RỖNG NGHĨA": mọi vòng lặp có nhánh bỏ qua đều ĐẾM số ca
// thật sự chạy tới assert và assert chính con số đếm đó đủ lớn. Một property
// test xanh mà không assert lần nào còn tệ hơn không có test, vì nó quảng cáo
// một độ bao phủ không tồn tại.
//
// BỘ SINH KHÁC BRIEF Ở HAI ĐIỂM (đã đo, ghi trong task-13-report.md):
//   1. Có thêm dạng danh mục GẦN MỤC TIÊU. Bộ sinh chỉ-ngẫu-nhiên-rộng của brief
//      cho ra danh mục lệch mục tiêu ở hầu hết mọi ca ⇒ 998/1.000 ca có ít nhất
//      một nhóm REBALANCE_REQUIRED ⇒ bất biến "không bán bừa" chỉ chạy 2 lần.
//   2. Có thêm hai dạng chạm cổng chặn MISSING_PRICES và EMPTY_PORTFOLIO —
//      bộ sinh của brief không bao giờ tạo được hai trạng thái này.

import { describe, it, expect } from 'vitest';
import { buildActionPlan } from './actionPlan';
import { allocate } from './allocate';
import { computeDrawdown } from './drawdown';
import { DEFAULT_CRASH_LEVELS } from './crashReserve';
import { ASSET_CLASSES, DEFAULT_CONFIG } from './types';
import type {
  ActionPlan, AllocationFormula, AssetClass, CrashEventRecord, EngineConfig, PlanStatus,
  PortfolioSnapshot, StockGroupVi, TargetBand, WatchlistItem,
} from './types';

// ---------------------------------------------------------------------------
// Bộ sinh số giả ngẫu nhiên
// ---------------------------------------------------------------------------

/**
 * LCG có seed — cùng seed luôn cho cùng dãy số. Khi test đỏ, lỗi lặp lại y
 * nguyên ở lần chạy sau (Math.random() thì không). Không thêm dependency nào.
 */
function createRandom(seed: number) {
  let state = seed >>> 0;
  return {
    /** [0, 1) */
    next(): number {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state / 4294967296;
    },
    /** Số nguyên trong [min, max] */
    int(min: number, max: number): number {
      return min + Math.floor(this.next() * (max - min + 1));
    },
    pick<T>(arr: readonly T[]): T {
      return arr[Math.floor(this.next() * arr.length)];
    },
  };
}

type Random = ReturnType<typeof createRandom>;

// ---------------------------------------------------------------------------
// Tham số cố định của bộ sinh
// ---------------------------------------------------------------------------

const TARGETS: Record<AssetClass, TargetBand> = {
  STOCKS: { targetPct: 50, minPct: 40, maxPct: 55 },
  CRYPTO: { targetPct: 20, minPct: 15, maxPct: 25 },
  GOLD:   { targetPct: 15, minPct: 10, maxPct: 20 },
  CASH:   { targetPct: 15, minPct: 7,  maxPct: 20 },
};

const FORMULAS: readonly AllocationFormula[] = ['PROPORTIONAL_GAP', 'PRIORITY_WATERFALL'];
const ROUNDING_STEPS: readonly number[] = [1, 1_000, 100_000, 1_000_000];
const STOCK_GROUPS: readonly StockGroupVi[] = ['attack', 'balance', 'defense'];

// Round 2, item 1 — `classPriority` chưa từng khác mặc định trong bộ sinh cũ,
// và thứ tự mặc định `{STOCKS:4, CRYPTO:3, GOLD:2, CASH:1}` TRÙNG KHÍT thứ tự
// tự nhiên `ASSET_CLASSES`, nên `[...candidates].sort(theo classPriority)` ở
// `allocate.ts:69-71` luôn cho cùng kết quả với `[...candidates]` KHÔNG sort
// — tức đoạn sort đó là dead-code-equivalent trên toàn corpus. Bốn permutation
// dưới đây, trong đó có MỘT permutation ĐẢO HẲN so với mặc định, để `order`
// sau sort thật sự có thể khác thứ tự tự nhiên.
const CLASS_PRIORITY_VARIANTS: readonly Record<AssetClass, number>[] = [
  DEFAULT_CONFIG.classPriority,                     // mặc định — giữ để đối chứng
  { STOCKS: 1, CRYPTO: 2, GOLD: 3, CASH: 4 },        // ĐẢO HẲN so với mặc định
  { STOCKS: 3, CRYPTO: 1, GOLD: 4, CASH: 2 },        // xáo trộn khác #1
  { STOCKS: 2, CRYPTO: 4, GOLD: 1, CASH: 3 },        // xáo trộn khác #2
];

function isDefaultClassPriority(p: Record<AssetClass, number>): boolean {
  return ASSET_CLASSES.every((c) => p[c] === DEFAULT_CONFIG.classPriority[c]);
}

/** Bốn dạng danh mục sinh ra. Tỷ lệ chọn ở `pickShape`. */
type SnapshotShape = 'EMPTY' | 'MISSING_PRICES' | 'NEAR_TARGET' | 'WIDE';

/**
 * Trộn bốn dạng danh mục. Tỷ lệ chọn theo mục tiêu ĐỘ BAO PHỦ, không theo mức
 * độ hay gặp ngoài đời: mỗi dạng phải đủ nhiều ca để bất biến gắn với nó thật
 * sự được assert (số đo thực tế nằm trong `it('bộ sinh phủ đủ…')` bên dưới).
 */
function pickShape(r: Random): SnapshotShape {
  const roll = r.int(0, 99);
  if (roll <= 2) return 'EMPTY';            //  3% — chạm cổng EMPTY_PORTFOLIO
  if (roll <= 6) return 'MISSING_PRICES';   //  4% — chạm cổng MISSING_PRICES
  if (roll <= 46) return 'NEAR_TARGET';     // 40% — quanh mục tiêu, ÍT khi phải bán
  return 'WIDE';                            // 53% — ngẫu nhiên rộng như brief
}

function randomClassValues(r: Random, shape: SnapshotShape): Record<AssetClass, number> {
  const classValues = {} as Record<AssetClass, number>;

  if (shape === 'EMPTY') {
    for (const c of ASSET_CLASSES) classValues[c] = 0;
    return classValues;
  }

  if (shape === 'NEAR_TARGET') {
    // Danh mục của người dùng KỶ LUẬT: quanh mục tiêu, lệch tối đa ±4,0 điểm %.
    // Nhờ dạng này mới có ca OK/WATCH và ca KHÔNG có nhóm nào REBALANCE_REQUIRED.
    const total = r.int(50, 2_000) * 1_000_000;
    for (const c of ASSET_CLASSES) {
      const pct = TARGETS[c].targetPct + r.int(-40, 40) / 10;
      classValues[c] = Math.max(0, Math.round(total * (pct / 100)));
    }
    return classValues;
  }

  // WIDE / MISSING_PRICES: ngẫu nhiên rộng, có cả 0 để chạm biên nhóm rỗng.
  for (const c of ASSET_CLASSES) {
    classValues[c] = r.int(0, 20) === 0 ? 0 : r.int(0, 1_000) * 1_000_000;
  }
  return classValues;
}

/** Watchlist ngẫu nhiên — có cả dữ liệu xấu (giá null, lô chẵn 0) để chạm các guard. */
function randomWatchlist(r: Random): WatchlistItem[] {
  const out: WatchlistItem[] = [];
  const count = r.int(0, 5);
  for (let k = 0; k < count; k++) {
    out.push({
      symbol: `MA${k}`,
      name: `Mã số ${k}`,
      group: r.pick(STOCK_GROUPS),
      currentPriceVnd: r.int(0, 9) === 0 ? null : r.int(5, 200) * 1_000,
      thresholdVnd: r.int(0, 9) === 0 ? null : r.int(5, 200) * 1_000,
      lotSize: r.pick([100, 100, 100, 1, 0]),
    });
  }
  return out;
}

const EPISODE_START = '2026-06-01';

/**
 * Lịch sử Crash Reserve của ĐỢT HIỆN TẠI.
 *
 * VÌ SAO KHÔNG ĐỂ RỖNG NHƯ BRIEF: lịch sử rỗng ⇒ `reserveAtEpisodeStartVnd`
 * bằng đúng số dư hiện tại, mà năm bậc mặc định cộng lại vừa tròn 100%
 * (10+15+20+25+30) ⇒ tổng đề xuất luôn vừa khít số dư và trần
 * `Math.min(requested, remaining)` không bao giờ phải chặn. Đã thử: bỏ hẳn
 * trần đi thì bộ test vẫn xanh. Nên ở đây có ca số dư LÚC ĐỢT BẮT ĐẦU lớn hơn
 * số dư hiện tại (tiền đã giải ngân bớt trong đợt) — đúng ca cần tới trần.
 */
function randomCrashHistory(r: Random, cashReserveVnd: number): CrashEventRecord[] {
  if (r.int(0, 9) <= 5) return [];   // 60% số ca: đợt này chưa dùng bậc nào
  const out: CrashEventRecord[] = [];
  // 20% có thêm sự kiện của ĐỢT KHÁC — phải bị bộ lọc theo đợt loại ra hoàn toàn.
  if (r.int(0, 4) === 0) {
    out.push({ level: 5, episodeStart: '2025-01-01', reserveAtEpisodeStartVnd: 9_999_000_000 });
  }
  const reserveAtEpisodeStartVnd = cashReserveVnd + r.int(0, 300) * 1_000_000;
  const usedCount = r.int(1, 3);
  for (let level = 1; level <= usedCount; level++) {
    out.push({ level, episodeStart: EPISODE_START, reserveAtEpisodeStartVnd });
  }
  return out;
}

function randomSnapshot(r: Random): PortfolioSnapshot {
  const shape = pickShape(r);
  const classValues = randomClassValues(r, shape);

  // RÀNG BUỘC 1 — túi DCA không được vượt số tiền đang có trong Cash.
  // Mỗi túi tối đa 1/4 Cash ⇒ tổng ba túi ≤ 3/4 Cash ≤ Cash, nên ca 1 của
  // `checkEarmarkConflict` (tổng túi > Cash ⇒ Cash tự do ÂM) không sinh ra được.
  // Đó là ca DỮ LIỆU HỎNG, không phải ca vận hành: để nó vào đây thì mọi tỷ
  // trọng phía sau đều tính trên một số âm và mọi bất biến khác mất ý nghĩa.
  const potCeiling = Math.floor(classValues.CASH / 4);
  const earmarkedPots: Record<AssetClass, number> = {
    STOCKS: r.int(0, potCeiling),
    CRYPTO: r.int(0, potCeiling),
    GOLD:   r.int(0, potCeiling),
    CASH: 0,
  };

  // RÀNG BUỘC 2 — dạng EMPTY phải có cổ tức = 0.
  // Thứ tự cổng trong `buildActionPlan` là EARMARK trước, EMPTY sau. Danh mục
  // rỗng có Cash tự do = 0, nên chỉ cần cổ tức > 0 là bị chặn ở EARMARK và
  // nhánh EMPTY_PORTFOLIO không bao giờ chạy tới. Danh mục rỗng + chưa có cổ
  // tức là đúng ca người dùng mới bắt đầu.
  const incomeReceivedVnd = shape === 'EMPTY' ? 0 : r.int(0, 20) * 100_000;

  const missingCount = shape === 'MISSING_PRICES' ? r.int(1, 2) : 0;

  const cashReserveVnd = r.int(0, 200) * 1_000_000;

  return {
    asOf: '2026-09-01',
    classValues,
    earmarkedPots,
    cashReserveVnd,
    targets: TARGETS,
    monthlyContributionVnd: r.int(0, 50) * 100_000,
    incomeReceivedVnd,
    drawdowns: {
      STOCKS: r.int(0, 700) / 10, CRYPTO: r.int(0, 900) / 10,
      GOLD: r.int(0, 400) / 10, CASH: 0,
    },
    portfolioDrawdownPct: r.int(0, 700) / 10,
    crashLevels: DEFAULT_CRASH_LEVELS,
    crashHistory: randomCrashHistory(r, cashReserveVnd),
    currentEpisodeStart: EPISODE_START,
    missingPriceSymbols: ['VNM', 'FPT'].slice(0, missingCount),
    contributionRecordedThisPeriod: r.next() > 0.5,
    watchlist: randomWatchlist(r),
    config: {
      ...DEFAULT_CONFIG,
      formula: r.pick(FORMULAS),
      roundingStepVnd: r.pick(ROUNDING_STEPS),
      cashEligibleForNewCapital: r.next() > 0.3,
      sellTo: r.next() > 0.5 ? 'TARGET' : 'BAND_EDGE',
    },
  };
}

// ---------------------------------------------------------------------------
// Bộ dữ liệu dùng chung + tiện ích báo lỗi
// ---------------------------------------------------------------------------

const CORPUS_SEED = 20260822;
const CASE_COUNT = 1000;

const CORPUS: PortfolioSnapshot[] = (() => {
  const r = createRandom(CORPUS_SEED);
  const out: PortfolioSnapshot[] = [];
  for (let i = 0; i < CASE_COUNT; i++) out.push(randomSnapshot(r));
  return out;
})();

/**
 * Mô tả một ca lỗi: seed + chỉ số ca + snapshot đầy đủ. Thiếu cái này thì khi
 * một ca ngẫu nhiên đỏ, không ai debug được — nên nó là bắt buộc, không tuỳ chọn.
 */
function describeCase(seed: number, index: number, payload: unknown): string {
  return `Ca #${index} (seed ${seed}). Snapshot gây lỗi:\n${JSON.stringify(payload)}`;
}

/**
 * Assert một bất biến. Chuỗi mô tả CHỈ được dựng khi bất biến vỡ — dựng
 * JSON.stringify cho cả 1.000 ca thì tốn thời gian mà không ai đọc.
 */
function expectInvariant(passed: boolean, describeFailure: () => string): void {
  expect(passed, passed ? undefined : describeFailure()).toBe(true);
}

/** Kế hoạch của cả bộ, dựng một lần rồi dùng lại — tránh chạy engine 10 lần. */
let plansCache: ActionPlan[] | null = null;
function plans(): ActionPlan[] {
  if (plansCache === null) {
    plansCache = CORPUS.map((snapshot, index) => {
      try {
        return buildActionPlan(snapshot);
      } catch (error) {
        throw new Error(
          `buildActionPlan NÉM LỖI: ${(error as Error).message}\n`
          + describeCase(CORPUS_SEED, index, snapshot),
        );
      }
    });
  }
  return plansCache;
}

// ---------------------------------------------------------------------------

describe('SỨC KHOẺ BỘ SINH — mọi nhánh phải có đủ ca để bất biến thật sự chạy', () => {
  it('phủ đủ bốn PlanStatus, bốn BandStatus và mọi tuỳ chọn cấu hình', () => {
    const statusCount: Record<PlanStatus, number> = {
      READY: 0, EMPTY_PORTFOLIO: 0, MISSING_PRICES: 0, EARMARK_EXCEEDS_CASH: 0,
    };
    const bandCount: Record<string, number> = {
      OK: 0, WATCH: 0, OUT_OF_BAND: 0, REBALANCE_REQUIRED: 0,
    };
    const stepCount = new Map<number, number>();
    let waterfall = 0;
    let cashIneligible = 0;
    let bandEdge = 0;
    let blockedWithMoney = 0;

    plans().forEach((p, index) => {
      const s = CORPUS[index];
      statusCount[p.status] += 1;
      for (const c of ASSET_CLASSES) bandCount[p.statuses[c]] += 1;
      stepCount.set(s.config.roundingStepVnd, (stepCount.get(s.config.roundingStepVnd) ?? 0) + 1);
      if (s.config.formula === 'PRIORITY_WATERFALL') waterfall += 1;
      if (!s.config.cashEligibleForNewCapital) cashIneligible += 1;
      if (s.config.sellTo === 'BAND_EDGE') bandEdge += 1;
      if (p.status !== 'READY' && p.sources.poolVnd > 0) blockedWithMoney += 1;
    });

    // Ngưỡng đặt ở khoảng MỘT NỬA số đo thực tế (ghi trong task-13-report.md):
    // đủ rộng để không vỡ vì một thay đổi nhỏ ở band/cấu hình phía trên, nhưng
    // vẫn đỏ ngay nếu một nhánh biến mất — nhánh chết thì số đếm rơi về ~0.
    expect(statusCount.READY, 'quá ít ca READY — bộ sinh đang tạo danh mục phi thực tế')
      .toBeGreaterThanOrEqual(600);
    expect(statusCount.MISSING_PRICES, 'không đủ ca chạm cổng MISSING_PRICES')
      .toBeGreaterThanOrEqual(15);
    expect(statusCount.EMPTY_PORTFOLIO, 'không đủ ca chạm cổng EMPTY_PORTFOLIO')
      .toBeGreaterThanOrEqual(15);
    expect(statusCount.EARMARK_EXCEEDS_CASH, 'không đủ ca chạm cổng EARMARK_EXCEEDS_CASH')
      .toBeGreaterThanOrEqual(10);
    // Ca bị chặn mà pool = 0 thì bất biến tiền ở nhánh chặn là tầm thường.
    expect(blockedWithMoney, 'ca bị chặn mà vẫn CÓ tiền trong pool quá ít')
      .toBeGreaterThanOrEqual(40);

    for (const band of ['OK', 'WATCH', 'OUT_OF_BAND', 'REBALANCE_REQUIRED']) {
      expect(bandCount[band], `không đủ ca ở trạng thái band ${band}`).toBeGreaterThanOrEqual(50);
    }

    expect(waterfall, 'thiếu ca PRIORITY_WATERFALL').toBeGreaterThanOrEqual(300);
    expect(CASE_COUNT - waterfall, 'thiếu ca PROPORTIONAL_GAP').toBeGreaterThanOrEqual(300);
    expect(cashIneligible, 'thiếu ca cashEligibleForNewCapital = false').toBeGreaterThanOrEqual(150);
    expect(bandEdge, 'thiếu ca sellTo = BAND_EDGE').toBeGreaterThanOrEqual(300);
    expect(CASE_COUNT - bandEdge, 'thiếu ca sellTo = TARGET').toBeGreaterThanOrEqual(300);
    for (const step of ROUNDING_STEPS) {
      expect(stepCount.get(step) ?? 0, `thiếu ca roundingStepVnd = ${step}`)
        .toBeGreaterThanOrEqual(100);
    }
  });
});

describe('BẤT BIẾN của allocate — luồng tiền mới (addsToTotal = true)', () => {
  // Ba test dưới đây gọi allocate với poolVnd = monthlyContributionVnd ≥ 0 và
  // addsToTotal = true, nên KHÔNG chạm được nhánh nào trong hai nhánh ném lỗi:
  //   · `poolVnd < 0`                              — pool ở đây luôn ≥ 0
  //   · `!addsToTotal && poolVnd > classValues.CASH` — bị chặn bởi `!addsToTotal`
  // Hai nhánh đó có describe riêng ngay bên dưới.

  it('tổng phân bổ + chưa phân bổ === pool, TUYỆT ĐỐI', () => {
    let checked = 0;
    CORPUS.forEach((s, index) => {
      const pool = s.monthlyContributionVnd;
      const res = allocate({
        classValues: s.classValues, targets: TARGETS, poolVnd: pool,
        addsToTotal: true, config: s.config,
      });
      const sum = res.allocations.reduce((acc, a) => acc + a.amountVnd, 0);
      // Không dùng toBeCloseTo: tiền phải khớp TUYỆT ĐỐI, không "gần đúng".
      expectInvariant(
        sum + res.unallocatedVnd === pool,
        () => `Σ phân bổ (${sum}) + chưa phân bổ (${res.unallocatedVnd}) ≠ pool (${pool}). `
          + describeCase(CORPUS_SEED, index, s),
      );
      checked += 1;
    });
    expect(checked, 'không có nhánh bỏ qua nào — phải chạy đủ 1.000 ca').toBe(CASE_COUNT);
  });

  it('không bao giờ phân bổ số âm hoặc NaN', () => {
    let amountsChecked = 0;
    let casesChecked = 0;
    CORPUS.forEach((s, index) => {
      const res = allocate({
        classValues: s.classValues, targets: TARGETS,
        poolVnd: s.monthlyContributionVnd, addsToTotal: true, config: s.config,
      });
      for (const a of res.allocations) {
        expectInvariant(
          Number.isFinite(a.amountVnd) && a.amountVnd > 0,
          () => `Khoản phân bổ ${a.assetClass} không hợp lệ: ${a.amountVnd}. `
            + describeCase(CORPUS_SEED, index, s),
        );
        amountsChecked += 1;
      }
      expectInvariant(
        Number.isFinite(res.unallocatedVnd) && res.unallocatedVnd >= 0,
        () => `Chưa phân bổ không hợp lệ: ${res.unallocatedVnd}. `
          + describeCase(CORPUS_SEED, index, s),
      );
      casesChecked += 1;
    });
    // Vòng trong rỗng khi pool = 0 (không có gì để phân bổ) — nên phải đếm riêng.
    expect(amountsChecked, 'quá ít khoản phân bổ được kiểm').toBeGreaterThanOrEqual(500);
    expect(casesChecked).toBe(CASE_COUNT);
  });

  it('mọi khoản phân bổ là bội số của bước làm tròn, TRỪ phần dư dồn cuối', () => {
    let casesWithAllocation = 0;
    let casesWithResidual = 0;
    CORPUS.forEach((s, index) => {
      const step = s.config.roundingStepVnd;
      const res = allocate({
        classValues: s.classValues, targets: TARGETS,
        poolVnd: s.monthlyContributionVnd, addsToTotal: true, config: s.config,
      });
      // Nhiều nhất MỘT khoản được phép lệch bội số (khoản nhận phần dư).
      const offStep = res.allocations.filter((a) => a.amountVnd % step !== 0);
      expectInvariant(
        offStep.length <= 1,
        () => `${offStep.length} khoản lệch bội số ${step} (tối đa được 1): `
          + `${JSON.stringify(offStep)}. ${describeCase(CORPUS_SEED, index, s)}`,
      );
      if (res.allocations.length > 0) casesWithAllocation += 1;
      if (offStep.length === 1) casesWithResidual += 1;
    });
    expect(casesWithAllocation, 'quá ít ca có khoản phân bổ để kiểm bội số')
      .toBeGreaterThanOrEqual(500);
    // Nếu con số này về 0 thì nhánh "dồn phần dư" đã chết mà test vẫn xanh.
    expect(casesWithResidual, 'nhánh dồn phần dư gần như không được chạy')
      .toBeGreaterThanOrEqual(50);
  });

  it('không nhóm nào thiếu ⇒ TOÀN BỘ pool nằm ở chưa phân bổ, tiền không biến mất', () => {
    // Ca này hiếm trong bộ 1.000 ngẫu nhiên (đo được 2 ca), nên dựng riêng: ba
    // nhóm tài sản đều VƯỢT mục tiêu, chỉ Cash còn thiếu, mà Cash lại bị loại
    // bằng cấu hình ⇒ danh sách ứng viên rỗng.
    const r = createRandom(20260823);
    let checked = 0;
    for (let index = 0; index < 200; index++) {
      const total = r.int(100, 5_000) * 1_000_000;
      const pool = r.int(1, 50) * 100_000;   // ≤ 5tr, rất nhỏ so với total ≥ 100tr
      const classValues: Record<AssetClass, number> = {
        STOCKS: Math.round(total * 0.60),    // mục tiêu 50%
        CRYPTO: Math.round(total * 0.24),    // mục tiêu 20%
        GOLD:   Math.round(total * 0.16),    // mục tiêu 15%
        CASH: 0,
      };
      const config = {
        ...DEFAULT_CONFIG,
        formula: r.pick(FORMULAS),
        roundingStepVnd: r.pick(ROUNDING_STEPS),
        cashEligibleForNewCapital: false,
      };
      const res = allocate({ classValues, targets: TARGETS, poolVnd: pool, addsToTotal: true, config });
      expectInvariant(
        res.allocations.length === 0 && res.unallocatedVnd === pool,
        () => `Phải để nguyên ${pool} đ ở chưa phân bổ, nhận được `
          + `${JSON.stringify(res)}. `
          + describeCase(20260823, index, { classValues, pool, config }),
      );
      checked += 1;
    }
    expect(checked).toBe(200);
  });
});

describe('BẤT BIẾN của allocate — PIN ĐÍCH ĐẾN của phần dư (không chỉ pin tổng)', () => {
  // LỖ THẬT mà bất biến "Σ phân bổ + chưa phân bổ === pool" không thấy:
  // allocate.ts:159 ĐỊNH NGHĨA unallocatedVnd = poolVnd − Σ allocations, nên
  // bất biến tổng là ĐỒNG NHẤT THỨC theo cách viết code — nó xanh ngay cả khi
  // phần dư rơi NHẦM nhóm. Property test này thêm một MÔ HÌNH THAM CHIẾU
  // (oracle) mirror lại — không suy diễn — đúng công thức của allocate.ts, để
  // biết CHÍNH XÁC nhóm nào phải nhận bao nhiêu, rồi so khớp TUYỆT ĐỐI với
  // kết quả thật. Sai đích đến (dù tổng vẫn đúng) sẽ làm lệch MỘT giá trị cụ
  // thể trong `model.amounts`, không chỉ lệch một bộ đếm.
  //
  // QUY TẮC TỰ DẪN TỪ CODE (không chép mô tả work order làm chân lý):
  //
  //   · allocate.ts:69-81 (`splitByPriority`, chỉ chạy khi formula =
  //     PRIORITY_WATERFALL): nếu pool > tổng khoảng thiếu của các ứng viên,
  //     phần dư TRƯỚC LÀM TRÒN dồn hết vào `order[0]` — ứng viên có
  //     `config.classPriority` CAO NHẤT trong các ỨNG VIÊN (không phải cao
  //     nhất toàn cục 4 nhóm — CASH có thể bị loại bởi
  //     `cashEligibleForNewCapital`, nhóm có gap ≤ 0 không phải ứng viên).
  //
  //   · allocate.ts:141-151 (SAU LÀM TRÒN — DÙNG CHUNG CHO CẢ HAI CÔNG THỨC):
  //     ⚠️ ĐIỂM WORK ORDER MÔ TẢ KHÁC VỚI CODE, đã tự kiểm và báo lại ở
  //     task-13-report.md: work order gắn nhánh này riêng cho
  //     PROPORTIONAL_GAP, nhưng đọc code thì bước này nằm SAU chỗ chọn công
  //     thức (dòng 137-139) và chạy VÔ ĐIỀU KIỆN trên `rounded` — nên
  //     PRIORITY_WATERFALL cũng đi qua bước này y hệt, có thể CỘNG DỒN với
  //     phần dư của chính splitByPriority trên cùng một ca. Nếu làm tròn
  //     xuống làm mất một phần pool (`residualVnd > 0` sau làm tròn), phần
  //     mất đó dồn vào ứng viên có `gap` GỐC (trước làm tròn) LỚN NHẤT — hoà
  //     thì ứng viên đứng trước trong ASSET_CLASSES thắng (do `reduce` dùng
  //     `>` chứ không `>=`).
  //
  // Vì hai đường có thể cộng dồn trên cùng một ca, một bất đẳng thức đơn giản
  // kiểu "order[0] phải lớn hơn các ứng viên khác" sẽ báo OAN khi phần dư sau
  // làm tròn rơi vào một ứng viên khác order[0]. Model dưới đây tính đủ CẢ
  // HAI bước để tránh báo oan, đồng thời vẫn pin được đích đến TUYỆT ĐỐI.

  // BẢN SAO ĐỘC LẬP của money.ts, viết lại TẠI CHỖ trong test — KHÔNG import
  // hàm thật từ engine (round 2, item 2). Lý do: nếu oracle gọi thẳng
  // `roundDownTo`/`sumVnd` của chính module đang bị kiểm, một lỗi BÊN TRONG
  // hai hàm đó (vd `money.ts:9` đổi `Math.floor` → `Math.round`) sẽ lọt qua
  // MỌI assert giá trị của oracle — cả hai bên cùng sai theo đúng một cách,
  // nên không có gì để so lệch. Round 1 từng mù trước lỗi này (Probe B, xem
  // task-13-findings-round2.md và report mục "Fix round 2"). Hai hàm dưới
  // đây PHẢI giữ ĐÚNG ngữ nghĩa gốc (làm tròn XUỐNG, cộng thẳng) — nếu không
  // thì oracle tự sai theo hướng khác, không phải độc lập đúng nghĩa.
  function testRoundDownTo(value: number, step: number): number {
    if (step <= 0) return value;
    return Math.floor(value / step) * step;
  }
  function testSumVnd(values: number[]): number {
    return values.reduce((sum, v) => sum + v, 0);
  }

  /**
   * Mirror công thức allocate.ts, chỉ cho luồng addsToTotal = true (tiền
   * mới). Nhận `classValues`/`config` trực tiếp (không nhận cả
   * `PortfolioSnapshot`) để dùng lại được cho cả CORPUS thật lẫn các ca dựng
   * tay ở nhánh mở rộng bộ sinh bên dưới.
   */
  function expectedAllocation(
    classValues: Record<AssetClass, number>,
    config: EngineConfig,
    poolVnd: number,
  ): {
    amounts: Record<AssetClass, number>;
    waterfallOrder: AssetClass[] | null;
    waterfallRemaining: number;
    postRoundingResidualVnd: number;
  } {
    const amounts: Record<AssetClass, number> = {
      STOCKS: 0, CRYPTO: 0, GOLD: 0, CASH: 0,
    };
    const total = testSumVnd(ASSET_CLASSES.map((c) => classValues[c]));
    const newTotal = total + poolVnd;
    const gaps = {} as Record<AssetClass, number>;
    for (const c of ASSET_CLASSES) {
      gaps[c] = newTotal * (TARGETS[c].targetPct / 100) - classValues[c];
    }

    let candidates = ASSET_CLASSES.filter((c) => gaps[c] > 0);
    if (!config.cashEligibleForNewCapital) candidates = candidates.filter((c) => c !== 'CASH');

    if (poolVnd === 0 || candidates.length === 0) {
      return {
        amounts, waterfallOrder: null, waterfallRemaining: 0, postRoundingResidualVnd: 0,
      };
    }

    const raw = {} as Record<AssetClass, number>;
    let waterfallOrder: AssetClass[] | null = null;
    let waterfallRemaining = 0;

    if (config.formula === 'PRIORITY_WATERFALL') {
      const order = [...candidates].sort(
        (a, b) => config.classPriority[b] - config.classPriority[a],
      );
      waterfallOrder = order;
      let remaining = poolVnd;
      for (const c of order) {
        const take = Math.min(remaining, gaps[c]);
        raw[c] = take;
        remaining -= take;
        if (remaining <= 0) break;
      }
      waterfallRemaining = remaining;
      if (remaining > 0) raw[order[0]] = (raw[order[0]] ?? 0) + remaining;
    } else {
      const totalGap = testSumVnd(candidates.map((c) => gaps[c]));
      for (const c of candidates) raw[c] = poolVnd * (gaps[c] / totalGap);
    }

    const rounded = {} as Record<AssetClass, number>;
    for (const c of candidates) rounded[c] = testRoundDownTo(raw[c] ?? 0, config.roundingStepVnd);
    const postRoundingResidualVnd = poolVnd - testSumVnd(candidates.map((c) => rounded[c] ?? 0));
    if (postRoundingResidualVnd > 0) {
      const largestGap = candidates.reduce((a, b) => (gaps[b] > gaps[a] ? b : a));
      rounded[largestGap] = (rounded[largestGap] ?? 0) + postRoundingResidualVnd;
    }
    for (const c of candidates) amounts[c] = rounded[c] ?? 0;

    return {
      amounts, waterfallOrder, waterfallRemaining, postRoundingResidualVnd,
    };
  }

  it('mô hình tham chiếu khớp TUYỆT ĐỐI với allocate() ở TỪNG NHÓM — pin đích đến, không chỉ pin tổng', () => {
    let casesChecked = 0;
    let waterfallResidualCases = 0;
    const postRoundingResidualByFormula: Record<AllocationFormula, number> = {
      PROPORTIONAL_GAP: 0, PRIORITY_WATERFALL: 0,
    };

    CORPUS.forEach((s, index) => {
      const pool = s.monthlyContributionVnd;
      const res = allocate({
        classValues: s.classValues, targets: TARGETS, poolVnd: pool,
        addsToTotal: true, config: s.config,
      });
      const model = expectedAllocation(s.classValues, s.config, pool);

      const actualAmounts: Record<AssetClass, number> = {
        STOCKS: 0, CRYPTO: 0, GOLD: 0, CASH: 0,
      };
      for (const a of res.allocations) actualAmounts[a.assetClass] = a.amountVnd;

      for (const c of ASSET_CLASSES) {
        expectInvariant(
          actualAmounts[c] === model.amounts[c],
          () => `Nhóm ${c} nhận ${actualAmounts[c]} đ, mô hình tham chiếu kỳ vọng `
            + `${model.amounts[c]} đ — ĐÍCH ĐẾN phần dư SAI (tổng có thể vẫn đúng). `
            + describeCase(CORPUS_SEED, index, {
              pool, modelAmounts: model.amounts, actualAmounts,
            }),
        );
      }

      if (model.waterfallOrder !== null && model.waterfallRemaining > 0) {
        waterfallResidualCases += 1;
      }
      if (model.postRoundingResidualVnd > 0) {
        postRoundingResidualByFormula[s.config.formula] += 1;
      }
      casesChecked += 1;
    });

    expect(casesChecked, 'không có nhánh bỏ qua nào — phải chạy đủ 1.000 ca').toBe(CASE_COUNT);
    // Ngưỡng đo SAU khi chạy thật (đo được: waterfall=12, PROPORTIONAL_GAP
    // sau làm tròn=423, PRIORITY_WATERFALL sau làm tròn=104), đúng kỷ luật
    // addendum §3 — chi tiết ở task-13-report.md, mục Fix round 1.
    //
    // waterfallResidualCases đo được CHỈ 12/1.000 trên CORPUS thật —
    // monthlyContributionVnd bị bộ sinh chặn tối đa 5tr, quá nhỏ so với gap
    // hàng chục/hàng trăm triệu của danh mục ngẫu nhiên rộng. Đây là nhánh
    // HIẾM THẬT trong vận hành bình thường, không hạ ngưỡng cho nó — giữ một
    // sàn thấp chỉ để phát hiện nhánh CHẾT HẲN (về 0), còn độ bao phủ THẬT của
    // nhánh này chuyển sang bộ sinh MỞ RỘNG riêng ngay dưới đây.
    expect(
      waterfallResidualCases,
      'nhánh dồn phần dư TRƯỚC làm tròn của splitByPriority (allocate.ts:81) đã CHẾT trên CORPUS thật',
    ).toBeGreaterThanOrEqual(5);
    expect(
      postRoundingResidualByFormula.PROPORTIONAL_GAP,
      'phần dư SAU làm tròn của PROPORTIONAL_GAP (allocate.ts:149) gần như không được chạy',
    ).toBeGreaterThanOrEqual(200);
    expect(
      postRoundingResidualByFormula.PRIORITY_WATERFALL,
      'phần dư SAU làm tròn của PRIORITY_WATERFALL (allocate.ts:149) gần như không được chạy',
    ).toBeGreaterThanOrEqual(50);
  });

  it('MỞ RỘNG BỘ SINH cho nhánh hiếm: pool vượt tổng khoảng thiếu của ứng viên, CASH bị loại bởi cấu hình', () => {
    // Lý do cần bộ sinh riêng (đúng kỷ luật addendum §3 — KHÔNG hạ ngưỡng cho
    // nhánh hiếm, MỞ RỘNG bộ sinh): trên CORPUS chính nhánh dồn phần dư TRƯỚC
    // làm tròn của splitByPriority chỉ chạm 12/1.000 ca.
    //
    // Dựng tay theo kiểu suy ngược: chọn TRƯỚC gap mong muốn cho từng nhóm
    // (STOCKS/CRYPTO/GOLD), rồi suy ra classValues từ
    // targetAmt_c = newTotal × targetPct_c / 100 (newTotal luôn là bội số của
    // 20.000.000 để targetAmt của cả bốn nhóm ra SỐ NGUYÊN đúng với target
    // 50/20/15/15% — đã kiểm bằng node, không còn sai số dấu phẩy động).
    // `cashEligibleForNewCapital: false` LOẠI CASH khỏi ứng viên bất kể gap
    // của nó dương hay âm; pool được chọn lớn hơn hẳn tổng gap của các ứng
    // viên còn lại (tối đa 3 × 2.000.000 = 6.000.000) nên phần dư gần như
    // luôn dương — đây CHÍNH LÀ cơ chế thật khiến allocate.ts:81 chạy trong
    // vận hành thực (người dùng tắt "cho phép rót thêm vào Cash").
    const r = createRandom(20260827);
    let checked = 0;
    let residualTriggered = 0;
    // ≥ 2 ứng viên: chỉ ở ca này đột biến order[0] → order[cuối] mới THỰC SỰ
    // đổi kết quả (1 ứng viên thì order[0] === order[cuối], đột biến vô hại).
    let multiCandidateTriggered = 0;
    // Round 2, item 1 — số ca `classPriority` KHÁC mặc định, tức có cơ hội
    // thật sự làm `order` (sau sort) khác thứ tự tự nhiên `[...candidates]`.
    let nonDefaultPriorityCases = 0;

    for (let index = 0; index < 300; index++) {
      const newTotal = r.int(60, 300) * 20_000_000;
      const pool = r.int(5, 60) * 1_000_000;
      const targetAmt: Record<AssetClass, number> = {
        STOCKS: newTotal * 0.5, CRYPTO: newTotal * 0.2, GOLD: newTotal * 0.15, CASH: newTotal * 0.15,
      };
      const desiredGap: Record<'STOCKS' | 'CRYPTO' | 'GOLD', number> = {
        STOCKS: 0, CRYPTO: 0, GOLD: 0,
      };
      let anyCandidate = false;
      for (const c of ['STOCKS', 'CRYPTO', 'GOLD'] as const) {
        if (r.next() < 0.65) {
          desiredGap[c] = r.int(1, 20) * 100_000;   // ứng viên: còn thiếu
          anyCandidate = true;
        } else {
          desiredGap[c] = -r.int(0, 20) * 100_000;  // không phải ứng viên: đã đủ/dư
        }
      }
      if (!anyCandidate) desiredGap.STOCKS = r.int(1, 20) * 100_000; // ép có ít nhất 1 ứng viên

      const total0 = newTotal - pool;
      const classValues: Record<AssetClass, number> = {
        STOCKS: targetAmt.STOCKS - desiredGap.STOCKS,
        CRYPTO: targetAmt.CRYPTO - desiredGap.CRYPTO,
        GOLD: targetAmt.GOLD - desiredGap.GOLD,
        CASH: 0,
      };
      // CASH nhận đúng phần còn lại để tổng bốn nhóm khớp total0 — CASH
      // KHÔNG cần tự nó thiếu, nó bị loại bởi cấu hình bất kể gap dương/âm.
      classValues.CASH = total0 - (classValues.STOCKS + classValues.CRYPTO + classValues.GOLD);

      const classPriority = r.pick(CLASS_PRIORITY_VARIANTS);
      const config: EngineConfig = {
        ...DEFAULT_CONFIG,
        formula: 'PRIORITY_WATERFALL',
        roundingStepVnd: r.pick(ROUNDING_STEPS),
        cashEligibleForNewCapital: false,
        classPriority,
      };

      const res = allocate({
        classValues, targets: TARGETS, poolVnd: pool, addsToTotal: true, config,
      });
      const model = expectedAllocation(classValues, config, pool);

      const actualAmounts: Record<AssetClass, number> = {
        STOCKS: 0, CRYPTO: 0, GOLD: 0, CASH: 0,
      };
      for (const a of res.allocations) actualAmounts[a.assetClass] = a.amountVnd;

      for (const c of ASSET_CLASSES) {
        expectInvariant(
          actualAmounts[c] === model.amounts[c],
          () => `Nhóm ${c} nhận ${actualAmounts[c]} đ, mô hình tham chiếu kỳ vọng `
            + `${model.amounts[c]} đ — ĐÍCH ĐẾN phần dư SAI. `
            + describeCase(20260827, index, {
              classValues, pool, config, modelAmounts: model.amounts, actualAmounts,
            }),
        );
      }

      if (model.waterfallOrder !== null && model.waterfallRemaining > 0) {
        residualTriggered += 1;
        if (model.waterfallOrder.length >= 2) multiCandidateTriggered += 1;
      }
      if (!isDefaultClassPriority(classPriority)) nonDefaultPriorityCases += 1;
      checked += 1;
    }

    expect(checked).toBe(300);
    // Ngưỡng đo SAU khi chạy thật (đo được ở round 1: residualTriggered =
    // 300/300, multiCandidateTriggered = 221/300; sau khi thêm classPriority
    // ở round 2 — xem dưới — RNG bị dịch nên đo lại: 300/300 và 215/300,
    // vẫn cùng bậc, ngưỡng dưới đây vẫn đúng) — chi tiết ở task-13-report.md.
    // residualTriggered gần như luôn đúng theo cách dựng (pool tối đa 6tr so
    // với tổng gap ứng viên, pool tối thiểu 5tr) nhưng KHÔNG tuyệt đối về mặt
    // toán học (biên dưới pool và biên trên tổng gap có thể chạm nhau ở ca
    // xấu nhất) — nên dùng ngưỡng cao (250) thay vì `toBe(300)` cứng.
    expect(
      residualTriggered,
      'bộ sinh mở rộng vẫn không tạo đủ ca chạm nhánh dồn phần dư trước làm tròn',
    ).toBeGreaterThanOrEqual(250);
    expect(
      multiCandidateTriggered,
      'quá ít ca có ≥ 2 ứng viên — đột biến order[0] → order[cuối] sẽ không đổi được kết quả ở đa số ca',
    ).toBeGreaterThanOrEqual(100);
    // Round 2, item 1 — bốn permutation, chọn đều (r.pick) ⇒ 3/4 số ca lẽ ra
    // rơi vào một permutation KHÁC mặc định. Đo được 216/300 (xem
    // task-13-report.md, mục "Fix round 2"). Ngưỡng đặt SAU khi đo, ≈ MỘT
    // NỬA số đo thực tế, làm tròn xuống số tròn — đúng quy ước của báo cáo gốc
    // §4 (số đo cao hơn ngưỡng ít nhất 1,7×: 216/100 ≈ 2,16×).
    expect(
      nonDefaultPriorityCases,
      'classPriority hầu như luôn là mặc định — đột biến bỏ sort ở allocate.ts:69-71 sẽ không bị bắt',
    ).toBeGreaterThanOrEqual(100);
  });
});

describe('BẤT BIẾN: hai nhánh NÉM LỖI của allocate', () => {
  it('pool âm luôn bị từ chối — không bao giờ lặng lẽ quy về 0', () => {
    const r = createRandom(20260824);
    let checked = 0;
    for (let index = 0; index < 200; index++) {
      const s = CORPUS[index];
      const pool = -r.int(1, 500) * 1_000;
      const addsToTotal = r.next() > 0.5;
      expect(
        () => allocate({
          classValues: s.classValues, targets: TARGETS, poolVnd: pool, addsToTotal,
          config: s.config,
        }),
        // `s` lấy từ CORPUS[index] (seed CORPUS_SEED), KHÔNG phải từ seed
        // 20260824 của `r` ở trên — `r` chỉ sinh pool/addsToTotal. In seed
        // 20260824 ở đây là in SAI, chỉ người debug đi tái lập nhầm chỗ.
        describeCase(CORPUS_SEED, index, { pool, addsToTotal, snapshot: s }),
      ).toThrow(/không được âm/);
      checked += 1;
    }
    expect(checked).toBe(200);
  });

  it('luồng cổ tức: ném lỗi KHI VÀ CHỈ KHI pool > Cash; không ném thì bất biến tổng đúng', () => {
    const r = createRandom(20260825);
    let thrown = 0;
    let allocated = 0;
    for (let index = 0; index < CASE_COUNT; index++) {
      const s = randomSnapshot(r);
      const cash = s.classValues.CASH;
      // Một nửa số ca cố tình vượt Cash để chạm nhánh ném, nửa còn lại hợp lệ.
      const pool = r.next() < 0.5
        ? r.int(0, Math.floor(cash / 100_000)) * 100_000
        : cash + r.int(1, 50) * 100_000;
      const call = () => allocate({
        classValues: s.classValues, targets: TARGETS, poolVnd: pool,
        addsToTotal: false, config: s.config,
      });

      if (pool > cash) {
        // Seed 20260825 ở đây ĐÚNG (s = randomSnapshot(r) cùng r seed này),
        // nhưng payload thiếu snapshot đầy đủ — bổ sung để tái lập được.
        expect(call, describeCase(20260825, index, { pool, cash, snapshot: s })).toThrow(/lớn hơn số dư Cash/);
        thrown += 1;
      } else {
        const res = call();
        const sum = res.allocations.reduce((acc, a) => acc + a.amountVnd, 0);
        expectInvariant(
          sum + res.unallocatedVnd === pool,
          () => `Σ phân bổ (${sum}) + chưa phân bổ (${res.unallocatedVnd}) ≠ pool (${pool}). `
            + describeCase(20260825, index, s),
        );
        allocated += 1;
      }
    }
    // Hai nhánh phải cùng đông — lệch hẳn về một bên là bộ sinh hỏng.
    expect(thrown, 'quá ít ca chạm nhánh ném lỗi cổ tức > Cash').toBeGreaterThanOrEqual(200);
    expect(allocated, 'quá ít ca cổ tức hợp lệ chạy tới bất biến tổng').toBeGreaterThanOrEqual(200);
  });
});

describe('BẤT BIẾN SUY TỪ SPEC: danh mục ĐANG Ở ĐÚNG TARGET nhận tiền mới thì GIỮ NGUYÊN target', () => {
  // Round 2, item 3. `allocate.ts:6-16` TUYÊN BỐ tính chất này của
  // PROPORTIONAL_GAP ("danh mục ĐANG ở đúng target thì phân bổ mới giữ
  // NGUYÊN target — vì khi đang ở target, gap_c = targetPct_c × pool với mọi
  // class"), nhưng KHÔNG có test nào trong toàn bộ src/domain assert nó ở
  // dạng property (`allocate.test.ts:187` chỉ kiểm danh mục RỖNG — họ hàng
  // gần, không phải chính tính chất này).
  //
  // KỲ VỌNG được suy TRỰC TIẾP từ targetPct và pool — KHÔNG gọi lại
  // allocate(), KHÔNG dùng oracle mirror `expectedAllocation()` ở describe
  // phía trên. Nếu kỳ vọng bị tính lại bằng cách chạy chính implementation,
  // tính chất này không mua thêm bảo hiểm nào (mirror đã làm việc đó rồi) —
  // đây phải là một phép tính TOÁN HỌC độc lập với code.
  //
  // SUY DIỄN (không chép code):
  //   Danh mục ở ĐÚNG target ⇒ classValues_c = targetPct_c/100 × total0 với
  //   MỌI class c (total0 = tổng danh mục TRƯỚC khi nhận pool).
  //   newTotal = total0 + pool (addsToTotal = true).
  //   gap_c = targetPct_c/100 × newTotal − classValues_c
  //         = targetPct_c/100 × (total0 + pool) − targetPct_c/100 × total0
  //         = targetPct_c/100 × pool.                                   (*)
  //   Σ_c targetPct_c = 100% ⇒ Σ_c gap_c = pool ĐÚNG KHÍT pool (không dư,
  //   không thiếu). Hệ quả: BẤT KỂ chia theo TỶ LỆ gap (PROPORTIONAL_GAP)
  //   hay ĐỔ ĐẦY TUẦN TỰ theo ưu tiên (PRIORITY_WATERFALL, với điều kiện
  //   cashEligibleForNewCapital = true để CASH cũng là ứng viên — nếu CASH
  //   bị loại thì Σ gap các ứng viên còn lại < pool và tính chất này VỠ),
  //   mỗi nhóm đều nhận ĐÚNG gap_c của nó, không nhóm nào bị cắt bớt cho
  //   nhóm khác — vì tổng khít nhau nên KHÔNG có "phần dư" cần dồn ngược
  //   (điều kiện `remaining > 0` ở `splitByPriority` và phần dư sau làm
  //   tròn ở `allocate.ts:147-151` đều không kích hoạt khi không có sai số
  //   làm tròn). Danh mục sau khi cộng amount_c = gap_c vẫn ở đúng
  //   targetPct_c (thay total0 bằng newTotal trong công thức trên là ra
  //   chiều ngược lại).
  //
  // `total0` và `pool` được chọn là BỘI SỐ của 20.000 VND (mẫu số chung nhỏ
  // nhất của 1/2, 1/5, 3/20 — ba phân số ứng với 50%, 20%, 15% — là 20) để
  // (*) luôn ra SỐ NGUYÊN ĐÚNG, loại hẳn sai số dấu phẩy động; kèm
  // `roundingStepVnd: 1` để loại nốt nhiễu làm tròn bội số.
  const SEED = 20260828; // Seed MỚI — không trùng 20260822–20260827 đã dùng.
  const AT_TARGET_CASE_COUNT = 400;

  it('mỗi nhóm nhận ĐÚNG targetPct_c × pool, và tỷ trọng sau phân bổ vẫn ĐÚNG target', () => {
    const r = createRandom(SEED);
    let checked = 0;
    let proportionalGapChecked = 0;
    let priorityWaterfallChecked = 0;

    for (let index = 0; index < AT_TARGET_CASE_COUNT; index++) {
      const total0 = r.int(50, 5_000) * 20_000;
      const pool = r.int(1, 1_000) * 20_000;
      const formula = r.pick(FORMULAS);

      const classValues = {} as Record<AssetClass, number>;
      for (const c of ASSET_CLASSES) {
        classValues[c] = (total0 * TARGETS[c].targetPct) / 100;
      }
      const config: EngineConfig = {
        ...DEFAULT_CONFIG,
        formula,
        roundingStepVnd: 1,
        // BẮT BUỘC true — xem suy diễn ở trên: CASH phải là ứng viên để
        // Σ gap các ứng viên khít đúng pool.
        cashEligibleForNewCapital: true,
      };

      const res = allocate({
        classValues, targets: TARGETS, poolVnd: pool, addsToTotal: true, config,
      });
      const actualAmounts: Record<AssetClass, number> = {
        STOCKS: 0, CRYPTO: 0, GOLD: 0, CASH: 0,
      };
      for (const a of res.allocations) actualAmounts[a.assetClass] = a.amountVnd;
      const newTotal = total0 + pool;

      for (const c of ASSET_CLASSES) {
        // Kỳ vọng suy TRỰC TIẾP từ (*) — không gọi allocate(), không qua oracle.
        const expectedAmount = (pool * TARGETS[c].targetPct) / 100;
        expectInvariant(
          actualAmounts[c] === expectedAmount,
          () => `Nhóm ${c} nhận ${actualAmounts[c]} đ, SPEC suy ra phải nhận ĐÚNG `
            + `${expectedAmount} đ (= targetPct ${TARGETS[c].targetPct}% × pool ${pool}). `
            + describeCase(SEED, index, {
              formula, total0, pool, classValues, actualAmounts,
            }),
        );
        // Tỷ trọng sau phân bổ vẫn đúng target — so bằng NHÂN CHÉO số
        // nguyên, không chia dấu phẩy động:
        //   (classValues_c + amount_c) / newTotal === targetPct_c / 100
        //   ⇔ (classValues_c + amount_c) × 100 === targetPct_c × newTotal
        const newValue = classValues[c] + actualAmounts[c];
        expectInvariant(
          newValue * 100 === TARGETS[c].targetPct * newTotal,
          () => `Tỷ trọng ${c} sau phân bổ lệch target: (${classValues[c]}+${actualAmounts[c]})×100 `
            + `= ${newValue * 100}, kỳ vọng targetPct×newTotal = `
            + `${TARGETS[c].targetPct * newTotal}. `
            + describeCase(SEED, index, {
              formula, total0, pool, classValues, actualAmounts,
            }),
        );
      }
      expectInvariant(
        res.unallocatedVnd === 0,
        () => `Danh mục đúng target nhận thêm tiền mà vẫn còn ${res.unallocatedVnd} đ chưa `
          + `phân bổ — SPEC suy ra phải phân bổ HẾT vì Σ gap = pool khít tuyệt đối. `
          + describeCase(SEED, index, { formula, total0, pool }),
      );

      if (formula === 'PROPORTIONAL_GAP') proportionalGapChecked += 1;
      else priorityWaterfallChecked += 1;
      checked += 1;
    }

    expect(checked, 'không có nhánh bỏ qua nào — phải chạy đủ 400 ca').toBe(AT_TARGET_CASE_COUNT);
    // Hai công thức đều phải có đủ ca — mutation của splitProportionalToGap
    // (nghiệm thu round 2, item 3) chỉ chạm nhánh PROPORTIONAL_GAP, nên
    // nhánh đó phải đủ đông để chắc chắn bắt được. Đo được (r.pick đều trên
    // 2 công thức, 400 ca): PROPORTIONAL_GAP = 218, PRIORITY_WATERFALL =
    // 182. Ngưỡng đặt SAU khi đo, ở khoảng nửa số đo THẤP HƠN (182), làm
    // tròn xuống số tròn — margin cả hai đều > 1,7× (218/100 ≈ 2,18×,
    // 182/100 ≈ 1,82×).
    expect(proportionalGapChecked, 'quá ít ca PROPORTIONAL_GAP để đột biến splitProportionalToGap có cơ hội bị bắt')
      .toBeGreaterThanOrEqual(100);
    expect(priorityWaterfallChecked, 'quá ít ca PRIORITY_WATERFALL').toBeGreaterThanOrEqual(100);
  });
});

describe('BẤT BIẾN của buildActionPlan trên 1.000 ca ngẫu nhiên', () => {
  it('không bao giờ ném lỗi', () => {
    let checked = 0;
    CORPUS.forEach((s, index) => {
      expect(
        () => buildActionPlan(s),
        describeCase(CORPUS_SEED, index, s),
      ).not.toThrow();
      checked += 1;
    });
    expect(checked).toBe(CASE_COUNT);
  });

  it('không bao giờ có NaN trong tỷ trọng hay số tiền', () => {
    let numbersChecked = 0;
    const check = (value: number, label: string, index: number): void => {
      expectInvariant(
        Number.isFinite(value),
        () => `${label} = ${value} (không hữu hạn). ${describeCase(CORPUS_SEED, index, CORPUS[index])}`,
      );
      numbersChecked += 1;
    };

    plans().forEach((p, index) => {
      for (const w of p.weights) {
        check(w.weightPct, `weights.${w.assetClass}.weightPct`, index);
        check(w.deviationPp, `weights.${w.assetClass}.deviationPp`, index);
        check(w.differenceVnd, `weights.${w.assetClass}.differenceVnd`, index);
        check(w.targetValueVnd, `weights.${w.assetClass}.targetValueVnd`, index);
      }
      for (const b of p.buys) check(b.amountVnd, `buys.${b.assetClass}.amountVnd`, index);
      check(p.unallocatedVnd, 'unallocatedVnd', index);
      check(p.totalVnd, 'totalVnd', index);
      if (p.sellPlan) {
        for (const sell of p.sellPlan.sells) check(sell.sellVnd, `sellPlan.sells.${sell.assetClass}`, index);
        for (const d of p.sellPlan.destinations) check(d.amountVnd, `sellPlan.destinations.${d.assetClass}`, index);
        check(p.sellPlan.unallocatedVnd, 'sellPlan.unallocatedVnd', index);
      }
      if (p.crash) check(p.crash.totalDeployVnd, 'crash.totalDeployVnd', index);
    });
    expect(numbersChecked, 'quá ít con số được kiểm NaN').toBeGreaterThanOrEqual(5_000);
  });

  it('tổng mua + chưa phân bổ === pool ở MỌI trạng thái, kể cả khi bị chặn', () => {
    // Không `continue` theo status: từ Task 12, mọi nhánh chặn cũng đặt
    // `unallocatedVnd = sources.poolVnd` nên bất biến đúng ở cả bốn trạng thái.
    // Tiền bị chặn vẫn là tiền CÓ THẬT, nó chỉ chưa đi đâu cả.
    const perStatus: Record<PlanStatus, number> = {
      READY: 0, EMPTY_PORTFOLIO: 0, MISSING_PRICES: 0, EARMARK_EXCEEDS_CASH: 0,
    };
    plans().forEach((p, index) => {
      const sum = p.buys.reduce((acc, b) => acc + b.amountVnd, 0);
      expectInvariant(
        sum + p.unallocatedVnd === p.sources.poolVnd,
        () => `[${p.status}] Σ mua (${sum}) + chưa phân bổ (${p.unallocatedVnd}) `
          + `≠ pool (${p.sources.poolVnd}). ${describeCase(CORPUS_SEED, index, CORPUS[index])}`,
      );
      perStatus[p.status] += 1;
    });
    expect(perStatus.READY, 'thiếu ca READY').toBeGreaterThanOrEqual(600);
    expect(perStatus.MISSING_PRICES, 'thiếu ca MISSING_PRICES').toBeGreaterThanOrEqual(15);
    expect(perStatus.EMPTY_PORTFOLIO, 'thiếu ca EMPTY_PORTFOLIO').toBeGreaterThanOrEqual(15);
    expect(perStatus.EARMARK_EXCEEDS_CASH, 'thiếu ca EARMARK_EXCEEDS_CASH').toBeGreaterThanOrEqual(10);
  });

  it('mọi nhánh chặn đều KHÔNG sinh lệnh mua và KHÔNG sinh lệnh bán', () => {
    let checked = 0;
    plans().forEach((p, index) => {
      if (p.status === 'READY') return;
      expectInvariant(
        p.buys.length === 0 && p.sellPlan === null && p.crash === null
          && p.blockedReason !== null && p.blockedReason.length > 0,
        () => `Ca bị chặn (${p.status}) vẫn sinh hành động: `
          + `${p.buys.length} lệnh mua, sellPlan=${p.sellPlan !== null}, `
          + `crash=${p.crash !== null}, lý do=${p.blockedReason}. `
          + describeCase(CORPUS_SEED, index, CORPUS[index]),
      );
      checked += 1;
    });
    expect(checked, 'quá ít ca bị chặn để kiểm').toBeGreaterThanOrEqual(50);
  });

  it('tổng tỷ trọng === 100% mỗi khi danh mục khác rỗng', () => {
    let checked = 0;
    plans().forEach((p, index) => {
      if (p.totalVnd === 0) return;
      const sum = p.weights.reduce((acc, w) => acc + w.weightPct, 0);
      expectInvariant(
        Math.abs(sum - 100) < 1e-6,
        () => `Tổng tỷ trọng = ${sum}%, phải là 100%. `
          + describeCase(CORPUS_SEED, index, CORPUS[index]),
      );
      checked += 1;
    });
    expect(checked, 'quá ít ca danh mục khác rỗng').toBeGreaterThanOrEqual(600);
  });

  it('lệnh mua là bội số bước làm tròn (trừ tối đa 1 khoản) và phân hoạch với doNotBuy', () => {
    let checked = 0;
    plans().forEach((p, index) => {
      if (p.status !== 'READY') return;
      const s = CORPUS[index];
      const offStep = p.buys.filter((b) => b.amountVnd % s.config.roundingStepVnd !== 0);
      expectInvariant(
        offStep.length <= 1,
        () => `${offStep.length} lệnh mua lệch bội số ${s.config.roundingStepVnd}. `
          + describeCase(CORPUS_SEED, index, s),
      );
      // buys và doNotBuy phải chia đôi trọn vẹn bốn nhóm — không nhóm nào bị bỏ quên.
      const buyClasses = new Set(p.buys.map((b) => b.assetClass));
      const skipClasses = new Set(p.doNotBuy.map((d) => d.assetClass));
      expectInvariant(
        buyClasses.size + skipClasses.size === ASSET_CLASSES.length
          && ASSET_CLASSES.every((c) => buyClasses.has(c) !== skipClasses.has(c)),
        () => `buys (${[...buyClasses]}) và doNotBuy (${[...skipClasses]}) không phân hoạch `
          + `bốn nhóm. ${describeCase(CORPUS_SEED, index, s)}`,
      );
      checked += 1;
    });
    expect(checked, 'quá ít ca READY').toBeGreaterThanOrEqual(600);
  });

  it('KHÔNG BÁN BỪA: sellPlan tồn tại khi và chỉ khi có nhóm REBALANCE_REQUIRED', () => {
    let withoutSellSignal = 0;
    let withSellSignal = 0;
    plans().forEach((p, index) => {
      // Ca bị chặn luôn có sellPlan = null bất kể trạng thái band, nên kiểm ở đó
      // là tầm thường — chỉ đếm ca READY.
      if (p.status !== 'READY') return;
      const mustRebalance = ASSET_CLASSES.some((c) => p.statuses[c] === 'REBALANCE_REQUIRED');
      expectInvariant(
        mustRebalance === (p.sellPlan !== null),
        () => `Có nhóm REBALANCE_REQUIRED = ${mustRebalance} nhưng sellPlan `
          + `${p.sellPlan === null ? 'null' : 'khác null'}. `
          + describeCase(CORPUS_SEED, index, CORPUS[index]),
      );
      if (mustRebalance) withSellSignal += 1;
      else withoutSellSignal += 1;
    });
    // Vế "không có tín hiệu bán ⇒ không có sellPlan" là khoá an toàn quan trọng
    // nhất của §18. Nó chỉ có nghĩa nếu bộ sinh tạo đủ danh mục CÂN BẰNG.
    expect(withoutSellSignal, 'quá ít ca danh mục cân bằng — khoá "không bán bừa" gần như không được kiểm')
      .toBeGreaterThanOrEqual(100);
    expect(withSellSignal, 'quá ít ca phải cân lại danh mục').toBeGreaterThanOrEqual(300);
  });

  it('mọi lệnh bán đều là nhóm ĐANG THỪA và ở trạng thái REBALANCE_REQUIRED', () => {
    let ordersChecked = 0;
    plans().forEach((p, index) => {
      if (!p.sellPlan) return;
      const s = CORPUS[index];
      for (const sell of p.sellPlan.sells) {
        const w = p.weights.find((x) => x.assetClass === sell.assetClass);
        expectInvariant(
          p.statuses[sell.assetClass] === 'REBALANCE_REQUIRED'
            && w !== undefined && w.deviationPp > 0
            && sell.sellVnd > 0 && sell.sellVnd >= s.config.minSellAmountVnd,
          () => `Lệnh bán ${sell.assetClass} ${sell.sellVnd} đ không hợp lệ: `
            + `trạng thái=${p.statuses[sell.assetClass]}, lệch=${w?.deviationPp}, `
            + `mức bán tối thiểu=${s.config.minSellAmountVnd}. `
            + describeCase(CORPUS_SEED, index, s),
        );
        ordersChecked += 1;
      }
    });
    expect(ordersChecked, 'quá ít lệnh bán được kiểm').toBeGreaterThanOrEqual(200);
  });

  it('BẤT BIẾN của lệnh bán: tổng tiền vào + chưa phân bổ === tổng tiền bán', () => {
    let checked = 0;
    plans().forEach((p, index) => {
      if (!p.sellPlan) return;
      const sold = p.sellPlan.sells.reduce((acc, x) => acc + x.sellVnd, 0);
      const into = p.sellPlan.destinations.reduce((acc, x) => acc + x.amountVnd, 0);
      expectInvariant(
        into + p.sellPlan.unallocatedVnd === sold,
        () => `Tiền vào (${into}) + chưa phân bổ (${p.sellPlan?.unallocatedVnd}) `
          + `≠ tiền bán (${sold}). ${describeCase(CORPUS_SEED, index, CORPUS[index])}`,
      );
      checked += 1;
    });
    expect(checked, 'quá ít ca có kế hoạch bán').toBeGreaterThanOrEqual(200);
  });

  it('Crash Reserve không bao giờ đề xuất giải ngân quá số tiền đang có', () => {
    let checked = 0;
    let withDeploy = 0;
    let cappedCases = 0;
    plans().forEach((p, index) => {
      if (!p.crash) return;
      const s = CORPUS[index];
      const crash = p.crash;
      expectInvariant(
        crash.totalDeployVnd >= 0 && crash.totalDeployVnd <= s.cashReserveVnd,
        () => `Đề xuất giải ngân ${crash.totalDeployVnd} đ trong khi reserve chỉ có `
          + `${s.cashReserveVnd} đ. ${describeCase(CORPUS_SEED, index, s)}`,
      );
      if (crash.totalDeployVnd > 0) withDeploy += 1;
      // Trần `min(requested, remaining)` chỉ THẬT SỰ chặn khi số dư lúc đợt bắt
      // đầu lớn hơn số dư còn lại. Đếm riêng, nếu không thì bỏ trần đi test vẫn xanh.
      const capped = crash.triggeredLevels.some((tl) => {
        const level = s.crashLevels.find((l) => l.level === tl.level);
        if (level === undefined) return false;
        return tl.deployVnd < crash.reserveAtEpisodeStartVnd * (level.deployPctOfReserve / 100) - 1e-6;
      });
      if (capped) cappedCases += 1;
      checked += 1;
    });
    expect(checked, 'quá ít ca có đánh giá Crash Reserve').toBeGreaterThanOrEqual(600);
    // Nếu không ca nào giải ngân > 0 thì bất biến trên chỉ đang kiểm "0 ≤ reserve".
    expect(withDeploy, 'không đủ ca thật sự đề xuất giải ngân').toBeGreaterThanOrEqual(300);
    expect(cappedCases, 'trần giải ngân không bao giờ phải chặn — bất biến trên đang rỗng nghĩa')
      .toBeGreaterThanOrEqual(50);
  });

  it('Crash Reserve: không dùng lại bậc đã dùng trong ĐỢT NÀY, và chỉ dùng bậc đã tới ngưỡng', () => {
    let levelsChecked = 0;
    let casesWithHistory = 0;
    plans().forEach((p, index) => {
      if (!p.crash) return;
      const s = CORPUS[index];
      const crash = p.crash;
      // Chỉ sự kiện của ĐÚNG đợt này mới được tính — sự kiện đợt khác phải bị loại.
      const thisEpisode = s.crashHistory.filter((h) => h.episodeStart === s.currentEpisodeStart);
      const usedLevels = new Set(thisEpisode.map((h) => h.level));
      const expectedBase = thisEpisode.length > 0
        ? thisEpisode[0].reserveAtEpisodeStartVnd
        : s.cashReserveVnd;

      expectInvariant(
        crash.reserveAtEpisodeStartVnd === expectedBase && crash.episodeStart === s.currentEpisodeStart,
        () => `Mốc tính % sai: nhận ${crash.reserveAtEpisodeStartVnd}, cần ${expectedBase}. `
          + describeCase(CORPUS_SEED, index, s),
      );
      for (const tl of crash.triggeredLevels) {
        expectInvariant(
          !usedLevels.has(tl.level) && tl.drawdownPct <= s.portfolioDrawdownPct && tl.deployVnd >= 0,
          () => `Bậc ${tl.level} không được phép kích hoạt: đã dùng=${usedLevels.has(tl.level)}, `
            + `ngưỡng ${tl.drawdownPct}% / sụt thực ${s.portfolioDrawdownPct}%. `
            + describeCase(CORPUS_SEED, index, s),
        );
        levelsChecked += 1;
      }
      expectInvariant(
        crash.nextLevel === null || crash.nextLevel.gapPp > 0,
        () => `Bậc kế tiếp phải còn CÁCH mới tới: ${JSON.stringify(crash.nextLevel)}. `
          + describeCase(CORPUS_SEED, index, s),
      );
      if (thisEpisode.length > 0) casesWithHistory += 1;
    });
    expect(levelsChecked, 'quá ít bậc Crash Reserve được kiểm').toBeGreaterThanOrEqual(300);
    expect(casesWithHistory, 'quá ít ca đã có lịch sử dùng bậc trong đợt này')
      .toBeGreaterThanOrEqual(150);
  });

  it('gợi ý mã: mua nổi thì trong ngân sách, chưa nổi thì thiếu đúng phần chênh', () => {
    let affordableChecked = 0;
    let shortfallChecked = 0;
    plans().forEach((p, index) => {
      if (p.status !== 'READY') return;
      const s = CORPUS[index];
      const budget = (p.buys.find((b) => b.assetClass === 'STOCKS')?.amountVnd ?? 0)
        + s.earmarkedPots.STOCKS;

      for (const c of p.tickerCandidates.affordable) {
        expectInvariant(
          c.lotCostVnd <= budget && c.lotCostVnd === c.priceVnd * (
            s.watchlist.find((w) => w.symbol === c.symbol)?.lotSize ?? -1
          ) && c.belowThresholdPct >= 0,
          () => `Ứng viên ${c.symbol} sai: lô ${c.lotCostVnd} đ / ngân sách ${budget} đ, `
            + `rẻ hơn ngưỡng ${c.belowThresholdPct}%. ${describeCase(CORPUS_SEED, index, s)}`,
        );
        affordableChecked += 1;
      }
      for (const sf of p.tickerCandidates.shortfalls) {
        expectInvariant(
          sf.shortfallVnd === sf.lotCostVnd - budget && sf.shortfallVnd > 0
            && (s.monthlyContributionVnd > 0
              ? sf.monthsToAfford !== null && sf.monthsToAfford >= 1
              : sf.monthsToAfford === null),
          () => `Ghi chú thiếu tiền ${sf.symbol} sai: thiếu ${sf.shortfallVnd} đ, `
            + `lô ${sf.lotCostVnd} đ, ngân sách ${budget} đ, `
            + `số tháng ${sf.monthsToAfford}. ${describeCase(CORPUS_SEED, index, s)}`,
        );
        shortfallChecked += 1;
      }
    });
    expect(affordableChecked, 'quá ít ứng viên mua nổi được kiểm').toBeGreaterThanOrEqual(100);
    expect(shortfallChecked, 'quá ít ghi chú thiếu tiền được kiểm').toBeGreaterThanOrEqual(20);
  });
});

describe('BẤT BIẾN của computeDrawdown trên chuỗi giá ngẫu nhiên', () => {
  it('sụt sâu nhất ≥ sụt hiện tại ≥ 0 và mức hồi phục nằm trong [0, 100]', () => {
    const r = createRandom(20260826);
    let checked = 0;
    let withDrawdown = 0;
    for (let index = 0; index < 500; index++) {
      const count = r.int(1, 24);
      const series: { date: string; value: number }[] = [];
      for (let k = 0; k < count; k++) {
        // Ngày cố định trong tháng 01/2026 — không dựng Date, không Date.now().
        series.push({
          date: `2026-01-${String(k + 1).padStart(2, '0')}`,
          value: r.int(0, 2_000) * 1_000,
        });
      }
      const d = computeDrawdown(series);
      expectInvariant(
        d !== null,
        () => `Chuỗi khác rỗng mà trả null. ${describeCase(20260826, index, series)}`,
      );
      if (d === null) continue;
      expectInvariant(
        d.currentPct >= 0 && d.maxPct >= d.currentPct - 1e-9 && d.maxPct <= 100 + 1e-9
          && d.recoveryPct >= -1e-9 && d.recoveryPct <= 100 + 1e-9
          && d.daysSinceHigh >= 0 && d.trough.value <= d.ath.value
          && [d.currentPct, d.maxPct, d.recoveryPct, d.daysSinceHigh].every(Number.isFinite),
        () => `Thống kê sụt giảm sai: ${JSON.stringify(d)}. `
          + describeCase(20260826, index, series),
      );
      if (d.currentPct > 0) withDrawdown += 1;
      checked += 1;
    }
    expect(checked).toBe(500);
    expect(withDrawdown, 'không đủ chuỗi thật sự đang sụt giảm').toBeGreaterThanOrEqual(200);
  });
});

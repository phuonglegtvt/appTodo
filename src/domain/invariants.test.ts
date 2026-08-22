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
  ActionPlan, AllocationFormula, AssetClass, CrashEventRecord, PlanStatus,
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
        describeCase(20260824, index, { pool, addsToTotal }),
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
        expect(call, describeCase(20260825, index, { pool, cash })).toThrow(/lớn hơn số dư Cash/);
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

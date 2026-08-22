// Test cho §18 §19 §20 — bộ điều phối.
//
// MỌI SỐ KỲ VỌNG Ở ĐÂY ĐƯỢC DẪN LẠI BẰNG TAY TỪ CODE HIỆN TẠI của allocate.ts
// (semantics mới: pool LUÔN nằm ngoài baseline tính gap). Số cũ trong brief
// Task 12 soạn trước khi Task 7 đổi baseline nên đã lệch — xem comment từng ca.

import { describe, it, expect } from 'vitest';
import { buildActionPlan, toEarmarkedValues } from './actionPlan';
import { DEFAULT_CRASH_LEVELS } from './crashReserve';
import { DEFAULT_CONFIG } from './types';
import type { AssetClass, PortfolioSnapshot, TargetBand, WatchlistItem } from './types';

const TARGETS: Record<AssetClass, TargetBand> = {
  STOCKS: { targetPct: 50, minPct: 40, maxPct: 55 },
  CRYPTO: { targetPct: 20, minPct: 15, maxPct: 25 },
  GOLD:   { targetPct: 15, minPct: 10, maxPct: 20 },
  CASH:   { targetPct: 15, minPct: 7,  maxPct: 20 },
};

const WATCHLIST: WatchlistItem[] = [
  { symbol: 'HND', name: 'HND', group: 'defense',
    currentPriceVnd: 13_000, thresholdVnd: 13_300, lotSize: 100 },
  { symbol: 'FPT', name: 'FPT', group: 'balance',
    currentPriceVnd: 98_000, thresholdVnd: 100_000, lotSize: 100 },
];

function snapshot(over: Partial<PortfolioSnapshot> = {}): PortfolioSnapshot {
  return {
    asOf: '2026-09-01',
    // Bộ số §21. Túi DCA đang rỗng nên classValues = giá trị earmarked.
    classValues: { STOCKS: 513_300_000, CRYPTO: 269_700_000,
                   GOLD: 179_437_500, CASH: 125_062_500 },
    earmarkedPots: { STOCKS: 0, CRYPTO: 0, GOLD: 0, CASH: 0 },
    cashReserveVnd: 125_062_500,
    targets: TARGETS,
    monthlyContributionVnd: 3_000_000,
    incomeReceivedVnd: 0,
    drawdowns: { STOCKS: 3.2, CRYPTO: 8.1, GOLD: 1.0, CASH: 0 },
    portfolioDrawdownPct: 3.2,
    crashLevels: DEFAULT_CRASH_LEVELS,
    crashHistory: [],
    currentEpisodeStart: '2026-06-01',
    missingPriceSymbols: [],
    contributionRecordedThisPeriod: true,
    watchlist: WATCHLIST,
    config: DEFAULT_CONFIG,
    ...over,
  };
}

const buyAmounts = (p: { buys: { assetClass: AssetClass; amountVnd: number }[] }) =>
  Object.fromEntries(p.buys.map((b) => [b.assetClass, b.amountVnd]));

/** Tổng số tiền được phân bổ mua trong kế hoạch. */
const tongMua = (p: { buys: { amountVnd: number }[] }) =>
  p.buys.reduce((sum, b) => sum + b.amountVnd, 0);

/** Định dạng tiền y hệt `formatVnd` của actionPlan.ts, để assert không phụ thuộc ICU. */
const tien = (value: number) => value.toLocaleString('vi-VN');

describe('buildActionPlan — ví dụ §21 đầu tới cuối', () => {
  const p = buildActionPlan(snapshot());

  it('tạo được kế hoạch', () => {
    // 513.300.000 + 269.700.000 + 179.437.500 + 125.062.500 = 1.087.500.000
    expect(p.status).toBe('READY');
    expect(p.blockedReason).toBeNull();
    expect(p.totalVnd).toBe(1_087_500_000);
  });

  it('MUA Stocks 1.300.000 và GIỮ Cash 1.700.000', () => {
    // valuesWithZ.CASH = 125.062.500 + 3.000.000 = 128.062.500
    // newTotal = 1.090.500.000 · preValues.CASH = 128.062.500 − 3.000.000 = 125.062.500
    // gap: Stocks 545.250.000 − 513.300.000 = +31.950.000   ← ứng viên
    //      Crypto 218.100.000 − 269.700.000 = −51.600.000   ← loại
    //      Gold   163.575.000 − 179.437.500 = −15.862.500   ← loại
    //      Cash   163.575.000 − 125.062.500 = +38.512.500   ← ứng viên
    // Σ gap(+) = 70.462.500
    // Stocks = 3tr × 31.950.000/70.462.500 = 1.360.298,03 → xuống 1.300.000
    // Cash   = 3tr × 38.512.500/70.462.500 = 1.639.701,97 → xuống 1.600.000
    // dư 100.000 → dồn vào gap lớn nhất (Cash) ⇒ Cash 1.700.000
    // (Brief ghi 1.400.000/1.600.000 — số CŨ, trước khi Task 7 sửa baseline.)
    expect(buyAmounts(p)).toEqual({ STOCKS: 1_300_000, CASH: 1_700_000 });
  });

  it('KHÔNG MUA Crypto và Gold, kèm lý do tiếng Việt', () => {
    expect(p.doNotBuy.map((d) => d.assetClass).sort()).toEqual(['CRYPTO', 'GOLD']);
    for (const d of p.doNotBuy) expect(d.reason.length).toBeGreaterThan(0);
  });

  it('trạng thái band khớp §21: Crypto và Cash cảnh báo, Stocks và Gold ổn', () => {
    // Stocks 47,2% (−2,8đ%) · Crypto 24,8% (+4,8đ%)
    // Gold   16,5% (+1,5đ%) · Cash   11,5% (−3,5đ%)
    expect(p.statuses).toEqual({
      STOCKS: 'OK', CRYPTO: 'WATCH', GOLD: 'OK', CASH: 'WATCH',
    });
  });

  it('CHƯA CẦN BÁN — không class nào REBALANCE_REQUIRED', () => {
    expect(p.sellPlan).toBeNull();
  });

  it('gợi ý mã: chỉ HND mua nổi với 1,3tr; FPT vào danh sách còn thiếu', () => {
    // ngân sách = phân bổ Stocks 1.300.000 + túi DCA Stocks 0 = 1.300.000
    // HND: 13.000 × 100 = 1.300.000 ≤ 1.300.000 ⇒ mua nổi (đúng sát mép)
    // FPT: 98.000 × 100 = 9.800.000 ⇒ còn thiếu 9.800.000 − 1.300.000 = 8.500.000
    // (Brief ghi 8.400.000 — dẫn từ ngân sách cũ 1.400.000.)
    expect(p.tickerCandidates.affordable.map((c) => c.symbol)).toEqual(['HND']);
    expect(p.tickerCandidates.shortfalls.map((s) => s.symbol)).toEqual(['FPT']);
    expect(p.tickerCandidates.shortfalls[0].shortfallVnd).toBe(8_500_000);
  });

  it('Crash Reserve chưa kích hoạt, báo còn cách bậc 1 bao nhiêu', () => {
    // sụt 3,2% < ngưỡng bậc 1 là 15% ⇒ gap = 15 − 3,2 = 11,8đ%
    expect(p.crash!.triggeredLevels).toEqual([]);
    expect(p.crash!.nextLevel!.level).toBe(1);
    expect(p.crash!.nextLevel!.gapPp).toBeCloseTo(11.8, 6);
  });

  it('có alert BAND_WATCH cho Crypto (đúng REBALANCE WARNING của §21)', () => {
    // Final review Việc 2 (Important I-5): nhận diện qua assetClass, không còn
    // phải parse chuỗi tiếng Việt trong message — UI đợt sau gắn thẳng alert
    // vào đúng dòng bảng bằng trường này.
    const a = p.alerts.find(
      (x) => x.code === 'BAND_WATCH' && x.assetClass === 'CRYPTO',
    );
    expect(a).toBeDefined();
    expect(a!.severity).toBe('INFO');
  });

  it('BẤT BIẾN: tổng mua + chưa phân bổ === Z + cổ tức', () => {
    const total = p.buys.reduce((s, b) => s + b.amountVnd, 0);
    expect(total + p.unallocatedVnd).toBe(3_000_000);
    expect(p.sources.poolVnd).toBe(3_000_000);
  });
});

describe('toEarmarkedValues', () => {
  it('dồn túi DCA về đúng class, Cash giảm tương ứng, TỔNG KHÔNG ĐỔI', () => {
    const values: Record<AssetClass, number> = {
      STOCKS: 250_000_000, CRYPTO: 60_000_000, GOLD: 75_000_000, CASH: 615_000_000,
    };
    const pots: Record<AssetClass, number> = {
      STOCKS: 250_000_000, CRYPTO: 140_000_000, GOLD: 75_000_000, CASH: 0,
    };
    const earmarked = toEarmarkedValues(values, pots);
    expect(earmarked).toEqual({
      STOCKS: 500_000_000, CRYPTO: 200_000_000, GOLD: 150_000_000, CASH: 150_000_000,
    });
    const totalBefore = Object.values(values).reduce((s, v) => s + v, 0);
    const totalAfter = Object.values(earmarked).reduce((s, v) => s + v, 0);
    expect(totalAfter).toBe(totalBefore);
  });
});

describe('buildActionPlan — cổng chặn (không tính trên dữ liệu thiếu)', () => {
  it('thiếu giá tài sản đang giữ → TỪ CHỐI tạo kế hoạch, nêu rõ mã nào', () => {
    const p = buildActionPlan(snapshot({ missingPriceSymbols: ['SJC-1L', 'VEA'] }));
    expect(p.status).toBe('MISSING_PRICES');
    expect(p.blockedReason).toContain('SJC-1L');
    expect(p.blockedReason).toContain('VEA');
    expect(p.buys).toEqual([]);
    expect(p.sellPlan).toBeNull();
    // BẤT BIẾN TIỀN: pool có thật 3.000.000 đ, chưa đi đâu cả ⇒ nằm nguyên ở
    // unallocatedVnd. Trả 0 là làm tiền biến mất (cùng lỗi với Task 7 Finding 2).
    expect(p.sources.poolVnd).toBe(3_000_000);
    expect(p.unallocatedVnd).toBe(3_000_000);
    expect(tongMua(p) + p.unallocatedVnd).toBe(p.sources.poolVnd);
  });

  it('danh mục rỗng → EMPTY_PORTFOLIO, không ra NaN', () => {
    const p = buildActionPlan(snapshot({
      classValues: { STOCKS: 0, CRYPTO: 0, GOLD: 0, CASH: 0 },
      cashReserveVnd: 0,
    }));
    expect(p.status).toBe('EMPTY_PORTFOLIO');
    expect(p.blockedReason).not.toBeNull();
    for (const w of p.weights) expect(Number.isNaN(w.weightPct)).toBe(false);
    // BẤT BIẾN TIỀN: danh mục rỗng nhưng 3.000.000 đ tiền vào tháng này là có thật.
    expect(p.unallocatedVnd).toBe(3_000_000);
    expect(tongMua(p) + p.unallocatedVnd).toBe(p.sources.poolVnd);
  });
});

describe('buildActionPlan — cổng chặn EARMARK_EXCEEDS_CASH (túi DCA mâu thuẫn với Cash)', () => {
  it('tổng túi DCA lớn hơn số dư tiền mặt → chặn, KHÔNG để Cash âm chảy xuống dưới', () => {
    // classValues.CASH = 150.000.000; túi DCA Stocks 100.000.000 + Crypto 60.000.000
    // = 160.000.000 > 150.000.000 ⇒ toEarmarkedValues cho CASH = −10.000.000.
    // Trước khi có cổng chặn: valuesWithZ.CASH = −10.000.000 + 3.000.000 = −7.000.000,
    // pool = 3.000.000 > −7.000.000 ⇒ allocate NÉM LỖI với message vô nghĩa
    // ("Cổ tức 3000000 VND lớn hơn số dư Cash -7000000 VND") — không nêu túi nào gây ra.
    const p = buildActionPlan(snapshot({
      classValues: { STOCKS: 500_000_000, CRYPTO: 200_000_000,
                     GOLD: 150_000_000, CASH: 150_000_000 },
      cashReserveVnd: 150_000_000,
      earmarkedPots: { STOCKS: 100_000_000, CRYPTO: 60_000_000, GOLD: 0, CASH: 0 },
    }));
    expect(p.status).toBe('EARMARK_EXCEEDS_CASH');
    // Lý do phải nêu ĐÍCH DANH từng túi DCA và số tiền, không chỉ nói "Cash thiếu".
    expect(p.blockedReason).toContain('VND-DCA-STOCKS');
    expect(p.blockedReason).toContain('VND-DCA-CRYPTO');
    expect(p.blockedReason).toContain(tien(100_000_000));
    expect(p.blockedReason).toContain(tien(60_000_000));
    expect(p.blockedReason).toContain(tien(160_000_000)); // tổng túi
    expect(p.blockedReason).toContain(tien(150_000_000)); // số dư tiền mặt
    expect(p.blockedReason).toContain(tien(10_000_000));  // phần thiếu
    // Không tính tiếp trên dữ liệu tự mâu thuẫn.
    expect(p.buys).toEqual([]);
    expect(p.sellPlan).toBeNull();
    // BẤT BIẾN TIỀN.
    expect(p.unallocatedVnd).toBe(3_000_000);
    expect(tongMua(p) + p.unallocatedVnd).toBe(p.sources.poolVnd);
  });

  it('cổ tức lớn hơn tiền mặt TỰ DO sau khi trừ túi DCA → chặn, không ném exception', () => {
    // Ca reviewer dựng lại: Cash 20tr · túi DCA Stocks 18tr · cổ tức 5tr · Z 3tr.
    // earmarked.CASH = 20.000.000 − 18.000.000 = 2.000.000 (tiền mặt TỰ DO)
    // Trước khi có cổng chặn: valuesWithZ.CASH = 2.000.000 + 3.000.000 = 5.000.000,
    // pool = 3.000.000 + 5.000.000 = 8.000.000 > 5.000.000 ⇒ allocate NÉM LỖI.
    // Điều kiện thật rút gọn: cổ tức (5tr) > earmarked.CASH (2tr) — KHÔNG phải
    // "cổ tức > Cash gốc" (5tr ≤ 20tr, luôn đúng, nên chứng minh cũ sai).
    const p = buildActionPlan(snapshot({
      classValues: { STOCKS: 513_300_000, CRYPTO: 269_700_000,
                     GOLD: 179_437_500, CASH: 20_000_000 },
      cashReserveVnd: 20_000_000,
      earmarkedPots: { STOCKS: 18_000_000, CRYPTO: 0, GOLD: 0, CASH: 0 },
      incomeReceivedVnd: 5_000_000,
    }));
    expect(p.status).toBe('EARMARK_EXCEEDS_CASH');
    // Nguyên nhân THẬT là túi DCA — phải xuất hiện trong lý do.
    expect(p.blockedReason).toContain('VND-DCA-STOCKS');
    expect(p.blockedReason).toContain(tien(18_000_000)); // tiền trong túi
    expect(p.blockedReason).toContain(tien(20_000_000)); // Cash gốc
    expect(p.blockedReason).toContain(tien(2_000_000));  // tiền mặt tự do
    expect(p.blockedReason).toContain(tien(5_000_000));  // cổ tức
    expect(p.buys).toEqual([]);
    expect(p.sellPlan).toBeNull();
    // BẤT BIẾN TIỀN: pool = 3.000.000 + 5.000.000 = 8.000.000.
    expect(p.sources.poolVnd).toBe(8_000_000);
    expect(p.unallocatedVnd).toBe(8_000_000);
    expect(tongMua(p) + p.unallocatedVnd).toBe(p.sources.poolVnd);
  });

  it('cổ tức ĐÚNG BẰNG tiền mặt tự do → KHÔNG chặn (cổng khớp đúng mép của allocate)', () => {
    // Cùng danh mục ca trên nhưng cổ tức = 2.000.000 = earmarked.CASH.
    // allocate dùng dấu `>` chặt nên 5.000.000 > 5.000.000 là SAI ⇒ không ném.
    // Cổng chặn cũng phải dùng `>` chặt, nếu không sẽ chặn oan.
    //
    // Dẫn số: earmarked = {S 531.300.000, C 269.700.000, G 179.437.500, CASH 2.000.000}
    //   tổng = 982.437.500 (đúng bằng tổng classValues — toEarmarkedValues bảo toàn)
    //   valuesWithZ.CASH = 2.000.000 + 3.000.000 = 5.000.000 ⇒ newTotal = 985.437.500
    //   pool = 3.000.000 + 2.000.000 = 5.000.000 ⇒ preValues.CASH = 5.000.000 − 5.000.000 = 0
    //   gap S = 985.437.500 × 50% − 531.300.000 = 492.718.750 − 531.300.000 = −38.581.250 ✗
    //   gap C = 197.087.500 − 269.700.000 = −72.612.500 ✗
    //   gap G = 147.815.625 − 179.437.500 = −31.621.875 ✗
    //   gap CASH = 147.815.625 − 0 = +147.815.625 ✓ (ứng viên DUY NHẤT)
    //   ⇒ CASH nhận trọn 5.000.000 (tỷ lệ gap/gap = 1), làm tròn xuống vẫn 5.000.000, dư 0.
    const p = buildActionPlan(snapshot({
      classValues: { STOCKS: 513_300_000, CRYPTO: 269_700_000,
                     GOLD: 179_437_500, CASH: 20_000_000 },
      cashReserveVnd: 20_000_000,
      earmarkedPots: { STOCKS: 18_000_000, CRYPTO: 0, GOLD: 0, CASH: 0 },
      incomeReceivedVnd: 2_000_000,
    }));
    expect(p.status).toBe('READY');
    expect(p.blockedReason).toBeNull();
    expect(p.totalVnd).toBe(982_437_500);
    expect(buyAmounts(p)).toEqual({ CASH: 5_000_000 });
    expect(p.unallocatedVnd).toBe(0);
  });
});

describe('buildActionPlan — dồn tiền qua túi DCA (carryover)', () => {
  it('túi DCA Stocks 8,7tr nâng ngân sách mua từ 1,3tr lên 9,6tr', () => {
    // earmarked: Stocks 522.000.000 (48%) · Cash 116.362.500 (10,7%)
    // valuesWithZ.CASH = 119.362.500 · newTotal = 1.090.500.000
    // preValues.CASH = 116.362.500
    // gap: Stocks 545.250.000 − 522.000.000 = +23.250.000
    //      Cash   163.575.000 − 116.362.500 = +47.212.500   Σ = 70.462.500
    // Stocks = 3tr × 23.250.000/70.462.500 = 989.888,24 → xuống 900.000
    // Cash   = 3tr − 989.888,24 = 2.010.111,76 → xuống 2.000.000
    // dư 100.000 → gap lớn nhất là Cash ⇒ Cash 2.100.000
    // ngân sách mua = 900.000 + 8.700.000 = 9.600.000 (không có túi thì chỉ 1,3tr)
    const p = buildActionPlan(snapshot({
      earmarkedPots: { STOCKS: 8_700_000, CRYPTO: 0, GOLD: 0, CASH: 0 },
    }));
    expect(buyAmounts(p)).toEqual({ STOCKS: 900_000, CASH: 2_100_000 });
    // FPT còn thiếu 9.800.000 − 9.600.000 = 200.000 (trước đó thiếu 8.500.000)
    expect(p.tickerCandidates.shortfalls[0].shortfallVnd).toBe(200_000);
  });

  it('túi DCA Stocks 9tr → ngân sách 9,9tr, ĐỦ MUA lô FPT', () => {
    // earmarked: Stocks 522.300.000 · Cash 116.062.500
    // gap: Stocks 545.250.000 − 522.300.000 = +22.950.000
    //      Cash   163.575.000 − 116.062.500 = +47.512.500   Σ = 70.462.500
    // Stocks = 3tr × 22.950.000/70.462.500 = 977.115,53 → xuống 900.000
    // ngân sách = 900.000 + 9.000.000 = 9.900.000 ≥ 9.800.000 ⇒ FPT mua nổi
    const p = buildActionPlan(snapshot({
      earmarkedPots: { STOCKS: 9_000_000, CRYPTO: 0, GOLD: 0, CASH: 0 },
    }));
    expect(p.tickerCandidates.affordable.map((c) => c.symbol)).toContain('FPT');
  });
});

describe('buildActionPlan — cổ tức gộp cùng Z trong MỘT lần phân bổ', () => {
  const p = buildActionPlan(snapshot({ incomeReceivedVnd: 5_000_000 }));

  it('pool = Z + cổ tức', () => {
    expect(p.sources).toEqual({
      monthlyContributionVnd: 3_000_000,
      incomeReceivedVnd: 5_000_000,
      poolVnd: 8_000_000,
    });
  });

  it('cổ tức KHÔNG bị đếm hai lần: newTotal chỉ tăng đúng Z', () => {
    // valuesWithZ.CASH = 128.062.500 · newTotal = 1.090.500.000 (chỉ +3tr, không +8tr)
    // preValues.CASH = 128.062.500 − 8.000.000 = 120.062.500
    // gap: Stocks +31.950.000 · Cash 163.575.000 − 120.062.500 = +43.512.500
    //      Σ = 75.462.500
    // Stocks = 8tr × 31.950.000/75.462.500 = 3.387.112,80 → xuống 3.300.000
    // Cash   = 8tr − 3.387.112,80 = 4.612.887,20 → xuống 4.600.000
    // dư 100.000 → gap lớn nhất là Cash ⇒ Cash 4.700.000
    expect(buyAmounts(p)).toEqual({ STOCKS: 3_300_000, CASH: 4_700_000 });
  });

  it('BẤT BIẾN tổng vẫn đúng với pool gộp', () => {
    const total = p.buys.reduce((s, b) => s + b.amountVnd, 0);
    expect(total + p.unallocatedVnd).toBe(8_000_000);
  });
});

describe('buildActionPlan — có lệnh bán khi thực sự cần', () => {
  const p = buildActionPlan(snapshot({
    classValues: { STOCKS: 460_000_000, CRYPTO: 280_000_000,
                   GOLD: 140_000_000, CASH: 120_000_000 },
    cashReserveVnd: 120_000_000,
  }));

  it('Crypto 28% → REBALANCE_REQUIRED → sinh lệnh bán', () => {
    // tổng 1.000.000.000 ⇒ Crypto 28% (+8đ%), ngoài band 15–25 và ≥ 5đ%
    // bán về target: 280.000.000 − 200.000.000 = 80.000.000 ≥ 5tr ⇒ có lệnh
    expect(p.statuses.CRYPTO).toBe('REBALANCE_REQUIRED');
    expect(p.sellPlan!.sells.map((s) => s.assetClass)).toEqual(['CRYPTO']);
    expect(p.sellPlan!.sells[0].sellVnd).toBe(80_000_000);
  });

  it('có alert REBALANCE_REQUIRED mức ACTION', () => {
    const a = p.alerts.find((x) => x.code === 'REBALANCE_REQUIRED');
    expect(a).toBeDefined();
    expect(a!.severity).toBe('ACTION');
  });
});

describe('buildActionPlan — alerts §19', () => {
  it('chưa ghi nhận tiền vào kỳ này → CONTRIBUTION_MISSING', () => {
    const p = buildActionPlan(snapshot({ contributionRecordedThisPeriod: false }));
    expect(p.alerts.some((a) => a.code === 'CONTRIBUTION_MISSING')).toBe(true);
  });

  it('Cash dưới mức tối thiểu 7% → CASH_BELOW_MIN', () => {
    // tổng 1.100.000.000 ⇒ Cash 50.000.000 / 1,1 tỷ = 4,55% < 7%
    const p = buildActionPlan(snapshot({
      classValues: { STOCKS: 600_000_000, CRYPTO: 250_000_000,
                     GOLD: 200_000_000, CASH: 50_000_000 },
      cashReserveVnd: 50_000_000,
    }));
    expect(p.alerts.some((a) => a.code === 'CASH_BELOW_MIN')).toBe(true);
  });

  it('Crypto sụt 18% (vượt ngưỡng bậc 1) → CRYPTO_DRAWDOWN', () => {
    const p = buildActionPlan(snapshot({
      drawdowns: { STOCKS: 3, CRYPTO: 18, GOLD: 1, CASH: 0 },
    }));
    expect(p.alerts.some((a) => a.code === 'CRYPTO_DRAWDOWN')).toBe(true);
  });

  it('danh mục sụt 20% → PORTFOLIO_DRAWDOWN và Crash Reserve bậc 1 kích hoạt', () => {
    const p = buildActionPlan(snapshot({ portfolioDrawdownPct: 20 }));
    expect(p.alerts.some((a) => a.code === 'PORTFOLIO_DRAWDOWN')).toBe(true);
    expect(p.crash!.triggeredLevels.map((t) => t.level)).toEqual([1]);
  });

  it('trạng thái hoàn hảo → không có alert nào', () => {
    const p = buildActionPlan(snapshot({
      classValues: { STOCKS: 500_000_000, CRYPTO: 200_000_000,
                     GOLD: 150_000_000, CASH: 150_000_000 },
      cashReserveVnd: 150_000_000,
      drawdowns: { STOCKS: 0, CRYPTO: 0, GOLD: 0, CASH: 0 },
      portfolioDrawdownPct: 0,
    }));
    expect(p.alerts).toEqual([]);
  });

  it('mọi message alert là tiếng Việt, không rỗng', () => {
    const p = buildActionPlan(snapshot({ contributionRecordedThisPeriod: false }));
    for (const a of p.alerts) expect(a.message.trim().length).toBeGreaterThan(0);
  });
});

describe('buildActionPlan — không gọi Date.now()', () => {
  it('asOf trong kết quả đúng bằng asOf truyền vào', () => {
    const p = buildActionPlan(snapshot({ asOf: '2026-12-01' }));
    expect(p.asOf).toBe('2026-12-01');
  });

  it('cùng snapshot chạy hai lần ra kết quả giống hệt', () => {
    const s = snapshot();
    expect(buildActionPlan(s)).toEqual(buildActionPlan(s));
  });
});

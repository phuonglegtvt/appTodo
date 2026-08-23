// Hồ sơ "không theo dõi tiền mặt" — CASH target 0%, band 0–0.
//
// Đây là cấu hình mặc định của tab Danh mục (đợt 3 rút gọn): app tính tỷ trọng
// từ holdings thật của cổ phiếu / crypto / vàng, KHÔNG theo dõi số dư tiền mặt.
//
// Lý do có riêng một file test: bản bàn giao 2026-08-22 mục 4a ghi engine sinh
// "lệnh BÁN CASH" trong 3.111/5.000 ca ngẫu nhiên. Nếu ca đó xảy ra với hồ sơ
// này thì màn hình sẽ khuyên NewPL "bán tiền mặt" khi tiền mặt = 0 — vô nghĩa.
// Đo trước khi vẽ UI, không đoán.

import { describe, it, expect } from 'vitest';
import { buildActionPlan } from './actionPlan';
import { DEFAULT_CRASH_LEVELS } from './crashReserve';
import { DEFAULT_CONFIG } from './types';
import type { AssetClass, PortfolioSnapshot, TargetBand } from './types';

/** 60:30:10:0 — con số NewPL chốt, band ±5đ%, CASH khoá cứng ở 0. */
const TARGETS_NO_CASH: Record<AssetClass, TargetBand> = {
  STOCKS: { targetPct: 60, minPct: 55, maxPct: 65 },
  CRYPTO: { targetPct: 30, minPct: 25, maxPct: 35 },
  GOLD:   { targetPct: 10, minPct: 5,  maxPct: 15 },
  CASH:   { targetPct: 0,  minPct: 0,  maxPct: 0 },
};

function snapshot(over: Partial<PortfolioSnapshot> = {}): PortfolioSnapshot {
  return {
    asOf: '2026-08-23',
    // 35:20:0 mà NewPL nêu, quy ra tiền: lệch xa target, đúng ca dễ sinh lệnh bán.
    classValues: { STOCKS: 350_000_000, CRYPTO: 200_000_000, GOLD: 0, CASH: 0 },
    earmarkedPots: { STOCKS: 0, CRYPTO: 0, GOLD: 0, CASH: 0 },
    cashReserveVnd: 0,
    targets: TARGETS_NO_CASH,
    monthlyContributionVnd: 3_000_000,
    incomeReceivedVnd: 0,
    drawdowns: { STOCKS: 0, CRYPTO: 0, GOLD: 0, CASH: 0 },
    portfolioDrawdownPct: 0,
    crashLevels: DEFAULT_CRASH_LEVELS,
    crashHistory: [],
    currentEpisodeStart: '2026-08-23',
    missingPriceSymbols: [],
    contributionRecordedThisPeriod: true,
    watchlist: [],
    config: DEFAULT_CONFIG,
    ...over,
  };
}

describe('hồ sơ CASH target 0% — tab Danh mục', () => {
  const p = buildActionPlan(snapshot());

  it('tạo được kế hoạch', () => {
    expect(p.status).toBe('READY');
    expect(p.blockedReason).toBeNull();
    expect(p.totalVnd).toBe(550_000_000);
  });

  it('CÓ lệnh bán crypto — 36,4% vượt max 35%, lệch 6,4đ% ≥ ngưỡng 5đ%', () => {
    // Không phải lỗi: đây đúng là ca §6 Mode B. Ghi ra để ai đọc test biết
    // sellPlan khác null là hành vi mong đợi ở bộ số này, không phải tai nạn.
    expect(p.statuses.CRYPTO).toBe('REBALANCE_REQUIRED');
    expect(p.sellPlan).not.toBeNull();
    expect(p.sellPlan!.sells.map((o) => o.assetClass)).toEqual(['CRYPTO']);
  });

  it('KHÔNG sinh lệnh bán tiền mặt khi tiền mặt = 0', () => {
    const sellsCash = p.sellPlan?.sells.filter((o) => o.assetClass === 'CASH') ?? [];
    expect(sellsCash).toEqual([]);
  });

  it('tiền bán crypto KHÔNG đọng lại ở CASH mà chảy sang nhóm còn thiếu', () => {
    // Rủi ro riêng của hồ sơ này: CASH target 0% ⇒ nếu engine coi CASH là chỗ
    // nhận tiền bán, tiền sẽ rơi vào nhóm app KHÔNG theo dõi ⇒ biến mất khỏi
    // màn hình. Bất biến phải giữ: tiền bán = tiền phân bổ lại + phần dư,
    // và không có đồng nào mang nhãn CASH.
    const plan = p.sellPlan!;
    const nhan = plan.destinations.map((d) => d.assetClass);
    expect(nhan).not.toContain('CASH');

    const banDuoc = plan.sells.reduce((s, o) => s + o.sellVnd, 0);
    const phanBoLai = plan.destinations.reduce((s, d) => s + d.amountVnd, 0);
    expect(phanBoLai + plan.unallocatedVnd).toBe(banDuoc);
  });

  it('phân bổ hết tiền góp, không đồng nào rơi vào CASH', () => {
    const toCash = p.buys.find((b) => b.assetClass === 'CASH');
    expect(toCash).toBeUndefined();
    const tong = p.buys.reduce((s, b) => s + b.amountVnd, 0);
    expect(tong + p.unallocatedVnd).toBe(3_000_000);
  });

  it('CASH nằm trong band khi cả giá trị lẫn target đều = 0', () => {
    expect(p.statuses.CASH).toBe('OK');
  });
});

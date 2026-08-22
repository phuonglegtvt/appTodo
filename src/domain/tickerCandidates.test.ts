import { describe, it, expect } from 'vitest';
import { pickCandidates } from './tickerCandidates';
import type { WatchlistItem } from './types';

/** Giá và ngưỡng theo VND (bảng cũ dùng nghìn đồng — providers đã ×1000). */
function m(
  symbol: string, priceVnd: number | null, thresholdVnd: number | null,
  over: Partial<WatchlistItem> = {},
): WatchlistItem {
  return {
    symbol, name: symbol, group: 'balance',
    currentPriceVnd: priceVnd, thresholdVnd, lotSize: 100, ...over,
  };
}

// Lấy từ watchlist thật của NewPL (đơn vị đã đổi sang đồng).
const WATCHLIST: WatchlistItem[] = [
  m('HND', 13_000, 13_300),    // dưới ngưỡng, lô 1.300.000 → mua nổi
  m('QTP', 13_400, 13_500),    // dưới ngưỡng, lô 1.340.000 → mua nổi
  m('OCB', 14_000, 13_800),    // TRÊN ngưỡng → loại hẳn
  m('FPT', 98_000, 100_000),   // dưới ngưỡng, lô 9.800.000 → chưa đủ tiền
  m('DHG', 125_000, 130_000),  // dưới ngưỡng, lô 12.500.000 → chưa đủ tiền
  m('XXX', null, 20_000),      // thiếu giá → loại
  m('YYY', 20_000, null),      // thiếu ngưỡng → loại
];

describe('pickCandidates — ngân sách 1.400.000, Z = 3.000.000', () => {
  const r = pickCandidates(WATCHLIST, 1_400_000, 3_000_000);

  it('chỉ mã dưới ngưỡng VÀ mua nổi 1 lô mới vào danh sách mua được', () => {
    expect(r.affordable.map((c) => c.symbol)).toEqual(['HND', 'QTP']);
  });

  it('mã TRÊN ngưỡng bị loại hẳn, không xuất hiện ở đâu cả', () => {
    const moiSymbol = [...r.affordable, ...r.shortfalls].map((x) => x.symbol);
    expect(moiSymbol).not.toContain('OCB');
  });

  it('mã thiếu giá hoặc thiếu ngưỡng bị loại (không đoán bừa)', () => {
    const moiSymbol = [...r.affordable, ...r.shortfalls].map((x) => x.symbol);
    expect(moiSymbol).not.toContain('XXX');
    expect(moiSymbol).not.toContain('YYY');
  });

  it('sắp xếp mã mua được theo mức rẻ so với ngưỡng, rẻ nhất lên đầu', () => {
    // HND rẻ hơn ngưỡng 2,26%; QTP chỉ 0,74%.
    expect(r.affordable[0].symbol).toBe('HND');
    expect(r.affordable[0].belowThresholdPct).toBeGreaterThan(
      r.affordable[1].belowThresholdPct);
  });

  it('tính đúng số tiền một lô', () => {
    expect(r.affordable[0].lotCostVnd).toBe(1_300_000);
    expect(r.affordable[1].lotCostVnd).toBe(1_340_000);
  });
});

describe('pickCandidates — mã dưới ngưỡng nhưng chưa đủ tiền', () => {
  const r = pickCandidates(WATCHLIST, 1_400_000, 3_000_000);

  it('gom vào shortfalls, gần mua được nhất lên đầu', () => {
    expect(r.shortfalls.map((s) => s.symbol)).toEqual(['FPT', 'DHG']);
  });

  it('FPT: thiếu 8.400.000, dồn thêm 3 tháng nữa', () => {
    const fpt = r.shortfalls.find((s) => s.symbol === 'FPT');
    expect(fpt).toBeDefined();
    expect(fpt!.lotCostVnd).toBe(9_800_000);
    expect(fpt!.shortfallVnd).toBe(8_400_000);
    expect(fpt!.monthsToAfford).toBe(3);
  });

  it('không có tiền vào hàng tháng → monthsToAfford = null, KHÔNG đoán bừa', () => {
    const r0 = pickCandidates(WATCHLIST, 1_400_000, 0);
    expect(r0.shortfalls[0].monthsToAfford).toBeNull();
  });
});

describe('pickCandidates — biên', () => {
  it('watchlist rỗng → hai danh sách rỗng', () => {
    expect(pickCandidates([], 1_400_000, 3_000_000))
      .toEqual({ affordable: [], shortfalls: [] });
  });

  it('ngân sách 0 → không mã nào mua nổi, tất cả rơi vào shortfalls', () => {
    const r = pickCandidates(WATCHLIST, 0, 3_000_000);
    expect(r.affordable).toEqual([]);
    expect(r.shortfalls.map((s) => s.symbol)).toEqual(['HND', 'QTP', 'FPT', 'DHG']);
  });

  it('giá đúng bằng ngưỡng vẫn tính là dưới ngưỡng (bao gồm biên)', () => {
    const r = pickCandidates([m('ZZZ', 10_000, 10_000)], 2_000_000, 3_000_000);
    expect(r.affordable.map((c) => c.symbol)).toEqual(['ZZZ']);
    expect(r.affordable[0].belowThresholdPct).toBe(0);
  });

  it('lotSize = 1 (crypto/vàng) → tiền một lô bằng đúng giá', () => {
    const r = pickCandidates(
      [m('SJC', 8_500_000, 9_000_000, { lotSize: 1 })], 9_000_000, 3_000_000);
    expect(r.affordable[0].lotCostVnd).toBe(8_500_000);
  });

  it('lotSize <= 0 bị loại (dữ liệu xấu, không chia cho 0)', () => {
    const r = pickCandidates(
      [m('BAD', 10_000, 20_000, { lotSize: 0 })], 5_000_000, 3_000_000);
    expect(r.affordable).toEqual([]);
    expect(r.shortfalls).toEqual([]);
  });

  it('ngưỡng = 0 bị loại (không chia cho 0 khi tính % rẻ)', () => {
    const r = pickCandidates([m('BAD2', 0, 0)], 5_000_000, 3_000_000);
    expect(r.affordable).toEqual([]);
    expect(r.shortfalls).toEqual([]);
  });
});

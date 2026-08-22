import { describe, it, expect } from 'vitest';
import { classifyBand, classifyAll } from './bands';
import { DEFAULT_CONFIG } from './types';
import type { AssetClass, BandStatus, TargetBand, Weight } from './types';

const TARGETS: Record<AssetClass, TargetBand> = {
  STOCKS: { targetPct: 50, minPct: 40, maxPct: 55 },
  CRYPTO: { targetPct: 20, minPct: 15, maxPct: 25 },
  GOLD:   { targetPct: 15, minPct: 10, maxPct: 20 },
  CASH:   { targetPct: 15, minPct: 7,  maxPct: 20 },
};

/** Chỉ cần weightPct + deviationPp cho bands; các trường khác không ảnh hưởng. */
function makeWeight(assetClass: AssetClass, weightPct: number): Weight {
  const targetPct = TARGETS[assetClass].targetPct;
  return {
    assetClass, valueVnd: 0, weightPct, targetPct,
    deviationPp: weightPct - targetPct,
    targetValueVnd: 0, differenceVnd: 0,
  };
}

const check = (c: AssetClass, pct: number): BandStatus =>
  classifyBand(makeWeight(c, pct), TARGETS[c], DEFAULT_CONFIG);

describe('classifyBand — trong band', () => {
  it('lệch nhỏ → OK', () => {
    expect(check('STOCKS', 47.2)).toBe('OK');   // lệch −2,8
    expect(check('GOLD', 16.5)).toBe('OK');     // lệch +1,5
    expect(check('CRYPTO', 20)).toBe('OK');     // lệch 0
  });

  it('lệch ≥ 3đ% nhưng vẫn trong band → WATCH (cảnh báo mềm, KHÔNG bán)', () => {
    // Chính là Crypto của ví dụ §21: +4,8đ%, band 15–25 → cảnh báo, chưa bán.
    expect(check('CRYPTO', 24.8)).toBe('WATCH');
    expect(check('CASH', 11.5)).toBe('WATCH');  // lệch −3,5
  });

  it('GIẢI MÂU THUẪN §7: Cash 9% lệch −6đ% mà vẫn trong band 7–20 → WATCH, KHÔNG phải REBALANCE_REQUIRED', () => {
    // §7 nói "do nothing while inside the band" VÀ "rebalance khi lệch ≥5đ%".
    // Band là cổng ⇒ trong band thì không bao giờ mở khoá lệnh bán.
    expect(check('CASH', 9)).toBe('WATCH');
  });

  it('đúng biên band vẫn tính là TRONG band (bao gồm hai đầu)', () => {
    expect(check('CRYPTO', 25)).toBe('WATCH');   // đúng maxPct, lệch +5
    expect(check('CRYPTO', 15)).toBe('WATCH');   // đúng minPct, lệch −5
    expect(check('STOCKS', 55)).toBe('WATCH');
    expect(check('STOCKS', 40)).toBe('WATCH');
  });
});

describe('classifyBand — ngoài band', () => {
  it('ngoài band nhưng lệch < 5đ% → OUT_OF_BAND (chưa mở khoá bán)', () => {
    // Cần band HẸP HƠN 5đ% mới đạt tới được trạng thái này — xem ghi nhận
    // trong comment đầu bands.ts. Band mặc định của §2 không tạo ra ca này.
    const narrowBand: TargetBand = { targetPct: 15, minPct: 13, maxPct: 17 };
    const w: Weight = { ...makeWeight('GOLD', 18), deviationPp: 3 };
    expect(classifyBand(w, narrowBand, DEFAULT_CONFIG)).toBe('OUT_OF_BAND');
  });

  it('ngoài band VÀ lệch ≥ 5đ% → REBALANCE_REQUIRED (mở khoá lệnh bán)', () => {
    expect(check('CRYPTO', 26)).toBe('REBALANCE_REQUIRED');    // lệch +6
    expect(check('CRYPTO', 25.5)).toBe('REBALANCE_REQUIRED');  // lệch +5,5
    expect(check('STOCKS', 56)).toBe('REBALANCE_REQUIRED');    // lệch +6
    expect(check('STOCKS', 38)).toBe('REBALANCE_REQUIRED');    // lệch −12
    expect(check('CASH', 6)).toBe('REBALANCE_REQUIRED');       // lệch −9
  });
});

describe('classifyAll', () => {
  it('ví dụ §21 ra đúng bộ trạng thái spec mô tả', () => {
    const weights: Weight[] = [
      makeWeight('STOCKS', 47.2),
      makeWeight('CRYPTO', 24.8),
      makeWeight('GOLD', 16.5),
      makeWeight('CASH', 11.5),
    ];
    expect(classifyAll(weights, TARGETS, DEFAULT_CONFIG)).toEqual({
      STOCKS: 'OK',
      CRYPTO: 'WATCH',
      GOLD: 'OK',
      CASH: 'WATCH',
    });
  });
});

describe('classifyBand — ngưỡng cấu hình được', () => {
  it('watchDeviationPp = 0 → mọi lệch khác 0 trong band đều WATCH', () => {
    const cfg = { ...DEFAULT_CONFIG, watchDeviationPp: 0 };
    expect(classifyBand(makeWeight('STOCKS', 49.9), TARGETS.STOCKS, cfg)).toBe('WATCH');
  });

  it('strongRebalancePp = 100 → không bao giờ REBALANCE_REQUIRED', () => {
    const cfg = { ...DEFAULT_CONFIG, strongRebalancePp: 100 };
    expect(classifyBand(makeWeight('CRYPTO', 30), TARGETS.CRYPTO, cfg)).toBe('OUT_OF_BAND');
  });
});

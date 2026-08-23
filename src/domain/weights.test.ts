import { describe, it, expect } from 'vitest';
import { computeWeights, totalVnd } from './weights';
import { ASSET_CLASSES } from './types';
import type { AssetClass, TargetBand } from './types';

const TARGETS: Record<AssetClass, TargetBand> = {
  STOCKS: { targetPct: 50, minPct: 40, maxPct: 55 },
  CRYPTO: { targetPct: 20, minPct: 15, maxPct: 25 },
  GOLD:   { targetPct: 15, minPct: 10, maxPct: 20 },
  CASH:   { targetPct: 15, minPct: 7,  maxPct: 20 },
};

// Bộ số của ví dụ §21 trong spec gốc — dùng xuyên suốt các test engine.
const VI_DU_21: Record<AssetClass, number> = {
  STOCKS: 513_300_000,
  CRYPTO: 269_700_000,
  GOLD:   179_437_500,
  CASH:   125_062_500,
};

describe('totalVnd', () => {
  it('cộng đúng 4 class', () => {
    expect(totalVnd(VI_DU_21)).toBe(1_087_500_000);
  });

  it('danh mục rỗng ra 0', () => {
    expect(totalVnd({ STOCKS: 0, CRYPTO: 0, GOLD: 0, CASH: 0 })).toBe(0);
  });
});

describe('computeWeights — ví dụ §21', () => {
  const ws = computeWeights(VI_DU_21, TARGETS);
  const by = (c: AssetClass) => ws.find((w) => w.assetClass === c)!;

  it('trả đúng 4 dòng, đúng thứ tự ASSET_CLASSES', () => {
    expect(ws.map((w) => w.assetClass)).toEqual([...ASSET_CLASSES]);
  });

  it('tỷ trọng khớp §21: 47,2 / 24,8 / 16,5 / 11,5', () => {
    expect(by('STOCKS').weightPct).toBeCloseTo(47.2, 6);
    expect(by('CRYPTO').weightPct).toBeCloseTo(24.8, 6);
    expect(by('GOLD').weightPct).toBeCloseTo(16.5, 6);
    expect(by('CASH').weightPct).toBeCloseTo(11.5, 6);
  });

  it('độ lệch điểm % khớp §21: −2,8 / +4,8 / +1,5 / −3,5', () => {
    expect(by('STOCKS').deviationPp).toBeCloseTo(-2.8, 6);
    expect(by('CRYPTO').deviationPp).toBeCloseTo(+4.8, 6);
    expect(by('GOLD').deviationPp).toBeCloseTo(+1.5, 6);
    expect(by('CASH').deviationPp).toBeCloseTo(-3.5, 6);
  });

  it('target_value và difference tính trên TỔNG HIỆN TẠI (đúng §17)', () => {
    expect(by('STOCKS').targetValueVnd).toBeCloseTo(543_750_000, 3);
    expect(by('STOCKS').differenceVnd).toBeCloseTo(+30_450_000, 3);
    expect(by('CRYPTO').differenceVnd).toBeCloseTo(-52_200_000, 3);
    expect(by('GOLD').differenceVnd).toBeCloseTo(-16_312_500, 3);
    expect(by('CASH').differenceVnd).toBeCloseTo(+38_062_500, 3);
  });

  it('tổng tỷ trọng bằng 100%', () => {
    const tong = ws.reduce((s, w) => s + w.weightPct, 0);
    expect(tong).toBeCloseTo(100, 6);
  });
});

describe('computeWeights — biên', () => {
  it('danh mục rỗng: mọi tỷ trọng = 0, KHÔNG ra NaN', () => {
    const ws = computeWeights({ STOCKS: 0, CRYPTO: 0, GOLD: 0, CASH: 0 }, TARGETS);
    for (const w of ws) {
      expect(Number.isNaN(w.weightPct)).toBe(false);
      expect(w.weightPct).toBe(0);
      expect(w.targetValueVnd).toBe(0);
      expect(w.differenceVnd).toBe(0);
    }
  });

  it('dồn hết vào một class: class đó 100%, còn lại 0', () => {
    const ws = computeWeights(
      { STOCKS: 1_000_000_000, CRYPTO: 0, GOLD: 0, CASH: 0 }, TARGETS);
    expect(ws.find((w) => w.assetClass === 'STOCKS')!.weightPct).toBe(100);
    expect(ws.find((w) => w.assetClass === 'CRYPTO')!.weightPct).toBe(0);
  });
});

import { describe, it, expect } from 'vitest';
import { canGopThang, danhGiaMucTieu, giaTriTuongLai, soThangConLai, type FinancialGoal } from './financialGoals';

describe('soThangConLai', () => {
  it('tháng trọn, không âm', () => {
    expect(soThangConLai('2026-11-27', '2030-11-27')).toBe(48);
    expect(soThangConLai('2026-11-27', '2026-12-26')).toBe(0);
    expect(soThangConLai('2026-11-27', '2025-01-01')).toBe(0);
  });
});

describe('giaTriTuongLai / canGopThang', () => {
  it('lãi 0: cộng thẳng', () => {
    expect(giaTriTuongLai(100, 10, 0, 12)).toBe(220);
    expect(canGopThang(100, 220, 0, 12)).toBe(10);
  });
  it('có lãi: canGopThang là nghịch đảo của giaTriTuongLai', () => {
    const pmt = canGopThang(50_000_000, 2_000_000_000, 6, 48) as number;
    expect(giaTriTuongLai(50_000_000, pmt, 6, 48)).toBeCloseTo(2_000_000_000, 0);
  });
  it('gốc đã đủ ⇒ 0; hết hạn mà thiếu ⇒ null', () => {
    expect(canGopThang(300, 200, 5, 12)).toBe(0);
    expect(canGopThang(100, 200, 5, 0)).toBeNull();
  });
});

describe('danhGiaMucTieu', () => {
  const g: FinancialGoal = {
    id: 'g', name: 'Mua nhà', target_amount_vnd: 1_000_000_000, target_date: '2030-11-27',
    saved_vnd: 200_000_000, monthly_contribution_vnd: 10_000_000, expected_return_pct: 0, note: '',
  };
  it('lãi 0: 200tr + 10tr × 48 = 680tr ⇒ chưa kịp, thiếu 320tr, cần ~16,67tr/tháng', () => {
    const s = danhGiaMucTieu(g, '2026-11-27');
    expect(s.soThang).toBe(48);
    expect(s.tienDoPct).toBe(20);
    expect(s.duKien).toBe(680_000_000);
    expect(s.kip).toBe(false);
    expect(s.chenhLech).toBe(-320_000_000);
    expect(s.canGop).toBeCloseTo(800_000_000 / 48);
  });
});

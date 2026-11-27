import { describe, it, expect } from 'vitest';
import { baoCaoNam, canGhiDinhKy, soSanhNganSach, type KhoanDinhKy } from './cashPlanning';
import type { CashEntry } from '../types/cashEntry';

const e = (occurred_on: string, kind: 'THU' | 'CHI', category: string, amount_vnd: number, recurring_id: string | null = null) =>
  ({ id: `${occurred_on}-${category}-${amount_vnd}`, user_id: 'u', occurred_on, kind, category, amount_vnd, note: '', created_at: '', updated_at: '', recurring_id }) as CashEntry & { recurring_id: string | null };

describe('soSanhNganSach', () => {
  it('chỉ tính chi của đúng tháng; vượt ngân sách lên đầu', () => {
    const ds = [
      e('2026-11-03', 'CHI', 'AN_UONG', 4_000_000),
      e('2026-11-20', 'CHI', 'AN_UONG', 2_000_000),
      e('2026-10-20', 'CHI', 'AN_UONG', 9_000_000), // tháng khác
      e('2026-11-05', 'CHI', 'DI_LAI', 500_000),
    ];
    const r = soSanhNganSach(ds, '2026-11', { AN_UONG: 5_000_000, DI_LAI: 2_000_000, GIAI_TRI: 1_000_000 });
    expect(r.map((x) => [x.category, x.daChi, Math.round(x.pct)])).toEqual([
      ['AN_UONG', 6_000_000, 120], ['DI_LAI', 500_000, 25], ['GIAI_TRI', 0, 0],
    ]);
    expect(r[0].conLai).toBe(-1_000_000);
  });
});

describe('canGhiDinhKy', () => {
  const k = (p: Partial<KhoanDinhKy>): KhoanDinhKy => ({ id: 'k', kind: 'CHI', category: 'TRA_VAY', amount_vnd: 5_000_000, day_of_month: 10, note: '', active: true, ...p });
  it('tạo cho khoản đang bật mà tháng đó chưa ghi; ngày 31 → cuối tháng', () => {
    const r = canGhiDinhKy([k({ id: 'a' }), k({ id: 'b', day_of_month: 31 }), k({ id: 'c', active: false })], [], '2026-02');
    expect(r.map((x) => [x.recurring_id, x.occurred_on])).toEqual([['a', '2026-02-10'], ['b', '2026-02-28']]);
  });
  it('đã ghi trong tháng ⇒ không tạo lại; tháng khác không tính', () => {
    const entries = [e('2026-11-10', 'CHI', 'TRA_VAY', 5_000_000, 'a'), e('2026-10-10', 'CHI', 'TRA_VAY', 5_000_000, 'b')];
    const r = canGhiDinhKy([k({ id: 'a' }), k({ id: 'b' })], entries, '2026-11');
    expect(r.map((x) => x.recurring_id)).toEqual(['b']);
  });
});

describe('baoCaoNam', () => {
  it('12 tháng, tổng năm, chi theo danh mục bỏ vòng tiền và đầu tư', () => {
    const r = baoCaoNam([
      e('2026-01-05', 'THU', 'LUONG', 30_000_000),
      e('2026-01-10', 'CHI', 'AN_UONG', 6_000_000),
      e('2026-02-10', 'CHI', 'NHA_CUA', 4_000_000),
      e('2026-02-11', 'CHI', 'DAO_HAN_THE', 50_000_000),
      e('2026-02-12', 'CHI', 'DAU_TU', 10_000_000),
      e('2025-12-30', 'THU', 'LUONG', 99), // năm khác
    ], 2026);
    expect(r.thang).toHaveLength(12);
    expect(r.thang[0]).toMatchObject({ thang: '2026-01', thu: 30_000_000, chi: 6_000_000 });
    expect(r.tong.chi).toBe(10_000_000);
    expect(r.tong.dauTu).toBe(10_000_000);
    expect(r.chiTheoMuc.map((x) => [x.category, x.pct])).toEqual([['AN_UONG', 60], ['NHA_CUA', 40]]);
  });
});

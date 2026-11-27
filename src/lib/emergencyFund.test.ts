import { describe, it, expect } from 'vitest';
import { chiTrungBinh, danhGiaQuyDuPhong } from './emergencyFund';
import type { CashEntry } from '../types/cashEntry';

const e = (occurred_on: string, kind: 'THU' | 'CHI', category: string, amount_vnd: number): CashEntry =>
  ({ id: occurred_on + category + amount_vnd, user_id: 'u', occurred_on, kind, category, amount_vnd, note: '', created_at: '', updated_at: '' });

describe('chiTrungBinh', () => {
  it('lấy các tháng trọn TRƯỚC tháng hiện tại, bỏ tháng chưa ghi, bỏ vòng tiền & đầu tư', () => {
    const r = chiTrungBinh([
      e('2026-11-05', 'CHI', 'AN_UONG', 99_000_000),   // tháng hiện tại ⇒ bỏ
      e('2026-10-05', 'CHI', 'AN_UONG', 10_000_000),
      e('2026-10-06', 'CHI', 'DAO_HAN_THE', 50_000_000), // vòng tiền ⇒ bỏ
      e('2026-10-07', 'CHI', 'DAU_TU', 20_000_000),      // đầu tư ⇒ bỏ
      // 09 không ghi gì ⇒ bỏ qua, không tính là 0
      e('2026-08-05', 'CHI', 'NHA_CUA', 14_000_000),
      e('2026-07-05', 'CHI', 'NHA_CUA', 6_000_000),
    ], '2026-11-27');
    expect(r.thangDung).toEqual(['2026-10', '2026-08', '2026-07']);
    expect(r.trungBinh).toBe(10_000_000);
  });
  it('chưa ghi tháng nào ⇒ null', () => {
    expect(chiTrungBinh([], '2026-11-27').trungBinh).toBeNull();
  });
});

describe('danhGiaQuyDuPhong', () => {
  it('10tr tiền mặt, chi 10tr/tháng ⇒ 1 tháng, thiếu 50tr để đủ 6 tháng', () => {
    expect(danhGiaQuyDuPhong(10_000_000, 10_000_000)).toEqual({ soThangDuSong: 1, conThieu: 50_000_000, muc: 'THIEU' });
  });
  it('mốc 3 và 6 tháng', () => {
    expect(danhGiaQuyDuPhong(30, 10).muc).toBe('TAM_DUOC');
    expect(danhGiaQuyDuPhong(60, 10)).toMatchObject({ muc: 'DU', conThieu: 0 });
  });
  it('chưa biết chi tiêu ⇒ không bịa số tháng', () => {
    expect(danhGiaQuyDuPhong(10, null).muc).toBe('CHUA_BIET');
  });
});

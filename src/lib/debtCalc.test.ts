import { describe, it, expect } from 'vitest';
import { ngayDenHanKeTiep, sapDenHan, soNgayGiua, tongHopNo } from './debtCalc';
import type { Debt } from '../types/debt';

function debt(p: Partial<Debt>): Debt {
  return {
    id: p.id ?? 'd', user_id: 'u', kind: 'CARD', name: 'Thẻ', balance_vnd: 0,
    credit_limit_vnd: null, interest_rate_pct: null, monthly_payment_vnd: null,
    statement_day: null, due_day: null, rolls_over: false, rollover_fee_pct: null,
    end_date: null, note: '', sort_order: 0, created_at: '', updated_at: '', ...p,
  };
}

describe('ngayDenHanKeTiep', () => {
  it('còn trong tháng thì là tháng này, qua rồi thì sang tháng sau', () => {
    expect(ngayDenHanKeTiep(27, '2026-11-27')).toBe('2026-11-27');
    expect(ngayDenHanKeTiep(10, '2026-11-27')).toBe('2026-12-10');
    expect(ngayDenHanKeTiep(15, '2026-12-20')).toBe('2027-01-15');
  });
  it('ngày 31 vào tháng ngắn ⇒ ngày cuối tháng', () => {
    expect(ngayDenHanKeTiep(31, '2026-02-10')).toBe('2026-02-28');
    expect(ngayDenHanKeTiep(31, '2026-11-01')).toBe('2026-11-30');
  });
});

it('soNgayGiua', () => {
  expect(soNgayGiua('2026-11-27', '2026-12-10')).toBe(13);
});

describe('tongHopNo', () => {
  it('cộng dư nợ, hạn mức, lãi tháng, phí đáo hạn, chi phí năm', () => {
    const s = tongHopNo([
      debt({ kind: 'CARD', balance_vnd: 30_000_000, credit_limit_vnd: 50_000_000, rolls_over: true, rollover_fee_pct: 1 }),
      debt({ kind: 'CARD', balance_vnd: 10_000_000 }), // không hạn mức ⇒ không vào tỷ lệ sử dụng
      debt({ kind: 'LOAN', balance_vnd: 120_000_000, interest_rate_pct: 12, monthly_payment_vnd: 5_000_000 }),
    ]);
    expect(s.tongDuNo).toBe(160_000_000);
    expect(s.tongDuNoThe).toBe(40_000_000);
    expect(s.tongDuNoVay).toBe(120_000_000);
    expect(s.tyLeSuDungThe).toBeCloseTo(60);
    expect(s.phaiTraThang).toBe(5_000_000);
    expect(s.laiUocThang).toBeCloseTo(1_200_000);
    expect(s.phiDaoHanThang).toBeCloseTo(300_000);
    expect(s.chiPhiNam).toBeCloseTo((1_200_000 + 300_000) * 12);
  });
  it('rỗng ⇒ 0 và tỷ lệ sử dụng null', () => {
    const s = tongHopNo([]);
    expect(s.tongDuNo).toBe(0);
    expect(s.tyLeSuDungThe).toBeNull();
  });
});

describe('sapDenHan', () => {
  it('chỉ khoản còn dư nợ, trong 7 ngày, gần nhất trước', () => {
    const ds = sapDenHan([
      debt({ id: 'a', due_day: 30, balance_vnd: 1 }),
      debt({ id: 'b', due_day: 28, balance_vnd: 1 }),
      debt({ id: 'c', due_day: 15, balance_vnd: 1 }),   // 18 ngày nữa ⇒ loại
      debt({ id: 'd', due_day: 28, balance_vnd: 0 }),   // hết nợ ⇒ loại
    ], '2026-11-27');
    expect(ds.map((x) => [x.debt.id, x.conNgay])).toEqual([['b', 1], ['a', 3]]);
  });
});

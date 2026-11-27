import { describe, it, expect } from 'vitest';
import { chayDca, lichMua, luiNam, xirr, soNgay, type DcaInput, type PricePoint } from './dcaBacktest';

const base: Omit<DcaInput, 'prices'> = {
  soTienMoiKy: 1_000_000,
  tuNgay: '2024-01-01',
  denNgay: '2024-03-31',
  ngayTrongThang: 5,
  phiMuaPct: 0,
  laiGuiPct: 0,
};

describe('lichMua', () => {
  it('lấy ngày cố định mỗi tháng trong khoảng, qua năm mới', () => {
    expect(lichMua('2024-11-10', '2025-02-04', 5)).toEqual(['2024-12-05', '2025-01-05']);
  });
});

describe('chayDca', () => {
  it('giá không đổi ⇒ giá trị = vốn, lãi 0', () => {
    const prices: PricePoint[] = ['2024-01-05', '2024-02-05', '2024-03-05', '2024-03-29'].map((date) => ({ date, close: 10 }));
    const r = chayDca({ ...base, prices });
    expect(r.buys).toHaveLength(3);
    expect(r.tongVon).toBe(3_000_000);
    expect(r.giaTriCuoi).toBeCloseTo(3_000_000);
    expect(r.laiLo).toBeCloseTo(0);
    expect(r.loSauNhat.pct).toBeCloseTo(0);
  });

  it('ngày mua rơi vào ngày nghỉ ⇒ khớp phiên kế tiếp', () => {
    const prices: PricePoint[] = [
      { date: '2024-01-08', close: 10 },
      { date: '2024-02-05', close: 20 },
      { date: '2024-03-06', close: 40 },
    ];
    const r = chayDca({ ...base, prices });
    expect(r.buys.map((b) => b.date)).toEqual(['2024-01-08', '2024-02-05', '2024-03-06']);
    // Đơn vị: 100k + 50k + 25k = 175k, định giá 40 ⇒ 7 tr.
    expect(r.tongDonVi).toBeCloseTo(175_000);
    expect(r.giaTriCuoi).toBeCloseTo(7_000_000);
    expect(r.laiLoPct).toBeCloseTo((7 / 3 - 1) * 100);
    expect(r.giaVonTb).toBeCloseTo(3_000_000 / 175_000);
  });

  it('phí mua giảm số đơn vị mua được', () => {
    const prices: PricePoint[] = [{ date: '2024-01-05', close: 10 }];
    const r = chayDca({ ...base, denNgay: '2024-01-31', phiMuaPct: 1, prices });
    expect(r.tongDonVi).toBeCloseTo(99_000);
    expect(r.tongPhi).toBeCloseTo(10_000);
  });

  it('mã lên sàn sau "Từ ngày" thì bắt đầu từ tháng có dữ liệu, không dồn kỳ', () => {
    const prices: PricePoint[] = [
      { date: '2024-02-20', close: 10 },
      { date: '2024-03-05', close: 10 },
    ];
    const r = chayDca({ ...base, prices });
    expect(r.ngayDauDuLieu).toBe('2024-02-20');
    // Tháng 1 bị bỏ (chưa lên sàn); kỳ tháng 2 khớp phiên đầu tiên 20/2.
    expect(r.buys.map((b) => b.date)).toEqual(['2024-02-20', '2024-03-05']);
  });

  it('gửi tiết kiệm 12%/năm ghép theo ngày', () => {
    const prices: PricePoint[] = [
      { date: '2023-01-05', close: 10 },
      { date: '2023-02-06', close: 10 },
      { date: '2023-03-03', close: 10 },
    ];
    const r = chayDca({ ...base, tuNgay: '2023-01-01', denNgay: '2023-03-04', laiGuiPct: 12, prices });
    expect(r.buys).toHaveLength(2);
    const nam = (a: string, b: string) => (soNgay(b) - soNgay(a)) / 365;
    const kyVong = 1e6 * Math.pow(1.12, nam('2023-01-05', '2023-03-03'))
      + 1e6 * Math.pow(1.12, nam('2023-02-06', '2023-03-03'));
    expect(r.giaTriGuiTietKiem).toBeCloseTo(kyVong, 4);
  });

  it('báo lỗi khi không có dữ liệu giá', () => {
    expect(() => chayDca({ ...base, prices: [] })).toThrow(/Không có dữ liệu/);
    expect(() => chayDca({ ...base, ngayTrongThang: 31, prices: [{ date: '2024-01-05', close: 1 }] })).toThrow(/1 đến 28/);
  });
});

describe('xirr', () => {
  it('bỏ 100, một năm sau nhận 110 ⇒ 10%', () => {
    const r = xirr([{ day: soNgay('2023-01-01'), amount: -100 }, { day: soNgay('2024-01-01'), amount: 110 }]);
    expect(r).not.toBeNull();
    expect(r as number).toBeCloseTo(0.1, 6);
  });

  it('không có nghiệm ⇒ null', () => {
    expect(xirr([{ day: 0, amount: 100 }, { day: 365, amount: 100 }])).toBeNull();
  });
});

describe('luiNam', () => {
  it('lùi năm, 29/2 về 28/2', () => {
    expect(luiNam('2026-11-27', 5)).toBe('2021-11-27');
    expect(luiNam('2024-02-29', 1)).toBe('2023-02-28');
  });
});

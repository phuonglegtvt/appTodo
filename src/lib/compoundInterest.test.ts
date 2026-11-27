import { describe, it, expect } from 'vitest';
import { tinhLaiKep } from './compoundInterest';

describe('tinhLaiKep', () => {
  it('khớp ví dụ TopCV: 10tr gốc, 10tr/tháng, 10 năm, 10%, ghép năm', () => {
    const r = tinhLaiKep({ gocBanDau: 10e6, gopMoiThang: 10e6, soNam: 10, laiSuatNamPct: 10, kyMoiNam: 1 });
    // TopCV hiện 1.938.428.376 (cắt phần lẻ); số chính xác là …376,6.
    expect(Math.floor(r.giaTriCuoi)).toBe(1_938_428_376);
    expect(r.tongGoc).toBe(1_210_000_000);
    expect(r.rows).toHaveLength(11);
    expect(r.rows[0]).toEqual({ nam: 0, tienGoc: 10e6, giaTri: 10e6, tienLai: 0 });
  });

  it('lãi 0% thì giá trị bằng đúng tiền gốc', () => {
    const r = tinhLaiKep({ gocBanDau: 5e6, gopMoiThang: 1e6, soNam: 3, laiSuatNamPct: 0, kyMoiNam: 12 });
    expect(r.giaTriCuoi).toBe(5e6 + 36e6);
    expect(r.tongLai).toBe(0);
  });

  it('chỉ có gốc, ghép tháng: P(1 + r/12)^(12n)', () => {
    const r = tinhLaiKep({ gocBanDau: 100e6, gopMoiThang: 0, soNam: 2, laiSuatNamPct: 6, kyMoiNam: 12 });
    expect(r.giaTriCuoi).toBeCloseTo(100e6 * Math.pow(1.005, 24), 2);
  });

  it('ghép càng dày thì lãi càng nhiều (cùng lãi suất danh nghĩa)', () => {
    const base = { gocBanDau: 100e6, gopMoiThang: 0, soNam: 5, laiSuatNamPct: 8 };
    const nam = tinhLaiKep({ ...base, kyMoiNam: 1 }).giaTriCuoi;
    const quy = tinhLaiKep({ ...base, kyMoiNam: 4 }).giaTriCuoi;
    const thang = tinhLaiKep({ ...base, kyMoiNam: 12 }).giaTriCuoi;
    expect(quy).toBeGreaterThan(nam);
    expect(thang).toBeGreaterThan(quy);
  });

  it('báo lỗi khi đầu vào sai thay vì coi là 0', () => {
    const ok = { gocBanDau: 0, gopMoiThang: 0, soNam: 1, laiSuatNamPct: 5, kyMoiNam: 1 as const };
    expect(() => tinhLaiKep({ ...ok, soNam: 0 })).toThrow(/Số năm/);
    expect(() => tinhLaiKep({ ...ok, gocBanDau: -1 })).toThrow(/gốc/);
    expect(() => tinhLaiKep({ ...ok, laiSuatNamPct: NaN })).toThrow(/Lãi suất/);
  });
});

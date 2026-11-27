import { describe, it, expect } from 'vitest';
import { dinhDangKhiGo, dinhDangSoTien } from './moneyTyping';
import { parseVndAmount } from './parseNumber';

/** Gõ thêm `ky` vào cuối chuỗi rồi định dạng — giống thao tác thật. */
const goCuoi = (s: string, ky: string) => dinhDangKhiGo(s + ky, s.length + ky.length);

describe('dinhDangKhiGo', () => {
  it('800 gõ thêm 0 → 8,000, rồi 80,000 … 800,000', () => {
    let s = '800';
    for (const mong of ['8,000', '80,000', '800,000', '8,000,000']) {
      const r = goCuoi(s, '0');
      expect(r.text).toBe(mong);
      expect(r.caret).toBe(mong.length);
      s = r.text;
    }
  });

  it('dán số có dấu chấm kiểu VN → đổi sang phẩy', () => {
    expect(dinhDangKhiGo('3.000.000', 9).text).toBe('3,000,000');
  });

  it('xoá một chữ số ở giữa: con trỏ giữ sau đúng chữ số trước đó', () => {
    // "1,234,567", con trỏ sau "1,23" (vị trí 4), Backspace xoá "3" → "1,24,567" thô.
    const r = dinhDangKhiGo('1,24,567', 3);
    expect(r.text).toBe('124,567');
    // Trước con trỏ có 2 chữ số ("1","2") ⇒ con trỏ sau "12".
    expect(r.text.slice(0, r.caret)).toBe('12');
  });

  it('gõ chen vào giữa số', () => {
    // "12,345", con trỏ sau "12," (vị trí 3), gõ "9" → "12,9345".
    const r = dinhDangKhiGo('12,9345', 4);
    expect(r.text).toBe('129,345');
    expect(r.text.slice(0, r.caret)).toBe('129');
  });

  it('bỏ chữ, bỏ số 0 đầu, giữ dấu trừ, ô rỗng', () => {
    expect(dinhDangKhiGo('abc1000đ', 8).text).toBe('1,000');
    expect(dinhDangKhiGo('0050', 4).text).toBe('50');
    expect(dinhDangKhiGo('-5000', 5).text).toBe('-5,000');
    expect(dinhDangKhiGo('', 0)).toEqual({ text: '', caret: 0 });
  });

  it('chuỗi đã định dạng vẫn đọc ra đúng số', () => {
    expect(parseVndAmount(dinhDangKhiGo('12345678', 8).text)).toBe(12_345_678);
    expect(parseVndAmount('-5,000')).toBe(-5000);
  });
});

describe('dinhDangSoTien', () => {
  it('định dạng số để điền sẵn vào ô', () => {
    expect(dinhDangSoTien(10_000_000)).toBe('10,000,000');
    expect(dinhDangSoTien(0)).toBe('0');
    expect(dinhDangSoTien(null)).toBe('');
    expect(dinhDangSoTien(-1500)).toBe('-1,500');
  });
});

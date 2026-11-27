import { describe, it, expect } from 'vitest';
import { oCsv, toCsv } from './csv';

describe('oCsv', () => {
  it('bọc ô có dấu phẩy, ngoặc kép, xuống dòng', () => {
    expect(oCsv('a,b')).toBe('"a,b"');
    expect(oCsv('nói "chào"')).toBe('"nói ""chào"""');
    expect(oCsv('dòng 1\ndòng 2')).toBe('"dòng 1\ndòng 2"');
  });
  it('null → trống; số giữ nguyên; object → JSON', () => {
    expect(oCsv(null)).toBe('');
    expect(oCsv(1234.5)).toBe('1234.5');
    expect(oCsv(['a'])).toBe('"[""a""]"');
  });
});

describe('toCsv', () => {
  it('cột = hợp các khoá theo thứ tự xuất hiện; dòng thiếu khoá để trống', () => {
    expect(toCsv([{ ma: 'FPT', gia: 44.95 }, { ma: 'HPG', ghi_chu: 'Hoà Phát' }]))
      .toBe('ma,gia,ghi_chu\r\nFPT,44.95,\r\nHPG,,Hoà Phát');
  });
  it('rỗng ⇒ chuỗi rỗng ở dòng tiêu đề', () => {
    expect(toCsv([])).toBe('');
  });
});

import { describe, it, expect } from 'vitest';
import { parseVnNumber } from './parseNumber';

describe('parseVnNumber', () => {
  it('chuỗi rỗng → null', () => {
    expect(parseVnNumber('')).toBeNull();
  });

  it('chuỗi chỉ toàn khoảng trắng → null', () => {
    expect(parseVnNumber('   ')).toBeNull();
  });

  it('dấu phẩy thập phân kiểu VN → parse đúng', () => {
    expect(parseVnNumber('30,1')).toBe(30.1);
  });

  it('dấu chấm thập phân → parse đúng', () => {
    expect(parseVnNumber('30.1')).toBe(30.1);
  });

  it('số nguyên → parse đúng', () => {
    expect(parseVnNumber('700')).toBe(700);
  });

  it('chuỗi không phải số → null', () => {
    expect(parseVnNumber('abc')).toBeNull();
  });

  it('số kèm ký tự rác phía sau → NaN → null', () => {
    expect(parseVnNumber('30.1abc')).toBeNull();
  });

  it(
    // Lưu ý hành vi hiện tại: parseVnNumber chỉ replace(',', '.') dấu phẩy ĐẦU TIÊN
    // (String.prototype.replace không có cờ 'g'), nên chuỗi nhiều dấu phẩy như
    // '1,234,56' → sau replace thành '1.234,56' → Number(...) = NaN → null.
    // Đây là giới hạn hiện có của hàm, test này chỉ ghim (pin) lại hành vi thật,
    // không phải khẳng định đó là hành vi mong muốn.
    'nhiều dấu phẩy (chỉ dấu đầu tiên được thay) → NaN → null',
    () => {
      expect(parseVnNumber('1,234,56')).toBeNull();
    }
  );

  it('khoảng trắng bao quanh được trim trước khi parse', () => {
    expect(parseVnNumber('  30,1  ')).toBe(30.1);
  });
});

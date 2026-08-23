import { describe, it, expect } from 'vitest';
import { parseVnNumber, parseVndAmount } from './parseNumber';

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

describe('parseVndAmount — ô nhập số tiền VND', () => {
  it('đọc được cách người Việt viết: 3.000.000', () => {
    expect(parseVndAmount('3.000.000')).toBe(3_000_000);
  });

  it('đọc được cả dấu phẩy phân cách nghìn: 3,000,000', () => {
    expect(parseVndAmount('3,000,000')).toBe(3_000_000);
  });

  it('bỏ khoảng trắng và hậu tố đ', () => {
    expect(parseVndAmount(' 3 000 000 đ ')).toBe(3_000_000);
  });

  it('số trơn vẫn đọc được', () => {
    expect(parseVndAmount('3000000')).toBe(3_000_000);
  });

  it('chuỗi rỗng → null', () => {
    expect(parseVndAmount('')).toBeNull();
    expect(parseVndAmount('   ')).toBeNull();
  });

  it('không có chữ số nào → null, KHÔNG trả 0', () => {
    // "abc" thành 0 đồng thì người dùng tưởng đã lưu, thực ra lưu số sai.
    expect(parseVndAmount('abc')).toBeNull();
    expect(parseVndAmount('đ')).toBeNull();
  });

  it('số âm đọc ra số âm — để tầng trên từ chối với lý do đúng', () => {
    // KHÔNG nuốt dấu trừ ở đây: nếu bỏ dấu thì -5.000.000 lặng lẽ thành
    // 5.000.000 và được lưu. Trả số âm để guard tầng trên báo "không thể âm".
    expect(parseVndAmount('-5.000.000')).toBe(-5_000_000);
  });

  it('phần thập phân bị bỏ — đồng không có số lẻ', () => {
    expect(parseVndAmount('3.000.000,5')).toBe(3_000_000);
  });
});

import { describe, expect, test } from 'vitest';
import {
  CASH_CATEGORIES, danhMucTheoLoai, laVongTien, nhanDanhMuc,
} from './cashCategories';

describe('CASH_CATEGORIES — danh sách cố định', () => {
  test('có đủ các mục NewPL liệt kê', () => {
    expect(CASH_CATEGORIES.map((c) => c.key)).toEqual([
      'LUONG', 'THUONG', 'THU_KHAC',
      'TRA_NO_THE', 'DAO_HAN_THE', 'PHI_DAO_HAN', 'TRA_VAY', 'GIA_DINH', 'CHI_KHAC',
    ]);
  });

  test('không có khoá trùng', () => {
    const keys = CASH_CATEGORIES.map((c) => c.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('danhMucTheoLoai', () => {
  test('lọc đúng nhóm Thu', () => {
    expect(danhMucTheoLoai('THU').map((c) => c.key)).toEqual(['LUONG', 'THUONG', 'THU_KHAC']);
  });

  test('lọc đúng nhóm Chi', () => {
    expect(danhMucTheoLoai('CHI').map((c) => c.key)).toEqual([
      'TRA_NO_THE', 'DAO_HAN_THE', 'PHI_DAO_HAN', 'TRA_VAY', 'GIA_DINH', 'CHI_KHAC',
    ]);
  });
});

describe('laVongTien — đáo hạn thẻ là tiền ra rồi quay về', () => {
  test('đáo hạn thẻ LÀ vòng tiền', () => {
    expect(laVongTien('DAO_HAN_THE')).toBe(true);
  });

  test('PHÍ đáo hạn KHÔNG phải vòng tiền — đó là chi thật', () => {
    // Đáo hạn 50tr mất phí 1tr: 50tr quay về ví, 1tr mất hẳn.
    expect(laVongTien('PHI_DAO_HAN')).toBe(false);
  });

  test('trả nợ thẻ KHÔNG phải vòng tiền — tiền mất hẳn', () => {
    expect(laVongTien('TRA_NO_THE')).toBe(false);
  });

  test('khoá lạ coi như không phải vòng tiền', () => {
    // Thà tính nhầm vào tổng chi (thấy được, sửa được) còn hơn âm thầm loại ra.
    expect(laVongTien('KHONG_TON_TAI')).toBe(false);
  });

  test('không có mục THU nào là vòng tiền', () => {
    for (const c of danhMucTheoLoai('THU')) {
      expect(laVongTien(c.key)).toBe(false);
    }
  });
});

describe('nhanDanhMuc', () => {
  test('trả nhãn tiếng Việt của khoá', () => {
    expect(nhanDanhMuc('GIA_DINH')).toBe('Chi tiêu gia đình');
  });

  test('khoá lạ (danh mục cũ đã bỏ) hiện thẳng khoá, không trả chuỗi rỗng', () => {
    // Bản ghi cũ vẫn nằm trong DB sau khi đổi danh sách danh mục. Trả '' thì
    // dòng đó hiện trống trơn, người dùng không biết nó là khoản gì.
    expect(nhanDanhMuc('DANH_MUC_CU')).toBe('DANH_MUC_CU');
  });
});

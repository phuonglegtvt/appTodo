import { describe, expect, test } from 'vitest';
import {
  CASH_CATEGORIES, danhMucTheoLoai, laVongTien, nhanDanhMuc,
} from './cashCategories';

describe('CASH_CATEGORIES — danh sách cố định', () => {
  test('vẫn giữ mọi khoá cũ (bản ghi cũ phải hiện đúng tên)', () => {
    const keys = CASH_CATEGORIES.map((c) => c.key);
    for (const k of ['LUONG', 'THUONG', 'THU_KHAC', 'TRA_NO_THE', 'DAO_HAN_THE', 'PHI_DAO_HAN', 'TRA_VAY', 'GIA_DINH', 'CHI_KHAC']) {
      expect(keys).toContain(k);
    }
  });

  test('có danh mục chi tiêu chi tiết + chuyển sang đầu tư (thêm 2026-11-27)', () => {
    const keys = CASH_CATEGORIES.map((c) => c.key);
    for (const k of ['AN_UONG', 'NHA_CUA', 'DI_LAI', 'CON_CAI', 'SUC_KHOE', 'DAU_TU', 'CO_TUC_LAI']) expect(keys).toContain(k);
  });

  test('không có khoá trùng', () => {
    const keys = CASH_CATEGORIES.map((c) => c.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('danhMucTheoLoai', () => {
  test('lọc đúng nhóm: Thu chỉ có mục Thu, Chi chỉ có mục Chi', () => {
    expect(danhMucTheoLoai('THU').every((c) => c.kind === 'THU')).toBe(true);
    expect(danhMucTheoLoai('CHI').every((c) => c.kind === 'CHI')).toBe(true);
    expect(danhMucTheoLoai('THU').length + danhMucTheoLoai('CHI').length).toBe(CASH_CATEGORIES.length);
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

  test('bên THU chỉ có đúng một mục vòng tiền: tiền đáo hạn / vay quay về', () => {
    expect(danhMucTheoLoai('THU').filter((c) => laVongTien(c.key)).map((c) => c.key)).toEqual(['DAO_HAN_VE']);
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

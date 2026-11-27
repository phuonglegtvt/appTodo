// Danh mục thu/chi — CỐ ĐỊNH trong code, không có bảng DB riêng.
// Hàm THUẦN, không I/O.
//
// Vì sao không làm bảng `cash_categories`: thêm bảng là thêm một hook, một form
// quản lý, và ca "xoá danh mục đang có giao dịch". Danh sách này đổi vài năm
// một lần — sửa file là xong, không cần chạy migration.
//
// ⚠️ `cash_entries.category` là `text` tự do, nên bản ghi cũ có thể mang khoá
// không còn trong danh sách này. Mọi hàm dưới đây phải chịu được khoá lạ.

import type { CashKind } from '../types/cashEntry';

export interface CashCategory {
  key: string;
  label: string;
  kind: CashKind;
  /**
   * Tiền ra rồi QUAY VỀ ví, không mất đi (đáo hạn thẻ: vay chỗ khác trả thẻ,
   * rút thẻ trả lại chỗ vay). Vẫn ghi lại để theo dõi kỳ hạn, nhưng KHÔNG cộng
   * vào tổng chi — đáo hạn 50tr/tháng mà tính là chi thì con số chi tiêu phồng
   * lên gấp đôi và không còn nói lên điều gì.
   */
  laVongTien?: boolean;
  /**
   * Tiền chuyển sang tài khoản đầu tư / tiết kiệm. Không mất đi (vẫn là tài sản
   * của mình) nên KHÔNG cộng vào tổng chi tiêu, mà đếm riêng là "để dành" —
   * tính vào tỷ lệ tiết kiệm.
   */
  laDauTu?: boolean;
}

export const CASH_CATEGORIES: CashCategory[] = [
  { key: 'LUONG', label: 'Lương', kind: 'THU' },
  { key: 'THUONG', label: 'Thưởng', kind: 'THU' },
  { key: 'KINH_DOANH', label: 'Kinh doanh / làm thêm', kind: 'THU' },
  { key: 'CO_TUC_LAI', label: 'Cổ tức / lãi tiết kiệm', kind: 'THU' },
  { key: 'THU_KHAC', label: 'Thu khác', kind: 'THU' },
  // Chiều VỀ của vòng tiền: rút thẻ / vay ngắn hạn để đáo hạn, tiền về ví rồi
  // lại đi trả. Không phải thu nhập — cộng vào tổng thu sẽ làm "tỷ lệ tiết
  // kiệm" phồng lên vô nghĩa (thêm 2026-11-27).
  { key: 'DAO_HAN_VE', label: 'Tiền đáo hạn / vay quay về', kind: 'THU', laVongTien: true },

  // Chi tiêu sinh hoạt — thêm 2026-11-27 để biết tiền đi đâu (trước chỉ có
  // "Chi tiêu gia đình" / "Chi khác"). Khoá cũ giữ nguyên để bản ghi cũ đúng.
  { key: 'AN_UONG', label: 'Ăn uống', kind: 'CHI' },
  { key: 'NHA_CUA', label: 'Nhà cửa, điện nước, internet', kind: 'CHI' },
  { key: 'DI_LAI', label: 'Đi lại, xăng xe', kind: 'CHI' },
  { key: 'CON_CAI', label: 'Con cái, học hành', kind: 'CHI' },
  { key: 'SUC_KHOE', label: 'Sức khoẻ', kind: 'CHI' },
  { key: 'BAO_HIEM', label: 'Bảo hiểm', kind: 'CHI' },
  { key: 'MUA_SAM', label: 'Mua sắm', kind: 'CHI' },
  { key: 'GIAI_TRI', label: 'Giải trí, du lịch', kind: 'CHI' },
  { key: 'HIEU_HI', label: 'Hiếu hỉ, biếu tặng', kind: 'CHI' },

  { key: 'TRA_NO_THE', label: 'Trả nợ thẻ tín dụng', kind: 'CHI' },
  { key: 'DAO_HAN_THE', label: 'Đáo hạn thẻ', kind: 'CHI', laVongTien: true },
  // Tách khỏi 'DAO_HAN_THE': phần gốc quay về ví, riêng PHÍ thì mất hẳn nên là
  // chi thật. Một khoản đáo hạn có phí ghi thành HAI dòng.
  { key: 'PHI_DAO_HAN', label: 'Phí đáo hạn thẻ', kind: 'CHI' },
  { key: 'TRA_VAY', label: 'Trả nợ vay', kind: 'CHI' },
  { key: 'GIA_DINH', label: 'Chi tiêu gia đình', kind: 'CHI' },
  { key: 'CHI_KHAC', label: 'Chi khác', kind: 'CHI' },
  { key: 'DAU_TU', label: 'Chuyển sang đầu tư / tiết kiệm', kind: 'CHI', laDauTu: true },
];

const THEO_KHOA = new Map(CASH_CATEGORIES.map((c) => [c.key, c]));

export function danhMucTheoLoai(kind: CashKind): CashCategory[] {
  return CASH_CATEGORIES.filter((c) => c.kind === kind);
}

/**
 * Khoá lạ ⇒ `false`. Thà tính nhầm một khoản vào tổng chi (nhìn thấy được, sửa
 * được) còn hơn âm thầm loại nó ra khỏi tổng.
 */
export function laVongTien(key: string): boolean {
  return THEO_KHOA.get(key)?.laVongTien === true;
}

/** Khoá lạ ⇒ `false` (tính như chi thường — thấy được, sửa được). */
export function laDauTu(key: string): boolean {
  return THEO_KHOA.get(key)?.laDauTu === true;
}

/** Khoá lạ ⇒ hiện thẳng khoá. Trả chuỗi rỗng thì dòng đó trống trơn trên bảng. */
export function nhanDanhMuc(key: string): string {
  return THEO_KHOA.get(key)?.label ?? key;
}

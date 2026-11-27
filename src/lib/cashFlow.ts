// Tổng hợp thu–chi theo tháng — hàm THUẦN, không I/O, không gọi Date().
//
// Tháng viết dạng 'YYYY-MM'. Cộng trừ tháng làm bằng SỐ HỌC trên chuỗi, cố tình
// KHÔNG dùng `new Date()`: đối tượng Date diễn giải 'YYYY-MM-DD' theo UTC, với
// giờ VN (UTC+7) sẽ lệch một ngày và khoản ghi ngày 1 có thể rơi về tháng trước.
// Ở đây không có múi giờ nào can thiệp được.

import type { CashEntry } from '../types/cashEntry';
import { laDauTu, laVongTien } from './cashCategories';

export interface TongHopThang {
  /** Tổng thu trong kỳ (VND). */
  thu: number;
  /** Tổng chi THẬT — đã loại các khoản vòng tiền. */
  chi: number;
  /** Vòng tiền (đáo hạn thẻ) — cả chiều ra lẫn chiều về. Theo dõi riêng, không phải thu/chi. */
  vongTien: number;
  /** Tiền chuyển sang đầu tư / tiết kiệm — không phải chi tiêu, là để dành. */
  dauTu: number;
  /** thu − chi. KHÔNG trừ `vongTien`, KHÔNG trừ `dauTu` (đó vẫn là tiền của mình). */
  conLai: number;
  /**
   * Tỷ lệ tiết kiệm = (thu − chi) / thu, %. null khi tháng chưa có thu.
   * Tiền chuyển đi đầu tư nằm TRONG phần tiết kiệm này.
   */
  tyLeTietKiem: number | null;
}

/** '2026-09-13' → '2026-09'. */
export function thangCua(iso: string): string {
  return iso.slice(0, 7);
}

/** Tách 'YYYY-MM' thành số năm và số tháng (1–12). */
function tach(thang: string): { nam: number; thang: number } {
  return { nam: Number(thang.slice(0, 4)), thang: Number(thang.slice(5, 7)) };
}

/** Ghép lại thành 'YYYY-MM', tháng luôn 2 chữ số. */
function ghep(nam: number, thang: number): string {
  return `${nam}-${String(thang).padStart(2, '0')}`;
}

export function thangTruoc(thang: string): string {
  const t = tach(thang);
  return t.thang === 1 ? ghep(t.nam - 1, 12) : ghep(t.nam, t.thang - 1);
}

export function thangSau(thang: string): string {
  const t = tach(thang);
  return t.thang === 12 ? ghep(t.nam + 1, 1) : ghep(t.nam, t.thang + 1);
}

/** '2026-09' → 'Tháng 9/2026' (bỏ số 0 đứng đầu cho dễ đọc). */
export function nhanThang(thang: string): string {
  const t = tach(thang);
  return `Tháng ${t.thang}/${t.nam}`;
}

/**
 * So khớp cả năm lẫn tháng (`startsWith` trên 'YYYY-MM'), nên tháng 9 của năm
 * khác không lọt vào.
 */
export function locTheoThang(ds: CashEntry[], thang: string): CashEntry[] {
  return ds.filter((e) => thangCua(e.occurred_on) === thang);
}

/**
 * `amount_vnd` luôn dương (CHECK dưới DB), chiều tiền lấy từ `kind` — nên không
 * cần đoán dấu ở đây.
 *
 * `kind` đến từ DB nên vẫn tin được cả khi khoá danh mục đã bị bỏ khỏi code:
 * một khoản danh mục lạ vẫn vào đúng cột thu hoặc chi.
 */
export function tongHop(ds: CashEntry[]): TongHopThang {
  let thu = 0;
  let chi = 0;
  let vongTien = 0;
  let dauTu = 0;

  for (const e of ds) {
    if (e.kind === 'THU') {
      // Chiều VỀ của vòng tiền (đáo hạn) không phải thu nhập.
      if (laVongTien(e.category)) vongTien += e.amount_vnd;
      else thu += e.amount_vnd;
    } else if (laVongTien(e.category)) {
      vongTien += e.amount_vnd;
    } else if (laDauTu(e.category)) {
      dauTu += e.amount_vnd;
    } else {
      chi += e.amount_vnd;
    }
  }

  // KHÔNG trừ vongTien: tiền đó đã quay về ví. Trừ nó ra sẽ báo động giả "âm
  // tiền" mỗi tháng có đáo hạn thẻ.
  return { thu, chi, vongTien, dauTu, conLai: thu - chi, tyLeTietKiem: thu > 0 ? ((thu - chi) / thu) * 100 : null };
}

/**
 * Mới nhất lên đầu. Trả MẢNG MỚI — mảng gốc là state của React, `sort` sửa tại
 * chỗ sẽ sửa luôn state mà React không biết.
 *
 * Ngày dạng 'YYYY-MM-DD' so chuỗi trực tiếp cho đúng thứ tự thời gian, không
 * cần dựng Date.
 */
export function moiNhatTruoc(ds: CashEntry[]): CashEntry[] {
  return [...ds].sort((a, b) => b.occurred_on.localeCompare(a.occurred_on));
}

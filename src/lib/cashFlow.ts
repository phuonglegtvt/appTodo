// Tổng hợp thu–chi theo tháng — hàm THUẦN, không I/O, không gọi Date().
//
// Tháng viết dạng 'YYYY-MM'. Cộng trừ tháng làm bằng SỐ HỌC trên chuỗi, cố tình
// KHÔNG dùng `new Date()`: đối tượng Date diễn giải 'YYYY-MM-DD' theo UTC, với
// giờ VN (UTC+7) sẽ lệch một ngày và khoản ghi ngày 1 có thể rơi về tháng trước.
// Ở đây không có múi giờ nào can thiệp được.

import type { CashEntry } from '../types/cashEntry';
import { laVongTien } from './cashCategories';

export interface TongHopThang {
  /** Tổng thu trong kỳ (VND). */
  thu: number;
  /** Tổng chi THẬT — đã loại các khoản vòng tiền. */
  chi: number;
  /** Tiền ra rồi quay về ví (đáo hạn thẻ). Theo dõi riêng, không phải chi. */
  vongTien: number;
  /** thu − chi. KHÔNG trừ `vongTien`. */
  conLai: number;
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

  for (const e of ds) {
    if (e.kind === 'THU') {
      thu += e.amount_vnd;
    } else if (laVongTien(e.category)) {
      vongTien += e.amount_vnd;
    } else {
      chi += e.amount_vnd;
    }
  }

  // KHÔNG trừ vongTien: tiền đó đã quay về ví. Trừ nó ra sẽ báo động giả "âm
  // tiền" mỗi tháng có đáo hạn thẻ.
  return { thu, chi, vongTien, conLai: thu - chi };
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

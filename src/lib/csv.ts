// Xuất dữ liệu ra CSV (hàm thuần, có test). Dùng cho nút Sao lưu.
//
// - Cột lấy từ HỢP các khoá của mọi dòng, theo thứ tự xuất hiện — dòng thiếu
//   khoá thì ô trống, không lệch cột.
// - Ô có dấu phẩy / ngoặc kép / xuống dòng được bọc "…", ngoặc kép nhân đôi
//   (RFC 4180).
// - null/undefined → ô trống; object/array → JSON.
// - Thêm BOM UTF-8 khi tải để Excel mở đúng dấu tiếng Việt (không có BOM Excel
//   đọc thành Windows-1252 ⇒ "Tiá»n mặt").

export function oCsv(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: Record<string, unknown>[]): string {
  const cot: string[] = [];
  for (const r of rows) for (const k of Object.keys(r)) if (!cot.includes(k)) cot.push(k);
  const dong = [cot.map(oCsv).join(','), ...rows.map((r) => cot.map((k) => oCsv(r[k])).join(','))];
  return dong.join('\r\n');
}

export const BOM = '﻿';

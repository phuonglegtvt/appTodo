// Tự chèn dấu phẩy phân cách hàng nghìn KHI ĐANG GÕ số tiền VND:
//   gõ 8000   → "8,000";  gõ thêm 0 → "80,000";  800000 → "800,000".
//
// Chỉ dùng cho ô số tiền NGUYÊN (đồng): phần định dạng bỏ mọi ký tự không phải
// chữ số, nên ô có số thập phân (giá USD, số lượng coin, % …) KHÔNG được dùng.
// Đọc lại giá trị vẫn bằng `parseVndAmount` (src/lib/parseNumber.ts) — hàm đó
// đã chấp nhận "8,000,000".
//
// Con trỏ: đếm số CHỮ SỐ đứng trước con trỏ trước khi định dạng, rồi đặt con
// trỏ sau đúng ngần ấy chữ số trong chuỗi mới — gõ / xoá ở giữa số không làm
// con trỏ nhảy về cuối.

const NHOM = ',';

/** 1234567 → "1,234,567". null → "". */
export function dinhDangSoTien(n: number | null): string {
  if (n === null || !Number.isFinite(n)) return '';
  const am = n < 0;
  const chuSo = String(Math.trunc(Math.abs(n)));
  return (am ? '-' : '') + chuSo.replace(/\B(?=(\d{3})+(?!\d))/g, NHOM);
}

/**
 * Định dạng lại chuỗi đang gõ. `caret` = vị trí con trỏ trong `raw`.
 * Giữ dấu trừ ở đầu (để tầng kiểm tra từ chối số âm với đúng lý do, không
 * lặng lẽ biến -5,000 thành 5,000). Bỏ số 0 thừa ở đầu ("007" → "7").
 */
export function dinhDangKhiGo(raw: string, caret: number): { text: string; caret: number } {
  const am = raw.trimStart().startsWith('-');
  let soTruocConTro = (raw.slice(0, caret).match(/\d/g) ?? []).length;
  let chuSo = raw.replace(/\D/g, '');

  const soKhongDau = chuSo.length - chuSo.replace(/^0+(?=\d)/, '').length;
  chuSo = chuSo.slice(soKhongDau);
  soTruocConTro = Math.max(0, soTruocConTro - soKhongDau);

  const nhom = chuSo.replace(/\B(?=(\d{3})+(?!\d))/g, NHOM);
  const text = (am ? '-' : '') + nhom;

  // Đặt con trỏ sau chữ số thứ `soTruocConTro`.
  let pos = am ? 1 : 0;
  let dem = 0;
  while (pos < text.length && dem < soTruocConTro) {
    if (/\d/.test(text[pos])) dem++;
    pos++;
  }
  return { text, caret: pos };
}

/**
 * Gắn vào `onChange` của ô tiền: định dạng ngay trên ô (giữ con trỏ) rồi báo
 * chuỗi mới cho state nếu ô là controlled. Dùng được cả cho ô uncontrolled
 * (defaultValue + onBlur) — khi đó bỏ trống `setter`.
 */
export function nhapTien(setter?: (text: string) => void) {
  return (e: { target: HTMLInputElement }) => {
    const el = e.target;
    const { text, caret } = dinhDangKhiGo(el.value, el.selectionStart ?? el.value.length);
    if (el.value !== text) {
      el.value = text;
      // Chỉ đặt lại con trỏ khi ô đang được gõ (đặt khi không focus sẽ cướp focus ở Safari).
      if (typeof document !== 'undefined' && document.activeElement === el) el.setSelectionRange(caret, caret);
    }
    setter?.(text);
  };
}

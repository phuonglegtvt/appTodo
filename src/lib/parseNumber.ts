/** Chuỗi rỗng → null; ngược lại parse số (chấp nhận dấu phẩy thập phân kiểu VN). */
export function parseVnNumber(v: string): number | null {
  const t = v.trim().replace(',', '.');
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

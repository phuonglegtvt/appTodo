// Lấy tỷ giá USD→VND gọi trực tiếp từ trình duyệt (Phase 1: không server tự viết).
// Nguồn: open.er-api.com (miễn phí, không cần key, CORS mở).
// Lỗi mạng/CORS/HTTP/shape → NÉM lỗi rõ để trang hiện ErrorBanner, KHÔNG nuốt.

/**
 * Trích tỷ giá VND từ response open.er-api.com: { result: 'success', rates: { VND: ... } }.
 * result != 'success' / thiếu VND / không dương → NÉM lỗi rõ.
 */
export function parseUsdVndRate(json: unknown): number {
  if (!json || typeof json !== 'object') {
    throw new Error('Dữ liệu tỷ giá không đúng định dạng (mong đợi một đối tượng).');
  }
  const obj = json as Record<string, unknown>;
  if (obj.result !== 'success') {
    throw new Error(`Nguồn tỷ giá trả trạng thái không hợp lệ: ${String(obj.result)}`);
  }
  const rates = obj.rates;
  const vnd =
    rates && typeof rates === 'object' ? (rates as Record<string, unknown>).VND : undefined;
  const n = typeof vnd === 'number' ? vnd : NaN;
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error('Nguồn tỷ giá thiếu VND hợp lệ.');
  }
  return n;
}

/** Lấy tỷ giá USD→VND. Ném lỗi rõ khi mạng/CORS/HTTP/shape lỗi. */
export async function fetchUsdVndRate(): Promise<number> {
  const res = await fetch('https://open.er-api.com/v6/latest/USD');
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  const body: unknown = await res.json();
  return parseUsdVndRate(body);
}

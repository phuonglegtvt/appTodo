// Lấy giá cổ phiếu VN gọi trực tiếp từ trình duyệt (Phase 1: không server tự viết).
// Nguồn ứng viên: TCBS (apipubaws.tcbs.com.vn) — endpoint công khai cộng đồng hay dùng.
// CORS là rủi ro thật: nếu bị chặn / đổi shape, các hàm ở đây NÉM LỖI rõ ràng để
// trang hiện ErrorBanner, KHÔNG nuốt lỗi. Người dùng vẫn nhập giá tay được.

/** Chuẩn hóa response nguồn giá về map ticker (viết hoa) → giá (nghìn đồng). */
export function parsePriceResponse(json: unknown): Record<string, number> {
  if (!Array.isArray(json)) {
    throw new Error('Dữ liệu giá không đúng định dạng (mong đợi một mảng).');
  }
  const out: Record<string, number> = {};
  for (const item of json) {
    if (item && typeof item === 'object') {
      const ticker = (item as Record<string, unknown>).ticker;
      const price = (item as Record<string, unknown>).price;
      if (typeof ticker === 'string' && typeof price === 'number' && Number.isFinite(price)) {
        out[ticker.toUpperCase()] = price;
      }
    }
  }
  return out;
}

/**
 * Lấy giá hiện tại cho danh sách mã. Trả map ticker → giá (nghìn đồng).
 * Ném lỗi rõ ràng khi mạng/CORS/nguồn đổi shape (không fallback im lặng).
 */
export async function fetchPrices(tickers: string[]): Promise<Record<string, number>> {
  const symbols = tickers.map((t) => t.trim().toUpperCase()).filter(Boolean);
  if (symbols.length === 0) return {};

  // TCBS: một request/mã. Gom song song. Nếu endpoint/shape đổi, việc parse sẽ ném lỗi.
  const results = await Promise.all(
    symbols.map(async (sym) => {
      const url = `https://apipubaws.tcbs.com.vn/stock-insight/v1/stock/second-tc-price?tickers=${sym}`;
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Lỗi lấy giá ${sym}: HTTP ${res.status}`);
      }
      const body = await res.json();
      // TCBS bọc dữ liệu trong { data: [...] }. Tùy nguồn, có thể là mảng thẳng.
      const arr = Array.isArray(body) ? body : (body?.data ?? body);
      return parsePriceResponse(arr);
    }),
  );

  return Object.assign({}, ...results);
}

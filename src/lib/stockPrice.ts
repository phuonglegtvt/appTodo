// Lấy giá cổ phiếu VN gọi trực tiếp từ trình duyệt (Phase 1: không server tự viết).
// Nguồn: VNDirect dchart (dchart-api.vndirect.com.vn) — API lịch sử nến dạng
// TradingView UDF, công khai. (TCBS apipubaws/stock-insight đã ngừng phục vụ — 404.)
// CORS là rủi ro thật: nếu bị chặn / đổi shape, các hàm ở đây NÉM LỖI rõ ràng để
// trang hiện ErrorBanner, KHÔNG nuốt lỗi. Người dùng vẫn nhập giá tay được.

/**
 * Trích giá đóng cửa MỚI NHẤT (nghìn đồng) từ một response dchart (UDF history).
 * - `s === 'no_data'`: mã hợp lệ nhưng không có nến trong khoảng → trả null (không phải lỗi).
 * - `s === 'ok'`: lấy phần tử cuối của mảng `c`.
 * - Ngược lại (không phải object, thiếu/không hợp lệ `s`): NÉM lỗi (nguồn đổi shape).
 */
export function parseLatestClose(json: unknown): number | null {
  if (!json || typeof json !== 'object') {
    throw new Error('Dữ liệu giá không đúng định dạng (mong đợi một đối tượng).');
  }
  const obj = json as Record<string, unknown>;
  if (obj.s === 'no_data') return null;
  if (obj.s !== 'ok') {
    throw new Error(`Nguồn giá trả trạng thái không hợp lệ: ${String(obj.s)}`);
  }
  const closes = obj.c;
  if (!Array.isArray(closes) || closes.length === 0) return null;
  const last = closes[closes.length - 1];
  return typeof last === 'number' && Number.isFinite(last) ? last : null;
}

/**
 * Lấy giá hiện tại cho danh sách mã. Trả map ticker (viết hoa) → giá (nghìn đồng).
 * Một request/mã tới dchart, gom song song. Mã không có dữ liệu (no_data) bị bỏ khỏi map.
 * Ném lỗi rõ ràng khi mạng/CORS/HTTP lỗi/nguồn đổi shape (không fallback im lặng).
 */
export async function fetchPrices(tickers: string[]): Promise<Record<string, number>> {
  const symbols = tickers.map((t) => t.trim().toUpperCase()).filter(Boolean);
  if (symbols.length === 0) return {};

  // Cửa sổ ~15 ngày gần nhất để chắc chắn có ít nhất một phiên (trừ cuối tuần/lễ).
  const to = Math.floor(Date.now() / 1000);
  const from = to - 15 * 24 * 60 * 60;

  const entries = await Promise.all(
    symbols.map(async (sym) => {
      const url = `https://dchart-api.vndirect.com.vn/dchart/history?symbol=${sym}&resolution=D&from=${from}&to=${to}`;
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Lỗi lấy giá ${sym}: HTTP ${res.status}`);
      }
      const body: unknown = await res.json();
      const close = parseLatestClose(body);
      return [sym, close] as const;
    }),
  );

  const out: Record<string, number> = {};
  for (const [sym, close] of entries) {
    if (close != null) out[sym] = close;
  }
  return out;
}

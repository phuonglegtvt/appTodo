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

/** Kết quả lấy giá: giá lấy được + danh sách mã lỗi (kèm lý do) để báo rõ, không nuốt. */
export interface FetchPricesResult {
  /** Map ticker (viết hoa) → giá (nghìn đồng). Chỉ chứa mã lấy được giá. */
  prices: Record<string, number>;
  /** Các mã lỗi (mạng/CORS/HTTP/nguồn đổi shape) kèm lý do, để hiện cho người dùng. */
  failed: { ticker: string; message: string }[];
}

/** Lấy giá đóng cửa mới nhất cho một mã. Ném lỗi rõ ràng khi mạng/CORS/HTTP/shape lỗi. */
async function fetchOnePrice(sym: string, from: number, to: number): Promise<number | null> {
  const url = `https://dchart-api.vndirect.com.vn/dchart/history?symbol=${sym}&resolution=D&from=${from}&to=${to}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  const body: unknown = await res.json();
  return parseLatestClose(body);
}

/**
 * Lấy giá hiện tại cho danh sách mã. Gom song song, mỗi mã một request tới dchart.
 * Dùng `Promise.allSettled`: một mã lỗi KHÔNG làm hỏng cả lần cập nhật — các mã còn lại
 * vẫn được cập nhật, mã lỗi được gom vào `failed` để báo rõ (không nuốt lỗi).
 * Mã không có dữ liệu (no_data) bị bỏ khỏi `prices` nhưng KHÔNG tính là lỗi.
 */
export async function fetchPrices(tickers: string[]): Promise<FetchPricesResult> {
  const symbols = tickers.map((t) => t.trim().toUpperCase()).filter(Boolean);
  if (symbols.length === 0) return { prices: {}, failed: [] };

  // Cửa sổ ~15 ngày gần nhất để chắc chắn có ít nhất một phiên (trừ cuối tuần/lễ).
  const to = Math.floor(Date.now() / 1000);
  const from = to - 15 * 24 * 60 * 60;

  const settled = await Promise.allSettled(
    symbols.map((sym) => fetchOnePrice(sym, from, to)),
  );

  const prices: Record<string, number> = {};
  const failed: { ticker: string; message: string }[] = [];
  settled.forEach((result, i) => {
    const sym = symbols[i];
    if (result.status === 'fulfilled') {
      if (result.value != null) prices[sym] = result.value;
    } else {
      const reason = result.reason;
      failed.push({ ticker: sym, message: reason instanceof Error ? reason.message : String(reason) });
    }
  });
  return { prices, failed };
}

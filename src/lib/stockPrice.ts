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

// ---------------------------------------------------------------------------
// ĐỈNH LỊCH SỬ
// ---------------------------------------------------------------------------
// Dùng CÙNG endpoint dchart nhưng `resolution=M&from=0`: nến THÁNG từ mốc thời
// gian 0 ⇒ trải hết lịch sử mà payload chỉ vài trăm phần tử (nến ngày sẽ là vài
// nghìn, nhân 62 mã là quá nặng cho một lần bấm nút). Đỉnh của nến tháng bằng
// đúng đỉnh của nến ngày trong cùng khoảng, nên không mất chính xác.
//
// ⚠️ GIỚI HẠN PHẢI BIẾT: đây là "đỉnh trong dữ liệu dchart đang có" — KHÔNG đảm
// bảo đã điều chỉnh chia tách/cổ tức, cũng không đảm bảo có đủ lịch sử từ ngày
// lên sàn. Vì thế cột `peak_price` vẫn cho sửa tay, và mọi đường ghi phải đi qua
// `nextPeak` (lib/peakDrawdown.ts) để một lần lấy sai không đạp đỉnh thật xuống.

/**
 * Trích giá CAO NHẤT (nghìn đồng) từ một response dchart: `max` của mảng `h`.
 * Cùng luật đọc `s` như parseLatestClose: `no_data` → null, `s` lạ → NÉM lỗi.
 * Phần tử không phải số hữu hạn bị bỏ qua; không còn phần tử nào → null (KHÔNG
 * trả 0 hay -Infinity — "không biết đỉnh" khác hẳn "đỉnh là 0").
 */
export function parseMaxHigh(json: unknown): number | null {
  if (!json || typeof json !== 'object') {
    throw new Error('Dữ liệu giá không đúng định dạng (mong đợi một đối tượng).');
  }
  const obj = json as Record<string, unknown>;
  if (obj.s === 'no_data') return null;
  if (obj.s !== 'ok') {
    throw new Error(`Nguồn giá trả trạng thái không hợp lệ: ${String(obj.s)}`);
  }
  const highs = obj.h;
  if (!Array.isArray(highs)) return null;
  const so = highs.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  return so.length === 0 ? null : Math.max(...so);
}

/** Giá hiện tại + đỉnh lịch sử của một mã, đều theo NGHÌN ĐỒNG. */
export interface StockQuote {
  /** Giá đóng cửa phiên gần nhất. `null` = mã không có dữ liệu (no_data). */
  priceVnd: number | null;
  /** Đỉnh lịch sử trong dữ liệu dchart. `null` = không có nến nào. */
  peakVnd: number | null;
}

/** Kết quả một lượt lấy số: mã lấy được + mã lỗi kèm lý do (không nuốt). */
export interface FetchQuotesResult {
  /** Map ticker (viết hoa) → giá & đỉnh. Chỉ chứa mã gọi thành công. */
  quotes: Record<string, StockQuote>;
  failed: { ticker: string; message: string }[];
}

/**
 * Một request lịch sử đầy đủ cho một mã, rút ra CẢ giá hiện tại lẫn đỉnh.
 *
 * Vì sao gộp thay vì hai hàm riêng: response `resolution=D&from=0` đã chứa cả hai
 * — `c` phần tử cuối là giá đóng cửa phiên gần nhất (đã đối chiếu với số đang
 * hiện trên app: ACB = 22,75), `max(h)` là đỉnh. Gọi tách ra thành hai lượt là
 * 124 request thay vì 62 mà không lấy thêm được thông tin nào.
 */
async function fetchOneQuote(sym: string, to: number): Promise<StockQuote> {
  const url = `https://dchart-api.vndirect.com.vn/dchart/history?symbol=${sym}&resolution=D&from=0&to=${to}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  // Ném lỗi nếu body không phải JSON — dchart trả TEXT "Not support resolution M"
  // kèm HTTP 200 khi tham số sai, đúng kiểu lỗi im lặng cần lộ ra ngay.
  const body: unknown = await res.json();
  return { priceVnd: parseLatestClose(body), peakVnd: parseMaxHigh(body) };
}

/**
 * Lấy giá + đỉnh cho danh sách mã. `Promise.allSettled`: một mã lỗi KHÔNG làm
 * hỏng cả lần cập nhật, mã lỗi gom vào `failed` để báo rõ.
 *
 * ⚠️ CHI PHÍ MẠNG: mỗi mã ~170 KB (toàn bộ lịch sử ngày từ 2013). 62 mã ≈ 10 MB
 * mỗi lần bấm "Cập nhật giá". Không tránh được nếu muốn đỉnh THẬT: dchart chỉ hỗ
 * trợ `resolution=D` (M và W đều trả "Not support resolution"), và không có
 * endpoint nào trả sẵn đỉnh.
 */
export async function fetchQuotes(tickers: string[]): Promise<FetchQuotesResult> {
  const symbols = tickers.map((t) => t.trim().toUpperCase()).filter(Boolean);
  if (symbols.length === 0) return { quotes: {}, failed: [] };

  const to = Math.floor(Date.now() / 1000);
  const settled = await Promise.allSettled(symbols.map((sym) => fetchOneQuote(sym, to)));

  const quotes: Record<string, StockQuote> = {};
  const failed: { ticker: string; message: string }[] = [];
  settled.forEach((result, i) => {
    const sym = symbols[i];
    if (result.status === 'fulfilled') {
      quotes[sym] = result.value;
    } else {
      const reason = result.reason;
      failed.push({ ticker: sym, message: reason instanceof Error ? reason.message : String(reason) });
    }
  });
  return { quotes, failed };
}

// Lấy giá crypto gọi trực tiếp từ trình duyệt (Phase 1: không server tự viết).
// Nguồn: Binance public ticker (api.binance.com/api/v3/ticker/price) — CORS mở, trả USDT (≈USD).
// CORS/HTTP lỗi → NÉM lỗi rõ để trang hiện ErrorBanner, KHÔNG nuốt. Người dùng vẫn nhập giá tay được.

/**
 * Trích giá (USD) từ một response ticker của Binance: { symbol, price }.
 * price có thể là chuỗi ("64832.10") hoặc số. Sai shape / không hữu hạn → NÉM lỗi.
 */
export function parseTickerPrice(json: unknown): number {
  if (!json || typeof json !== 'object') {
    throw new Error('Dữ liệu giá không đúng định dạng (mong đợi một đối tượng).');
  }
  const raw = (json as Record<string, unknown>).price;
  const n = typeof raw === 'string' || typeof raw === 'number' ? Number(raw) : NaN;
  if (!Number.isFinite(n)) {
    throw new Error('Nguồn giá trả giá không hợp lệ.');
  }
  return n;
}

/** Kết quả lấy giá: giá lấy được + danh sách coin lỗi (kèm lý do) để báo rõ, không nuốt. */
export interface FetchCryptoPricesResult {
  /** Map symbol (viết hoa, VD BTC) → giá USD. Chỉ chứa coin lấy được giá. */
  prices: Record<string, number>;
  /** Các coin lỗi (mã sai/mạng/CORS/HTTP/shape) kèm lý do. */
  failed: { symbol: string; message: string }[];
}

/** Lấy giá USD cho một coin: ghép symbol + 'USDT'. Ném lỗi rõ khi HTTP/CORS/shape lỗi. */
async function fetchOnePrice(symbol: string): Promise<number> {
  const url = `https://api.binance.com/api/v3/ticker/price?symbol=${symbol}USDT`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  const body: unknown = await res.json();
  return parseTickerPrice(body);
}

/**
 * Lấy giá hiện tại (USD) cho danh sách coin. Mỗi coin một request tới Binance, gom song song.
 * Dùng `Promise.allSettled`: một coin lỗi (VD mã không có trên Binance → HTTP 400) KHÔNG làm
 * hỏng cả lần — các coin còn lại vẫn cập nhật, coin lỗi gom vào `failed` để báo rõ (không nuốt).
 */
export async function fetchCryptoPrices(symbols: string[]): Promise<FetchCryptoPricesResult> {
  const syms = symbols.map((s) => s.trim().toUpperCase()).filter(Boolean);
  if (syms.length === 0) return { prices: {}, failed: [] };

  const settled = await Promise.allSettled(syms.map((s) => fetchOnePrice(s)));

  const prices: Record<string, number> = {};
  const failed: { symbol: string; message: string }[] = [];
  settled.forEach((result, i) => {
    const sym = syms[i];
    if (result.status === 'fulfilled') {
      prices[sym] = result.value;
    } else {
      const reason = result.reason;
      failed.push({ symbol: sym, message: reason instanceof Error ? reason.message : String(reason) });
    }
  });
  return { prices, failed };
}

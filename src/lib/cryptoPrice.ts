// Lấy giá crypto gọi trực tiếp từ trình duyệt (Phase 1: không server tự viết).
// Nguồn CHÍNH: Binance public ticker (api.binance.com/api/v3/ticker/price) — CORS mở, trả USDT (≈USD).
// Nguồn DỰ PHÒNG: CoinGecko (api.coingecko.com/api/v3/coins/markets) — CORS mở (*), tra theo symbol —
//   dùng cho coin không niêm yết trên Binance (VD OKB, BGB → Binance trả HTTP 400).
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

/**
 * Trích map { SYMBOL(hoa) → giá USD } từ response CoinGecko /coins/markets:
 * mảng [{ symbol, current_price }, ...]. Bỏ qua phần tử thiếu symbol / giá không hữu hạn.
 * Sai shape (không phải mảng) → NÉM lỗi rõ để không nuốt.
 */
export function parseCoinGeckoMarkets(json: unknown): Record<string, number> {
  if (!Array.isArray(json)) {
    throw new Error('Dữ liệu giá dự phòng không đúng định dạng (mong đợi một mảng).');
  }
  const out: Record<string, number> = {};
  for (const item of json) {
    if (!item || typeof item !== 'object') continue;
    const rec = item as Record<string, unknown>;
    const sym = typeof rec.symbol === 'string' ? rec.symbol.trim().toUpperCase() : '';
    const price = typeof rec.current_price === 'number' ? rec.current_price : NaN;
    // Nhiều coin có thể trùng symbol; giữ phần tử đầu tiên (CoinGecko xếp theo market cap giảm dần).
    if (sym && Number.isFinite(price) && !(sym in out)) {
      out[sym] = price;
    }
  }
  return out;
}

/** Kết quả lấy giá: giá lấy được + danh sách coin lỗi (kèm lý do) để báo rõ, không nuốt. */
export interface FetchCryptoPricesResult {
  /** Map symbol (viết hoa, VD BTC) → giá USD. Chỉ chứa coin lấy được giá. */
  prices: Record<string, number>;
  /** Các coin lỗi (mã sai/mạng/CORS/HTTP/shape) kèm lý do. */
  failed: { symbol: string; message: string }[];
}

/** Lấy giá USD cho một coin từ Binance: ghép symbol + 'USDT'. Ném lỗi rõ khi HTTP/CORS/shape lỗi. */
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
 * Nguồn DỰ PHÒNG: lấy giá cho các symbol từ CoinGecko trong MỘT request (tra theo symbol).
 * Trả map { SYMBOL(hoa) → giá USD }; coin không có trên CoinGecko đơn giản là vắng mặt trong map.
 * Ném lỗi rõ khi HTTP/CORS/shape lỗi (để coin gọi biết cả cụm dự phòng đã hỏng).
 */
async function fetchCoinGeckoPrices(symbols: string[]): Promise<Record<string, number>> {
  const csv = symbols.map((s) => s.toLowerCase()).join(',');
  const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&symbols=${csv}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  const body: unknown = await res.json();
  return parseCoinGeckoMarkets(body);
}

/**
 * Lấy giá hiện tại (USD) cho danh sách coin. Mỗi coin một request tới Binance, gom song song.
 * Dùng `Promise.allSettled`: một coin lỗi (VD mã không có trên Binance → HTTP 400) KHÔNG làm
 * hỏng cả lần — các coin còn lại vẫn cập nhật.
 *
 * Coin Binance không có (OKB, BGB...) được thử lại QUA CoinGecko trong một request gộp. Chỉ coin
 * cả hai nguồn đều không có mới rơi vào `failed` để báo rõ (không nuốt) — người dùng nhập giá tay.
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

  // Nguồn dự phòng cho các coin Binance không lấy được: gọi CoinGecko một lần, gộp giá tìm thấy.
  if (failed.length > 0) {
    try {
      const fallback = await fetchCoinGeckoPrices(failed.map((f) => f.symbol));
      const stillFailed: { symbol: string; message: string }[] = [];
      for (const f of failed) {
        const price = fallback[f.symbol];
        if (Number.isFinite(price)) {
          prices[f.symbol] = price;
        } else {
          stillFailed.push(f);
        }
      }
      failed.length = 0;
      failed.push(...stillFailed);
    } catch {
      // CoinGecko hỏng (mạng/CORS/HTTP): giữ nguyên `failed` từ Binance — vẫn báo rõ, không nuốt.
    }
  }

  return { prices, failed };
}

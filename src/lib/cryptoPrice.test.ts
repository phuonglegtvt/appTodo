import { describe, it, expect, vi, afterEach } from 'vitest';
import { parseTickerPrice, parseCoinGeckoMarkets, fetchCryptoPrices } from './cryptoPrice';

function okJson(json: unknown): Response {
  return { ok: true, status: 200, json: async () => json } as Response;
}

function isBinance(url: string): boolean {
  return url.includes('api.binance.com');
}

describe('parseTickerPrice', () => {
  it('lấy price dạng chuỗi (kiểu Binance) → số', () => {
    expect(parseTickerPrice({ symbol: 'BTCUSDT', price: '64832.10' })).toBeCloseTo(64832.1);
  });
  it('chấp nhận price dạng số', () => {
    expect(parseTickerPrice({ symbol: 'ETHUSDT', price: 3200 })).toBe(3200);
  });
  it('ném lỗi khi không phải object', () => {
    expect(() => parseTickerPrice('oops')).toThrow(/không đúng định dạng/i);
  });
  it('ném lỗi khi price không phải số hữu hạn', () => {
    expect(() => parseTickerPrice({ symbol: 'X', price: 'abc' })).toThrow(/không hợp lệ/i);
  });
});

describe('parseCoinGeckoMarkets', () => {
  it('lấy map symbol(hoa) → current_price', () => {
    const json = [
      { symbol: 'okb', current_price: 79.69 },
      { symbol: 'bgb', current_price: 1.59 },
    ];
    expect(parseCoinGeckoMarkets(json)).toEqual({ OKB: 79.69, BGB: 1.59 });
  });
  it('bỏ qua phần tử thiếu symbol / giá không hữu hạn', () => {
    const json = [
      { symbol: 'okb', current_price: 79.69 },
      { current_price: 5 },
      { symbol: 'bad', current_price: null },
    ];
    expect(parseCoinGeckoMarkets(json)).toEqual({ OKB: 79.69 });
  });
  it('trùng symbol → giữ phần tử đầu (theo market cap)', () => {
    const json = [
      { symbol: 'okb', current_price: 79.69 },
      { symbol: 'okb', current_price: 0.01 },
    ];
    expect(parseCoinGeckoMarkets(json)).toEqual({ OKB: 79.69 });
  });
  it('ném lỗi khi không phải mảng', () => {
    expect(() => parseCoinGeckoMarkets({ nope: true })).toThrow(/không đúng định dạng/i);
  });
});

describe('fetchCryptoPrices (Promise.allSettled)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('danh sách rỗng → không gọi mạng, trả kết quả rỗng', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const result = await fetchCryptoPrices([]);
    expect(result).toEqual({ prices: {}, failed: [] });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('ghép USDT + chuẩn hóa hoa; coin không có trên Binance được CoinGecko vá', async () => {
    // OKB lỗi trên Binance (HTTP 400) nhưng có trên CoinGecko → cuối cùng lấy được giá, không còn failed.
    const fetchMock = vi.fn(async (url: string) => {
      if (isBinance(url)) {
        if (url.includes('symbol=BTCUSDT')) return okJson({ symbol: 'BTCUSDT', price: '64000' });
        return { ok: false, status: 400 } as Response;
      }
      // CoinGecko fallback
      return okJson([{ symbol: 'okb', current_price: 79.69 }]);
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchCryptoPrices(['btc', 'okb']);
    expect(result.prices).toEqual({ BTC: 64000, OKB: 79.69 });
    expect(result.failed).toEqual([]);
  });

  it('coin cả Binance lẫn CoinGecko đều không có → rơi vào failed (không nuốt)', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (isBinance(url)) return { ok: false, status: 400 } as Response;
      return okJson([]); // CoinGecko không có coin nào
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchCryptoPrices(['zzz']);
    expect(result.prices).toEqual({});
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0].symbol).toBe('ZZZ');
    expect(result.failed[0].message).toMatch(/400/);
  });

  it('CoinGecko cũng hỏng (mạng) → giữ nguyên failed từ Binance, không nuốt lỗi', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (isBinance(url)) return { ok: false, status: 400 } as Response;
      throw new Error('Failed to fetch'); // CoinGecko rớt mạng
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchCryptoPrices(['okb']);
    expect(result.prices).toEqual({});
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0].symbol).toBe('OKB');
  });

  it('mọi coin có trên Binance → KHÔNG gọi CoinGecko', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (isBinance(url)) return okJson({ symbol: 'BTCUSDT', price: '64000' });
      throw new Error('không nên gọi CoinGecko');
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchCryptoPrices(['btc']);
    expect(result.prices).toEqual({ BTC: 64000 });
    expect(result.failed).toEqual([]);
    // Chỉ có đúng 1 request (Binance), không có request dự phòng.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

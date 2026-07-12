import { describe, it, expect, vi, afterEach } from 'vitest';
import { parseTickerPrice, fetchCryptoPrices } from './cryptoPrice';

function okJson(json: unknown): Response {
  return { ok: true, status: 200, json: async () => json } as Response;
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

  it('ghép USDT + chuẩn hóa hoa; một coin lỗi không làm hỏng cả lần', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('symbol=BTCUSDT')) return okJson({ symbol: 'BTCUSDT', price: '64000' });
      if (url.includes('symbol=DOGEUSDT')) return { ok: false, status: 400 } as Response;
      throw new Error('không mong đợi');
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchCryptoPrices(['btc', 'doge']);
    expect(result.prices).toEqual({ BTC: 64000 });
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0].symbol).toBe('DOGE');
    expect(result.failed[0].message).toMatch(/400/);
  });
});

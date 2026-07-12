import { describe, it, expect, vi, afterEach } from 'vitest';
import { parseUsdVndRate, fetchUsdVndRate } from './fxRate';

function okJson(json: unknown): Response {
  return { ok: true, status: 200, json: async () => json } as Response;
}

describe('parseUsdVndRate', () => {
  it('result=success + rates.VND hợp lệ → trả tỷ giá', () => {
    expect(parseUsdVndRate({ result: 'success', rates: { VND: 26000, EUR: 0.9 } })).toBe(26000);
  });
  it('ném lỗi khi result != success', () => {
    expect(() => parseUsdVndRate({ result: 'error', rates: { VND: 26000 } })).toThrow(/trạng thái không hợp lệ/i);
  });
  it('ném lỗi khi thiếu VND', () => {
    expect(() => parseUsdVndRate({ result: 'success', rates: { EUR: 0.9 } })).toThrow(/VND/i);
  });
  it('ném lỗi khi không phải object', () => {
    expect(() => parseUsdVndRate(null)).toThrow(/không đúng định dạng/i);
  });
});

describe('fetchUsdVndRate', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fetch OK → trả tỷ giá', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => okJson({ result: 'success', rates: { VND: 25500 } })));
    await expect(fetchUsdVndRate()).resolves.toBe(25500);
  });

  it('HTTP lỗi → ném lỗi kèm status', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 503 }) as Response));
    await expect(fetchUsdVndRate()).rejects.toThrow(/503/);
  });
});

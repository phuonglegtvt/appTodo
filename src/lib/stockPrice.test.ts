import { describe, it, expect, vi, afterEach } from 'vitest';
import { parseLatestClose, fetchPrices } from './stockPrice';

/** Giả lập một response fetch thành công với JSON cho trước. */
function okJson(json: unknown): Response {
  return { ok: true, status: 200, json: async () => json } as Response;
}

describe('parseLatestClose', () => {
  it('s=ok: lấy giá đóng cửa cuối cùng của mảng c (nghìn đồng)', () => {
    expect(parseLatestClose({ s: 'ok', c: [17.349, 17.313, 17.457] })).toBe(17.457);
  });

  it('s=ok với 1 phần tử', () => {
    expect(parseLatestClose({ s: 'ok', c: [30.1] })).toBe(30.1);
  });

  it('s=no_data: mã hợp lệ nhưng không có nến → null (không phải lỗi)', () => {
    expect(parseLatestClose({ s: 'no_data' })).toBeNull();
  });

  it('s=ok nhưng mảng c rỗng → null', () => {
    expect(parseLatestClose({ s: 'ok', c: [] })).toBeNull();
  });

  it('s=ok nhưng giá cuối không phải số hữu hạn → null', () => {
    expect(parseLatestClose({ s: 'ok', c: [17.3, null] })).toBeNull();
  });

  it('ném lỗi khi không phải object (nguồn đổi shape)', () => {
    expect(() => parseLatestClose('oops')).toThrow(/không đúng định dạng/i);
  });

  it('ném lỗi khi trạng thái s không hợp lệ', () => {
    expect(() => parseLatestClose({ s: 'error', c: [1] })).toThrow(/trạng thái không hợp lệ/i);
  });
});

describe('fetchPrices (Promise.allSettled)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('danh sách rỗng → không gọi mạng, trả kết quả rỗng', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const result = await fetchPrices([]);
    expect(result).toEqual({ prices: {}, failed: [] });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('một mã lỗi KHÔNG làm hỏng cả lần: mã còn lại vẫn có giá, mã lỗi vào failed', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('symbol=ACB')) return okJson({ s: 'ok', c: [30.1] });
      if (url.includes('symbol=FPT')) return { ok: false, status: 500 } as Response;
      throw new Error('không mong đợi');
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchPrices(['acb', 'fpt']);
    expect(result.prices).toEqual({ ACB: 30.1 });
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0].ticker).toBe('FPT');
    expect(result.failed[0].message).toMatch(/500/);
  });

  it('mã no_data bị bỏ khỏi prices nhưng KHÔNG tính là lỗi', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => okJson({ s: 'no_data' })));
    const result = await fetchPrices(['xyz']);
    expect(result.prices).toEqual({});
    expect(result.failed).toEqual([]);
  });
});

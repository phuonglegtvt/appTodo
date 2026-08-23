import { describe, it, expect, vi, afterEach } from 'vitest';
import { parseLatestClose, parseMaxHigh, fetchPrices, fetchPeaks } from './stockPrice';

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

describe('parseMaxHigh', () => {
  it('s=ok: lấy giá cao nhất trong mảng h (nghìn đồng)', () => {
    expect(parseMaxHigh({ s: 'ok', h: [30.1, 44.5, 22.7] })).toBe(44.5);
  });

  it('s=no_data: mã hợp lệ nhưng không có nến → null (không phải lỗi)', () => {
    expect(parseMaxHigh({ s: 'no_data' })).toBeNull();
  });

  it('s=ok nhưng mảng h rỗng → null', () => {
    expect(parseMaxHigh({ s: 'ok', h: [] })).toBeNull();
  });

  it('bỏ qua phần tử không phải số hữu hạn, vẫn lấy được max của phần còn lại', () => {
    expect(parseMaxHigh({ s: 'ok', h: [30.1, null, 'x', 44.5] })).toBe(44.5);
  });

  it('mọi phần tử đều rác → null, KHÔNG trả 0 hay -Infinity', () => {
    expect(parseMaxHigh({ s: 'ok', h: [null, 'x'] })).toBeNull();
  });

  it('thiếu mảng h → null', () => {
    expect(parseMaxHigh({ s: 'ok' })).toBeNull();
  });

  it('ném lỗi khi s không hợp lệ (nguồn đổi shape)', () => {
    expect(() => parseMaxHigh({ s: 'error' })).toThrow(/không hợp lệ/i);
  });

  it('ném lỗi khi không phải object', () => {
    expect(() => parseMaxHigh('oops')).toThrow(/không đúng định dạng/i);
  });
});

describe('fetchPeaks', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('danh sách rỗng → không gọi mạng', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    expect(await fetchPeaks([])).toEqual({ peaks: {}, failed: [] });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('gọi nến THÁNG từ mốc 0 để lấy đủ lịch sử mà payload vẫn nhẹ', async () => {
    const fetchMock = vi.fn(async (url: string) => { void url; return okJson({ s: 'ok', h: [30.1, 44.5] }); });
    vi.stubGlobal('fetch', fetchMock);
    await fetchPeaks(['acb']);
    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain('symbol=ACB');
    expect(url).toContain('resolution=M');
    expect(url).toContain('from=0');
  });

  it('một mã lỗi KHÔNG làm hỏng cả lần', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('symbol=ACB')) return okJson({ s: 'ok', h: [30.1, 44.5] });
      return { ok: false, status: 500 } as Response;
    });
    vi.stubGlobal('fetch', fetchMock);
    const result = await fetchPeaks(['acb', 'fpt']);
    expect(result.peaks).toEqual({ ACB: 44.5 });
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0].ticker).toBe('FPT');
  });
});

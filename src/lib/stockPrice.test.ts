import { describe, it, expect, vi, afterEach } from 'vitest';
import { parseLatestClose, parseMaxHigh, fetchQuotes } from './stockPrice';

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


describe('fetchQuotes — MỘT lượt request lấy cả giá lẫn đỉnh', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('danh sách rỗng → không gọi mạng', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    expect(await fetchQuotes([])).toEqual({ quotes: {}, failed: [] });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('dùng resolution=D và from=0 — dchart KHÔNG hỗ trợ M/W, chỉ có D', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      void url;
      return okJson({ s: 'ok', c: [20, 22.75], h: [21, 44.5] });
    });
    vi.stubGlobal('fetch', fetchMock);
    await fetchQuotes(['acb']);
    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain('symbol=ACB');
    expect(url).toContain('resolution=D');
    expect(url).toContain('from=0');
  });

  it('MỘT request cho mỗi mã, trả cả giá đóng cửa cuối lẫn max(high)', async () => {
    const fetchMock = vi.fn(async () => okJson({ s: 'ok', c: [20, 22.75], h: [21, 44.5] }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchQuotes(['acb']);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.quotes).toEqual({ ACB: { priceVnd: 22.75, peakVnd: 44.5 } });
    expect(result.failed).toEqual([]);
  });

  it('một mã lỗi KHÔNG làm hỏng cả lần: mã còn lại vẫn có số', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('symbol=ACB')) return okJson({ s: 'ok', c: [22.75], h: [44.5] });
      return { ok: false, status: 500 } as Response;
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchQuotes(['acb', 'fpt']);
    expect(result.quotes).toEqual({ ACB: { priceVnd: 22.75, peakVnd: 44.5 } });
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0].ticker).toBe('FPT');
    expect(result.failed[0].message).toMatch(/500/);
  });

  it('mã no_data: giá và đỉnh đều null, KHÔNG tính là lỗi', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => okJson({ s: 'no_data' })));
    const result = await fetchQuotes(['xyz']);
    expect(result.quotes).toEqual({ XYZ: { priceVnd: null, peakVnd: null } });
    expect(result.failed).toEqual([]);
  });

  it('nguồn trả text thay vì JSON (VD "Not support resolution") ⇒ vào failed, không nuốt', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true, status: 200,
      json: async () => { throw new SyntaxError('Unexpected token N'); },
    }) as unknown as Response));
    const result = await fetchQuotes(['acb']);
    expect(result.quotes).toEqual({});
    expect(result.failed[0].ticker).toBe('ACB');
  });
});

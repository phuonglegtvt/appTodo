import { describe, it, expect } from 'vitest';
import { parseLatestClose } from './stockPrice';

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

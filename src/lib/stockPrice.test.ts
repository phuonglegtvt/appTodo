import { describe, it, expect } from 'vitest';
import { parsePriceResponse } from './stockPrice';

describe('parsePriceResponse', () => {
  it('chuẩn hóa mảng {ticker, price} về map ticker → giá (nghìn đồng)', () => {
    // TCBS trả giá theo nghìn đồng (VD ACB ~ 30.1). Giữ nguyên đơn vị nghìn đồng.
    const json = [
      { ticker: 'ACB', price: 30.1 },
      { ticker: 'FPT', price: 120.5 },
    ];
    expect(parsePriceResponse(json)).toEqual({ ACB: 30.1, FPT: 120.5 });
  });

  it('viết hoa ticker để khớp mã lưu trong DB', () => {
    expect(parsePriceResponse([{ ticker: 'acb', price: 30.1 }])).toEqual({ ACB: 30.1 });
  });

  it('bỏ qua phần tử thiếu ticker hoặc price không phải số', () => {
    const json = [
      { ticker: 'ACB', price: 30.1 },
      { ticker: 'BAD' }, // thiếu price
      { price: 10 }, // thiếu ticker
      { ticker: 'X', price: 'n/a' }, // price không hợp lệ
    ];
    expect(parsePriceResponse(json)).toEqual({ ACB: 30.1 });
  });

  it('ném lỗi rõ ràng khi response không phải mảng (nguồn đổi shape)', () => {
    expect(() => parsePriceResponse({ oops: true })).toThrow(/không đúng định dạng/i);
  });
});

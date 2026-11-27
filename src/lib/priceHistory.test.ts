import { describe, it, expect } from 'vitest';
import { parseDchartHistory, parseBinanceKlines, parseFmarketNav, parseFmarketFunds, isVnIndex } from './priceHistory';

describe('parseDchartHistory', () => {
  it('đổi giây → ngày ISO và nhân hệ số đơn vị', () => {
    const r = parseDchartHistory({ s: 'ok', t: [1577923200, 1578009600], c: [18.5, 18.2] }, 1000);
    expect(r).toEqual([{ date: '2020-01-02', close: 18500 }, { date: '2020-01-03', close: 18200 }]);
  });
  it('no_data ⇒ rỗng; trạng thái lạ ⇒ ném lỗi', () => {
    expect(parseDchartHistory({ s: 'no_data' }, 1)).toEqual([]);
    expect(() => parseDchartHistory({ s: 'error' }, 1)).toThrow(/trạng thái lạ/);
    expect(() => parseDchartHistory('Not support resolution', 1)).toThrow();
  });
});

describe('parseBinanceKlines', () => {
  it('lấy openTime và giá đóng cửa dạng chuỗi', () => {
    const r = parseBinanceKlines([[1704067200000, '1', '2', '0.5', '42283.58', '1']]);
    expect(r).toEqual([{ date: '2024-01-01', close: 42283.58 }]);
  });
  it('object lỗi của Binance ⇒ ném lỗi kèm message', () => {
    expect(() => parseBinanceKlines({ code: -1121, msg: 'Invalid symbol.' })).toThrow(/Invalid symbol/);
  });
});

describe('Fmarket', () => {
  it('parseFmarketNav sắp tăng dần và bỏ ngày trùng', () => {
    const r = parseFmarketNav({ data: [
      { nav: 12, navDate: '2024-01-03' },
      { nav: 10, navDate: '2024-01-01' },
      { nav: 11, navDate: '2024-01-03' },
      { nav: null, navDate: '2024-01-04' },
    ] });
    expect(r).toEqual([{ date: '2024-01-01', close: 10 }, { date: '2024-01-03', close: 11 }]);
  });
  it('parseFmarketFunds chuẩn hoá mã viết hoa', () => {
    expect(parseFmarketFunds({ data: { rows: [{ id: 23, shortName: 'Vesaf', name: 'Quỹ X' }] } }))
      .toEqual([{ id: 23, shortName: 'VESAF', name: 'Quỹ X' }]);
    expect(() => parseFmarketFunds({})).toThrow();
  });
});

it('isVnIndex', () => {
  expect(isVnIndex('vnindex')).toBe(true);
  expect(isVnIndex('FPT')).toBe(false);
});

it('gioiHanNguon: chỉ báo khi ngày đầu trùng mốc giới hạn của nguồn', async () => {
  const { gioiHanNguon } = await import('./priceHistory');
  expect(gioiHanNguon('vn', 'FPT', '2013-01-02')).toMatch(/02\/01\/2013/);
  expect(gioiHanNguon('vn', 'FUESSVFL', '2020-03-18')).toBeNull();
  expect(gioiHanNguon('vn', 'VNINDEX', '2017-08-24')).toMatch(/chỉ số/);
  expect(gioiHanNguon('crypto', 'BTC', '2017-08-17')).toMatch(/Binance/);
  expect(gioiHanNguon('crypto', 'SOL', '2020-08-11')).toBeNull();
  expect(gioiHanNguon('fund', 'VESAF', '2017-04-25')).toBeNull();
});

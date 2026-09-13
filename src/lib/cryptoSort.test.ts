import { describe, expect, test } from 'vitest';
import type { Crypto } from '../types/crypto';
import { CRYPTO_COLUMNS, cryptoSortValue } from './cryptoSort';

function coin(over: Partial<Crypto> = {}): Crypto {
  return {
    id: 'id', user_id: 'u', symbol: 'BTC', name: 'Bitcoin',
    quantity: null, avg_buy_price: null, current_price: null, peak_price: null,
    invested_amount: null, sort_order: 0, created_at: '', updated_at: '',
    ...over,
  };
}

describe('CRYPTO_COLUMNS — khai báo cột', () => {
  test('đúng 10 cột sort được, theo đúng thứ tự ô của CryptoRow', () => {
    expect(CRYPTO_COLUMNS.map((c) => c.label)).toEqual([
      'Mã', 'Tên', 'Số lượng', 'Giá mua TB', 'Giá hiện tại',
      'Đỉnh LS', '% so đỉnh', 'Đã đầu tư (đ)', 'Giá trị', 'Lời/Lỗ',
    ]);
  });

  test('nhãn cột vốn ghi rõ "(đ)" vì cả bảng còn lại là USD', () => {
    // Không ghi đơn vị thì rất dễ gõ 1.600 (USD) vào ô cần 42.000.000 (đồng).
    const cot = CRYPTO_COLUMNS.find((c) => c.key === 'invested_amount');
    expect(cot?.label).toContain('(đ)');
  });
});

describe('cryptoSortValue', () => {
  test('Mã trả về chuỗi symbol', () => {
    expect(cryptoSortValue(coin({ symbol: 'ETH' }), 'symbol')).toBe('ETH');
  });

  test('tên rỗng trả null để xuống cuối, vì bảng hiện nó là "—"', () => {
    // CryptoRow vẽ `crypto.name || '—'`. Chuỗi rỗng sort lên ĐẦU bảng trong khi
    // mắt người đọc nó là "chưa có" — phải xuống cuối như mọi ô trống khác.
    expect(cryptoSortValue(coin({ name: '' }), 'name')).toBeNull();
  });

  test('Đã đầu tư lấy thẳng số VND đã nhập, không quy đổi', () => {
    expect(cryptoSortValue(coin({ invested_amount: 42_000_000 }), 'invested_amount'))
      .toBe(42_000_000);
  });

  test('chưa nhập Đã đầu tư trả null để xuống cuối, KHÔNG suy ra từ giá mua', () => {
    // Cột này hiển thị "—" khi chưa nhập; sort phải khớp thứ mắt nhìn thấy.
    expect(cryptoSortValue(coin({ invested_amount: null, quantity: 1, avg_buy_price: 40_000 }), 'invested_amount'))
      .toBeNull();
  });

  test('Giá trị = số lượng × giá hiện tại (USD)', () => {
    expect(cryptoSortValue(coin({ quantity: 2, current_price: 50_000 }), 'value')).toBe(100_000);
  });

  test('Lời/Lỗ = giá trị − vốn (USD)', () => {
    const c = coin({ quantity: 2, avg_buy_price: 40_000, current_price: 50_000 });
    expect(cryptoSortValue(c, 'pnl')).toBe(20_000);
  });

  test('lỗ ra số âm, sort được cùng thang với lãi', () => {
    const c = coin({ quantity: 1, avg_buy_price: 60_000, current_price: 50_000 });
    expect(cryptoSortValue(c, 'pnl')).toBe(-10_000);
  });

  test('% so đỉnh = (giá hiện tại − đỉnh) / đỉnh × 100', () => {
    const v = cryptoSortValue(coin({ current_price: 50_000, peak_price: 100_000 }), 'drawdown');
    expect(v).toBe(-50);
  });

  test('thiếu số lượng thì Giá trị là null, không phải 0', () => {
    expect(cryptoSortValue(coin({ quantity: null, current_price: 50_000 }), 'value')).toBeNull();
  });

  test('sort Giá trị theo USD cho thứ tự y hệt theo VND, nên không cần tỷ giá', () => {
    // Quy đổi là nhân một hằng số dương ⇒ không đổi thứ tự. Nhờ vậy module này
    // thuần, không phụ thuộc tỷ giá mạng.
    const re = coin({ id: 'a', quantity: 1, current_price: 100 });
    const dat = coin({ id: 'b', quantity: 1, current_price: 900 });
    const usd = [re, dat].map((c) => cryptoSortValue(c, 'value') as number);
    const vnd = usd.map((v) => v * 25_000);
    expect(usd[0] < usd[1]).toBe(vnd[0] < vnd[1]);
  });
});

describe('cryptoSortValue — khớp với hàm value() của cột', () => {
  test('mọi cột cho cùng kết quả qua cả hai đường', () => {
    const c = coin({ quantity: 3, avg_buy_price: 100, current_price: 120, peak_price: 200 });
    for (const cot of CRYPTO_COLUMNS) {
      expect(cot.value(c)).toEqual(cryptoSortValue(c, cot.key));
    }
  });
});

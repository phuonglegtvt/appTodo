import { describe, expect, test } from 'vitest';
import type { Stock } from '../types/stock';
import { STOCK_COLUMNS, stockSortValue } from './stockSort';

function stock(over: Partial<Stock> = {}): Stock {
  return {
    id: 'id', user_id: 'u', ticker: 'HPG', company_name: 'Hòa Phát', group: 'attack',
    price_threshold: null, price_protect: null, current_price: null, dividend: null,
    invested_amount: null, quantity: null, peak_price: null, sort_order: 0,
    created_at: '', updated_at: '',
    ...over,
  };
}

describe('STOCK_COLUMNS — khai báo cột', () => {
  test('đúng 13 cột sort được, theo đúng thứ tự ô của StockRow', () => {
    // Danh sách này vẽ ra tiêu đề bảng, nên thứ tự ở đây PHẢI khớp thứ tự <td>
    // trong StockRow. Lệch một ô là cả bảng lệch nhãn mà không ai báo lỗi.
    expect(STOCK_COLUMNS.map((c) => c.label)).toEqual([
      'Mã', 'Tên công ty', 'Giá ngưỡng', '% so ngưỡng', 'Giá bảo vệ', 'Giá hiện tại',
      'Đỉnh LS', '% so đỉnh', 'Cổ tức', 'Tỷ suất', 'Đã đầu tư', 'Số lượng', 'Giá vốn TB',
    ]);
  });

  test('không có khoá trùng', () => {
    const keys = STOCK_COLUMNS.map((c) => c.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('stockSortValue — cột chữ', () => {
  test('Mã trả về chuỗi ticker', () => {
    expect(stockSortValue(stock({ ticker: 'VCB' }), 'ticker')).toBe('VCB');
  });

  test('Tên công ty trả về chuỗi tên', () => {
    expect(stockSortValue(stock({ company_name: 'Á Châu' }), 'company_name')).toBe('Á Châu');
  });
});

describe('stockSortValue — cột số nhập thẳng', () => {
  test('Giá ngưỡng lấy đúng số đã nhập', () => {
    expect(stockSortValue(stock({ price_threshold: 30.9 }), 'price_threshold')).toBe(30.9);
  });

  test('chưa nhập thì trả null, KHÔNG quy về 0', () => {
    expect(stockSortValue(stock({ invested_amount: null }), 'invested_amount')).toBeNull();
  });

  test('đã bán hết (0) khác hẳn chưa nhập (null)', () => {
    expect(stockSortValue(stock({ quantity: 0 }), 'quantity')).toBe(0);
  });
});

describe('stockSortValue — cột tính toán sort theo SỐ, không theo chuỗi hiển thị', () => {
  test('% so ngưỡng = (giá hiện tại − ngưỡng) / ngưỡng × 100', () => {
    // Hiển thị '−25.0%'; sort phải dùng −25, không dùng chuỗi.
    const v = stockSortValue(stock({ current_price: 30, price_threshold: 40 }), 'gap_threshold');
    expect(v).toBeCloseTo(-25, 6);
  });

  test('% so đỉnh = (giá hiện tại − đỉnh) / đỉnh × 100', () => {
    const v = stockSortValue(stock({ current_price: 21.3, peak_price: 29.89 }), 'drawdown');
    expect(v).toBeCloseTo(-28.737, 2);
  });

  test('Tỷ suất = cổ tức (đồng) / (giá ngưỡng nghìn đồng × 1000) × 100', () => {
    // 500đ / 30.900đ = 1,618%
    const v = stockSortValue(stock({ dividend: 500, price_threshold: 30.9 }), 'yield');
    expect(v).toBeCloseTo(1.618, 3);
  });

  test('thiếu giá hiện tại thì % so ngưỡng là null, không phải 0', () => {
    expect(stockSortValue(stock({ current_price: null, price_threshold: 40 }), 'gap_threshold')).toBeNull();
  });

  test('chưa biết đỉnh thì % so đỉnh là null, không phải 0', () => {
    expect(stockSortValue(stock({ current_price: 21.3, peak_price: null }), 'drawdown')).toBeNull();
  });

  test('giá ngưỡng 0 thì tỷ suất là null, không chia cho 0', () => {
    expect(stockSortValue(stock({ dividend: 500, price_threshold: 0 }), 'yield')).toBeNull();
  });
});

describe('stockSortValue — khớp với hàm value() của cột', () => {
  test('mọi cột đều lấy được giá trị qua cả hai đường, cho cùng kết quả', () => {
    const s = stock({
      ticker: 'MSB', company_name: 'Hàng hải', price_threshold: 12.9, price_protect: 13.8,
      current_price: 12.95, peak_price: 16.45, dividend: 700, invested_amount: 205, quantity: 13,
    });
    for (const cot of STOCK_COLUMNS) {
      expect(cot.value(s)).toEqual(stockSortValue(s, cot.key));
    }
  });
});

import { describe, expect, test } from 'vitest';
import type { Gold } from '../types/gold';
import { GOLD_COLUMNS, goldSortValue } from './goldSort';

function vang(over: Partial<Gold> = {}): Gold {
  return {
    id: 'id', user_id: 'u', label: 'SJC 1 lượng',
    quantity: null, avg_buy_price: null, current_price: null,
    invested_amount: null, sort_order: 0, created_at: '', updated_at: '',
    ...over,
  };
}

describe('GOLD_COLUMNS — khai báo cột', () => {
  test('đúng 6 cột sort được, theo đúng thứ tự ô của GoldTable', () => {
    expect(GOLD_COLUMNS.map((c) => c.label)).toEqual([
      'Loại', 'Số lượng', 'Giá mua TB (đ/lượng)', 'Giá hiện tại (đ/lượng)',
      'Đã đầu tư (đ)', 'Giá trị',
    ]);
  });
});

describe('goldSortValue', () => {
  test('Loại trả về nhãn, sort theo tiếng Việt ở tầng sortRows', () => {
    expect(goldSortValue(vang({ label: 'Nhẫn trơn 9999' }), 'label')).toBe('Nhẫn trơn 9999');
  });

  test('Giá trị = số lượng × giá hiện tại (đồng, KHÔNG nhân 1000)', () => {
    // Vàng lưu ĐỒNG/lượng, khác stocks lưu nghìn đồng. Nhân thêm 1000 ở đây là sai.
    const v = goldSortValue(vang({ quantity: 2, current_price: 90_000_000 }), 'value');
    expect(v).toBe(180_000_000);
  });

  test('Đã đầu tư lấy thẳng số VND đã nhập', () => {
    expect(goldSortValue(vang({ invested_amount: 150_000_000 }), 'invested_amount'))
      .toBe(150_000_000);
  });

  test('chưa nhập Đã đầu tư trả null, KHÔNG suy ra từ giá mua', () => {
    expect(goldSortValue(vang({ invested_amount: null, quantity: 2, avg_buy_price: 75_000_000 }), 'invested_amount'))
      .toBeNull();
  });

  test('thiếu giá hiện tại thì Giá trị là null, không phải 0', () => {
    expect(goldSortValue(vang({ quantity: 2, current_price: null }), 'value')).toBeNull();
  });

  test('chưa nhập số lượng trả null, đã bán hết (0) trả 0', () => {
    expect(goldSortValue(vang({ quantity: null }), 'quantity')).toBeNull();
    expect(goldSortValue(vang({ quantity: 0 }), 'quantity')).toBe(0);
  });
});

describe('goldSortValue — khớp với hàm value() của cột', () => {
  test('mọi cột cho cùng kết quả qua cả hai đường', () => {
    const g = vang({ quantity: 2, avg_buy_price: 75_000_000, current_price: 90_000_000 });
    for (const cot of GOLD_COLUMNS) {
      expect(cot.value(g)).toEqual(goldSortValue(g, cot.key));
    }
  });
});

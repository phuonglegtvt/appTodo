// Test cho holdingsMap.ts — biên đổi holdings thật thành AllocationRow[].
//
// Đây là chỗ DUY NHẤT được phép quy đổi đơn vị (nghìn đồng → đồng, USD → đồng),
// đúng luật `src/domain/` trong CLAUDE.md. Nên phần lớn test ở đây là test ĐƠN VỊ.

import { describe, it, expect } from 'vitest';
import { toAllocationRows } from './holdingsMap';
import type { Stock } from '../types/stock';
import type { Crypto } from '../types/crypto';
import type { Gold } from '../types/gold';

const USD_VND = 26_000;

function stock(over: Partial<Stock> = {}): Stock {
  return {
    id: 's1', user_id: 'u1', ticker: 'FPT', company_name: 'FPT Corp',
    group: 'balance', price_threshold: null, price_protect: null,
    current_price: null, dividend: null, invested_amount: null, quantity: null, peak_price: null,
    sort_order: 0, created_at: '2026-01-01', updated_at: '2026-08-20',
    ...over,
  };
}

function crypto(over: Partial<Crypto> = {}): Crypto {
  return {
    id: 'c1', user_id: 'u1', symbol: 'BTC', name: 'Bitcoin',
    quantity: null, avg_buy_price: null, current_price: null, peak_price: null,
    invested_amount: null, sort_order: 0, created_at: '2026-01-01', updated_at: '2026-08-21',
    ...over,
  };
}

function gold(over: Partial<Gold> = {}): Gold {
  return {
    id: 'g1', user_id: 'u1', label: 'SJC 1 lượng',
    quantity: null, avg_buy_price: null, current_price: null,
    invested_amount: null, sort_order: 0, created_at: '2026-01-01', updated_at: '2026-08-22',
    ...over,
  };
}

const empty = { stocks: [], cryptos: [], golds: [], usdVnd: USD_VND };

describe('toAllocationRows — đơn vị cổ phiếu (giá là NGHÌN ĐỒNG)', () => {
  it('quy giá nghìn đồng ra đồng: 100 cổ × 98 nghìn = 9.800.000đ', () => {
    const { rows } = toAllocationRows({
      ...empty,
      stocks: [stock({ quantity: 100, current_price: 98, invested_amount: 9_000 })],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].asset_class).toBe('STOCKS');
    expect(rows[0].symbol).toBe('FPT');
    expect(rows[0].market_value_vnd).toBe(9_800_000);
  });

  it('vốn đã bỏ: invested_amount là NGHÌN ĐỒNG ⇒ nhân 1.000 để ra đồng', () => {
    const { rows } = toAllocationRows({
      ...empty,
      stocks: [stock({ quantity: 100, current_price: 98, invested_amount: 9_000 })],
    });
    expect(rows[0].cost_basis_vnd).toBe(9_000_000);
  });
});

describe('toAllocationRows — đơn vị crypto (giá là USD)', () => {
  it('quy USD ra đồng theo tỷ giá truyền vào', () => {
    const { rows } = toAllocationRows({
      ...empty,
      cryptos: [crypto({ quantity: 0.5, current_price: 60_000, avg_buy_price: 40_000 })],
    });
    expect(rows[0].asset_class).toBe('CRYPTO');
    expect(rows[0].market_value_vnd).toBe(0.5 * 60_000 * USD_VND);
    expect(rows[0].cost_basis_vnd).toBe(0.5 * 40_000 * USD_VND);
  });
});

describe('toAllocationRows — đơn vị vàng (giá là ĐỒNG/lượng, KHÔNG nghìn đồng)', () => {
  it('không nhân thêm 1000', () => {
    const { rows } = toAllocationRows({
      ...empty,
      golds: [gold({ quantity: 2, current_price: 90_000_000, avg_buy_price: 75_000_000 })],
    });
    expect(rows[0].asset_class).toBe('GOLD');
    expect(rows[0].symbol).toBe('SJC 1 lượng');
    expect(rows[0].market_value_vnd).toBe(180_000_000);
    expect(rows[0].cost_basis_vnd).toBe(150_000_000);
  });
});

describe('toAllocationRows — "chưa nhập" KHÁC "đã bán hết"', () => {
  it('mã watchlist trắng trơn (chưa bỏ tiền, chưa có số lượng) → bỏ qua, không báo gì', () => {
    const r = toAllocationRows({ ...empty, stocks: [stock()] });
    expect(r.rows).toEqual([]);
    expect(r.missingQuantitySymbols).toEqual([]);
  });

  it('ĐÃ bỏ tiền mà CHƯA nhập số lượng → báo tên mã, KHÔNG coi là 0đ', () => {
    // Đây là ca của 56 mã watchlist hiện tại: có invested_amount nhưng chưa ai
    // nhập quantity. mapToSnapshot sẽ bỏ qua im lặng (quantity ?? 0 → 0), nên
    // phải bắt tại đây và nói ra, nếu không tỷ trọng hiện lên sẽ thiếu phần đó
    // mà không một dấu hiệu nào.
    const r = toAllocationRows({
      ...empty,
      stocks: [stock({ invested_amount: 9_000, quantity: null, current_price: 98 })],
    });
    expect(r.missingQuantitySymbols).toEqual(['FPT']);
    expect(r.rows).toEqual([]);
  });

  it('quantity = 0 nghĩa là đã bán hết → bỏ qua, KHÔNG báo thiếu số lượng', () => {
    const r = toAllocationRows({
      ...empty,
      stocks: [stock({ invested_amount: 9_000, quantity: 0, current_price: 98 })],
    });
    expect(r.missingQuantitySymbols).toEqual([]);
    expect(r.rows).toEqual([]);
  });
});

describe('toAllocationRows — thiếu giá thì để NULL cho engine chặn kế hoạch', () => {
  it('đang giữ mà chưa có giá → market_value_vnd = null, KHÔNG phải 0', () => {
    const { rows } = toAllocationRows({
      ...empty,
      stocks: [stock({ quantity: 100, current_price: null, invested_amount: 9_000 })],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].market_value_vnd).toBeNull();
  });

  it('thiếu giá mua thì cost_basis_vnd = null, không kéo theo mất giá trị thị trường', () => {
    const { rows } = toAllocationRows({
      ...empty,
      golds: [gold({ quantity: 2, current_price: 90_000_000, avg_buy_price: null })],
    });
    expect(rows[0].market_value_vnd).toBe(180_000_000);
    expect(rows[0].cost_basis_vnd).toBeNull();
  });
});

describe('toAllocationRows — hình dạng khớp hợp đồng AllocationRow', () => {
  it('không sinh dòng CASH nào: hồ sơ này không theo dõi tiền mặt', () => {
    const { rows } = toAllocationRows({
      ...empty,
      stocks: [stock({ quantity: 100, current_price: 98 })],
      cryptos: [crypto({ quantity: 1, current_price: 60_000 })],
      golds: [gold({ quantity: 1, current_price: 90_000_000 })],
    });
    expect(rows.every((r) => r.asset_class !== 'CASH')).toBe(true);
    expect(rows.every((r) => r.cash_balance_vnd === null)).toBe(true);
    expect(rows.every((r) => r.earmarked_for === null)).toBe(true);
  });

  it('price_as_of lấy updated_at của dòng nguồn — để UI nói được giá cũ tới đâu', () => {
    const { rows } = toAllocationRows({
      ...empty,
      stocks: [stock({ quantity: 100, current_price: 98, updated_at: '2026-08-20' })],
    });
    expect(rows[0].price_as_of).toBe('2026-08-20');
  });
});

describe('toAllocationRows — tỷ giá bất thường thì NÉM, không âm thầm dùng', () => {
  it('tỷ giá 0 → ném lỗi (nhân 0 làm mọi crypto thành 0đ)', () => {
    expect(() => toAllocationRows({
      ...empty, usdVnd: 0,
      cryptos: [crypto({ quantity: 1, current_price: 60_000 })],
    })).toThrow(/tỷ giá/i);
  });

  it('tỷ giá NaN → ném lỗi', () => {
    expect(() => toAllocationRows({
      ...empty, usdVnd: NaN,
      cryptos: [crypto({ quantity: 1, current_price: 60_000 })],
    })).toThrow(/tỷ giá/i);
  });
});

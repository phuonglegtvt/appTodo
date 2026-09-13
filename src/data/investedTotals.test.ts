// Test cho `tongVonDaBo` (holdingsMap.ts) — tổng vốn đã bỏ vào, dùng cho khối
// "Lũy kế đã đầu tư" của tab Thu–Chi.
//
// Phần lớn test ở đây là test ĐƠN VỊ: stocks lưu NGHÌN ĐỒNG, cryptos lưu USD,
// golds lưu ĐỒNG/lượng. Sai một chỗ là con số lệch 1.000 lần.

import { describe, it, expect } from 'vitest';
import { tongVonDaBo } from './holdingsMap';
import type { Stock } from '../types/stock';
import type { Crypto } from '../types/crypto';
import type { Gold } from '../types/gold';

const USD_VND = 26_000;

function stock(over: Partial<Stock> = {}): Stock {
  return {
    id: 's1', user_id: 'u1', ticker: 'FPT', company_name: 'FPT Corp',
    group: 'balance', price_threshold: null, price_protect: null,
    current_price: null, dividend: null, invested_amount: null, quantity: null,
    peak_price: null, sort_order: 0, created_at: '', updated_at: '',
    ...over,
  };
}

function crypto(over: Partial<Crypto> = {}): Crypto {
  return {
    id: 'c1', user_id: 'u1', symbol: 'BTC', name: 'Bitcoin',
    quantity: null, avg_buy_price: null, current_price: null, peak_price: null,
    invested_amount: null, sort_order: 0, created_at: '', updated_at: '',
    ...over,
  };
}

function gold(over: Partial<Gold> = {}): Gold {
  return {
    id: 'g1', user_id: 'u1', label: 'SJC 1 lượng',
    quantity: null, avg_buy_price: null, current_price: null,
    invested_amount: null, sort_order: 0, created_at: '', updated_at: '',
    ...over,
  };
}

const rong = { stocks: [], cryptos: [], golds: [], usdVnd: USD_VND };

describe('tongVonDaBo — cổ phiếu (invested_amount là NGHÌN ĐỒNG)', () => {
  it('quy nghìn đồng ra đồng: 5.500 nghìn = 5.500.000đ', () => {
    const r = tongVonDaBo({ ...rong, stocks: [stock({ invested_amount: 5_500 })] });
    expect(r.stocksVnd).toBe(5_500_000);
  });

  it('KHÔNG cần quantity — đã bỏ tiền là tính, dù chưa nhập số lượng', () => {
    // Khác hẳn toAllocationRows (bỏ qua mã thiếu quantity vì không tính được
    // giá trị thị trường). Ở đây chỉ hỏi "đã bỏ vào bao nhiêu tiền" nên
    // quantity không liên quan.
    const r = tongVonDaBo({
      ...rong,
      stocks: [stock({ invested_amount: 290, quantity: null })],
    });
    expect(r.stocksVnd).toBe(290_000);
    expect(r.boSotSymbols).toEqual([]);
  });

  it('mã chưa bỏ tiền không cộng gì, không ra NaN', () => {
    const r = tongVonDaBo({ ...rong, stocks: [stock({ invested_amount: null })] });
    expect(r.stocksVnd).toBe(0);
  });

  it('cộng dồn nhiều mã', () => {
    const r = tongVonDaBo({
      ...rong,
      stocks: [stock({ invested_amount: 300 }), stock({ id: 's2', invested_amount: 220 })],
    });
    expect(r.stocksVnd).toBe(520_000);
  });
});

describe('tongVonDaBo — crypto (giá là USD)', () => {
  it('quy USD ra đồng: 0,5 coin × 40.000 USD × 26.000 = 520.000.000đ', () => {
    const r = tongVonDaBo({
      ...rong,
      cryptos: [crypto({ quantity: 0.5, avg_buy_price: 40_000 })],
    });
    expect(r.cryptoVnd).toBe(520_000_000);
  });

  it('đã bỏ tiền mà CHƯA nhập số lượng thì không tính được — phải báo tên mã', () => {
    const r = tongVonDaBo({
      ...rong,
      cryptos: [crypto({ symbol: 'ETH', quantity: null, avg_buy_price: 3_000 })],
    });
    expect(r.cryptoVnd).toBe(0);
    expect(r.boSotSymbols).toEqual(['ETH']);
  });

  it('coin watchlist trắng (chưa nhập gì) không bị báo bỏ sót', () => {
    const r = tongVonDaBo({ ...rong, cryptos: [crypto({ quantity: null, avg_buy_price: null })] });
    expect(r.boSotSymbols).toEqual([]);
  });
});

describe('tongVonDaBo — vàng (giá là ĐỒNG/lượng, KHÔNG quy đổi)', () => {
  it('2 lượng × 75.000.000 = 150.000.000đ, không nhân thêm 1.000', () => {
    const r = tongVonDaBo({
      ...rong,
      golds: [gold({ quantity: 2, avg_buy_price: 75_000_000 })],
    });
    expect(r.goldVnd).toBe(150_000_000);
  });

  it('đã bỏ tiền mà chưa nhập số lượng thì báo theo nhãn dòng vàng', () => {
    const r = tongVonDaBo({
      ...rong,
      golds: [gold({ label: 'Nhẫn trơn', quantity: null, avg_buy_price: 7_000_000 })],
    });
    expect(r.goldVnd).toBe(0);
    expect(r.boSotSymbols).toEqual(['Nhẫn trơn']);
  });
});

describe('tongVonDaBo — tổng và tỷ giá', () => {
  it('tổng là cộng cả ba loại', () => {
    const r = tongVonDaBo({
      stocks: [stock({ invested_amount: 1_000 })],            // 1.000.000đ
      cryptos: [crypto({ quantity: 1, avg_buy_price: 100 })], // 2.600.000đ
      golds: [gold({ quantity: 1, avg_buy_price: 3_000_000 })],
      usdVnd: USD_VND,
    });
    expect(r.tongVnd).toBe(1_000_000 + 2_600_000 + 3_000_000);
  });

  it('chưa có tỷ giá mà CÓ crypto: crypto và tổng là null, KHÔNG phải 0đ', () => {
    // Trả 0 sẽ hiện ra một con số đẹp và sai — người dùng tưởng mình chưa mua
    // crypto bao giờ. null để UI nói "chưa quy đổi được".
    const r = tongVonDaBo({
      ...rong,
      stocks: [stock({ invested_amount: 1_000 })],
      cryptos: [crypto({ quantity: 1, avg_buy_price: 100 })],
      usdVnd: 0,
    });
    expect(r.cryptoVnd).toBeNull();
    expect(r.tongVnd).toBeNull();
    // Phần không phụ thuộc tỷ giá vẫn phải ra số, không bị kéo theo.
    expect(r.stocksVnd).toBe(1_000_000);
  });

  it('không giữ crypto nào thì tỷ giá hỏng cũng không ảnh hưởng', () => {
    const r = tongVonDaBo({
      ...rong,
      stocks: [stock({ invested_amount: 1_000 })],
      usdVnd: Number.NaN,
    });
    expect(r.cryptoVnd).toBe(0);
    expect(r.tongVnd).toBe(1_000_000);
  });

  it('không có gì thì tất cả bằng 0, không NaN', () => {
    const r = tongVonDaBo(rong);
    expect(r).toEqual({
      stocksVnd: 0, cryptoVnd: 0, goldVnd: 0, tongVnd: 0, boSotSymbols: [],
    });
  });
});

describe('tongVonDaBo — cột invested_amount mới của crypto và vàng (VND đồng)', () => {
  it('crypto: dùng THẲNG số VND đã nhập, KHÔNG nhân tỷ giá', () => {
    // Cột này là đồng tuyệt đối, khác mọi cột giá của bảng cryptos (USD).
    // Nhân tỷ giá vào đây là làm con số phồng lên 26.000 lần.
    const r = tongVonDaBo({
      ...rong,
      cryptos: [crypto({ invested_amount: 42_000_000 })],
    });
    expect(r.cryptoVnd).toBe(42_000_000);
  });

  it('crypto: có invested_amount thì KHÔNG cộng thêm quantity × giá mua nữa', () => {
    // Hai nguồn cùng nói về một khoản tiền — cộng cả hai là tính đôi.
    const r = tongVonDaBo({
      ...rong,
      cryptos: [crypto({ invested_amount: 42_000_000, quantity: 1, avg_buy_price: 40_000 })],
    });
    expect(r.cryptoVnd).toBe(42_000_000);
  });

  it('crypto: có invested_amount thì chưa nhập số lượng cũng KHÔNG còn bị bỏ sót', () => {
    // Đây chính là lý do thêm cột này.
    const r = tongVonDaBo({
      ...rong,
      cryptos: [crypto({ symbol: 'ETH', invested_amount: 10_000_000, quantity: null })],
    });
    expect(r.cryptoVnd).toBe(10_000_000);
    expect(r.boSotSymbols).toEqual([]);
  });

  it('crypto: mọi coin đã nhập invested_amount thì tỷ giá hỏng cũng không sao', () => {
    // Không còn phép quy đổi nào ⇒ không còn phụ thuộc tỷ giá.
    const r = tongVonDaBo({
      ...rong,
      cryptos: [crypto({ invested_amount: 42_000_000 })],
      usdVnd: Number.NaN,
    });
    expect(r.cryptoVnd).toBe(42_000_000);
    expect(r.tongVnd).toBe(42_000_000);
  });

  it('crypto: chưa nhập invested_amount thì vẫn suy từ số lượng × giá mua như cũ', () => {
    const r = tongVonDaBo({
      ...rong,
      cryptos: [crypto({ invested_amount: null, quantity: 0.5, avg_buy_price: 40_000 })],
    });
    expect(r.cryptoVnd).toBe(520_000_000);
  });

  it('crypto: invested_amount = 0 là ĐÃ NHẬP rõ ràng, không phải bỏ sót', () => {
    const r = tongVonDaBo({
      ...rong,
      cryptos: [crypto({ symbol: 'DOGE', invested_amount: 0, quantity: null, avg_buy_price: 1 })],
    });
    expect(r.cryptoVnd).toBe(0);
    expect(r.boSotSymbols).toEqual([]);
  });

  it('vàng: dùng thẳng số VND đã nhập', () => {
    const r = tongVonDaBo({ ...rong, golds: [gold({ invested_amount: 150_000_000 })] });
    expect(r.goldVnd).toBe(150_000_000);
  });

  it('vàng: có invested_amount thì chưa nhập số lượng cũng không bị bỏ sót', () => {
    const r = tongVonDaBo({
      ...rong,
      golds: [gold({ label: 'Nhẫn trơn', invested_amount: 7_000_000, quantity: null })],
    });
    expect(r.goldVnd).toBe(7_000_000);
    expect(r.boSotSymbols).toEqual([]);
  });

  it('vàng: chưa nhập invested_amount thì vẫn suy từ số lượng × giá mua như cũ', () => {
    const r = tongVonDaBo({
      ...rong,
      golds: [gold({ invested_amount: null, quantity: 2, avg_buy_price: 75_000_000 })],
    });
    expect(r.goldVnd).toBe(150_000_000);
  });

  it('trộn cả hai cách nhập trong cùng một danh mục vẫn cộng đúng', () => {
    const r = tongVonDaBo({
      ...rong,
      golds: [
        gold({ id: 'g1', invested_amount: 7_000_000 }),
        gold({ id: 'g2', quantity: 1, avg_buy_price: 75_000_000 }),
      ],
    });
    expect(r.goldVnd).toBe(82_000_000);
  });
});

import { describe, it, expect } from 'vitest';
import { danhGiaQuyTac, moTaQuyTac, sapXepDanhGia, type PriceRule } from './priceRules';

const rule = (p: Partial<PriceRule>): PriceRule => ({
  id: 'r', asset_kind: 'CRYPTO', symbol: 'BTC', direction: 'ABOVE', price: 160_000,
  action: 'SELL', sell_pct: 50, buy_amount_vnd: null, note: '', active: true, ...p,
});

describe('danhGiaQuyTac', () => {
  it('BTC ≥ 160k bán 50%, giá 61,5k ⇒ chưa chạm, còn cách ~160%, bán 0,0923 BTC', () => {
    const e = danhGiaQuyTac(rule({}), 61_531.7, 0.18457604);
    expect(e.status).toBe('CHUA');
    expect(e.conCachPct).toBeCloseTo((160_000 / 61_531.7 - 1) * 100);
    expect(e.soLuongBan).toBeCloseTo(0.09228802);
  });
  it('BTC ≤ 80k mua ⇒ giá 61,5k đã chạm', () => {
    expect(danhGiaQuyTac(rule({ direction: 'BELOW', price: 80_000, action: 'BUY', sell_pct: null }), 61_531.7, null).status).toBe('CHAM');
  });
  it('đúng bằng ngưỡng là đã chạm (cả hai chiều)', () => {
    expect(danhGiaQuyTac(rule({ price: 45 }), 45, 100).status).toBe('CHAM');
    expect(danhGiaQuyTac(rule({ direction: 'BELOW', price: 45 }), 45, 100).status).toBe('CHAM');
  });
  it('thiếu giá / tắt', () => {
    expect(danhGiaQuyTac(rule({}), null, 1).status).toBe('THIEU_GIA');
    expect(danhGiaQuyTac(rule({ active: false }), 999_999, 1).status).toBe('TAT');
  });
  it('bán % khi chưa có số lượng ⇒ không bịa số lượng bán', () => {
    expect(danhGiaQuyTac(rule({}), 1, null).soLuongBan).toBeNull();
  });
});

it('sapXepDanhGia: chạm trước, rồi gần ngưỡng nhất', () => {
  const ds = sapXepDanhGia([
    danhGiaQuyTac(rule({ id: 'xa', price: 200 }), 100, null),
    danhGiaQuyTac(rule({ id: 'thieu' }), null, null),
    danhGiaQuyTac(rule({ id: 'cham', price: 50 }), 100, null),
    danhGiaQuyTac(rule({ id: 'gan', price: 110 }), 100, null),
  ]);
  expect(ds.map((e) => e.rule.id)).toEqual(['cham', 'gan', 'xa', 'thieu']);
});

it('moTaQuyTac', () => {
  const g = (v: number) => `$${v}`;
  const d = (v: number) => `${v} đ`;
  expect(moTaQuyTac(rule({}), g, d)).toBe('Khi BTC ≥ $160000 → Bán 50%');
  expect(moTaQuyTac(rule({ direction: 'BELOW', action: 'BUY', sell_pct: null, buy_amount_vnd: 5_000_000 }), g, d))
    .toBe('Khi BTC ≤ $160000 → Mua 5000000 đ');
});

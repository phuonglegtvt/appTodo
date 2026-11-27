import { describe, it, expect } from 'vitest';
import { dauThang, thayDoi, tinhTaiSanRong, type NetWorthSnapshot } from './netWorth';

describe('tinhTaiSanRong', () => {
  it('tài sản = cổ phiếu + crypto + vàng + tiền mặt; ròng = tài sản − nợ', () => {
    expect(tinhTaiSanRong({ stocks_vnd: 300, crypto_vnd: 200, gold_vnd: 0, cash_vnd: 10, debt_vnd: 600 }))
      .toEqual({ assets_vnd: 510, net_vnd: -90 });
  });
  it('số rác ⇒ ném lỗi, không lặng lẽ ra NaN', () => {
    expect(() => tinhTaiSanRong({ stocks_vnd: NaN, crypto_vnd: 0, gold_vnd: 0, cash_vnd: 0, debt_vnd: 0 })).toThrow(/stocks_vnd/);
  });
});

it('dauThang', () => {
  expect(dauThang('2026-11-27')).toBe('2026-11-01');
});

describe('thayDoi', () => {
  const s = (month: string, net_vnd: number): NetWorthSnapshot => ({
    month, net_vnd, assets_vnd: net_vnd, stocks_vnd: 0, crypto_vnd: 0, gold_vnd: 0, cash_vnd: 0, debt_vnd: 0,
  });
  it('so với tháng trước gần nhất và tháng đầu', () => {
    const r = thayDoi([s('2026-11-01', 500), s('2026-08-01', 300), s('2026-10-01', 450)], '2026-11-01');
    expect(r).toEqual({ soVoiThangTruoc: 50, thangTruoc: '2026-10-01', tuDauVnd: 200, thangDau: '2026-08-01' });
  });
  it('chỉ có một tháng ⇒ chưa có gì để so', () => {
    expect(thayDoi([s('2026-11-01', 500)], '2026-11-01').soVoiThangTruoc).toBeNull();
  });
});

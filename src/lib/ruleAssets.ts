// Tra giá hiện tại + số đang giữ của một mã, để đánh giá quy tắc giá.
// Hàm thuần. ĐƠN VỊ giữ nguyên như bảng nguồn: cổ phiếu NGHÌN ĐỒNG, crypto USD.

import type { Stock } from '../types/stock';
import type { Crypto } from '../types/crypto';
import type { RuleKind } from './priceRules';

export interface RuleAsset {
  kind: RuleKind;
  symbol: string;
  name: string;
  gia: number | null;
  soLuong: number | null;
}

export function dsTaiSan(stocks: Stock[], cryptos: Crypto[]): RuleAsset[] {
  return [
    ...stocks.map((s) => ({ kind: 'STOCK' as const, symbol: s.ticker.toUpperCase(), name: s.company_name, gia: s.current_price, soLuong: s.quantity })),
    ...cryptos.map((c) => ({ kind: 'CRYPTO' as const, symbol: c.symbol.toUpperCase(), name: c.name, gia: c.current_price, soLuong: c.quantity })),
  ];
}

export function khoaTaiSan(kind: RuleKind, symbol: string): string {
  return `${kind}:${symbol.toUpperCase()}`;
}

/** Định dạng giá theo đơn vị nguồn: cổ phiếu nghìn đồng → hiện đồng; crypto → $. */
export function formatGiaQuyTac(kind: RuleKind, v: number): string {
  return kind === 'STOCK'
    ? Math.round(v * 1000).toLocaleString('vi-VN') + ' đ'
    : '$' + v.toLocaleString('en-US', { maximumFractionDigits: v < 10 ? 4 : 2 });
}

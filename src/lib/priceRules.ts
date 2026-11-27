// Đánh giá quy tắc giá "khi giá ≥/≤ X thì bán p% / mua y đồng / theo dõi"
// so với giá hiện tại (hàm thuần, có test).
//
// ĐƠN VỊ: giá theo đơn vị của bảng nguồn — cổ phiếu NGHÌN ĐỒNG, crypto USD.
// Hàm này không quy đổi gì; chỉ so cùng đơn vị.

export type RuleKind = 'STOCK' | 'CRYPTO';
export type RuleDirection = 'ABOVE' | 'BELOW';
export type RuleAction = 'SELL' | 'BUY' | 'WATCH';

export interface PriceRule {
  id: string;
  asset_kind: RuleKind;
  symbol: string;
  direction: RuleDirection;
  price: number;
  action: RuleAction;
  sell_pct: number | null;
  buy_amount_vnd: number | null;
  note: string;
  active: boolean;
}

export type RuleStatus = 'CHAM' | 'CHUA' | 'THIEU_GIA' | 'TAT';

export interface RuleEval {
  rule: PriceRule;
  status: RuleStatus;
  giaHienTai: number | null;
  /**
   * Giá còn phải đi bao nhiêu % nữa mới chạm ngưỡng (luôn ≥ 0 khi CHUA).
   * VD ngưỡng ≥160k, giá 61k ⇒ +162%. null khi đã chạm / thiếu giá.
   */
  conCachPct: number | null;
  /** Số lượng cần bán khi SELL có % và biết số đang giữ. */
  soLuongBan: number | null;
}

export function danhGiaQuyTac(
  rule: PriceRule,
  giaHienTai: number | null,
  soLuongDangGiu: number | null,
): RuleEval {
  const soLuongBan = rule.action === 'SELL' && rule.sell_pct !== null && soLuongDangGiu !== null && soLuongDangGiu > 0
    ? (soLuongDangGiu * rule.sell_pct) / 100
    : null;
  if (!rule.active) return { rule, status: 'TAT', giaHienTai, conCachPct: null, soLuongBan };
  if (giaHienTai === null || !(giaHienTai > 0)) return { rule, status: 'THIEU_GIA', giaHienTai: null, conCachPct: null, soLuongBan };

  const cham = rule.direction === 'ABOVE' ? giaHienTai >= rule.price : giaHienTai <= rule.price;
  if (cham) return { rule, status: 'CHAM', giaHienTai, conCachPct: null, soLuongBan };
  const conCachPct = Math.abs(rule.price / giaHienTai - 1) * 100;
  return { rule, status: 'CHUA', giaHienTai, conCachPct, soLuongBan };
}

/** Sắp: đã chạm trước, rồi chưa chạm theo khoảng cách gần nhất, cuối là thiếu giá / tắt. */
export function sapXepDanhGia(list: RuleEval[]): RuleEval[] {
  const hang: Record<RuleStatus, number> = { CHAM: 0, CHUA: 1, THIEU_GIA: 2, TAT: 3 };
  return [...list].sort((a, b) =>
    hang[a.status] - hang[b.status]
    || (a.conCachPct ?? 0) - (b.conCachPct ?? 0)
    || a.rule.symbol.localeCompare(b.rule.symbol));
}

/** Câu mô tả ngắn: "Khi BTC ≥ $160,000 → Bán 50%". */
export function moTaQuyTac(r: PriceRule, formatGia: (v: number) => string, formatVnd: (v: number) => string): string {
  const dk = `${r.symbol} ${r.direction === 'ABOVE' ? '≥' : '≤'} ${formatGia(r.price)}`;
  const lam = r.action === 'SELL'
    ? `Bán${r.sell_pct !== null ? ` ${r.sell_pct.toLocaleString('vi-VN')}%` : ''}`
    : r.action === 'BUY'
      ? `Mua${r.buy_amount_vnd !== null ? ` ${formatVnd(r.buy_amount_vnd)}` : ''}`
      : 'Theo dõi';
  return `Khi ${dk} → ${lam}`;
}

import type { RiskProfile, Stock, StockGroup } from '../types/stock';

/**
 * Thứ tự hiển thị các nhóm, dùng chung cho bảng và tổng quan. Dài hạn đứng ĐẦU
 * (yêu cầu 2026-11-26): đây là phần nắm giữ chính, xem trước tiên.
 */
export const STOCK_GROUPS: StockGroup[] = ['longterm', 'attack', 'balance', 'defense'];

export const RISK_PROFILES: RiskProfile[] = ['attack', 'balance', 'defense'];

export interface GroupWeights {
  /**
   * Tổng vốn đã đầu tư, đơn vị NGHÌN ĐỒNG (đúng đơn vị `stocks.invested_amount`).
   * Tên có đơn vị trong nó là cố ý: `total` trần đã một lần bị đọc là "đồng" rồi
   * hiển thị nhỏ đi 1.000 lần.
   */
  totalThousandVnd: number;
  /** `amount` cũng theo NGHÌN ĐỒNG; `percent` không phụ thuộc đơn vị. */
  byGroup: Record<StockGroup, { amount: number; percent: number }>;
}

/**
 * Tỷ suất cổ tức (%) = dividend (đồng) / (price_threshold nghìn đồng × 1000) × 100.
 * Trả null nếu thiếu dữ liệu hoặc giá ngưỡng = 0 (tránh chia cho 0).
 */
export function computeYield(
  stock: Pick<Stock, 'dividend' | 'price_threshold'>,
): number | null {
  const { dividend, price_threshold } = stock;
  if (dividend == null || price_threshold == null || price_threshold === 0) return null;
  return (dividend / (price_threshold * 1000)) * 100;
}

/** Tổng vốn đã đầu tư (NGHÌN ĐỒNG) và % mỗi nhóm theo invested_amount (bỏ qua mã chưa nhập). */
export function groupWeights(stocks: Stock[]): GroupWeights {
  const amounts: Record<StockGroup, number> = { attack: 0, balance: 0, defense: 0, longterm: 0 };
  for (const s of stocks) {
    if (s.invested_amount != null) amounts[s.group] += s.invested_amount;
  }
  const totalThousandVnd = STOCK_GROUPS.reduce((s, g) => s + amounts[g], 0);
  const byGroup = {} as GroupWeights['byGroup'];
  for (const g of STOCK_GROUPS) {
    byGroup[g] = {
      amount: amounts[g],
      percent: totalThousandVnd === 0 ? 0 : (amounts[g] / totalThousandVnd) * 100,
    };
  }
  return { totalThousandVnd, byGroup };
}

/**
 * 3 khẩu vị rủi ro, % cho Tấn công / Cân bằng / Phòng thủ / Dài hạn.
 * Chốt 2026-11-26 khi thêm nhóm Dài hạn: mọi khẩu vị dành 20% cho dài hạn, 80%
 * còn lại giữ đúng thứ tự rủi ro cũ (trước đó 30/30/40 · 20/40/40 · 10/40/50).
 */
export const TARGET_PROFILES: Record<RiskProfile, Record<StockGroup, number>> = {
  attack: { attack: 25, balance: 25, defense: 30, longterm: 20 },
  balance: { attack: 15, balance: 35, defense: 30, longterm: 20 },
  defense: { attack: 5, balance: 35, defense: 40, longterm: 20 },
};

/** Chênh lệch (thực tế − mục tiêu) theo % cho từng nhóm. */
export function compareToTarget(
  weights: GroupWeights,
  profile: RiskProfile,
): Record<StockGroup, number> {
  const target = TARGET_PROFILES[profile];
  const diff = {} as Record<StockGroup, number>;
  for (const g of STOCK_GROUPS) {
    diff[g] = weights.byGroup[g].percent - target[g];
  }
  return diff;
}

/** Mã "chạm ngưỡng" khi giá hiện tại đã về tới/dưới giá ngưỡng tích sản. */
export function isBelowThreshold(
  stock: Pick<Stock, 'current_price' | 'price_threshold'>,
): boolean {
  const { current_price, price_threshold } = stock;
  return current_price != null && price_threshold != null && current_price <= price_threshold;
}

/** Mã "đắt": giá hiện tại đã vượt trên giá bảo vệ tích sản. */
export function isAboveProtect(
  stock: Pick<Stock, 'current_price' | 'price_protect'>,
): boolean {
  const { current_price, price_protect } = stock;
  return current_price != null && price_protect != null && current_price > price_protect;
}

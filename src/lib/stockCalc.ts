import type { Stock, StockGroup } from '../types/stock';

const GROUPS: StockGroup[] = ['attack', 'balance', 'defense'];

export interface GroupWeights {
  total: number;
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

/** Tổng vốn đã đầu tư và % mỗi nhóm theo invested_amount (bỏ qua mã chưa nhập). */
export function groupWeights(stocks: Stock[]): GroupWeights {
  const amounts: Record<StockGroup, number> = { attack: 0, balance: 0, defense: 0 };
  for (const s of stocks) {
    if (s.invested_amount != null) amounts[s.group] += s.invested_amount;
  }
  const total = amounts.attack + amounts.balance + amounts.defense;
  const byGroup = {} as GroupWeights['byGroup'];
  for (const g of GROUPS) {
    byGroup[g] = {
      amount: amounts[g],
      percent: total === 0 ? 0 : (amounts[g] / total) * 100,
    };
  }
  return { total, byGroup };
}

/** 3 khẩu vị rủi ro đã chốt (theo hàng trên ảnh AzFin), % cho TC/CB/PT. */
export const TARGET_PROFILES: Record<StockGroup, Record<StockGroup, number>> = {
  attack: { attack: 30, balance: 30, defense: 40 },
  balance: { attack: 20, balance: 40, defense: 40 },
  defense: { attack: 10, balance: 40, defense: 50 },
};

/** Chênh lệch (thực tế − mục tiêu) theo % cho từng nhóm. */
export function compareToTarget(
  weights: GroupWeights,
  profile: StockGroup,
): Record<StockGroup, number> {
  const target = TARGET_PROFILES[profile];
  const diff = {} as Record<StockGroup, number>;
  for (const g of GROUPS) {
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

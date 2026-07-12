import type { Crypto } from '../types/crypto';

/** Vốn = số lượng × giá mua TB (USD). Null nếu thiếu dữ liệu. */
export function cost(c: Pick<Crypto, 'quantity' | 'avg_buy_price'>): number | null {
  return c.quantity != null && c.avg_buy_price != null ? c.quantity * c.avg_buy_price : null;
}

/** Giá trị hiện tại = số lượng × giá hiện tại (USD). Null nếu thiếu dữ liệu. */
export function value(c: Pick<Crypto, 'quantity' | 'current_price'>): number | null {
  return c.quantity != null && c.current_price != null ? c.quantity * c.current_price : null;
}

/** Lời/lỗ = giá trị hiện tại − vốn (USD). Null nếu thiếu một trong hai. */
export function pnl(
  c: Pick<Crypto, 'quantity' | 'avg_buy_price' | 'current_price'>,
): number | null {
  const v = value(c);
  const co = cost(c);
  return v != null && co != null ? v - co : null;
}

/** % lời/lỗ = pnl / cost × 100. Null nếu thiếu dữ liệu hoặc cost ≤ 0 (tránh chia cho 0). */
export function pnlPercent(
  c: Pick<Crypto, 'quantity' | 'avg_buy_price' | 'current_price'>,
): number | null {
  const co = cost(c);
  const p = pnl(c);
  return co != null && co > 0 && p != null ? (p / co) * 100 : null;
}

export interface PortfolioTotals {
  totalCost: number;
  totalValue: number;
  totalPnl: number;
  totalPnlPercent: number | null;
}

/** Tổng danh mục theo USD; bỏ qua coin thiếu dữ liệu. */
export function portfolioTotals(list: Crypto[]): PortfolioTotals {
  let totalCost = 0;
  let totalValue = 0;
  for (const c of list) {
    const co = cost(c);
    if (co != null) totalCost += co;
    const v = value(c);
    if (v != null) totalValue += v;
  }
  const totalPnl = totalValue - totalCost;
  const totalPnlPercent = totalCost > 0 ? (totalPnl / totalCost) * 100 : null;
  return { totalCost, totalValue, totalPnl, totalPnlPercent };
}

/** Tỷ trọng coin theo giá trị hiện tại (%). Null nếu thiếu value hoặc tổng = 0. */
export function allocationPercent(c: Crypto, totalValue: number): number | null {
  const v = value(c);
  return v != null && totalValue > 0 ? (v / totalValue) * 100 : null;
}

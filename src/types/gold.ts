/**
 * Một dòng vàng đang giữ (`public.golds`).
 *
 * ⚠️ ĐƠN VỊ khác `stocks`: `avg_buy_price` và `current_price` là **ĐỒNG trên một
 * lượng**, KHÔNG phải nghìn đồng. Cố tình khác vì giá một lượng vàng cỡ 90 triệu —
 * viết bằng nghìn đồng vừa dài vừa dễ nhầm với giá cổ phiếu.
 */
export interface Gold {
  id: string;
  user_id: string;
  /** Nhãn tự do: 'SJC 1 lượng', 'Nhẫn trơn 9999'... KHÔNG phải mã sàn. */
  label: string;
  /** Số lượng (lượng). `null` = CHƯA NHẬP, khác hẳn 0 = đã bán hết. */
  quantity: number | null;
  avg_buy_price: number | null;
  current_price: number | null;
  /**
   * Tổng tiền ĐÃ BỎ VÀO, **VND (đồng) tuyệt đối** (cùng đơn vị hai cột giá ở
   * trên, khác `stocks.invested_amount` lưu nghìn đồng).
   * `null` = CHƯA NHẬP, khác hẳn 0.
   */
  invested_amount: number | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

/** Dữ liệu để thêm một dòng vàng mới. */
export interface NewGold {
  label: string;
  quantity?: number | null;
  avg_buy_price?: number | null;
  current_price?: number | null;
  invested_amount?: number | null;
}

/** Các trường được phép sửa. */
export type GoldUpdate = Partial<
  Pick<Gold, 'label' | 'quantity' | 'avg_buy_price' | 'current_price' | 'invested_amount' | 'sort_order'>
>;

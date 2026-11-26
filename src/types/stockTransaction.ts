import type { TxSide } from '../lib/cryptoTransaction';

/** Một dòng `public.stock_transactions`. Tiền và giá theo NGHÌN ĐỒNG. */
export interface StockTransaction {
  id: string;
  user_id: string;
  stock_id: string;
  side: TxSide;
  /** Ngày giao dịch, dạng YYYY-MM-DD. */
  trade_date: string;
  quantity: number;
  price_thousand: number;
  amount_thousand: number;
  note: string;
  before_quantity: number | null;
  before_invested_amount: number | null;
  after_quantity: number | null;
  after_invested_amount: number | null;
  /** Lãi/lỗ đã chốt (nghìn đồng) — chỉ lệnh BÁN, và chỉ khi biết vốn. */
  realized_pnl_thousand: number | null;
  created_at: string;
}

/** Dữ liệu người dùng nhập cho một giao dịch mới. */
export interface NewStockTransaction {
  side: TxSide;
  trade_date: string;
  quantity: number;
  price_thousand: number;
  amount_thousand: number;
  note: string;
}

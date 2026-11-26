import type { TxSide } from '../lib/cryptoTransaction';

/** Một dòng `public.crypto_transactions` (đơn vị: xem migration 2026-11-26). */
export interface CryptoTransaction {
  id: string;
  user_id: string;
  crypto_id: string;
  side: TxSide;
  /** Ngày giao dịch, dạng YYYY-MM-DD. */
  trade_date: string;
  quantity: number;
  price_usd: number;
  amount_vnd: number;
  note: string;
  before_quantity: number | null;
  before_avg_buy_price: number | null;
  before_invested_amount: number | null;
  after_quantity: number | null;
  after_avg_buy_price: number | null;
  after_invested_amount: number | null;
  /** Lãi/lỗ đã chốt (đồng) — chỉ lệnh BÁN, và chỉ khi biết vốn. */
  realized_pnl_vnd: number | null;
  created_at: string;
}

/** Dữ liệu người dùng nhập cho một giao dịch mới. */
export interface NewCryptoTransaction {
  crypto_id: string;
  side: TxSide;
  trade_date: string;
  quantity: number;
  price_usd: number;
  amount_vnd: number;
  note: string;
}

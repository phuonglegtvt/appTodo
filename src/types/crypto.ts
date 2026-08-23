export type Currency = 'USD' | 'VND';

export interface Crypto {
  id: string;
  user_id: string;
  symbol: string;
  name: string;
  quantity: number | null;
  avg_buy_price: number | null;
  current_price: number | null;
  /**
   * Đỉnh lịch sử (ATH), USD (cùng đơn vị `current_price`). `null` = CHƯA BIẾT,
   * khác hẳn 0. Lấy từ trường `ath` của CoinGecko, vẫn sửa tay được; mọi đường
   * ghi đi qua `nextPeak` để đỉnh chỉ tăng.
   */
  peak_price: number | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

/** Dữ liệu để thêm một coin mới (giá hiện tại điền sau qua "Cập nhật giá"). */
export interface NewCrypto {
  symbol: string;
  name?: string;
  quantity?: number | null;
  avg_buy_price?: number | null;
  current_price?: number | null;
  peak_price?: number | null;
}

/** Các trường được phép sửa. */
export type CryptoUpdate = Partial<
  Pick<Crypto, 'symbol' | 'name' | 'quantity' | 'avg_buy_price' | 'current_price' | 'peak_price' | 'sort_order'>
>;

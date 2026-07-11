export type StockGroup = 'attack' | 'balance' | 'defense';

export interface Stock {
  id: string;
  user_id: string;
  ticker: string;
  company_name: string;
  group: StockGroup;
  price_threshold: number | null;
  price_protect: number | null;
  current_price: number | null;
  dividend: number | null;
  invested_amount: number | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

/** Dữ liệu để thêm một mã mới (giá hiện tại điền sau qua "Cập nhật giá" hoặc sửa inline). */
export interface NewStock {
  ticker: string;
  company_name: string;
  group: StockGroup;
  price_threshold?: number | null;
  price_protect?: number | null;
  current_price?: number | null;
  dividend?: number | null;
  invested_amount?: number | null;
}

/** Các trường được phép sửa. */
export type StockUpdate = Partial<
  Pick<
    Stock,
    | 'ticker'
    | 'company_name'
    | 'group'
    | 'price_threshold'
    | 'price_protect'
    | 'current_price'
    | 'dividend'
    | 'invested_amount'
    | 'sort_order'
  >
>;

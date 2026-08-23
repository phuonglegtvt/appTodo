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
  /**
   * Số cổ phiếu đang giữ. `null` = CHƯA NHẬP (khác hẳn 0 = đã bán hết) — tab
   * Danh mục phải phân biệt hai ca này, không được coi null là 0 đồng.
   * Cần cột này mới tính được giá trị thị trường: `invested_amount` chỉ nói đã
   * bỏ vào bao nhiêu tiền, không nói đang giữ bao nhiêu cổ.
   */
  quantity: number | null;
  /**
   * Đỉnh lịch sử, NGHÌN ĐỒNG (cùng đơn vị `current_price`). `null` = CHƯA BIẾT —
   * khác hẳn 0. Cột này được nút "Cập nhật giá" ghi tự động nhưng vẫn sửa tay
   * được, và mọi đường ghi phải đi qua `nextPeak` để đỉnh chỉ tăng, không giảm.
   */
  peak_price: number | null;
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
  quantity?: number | null;
  peak_price?: number | null;
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
    | 'quantity'
    | 'peak_price'
    | 'sort_order'
  >
>;

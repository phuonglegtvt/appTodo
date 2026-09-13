/**
 * Một khoản thu hoặc chi (`public.cash_entries`).
 *
 * ⚠️ ĐƠN VỊ: `amount_vnd` là VND (đồng) TUYỆT ĐỐI — khác `stocks` lưu nghìn đồng.
 * ⚠️ `amount_vnd` LUÔN DƯƠNG. Chiều tiền nằm ở `kind`, không nằm ở dấu.
 */
export type CashKind = 'THU' | 'CHI';

export interface CashEntry {
  id: string;
  user_id: string;
  /** Ngày phát sinh, dạng 'YYYY-MM-DD'. Không phải ngày gõ vào app. */
  occurred_on: string;
  kind: CashKind;
  /** Khoá danh mục, xem `src/lib/cashCategories.ts`. */
  category: string;
  amount_vnd: number;
  note: string;
  created_at: string;
  updated_at: string;
}

/** Dữ liệu để thêm một khoản mới. */
export interface NewCashEntry {
  occurred_on: string;
  kind: CashKind;
  category: string;
  amount_vnd: number;
  note?: string;
}

/** Các trường được phép sửa. */
export type CashEntryUpdate = Partial<
  Pick<CashEntry, 'occurred_on' | 'kind' | 'category' | 'amount_vnd' | 'note'>
>;

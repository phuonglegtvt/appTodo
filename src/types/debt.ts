/** Loại nợ: thẻ tín dụng hoặc khoản vay. */
export type DebtKind = 'CARD' | 'LOAN';

/** Một dòng `public.debts`. Mọi số tiền là ĐỒNG tuyệt đối; lãi/phí là %. */
export interface Debt {
  id: string;
  user_id: string;
  kind: DebtKind;
  name: string;
  balance_vnd: number;
  credit_limit_vnd: number | null;
  interest_rate_pct: number | null;
  monthly_payment_vnd: number | null;
  /** Ngày sao kê trong tháng (1–31). */
  statement_day: number | null;
  /** Ngày đến hạn thanh toán trong tháng (1–31). */
  due_day: number | null;
  /** Thẻ có đáo hạn hàng tháng (rút ra trả rồi quẹt lại) không. */
  rolls_over: boolean;
  /** Phí đáo hạn, % trên dư nợ mỗi lần. */
  rollover_fee_pct: number | null;
  /** Ngày tất toán khoản vay, YYYY-MM-DD. */
  end_date: string | null;
  note: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export type NewDebt = Pick<Debt, 'kind' | 'name'> & Partial<Omit<Debt, 'id' | 'user_id' | 'kind' | 'name' | 'created_at' | 'updated_at'>>;

export type DebtUpdate = Partial<Omit<Debt, 'id' | 'user_id' | 'created_at' | 'updated_at'>>;

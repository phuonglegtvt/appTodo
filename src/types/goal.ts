export type Horizon = 'five_year' | 'year' | 'month' | 'week';

/** Horizon dùng cho UI: thêm 'day' (tầng Ngày không có Goal riêng, tái dùng todos). */
export type ViewHorizon = Horizon | 'day';

export interface Goal {
  id: string;
  user_id: string;
  horizon: Horizon;
  period_key: string; // '2025' (five_year, năm đầu khối) | '2026' (year) | '2026-07' (month) | '2026-W28' (week)
  title: string;
  is_done: boolean;
  created_at: string;
  updated_at: string;
}

/** Dữ liệu để tạo mục tiêu mới. Mục tiêu giờ là danh sách chung (không theo kỳ). */
export interface NewGoal {
  title: string;
}

/** Các trường được phép sửa. */
export type GoalUpdate = Partial<Pick<Goal, 'title' | 'is_done'>>;

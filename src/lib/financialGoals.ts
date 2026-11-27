// Mục tiêu tài chính: cần góp bao nhiêu mỗi tháng, với số đang góp thì đến hạn
// được bao nhiêu (hàm thuần, có test). Lãi ghép hàng tháng, góp cuối mỗi tháng
// — cùng quy ước với máy tính lãi kép (compoundInterest.ts).
// ĐƠN VỊ: đồng; lãi %/năm. Hôm nay truyền vào qua tham số.

export interface FinancialGoal {
  id: string;
  name: string;
  target_amount_vnd: number;
  target_date: string;
  saved_vnd: number;
  monthly_contribution_vnd: number;
  expected_return_pct: number;
  note: string;
}

/** Số tháng trọn từ `tu` tới `den` (YYYY-MM-DD), không âm. */
export function soThangConLai(tu: string, den: string): number {
  const [y1, m1, d1] = tu.split('-').map(Number);
  const [y2, m2, d2] = den.split('-').map(Number);
  const n = (y2 - y1) * 12 + (m2 - m1) - (d2 < d1 ? 1 : 0);
  return Math.max(0, n);
}

/** Giá trị sau n tháng: gốc ghép lãi + góp đều cuối tháng. */
export function giaTriTuongLai(goc: number, gopThang: number, laiNamPct: number, n: number): number {
  const i = laiNamPct / 100 / 12;
  if (i === 0) return goc + gopThang * n;
  const f = Math.pow(1 + i, n);
  return goc * f + gopThang * ((f - 1) / i);
}

/** Số tiền cần góp mỗi tháng để sau n tháng đạt `dich`. 0 nếu gốc đã đủ. */
export function canGopThang(goc: number, dich: number, laiNamPct: number, n: number): number | null {
  if (n <= 0) return goc >= dich ? 0 : null; // hết hạn mà chưa đủ ⇒ không góp kịp
  const i = laiNamPct / 100 / 12;
  const f = i === 0 ? 1 : Math.pow(1 + i, n);
  const conThieu = dich - goc * f;
  if (conThieu <= 0) return 0;
  return i === 0 ? conThieu / n : (conThieu * i) / (f - 1);
}

export interface GoalStatus {
  soThang: number;
  /** % đã có so với đích. */
  tienDoPct: number;
  canGop: number | null;
  /** Với số đang góp, đến hạn được bao nhiêu. */
  duKien: number;
  kip: boolean;
  /** Thiếu/thừa so với đích nếu giữ số đang góp (dương = thừa). */
  chenhLech: number;
}

export function danhGiaMucTieu(g: FinancialGoal, homNay: string): GoalStatus {
  const soThang = soThangConLai(homNay, g.target_date);
  const duKien = giaTriTuongLai(g.saved_vnd, g.monthly_contribution_vnd, g.expected_return_pct, soThang);
  return {
    soThang,
    tienDoPct: Math.min(100, (g.saved_vnd / g.target_amount_vnd) * 100),
    canGop: canGopThang(g.saved_vnd, g.target_amount_vnd, g.expected_return_pct, soThang),
    duKien,
    kip: duKien >= g.target_amount_vnd - 0.5,
    chenhLech: duKien - g.target_amount_vnd,
  };
}

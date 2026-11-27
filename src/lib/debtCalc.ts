// Tính toán cho tab "Nợ" (hàm thuần, có test). Hôm nay truyền vào qua tham số
// để test tái lập được.
//
// ĐƠN VỊ: tiền là ĐỒNG; lãi suất và phí là % (4,5 = 4,5%).

import type { Debt } from '../types/debt';

/** Số ngày của tháng (month 1–12). */
function soNgayTrongThang(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

function iso(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/**
 * Ngày đến hạn KẾ TIẾP (kể cả hôm nay) của một "ngày trong tháng".
 * Tháng ngắn hơn ngày đó (31 vào tháng 2) ⇒ lấy ngày cuối tháng.
 */
export function ngayDenHanKeTiep(day: number, homNay: string): string {
  const [y, m, d] = homNay.split('-').map(Number);
  const trongThang = Math.min(day, soNgayTrongThang(y, m));
  if (trongThang >= d) return iso(y, m, trongThang);
  const [y2, m2] = m === 12 ? [y + 1, 1] : [y, m + 1];
  return iso(y2, m2, Math.min(day, soNgayTrongThang(y2, m2)));
}

/** Số ngày từ `tu` tới `den` (YYYY-MM-DD). */
export function soNgayGiua(tu: string, den: string): number {
  return Math.round((Date.parse(den + 'T00:00:00Z') - Date.parse(tu + 'T00:00:00Z')) / 86_400_000);
}

export interface DebtSummary {
  /** Tổng dư nợ mọi khoản. */
  tongDuNo: number;
  tongDuNoThe: number;
  tongDuNoVay: number;
  /** Tổng hạn mức các thẻ ĐÃ nhập hạn mức. */
  tongHanMuc: number;
  /** % dư nợ thẻ / hạn mức (chỉ tính thẻ có hạn mức). null = chưa có hạn mức nào. */
  tyLeSuDungThe: number | null;
  /** Tổng số định trả mỗi tháng (các khoản đã nhập). */
  phaiTraThang: number;
  /** Ước lãi một tháng = dư nợ × lãi suất / 12 (chỉ khoản có lãi suất). */
  laiUocThang: number;
  /** Ước phí đáo hạn một tháng = dư nợ × phí% (chỉ thẻ đánh dấu đáo hạn). */
  phiDaoHanThang: number;
  /** Chi phí nợ cả năm = (lãi + phí đáo hạn) × 12 — chi phí THẬT phải trả cho việc vay. */
  chiPhiNam: number;
}

export function tongHopNo(debts: Debt[]): DebtSummary {
  let tongDuNoThe = 0;
  let tongDuNoVay = 0;
  let tongHanMuc = 0;
  let duNoTheCoHanMuc = 0;
  let phaiTraThang = 0;
  let laiUocThang = 0;
  let phiDaoHanThang = 0;

  for (const d of debts) {
    const duNo = Number(d.balance_vnd) || 0;
    if (d.kind === 'CARD') {
      tongDuNoThe += duNo;
      if (d.credit_limit_vnd !== null && d.credit_limit_vnd > 0) {
        tongHanMuc += Number(d.credit_limit_vnd);
        duNoTheCoHanMuc += duNo;
      }
      if (d.rolls_over && d.rollover_fee_pct !== null) phiDaoHanThang += (duNo * Number(d.rollover_fee_pct)) / 100;
    } else {
      tongDuNoVay += duNo;
    }
    if (d.monthly_payment_vnd !== null) phaiTraThang += Number(d.monthly_payment_vnd);
    if (d.interest_rate_pct !== null) laiUocThang += (duNo * Number(d.interest_rate_pct)) / 100 / 12;
  }

  return {
    tongDuNo: tongDuNoThe + tongDuNoVay,
    tongDuNoThe,
    tongDuNoVay,
    tongHanMuc,
    tyLeSuDungThe: tongHanMuc > 0 ? (duNoTheCoHanMuc / tongHanMuc) * 100 : null,
    phaiTraThang,
    laiUocThang,
    phiDaoHanThang,
    chiPhiNam: (laiUocThang + phiDaoHanThang) * 12,
  };
}

export interface SapDenHan {
  debt: Debt;
  ngay: string;
  conNgay: number;
}

/** Các khoản có ngày đến hạn trong `trongVong` ngày tới, gần nhất trước. */
export function sapDenHan(debts: Debt[], homNay: string, trongVong = 7): SapDenHan[] {
  return debts
    .filter((d) => d.due_day !== null && Number(d.balance_vnd) > 0)
    .map((d) => {
      const ngay = ngayDenHanKeTiep(d.due_day as number, homNay);
      return { debt: d, ngay, conNgay: soNgayGiua(homNay, ngay) };
    })
    .filter((x) => x.conNgay <= trongVong)
    .sort((a, b) => a.conNgay - b.conNgay);
}

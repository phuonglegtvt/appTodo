// Ngân sách, khoản định kỳ, báo cáo năm cho tab Thu–Chi (hàm thuần, có test).
// ĐƠN VỊ: đồng. Tháng dạng 'YYYY-MM'. Không dùng Date() để tránh lệch múi giờ
// (xem ghi chú đầu cashFlow.ts) — trừ hàm tính số ngày trong tháng, chỉ dùng UTC.

import type { CashEntry, CashKind, NewCashEntry } from '../types/cashEntry';
import { laDauTu, laVongTien } from './cashCategories';
import { locTheoThang, tongHop, type TongHopThang } from './cashFlow';

// ---------------------------------------------------------------------------
// Ngân sách
// ---------------------------------------------------------------------------

export interface DongNganSach {
  category: string;
  nganSach: number;
  daChi: number;
  /** % đã dùng; > 100 = vượt. */
  pct: number;
  conLai: number;
}

/** So chi tiêu THẬT của tháng với ngân sách từng danh mục. */
export function soSanhNganSach(entries: CashEntry[], thang: string, budgets: Record<string, number>): DongNganSach[] {
  const chiTheoMuc = new Map<string, number>();
  for (const e of locTheoThang(entries, thang)) {
    if (e.kind !== 'CHI') continue;
    chiTheoMuc.set(e.category, (chiTheoMuc.get(e.category) ?? 0) + Number(e.amount_vnd));
  }
  return Object.entries(budgets)
    .filter(([, v]) => v > 0)
    .map(([category, nganSach]) => {
      const daChi = chiTheoMuc.get(category) ?? 0;
      return { category, nganSach, daChi, pct: (daChi / nganSach) * 100, conLai: nganSach - daChi };
    })
    .sort((a, b) => b.pct - a.pct);
}

// ---------------------------------------------------------------------------
// Khoản định kỳ
// ---------------------------------------------------------------------------

export interface KhoanDinhKy {
  id: string;
  kind: CashKind;
  category: string;
  amount_vnd: number;
  day_of_month: number;
  note: string;
  active: boolean;
}

function soNgayTrongThang(thang: string): number {
  const [y, m] = thang.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/**
 * Các dòng cần tạo cho tháng `thang` từ khoản định kỳ đang bật mà CHƯA được ghi
 * trong tháng đó (nhận biết qua `recurring_id`). Ngày 31 vào tháng ngắn ⇒ ngày
 * cuối tháng.
 */
export function canGhiDinhKy(
  ds: KhoanDinhKy[],
  entries: (CashEntry & { recurring_id?: string | null })[],
  thang: string,
): (NewCashEntry & { recurring_id: string })[] {
  const daGhi = new Set(locTheoThang(entries, thang).map((e) => e.recurring_id).filter((x): x is string => !!x));
  const cuoi = soNgayTrongThang(thang);
  return ds
    .filter((k) => k.active && !daGhi.has(k.id))
    .map((k) => ({
      occurred_on: `${thang}-${String(Math.min(k.day_of_month, cuoi)).padStart(2, '0')}`,
      kind: k.kind,
      category: k.category,
      amount_vnd: Number(k.amount_vnd),
      note: k.note,
      recurring_id: k.id,
    }));
}

// ---------------------------------------------------------------------------
// Báo cáo năm
// ---------------------------------------------------------------------------

export interface BaoCaoNam {
  thang: (TongHopThang & { thang: string })[];
  tong: TongHopThang;
  /** Chi THẬT theo danh mục cả năm (không gồm vòng tiền, đầu tư), lớn trước. */
  chiTheoMuc: { category: string; amount: number; pct: number }[];
}

export function baoCaoNam(entries: CashEntry[], nam: number): BaoCaoNam {
  const cuaNam = entries.filter((e) => e.occurred_on.startsWith(`${nam}-`));
  const thang = Array.from({ length: 12 }, (_, i) => {
    const t = `${nam}-${String(i + 1).padStart(2, '0')}`;
    return { thang: t, ...tongHop(locTheoThang(cuaNam, t)) };
  });
  const tong = tongHop(cuaNam);
  const theoMuc = new Map<string, number>();
  for (const e of cuaNam) {
    if (e.kind !== 'CHI' || laVongTien(e.category) || laDauTu(e.category)) continue;
    theoMuc.set(e.category, (theoMuc.get(e.category) ?? 0) + Number(e.amount_vnd));
  }
  const chiTheoMuc = [...theoMuc.entries()]
    .map(([category, amount]) => ({ category, amount, pct: tong.chi > 0 ? (amount / tong.chi) * 100 : 0 }))
    .sort((a, b) => b.amount - a.amount);
  return { thang, tong, chiTheoMuc };
}

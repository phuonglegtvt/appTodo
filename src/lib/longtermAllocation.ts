// Phân bổ tiền mới cho nhóm "Đầu tư dài hạn" theo tỷ trọng mục tiêu từng mã
// (hàm thuần, có test). Ví dụ: E1VFVN30 20%, mỗi mã còn lại 10%; nhập X đồng
// → mua thêm bao nhiêu cổ mỗi mã.
//
// CÁCH CHIA — giống engine của tab Danh mục (src/domain/allocate.ts):
//   tổng sau khi nạp T = Σ giá trị đang có + X
//   khoảng thiếu mã i:  gap_i = max(0, mục tiêu_i × T − giá trị_i)
//   tiền cho mã i:      X × gap_i / Σ gap
// · X đủ (không mã nào đang vượt mục tiêu) ⇒ Σ gap = X ⇒ mọi mã về ĐÚNG mục tiêu.
// · Có mã đang vượt ⇒ mã đó nhận 0 (KHÔNG bán), phần còn lại chia theo tỷ lệ thiếu.
// Sau đó làm tròn XUỐNG theo bước mua (1 cổ hoặc lô 100), tiền lẻ còn lại dùng
// mua thêm từng bước cho mã đang thiếu nhiều nhất mà còn đủ tiền.
//
// ĐƠN VỊ: mọi số tiền và giá ở đây là ĐỒNG. Bảng `stocks` lưu giá theo nghìn
// đồng — đổi ở tầng gọi, không ở đây.

export interface AllocationItem {
  id: string;
  ticker: string;
  /** Giá hiện tại, đồng/cổ. null = chưa có giá. */
  priceVnd: number | null;
  /** Số cổ đang giữ (null coi là 0). */
  quantity: number | null;
  /** Tỷ trọng mục tiêu, % (20 = 20%). */
  targetPct: number;
}

export interface AllocationRow {
  id: string;
  ticker: string;
  priceVnd: number;
  quantity: number;
  valueVnd: number;
  currentPct: number;
  targetPct: number;
  buyShares: number;
  buyVnd: number;
  afterQuantity: number;
  afterValueVnd: number;
  afterPct: number;
}

export interface AllocationPlan {
  rows: AllocationRow[];
  totalBeforeVnd: number;
  cashVnd: number;
  spentVnd: number;
  leftoverVnd: number;
  totalAfterVnd: number;
  /**
   * Số tiền tối thiểu để MỌI mã về đúng mục tiêu mà không bán gì.
   * 0 khi đang đúng sẵn.
   */
  neededForExactVnd: number;
}

const EPS = 1e-9;

/** Tỷ trọng mặc định: E1VFVN30 20%, phần còn lại chia đều cho các mã khác. */
export function defaultTargets(tickers: { id: string; ticker: string }[]): Record<string, number> {
  const out: Record<string, number> = {};
  if (tickers.length === 0) return out;
  const etf = tickers.find((t) => t.ticker.toUpperCase() === 'E1VFVN30');
  if (etf && tickers.length > 1) {
    const moi = 80 / (tickers.length - 1);
    for (const t of tickers) out[t.id] = t.id === etf.id ? 20 : moi;
  } else {
    for (const t of tickers) out[t.id] = 100 / tickers.length;
  }
  return out;
}

export function lapKeHoachPhanBo(items: AllocationItem[], cashVnd: number, lotSize: number): AllocationPlan {
  if (!Number.isFinite(cashVnd) || cashVnd < 0) throw new Error('Số tiền phải là số không âm.');
  if (!Number.isInteger(lotSize) || lotSize < 1) throw new Error('Bước mua phải là số nguyên ≥ 1.');
  if (items.length === 0) throw new Error('Nhóm Đầu tư dài hạn chưa có mã nào.');

  for (const it of items) {
    if (!Number.isFinite(it.targetPct) || it.targetPct < 0) {
      throw new Error(`Tỷ trọng mục tiêu của ${it.ticker} phải là số ≥ 0.`);
    }
  }
  const tongMucTieu = items.reduce((s, it) => s + it.targetPct, 0);
  if (Math.abs(tongMucTieu - 100) > 0.01) {
    throw new Error(`Tổng tỷ trọng mục tiêu đang là ${tongMucTieu.toLocaleString('vi-VN', { maximumFractionDigits: 2 })}%, phải bằng 100%.`);
  }
  const thieuGia = items.filter((it) => it.targetPct > 0 && (it.priceVnd === null || !(it.priceVnd > 0)));
  if (thieuGia.length > 0) {
    throw new Error(`Chưa có giá hiện tại của ${thieuGia.map((t) => t.ticker).join(', ')} — bấm "Cập nhật giá" hoặc nhập giá trước.`);
  }

  const ds = items.map((it) => {
    const q = it.quantity ?? 0;
    const p = it.priceVnd ?? 0;
    return { ...it, q, p, w: it.targetPct / 100, v: q * p };
  });
  const V = ds.reduce((s, d) => s + d.v, 0);
  const T = V + cashVnd;

  // 1) Chia theo khoảng thiếu (số thực).
  const gap = ds.map((d) => Math.max(0, d.w * T - d.v));
  const tongGap = gap.reduce((s, g) => s + g, 0);
  const tien = gap.map((g) => (tongGap > EPS ? (cashVnd * g) / tongGap : 0));

  // 2) Làm tròn xuống theo bước mua.
  const mua = ds.map((d, i) => (d.p > 0 ? Math.floor(tien[i] / (d.p * lotSize) + EPS) * lotSize : 0));
  let du = cashVnd - ds.reduce((s, d, i) => s + mua[i] * d.p, 0);

  // 3) Tiền lẻ: mỗi vòng mua thêm 1 bước cho mã đang thiếu so với mục tiêu
  //    nhiều nhất (tính trên tổng sau nạp T) mà còn đủ tiền.
  for (;;) {
    let chon = -1;
    let thieuNhat = 0;
    ds.forEach((d, i) => {
      if (d.p <= 0 || d.w <= 0) return;
      const chiPhi = d.p * lotSize;
      if (chiPhi > du + EPS) return;
      const thieu = d.w * T - (d.v + mua[i] * d.p);
      if (thieu > thieuNhat + EPS) {
        thieuNhat = thieu;
        chon = i;
      }
    });
    if (chon < 0) break;
    mua[chon] += lotSize;
    du -= ds[chon].p * lotSize;
  }

  const rows: AllocationRow[] = ds.map((d, i) => {
    const buyVnd = mua[i] * d.p;
    return {
      id: d.id, ticker: d.ticker, priceVnd: d.p, quantity: d.q, valueVnd: d.v,
      currentPct: V > 0 ? (d.v / V) * 100 : 0,
      targetPct: d.targetPct,
      buyShares: mua[i], buyVnd,
      afterQuantity: d.q + mua[i], afterValueVnd: d.v + buyVnd,
      afterPct: 0,
    };
  });
  const spentVnd = rows.reduce((s, r) => s + r.buyVnd, 0);
  const totalAfterVnd = V + spentVnd;
  for (const r of rows) r.afterPct = totalAfterVnd > 0 ? (r.afterValueVnd / totalAfterVnd) * 100 : 0;

  // Tiền cần để về đúng mục tiêu không bán: tổng đích = max(v_i / w_i).
  const tongDich = ds.reduce((m, d) => (d.w > 0 ? Math.max(m, d.v / d.w) : m), 0);
  const neededForExactVnd = Math.max(0, tongDich - V);

  return {
    rows, totalBeforeVnd: V, cashVnd, spentVnd, leftoverVnd: Math.max(0, du),
    totalAfterVnd, neededForExactVnd,
  };
}

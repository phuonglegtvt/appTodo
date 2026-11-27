// Tài sản ròng = tổng tài sản − tổng nợ (hàm thuần, có test).
// ĐƠN VỊ: ĐỒNG tuyệt đối.

export interface NetWorthParts {
  stocks_vnd: number;
  crypto_vnd: number;
  gold_vnd: number;
  cash_vnd: number;
  debt_vnd: number;
}

export interface NetWorthSnapshot extends NetWorthParts {
  /** YYYY-MM-01 */
  month: string;
  assets_vnd: number;
  net_vnd: number;
  captured_at?: string;
}

export function tinhTaiSanRong(p: NetWorthParts): { assets_vnd: number; net_vnd: number } {
  for (const [k, v] of Object.entries(p)) {
    if (!Number.isFinite(v) || v < 0) throw new Error(`Số liệu tài sản ròng không hợp lệ (${k} = ${v}).`);
  }
  const assets_vnd = p.stocks_vnd + p.crypto_vnd + p.gold_vnd + p.cash_vnd;
  return { assets_vnd, net_vnd: assets_vnd - p.debt_vnd };
}

/** YYYY-MM-DD → YYYY-MM-01 */
export function dauThang(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}

export interface ThayDoi {
  /** Chênh tài sản ròng so với tháng trước gần nhất có số liệu. */
  soVoiThangTruoc: number | null;
  thangTruoc: string | null;
  /** Chênh so với tháng đầu tiên có số liệu. */
  tuDauVnd: number | null;
  thangDau: string | null;
}

/** So sánh snapshot của `thang` với các tháng trước nó. Danh sách tuỳ thứ tự. */
export function thayDoi(list: NetWorthSnapshot[], thang: string): ThayDoi {
  const ds = [...list].sort((a, b) => (a.month < b.month ? -1 : 1));
  const hienTai = ds.find((s) => s.month === thang);
  const truoc = ds.filter((s) => s.month < thang);
  if (!hienTai || truoc.length === 0) {
    return { soVoiThangTruoc: null, thangTruoc: null, tuDauVnd: null, thangDau: null };
  }
  const tt = truoc[truoc.length - 1];
  return {
    soVoiThangTruoc: hienTai.net_vnd - tt.net_vnd,
    thangTruoc: tt.month,
    tuDauVnd: hienTai.net_vnd - ds[0].net_vnd,
    thangDau: ds[0].month,
  };
}

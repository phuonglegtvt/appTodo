// Biên đổi holdings thật (`public.stocks/cryptos/golds`) thành `AllocationRow[]`
// để nạp vào `mapToSnapshot` — hàm THUẦN, không I/O, test được không cần DB.
//
// Vì sao đọc trực tiếp holdings mà không đi qua `portfolio.v_allocation`:
// view đó dựng vị thế từ sổ giao dịch (`portfolio.transactions`), mà sổ giao
// dịch chưa có đường ghi nào. Đọc thẳng holdings cho ra tỷ trọng dùng được ngay;
// engine không biết và không cần biết số liệu đến từ đâu. Khi nào có sổ giao
// dịch thì đổi lại nguồn ở `portfolioRepo`, không phải sửa domain.
//
// ⚠️ ĐÂY LÀ CHỖ DUY NHẤT ĐƯỢC QUY ĐỔI ĐƠN VỊ (luật `src/domain/` trong CLAUDE.md):
//   · stocks.current_price   NGHÌN ĐỒNG → × 1.000
//   · stocks.invested_amount ĐỒNG       → dùng thẳng
//   · cryptos.*_price        USD        → × tỷ giá
//   · golds.*_price          ĐỒNG/lượng → dùng thẳng
//
// ⚠️ HẠN CHẾ ĐÃ BIẾT của cost_basis crypto: `avg_buy_price` là USD nhưng bảng cũ
// KHÔNG lưu tỷ giá lúc mua, nên phải nhân tỷ giá HÔM NAY. Hệ quả: phần "lãi/lỗ"
// của crypto lẫn cả biến động tỷ giá vào, không tách ra được. Tỷ trọng KHÔNG bị
// ảnh hưởng (cả tử và mẫu đều là giá hôm nay). Muốn tách thì cần sổ giao dịch có
// cột fx_rate đóng băng theo ngày (spec §2) — không tự sửa được ở đây.

import type { AllocationRow } from '../types/portfolio';
import type { Stock } from '../types/stock';
import type { Crypto } from '../types/crypto';
import type { Gold } from '../types/gold';

export interface HoldingsInput {
  stocks: Stock[];
  cryptos: Crypto[];
  golds: Gold[];
  /** Tỷ giá USD→VND. Phải là số dương hữu hạn — 0 hay NaN sẽ bị ném lỗi. */
  usdVnd: number;
}

export interface HoldingsMapResult {
  rows: AllocationRow[];
  /**
   * Mã ĐÃ bỏ tiền vào mà CHƯA nhập số lượng ⇒ không tính được giá trị thị
   * trường. Phải hiện lên UI: `mapToSnapshot` coi `quantity ?? 0` là 0 rồi bỏ
   * qua im lặng, nên nếu không bắt ở đây thì tỷ trọng hiện lên sẽ thiếu đúng
   * phần đó mà không một dấu hiệu nào.
   */
  missingQuantitySymbols: string[];
}

/** `null` khi thiếu bất kỳ thành phần nào — KHÔNG quy về 0đ. */
function nhan(a: number | null, b: number | null, heSo = 1): number | null {
  if (a === null || b === null) return null;
  return a * b * heSo;
}

/** Khung chung cho mọi dòng tài sản (không phải CASH) của hồ sơ này. */
function assetRow(over: {
  instrument_id: string;
  asset_class: AllocationRow['asset_class'];
  symbol: string;
  quantity: number | null;
  cost_basis_vnd: number | null;
  price_vnd: number | null;
  price_as_of: string | null;
  market_value_vnd: number | null;
}): AllocationRow {
  return {
    // Hồ sơ này không theo dõi tiền mặt và không có túi DCA nào.
    earmarked_for: null,
    cash_balance_vnd: null,
    ...over,
  };
}

export function toAllocationRows(input: HoldingsInput): HoldingsMapResult {
  const { stocks, cryptos, golds, usdVnd } = input;

  // Kiểm tỷ giá TRƯỚC vòng lặp, và chỉ khi thật sự có crypto cần quy đổi: tỷ
  // giá 0 nhân vào làm mọi crypto thành 0đ — tỷ trọng vẫn ra một con số đẹp,
  // sai hoàn toàn, không một tiếng động. NaN thì lọt qua cả `<= 0`.
  const canTyGia = cryptos.some((c) => c.quantity !== null && c.quantity > 0);
  if (canTyGia && (!Number.isFinite(usdVnd) || usdVnd <= 0)) {
    throw new Error(
      `Tỷ giá USD→VND không hợp lệ: ${usdVnd}. Không quy đổi được giá trị crypto — ` +
      `nhập tỷ giá tay hoặc thử lại khi có mạng.`,
    );
  }

  const rows: AllocationRow[] = [];
  const missingQuantitySymbols: string[] = [];

  /**
   * Quyết định chung cho cả ba nguồn: có đang giữ hay không.
   *   · quantity > 0            → đang giữ, dựng dòng
   *   · quantity === 0          → đã bán hết, bỏ qua (không phải lỗi)
   *   · quantity === null + đã bỏ tiền → THIẾU DỮ LIỆU, phải báo tên
   *   · quantity === null + chưa bỏ tiền → mã watchlist trắng, bỏ qua im lặng
   */
  function phanLoai(
    quantity: number | null, daBoTien: boolean, ten: string,
  ): 'dang-giu' | 'bo-qua' {
    if (quantity !== null && quantity > 0) return 'dang-giu';
    if (quantity === null && daBoTien) {
      missingQuantitySymbols.push(ten);
    }
    return 'bo-qua';
  }

  for (const s of stocks) {
    const daBoTien = s.invested_amount !== null && s.invested_amount > 0;
    if (phanLoai(s.quantity, daBoTien, s.ticker) === 'bo-qua') continue;

    // NGHÌN ĐỒNG → ĐỒNG.
    const giaVnd = s.current_price === null ? null : s.current_price * 1_000;
    rows.push(assetRow({
      instrument_id: s.id,
      asset_class: 'STOCKS',
      symbol: s.ticker,
      quantity: s.quantity,
      // invested_amount đã là ĐỒNG — không nhân 1.000.
      cost_basis_vnd: s.invested_amount,
      price_vnd: giaVnd,
      price_as_of: s.updated_at,
      market_value_vnd: nhan(s.quantity, giaVnd),
    }));
  }

  for (const c of cryptos) {
    const daBoTien = c.avg_buy_price !== null && c.avg_buy_price > 0;
    if (phanLoai(c.quantity, daBoTien, c.symbol) === 'bo-qua') continue;

    // USD → ĐỒNG.
    const giaVnd = c.current_price === null ? null : c.current_price * usdVnd;
    rows.push(assetRow({
      instrument_id: c.id,
      asset_class: 'CRYPTO',
      symbol: c.symbol,
      quantity: c.quantity,
      cost_basis_vnd: nhan(c.quantity, c.avg_buy_price, usdVnd),
      price_vnd: giaVnd,
      price_as_of: c.updated_at,
      market_value_vnd: nhan(c.quantity, giaVnd),
    }));
  }

  for (const g of golds) {
    const daBoTien = g.avg_buy_price !== null && g.avg_buy_price > 0;
    if (phanLoai(g.quantity, daBoTien, g.label) === 'bo-qua') continue;

    // ĐỒNG/lượng — KHÔNG quy đổi gì.
    rows.push(assetRow({
      instrument_id: g.id,
      asset_class: 'GOLD',
      symbol: g.label,
      quantity: g.quantity,
      cost_basis_vnd: nhan(g.quantity, g.avg_buy_price),
      price_vnd: g.current_price,
      price_as_of: g.updated_at,
      market_value_vnd: nhan(g.quantity, g.current_price),
    }));
  }

  return { rows, missingQuantitySymbols };
}

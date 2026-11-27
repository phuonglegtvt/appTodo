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
//   · stocks.invested_amount NGHÌN ĐỒNG → × 1.000
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
  /**
   * Tiền mặt đang có, ĐỒNG (`portfolio.settings.cash_on_hand_vnd`). Không truyền
   * = 0. Chỉ `toAllocationRows` dùng; lũy kế "đã đầu tư" không tính tiền mặt.
   */
  cashOnHandVnd?: number;
}

/** instrument_id giả cho dòng tiền mặt nhập tay — không có bảng nguồn nào. */
export const CASH_ON_HAND_ID = 'cash-on-hand';

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
      // NGHÌN ĐỒNG → ĐỒNG, cùng đơn vị với giá. NewPL nhập số tiền đầu tư theo
      // nghìn đồng (chốt 2026-08-23) — quên nhân ở đây thì "vốn đã bỏ" của cả
      // nhóm cổ phiếu nhỏ đi 1.000 lần và lãi/lỗ trông như lãi khủng.
      cost_basis_vnd: s.invested_amount === null ? null : s.invested_amount * 1_000,
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

  // Tiền mặt: MỘT dòng CASH không đặt tên cho nhóm nào (earmarked_for = null),
  // nên mapToSnapshot cộng nó vào classValues.CASH. Chặn số rác ngay đây để
  // lỗi nói đúng nguồn ("ô tiền mặt ở màn Cấu hình") thay vì tên cột DB.
  const tienMat = input.cashOnHandVnd ?? 0;
  if (!Number.isFinite(tienMat) || tienMat < 0) {
    throw new Error(
      `Số tiền mặt không hợp lệ: ${tienMat}. Sửa lại ô "Tiền mặt đang có" ở màn Cấu hình.`,
    );
  }
  if (tienMat > 0) {
    rows.push({
      instrument_id: CASH_ON_HAND_ID,
      asset_class: 'CASH',
      symbol: 'Tiền mặt',
      earmarked_for: null,
      quantity: null,
      // Tiền mặt không có lãi/lỗ: vốn = giá trị ⇒ cột lãi/lỗ hiện 0 chứ không
      // để trống như thể thiếu dữ liệu.
      cost_basis_vnd: tienMat,
      cash_balance_vnd: tienMat,
      price_vnd: null,
      price_as_of: null,
      market_value_vnd: tienMat,
    });
  }

  return { rows, missingQuantitySymbols };
}

// ---------------------------------------------------------------------------
// LŨY KẾ ĐÃ ĐẦU TƯ (tab Thu–Chi)
// ---------------------------------------------------------------------------

/**
 * Tổng vốn đã bỏ vào từ trước tới nay, theo VND. KHÔNG phải giá trị thị trường
 * hôm nay, và KHÔNG theo tháng — ba bảng nguồn không có cột ngày nào cả.
 */
export interface VonDaBo {
  stocksVnd: number;
  /** `null` = có crypto nhưng chưa quy đổi được vì thiếu tỷ giá. Khác hẳn 0đ. */
  cryptoVnd: number | null;
  goldVnd: number;
  /** `null` khi `cryptoVnd` là null — tổng thiếu một phần thì không phải tổng. */
  tongVnd: number | null;
  /**
   * Mã/dòng ĐÃ bỏ tiền mà CHƯA nhập số lượng ⇒ không tính được, bị thiếu khỏi
   * tổng. Phải hiện lên UI: im lặng thì con số lũy kế nhỏ hơn thực tế mà không
   * một dấu hiệu nào.
   */
  boSotSymbols: string[];
}

export function tongVonDaBo(input: HoldingsInput): VonDaBo {
  const { stocks, cryptos, golds, usdVnd } = input;
  const boSotSymbols: string[] = [];

  // Cổ phiếu: `invested_amount` nói thẳng đã bỏ vào bao nhiêu tiền nên KHÔNG
  // cần `quantity`. Đây là chỗ khác `toAllocationRows` — hàm kia bỏ qua mã
  // thiếu quantity vì nó đi tính giá trị thị trường, còn ở đây chỉ hỏi tiền đã
  // bỏ ra. NGHÌN ĐỒNG → ĐỒNG.
  let stocksVnd = 0;
  for (const s of stocks) {
    if (s.invested_amount !== null) stocksVnd += s.invested_amount * 1_000;
  }

  // Crypto: vốn = `quantity × avg_buy_price` (USD) × tỷ giá — CÙNG công thức
  // với tab Danh mục (`toAllocationRows`) và tab Crypto (`cryptoCalc.cost`).
  // NewPL chốt 2026-11-27: bỏ cột nhập tay `invested_amount` của crypto vì nó
  // lệch với số lượng × giá TB (BTC 80tr nhập tay vs ~430tr suy ra) và làm mỗi
  // tab hiện một con số vốn khác nhau. Thiếu quantity ⇒ thiếu hẳn khoản đó ⇒
  // phải báo tên.
  let cryptoUsd = 0;
  let canTyGia = false;
  for (const c of cryptos) {
    if (c.avg_buy_price === null || c.avg_buy_price <= 0) continue;  // chưa bỏ tiền
    if (c.quantity === null) { boSotSymbols.push(c.symbol); continue; }
    cryptoUsd += c.quantity * c.avg_buy_price;
    canTyGia = true;
  }

  // Vàng vẫn có HAI đường: `invested_amount` (đồng, nhập thẳng) ưu tiên, nếu
  // không có thì `quantity × avg_buy_price`. Có (1) thì KHÔNG xét (2) — cộng
  // cả hai là tính đôi.
  let goldVnd = 0;
  for (const g of golds) {
    if (g.invested_amount !== null) { goldVnd += g.invested_amount; continue; }
    if (g.avg_buy_price === null || g.avg_buy_price <= 0) continue;
    if (g.quantity === null) { boSotSymbols.push(g.label); continue; }
    // ĐỒNG/lượng — KHÔNG quy đổi gì.
    goldVnd += g.quantity * g.avg_buy_price;
  }

  // Tỷ giá hỏng chỉ làm hỏng phần crypto. Cổ phiếu và vàng không phụ thuộc tỷ
  // giá nên vẫn phải ra số — kéo tất cả về null sẽ làm trắng cả khối chỉ vì
  // một request tỷ giá chưa về.
  //
  // Không ném lỗi như `toAllocationRows`: khối này chỉ để xem, chặn cả trang vì
  // thiếu tỷ giá thì nặng tay. Trả `null` để UI nói rõ "chưa quy đổi được".
  const tyGiaHong = !Number.isFinite(usdVnd) || usdVnd <= 0;
  const cryptoVnd = !canTyGia ? 0 : tyGiaHong ? null : cryptoUsd * usdVnd;

  return {
    stocksVnd,
    cryptoVnd,
    goldVnd,
    tongVnd: cryptoVnd === null ? null : stocksVnd + cryptoVnd + goldVnd,
    boSotSymbols,
  };
}

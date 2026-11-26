// Sổ giao dịch crypto — phần TÍNH thuần (không I/O, không React).
//
// Mô hình "cộng dồn lên số cũ" (chốt 2026-11-26): dòng `public.cryptos` vẫn là
// nơi giữ số đang có. Mỗi giao dịch biến đổi dòng đó từ trạng thái TRƯỚC sang
// trạng thái SAU, và giao dịch lưu lại cả hai. Nhờ vậy:
//   · coin đã có số liệu từ trước KHÔNG phải nhập lại lịch sử;
//   · hoàn tác = trả dòng coin về đúng trạng thái TRƯỚC, không phải tính ngược
//     (tính ngược lệnh bán là bất khả khi bán hết: vốn về 0, mất tỷ lệ).
//
// ĐƠN VỊ (khớp bảng `public.cryptos`, xem CLAUDE.md):
//   · quantity          = số coin
//   · avg_buy_price     = USD / coin
//   · invested_amount   = VND (đồng) tuyệt đối
//   · giao dịch: price_usd = USD / coin, amount_vnd = đồng (đã chi khi MUA,
//     đã nhận khi BÁN)

export type TxSide = 'BUY' | 'SELL';

/** Ba cột của `public.cryptos` mà sổ giao dịch được phép thay đổi. */
export interface Holding {
  quantity: number | null;
  avg_buy_price: number | null;
  invested_amount: number | null;
}

export interface TxInput {
  side: TxSide;
  quantity: number;
  price_usd: number;
  amount_vnd: number;
}

export interface TxResult {
  after: Holding;
  /**
   * Lãi/lỗ ĐÃ CHỐT (đồng) của lệnh BÁN = tiền nhận − phần vốn của số coin bán.
   * `null` với lệnh MUA, hoặc khi coin chưa có "Đã đầu tư" nên không biết vốn.
   */
  realizedPnlVnd: number | null;
}

/** Sai số dấu phẩy động chấp nhận được khi so số lượng coin. */
const EPS = 1e-9;

function laSoDuong(v: number): boolean {
  return Number.isFinite(v) && v > 0;
}

/** Kiểm tra dữ liệu một giao dịch; ném lỗi tiếng Việt chỉ đúng ô sai. */
export function validateTx(tx: TxInput): void {
  if (tx.side !== 'BUY' && tx.side !== 'SELL') {
    throw new Error(`Loại giao dịch không hợp lệ: ${String(tx.side)}.`);
  }
  if (!laSoDuong(tx.quantity)) {
    throw new Error('Số lượng phải là số lớn hơn 0.');
  }
  if (!laSoDuong(tx.price_usd)) {
    throw new Error('Giá (USD/coin) phải là số lớn hơn 0.');
  }
  if (!Number.isFinite(tx.amount_vnd) || tx.amount_vnd < 0) {
    throw new Error('Số tiền (VND) phải là số không âm.');
  }
}

/**
 * Áp một giao dịch lên số đang có của coin.
 *
 * MUA: số lượng cộng thêm; giá mua TB = bình quân gia quyền theo số lượng; vốn
 *      (VND) cộng đúng số tiền đã chi.
 * BÁN: số lượng trừ đi; giá mua TB GIỮ NGUYÊN (bán không đổi giá vốn của phần
 *      còn lại); vốn giảm theo tỷ lệ số coin bán; chênh lệch với tiền nhận là
 *      lãi/lỗ đã chốt.
 */
export function applyTx(holding: Holding, tx: TxInput): TxResult {
  validateTx(tx);
  const q0 = holding.quantity ?? 0;
  if (q0 < 0) {
    throw new Error(`Số lượng đang có bị âm (${q0}). Sửa lại ở bảng trước khi ghi giao dịch.`);
  }

  if (tx.side === 'BUY') {
    // Đang giữ mà thiếu giá TB / vốn thì KHÔNG đoán: bình quân với một số
    // không biết sẽ cho ra một con số trông hợp lệ mà sai.
    if (q0 > 0 && holding.avg_buy_price === null) {
      throw new Error(
        'Coin này đang có số lượng nhưng chưa có giá mua TB. Nhập giá mua TB ở bảng trước, '
        + 'để app bình quân đúng với lần mua mới.',
      );
    }
    if (q0 > 0 && holding.invested_amount === null) {
      throw new Error(
        'Coin này đang có số lượng nhưng chưa nhập "Đã đầu tư" (VND). Nhập ở bảng trước, '
        + 'nếu không tổng vốn sẽ thiếu phần đã mua trước đây.',
      );
    }
    const q1 = q0 + tx.quantity;
    const avg = q0 > 0
      ? (q0 * (holding.avg_buy_price as number) + tx.quantity * tx.price_usd) / q1
      : tx.price_usd;
    return {
      after: {
        quantity: q1,
        avg_buy_price: avg,
        invested_amount: (holding.invested_amount ?? 0) + tx.amount_vnd,
      },
      realizedPnlVnd: null,
    };
  }

  // BÁN
  if (tx.quantity > q0 + EPS) {
    throw new Error(`Không thể bán ${tx.quantity} coin khi chỉ đang có ${q0}.`);
  }
  // Bán gần hết do sai số làm tròn ⇒ coi là bán hết, không để lại 1e-17 coin.
  const banHet = Math.abs(q0 - tx.quantity) <= EPS;
  const q1 = banHet ? 0 : q0 - tx.quantity;

  let invested: number | null = null;
  let realized: number | null = null;
  if (holding.invested_amount !== null) {
    const vonPhanBan = banHet ? holding.invested_amount : holding.invested_amount * (tx.quantity / q0);
    invested = holding.invested_amount - vonPhanBan;
    realized = tx.amount_vnd - vonPhanBan;
  }

  return {
    after: {
      quantity: q1,
      avg_buy_price: holding.avg_buy_price,
      invested_amount: invested,
    },
    realizedPnlVnd: realized,
  };
}

function gan(a: number | null, b: number | null): boolean {
  if (a === null || b === null) return a === b;
  return Math.abs(a - b) <= EPS * Math.max(1, Math.abs(a), Math.abs(b));
}

/**
 * Dòng coin hiện tại có còn đúng là kết quả của giao dịch này không. Nếu đã bị
 * sửa tay ở bảng sau đó, hoàn tác (trả về trạng thái TRƯỚC) sẽ xoá mất phần sửa
 * tay — nên phải từ chối và nói rõ.
 */
export function holdingMatches(current: Holding, expected: Holding): boolean {
  return gan(current.quantity, expected.quantity)
    && gan(current.avg_buy_price, expected.avg_buy_price)
    && gan(current.invested_amount, expected.invested_amount);
}

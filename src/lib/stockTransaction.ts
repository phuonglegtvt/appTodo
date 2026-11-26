// Sổ giao dịch cổ phiếu — phần TÍNH thuần (không I/O, không React).
//
// Cùng mô hình "cộng dồn lên số cũ" với sổ crypto (src/lib/cryptoTransaction.ts):
// dòng `public.stocks` vẫn giữ số đang có, mỗi giao dịch lưu trạng thái TRƯỚC và
// SAU để hoàn tác chỉ cần trả về TRƯỚC.
//
// Khác crypto: bảng `stocks` KHÔNG có cột giá mua TB — giá vốn TB được SUY RA
// từ `invested_amount / quantity` (xem `avgCostThousand`). Nên giao dịch chỉ
// đụng hai cột: quantity và invested_amount.
//
// ĐƠN VỊ (khớp bảng `public.stocks`, xem CLAUDE.md):
//   · quantity        = số cổ phiếu (số nguyên)
//   · invested_amount = NGHÌN ĐỒNG
//   · giao dịch: price_thousand = nghìn đồng / cổ, amount_thousand = nghìn đồng
//     (đã chi khi MUA — gồm cả phí; đã nhận khi BÁN — sau phí, thuế)

import type { TxSide } from './cryptoTransaction';

export interface StockHolding {
  quantity: number | null;
  invested_amount: number | null;
}

export interface StockTxInput {
  side: TxSide;
  quantity: number;
  price_thousand: number;
  amount_thousand: number;
}

export interface StockTxResult {
  after: StockHolding;
  /** Lãi/lỗ ĐÃ CHỐT (nghìn đồng) của lệnh BÁN. `null` với MUA hoặc khi chưa biết vốn. */
  realizedPnlThousand: number | null;
}

export function validateStockTx(tx: StockTxInput): void {
  if (tx.side !== 'BUY' && tx.side !== 'SELL') {
    throw new Error(`Loại giao dịch không hợp lệ: ${String(tx.side)}.`);
  }
  if (!Number.isInteger(tx.quantity) || tx.quantity <= 0) {
    throw new Error('Số lượng cổ phiếu phải là số nguyên lớn hơn 0.');
  }
  if (!Number.isFinite(tx.price_thousand) || tx.price_thousand <= 0) {
    throw new Error('Giá (nghìn đồng/cổ) phải là số lớn hơn 0.');
  }
  if (!Number.isFinite(tx.amount_thousand) || tx.amount_thousand < 0) {
    throw new Error('Số tiền (nghìn đồng) phải là số không âm.');
  }
}

/**
 * Áp một giao dịch lên số đang có của mã.
 * MUA: cộng số lượng, cộng vốn đúng số tiền đã chi.
 * BÁN: trừ số lượng, giảm vốn theo tỷ lệ số cổ bán (giá vốn TB của phần còn lại
 *      không đổi); chênh lệch với tiền nhận về là lãi/lỗ đã chốt.
 */
export function applyStockTx(holding: StockHolding, tx: StockTxInput): StockTxResult {
  validateStockTx(tx);
  const q0 = holding.quantity ?? 0;
  if (q0 < 0) {
    throw new Error(`Số lượng đang có bị âm (${q0}). Sửa lại ở bảng trước khi ghi giao dịch.`);
  }

  if (tx.side === 'BUY') {
    // Đang giữ mà chưa nhập vốn ⇒ cộng vào sẽ ra một con số trông hợp lệ mà
    // thiếu toàn bộ phần đã mua trước đây.
    if (q0 > 0 && holding.invested_amount === null) {
      throw new Error(
        'Mã này đang có số lượng nhưng chưa nhập "Số tiền đầu tư". Nhập ở bảng trước, '
        + 'nếu không tổng vốn sẽ thiếu phần đã mua trước đây.',
      );
    }
    return {
      after: {
        quantity: q0 + tx.quantity,
        invested_amount: (holding.invested_amount ?? 0) + tx.amount_thousand,
      },
      realizedPnlThousand: null,
    };
  }

  if (tx.quantity > q0) {
    throw new Error(`Không thể bán ${tx.quantity} cổ khi chỉ đang có ${q0}.`);
  }
  const q1 = q0 - tx.quantity;
  let invested: number | null = null;
  let realized: number | null = null;
  if (holding.invested_amount !== null) {
    const vonPhanBan = q1 === 0 ? holding.invested_amount : holding.invested_amount * (tx.quantity / q0);
    invested = holding.invested_amount - vonPhanBan;
    realized = tx.amount_thousand - vonPhanBan;
  }
  return { after: { quantity: q1, invested_amount: invested }, realizedPnlThousand: realized };
}

/**
 * Giá vốn trung bình (nghìn đồng / cổ) = vốn ÷ số lượng. `null` khi thiếu một
 * trong hai hoặc số lượng = 0 (đã bán hết thì không còn giá vốn nào để nói).
 */
export function avgCostThousand(s: StockHolding): number | null {
  if (s.quantity === null || s.invested_amount === null || s.quantity <= 0) return null;
  return s.invested_amount / s.quantity;
}

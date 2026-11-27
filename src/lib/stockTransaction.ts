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
import type { StockTransaction } from '../types/stockTransaction';

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

// ---------------------------------------------------------------------------
// SỬA một giao dịch đã ghi
// ---------------------------------------------------------------------------
// Mỗi giao dịch lưu trạng thái TRƯỚC/SAU và các giao dịch của một mã nối thành
// dây chuyền: SAU của giao dịch này = TRƯỚC của giao dịch kế tiếp. Sửa một giao
// dịch ở giữa ⇒ phải tính lại toàn bộ phần dây chuyền phía sau, rồi đưa số cuối
// cùng vào dòng `stocks`.

/** Phần của một giao dịch đã ghi mà phép tính lại cần đến. */
export interface RecordedStockTx extends StockTxInput {
  id: string;
  created_at: string;
  /** YYYY-MM-DD — chỉ để báo lỗi dễ hiểu. */
  trade_date: string;
  before_quantity: number | null;
  before_invested_amount: number | null;
  after_quantity: number | null;
  after_invested_amount: number | null;
}

export interface StockTxRecalc {
  id: string;
  before: StockHolding;
  after: StockHolding;
  realizedPnlThousand: number | null;
}

export interface StockTxEditPlan {
  /** Giao dịch được sửa + mọi giao dịch sau nó, theo thứ tự ghi. */
  updates: StockTxRecalc[];
  /** Số liệu mã PHẢI đang có (= SAU của giao dịch cuối, trước khi sửa). */
  expectedCurrent: StockHolding;
  /** Số liệu mã sau khi sửa. */
  final: StockHolding;
}

/** So khớp có dung sai, giống `crypto_num_gan` phía DB. */
function gan(a: number | null, b: number | null): boolean {
  if (a === null || b === null) return a === null && b === null;
  return Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
}

/**
 * Lập kế hoạch sửa giao dịch `editId` thành `input`, tính lại các giao dịch sau.
 *
 * `chain` = mọi giao dịch của MỘT mã (thứ tự tuỳ ý, hàm tự sắp theo lúc ghi).
 * Ném lỗi tiếng Việt khi:
 * - không thấy giao dịch;
 * - dây chuyền phía sau bị đứt (mã bị sửa tay giữa hai giao dịch) — tính lại
 *   sẽ xoá mất phần sửa tay đó, nên KHÔNG tự đoán;
 * - số liệu mới làm một lệnh bán phía sau thành bán quá số đang có.
 */
export function planStockTxEdit(chain: RecordedStockTx[], editId: string, input: StockTxInput): StockTxEditPlan {
  validateStockTx(input);
  const sorted = [...chain].sort((a, b) => (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0));
  const k = sorted.findIndex((t) => t.id === editId);
  if (k < 0) throw new Error('Không tìm thấy giao dịch cần sửa.');

  for (let j = k + 1; j < sorted.length; j++) {
    const truoc = sorted[j - 1];
    const sau = sorted[j];
    if (!gan(sau.before_quantity, truoc.after_quantity) || !gan(sau.before_invested_amount, truoc.after_invested_amount)) {
      throw new Error(
        'Mã này đã được sửa tay ở bảng giữa các giao dịch phía sau, nên không tính lại tự động được '
        + '(sẽ xoá mất phần sửa tay). Hoàn tác các giao dịch sau rồi ghi lại, hoặc sửa số liệu ở bảng.',
      );
    }
  }

  const updates: StockTxRecalc[] = [];
  let state: StockHolding = { quantity: sorted[k].before_quantity, invested_amount: sorted[k].before_invested_amount };
  for (let j = k; j < sorted.length; j++) {
    const t = sorted[j];
    const tx = j === k ? input : { side: t.side, quantity: t.quantity, price_thousand: t.price_thousand, amount_thousand: t.amount_thousand };
    let r: StockTxResult;
    try {
      r = applyStockTx(state, tx);
    } catch (err) {
      if (j === k) throw err;
      const msg = err instanceof Error ? err.message : String(err);
      const ngay = t.trade_date.split('-').reverse().join('/');
      const loai = t.side === 'BUY' ? 'mua' : 'bán';
      throw new Error(`Sau khi sửa, giao dịch ${loai} ${t.quantity} cổ ngày ${ngay} phía sau không còn hợp lệ: ${msg}`);
    }
    updates.push({ id: t.id, before: state, after: r.after, realizedPnlThousand: r.realizedPnlThousand });
    state = r.after;
  }

  const cuoi = sorted[sorted.length - 1];
  return {
    updates,
    expectedCurrent: { quantity: cuoi.after_quantity, invested_amount: cuoi.after_invested_amount },
    final: state,
  };
}

/**
 * Mọi giao dịch của mã `stockId`, đổi sang dạng số cho `planStockTxEdit`.
 * Cột numeric có thể về dạng chuỗi tuỳ driver ⇒ ép số ở đây, một chỗ duy nhất.
 */
export function recordedChainOf(transactions: StockTransaction[], stockId: string): RecordedStockTx[] {
  const so = (v: number | string | null) => (v === null ? null : Number(v));
  return transactions
    .filter((t) => t.stock_id === stockId)
    .map((t) => ({
      id: t.id, created_at: t.created_at, trade_date: t.trade_date, side: t.side,
      quantity: Number(t.quantity), price_thousand: Number(t.price_thousand), amount_thousand: Number(t.amount_thousand),
      before_quantity: so(t.before_quantity), before_invested_amount: so(t.before_invested_amount),
      after_quantity: so(t.after_quantity), after_invested_amount: so(t.after_invested_amount),
    }));
}

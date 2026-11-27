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
import { planDelete, planEdit, type AssetPlan, type ChainEntry, type ChainOps, type EditPlan } from './txChain';

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
// SỬA một giao dịch đã ghi (kể cả đổi sang mã khác) — lõi tính ở lib/txChain.ts.
// ---------------------------------------------------------------------------

/** Phần của một giao dịch đã ghi mà phép tính lại cần đến (dạng số). */
export interface RecordedStockTx extends StockTxInput {
  id: string;
  stock_id: string;
  created_at: string;
  /** YYYY-MM-DD — chỉ để báo lỗi dễ hiểu. */
  trade_date: string;
  before_quantity: number | null;
  before_invested_amount: number | null;
  after_quantity: number | null;
  after_invested_amount: number | null;
}

/** So khớp có dung sai, giống `crypto_num_gan` phía DB. */
function gan(a: number | null, b: number | null): boolean {
  if (a === null || b === null) return a === null && b === null;
  return Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
}

const STOCK_OPS: ChainOps<StockHolding, StockTxInput> = {
  apply: (h, i) => {
    const r = applyStockTx(h, i);
    return { after: r.after, realized: r.realizedPnlThousand };
  },
  same: (a, b) => gan(a.quantity, b.quantity) && gan(a.invested_amount, b.invested_amount),
  describe: (i) => `${i.side === 'BUY' ? 'mua' : 'bán'} ${i.quantity} cổ`,
};

function toEntry(t: RecordedStockTx): ChainEntry<StockHolding, StockTxInput> {
  return {
    id: t.id,
    created_at: t.created_at,
    trade_date: t.trade_date,
    input: { side: t.side, quantity: t.quantity, price_thousand: t.price_thousand, amount_thousand: t.amount_thousand },
    before: { quantity: t.before_quantity, invested_amount: t.before_invested_amount },
    after: { quantity: t.after_quantity, invested_amount: t.after_invested_amount },
  };
}

/**
 * Lập kế hoạch sửa giao dịch `editId` thành `input`.
 * `all` = mọi giao dịch cổ phiếu (hàm tự lọc theo mã). Đổi mã: truyền `move`
 * với id mã mới và số liệu hiện tại của mã đó.
 */
export function planStockTxEdit(
  all: RecordedStockTx[],
  editId: string,
  input: StockTxInput,
  move?: { stockId: string; current: StockHolding },
): EditPlan<StockHolding> {
  validateStockTx(input);
  const x = all.find((t) => t.id === editId);
  if (!x) throw new Error('Không tìm thấy giao dịch cần sửa.');
  const cung = (id: string) => all.filter((t) => t.stock_id === id).map(toEntry);
  const doiMa = move !== undefined && move.stockId !== x.stock_id;
  return planEdit(STOCK_OPS, cung(x.stock_id), editId, input,
    doiMa ? { chain: cung(move.stockId), current: move.current } : undefined);
}

/** Lập kế hoạch XOÁ giao dịch `deleteId`; các giao dịch sau của cùng mã tính lại. */
export function planStockTxDelete(all: RecordedStockTx[], deleteId: string): AssetPlan<StockHolding> {
  const x = all.find((t) => t.id === deleteId);
  if (!x) throw new Error('Không tìm thấy giao dịch cần xoá.');
  return planDelete(STOCK_OPS, all.filter((t) => t.stock_id === x.stock_id).map(toEntry), deleteId);
}

/**
 * Đổi giao dịch từ DB sang dạng số cho `planStockTxEdit`.
 * Cột numeric có thể về dạng chuỗi tuỳ driver ⇒ ép số ở đây, một chỗ duy nhất.
 */
export function toRecordedStockTxs(transactions: StockTransaction[]): RecordedStockTx[] {
  const so = (v: number | string | null) => (v === null ? null : Number(v));
  return transactions.map((t) => ({
    id: t.id, stock_id: t.stock_id, created_at: t.created_at, trade_date: t.trade_date, side: t.side,
    quantity: Number(t.quantity), price_thousand: Number(t.price_thousand), amount_thousand: Number(t.amount_thousand),
    before_quantity: so(t.before_quantity), before_invested_amount: so(t.before_invested_amount),
    after_quantity: so(t.after_quantity), after_invested_amount: so(t.after_invested_amount),
  }));
}
